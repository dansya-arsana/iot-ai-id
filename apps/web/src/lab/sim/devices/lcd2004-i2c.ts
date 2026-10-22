/**
 * LCD2004-I2C: HD44780 20x4 character LCD behind a PCF8574 I2C backpack, driven in 4-bit mode (our own implementation, written from the public HD44780 and PCF8574 datasheets).
 * Address: PCF8574 backpacks answer at 0x20-0x27 (A2..A0 jumpers), PCF8574A ones at 0x38-0x3F; 0x27 and 0x3F are the ones sold. Pick it with the `address` input.
 * PCF8574 port byte (the common wiring): P0=RS, P1=RW, P2=E, P3=backlight, P4..P7=D4..D7. The controller latches on the FALLING edge of E.
 * Reset state: 8-bit interface, display off, cleared, entry mode I/D=1 S=0. Init: three 0x3 nibbles (D7..D4 only), then 0x2 selects 4-bit; then bytes are two nibbles, high first.
 * Memory: a 20x4 panel is a 2-line controller (N=1) with 40 characters per line: DDRAM 0x00..0x27 and 0x40..0x67. The panel shows
 *   row 1 = 0x00..0x13, row 2 = 0x40..0x53, row 3 = 0x14..0x27, row 4 = 0x54..0x67   (rows 3 and 4 continue rows 1 and 2)
 * Display shift (0x18 / 0x1C) moves all four windows over the two 40-character lines. CGRAM: 8 custom 5x8 glyphs shown as codes 0..7.
 * With N=0 (one-line function set) only row 1 is driven: the panel shows the first 20 cells of the 80-byte line and nothing else.
 * Busy flag: always ready (execution is instant here). Pair: scene/parts/lcd2004-i2c.ts. Guide: docs/lab-extending.md
 */
import {defineDevice,clamp,num} from './types';

export type Lcd2004I2cState={
 line1:string;line2:string;line3:string;line4:string;   // 20 visible cells each; codes 0..7 are custom glyphs (see cg), others the A00 ROM code
 cg:string;                      // 64 CGRAM bytes as 128 hex digits
 backlight:boolean;display:boolean;cursor:boolean;blink:boolean;
 col:number;row:number;          // cursor cell on screen (row 0..3), -1 when scrolled out of the window
 contrast:number;color:string;
 address:number;                 // 7-bit I2C address of the backpack
 lines:number;                   // 1 or 2 (function-set N bit; a 20x4 panel needs 2)
 writes:number;reads:number;chars:number;
};

const COLS=20,PAD=' ';
const ADDRS=[0x27,0x3f,0x20,0x21,0x22,0x23,0x24,0x25,0x26,0x38,0x39,0x3a,0x3b,0x3c,0x3d,0x3e];
const hexA=(n:number):string=>'0x'+n.toString(16).toUpperCase();
export const device=defineDevice<Lcd2004I2cState>({
 kind:'lcd2004-i2c',protocol:'i2c',
 // backpack header order: GND VCC SDA SCL
 pins:['GND','VCC','SDA','SCL'],holes:[0,1,2,3],bodyX:[-46,52],
 copy:{
  name:{en:'LCD2004 with I2C backpack',id:'LCD2004 dengan modul I2C'},
  desc:{en:'A character display with 20 columns and 4 rows. A small I2C backpack (PCF8574) turns four wires into the HD44780 4-bit bus, so a Wire sketch can print text. Rows 3 and 4 are the continuation of rows 1 and 2 in the controller memory.',id:'Layar karakter 20 kolom 4 baris. Modul I2C kecil (PCF8574) mengubah empat kabel menjadi bus 4-bit HD44780, jadi sketsa Wire bisa menampilkan teks. Baris 3 dan 4 adalah lanjutan baris 1 dan 2 di memori pengendali.'},
  note:{en:'Nothing shows until the sketch runs the init sequence and turns the display on. Row 3 starts at address 0x14 and row 4 at 0x54.',id:'Layar kosong sampai sketsa menjalankan urutan inisialisasi dan menyalakan tampilan. Baris 3 mulai di alamat 0x14 dan baris 4 di 0x54.'},
 },
 power:{rail:['VCC','GND'],min:4.5,max:5.5,ma:40},
 inputs:[
  {type:'choice',key:'color',label:{en:'Backlight colour',id:'Warna lampu latar'},options:[{value:'green',label:{en:'Green',id:'Hijau'}},{value:'blue',label:{en:'Blue',id:'Biru'}}],default:'blue'},
  {type:'choice',key:'address',label:{en:'I2C address (backpack)',id:'Alamat I2C (modul)'},options:ADDRS.map(a=>({value:hexA(a),label:{en:`${hexA(a)} (${a>=0x38?'PCF8574A':'PCF8574'})`,id:`${hexA(a)} (${a>=0x38?'PCF8574A':'PCF8574'})`}})),default:'0x27'},
  {type:'range',key:'contrast',label:{en:'Contrast (trim pot)',id:'Kontras (trimpot)'},min:0,max:100,step:1,default:60,unit:'%'},
 ],
 defaults:{address:'0x27',color:'blue',contrast:60},
 create(ctx){
  // read the address lazily: the popover mutates ctx.props; the TWI matches the current value at every START
  const addr7=():number=>{const v=parseInt(String(ctx.props.address),16);return ADDRS.includes(v)?v:0x27;};
  const ddram=new Uint8Array(80).fill(0x20),cgram=new Uint8Array(64);
  let bit4=false,hiNib=-1;
  let addr=0,inCg=false,shift=0;
  let incr=true,shiftOn=false;
  let disp=false,cur=false,blink=false;
  let big2=false;
  let port=0,prev=0,writes=0,reads=0,chars=0,rdPhase=0;
  const move=():void=>{
   if(inCg){addr=(addr+(incr?1:-1))&0x3f;return;}
   addr=(addr+(incr?1:-1))&0x7f;
   if(shiftOn)shift=(shift+(incr?1:-1)+40)%40;
  };
  const cell=(a:number):number=>a<0x28?a:a>=0x40&&a<0x68?a-0x40+40:-1;   // DDRAM address to linear 0..79
  const command=(b:number):void=>{
   if(b&0x80){inCg=false;addr=b&0x7f;return;}
   if(b&0x40){inCg=true;addr=b&0x3f;return;}
   if(b&0x20){big2=!!(b&0x08);return;}
   if(b&0x10){
    const right=!!(b&0x04);
    if(b&0x08)shift=(shift+(right?-1:1)+40)%40;
    else addr=(addr+(right?1:-1))&0x7f;
    return;
   }
   if(b&0x08){disp=!!(b&0x04);cur=!!(b&0x02);blink=!!(b&0x01);return;}
   if(b&0x04){incr=!!(b&0x02);shiftOn=!!(b&0x01);return;}
   if(b&0x02){addr=0;shift=0;inCg=false;return;}
   if(b&0x01){ddram.fill(0x20);addr=0;shift=0;inCg=false;incr=true;}
  };
  const data=(b:number):void=>{
   chars++;
   if(inCg){cgram[addr&0x3f]=b;move();return;}
   const i=cell(addr);
   if(i>=0)ddram[i]=b;
   move();
  };
  const nibble=(n:number,rs:boolean,rw:boolean):void=>{
   if(rw)return;
   if(!bit4){if(n===0x2)bit4=true;return;}
   if(hiNib<0){hiNib=n;return;}
   const b=(hiNib<<4)|n;hiNib=-1;
   if(rs)data(b);else command(b);
  };
  const onByte=(b:number):void=>{
   const e=(b&4)!==0,pe=(prev&4)!==0;
   if(pe&&!e)nibble(prev>>4,(prev&1)!==0,(prev&2)!==0);
   if(!(b&2))rdPhase=0;
   prev=b;port=b;
  };
  /** Row 0..3 of the panel: rows 0/1 are the line starts, rows 2/3 continue them 20 cells later. */
  const vis=(row:number):string=>{
   if(!disp)return PAD.repeat(COLS);
   if(!big2&&row>0)return PAD.repeat(COLS);
   let s='';
   for(let i=0;i<COLS;i++){
    const idx=big2?((row&1)*40+((i+shift+(row>>1)*COLS)%40)):((i+shift)%40);
    s+=String.fromCharCode(ddram[idx]!);
   }
   return s;
  };
  const hex=():string=>Array.from(cgram,v=>v.toString(16).padStart(2,'0')).join('');
  return {
   state:()=>{
    const i=cell(addr);let col=-1,row=0;
    if(!inCg&&i>=0){
     const line=i>=40?1:0,rel=((i%40)-shift+40)%40;
     if(rel<COLS){row=line;col=rel;}else if(big2){row=line+2;col=rel-COLS;}
     if(!big2&&i>=40)col=-1;
    }
    return {
     line1:vis(0),line2:vis(1),line3:vis(2),line4:vis(3),cg:hex(),
     backlight:(port&8)!==0,display:disp,cursor:cur,blink,col,row,
     contrast:clamp(Math.round(num(ctx.props.contrast,60)),0,100),
     color:ctx.props.color==='green'?'green':'blue',address:addr7(),lines:big2?2:1,writes,reads,chars,
    };
   },
   i2c:{
    get address(){return addr7();},
    onStart(){},
    onWrite(byte){writes++;onByte(byte&0xff);return true;},
    // PCF8574 quasi-bidirectional port: with RW=1 and E=1 the HD44780 drives D7..D4 (busy flag 0 + address counter, or a DDRAM/CGRAM byte), high nibble first
    onRead(){
     reads++;
     let hi=prev&0xf0;
     if((prev&2)&&(prev&4)){
      const rs=(prev&1)!==0;
      const v=rs?(inCg?cgram[addr&0x3f]!:(cell(addr)>=0?ddram[cell(addr)]!:0x20)):addr&0x7f;
      hi=((rdPhase===0?v>>4:v&0x0f)<<4)&0xf0;rdPhase^=1;
      if(rdPhase===0&&rs)move();
     }
     return hi|(prev&0x0f);
    },
    onStop(){},
   },
  };
 },
});
