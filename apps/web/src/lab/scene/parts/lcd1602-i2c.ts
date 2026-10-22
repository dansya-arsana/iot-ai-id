/** LCD1602 + I2C backpack: standing 80x36 mm module, dot-matrix window drawn from the simulated DDRAM. Pairs with sim/devices/lcd1602-i2c.ts. */
import {BoxGeometry,Color,Group,Mesh,MeshBasicMaterial,PlaneGeometry} from 'three';
import type {PartProps} from '../../contract';
import type {Lcd1602I2cState} from '../../sim/devices/lcd1602-i2c';
import {canvasTexture,solid} from '../materials';
import * as C from '../palette';
import {MONO,PITCH,leg,definePart,extState,c,pin,callout,type Inner} from './kit';

const FRAME=0xb4b9c1; // ds-allow-hex  (nickel bezel of the LCD module)
const LCD_PCB=0x14603f; // ds-allow-hex  (green carrier PCB)
const BACK_PCB=0x1c62bd; // ds-allow-hex  (blue I2C backpack)
const TRIM=0x2a58a8; // ds-allow-hex
const BG={green:{on:'#9cc73f',off:'#4b5a3a',dot:'#1e2b10'},blue:{on:'#2358d6',off:'#1b2742',dot:'#e9f0ff'}} as const; // ds-allow-hex  (real LCD glass tints)

/** Classic 5x7 column font for ASCII 32..126 (public-domain table); bit 0 is the top row. */
const F5='0000000000 00005F0000 0007000700 147F147F14 242A7F2A12 2313086462 3649562050 0005030000 001C224100 004122 1C00 2A1C7F1C2A 08083E0808 0050300000 0808080808 0060600000 2010080402 3E5149453E 00427F4000 4261514946 2141454B31 1814127F10 2745454539 3C4A494930 0171090503 3649494936 064949291E 0036360000 0056360000 0814224100 1414141414 0041221408 020151 0906 32497941 3E 7E1111117E 7F494949 36 3E41414122 7F4141221C 7F49494941 7F09090901 3E41494 97A 7F0808087F 00417F4100 2040413F01 7F08142241 7F40404040 7F020C027F 7F0408107F 3E4141413E 7F09090906 3E4151215E 7F09192946 4649494931 0101 7F0101 3F4040403F 1F2040201F 3F4038403F 6314081463 0708700807 6151494543 007F414100 02040810 20 00 41417F00 0402010204 4040404040 0001020400 2054545478 7F48444438 3844444420 384444487F 3854545418 087E090102 081454543C 7F08040478 00447D4000 2040443D00 7F10284400 00417F4000 7C04180478 7C08040478 3844444438 7C14141408 08141418 7C 7C08040408 4854545420 043F444020 3C4040207C 1C2040201C 3C4030403C 4428102844 0C5050503C 4464544C44 0008364100 00007F0000 0041360800 08082A1C08'.replace(/\s+/g,'');
const GLYPH:number[][]=[];
for(let i=0;i<95;i++){const cols:number[]=[];for(let k=0;k<5;k++)cols.push(parseInt(F5.slice((i*5+k)*2,(i*5+k)*2+2),16));GLYPH.push(cols);}
const rowsOf=(code:number,cg:string):number[]|null=>{ // 8 rows of 5 bits, top first
 if(code<8){const r:number[]=[];for(let y=0;y<8;y++)r.push(parseInt(cg.slice((code*8+y)*2,(code*8+y)*2+2),16)&31);return r;}
 if(code>=32&&code<=126){const cols=GLYPH[code-32]!;const r:number[]=[];for(let y=0;y<8;y++){let v=0;for(let x=0;x<5;x++)if(y<7&&(cols[x]!>>y)&1)v|=16>>x;r.push(v);}return r;}
 if(code===0x20||code===0xa0)return null;
 if(code===0xdf)return [6,9,9,6,0,0,0,0]; // A00 ROM degree sign
 return [31,31,31,31,31,31,31,31]; // unmapped ROM cell: solid block
};

const COLS=16,DW=6,DH=9,DOT=7,TW=COLS*DW*DOT,TH=2*DH*DOT+DOT; // dot-grid canvas

function buildLcd(_p:PartProps,g:Group):Inner{
 const cx=3,W=80,H=36,y0=8,zf=0;
 for(let i=0;i<4;i++)g.add(leg(i*PITCH,y0+0.4));
 g.add(solid(new BoxGeometry(W,H,1.6),LCD_PCB,{outline:true,edges:true,pos:[cx,y0+H/2,zf-0.8],own:true}));          // carrier PCB
 g.add(solid(new BoxGeometry(71.2,24.2,5.4),FRAME,{outline:true,edges:true,pos:[cx,y0+H/2+0.2,zf+2.7],own:true,finish:'metal'})); // metal bezel + glass stack
 // I2C backpack on the back: PCB, PCF8574 chip, blue contrast trimmer
 g.add(solid(new BoxGeometry(42,19,1.4),BACK_PCB,{outline:true,edges:true,pos:[cx,y0+H/2,zf-5],own:true}));
 g.add(solid(new BoxGeometry(10,4,1.8),C.CHIP,{outline:true,edges:true,pos:[cx+4,y0+H/2+3,zf-6.1],own:true}));
 g.add(solid(new BoxGeometry(6,6,4),TRIM,{outline:true,edges:true,pos:[cx-12,y0+H/2-2,zf-6.8],own:true}));
 // dot-matrix window
 const cv=document.createElement('canvas');cv.width=TW;cv.height=TH;
 const ctx=cv.getContext('2d')!;
 const tex=canvasTexture(cv);
 const mat=new MeshBasicMaterial({map:tex,toneMapped:false});mat.userData.own=true;mat.userData.ownMap=true;
 const win=new Mesh(new PlaneGeometry(64.5,13.8),mat);win.position.set(cx,y0+H/2+0.2,zf+5.45);win.userData.noPick=true;win.userData.glass=true;win.userData.noInk=true;g.add(win);
 const tint=new Color();void tint;void MONO;
 let last='',t=0;
 const draw=(st:Lcd1602I2cState,blinkOn:boolean)=>{
  const key=[st.line1,st.line2,st.cg,st.backlight,st.display,st.cursor,st.blink&&blinkOn,st.col,st.row,st.contrast,st.color].join('|');
  if(key===last)return;last=key;
  const pal=BG[st.color==='blue'?'blue':'green'];
  ctx.fillStyle=st.backlight?pal.on:pal.off;ctx.fillRect(0,0,TW,TH);
  const alpha=(st.display?0.12+0.88*(st.contrast/100):0)*(st.backlight?1:0.45);
  ctx.fillStyle=pal.dot;ctx.globalAlpha=alpha;
  const dot=(cx0:number,cy0:number)=>ctx.fillRect(cx0*DOT+0.6,cy0*DOT+0.6,DOT-1.4,DOT-1.4);
  // unlit cells show faint ghosts on a real LCD (visible only when contrast is high)
  [st.line1,st.line2].forEach((line,row)=>{
   for(let col=0;col<COLS;col++){
    const rs=rowsOf(line.charCodeAt(col),st.cg);if(!rs)continue;
    for(let y=0;y<8;y++)for(let x=0;x<5;x++)if((rs[y]!>>(4-x))&1)dot(col*DW+x,row*DH+y);
   }
  });
  if(st.display&&st.col>=0){
   if(st.cursor)for(let x=0;x<5;x++)dot(st.col*DW+x,st.row*DH+7);
   if(st.blink&&blinkOn)for(let y=0;y<8;y++)for(let x=0;x<5;x++)dot(st.col*DW+x,st.row*DH+y);
  }
  ctx.globalAlpha=1;tex.needsUpdate=true;
 };
 draw({line1:'\u00ff'.repeat(16),line2:' '.repeat(16),cg:'0'.repeat(128),backlight:true,display:true,cursor:false,blink:false,col:0,row:0,contrast:60,color:'green',address:0x27,writes:0,reads:0,chars:0},false);
 return {
  apply(s,dt){
   const st=extState<Lcd1602I2cState>(s,'lcd1602-i2c');
   if(!st)return;
   t+=dt;
   draw(st,Math.floor(t/0.5)%2===0);
  },
 };
}

export const lcd1602I2c=definePart({
 kind:'lcd1602-i2c',name:c('LCD1602 + I2C','LCD1602 + I2C'),
 pins:{GND:pin([0,0,0],'ground','Ground','Ground'),VCC:pin([PITCH,0,0],'power','5V','5V'),SDA:pin([2*PITCH,0,0],'input','SDA (I2C data)','SDA (data I2C)'),SCL:pin([3*PITCH,0,0],'input','SCL (I2C clock)','SCL (clock I2C)')},
 callouts:[
  callout('window',[3,28,6],'Two rows of 16 characters, drawn from the display memory','Dua baris 16 karakter, digambar dari memori tampilan'),
  callout('backpack',[3,28,-8],'The I2C backpack at 0x27 turns 4 wires into the 4-bit LCD bus','Modul I2C di 0x27 mengubah 4 kabel menjadi bus LCD 4-bit'),
 ],
 make:buildLcd,
});
