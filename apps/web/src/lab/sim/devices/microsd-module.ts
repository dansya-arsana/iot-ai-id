/**
 * MICROSD-MODULE device (protocol 'spi'): microSD slot breakout (the common 6-pin board with an onboard 3.3 V regulator and level shifter).
 * Written from the public SD Physical Layer Simplified Specification (SPI mode chapter 7), our own wording and code.
 *
 * Emulated at byte level on the SPI bus: command frames (0x40|index, 32-bit argument, CRC7 << 1 | 1), the R1/R3/R7 responses with one
 * 0xFF byte of NCR, the SPI-mode entry (CMD0 with a valid CRC 0x95 while CS is low), CMD8 (R7 echo of the voltage and check pattern, only
 * card version 2 answers, version 1 cards say "illegal command"), CMD55 + ACMD41 (idle until about 25 ms after the first ACMD41, HCS decides
 * SDHC), CMD58 (OCR: busy bit, CCS), CMD59, CMD9 and CMD10 (a real-looking CSD and CID with the right CRC7), CMD16, CMD17 single-block read
 * (0xFE token, 512 data bytes, CRC16) and CMD24 single-block write (data response 0x05, busy until 3 ms later). The card is BLANK: blocks you never
 * wrote read as zeros and blocks you did write read back (up to 256 blocks kept). There is NO file system: no FAT is emulated, so SD.begin()
 * style libraries fail at the volume step ("no FAT partition"), while card detection, card type and card size work. Not modelled: CMD18/CMD25
 * multi-block, erase, CMD12, CMD6, CRC16 checking on writes, write protect, UHS and the 74-clock power-up timing (the SPI bus here only shows
 * a clock pulse per byte, so the clock count is informational and a CMD0 before it is still answered, as most real cards do).
 * The card needs SPI mode 0 or 3. Init above 400 kHz is flagged in the state but still works (most real cards tolerate it).
 * Pins (module order): GND, VCC (4.5-5.5 V: the board has a 3.3 V regulator), MISO, MOSI, SCK, CS.
 * Pair: scene/parts/microsd-module.ts (3D). Both are auto-discovered; nothing else to edit. Guide: docs/lab-extending.md
 */
import {defineDevice,ms} from './types';
import type {Level} from './types';
import type {UnoPin} from '../../contract';

/** CRC7 used on command frames (x^7 + x^3 + 1); result is the 7-bit value. */
export function crc7(bytes:readonly number[]):number{
 let crc=0;
 for(const b of bytes)for(let i=7;i>=0;i--){
  const bit=(b>>i)&1,top=(crc>>6)&1;
  crc=(crc<<1)&0x7f;if(bit^top)crc^=0x09;
 }
 return crc;
}
/** CRC16-CCITT (XMODEM) used on data blocks. */
export function crc16(bytes:ArrayLike<number>):number{
 let crc=0;
 for(let i=0;i<bytes.length;i++){
  crc^=bytes[i]!<<8;
  for(let k=0;k<8;k++)crc=(crc&0x8000)?((crc<<1)^0x1021)&0xffff:(crc<<1)&0xffff;
 }
 return crc;
}
export const R1={IDLE:0x01,ILLEGAL:0x04,CRC_ERR:0x08,ADDR_ERR:0x20,PARAM_ERR:0x40} as const;
const BLOCK=512,INIT_MS=25,BUSY_MS=3,MAX_STORED=256;
export const CARD_TYPES=['none','sdsc1','sdsc2','sdhc'] as const;
const SIZES_MB:Record<string,number>={'1':1024,'2':2048,'8':8192,'16':16384,'32':30436};

/** Card-specific data register, 16 bytes, last byte = CRC7 << 1 | 1. v1 for standard capacity, v2 for SDHC. */
export function csd(type:string,capMb:number):number[]{
 const b=new Array(16).fill(0);
 if(type==='sdhc'){
  const cs=Math.max(0,capMb*2-1);                                      // capacity = (C_SIZE + 1) x 512 KiB
  b[0]=0x40;b[1]=0x0e;b[2]=0x00;b[3]=0x32;b[4]=0x5b;b[5]=0x59;b[6]=0x00;
  b[7]=(cs>>16)&0x3f;b[8]=(cs>>8)&0xff;b[9]=cs&0xff;b[10]=0x7f;b[11]=0x80;b[12]=0x0a;b[13]=0x40;b[14]=0x00;
 }else{
  const READ_BL=capMb>1024?10:9,MULT=7;                                 // capacity = (C_SIZE+1) x 2^(MULT+2) x 2^READ_BL_LEN bytes (2 GB cards use 1024)
  const cs=Math.max(0,capMb*(READ_BL===9?4:2)-1);
  b[0]=0x00;b[1]=0x2f;b[2]=0x00;b[3]=0x32;b[4]=0x5b;b[5]=0x50|READ_BL;
  b[6]=0x00|((cs>>10)&0x03);b[7]=(cs>>2)&0xff;b[8]=((cs&3)<<6)|0x3b;b[9]=0xc0|((MULT>>1)&3);b[10]=((MULT&1)<<7)|0x7f;b[11]=0x80;b[12]=0x0a;b[13]=0x40;b[14]=0x00;
 }
 b[15]=(crc7(b.slice(0,15))<<1)|1;
 return b;
}
/** Card identification register: made-up maker, name SIMSD, serial, last byte CRC7. */
export function cid():number[]{
 const b=[0xfe,0x49,0x4f,0x53,0x49,0x4d,0x53,0x44,0x10,0x12,0x34,0x56,0x78,0x01,0x2a,0x00];   // MID 0xFE, OID 'IO', PNM 'SIMSD' ...
 b[15]=(crc7(b.slice(0,15))<<1)|1;
 return b;
}

export type MicrosdState={
 selected:boolean;mode:number;card:string;phase:string;cardType:string;capacityMb:number;
 initClocks:number;lastCmd:number;lastR1:number;commands:number;blocksRead:number;blocksWritten:number;badCrc:number;badFrames:number;fastInit:boolean;
};

export const device=defineDevice<MicrosdState>({
 kind:'microsd-module',protocol:'spi',
 pins:['GND','VCC','MISO','MOSI','SCK','CS'],
 power:{rail:['VCC','GND'],min:4.5,max:5.5,ma:30},
 copy:{
  name:{en:'microSD card module',id:'Modul kartu microSD'},
  desc:{en:'A microSD slot on SPI. It answers the card start-up commands (CMD0, CMD8, ACMD41) and reports card type and size, but it has no file system.',id:'Slot microSD lewat SPI. Ia menjawab perintah awal kartu (CMD0, CMD8, ACMD41) dan melaporkan jenis serta ukuran kartu, tetapi tidak punya sistem berkas.'},
  note:{en:'The card is blank and there is no FAT: raw block reads and writes work, file libraries stop at the volume step. Wire VCC to 5 V.',id:'Kartu kosong dan tidak ada FAT: baca tulis blok mentah bisa, pustaka berkas berhenti di tahap volume. Hubungkan VCC ke 5 V.'},
 },
 inputs:[
  {type:'choice',key:'card',label:{en:'Card in the slot',id:'Kartu di slot'},default:'sdhc',options:[
   {value:'none',label:{en:'No card',id:'Tanpa kartu'}},
   {value:'sdsc1',label:{en:'Old standard card (version 1)',id:'Kartu standar lama (versi 1)'}},
   {value:'sdsc2',label:{en:'Standard card (version 2)',id:'Kartu standar (versi 2)'}},
   {value:'sdhc',label:{en:'High capacity card (SDHC)',id:'Kartu kapasitas tinggi (SDHC)'}},
  ]},
  {type:'choice',key:'capacityGb',label:{en:'Card size',id:'Ukuran kartu'},default:'8',options:[
   {value:'1',label:{en:'1 GB',id:'1 GB'}},{value:'2',label:{en:'2 GB',id:'2 GB'}},{value:'8',label:{en:'8 GB',id:'8 GB'}},
   {value:'16',label:{en:'16 GB',id:'16 GB'}},{value:'32',label:{en:'32 GB',id:'32 GB'}},
  ]},
 ],
 defaults:{card:'sdhc',capacityGb:'8'},
 create(ctx){
  const store=new Map<number,Uint8Array>();
  let selected=false,mode=0,badFrames=0,badCrc=0,commands=0,lastCmd=-1,lastR1=0xff,blocksRead=0,blocksWritten=0,fastInit=false;
  let initClocks=0;
  let spiMode=false;                                   // the card powers up in SD mode; CMD0 with CS low switches it to SPI mode
  let idle=true,crcOn=false,appCmd=false,hcs=false,acmdAt=-1,v2=false;
  let cmd:number[]=[];                                 // command frame being collected (6 bytes)
  let out:number[]=[];                                 // bytes the card will shift out next
  let writeState:'none'|'token'|'data'='none',writeAddr=0,wbuf:number[]=[];
  let busyUntil=0;
  const sckPin=ctx.pin('SCK');

  const type=():string=>{const t=String(ctx.props.card??'sdhc');return (CARD_TYPES as readonly string[]).includes(t)?t:'sdhc';};
  const capMb=():number=>{const m=SIZES_MB[String(ctx.props.capacityGb??'8')]??8192;return type()==='sdhc'?m:Math.min(m,2048);};   // standard-capacity cards stop at 2 GB
  const hc=():boolean=>type()==='sdhc';
  const blocks=():number=>capMb()*1024*1024/BLOCK;
  const powered=():boolean=>{const v=ctx.supply();return v===null||v>=4.0;};
  const present=():boolean=>type()!=='none'&&powered();
  const now=():number=>ctx.env.now();
  const ready=():boolean=>!idle;

  const reset=():void=>{spiMode=false;idle=true;crcOn=false;appCmd=false;hcs=false;acmdAt=-1;cmd=[];out=[];writeState='none';wbuf=[];busyUntil=0;};
  // the card type is read live: swapping the card in the popover is a new power-up
  let lastType=type();
  const syncCard=():void=>{const t=type();if(t!==lastType){lastType=t;reset();initClocks=0;v2=t==='sdsc2'||t==='sdhc';}};
  v2=type()==='sdsc2'||type()==='sdhc';

  const ocr=():number=>(ready()?0x80000000:0)|(ready()&&hc()&&hcs?0x40000000:0)|0x00ff8000;     // bit 31 = power-up done, bit 30 = CCS, 2.7-3.6 V window
  const addrToBlock=(a:number):number=>hc()?a:Math.floor(a/BLOCK);
  const blockOf=(n:number):Uint8Array=>store.get(n)??new Uint8Array(BLOCK);

  /** Queue a data block: Nac filler, the 0xFE token, payload, CRC16. */
  const dataBlock=(payload:ArrayLike<number>):void=>{
   const c=crc16(payload);
   out.push(0xff,0xfe,...Array.from(payload),c>>8,c&0xff);
  };

  function execute(frame:readonly number[],info:{clockHz:number;cycle:number}):void{
   const idx=frame[0]!&0x3f;
   const arg=((frame[1]!<<24)|(frame[2]!<<16)|(frame[3]!<<8)|frame[4]!)>>>0;
   const crcByte=frame[5]!;
   commands++;lastCmd=idx;
   const wasApp=appCmd;appCmd=false;
   const crcOkay=(crc7(frame.slice(0,5))<<1|1)===crcByte;
   // before CMD0 the card is in SD mode and only CMD0 (with its fixed CRC) moves it to SPI mode
   if(!spiMode){
    if(idx===0&&crcOkay){spiMode=true;idle=true;acmdAt=-1;hcs=false;lastR1=R1.IDLE;out=[0xff,R1.IDLE];if(info.clockHz>400_000)fastInit=true;}
    else if(idx===0)badCrc++;
    return;
   }
   // in SPI mode the CRC is only checked for CMD0 and CMD8 until CMD59 turns it on
   if((crcOn||idx===0||idx===8)&&!crcOkay){badCrc++;lastR1=R1.CRC_ERR|(idle?R1.IDLE:0);out=[0xff,lastR1];return;}
   const reply=(r1:number,...extra:number[]):void=>{lastR1=r1;out=[0xff,r1,...extra];};
   const r1=idle?R1.IDLE:0;
   if(idle&&info.clockHz>400_000)fastInit=true;
   if(wasApp&&idx===41){                                // ACMD41 SD_SEND_OP_COND
    hcs=(arg&0x40000000)!==0&&v2;
    if(acmdAt<0)acmdAt=now();
    if(now()-acmdAt>=ms(INIT_MS))idle=false;
    reply(idle?R1.IDLE:0);return;
   }
   switch(idx){
    case 0:reset();spiMode=true;idle=true;reply(R1.IDLE);break;                // a second CMD0 restarts the card
    case 8:
     if(!v2){reply(R1.IDLE|R1.ILLEGAL);break;}                                 // version 1 cards do not know CMD8
     if(((arg>>8)&0x0f)!==1){out=[];lastR1=0xff;break;}                        // a voltage range the card does not support: silence
     reply(r1,(arg>>24)&0xff,(arg>>16)&0xff,(arg>>8)&0xff,arg&0xff);break;      // R7 echoes the voltage range and check pattern
    case 9:reply(r1);dataBlock(csd(type(),capMb()));break;
    case 10:reply(r1);dataBlock(cid());break;
    case 16:reply(arg===BLOCK?r1:r1|R1.PARAM_ERR);break;
    case 17:{
     const blk=addrToBlock(arg);
     if(!hc()&&arg%BLOCK!==0){reply(r1|R1.ADDR_ERR);break;}
     if(blk>=blocks()){reply(r1|R1.PARAM_ERR);break;}
     if(idle){reply(R1.IDLE|R1.ILLEGAL);break;}                                // block commands need the card out of idle
     reply(r1);dataBlock(blockOf(blk));blocksRead++;break;
    }
    case 24:{
     const blk=addrToBlock(arg);
     if(!hc()&&arg%BLOCK!==0){reply(r1|R1.ADDR_ERR);break;}
     if(blk>=blocks()){reply(r1|R1.PARAM_ERR);break;}
     if(idle){reply(R1.IDLE|R1.ILLEGAL);break;}
     reply(r1);writeState='token';writeAddr=blk;wbuf=[];break;
    }
    case 55:appCmd=true;reply(r1);break;                                       // the next command is application-specific
    case 58:reply(r1,(ocr()>>>24)&0xff,(ocr()>>>16)&0xff,(ocr()>>>8)&0xff,ocr()&0xff);break;
    case 59:crcOn=(arg&1)!==0;reply(r1);break;
    default:reply(r1|R1.ILLEGAL);break;
   }
  }

  return {
   state:()=>{
    syncCard();
    const t=type();
    return {
     selected,mode,card:t,
     phase:!present()?'empty':!spiMode?'sd-mode':idle?'idle':'ready',
     cardType:t==='none'?'none':t==='sdhc'?'SDHC':t==='sdsc2'?'SDSC v2':'SDSC v1',capacityMb:t==='none'?0:capMb(),
     initClocks,lastCmd,lastR1,commands,blocksRead,blocksWritten,badCrc,badFrames,fastInit,
    };
   },
   tick(){syncCard();},
   onPinChange(pin:UnoPin,level:Level){
    // the simulator draws one SCK pulse per byte: count 8 clocks for each while the card is deselected (the 74-clock wake-up)
    if(sckPin&&pin===sckPin&&level===1&&!selected)initClocks+=8;
   },
   spi:{
    cs:'CS',activeLow:true,
    onSelect(sel){selected=sel;if(sel){cmd=[];}else{cmd=[];if(writeState!=='none'){writeState='none';wbuf=[];}}},
    onTransfer(mosi,info){
     syncCard();
     mode=info.mode;
     if(!present())return 0xff;                          // empty slot or no power: MISO floats high
     if((info.mode!==0&&info.mode!==3)||info.lsbFirst){badFrames++;return 0xff;}
     const b=mosi&0xff;
     // card shifts out queued bytes; while busy (a write) it holds MISO low
     const next=():number=>out.length?out.shift()!:(info.cycle<busyUntil?0x00:0xff);
     // write data phase: token 0xFE, 512 bytes, 2 CRC bytes, then a data response
     if(writeState==='token'){
      const r=next();
      if(b===0xfe)writeState='data';
      return r;
     }
     if(writeState==='data'){
      wbuf.push(b);
      const r=next();
      if(wbuf.length===BLOCK+2){
       const okay=store.has(writeAddr)||store.size<MAX_STORED;
       if(okay){store.set(writeAddr,Uint8Array.from(wbuf.slice(0,BLOCK)));blocksWritten++;busyUntil=info.cycle+ms(BUSY_MS);out.push(0x05);}   // 0x05 = data accepted
       else out.push(0x0d);                                                    // 0x0D = write error (the simulated card holds 256 blocks)
       writeState='none';wbuf=[];
      }
      return r;
     }
     // command frame: start bit 0, transmission bit 1 -> 0b01xxxxxx; 0xFF bytes are just clocks that read the answer
     if(cmd.length===0){
      if((b&0xc0)===0x40){const r=next();cmd=[b];return r;}
      return next();
     }
     cmd.push(b);
     const r=next();
     if(cmd.length===6){const f=cmd;cmd=[];out=[];execute(f,info);}
     return r;
    },
   },
  };
 },
});
