/**
 * MAX7219-MATRIX device (protocol 'spi'): 8x8 LED matrix module on a MAX7219 driver, one module or four chained (the common FC-16 board).
 * Written from the public Maxim datasheet behaviour (MAX7219/MAX7221, section "Serial-Addressing Format", tables 2-8).
 *
 * Signal level: DIN/CLK/LOAD(CS). Every chip holds a 16-bit shift register: D15..D12 ignored, D11..D8 = register address, D7..D0 = data.
 * Data is clocked in on the RISING edge of CLK, MSB first, and LOAD(CS) rising latches the register in EVERY chip at once. With four chips in a
 * chain (DOUT of one chip feeds DIN of the next) a sketch must send four 16-bit words per update; the first word ends up in the farthest chip.
 * Send fewer words and the chips behind keep whatever the shift register held (a real quirk of the chain, modelled exactly: the shift
 * register is a plain byte queue of 2 x modules bytes).
 * Registers: 0x00 no-op, 0x01..0x08 digit 0..7 (one matrix row each, bit 7 = left-most dot), 0x09 decode mode (bit d = Code B for digit d),
 * 0x0A intensity (duty (2i+1)/32), 0x0B scan limit (digits 0..n shown), 0x0C shutdown (0 = off, 1 = normal), 0x0F display test (all dots on).
 * Power-up: control registers cleared, display blank, shutdown mode. The digit registers are undefined on a real chip; here they start at 0.
 * Brightness: a digit is on for duty/(scan limit + 1) of the time, so the apparent brightness of a lit row is duty x 8/(scan+1) (capped at 1).
 * SPI mode: the chip samples on the rising edge, so SPI mode 0 and 3 work. Mode 1/2 see every bit half a clock late (shifted one bit),
 * LSB-first masters send the bits reversed: both are modelled, so a wrong SPI.beginTransaction produces the wrong picture, as on the bench.
 * Not modelled: the DOUT pin of the last module (nothing is wired to it), the ISET resistor, multiplexing flicker, MAX7221 EMI slew control.
 * Pair: scene/parts/max7219-matrix.ts (3D). Both are auto-discovered; nothing else to edit. Guide: docs/lab-extending.md
 */
import {defineDevice} from './types';

export type Max7219State={
 selected:boolean;modules:number;mode:number;
 /** visible rows after decode, scan limit, shutdown and test: 16 hex chars per module (row 0 first), bit 7 = left-most dot */
 fb:string;
 /** apparent luminance 0-255 per module, 2 hex chars each (0 while shut down) */
 lum:string;
 /** raw registers per module: decode(2) intensity(1) scan(1) shutdown register(1: 1 = normal operation) test(1), modules joined by '|' */
 regs:string;
 decode:number;intensity:number;scan:number;shutdown:boolean;test:boolean;
 latches:number;words:number;partial:boolean;lastReg:number;lastData:number;badFrames:number;
};

export const REG={NOOP:0x00,DIGIT0:0x01,DECODE:0x09,INTENSITY:0x0a,SCAN:0x0b,SHUTDOWN:0x0c,TEST:0x0f} as const;
/** Code B glyphs as segment bytes D6..D0 = A B C D E F G (datasheet table 5); the data bit 7 adds the decimal point. */
const CODE_B=[0x7e,0x30,0x6d,0x79,0x33,0x5b,0x5f,0x70,0x7f,0x7b,0x01,0x4f,0x37,0x0e,0x67,0x00] as const;
export const codeB=(data:number):number=>(CODE_B[data&0x0f]!)|(data&0x80);

interface Chip{digits:Uint8Array;decode:number;intensity:number;scan:number;shutdown:number;test:number}
const newChip=():Chip=>({digits:new Uint8Array(8),decode:0,intensity:0,scan:0,shutdown:0,test:0});
const h2=(n:number):string=>n.toString(16).padStart(2,'0');
const rev8=(b:number):number=>{let r=0;for(let i=0;i<8;i++)r|=((b>>i)&1)<<(7-i);return r;};

/** Rows a chip really lights (8 bytes), after decode mode, scan limit, shutdown and display test. */
export function visibleRows(c:Chip):number[]{
 if(c.test)return new Array(8).fill(0xff);
 if(!c.shutdown)return new Array(8).fill(0);
 return Array.from({length:8},(_,d)=>d>c.scan?0:(c.decode>>d)&1?codeB(c.digits[d]!):c.digits[d]!);
}
/** Apparent luminance 0..1: duty (2i+1)/32 x 8/(scan+1), capped; display test forces 31/32 with all eight digits. */
export function luminance(c:Chip):number{
 if(c.test)return 31/32;
 if(!c.shutdown)return 0;
 return Math.min(1,(2*c.intensity+1)/32*8/(c.scan+1));
}

export const device=defineDevice<Max7219State>({
 kind:'max7219-matrix',protocol:'spi',
 // module header order: VCC, GND, DIN (= MOSI D11), CS (= LOAD), CLK (= SCK D13)
 pins:['VCC','GND','DIN','CS','CLK'],
 power:{rail:['VCC','GND'],min:4,max:5.5,ma:100},
 copy:{
  name:{en:'MAX7219 8x8 LED matrix',id:'Matriks LED 8x8 MAX7219'},
  desc:{en:'An 8x8 red LED matrix driven by a MAX7219 chip over three SPI wires. Choose one module or a chain of four.',id:'Matriks LED merah 8x8 yang digerakkan chip MAX7219 lewat tiga kabel SPI. Pilih satu modul atau rantai empat.'},
  note:{en:'DIN goes to D11, CLK to D13 and CS to any pin you latch with. Four modules need four 16-bit words per update.',id:'DIN ke D11, CLK ke D13, dan CS ke pin mana saja untuk mengunci data. Empat modul butuh empat kata 16 bit per pembaruan.'},
 },
 inputs:[{type:'choice',key:'modules',label:{en:'Modules in the chain',id:'Jumlah modul dalam rantai'},default:'1',options:[
  {value:'1',label:{en:'1 module (8x8)',id:'1 modul (8x8)'}},
  {value:'4',label:{en:'4 modules (32x8)',id:'4 modul (32x8)'}},
 ]}],
 defaults:{modules:'1'},
 create(ctx){
  const count=():number=>String(ctx.props.modules)==='4'?4:1;
  let n=count();
  let chips:Chip[]=Array.from({length:n},newChip);
  let buf:number[]=new Array(2*n).fill(0);          // the chain as a byte queue, newest byte last
  let selected=false,mode=0,latches=0,words=0,partial=false,lastReg=0,lastData=0,badFrames=0,bytesInFrame=0,carry=0;
  const resize=():void=>{
   const m=count();
   if(m===n)return;
   n=m;chips=Array.from({length:n},newChip);buf=new Array(2*n).fill(0);
  };
  const apply=(c:Chip,reg:number,data:number):void=>{
   lastReg=reg;lastData=data;
   if(reg>=1&&reg<=8)c.digits[reg-1]=data;
   else if(reg===REG.DECODE)c.decode=data;
   else if(reg===REG.INTENSITY)c.intensity=data&0x0f;
   else if(reg===REG.SCAN)c.scan=data&0x07;
   else if(reg===REG.SHUTDOWN)c.shutdown=data&1;
   else if(reg===REG.TEST)c.test=data&1;
   // 0x00 and every other address do nothing
  };
  return {
   state:()=>{
    resize();
    const c0=chips[0]!;
    return {
     selected,modules:n,mode,
     fb:chips.map(c=>visibleRows(c).map(h2).join('')).join(''),
     lum:chips.map(c=>h2(Math.round(luminance(c)*255))).join(''),
     regs:chips.map(c=>`${h2(c.decode)}${c.intensity.toString(16)}${c.scan}${c.shutdown}${c.test}`).join('|'),
     decode:c0.decode,intensity:c0.intensity,scan:c0.scan,shutdown:c0.shutdown===0,test:c0.test===1,
     latches,words,partial,lastReg,lastData,badFrames,
    };
   },
   tick(){resize();},
   spi:{
    cs:'CS',activeLow:true,
    onSelect(sel){
     selected=sel;
     if(sel){bytesInFrame=0;return;}
     // LOAD rose: every chip latches the 16 bits its shift register holds
     resize();
     partial=bytesInFrame%(2*n)!==0;
     for(let k=0;k<n;k++){
      const at=2*(n-1-k);
      apply(chips[k]!,buf[at]!&0x0f,buf[at+1]!);
     }
     latches++;words+=Math.floor(bytesInFrame/2);
    },
    onTransfer(mosi,info){
     mode=info.mode;
     let b=mosi&0xff;
     if(info.lsbFirst){b=rev8(b);badFrames++;}                       // the chip wants the MSB first
     if(info.mode===1||info.mode===2){                               // sampled half a clock late: every bit is the one before
      const prev=carry;carry=b&1;b=(prev<<7)|(b>>1);badFrames++;
     }
     buf.shift();buf.push(b);bytesInFrame++;
     return 0xff;                                                    // DOUT of the last chip is not wired to anything
    },
   },
  };
 },
});
