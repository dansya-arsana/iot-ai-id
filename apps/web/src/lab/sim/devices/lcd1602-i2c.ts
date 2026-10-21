/**
 * LCD1602-I2C: HD44780 16x2 character LCD behind a PCF8574 I2C backpack (address 0x27), driven in 4-bit mode.
 * PCF8574 port byte (the common backpack wiring): P0=RS, P1=RW, P2=E, P3=backlight, P4..P7=D4..D7.
 * The HD44780 latches on the FALLING edge of E, so we remember the previous port byte and decode it when E drops.
 * Reset state of the controller (datasheet): 8-bit interface, display off, cleared, entry mode I/D=1 S=0.
 * Init: three function-set nibbles 0x3 (still 8-bit: only D7..D4 exist as a command), then 0x2 switches to 4-bit;
 * from then on every byte is two nibbles, high first. DDRAM: line 1 = 0x00..0x27, line 2 = 0x40..0x67 (80 bytes).
 * CGRAM: 64 bytes = 8 custom 5x8 glyphs shown as codes 0..7. Busy flag is modelled as always ready (our execution is instant).
 * Pair: scene/parts/lcd1602-i2c.ts (3D). Guide: docs/lab-extending.md
 */
import {defineDevice,clamp,num} from './types';

export type Lcd1602I2cState={
 line1:string;line2:string;      // 16 visible cells; codes 0..7 are custom glyphs (see cg), others are the A00 ROM code
 cg:string;                      // 64 CGRAM bytes as 128 hex digits
 backlight:boolean;display:boolean;cursor:boolean;blink:boolean;
 col:number;row:number;          // cursor cell on screen, -1 when scrolled out of the window
 contrast:number;color:string;
 writes:number;reads:number;chars:number;
};

const PAD=' ';
export const device=defineDevice<Lcd1602I2cState>({
 kind:'lcd1602-i2c',protocol:'i2c',
 // real backpack header order: GND VCC SDA SCL
 pins:['GND','VCC','SDA','SCL'],holes:[0,1,2,3],bodyX:[-37,43],
 copy:{
  name:{en:'LCD1602 with I2C backpack',id:'LCD1602 dengan modul I2C'},
  desc:{en:'A 16-column, 2-row character display. A small I2C backpack at address 0x27 turns four wires into the HD44780 4-bit bus, so a Wire sketch can print text.',id:'Layar karakter 16 kolom 2 baris. Modul I2C kecil di alamat 0x27 mengubah empat kabel menjadi bus 4-bit HD44780, jadi sketsa Wire bisa menampilkan teks.'},
  note:{en:'Nothing shows until the sketch runs the init sequence and turns the display on.',id:'Layar kosong sampai sketsa menjalankan urutan inisialisasi dan menyalakan tampilan.'},
 },
 inputs:[
  {type:'choice',key:'color',label:{en:'Backlight colour',id:'Warna lampu latar'},options:[{value:'green',label:{en:'Green',id:'Hijau'}},{value:'blue',label:{en:'Blue',id:'Biru'}}],default:'green'},
  {type:'range',key:'contrast',label:{en:'Contrast (trim pot)',id:'Kontras (trimpot)'},min:0,max:100,step:1,default:60,unit:'%'},
 ],
 create(ctx){
  const ddram=new Uint8Array(80).fill(0x20),cgram=new Uint8Array(64);
  let bit4=false,hiNib=-1;                       // 8-bit mode until the 0x2 nibble
  let addr=0,inCg=false,shift=0;
  let incr=true,shiftOn=false;
  let disp=false,cur=false,blink=false;
  let big2=false;                                 // N bit: two lines
  let port=0,prev=0,writes=0,reads=0,chars=0;
  let rdPhase=0;
  const reset=()=>{ddram.fill(0x20);addr=0;shift=0;inCg=false;};
  const move=()=>{ // address counter after a read/write
   if(inCg){addr=(addr+(incr?1:-1))&0x3f;return;}
   addr=(addr+(incr?1:-1))&0x7f;
   // no jump between lines: the counter runs on through 0x28..0x3F (no RAM there) and wraps 0x7F -> 0x00, as on the real controller
   if(shiftOn)shift=(shift+(incr?1:-1)+80)%40;
  };
  const cell=(a:number):number=>a<0x28?a:a>=0x40&&a<0x68?a-0x40+40:-1;   // DDRAM address to linear 0..79
  const command=(b:number)=>{
   if(b&0x80){inCg=false;addr=b&0x7f;return;}
   if(b&0x40){inCg=true;addr=b&0x3f;return;}
   if(b&0x20){big2=!!(b&0x08);return;}            // function set (DL cannot change after init)
   if(b&0x10){ // cursor or display shift
    const right=!!(b&0x04);
    if(b&0x08)shift=(shift+(right?-1:1)+40)%40;
    else{addr=(addr+(right?1:-1))&0x7f;}
    return;
   }
   if(b&0x08){disp=!!(b&0x04);cur=!!(b&0x02);blink=!!(b&0x01);return;}
   if(b&0x04){incr=!!(b&0x02);shiftOn=!!(b&0x01);return;}
   if(b&0x02){addr=0;shift=0;inCg=false;return;}
   if(b&0x01){reset();incr=true;}
  };
  const data=(b:number)=>{
   chars++;
   if(inCg){cgram[addr&0x3f]=b;move();return;}
   const i=cell(addr);
   if(i>=0)ddram[i]=b;
   move();
  };
  /** One latched nibble (falling edge of E). */
  const nibble=(n:number,rs:boolean,rw:boolean)=>{
   if(rw){return;}                                 // read cycles are served in onRead
   if(!bit4){
    // 8-bit interface: only D7..D4 are wired, so this is a function set whose high nibble is n
    if(n===0x2)bit4=true;
    return;
   }
   if(hiNib<0){hiNib=n;return;}
   const b=(hiNib<<4)|n;hiNib=-1;
   if(rs)data(b);else command(b);
  };
  const onByte=(b:number)=>{
   const e=(b&4)!==0,pe=(prev&4)!==0;
   if(pe&&!e)nibble(prev>>4,(prev&1)!==0,(prev&2)!==0);   // falling E latches what was on the bus while E was high
   if(!(b&2))rdPhase=0;
   prev=b;port=b;
  };
  const vis=(row:number):string=>{
   if(!disp)return PAD.repeat(16);
   let s='';
   for(let i=0;i<16;i++){
    const idx=big2?(row*40+((i+shift)%40)):((i+shift)%40);
    s+=String.fromCharCode(ddram[idx]!);
   }
   return s;
  };
  const hex=()=>Array.from(cgram,v=>v.toString(16).padStart(2,'0')).join('');
  return {
   state:()=>{
    const i=cell(addr);let col=-1,row=0;
    if(!inCg&&i>=0){row=i>=40?1:0;const c=((i%40)-shift+40)%40;col=c<16?c:-1;}
    return {
     line1:vis(0),line2:big2?vis(1):PAD.repeat(16),cg:hex(),
     backlight:(port&8)!==0,display:disp,cursor:cur,blink,col,row,
     contrast:clamp(Math.round(num(ctx.props.contrast,60)),0,100),
     color:ctx.props.color==='blue'?'blue':'green',writes,reads,chars,
    };
   },
   i2c:{
    address:0x27,
    onStart(){},
    onWrite(byte){writes++;onByte(byte&0xff);return true;},
    // PCF8574 quasi-bidirectional port: reading returns the pin levels. With RW=1 and E=1 the HD44780 drives D7..D4:
    // busy flag (0, always ready) + address counter on a command read, DDRAM/CGRAM byte on a data read; high nibble first.
    onRead(){
     reads++;
     let hi=prev&0xf0;
     if((prev&2)&&(prev&4)){
      const rs=(prev&1)!==0;
      const v=rs?(inCg?cgram[addr&0x3f]!:(cell(addr)>=0?ddram[cell(addr)]!:0x20)):addr&0x7f;
      hi=((rdPhase===0?v>>4:v&0x0f)<<4)&0xf0;rdPhase^=1;
      if(rdPhase===0&&rs)move();   // data read: address counter steps after the second nibble
     }
     return hi|(prev&0x0f);
    },
    onStop(){},
   },
  };
 },
});
