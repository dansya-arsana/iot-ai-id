/**
 * TM1637-4DIGIT: 4-digit 7-segment module (0.56 in digits, colon between digits 2 and 3) driven by the TM1637 chip over its own two-wire bus.
 * Not I2C: CLK is always driven by the MCU, DIO is bidirectional open drain, bytes go out LSB first, there is no address byte.
 * Frame = START (DIO falls while CLK is high), bytes, STOP (DIO rises while CLK is high). The chip pulls DIO low for the 9th clock (ACK) after every byte.
 * Command set (datasheet "data command / address command / display control"; the top two bits pick the class):
 *   0b01xx.xxxx data command   0x40 write, auto address increment | 0x44 write, fixed address | 0x42 read the key scan byte | bit 3 = test mode
 *   0b10xx.xxxx display control 0x80 | on<<3 | brightness 0..7 (pulse width 1,2,4,10,11,12,13,14 of 16)
 *   0b11xx.xxxx address command 0xC0 | 0..5, the bytes that follow in the same frame are the display data (bit 0..6 = segments A..G, bit 7 = DP)
 * Address register wraps 5 -> 0 in auto mode; in fixed mode one data byte follows the address command (send a new frame per digit).
 * The module wires GRID1..4 to the four digits (addresses 0..3); the colon is the DP segment of digit 2 (address 1) on the clock layout.
 * Key scan (0x42): after the ACK the chip puts the key byte on DIO LSB first, one bit per falling clock edge; no key = 0xFF; K1 clears bit 3,
 * K2 clears bit 4 and the low 3 bits count 7..0 for SG1..SG8. The usual module has no keys: the `key` input is for experiments.
 * Pair: scene/parts/tm1637-4digit.ts. Guide: docs/lab-extending.md
 */
import {defineDevice,clamp,num} from './types';
import {TwoWireSlave} from './core/bitbang';
import type {Level} from './types';
import type {UnoPin} from '../../contract';

export type Tm16374digitState={
 seg:string;            // 6 grids x 2 hex digits (bit 0..6 = A..G, bit 7 = DP / colon)
 text:string;           // the 4 visible digits decoded from the segments (' ' blank, '?' no known glyph)
 colon:boolean;         // colon lit (clock layout)
 on:boolean;bright:number;duty:number;   // display control: on flag, 0..7 and the pulse width 1/16..14/16
 mode:string;           // 'auto' | 'fixed' address mode
 addr:number;           // address register
 frames:number;bytes:number;acks:number;invalid:number;ignored:number;stops:number;
 last:number;           // last byte received
 keyReads:number;key:number;
 layout:string;
};

const DUTY=[1,2,4,10,11,12,13,14] as const;
const GLYPHS:Record<number,string>={0x3f:'0',0x06:'1',0x5b:'2',0x4f:'3',0x66:'4',0x6d:'5',0x7d:'6',0x07:'7',0x7f:'8',0x6f:'9',0x77:'A',0x7c:'b',0x39:'C',0x5e:'d',0x79:'E',0x71:'F',0x40:'-',0x00:' ',0x76:'H',0x38:'L',0x5c:'o',0x73:'P',0x50:'r',0x54:'n',0x3e:'U',0x78:'t',0x6e:'y',0x58:'c',0x30:'I',0x08:'_',0x01:'^'};
/** Key scan byte for key 1..16 (1..8 = K1 with SG1..SG8, 9..16 = K2); 0 = nothing pressed = 0xFF. */
export const keyByte=(key:number):number=>{
 if(key<1||key>16)return 0xff;
 const sg=(key-1)&7,k2=key>8;
 return ((0xff&~(k2?0x10:0x08))&~7)|(7-sg);
};

export const device=defineDevice<Tm16374digitState>({
 kind:'tm1637-4digit',protocol:'twowire',
 // real module header order: CLK DIO VCC GND
 pins:['CLK','DIO','VCC','GND'],holes:[0,1,2,3],bodyX:[-17,25],
 power:{rail:['VCC','GND'],min:3.3,max:5.5,ma:30},
 copy:{
  name:{en:'TM1637 4-digit display',id:'Tampilan 4 digit TM1637'},
  desc:{en:'Four 7-segment digits with a colon, run by a TM1637 chip. It talks over its own two-wire bus (CLK and DIO, not I2C): your sketch sends a data command, an address command and up to six segment bytes, and the chip answers every byte with an ACK.',id:'Empat digit 7-segmen dengan titik dua, dijalankan chip TM1637. Chip ini memakai bus dua kabel sendiri (CLK dan DIO, bukan I2C): sketsa mengirim perintah data, perintah alamat dan sampai enam byte segmen, lalu chip membalas setiap byte dengan ACK.'},
  note:{en:'Nothing lights until the sketch sends the display-control command (0x88 to 0x8F) with the on bit set.',id:'Tidak ada yang menyala sampai sketsa mengirim perintah kontrol tampilan (0x88 sampai 0x8F) dengan bit nyala aktif.'},
 },
 inputs:[
  {type:'choice',key:'layout',label:{en:'Colon wiring',id:'Pengkabelan titik dua'},options:[{value:'clock',label:{en:'Clock (colon on digit 2)',id:'Jam (titik dua di digit 2)'}},{value:'decimal',label:{en:'Decimal points',id:'Titik desimal'}}],default:'clock'},
  {type:'range',key:'key',label:{en:'Key held (0 = none, optional keys)',id:'Tombol ditekan (0 = tidak ada, tombol opsional)'},min:0,max:16,step:1,default:0,advanced:true},
 ],
 defaults:{layout:'clock',key:0},
 create(ctx){
  const ram=new Uint8Array(6);
  let on=false,bright=0,fixed=false,addr=0,idx=0,cls:'data'|'disp'|'addr'|'read'|'bad'|''='',wrote=false;
  let frames=0,bytes=0,acks=0,invalid=0,ignored=0,stops=0,last=0,keyReads=0,keyArm=0;
  const dio=ctx.pin('DIO'),clk=ctx.pin('CLK');
  const keyNow=():number=>clamp(Math.round(num(ctx.props.key,0)),0,16);
  const bus=new TwoWireSlave(ctx,{clk:'CLK',data:'DIO',lsbFirst:true,ack:true},{
   onStart(){frames++;idx=0;cls='';wrote=false;keyArm=0;},
   onByte(b){
    bytes++;acks++;last=b;
    if(idx++===0){
     const k=b&0xc0;
     if(k===0x40){
      const f=b&3;
      if(f===0){cls='data';fixed=(b&4)!==0;}
      else if(f===2){cls='read';keyArm=2;keyReads++;}
      else{cls='bad';invalid++;}
     }else if(k===0x80){cls='disp';on=(b&8)!==0;bright=b&7;}
     else if(k===0xc0){cls='addr';addr=b&7;if(addr>5)invalid++;wrote=false;}
     else{cls='bad';invalid++;}
     return true;
    }
    if(cls==='addr'&&addr<=5&&!(fixed&&wrote)){ram[addr]=b;wrote=true;if(!fixed)addr=(addr+1)%6;}
    else ignored++;
    return true;
   },
   onStop(){stops++;keyArm=0;if(cls==='read')bus.cancelShift();},
  });
  return {
   state:()=>{
    const colon=ctx.props.layout!=='decimal';
    let text='';
    for(let i=0;i<4;i++)text+=GLYPHS[ram[i]!&0x7f]??'?';
    return {
     seg:Array.from(ram,v=>v.toString(16).padStart(2,'0')).join(''),text,colon:colon&&(ram[1]!&0x80)!==0,
     on,bright,duty:on?DUTY[bright]!/16:0,mode:fixed?'fixed':'auto',addr,frames,bytes,acks,invalid,ignored,stops,last,keyReads,key:keyNow(),
     layout:colon?'clock':'decimal',
    };
   },
   onPinChange:(pin:UnoPin,level:Level,cycle:number)=>{
    bus.edge(pin,level,cycle);
    // key read: the chip's ACK ends on the falling edge of the 9th clock; at that same edge it puts bit 0 of the key byte on DIO, the
    // rest follow on each next falling edge (the helper releases the line after the last one)
    if(pin===clk&&level===0&&keyArm>0&&--keyArm===0){
     const v=keyByte(keyNow()),bits:number[]=[];
     for(let i=0;i<8;i++)bits.push((v>>i)&1);
     if(dio)ctx.env.setPin(dio,bits[0]===1);
     bus.shiftOut(bits.slice(1),{on:'falling'});
    }
   },
  };
 },
});
