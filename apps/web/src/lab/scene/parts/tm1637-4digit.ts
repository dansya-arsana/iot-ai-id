/** TM1637 4-digit module: 42 x 24 mm board with a 0.56 in four-digit window (about 30 x 14 mm, colon between digits 2 and 3). The digits are drawn from the live segment bytes. Pairs with sim/devices/tm1637-4digit.ts. */
import {BoxGeometry,Group,Mesh,MeshBasicMaterial,PlaneGeometry} from 'three';
import type {PartProps} from '../../contract';
import type {Tm16374digitState} from '../../sim/devices/tm1637-4digit';
import {PITCH} from '../layout';
import {canvasTexture,solid} from '../materials';
import * as C from '../palette';
import {MONO,leg,definePart,extState,c,pin,callout,type Inner} from './kit';

const BOARD=0x1c62bd; // ds-allow-hex  (blue solder mask of the common module)
const FACE=0x0b0c0e; // ds-allow-hex  (smoked front of the digit housing)
const SEG_ON='#ff3b30'; // ds-allow-hex  (lit red segment)
const SEG_OFF='#2b1416'; // ds-allow-hex  (unlit segment under the smoked lens)

const CW=480,CH=224,DW=120;                       // 4 cells of 120 px = 30 mm, 224 px = 14 mm
const T=15;                                       // segment thickness
type Pt=[number,number];
const hex6=(x0:number,x1:number,y:number):Pt[]=>[[x0,y],[x0+T/2,y-T/2],[x1-T/2,y-T/2],[x1,y],[x1-T/2,y+T/2],[x0+T/2,y+T/2]];
const vex6=(x:number,y0:number,y1:number):Pt[]=>[[x,y0],[x+T/2,y0+T/2],[x+T/2,y1-T/2],[x,y1],[x-T/2,y1-T/2],[x-T/2,y0+T/2]];
const XL=30,XR=90,YT=26,YM=112,YB=198,G=5;
const SEG:Pt[][]=[ // bit 0..6 = A..G
 hex6(XL+G,XR-G,YT),vex6(XR,YT+G,YM-G),vex6(XR,YM+G,YB-G),hex6(XL+G,XR-G,YB),vex6(XL,YM+G,YB-G),vex6(XL,YT+G,YM-G),hex6(XL+G,XR-G,YM),
];

function buildTm(_p:PartProps,g:Group):Inner{
 const W=42,H=24,TH=1.6,y0=3,cx=1.5*PITCH;
 for(let i=0;i<4;i++)g.add(leg(i*PITCH,y0+0.4));
 const zc=-TH/2;
 g.add(solid(new BoxGeometry(W,H,TH),BOARD,{outline:true,edges:true,pos:[cx,y0+H/2,zc],own:true}));
 // digit housing: 30 x 14 mm window, 8 mm deep
 const hy=y0+H/2+0.5;
 g.add(solid(new BoxGeometry(31.4,15.4,7.4),FACE,{outline:true,edges:true,pos:[cx,hy,TH/2+3.7+zc],own:true}));
 // TM1637 (SOP-20) on the back, four mounting pads and the header silkscreen
 g.add(solid(new BoxGeometry(12.8,7.6,1.6),C.CHIP,{outline:true,edges:true,pos:[cx+10,y0+H/2,zc-TH/2-0.8],own:true}));
 const cv=document.createElement('canvas');cv.width=CW;cv.height=CH;
 const ctx=cv.getContext('2d')!;
 const tex=canvasTexture(cv);
 const mat=new MeshBasicMaterial({map:tex,toneMapped:false});mat.userData.own=true;mat.userData.ownMap=true;
 const win=new Mesh(new PlaneGeometry(30,14),mat);win.position.set(cx,hy,TH/2+7.42+zc);win.userData.noPick=true;win.userData.glass=true;win.userData.noInk=true;g.add(win);
 const lcv=document.createElement('canvas');lcv.width=256;lcv.height=48;
 const lg=lcv.getContext('2d')!;lg.fillStyle=C.SILKSCREEN;lg.font=`600 26px ${MONO}`;lg.textAlign='center';lg.textBaseline='middle';
 lg.fillText('CLK DIO 5V GND',128,24);
 const lab=new Mesh(new PlaneGeometry(14,2.6),new MeshBasicMaterial({map:canvasTexture(lcv),transparent:true,toneMapped:false,depthWrite:false}));
 lab.material.userData.own=true;lab.material.userData.ownMap=true;
 lab.position.set(cx,y0+2.4,TH/2+0.03+zc);lab.userData.noPick=true;lab.userData.noInk=true;g.add(lab);
 let last='';
 const poly=(pts:Pt[],ox:number):void=>{ctx.beginPath();pts.forEach(([x,y],i)=>{if(i)ctx.lineTo(ox+x,y);else ctx.moveTo(ox+x,y);});ctx.closePath();ctx.fill();};
 const dot=(x:number,y:number):void=>{ctx.beginPath();ctx.arc(x,y,8,0,Math.PI*2);ctx.fill();};
 const draw=(st:Tm16374digitState):void=>{
  const key=[st.seg,st.duty,st.colon,st.layout].join('|');
  if(key===last)return;last=key;
  ctx.fillStyle='#050506';ctx.fillRect(0,0,CW,CH);
  const lit=st.on&&st.duty>0,a=0.3+0.7*st.duty;
  for(let d=0;d<4;d++){
   const b=parseInt(st.seg.substr(d*2,2),16),ox=d*DW;
   ctx.globalAlpha=1;ctx.fillStyle=SEG_OFF;
   for(const s of SEG)poly(s,ox);
   dot(ox+XR+15,YB);
   if(!lit)continue;
   ctx.globalAlpha=a;ctx.fillStyle=SEG_ON;ctx.shadowColor=SEG_ON;ctx.shadowBlur=14*st.duty;
   for(let i=0;i<7;i++)if((b>>i)&1)poly(SEG[i]!,ox);
   if(st.layout==='decimal'&&(b&0x80))dot(ox+XR+15,YB);
   ctx.shadowBlur=0;
  }
  // colon between digit 2 and 3
  ctx.globalAlpha=1;ctx.fillStyle=SEG_OFF;dot(DW*2,70);dot(DW*2,154);
  if(lit&&st.colon){ctx.globalAlpha=a;ctx.fillStyle=SEG_ON;ctx.shadowColor=SEG_ON;ctx.shadowBlur=14*st.duty;dot(DW*2,70);dot(DW*2,154);ctx.shadowBlur=0;}
  ctx.globalAlpha=1;tex.needsUpdate=true;
 };
 draw({seg:'000000000000',text:'    ',colon:false,on:false,bright:0,duty:0,mode:'auto',addr:0,frames:0,bytes:0,acks:0,invalid:0,ignored:0,stops:0,last:0,keyReads:0,key:0,layout:'clock'});
 return {
  apply(s){
   const st=extState<Tm16374digitState>(s,'tm1637-4digit');
   if(st)draw(st);
  },
 };
}

export const tm16374digit=definePart({
 kind:'tm1637-4digit',name:c('TM1637 4-digit display','Tampilan 4 digit TM1637'),
 pins:{CLK:pin([0*PITCH,0,0],'input','CLK (clock)','CLK (clock)'),DIO:pin([1*PITCH,0,0],'input','DIO (data, two-wire)','DIO (data, dua kabel)'),VCC:pin([2*PITCH,0,0],'power','5V','5V'),GND:pin([3*PITCH,0,0],'ground','Ground','Ground')},
 callouts:[
  callout('digits',[1.5*PITCH,18,6],'Four digits and a colon, lit from the segment bytes the sketch sent','Empat digit dan titik dua, menyala dari byte segmen kiriman sketsa'),
  callout('bus',[1.5*PITCH,4,0],'Only CLK and DIO: its own two-wire bus, not I2C','Hanya CLK dan DIO: bus dua kabel sendiri, bukan I2C'),
 ],
 make:buildTm,
});
