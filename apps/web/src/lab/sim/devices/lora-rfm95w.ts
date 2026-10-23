/**
 * RFM95W LoRa module (HopeRF, Semtech SX1276 inside; 868/915 MHz class), protocol 'spi': an emulated SX127x register file.
 * This is the Pro default radio: used at 920-923 MHz it sits inside Indonesia's AS923-2 plan (LoRa Alliance RP002). The 433 MHz Ra-02
 * (lora-ra02.ts) shares this model (`createSx127x`) but a different hardware band.
 *
 * Behaviour, from the public Semtech SX1276/77/78/79 datasheet (section 4.1.7 SPI interface, register table 85, section 4.1.1.6 time on air),
 * written by us, no vendor code:
 *  - SPI mode 0 only, MSB first. First byte = wnr<<7 | addr; after it the address auto-increments while NSS stays low, EXCEPT on the FIFO
 *    register 0x00, where the burst keeps reading/writing the FIFO through RegFifoAddrPtr (0x0D), which increments itself.
 *  - Reset values of the LoRa register view are the datasheet ones (RegVersion 0x42 = 0x12, Frf 0x6C8000 = 434 MHz, ModemConfig1 0x72,
 *    ModemConfig2 0x70, ModemConfig3 0x04, SyncWord 0x12, PaConfig 0x4F, TxBase 0x80...). The FSK register view is NOT modelled.
 *  - RegOpMode 0x01: LongRangeMode (bit 7) can only change in SLEEP; modes SLEEP/STDBY/FSTX/TX/FSRX/RXCONT/RXSINGLE/CAD.
 *  - TX: setting mode TX sends RegPayloadLength bytes from FIFO[RegFifoTxBaseAddr]; TxDone (IrqFlags 0x08) rises after the real time on air
 *    (formula of section 4.1.1.6 from SF, BW, CR, preamble, header and CRC), the chip falls back to STDBY, and DIO0 follows when mapped to TxDone.
 *    Leaving TX early (to SLEEP) aborts the packet. PA ramp and oscillator start-up (tens of microseconds) are not modelled.
 *  - RX: there is no air. A popover terminal injects a packet (ASCII, or "hex:" followed by hex bytes) while the chip is in RXCONT/RXSINGLE;
 *    RxDone rises after that packet's time on air. RSSI and SNR registers are not faked (they stay 0).
 *  - NOT modelled: FSK/OOK, CAD, frequency hopping, RX timeout, CRC errors, sync-word filtering between radios, channel activity.
 * Pair: scene/parts/lora-rfm95w.ts (3D). Both are auto-discovered. Guide: docs/lab-extending.md
 */
import {defineDevice,ms} from './types';
import type {DeviceCtx,DeviceModel,DeviceState,InputSpec} from './types';
import type {PartInput} from '../../contract';

/** LoRa bandwidth table of RegModemConfig1 bits 7:4 (datasheet table 85), in Hz. */
export const LORA_BW_HZ=[7800,10400,15600,20800,31250,41700,62500,125000,250000,500000] as const;
/** FSTEP = 32 MHz / 2^19 (datasheet 4.1.4), in Hz. */
export const FSTEP_HZ=32e6/2**19;

export interface ToaParams{sf:number;bwHz:number;/** 1..4 for 4/5..4/8 */cr:number;preamble:number;payload:number;crc:boolean;implicit:boolean;ldro:boolean}
/** Time on air in seconds, SX1276 datasheet 4.1.1.6: Tsym = 2^SF/BW, Tpreamble = (npreamble+4.25) Tsym, payload symbols = 8 + max(ceil((8PL-4SF+28+16CRC-20IH)/(4(SF-2DE)))(CR+4),0). */
export function loraTimeOnAir(p:ToaParams):number{
 const tsym=2**p.sf/p.bwHz;
 const ih=p.implicit?1:0,de=p.ldro?1:0;
 const num_=8*p.payload-4*p.sf+28+16*(p.crc?1:0)-20*ih;
 const nSym=8+Math.max(Math.ceil(num_/(4*(p.sf-2*de)))*(p.cr+4),0);
 return (p.preamble+4.25)*tsym+nSym*tsym;
}

/** Register addresses used (LoRa view). */
export const REG={FIFO:0x00,OPMODE:0x01,FRF_MSB:0x06,FRF_MID:0x07,FRF_LSB:0x08,PA_CONFIG:0x09,LNA:0x0c,FIFO_ADDR_PTR:0x0d,FIFO_TX_BASE:0x0e,FIFO_RX_BASE:0x0f,
 FIFO_RX_CURRENT:0x10,IRQ_MASK:0x11,IRQ_FLAGS:0x12,RX_NB_BYTES:0x13,MODEM_CONFIG1:0x1d,MODEM_CONFIG2:0x1e,PREAMBLE_MSB:0x20,PREAMBLE_LSB:0x21,
 PAYLOAD_LENGTH:0x22,MODEM_CONFIG3:0x26,FIFO_RX_BYTE_ADDR:0x25,SYNC_WORD:0x39,DIO_MAPPING1:0x40,DIO_MAPPING2:0x41,VERSION:0x42,PA_DAC:0x4d} as const;
export const IRQ={RX_TIMEOUT:0x80,RX_DONE:0x40,PAYLOAD_CRC_ERROR:0x20,VALID_HEADER:0x10,TX_DONE:0x08,CAD_DONE:0x04,FHSS_CHANGE:0x02,CAD_DETECTED:0x01} as const;
export const MODE={SLEEP:0,STDBY:1,FSTX:2,TX:3,FSRX:4,RXCONT:5,RXSINGLE:6,CAD:7} as const;
const MODE_NAME=['sleep','stdby','fstx','tx','fsrx','rxcont','rxsingle','cad'] as const;
const READ_ONLY=new Set<number>([REG.FIFO_RX_CURRENT,REG.RX_NB_BYTES,REG.FIFO_RX_BYTE_ADDR,0x19,0x1a,0x1b,0x1c,REG.VERSION]);

function resetRegs():Uint8Array{
 const r=new Uint8Array(0x80);
 r[REG.OPMODE]=0x09;                                 // FSK view, LowFrequencyModeOn, STDBY
 r[REG.FRF_MSB]=0x6c;r[REG.FRF_MID]=0x80;r[REG.FRF_LSB]=0x00;   // 434.0 MHz
 r[REG.PA_CONFIG]=0x4f;r[0x0a]=0x09;r[0x0b]=0x2b;r[REG.LNA]=0x20;
 r[REG.FIFO_TX_BASE]=0x80;r[REG.FIFO_RX_BASE]=0x00;
 r[REG.MODEM_CONFIG1]=0x72;r[REG.MODEM_CONFIG2]=0x70;r[REG.MODEM_CONFIG3]=0x04;
 r[0x1f]=0x64;r[REG.PREAMBLE_MSB]=0x00;r[REG.PREAMBLE_LSB]=0x08;r[REG.PAYLOAD_LENGTH]=0x01;r[0x23]=0xff;
 r[0x31]=0xc3;r[0x37]=0x0a;r[REG.SYNC_WORD]=0x12;r[REG.VERSION]=0x12;r[REG.PA_DAC]=0x84;
 return r;
}

/** What differs between the RFM95W and the Ra-02. */
export interface Sx127xCfg{kind:string;/** the module's usable RF band in MHz */bandMin:number;bandMax:number}
export interface Sx127xState extends DeviceState{
 mode:string;loraMode:boolean;freqMHz:number;/** inside the module's hardware band */inBand:boolean;/** inside AS923-2 (920-923 MHz), info only */inAs923_2:boolean;
 sf:number;bwKHz:number;cr:string;txDbm:number;toaMs:number;
 txCount:number;rxCount:number;lastTxHex:string;lastTxAscii:string;lastRxHex:string;irqFlags:number;dio0:boolean;
 reads:number;writes:number;fifoDropped:number;badSpiMode:number;noAntennaTx:number;antenna:boolean;transcript:string;
}

const hex=(b:readonly number[]):string=>b.map(x=>x.toString(16).padStart(2,'0')).join(' ');
const ascii=(b:readonly number[]):string=>b.map(x=>x>=32&&x<127?String.fromCharCode(x):'.').join('');

/** The SX127x core shared by every LoRa module (spi slave, FIFO, TX timing, injected RX). */
export function createSx127x(ctx:DeviceCtx,cfg:Sx127xCfg):DeviceModel<Sx127xState>{
 let regs=resetRegs();
 let fifo=new Uint8Array(256);
 let gen=0,selected=false,reg=0,write=false,dioLevel=false;
 const st={reads:0,writes:0,fifoDropped:0,badSpiMode:0,txCount:0,rxCount:0,noAntennaTx:0};
 let lastTx:number[]=[],lastRx:number[]=[];
 const log:string[]=[];
 const say=(l:string):void=>{log.push(l);if(log.length>8)log.shift();};
 const dio0=ctx.pin('DIO0'),dio1=ctx.pin('DIO1'),dio3=ctx.pin('DIO3'),rst=ctx.pin('RESET');
 const dioLast=new Map<string,boolean>();

 const mode=():number=>regs[REG.OPMODE]!&7;
 const lora=():boolean=>(regs[REG.OPMODE]!&0x80)!==0;
 const freqMHz=():number=>(((regs[REG.FRF_MSB]!<<16)|(regs[REG.FRF_MID]!<<8)|regs[REG.FRF_LSB]!)*FSTEP_HZ)/1e6;
 const cfgOf=(len:number):ToaParams=>{
  const m1=regs[REG.MODEM_CONFIG1]!,m2=regs[REG.MODEM_CONFIG2]!,m3=regs[REG.MODEM_CONFIG3]!;
  const bw=LORA_BW_HZ[Math.min(9,m1>>4)]!;
  return {sf:Math.max(6,Math.min(12,m2>>4)),bwHz:bw,cr:Math.max(1,Math.min(4,(m1>>1)&7)),preamble:(regs[REG.PREAMBLE_MSB]!<<8)|regs[REG.PREAMBLE_LSB]!,
   payload:len,crc:(m2&0x04)!==0,implicit:(m1&1)!==0,ldro:(m3&0x08)!==0};
 };
 /** Output power in dBm (datasheet 3.4.2): PA_BOOST 2..17 dBm, +20 with RegPaDac 0x87 and OutputPower 15; RFO = 10.8+0.6 MaxPower-(15-OutputPower). */
 const txDbm=():number=>{
  const pa=regs[REG.PA_CONFIG]!,outp=pa&15;
  if(pa&0x80)return (regs[REG.PA_DAC]!&7)===7&&outp===15?20:2+outp;
  const pmax=10.8+0.6*((pa>>4)&7);
  return Math.round((pmax-(15-outp))*10)/10;
 };
 const toaMs=():number=>Math.round(loraTimeOnAir(cfgOf(regs[REG.PAYLOAD_LENGTH]!))*1e6)/1e3;

 /** DIO pins follow IrqFlags through RegDioMapping1 (table 18 of the datasheet); a masked flag (RegIrqFlagsMask) does not drive a pin. */
 const syncDio=():void=>{
  const f=regs[REG.IRQ_FLAGS]!&~regs[REG.IRQ_MASK]!,map=regs[REG.DIO_MAPPING1]!;
  const lv=(pin:typeof dio0,name:string,m:number,flags:readonly number[]):void=>{
   const v=(f&(flags[m]??0))!==0;
   if(name==='DIO0')dioLevel=v;
   if(pin&&dioLast.get(name)!==v){dioLast.set(name,v);ctx.env.setPin(pin,v);}
  };
  lv(dio0,'DIO0',(map>>6)&3,[IRQ.RX_DONE,IRQ.TX_DONE,IRQ.CAD_DONE]);
  lv(dio1,'DIO1',(map>>4)&3,[IRQ.RX_TIMEOUT,IRQ.FHSS_CHANGE,IRQ.CAD_DETECTED]);
  lv(dio3,'DIO3',map&3,[IRQ.CAD_DONE,IRQ.VALID_HEADER,IRQ.PAYLOAD_CRC_ERROR]);
 };
 const raise=(flag:number):void=>{regs[REG.IRQ_FLAGS]=regs[REG.IRQ_FLAGS]!|flag;syncDio();};

 const startTx=():void=>{
  if(!lora())return;
  const len=regs[REG.PAYLOAD_LENGTH]!,base=regs[REG.FIFO_TX_BASE]!;
  const data:number[]=[];for(let i=0;i<len;i++)data.push(fifo[(base+i)&255]!);
  const secs=loraTimeOnAir(cfgOf(len)),my=++gen,f=freqMHz();
  if(ctx.props.antenna===false)st.noAntennaTx++;
  ctx.schedule(ms(secs*1000),()=>{
   if(my!==gen||mode()!==MODE.TX)return;               // aborted: the chip left TX before the packet ended
   lastTx=data;st.txCount++;
   regs[REG.OPMODE]=(regs[REG.OPMODE]!&~7)|MODE.STDBY;  // the chip returns to STDBY after TX
   say(`< TX ${len} B ${f.toFixed(3)} MHz ${ascii(data)}`);
   raise(IRQ.TX_DONE);
  });
 };
 const setOpMode=(v:number):void=>{
  const old=regs[REG.OPMODE]!;
  let n=v;
  if(((old^v)&0x80)!==0&&(old&7)!==MODE.SLEEP)n=(n&~0x80)|(old&0x80);   // LongRangeMode only changes in SLEEP
  regs[REG.OPMODE]=n;
  gen++;                                                              // any change cancels an unfinished TX or RX
  if((n&7)===MODE.TX)startTx();
  if((n&7)===MODE.SLEEP)fifo=new Uint8Array(256);                     // FIFO content is lost in SLEEP
 };

 const doReset=():void=>{regs=resetRegs();fifo=new Uint8Array(256);gen++;dioLast.clear();syncDio();};
 const regWrite=(a:number,v:number):void=>{
  st.writes++;
  if(a===REG.FIFO){
   if(mode()===MODE.SLEEP){st.fifoDropped++;return;}
   const p=regs[REG.FIFO_ADDR_PTR]!;fifo[p]=v;regs[REG.FIFO_ADDR_PTR]=(p+1)&255;return;
  }
  if(READ_ONLY.has(a))return;
  if(a===REG.OPMODE){setOpMode(v);return;}
  if(a===REG.IRQ_FLAGS){regs[a]=regs[a]!&~v;syncDio();return;}      // write 1 to clear
  regs[a]=v;
  if(a===REG.IRQ_MASK||a===REG.DIO_MAPPING1)syncDio();
 };
 const regRead=(a:number):number=>{
  st.reads++;
  if(a===REG.FIFO){
   if(mode()===MODE.SLEEP){st.fifoDropped++;return 0;}
   const p=regs[REG.FIFO_ADDR_PTR]!;regs[REG.FIFO_ADDR_PTR]=(p+1)&255;return fifo[p]!;
  }
  return regs[a]!;
 };

 /** A packet arrives from "the air" (popover terminal): FIFO fill at RxBase, RxDone after its time on air. */
 const inject=(bytes:number[]):void=>{
  if(!lora()||(mode()!==MODE.RXCONT&&mode()!==MODE.RXSINGLE)){say('> (ignored: put the radio in RX first)');return;}
  const base=regs[REG.FIFO_RX_BASE]!,my=gen;
  say(`> ${bytes.length} B ${ascii(bytes)}`);
  ctx.schedule(ms(loraTimeOnAir(cfgOf(bytes.length))*1000),()=>{
   if(my!==gen)return;
   for(let i=0;i<bytes.length;i++)fifo[(base+i)&255]=bytes[i]!;
   lastRx=bytes;st.rxCount++;
   regs[REG.FIFO_RX_CURRENT]=base;regs[REG.RX_NB_BYTES]=bytes.length;regs[REG.FIFO_RX_BYTE_ADDR]=(base+bytes.length)&255;
   if(mode()===MODE.RXSINGLE)regs[REG.OPMODE]=(regs[REG.OPMODE]!&~7)|MODE.STDBY;
   raise(IRQ.VALID_HEADER|IRQ.RX_DONE);
  });
 };
 const parseLine=(t:string):number[]=>{
  const s=t.trim();
  if(/^hex:/i.test(s))return (s.slice(4).match(/[0-9a-f]{2}/gi)??[]).map(h=>parseInt(h,16)).slice(0,255);
  return Array.from(s).map(ch=>ch.charCodeAt(0)&255).slice(0,255);
 };
 const spiCfg=(info:{mode:number;clockHz:number}):boolean=>{if(info.mode!==0){st.badSpiMode++;return false;}return true;};

 return {
  state:()=>{
   const f=freqMHz();
   return {
    mode:MODE_NAME[mode()]!,loraMode:lora(),freqMHz:Math.round(f*1000)/1000,inBand:f>=cfg.bandMin&&f<=cfg.bandMax,inAs923_2:f>=920&&f<=923,
    sf:cfgOf(0).sf,bwKHz:cfgOf(0).bwHz/1000,cr:`4/${cfgOf(0).cr+4}`,txDbm:txDbm(),toaMs:toaMs(),
    txCount:st.txCount,rxCount:st.rxCount,lastTxHex:hex(lastTx),lastTxAscii:ascii(lastTx),lastRxHex:hex(lastRx),irqFlags:regs[REG.IRQ_FLAGS]!,dio0:dioLevel,
    reads:st.reads,writes:st.writes,fifoDropped:st.fifoDropped,badSpiMode:st.badSpiMode,noAntennaTx:st.noAntennaTx,antenna:ctx.props.antenna!==false,
    transcript:log.join('\n'),
   };
  },
  setInput(i:PartInput){
   if(i.kind!=='ext'||i.type!==cfg.kind)return;
   const t=i.v.line;
   if(typeof t==='string'&&t.trim())inject(parseLine(t));
  },
  onPinChange(pin,level){if(pin===rst&&level===0)doReset();},   // NRESET low (>=100 us) resets the chip; ready 5 ms after release
  spi:{
   cs:'NSS',activeLow:true,
   onSelect(sel){selected=sel;},
   onTransfer(mosi,info){
    if(!selected&&info.index!==0)return 0;
    if(!spiCfg(info))return 0;                                       // the SX127x only speaks SPI mode 0
    if(info.index===0){write=(mosi&0x80)!==0;reg=mosi&0x7f;return 0;}
    const a=reg===REG.FIFO?REG.FIFO:(reg+info.index-1)&0x7f;          // burst: FIFO address does not move
    if(write){regWrite(a,mosi);return 0;}
    return regRead(a);
   },
  },
 };
}

export const SX127X_INPUTS=(kind:string):InputSpec[]=>[
 {type:'toggle',key:'antenna',label:{en:'Antenna attached',id:'Antena terpasang'},default:true},
 {type:'terminal',key:'line',label:{en:'Radio air (inject a packet)',id:'Udara radio (suntik paket)'},
  placeholder:{en:'Text, or hex: 48 69. Put the radio in RX first',id:'Teks, atau hex: 48 69. Set radio ke RX dulu'},input:kind,log:'transcript'},
];

export const RFM95W_BAND={min:862,max:1020} as const;

export const device=defineDevice<Sx127xState>({
 kind:'lora-rfm95w',protocol:'spi',
 // HopeRF RFM95W castellated pads, 16 x 2.0 mm pitch (datasheet pin table). A stamp module: no breadboard legs, wires only.
 pins:['GND','MISO','MOSI','SCK','NSS','RESET','DIO5','GND2','ANT','GND3','DIO3','DIO4','3V3','DIO0','DIO1','DIO2'],
 power:{rail:['3V3','GND'],min:1.8,max:3.7,ma:120},   // 1.8-3.7 V supply, about 120 mA at +20 dBm (datasheet)
 copy:{
  name:{en:'RFM95W LoRa module',id:'Modul LoRa RFM95W'},
  desc:{en:'A 868/915 MHz LoRa radio (Semtech SX1276 inside). Used at 920-923 MHz it fits the Indonesian plan. The simulation keeps the real register file and the real time on air; there is no radio link, so you inject received packets by hand.',id:'Radio LoRa 868/915 MHz (berisi Semtech SX1276). Dipakai di 920-923 MHz, cocok dengan rencana frekuensi Indonesia. Simulasi memakai register nyata dan waktu udara nyata; tidak ada tautan radio, jadi paket yang diterima kamu suntik sendiri.'},
  note:{en:'3.3 V only, never 5 V. Never transmit without the antenna. Set the frequency yourself: the chip wakes at 434 MHz, outside this module band.',id:'Hanya 3,3 V, jangan 5 V. Jangan pernah memancar tanpa antena. Atur frekuensi sendiri: chip menyala di 434 MHz, di luar pita modul ini.'},
 },
 inputs:SX127X_INPUTS('lora-rfm95w'),
 create:ctx=>createSx127x(ctx,{kind:'lora-rfm95w',bandMin:RFM95W_BAND.min,bandMax:RFM95W_BAND.max}),
});
