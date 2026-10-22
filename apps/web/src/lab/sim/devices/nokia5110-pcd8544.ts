/**
 * NOKIA5110-PCD8544: 84x48 monochrome LCD with a PCD8544 controller on a 8-pin breakout (RST CE DC DIN CLK VCC LIGHT GND).
 * Bus: write-only SPI, mode 0, MSB first, up to 4 Mbit/s. CE (chip select) is active low. DC picks the meaning of every byte: low = command, high = display data.
 * The slave never answers (no MISO): its model reads the byte the AVR SPI master shifts out (hardware SPI.transfer / SPDR on D11 and D13).
 * Written from the public PCD8544 datasheet behaviour:
 *   function set    0b0010.0PVH  PD=1 power down (display off, RAM kept), V=1 vertical addressing, H=1 extended instruction set
 *   H=0 (basic):    0x08|D<<2|E display control (DE 00 blank, 10 normal 0x0C, 01 all on 0x09, 11 inverse 0x0D); 0x40|Y bank 0..5; 0x80|X column 0..83
 *   H=1 (extended): 0x04|TC temperature coefficient 0..3; 0x10|BS bias 0..7; 0x80|Vop operating voltage 0..127;  0x00 NOP in both
 * Display data: DDRAM is 84 columns x 6 banks, one byte = a vertical strip of 8 pixels, bit 0 on top. After each byte X advances; horizontal addressing wraps
 * X 83 -> 0 and moves to the next bank (bank 5 -> 0); vertical addressing moves down a bank first and wraps bank 5 -> 0 into the next column (83 -> 0).
 * Reset (RST low, or power on; the chip is in this state from power up, so the first rise of RST counts as the end of a reset): PD=1, V=0, H=0, D=E=0, X=Y=0, Vop=0, TC=0, BS=0. The RAM is NOT cleared and is undefined at power up: it is filled with
 * pseudo-random noise here, so a sketch that never clears the screen shows snow, like the real glass.
 * Contrast: Vlcd = 3.06 V + 0.06 V x Vop. Nothing is visible below about 6 V (Vop 0 after reset is blank on purpose), a good picture is near 6.6-7.2 V, and
 * above about 7.8 V the whole glass darkens. The LIGHT pin switches the backlight: active low on the usual module (pull it to GND), active high on others (input).
 * Pair: scene/parts/nokia5110-pcd8544.ts. Guide: docs/lab-extending.md
 */
import {defineDevice,clamp} from './types';
import type {Level} from './types';
import type {UnoPin} from '../../contract';

export type Nokia5110Pcd8544State={
 fb:string;                       // 84 x 6 bytes as 1008 hex digits (byte = vertical strip of 8 pixels, bit 0 on top)
 display:string;                  // 'blank' | 'normal' | 'on' | 'inverse'
 power:boolean;                   // true when out of power-down
 vop:number;vlcd:number;bias:number;tc:number;
 ext:boolean;vertical:boolean;    // H and V bits of the function set
 x:number;y:number;               // address pointer (column 0..83, bank 0..5)
 light:number;                    // backlight 0..1
 selected:boolean;
 cmds:number;datas:number;invalid:number;badMode:number;resets:number;
 lastCmd:number;
};

const W=84,BANKS=6;
const rev8=(b:number):number=>{let r=0;for(let i=0;i<8;i++)r=(r<<1)|((b>>i)&1);return r;};

export const device=defineDevice<Nokia5110Pcd8544State>({
 kind:'nokia5110-pcd8544',protocol:'spi',
 // real breakout order: RST CE DC DIN CLK VCC LIGHT GND (DIN is MOSI = D11, CLK is SCK = D13 for the hardware SPI)
 pins:['RST','CE','DC','DIN','CLK','VCC','LIGHT','GND'],holes:[0,1,2,3,4,5,6,7],bodyX:[-13,31],
 power:{rail:['VCC','GND'],min:2.7,max:3.3,ma:8},
 copy:{
  name:{en:'Nokia 5110 display (PCD8544)',id:'Layar Nokia 5110 (PCD8544)'},
  desc:{en:'A monochrome 84 x 48 pixel LCD run by a PCD8544 chip. It listens to one-way SPI: a DC pin tells the chip whether a byte is a command (contrast, addressing, display mode) or a column of eight pixels for its display memory.',id:'LCD monokrom 84 x 48 piksel yang dijalankan chip PCD8544. Chip ini hanya mendengar SPI satu arah: pin DC memberi tahu apakah sebuah byte adalah perintah (kontras, pengalamatan, mode tampilan) atau kolom delapan piksel untuk memori tampilannya.'},
  note:{en:'It is a 3.3 V part. After reset the contrast is zero, so the screen stays blank until the sketch sets Vop (for example 0xBF).',id:'Ini komponen 3,3 V. Setelah reset kontras nol, jadi layar tetap kosong sampai sketsa mengatur Vop (misalnya 0xBF).'},
 },
 inputs:[
  {type:'choice',key:'lightMode',label:{en:'Backlight pin',id:'Pin lampu latar'},options:[{value:'low',label:{en:'Active low (pull LIGHT to GND)',id:'Aktif rendah (tarik LIGHT ke GND)'}},{value:'high',label:{en:'Active high',id:'Aktif tinggi'}}],default:'low'},
 ],
 defaults:{lightMode:'low'},
 create(ctx){
  const ram=new Uint8Array(W*BANKS);
  let seed=0x9e3779b1;for(let i=0;i<ctx.id.length;i++)seed=(Math.imul(seed,31)+ctx.id.charCodeAt(i))>>>0;
  for(let i=0;i<ram.length;i++){seed=(Math.imul(seed,1664525)+1013904223)>>>0;ram[i]=seed>>>24;}   // undefined at power up: noise
  let pd=true,vert=false,ext=false,dd=0,vop=0,bias=0,tc=0,x=0,y=0;       // dd = D<<1|E in the form 2*D+E
  let dc=0,selected=true,rstLow=false;
  let cmds=0,datas=0,invalid=0,badMode=0,resets=0,lastCmd=0;
  const rstPin=ctx.pin('RST'),dcPin=ctx.pin('DC');
  const reset=():void=>{pd=true;vert=false;ext=false;dd=0;vop=0;bias=0;tc=0;x=0;y=0;resets++;};
  const command=(b:number):void=>{
   cmds++;lastCmd=b;
   if(b===0x00)return;                                    // NOP
   if((b&0xf8)===0x20){pd=(b&4)!==0;vert=(b&2)!==0;ext=(b&1)!==0;return;}   // function set
   if(!ext){
    if((b&0xf8)===0x08){dd=(((b>>2)&1)<<1)|(b&1);return;}  // display control
    if((b&0xf8)===0x40){const v=b&7;if(v<BANKS)y=v;else invalid++;return;}
    if(b&0x80){const v=b&0x7f;if(v<W)x=v;else invalid++;return;}
   }else{
    if((b&0xfc)===0x04){tc=b&3;return;}
    if((b&0xf8)===0x10){bias=b&7;return;}
    if(b&0x80){vop=b&0x7f;return;}
   }
   invalid++;
  };
  const data=(b:number):void=>{
   datas++;
   ram[y*W+x]=b;
   if(!vert){x++;if(x>=W){x=0;y=(y+1)%BANKS;}}
   else{y++;if(y>=BANKS){y=0;x=(x+1)%W;}}
  };
  const lightNow=():number=>{
   const v=ctx.volts('LIGHT');if(v===null)return 0;
   const on=ctx.props.lightMode==='high'?v/3.3:1-v/3.3;
   return clamp(on,0,1);
  };
  return {
   state:()=>({
    fb:Array.from(ram,v=>v.toString(16).padStart(2,'0')).join(''),
    display:dd===0?'blank':dd===2?'normal':dd===1?'on':'inverse',
    power:!pd,vop,vlcd:Math.round((3.06+0.06*vop)*100)/100,bias,tc,ext,vertical:vert,x,y,light:Math.round(lightNow()*100)/100,selected,
    cmds,datas,invalid,badMode,resets,lastCmd,
   }),
   onPinChange:(pin:UnoPin,level:Level)=>{
    if(pin===dcPin)dc=level;
    else if(pin===rstPin){
     // a pin the sketch makes an output sits low from the start (no edge), so its first rise ends a reset that began at power up
     if(level===0&&!rstLow){rstLow=true;reset();}
     else if(level===1){if(!rstLow)resets++;rstLow=false;}
    }
   },
   spi:{
    cs:'CE',activeLow:true,
    onSelect(sel){selected=sel;},
    onTransfer(mosi,info){
     if(rstLow)return 0xff;                              // held in reset: the interface is dead
     // the chip samples on the rising edge of SCK with the clock idle low: SPI mode 0 (mode 3 samples the same edge); MSB first
     if(info.mode===1||info.mode===2){badMode++;return 0xff;}
     const b=info.lsbFirst?rev8(mosi&0xff):mosi&0xff;
     if(dc===1)data(b);else command(b);
     return 0xff;
    },
   },
  };
 },
});
