/**
 * RC522-RFID device (protocol 'spi'): MFRC522 13.56 MHz reader module (NXP MFRC522 datasheet, rev 3.9, section 8 for the SPI frames,
 * section 9 for the register map, ISO/IEC 14443-3 type A for the card side). Written from the public datasheet behaviour.
 *
 * SPI frame (mode 0, MSB first, up to 10 MHz): the first byte is the address, `(addr << 1) | (read ? 0x80 : 0)`. A read returns the data of
 * the PREVIOUS address on the next byte (so a burst read sends the address again for every byte and ends with 0x00); a write sends the
 * address once and then the data bytes (all to the same register: that is how the FIFO is filled).
 *
 * What is emulated: the register file (reset values from the datasheet, VersionReg 0x37 = 0x92), the 64-byte FIFO with level/flush/overflow,
 * ComIrq/DivIrq with the set/clear bit-7 rule, the IRQ pin (ComIEnReg bit 7 inverts it), the internal timer (TModeReg/TPrescaler/TReload, TAuto),
 * the CRC coprocessor (CalcCRC, preset from ModeReg), SoftReset and the RST pin, TxControlReg (the antenna), Transceive with StartSend,
 * and one ISO 14443-A card of three kinds in the field: REQA/WUPA -> ATQA, anticollision and SELECT over one or two cascade levels (4-byte and
 * 7-byte UIDs), HLTA, CRC_A checks, 106 kbit/s frame times and the 91 us card answer delay.
 *
 * What is NOT emulated (honest list): MFAuthent and Crypto1, MIFARE READ/WRITE of blocks (the card stays silent, so the reader times out),
 * bit-oriented anticollision (partial NVB with extra bits), RxAlign, the analog test registers and the self test, parity/collision errors
 * (one card at a time), RF field strength. A real module must run on 3.3 V (5 V destroys it); the pin is called 3V3.
 * Pair: scene/parts/rc522-rfid.ts (3D). Both are auto-discovered; nothing else to edit. Guide: docs/lab-extending.md
 */
import {defineDevice,ms,us} from './types';
import type {Level} from './types';
import type {UnoPin} from '../../contract';

// ---------- register addresses (datasheet table 20) ----------
export const REG={
 Command:0x01,ComIEn:0x02,DivIEn:0x03,ComIrq:0x04,DivIrq:0x05,Error:0x06,Status1:0x07,Status2:0x08,FIFOData:0x09,FIFOLevel:0x0a,WaterLevel:0x0b,Control:0x0c,BitFraming:0x0d,Coll:0x0e,
 Mode:0x11,TxMode:0x12,RxMode:0x13,TxControl:0x14,TxASK:0x15,TxSel:0x16,RxSel:0x17,RxThreshold:0x18,Demod:0x19,MfTx:0x1c,MfRx:0x1d,SerialSpeed:0x1f,
 CRCResultH:0x21,CRCResultL:0x22,ModWidth:0x24,RFCfg:0x26,GsN:0x27,CWGsP:0x28,ModGsP:0x29,TMode:0x2a,TPrescaler:0x2b,TReloadH:0x2c,TReloadL:0x2d,TCounterH:0x2e,TCounterL:0x2f,
 TestSel1:0x31,TestSel2:0x32,TestPinEn:0x33,TestPinValue:0x34,TestBus:0x35,AutoTest:0x36,Version:0x37,AnalogTest:0x38,TestDAC1:0x39,TestDAC2:0x3a,TestADC:0x3b,
} as const;
/** Reset values (datasheet section 9). Everything not listed resets to 0. */
const RESET:Record<number,number>={
 [REG.Command]:0x20,[REG.ComIEn]:0x80,[REG.ComIrq]:0x14,[REG.Status1]:0x21,[REG.WaterLevel]:0x08,[REG.Coll]:0x80,
 [REG.Mode]:0x3f,[REG.TxControl]:0x80,[REG.TxSel]:0x10,[REG.RxSel]:0x84,[REG.RxThreshold]:0x84,[REG.Demod]:0x4d,[REG.MfTx]:0x62,[REG.SerialSpeed]:0xeb,
 [REG.ModWidth]:0x26,[REG.RFCfg]:0x48,[REG.GsN]:0x88,[REG.CWGsP]:0x20,[REG.ModGsP]:0x20,[REG.Version]:0x92,
};
const COMMANDS=['Idle','Mem','GenerateRandomID','CalcCRC','Transmit','NoCmdChange','','','Receive','','','','Transceive','','MFAuthent','SoftReset'] as const;

/** ISO 14443 type A at 106 kbit/s: one bit is 128 carrier cycles of 13.56 MHz = 9.44 us. */
export const BIT_US=128/13.56;
/** Frame delay time of a card answer to REQA/anticollision/select (ISO 14443-3: 1172 / fc = 86.4 us, plus the reader's own latency). */
export const FDT_US=91;
/** The module's 27.12 MHz crystal needs about a millisecond to start after a reset or power-up (datasheet: oscillator start-up + 37.74 us). */
export const STARTUP_MS=1;

/** Standard CRC_A (ISO 14443-3, annex B): polynomial 0x8408 reflected, preset 0x6363 (ModeReg CRCPreset 01). */
export function crcA(data:readonly number[],preset=0x6363):[number,number]{
 let crc=preset;
 for(const b0 of data){
  let b=(b0^(crc&0xff))&0xff;b=(b^(b<<4))&0xff;
  crc=(crc>>8)^(b<<8)^(b<<3)^(b>>4);crc&=0xffff;
 }
 return [crc&0xff,crc>>8];
}
const PRESETS=[0x0000,0x6363,0xa671,0xffff];

// ---------- the cards ----------
export interface CardDef{id:string;uid:readonly number[];atqa:readonly [number,number];sak:number}
/** Three tags with made-up UIDs. card3 has a 7-byte UID, so the reader needs two cascade levels. */
export const CARDS:Record<string,CardDef>={
 card1:{id:'card1',uid:[0x4b,0xa2,0x1f,0x93],atqa:[0x04,0x00],sak:0x08},
 card2:{id:'card2',uid:[0x07,0xc5,0x6e,0x2d],atqa:[0x04,0x00],sak:0x08},
 card3:{id:'card3',uid:[0x04,0x6a,0xb1,0x2c,0x5f,0x71,0x80],atqa:[0x44,0x00],sak:0x00},
};
export const CT=0x88;
/** The UID bytes one cascade level puts on the air, with its block check byte. */
export function uidFrame(uid:readonly number[],level:1|2):number[]{
 const part=uid.length===4?uid:level===1?[CT,...uid.slice(0,3)]:uid.slice(3,7);
 return [...part,part.reduce((a,b)=>a^b,0)];
}
const hex=(a:readonly number[]):string=>a.map(b=>b.toString(16).padStart(2,'0')).join('');
type CardState='idle'|'ready'|'active'|'halt';

export type Rc522RfidState={
 selected:boolean;powered:boolean;reads:number;writes:number;lastReg:number;mode:number;
 card:string;cardState:string;uid:string;antenna:boolean;command:string;version:number;fifo:number;irq:boolean;
 frames:number;cardAnswers:number;selects:number;lastTx:string;lastRx:string;badFrames:number;resets:number;
};

export const device=defineDevice<Rc522RfidState>({
 kind:'rc522-rfid',protocol:'spi',
 // module header order: SDA (this is the SPI chip select), SCK, MOSI, MISO, IRQ, GND, RST, 3.3V
 pins:['SDA','SCK','MOSI','MISO','IRQ','GND','RST','3V3'],
 power:{rail:['3V3','GND'],min:2.5,max:3.6,ma:20},
 copy:{
  name:{en:'RC522 RFID reader',id:'Pembaca RFID RC522'},
  desc:{en:'A 13.56 MHz card reader (MFRC522 chip) on SPI. Tap a card or tag on it, and the sketch reads its serial number.',id:'Pembaca kartu 13,56 MHz (chip MFRC522) lewat SPI. Tempelkan kartu atau tag, lalu sketch membaca nomor serinya.'},
  note:{en:'Runs on 3.3 V only. The pin marked SDA is the SPI chip select. Pick a card in the popover to hold it over the antenna.',id:'Hanya untuk 3,3 V. Pin bertanda SDA adalah chip select SPI. Pilih kartu di popover untuk menahannya di atas antena.'},
 },
 inputs:[{type:'choice',key:'card',label:{en:'Card or tag on the antenna',id:'Kartu atau tag di atas antena'},default:'none',options:[
  {value:'none',label:{en:'No card',id:'Tanpa kartu'}},
  {value:'card1',label:{en:'White card, 4-byte UID',id:'Kartu putih, UID 4 byte'}},
  {value:'card2',label:{en:'Blue key fob, 4-byte UID',id:'Gantungan biru, UID 4 byte'}},
  {value:'card3',label:{en:'Sticker tag, 7-byte UID',id:'Stiker tag, UID 7 byte'}},
 ]}],
 defaults:{card:'none'},
 create(ctx){
  const regs=new Uint8Array(64);
  const fifo:number[]=[];
  const mem=new Uint8Array(25);                 // the 25-byte internal buffer (Mem, GenerateRandomID)
  let selected=false,reads=0,writes=0,lastReg=0,mode=0,badFrames=0,resets=0;
  let addr=0,isRead=false;
  let crcBusy=false,crcOk=false;
  let epoch=0;                                  // bumped by anything that aborts an operation in flight
  let startupUntil=0,held=false;                // oscillator start-up after a reset, RST pin held low
  let timerRunning=false;
  let card:string='none',cardState:CardState='idle',cascade:1|2=1;
  let frames=0,cardAnswers=0,selects=0,lastTx='',lastRx='';
  let irqLevel:Level=1;
  const rstPin=ctx.pin('RST'),irqPin=ctx.pin('IRQ');
  const now=():number=>ctx.env.now();
  const powered=():boolean=>{const v=ctx.supply();return v===null||v>=2.5;};
  const alive=():boolean=>powered()&&!held;

  const resetRegs=():void=>{regs.fill(0);for(const [k,v] of Object.entries(RESET))regs[Number(k)]=v;fifo.length=0;epoch++;crcBusy=false;timerRunning=false;cardState='idle';};
  resetRegs();

  // a card change in the popover: the new card arrives powerless and idle
  const cardNow=():CardDef|undefined=>{
   const k=String(ctx.props.card??'none');
   if(k!==card){card=k;cardState='idle';cascade=1;}
   return CARDS[k];
  };
  const antennaOn=():boolean=>(regs[REG.TxControl]!&0x03)!==0;
  const irqBit=():boolean=>((regs[REG.ComIrq]!&regs[REG.ComIEn]!&0x7f)|(regs[REG.DivIrq]!&regs[REG.DivIEn]!&0x7f))!==0;
  // IRQ pin: ComIEnReg bit 7 (IRqInv) inverts it. The module has a pull-up, so idle is high with the default value 0x80.
  const syncIrq=():void=>{
   if(!irqPin)return;
   const active=irqBit(),inv=(regs[REG.ComIEn]!&0x80)!==0;
   const lv:Level=(active!==inv)?1:0;
   if(lv!==irqLevel){irqLevel=lv;ctx.env.setPin(irqPin,lv===1);}
  };
  const setIrq=(reg:number,bits:number):void=>{regs[reg]=(regs[reg]!|bits)&0x7f;syncIrq();};
  const level=():number=>fifo.length;
  const push=(b:number):void=>{if(fifo.length>=64){regs[REG.Error]=regs[REG.Error]!|0x10;setIrq(REG.ComIrq,0x02);return;}fifo.push(b&0xff);};

  /** Whether the card in the field would hear the reader at all. */
  const inField=():CardDef|undefined=>antennaOn()&&alive()?cardNow():undefined;

  // ---------- the card (ISO 14443-3 type A) ----------
  /** One reader frame arrives at the card. Returns what the card answers, or null for silence. */
  function cardHears(c:CardDef,d:readonly number[],bits:number):number[]|null{
   const seven=bits===7&&d.length===1;
   if(seven&&d[0]===0x26){                       // REQA: only IDLE and READY cards answer (a halted card needs WUPA)
    if(cardState==='idle'||cardState==='ready'){cardState='ready';cascade=1;return [...c.atqa];}
    return null;
   }
   if(seven&&d[0]===0x52){                       // WUPA
    if(cardState!=='active'){cardState='ready';cascade=1;return [...c.atqa];}
    return null;
   }
   if(bits%8!==0&&!seven)return null;
   if(cardState==='ready'&&(d[0]===0x93||d[0]===0x95)&&d.length>=2){
    if(d[0]!==(cascade===1?0x93:0x95))return null;
    const mine=uidFrame(c.uid,cascade);
    const nvb=d[1]!;
    if(nvb===0x70&&d.length===9){                // SELECT: SEL NVB uid[4] bcc crc[2]
     const body=d.slice(0,7),[l,h]=crcA(body);
     if(d[7]!==l||d[8]!==h)return null;          // a bad CRC_A is ignored by the card
     if(!mine.every((b,i)=>b===d[2+i]))return null;
     const more=c.uid.length===7&&cascade===1;
     const sak=more?0x04:c.sak;
     if(more)cascade=2;else{cardState='active';selects++;}
     const [cl,ch]=crcA([sak]);return [sak,cl,ch];
    }
    if((nvb&0x0f)===0&&(nvb>>4)>=2&&(nvb>>4)<7){ // anticollision with whole bytes already known: answer the rest of the frame
     const known=(nvb>>4)-2;
     if(d.length!==(nvb>>4))return null;
     if(!mine.slice(0,known).every((b,i)=>b===d[2+i]))return null;
     return mine.slice(known);
    }
    return null;
   }
   if(cardState==='active'&&d[0]===0x50&&d[1]===0x00&&d.length===4){   // HLTA
    const [l,h]=crcA([0x50,0x00]);
    if(d[2]===l&&d[3]===h)cardState='halt';
    return null;                                 // the card never answers a valid HLTA
   }
   return null;                                  // authentication, READ, WRITE ...: not emulated, the reader times out
  }

  // ---------- commands ----------
  const crcPreset=():number=>PRESETS[regs[REG.Mode]!&3]!;
  function runCommand(cmd:number):void{
   epoch++;
   timerRunning=false;
   switch(cmd){
    case 0x00:crcBusy=false;break;
    case 0x01:{                                  // Mem: 25 bytes from the FIFO into the buffer, or the buffer out when the FIFO is empty
     if(fifo.length>=25){for(let i=0;i<25;i++)mem[i]=fifo[i]!;fifo.length=0;}
     else if(fifo.length===0)for(let i=0;i<25;i++)push(mem[i]!);
     break;
    }
    case 0x02:for(let i=0;i<25;i++)mem[i]=(Math.random()*256)|0;break;
    case 0x03:{                                  // CalcCRC: the coprocessor eats the FIFO, 8 bits per 13.56 MHz clock, result in CRCResult
     const data=fifo.splice(0);
     const [l,h]=crcA(data,crcPreset());
     crcBusy=true;regs[REG.Status1]=regs[REG.Status1]!&~0x20;
     const my=epoch;
     ctx.schedule(us(Math.max(1,data.length*8/13.56)),()=>{
      if(my!==epoch)return;
      regs[REG.CRCResultL]=l;regs[REG.CRCResultH]=h;crcBusy=false;crcOk=true;
      setIrq(REG.DivIrq,0x04);regs[REG.Command]=regs[REG.Command]!&0xf0;
     });
     break;
    }
    case 0x0f:                                    // SoftReset: registers back to reset values, start-up delay with PowerDown (bit 4) set
     resets++;resetRegs();startupUntil=now()+ms(STARTUP_MS);break;
    default:break;                                // Transmit, Receive, MFAuthent: no card-side data path is modelled
   }
   regs[REG.Command]=(regs[REG.Command]!&0xf0)|(cmd===0x03?0x03:cmd===0x0c?0x0c:0);
  }

  /** BitFramingReg StartSend while Transceive: send the FIFO to the card and (maybe) get an answer. */
  function startSend():void{
   const tx=fifo.splice(0);
   const lastBits=regs[REG.BitFraming]!&7;
   let bits=tx.length===0?0:(tx.length-1)*8+(lastBits||8);
   let sent=tx;
   if((regs[REG.TxMode]!&0x80)!==0&&bits%8===0&&tx.length>0){sent=[...tx,...crcA(tx,crcPreset())];bits=sent.length*8;}
   frames++;lastTx=hex(sent);
   const frameBits=bits<=8?bits+1:sent.length*9+2;               // start bit + 9 bits per byte (parity) + end
   const txUs=frameBits*BIT_US;
   const my=++epoch;
   const timerMs=(():number=>{
    if((regs[REG.TMode]!&0x80)===0)return -1;                     // no TAuto: the timer is not started by the transmission
    const pre=((regs[REG.TMode]!&0x0f)<<8)|regs[REG.TPrescaler]!,reload=(regs[REG.TReloadH]!<<8)|regs[REG.TReloadL]!;
    return Math.max(1,reload)*(2*pre+1)/13.56e3;                 // f_timer = 13.56 MHz / (2*TPrescaler + 1)
   })();
   ctx.schedule(us(txUs),()=>{if(my===epoch)setIrq(REG.ComIrq,0x40);});   // TxIRq at the end of the frame
   const c=inField();
   const answer=c?cardHears(c,sent,bits):null;
   if(answer&&answer.length){
    const rxUs=txUs+FDT_US+(answer.length*9+2)*BIT_US;
    ctx.schedule(us(rxUs),()=>{
     if(my!==epoch)return;
     let data=answer;
     if((regs[REG.RxMode]!&0x80)!==0&&data.length>=2){                // RxCRCEn: the reader checks the CRC and strips it
      const body=data.slice(0,-2),[l,h]=crcA(body,crcPreset());
      if(data[data.length-2]!==l||data[data.length-1]!==h)regs[REG.Error]=regs[REG.Error]!|0x04;
      data=body;
     }
     for(const b of data)push(b);
     regs[REG.Control]=regs[REG.Control]!&0xf8;                        // RxLastBits = 0: all bits of the last byte are valid
     lastRx=hex(data);cardAnswers++;timerRunning=false;
     regs[REG.Command]=regs[REG.Command]!&0xf0;                        // the receiver is done: back to Idle
     setIrq(REG.ComIrq,0x30);                                          // RxIRq | IdleIRq
    });
   }else if(timerMs>=0){
    timerRunning=true;
    ctx.schedule(us(txUs)+ms(timerMs),()=>{if(my===epoch){timerRunning=false;setIrq(REG.ComIrq,0x01);}});   // TimerIRq: nobody answered
   }
  }

  function readReg(a:number):number{
   switch(a){
    case REG.FIFOData:return fifo.length?fifo.shift()!:0;
    case REG.FIFOLevel:return level();
    case REG.Command:return regs[a]!|(now()<startupUntil?0x10:0);
    case REG.Status1:{
     const lo=level()<=(regs[REG.WaterLevel]!&0x3f),hi=64-level()<=(regs[REG.WaterLevel]!&0x3f);
     return (crcBusy?0:0x20)|(crcOk?0x40:0)|(irqBit()?0x10:0)|(timerRunning?0x08:0)|(hi?0x02:0)|(lo?0x01:0);
    }
    case REG.Control:return regs[a]!&0x07;
    case REG.BitFraming:return regs[a]!&0x77;
    case REG.TCounterH:case REG.TCounterL:return 0;
    default:return a<64?regs[a]!:0;
   }
  }
  function writeReg(a:number,v:number):void{
   v&=0xff;
   switch(a){
    case REG.Command:{
     regs[a]=(v&0xf0)|(regs[a]!&0x0f);
     const cmd=v&0x0f;
     if(cmd===0x07)break;                                              // NoCmdChange: only the PowerDown/RcvOff bits change
     runCommand(cmd);
     break;
    }
    case REG.ComIrq:case REG.DivIrq:
     regs[a]=v&0x80?(regs[a]!|(v&0x7f)):(regs[a]!&~(v&0x7f));regs[a]=regs[a]!&0x7f;syncIrq();break;
    case REG.ComIEn:case REG.DivIEn:regs[a]=v;syncIrq();break;
    case REG.FIFOData:push(v);break;
    case REG.FIFOLevel:if(v&0x80){fifo.length=0;regs[REG.Error]=regs[REG.Error]!&~0x10;}break;
    case REG.Error:case REG.Status1:case REG.CRCResultH:case REG.CRCResultL:case REG.Version:case REG.TCounterH:case REG.TCounterL:break;   // read-only
    case REG.Control:
     if(v&0x80)timerRunning=true;                                      // TStartNow
     if(v&0x40)timerRunning=false;                                     // TStopNow
     break;
    case REG.BitFraming:{
     regs[a]=v&0x77;
     const cmd=regs[REG.Command]!&0x0f;
     if((v&0x80)&&cmd===0x0c)startSend();
     break;
    }
    case REG.TxControl:{
     const was=antennaOn();regs[a]=v;
     if(was&&!antennaOn())cardState='idle';                            // field off: the card loses power and forgets its state
     break;
    }
    default:if(a<64)regs[a]=v;
   }
  }

  // ---------- reset pin ----------
  const wakeUp=():void=>{resets++;resetRegs();startupUntil=now()+ms(STARTUP_MS);};

  return {
   state:()=>{
    const c=cardNow();
    return {
     selected,powered:alive(),reads,writes,lastReg,mode,
     card:c?.id??'none',cardState:c?cardState:'idle',uid:c?hex(c.uid):'',antenna:antennaOn(),
     command:COMMANDS[regs[REG.Command]!&0x0f]||'Idle',version:regs[REG.Version]!,fifo:level(),irq:irqBit(),
     frames,cardAnswers,selects,lastTx,lastRx,badFrames,resets,
    };
   },
   tick(){cardNow();},
   onPinChange(pin:UnoPin,lv:Level){
    if(rstPin&&pin===rstPin){
     if(lv===0&&ctx.hostDrives(pin)){held=true;resetRegs();}           // NRSTPD low: power-down, registers lost
     else if(lv===1&&held){held=false;wakeUp();}
    }
   },
   spi:{
    cs:'SDA',activeLow:true,
    onSelect(sel){selected=sel;},                                       // a new frame: the address byte comes first
    onTransfer(mosi,info){
     mode=info.mode;
     if(!alive())return 0xff;                                           // no power or held in reset: MISO floats high
     if(info.mode!==0||info.lsbFirst){badFrames++;return 0xff;}         // the chip samples on the rising edge, MSB first (SPI mode 0)
     if(info.index===0){isRead=(mosi&0x80)!==0;addr=(mosi>>1)&0x3f;lastReg=addr;return 0;}
     if(isRead){
      const v=readReg(addr);reads++;
      if(mosi&0x80){addr=(mosi>>1)&0x3f;lastReg=addr;}
      return v;
     }
     writeReg(addr,mosi);writes++;return 0;
    },
   },
  };
 },
});
