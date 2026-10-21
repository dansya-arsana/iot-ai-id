/**
 * Reference decoder for the lesson 13 OLED dashboard: the 5x7 font the sketch draws at double size, and a reader that turns the
 * 128x64 frame buffer of the simulated SSD1306 back into text. Used by the integration test and the e2e spec.
 * Provenance: the values are the plain 5x7 column bitmaps of the classic public-domain style 5x7 ASCII font; they are facts of the glyph shapes, with no library code copied.
 * The table is written out here on purpose (not parsed from the sketch), so a typo in the sketch's font fails the test.
 */
export const GLYPHS='0123456789.-CTH%ER ';
export const FONT:number[][]=[
 [0x3E,0x51,0x49,0x45,0x3E],[0x00,0x42,0x7F,0x40,0x00],[0x42,0x61,0x51,0x49,0x46],[0x21,0x41,0x45,0x4B,0x31],[0x18,0x14,0x12,0x7F,0x10],
 [0x27,0x45,0x45,0x45,0x39],[0x3C,0x4A,0x49,0x49,0x30],[0x01,0x71,0x09,0x05,0x03],[0x36,0x49,0x49,0x49,0x36],[0x06,0x49,0x49,0x29,0x1E],
 [0x00,0x60,0x60,0x00,0x00],[0x08,0x08,0x08,0x08,0x08],[0x3E,0x41,0x41,0x41,0x22],[0x01,0x01,0x7F,0x01,0x01],[0x7F,0x08,0x08,0x08,0x7F],
 [0x23,0x13,0x08,0x64,0x62],[0x7F,0x49,0x49,0x49,0x41],[0x7F,0x09,0x19,0x29,0x46],[0x00,0x00,0x00,0x00,0x00],
];
/** A glyph at double size: ten columns, the top page and the bottom page. */
export function bigGlyph(ch:string):{top:number[];bottom:number[]}{
 const g=Math.max(0,GLYPHS.indexOf(ch));
 const top:number[]=[],bottom:number[]=[];
 for(let c=0;c<5;c++){
  const col=FONT[g]![c]!;let t=0,b=0;
  for(let r=0;r<4;r++){if(col&(1<<r))t|=3<<(r*2);if(col&(1<<(r+4)))b|=3<<(r*2);}
  top.push(t,t);bottom.push(b,b);
 }
 return {top,bottom};
}
/** Page-major bytes of the 128x64 frame (hex string of 1024 bytes) */
export const frameBytes=(fb:string):number[]=>Array.from({length:fb.length/2},(_,i)=>parseInt(fb.slice(i*2,i*2+2),16));
/** Text of one double-height line whose top page is `page`: ten cells of 12 px. Unknown cells decode as '?'. */
export function readLine(fb:string,page:number):string{
 const bytes=frameBytes(fb);
 let out='';
 for(let i=0;i<10;i++){
  const x=i*12;
  const top=bytes.slice(page*128+x,page*128+x+10),bottom=bytes.slice((page+1)*128+x,(page+1)*128+x+10);
  let found='?';
  for(const ch of GLYPHS){
   const g=bigGlyph(ch);
   if(g.top.every((v,k)=>v===top[k])&&g.bottom.every((v,k)=>v===bottom[k])){found=ch;break;}
  }
  out+=found;
 }
 return out.trimEnd();
}
export const litPixels=(fb:string):number=>frameBytes(fb).reduce((n,b)=>{let v=b;while(v){n+=v&1;v>>=1;}return n;},0);
