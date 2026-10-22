/** MAX7219 8x8 LED matrix module (32 x 32 mm per matrix, 3.75 mm dot pitch), one or four chained like the FC-16 board. The face is a CanvasTexture of the rows the chip really lights. Pairs with sim/devices/max7219-matrix.ts. */
import {BoxGeometry,CylinderGeometry,Group,Mesh,MeshBasicMaterial,PlaneGeometry} from 'three';
import type {PartProps} from '../../contract';
import type {Max7219State} from '../../sim/devices/max7219-matrix';
import {canvasTexture,solid} from '../materials';
import * as C from '../palette';
import {HALF_PI,MONO,definePart,extState,c,pin,callout,type Inner} from './kit';

const M=32,P=2.54,BY=2.0,TH=1.4,TOP=BY+TH,LEFT=7.5,HOUSE=7.4;     // matrix size, pitch, PCB underside, thickness, top y, left strip width, housing height
const PCB_GREEN=0x1f6b46; // ds-allow-hex  (green solder mask of the FC-16 board)
const FACE=0x1a1214; // ds-allow-hex  (black plastic face of the red 8x8 matrix)
const DOT_OFF='#3a1a1d'; // ds-allow-hex
const pz=(i:number):number=>(i-2)*P;                                 // pin i along z, VCC at the back
const HX=-LEFT+2.1;
const TIP=TOP+8;
const PINS=['VCC','GND','DIN','CS','CLK'];

function stripTex():ReturnType<typeof canvasTexture>{
 const S=24,cv=document.createElement('canvas');cv.width=LEFT*S;cv.height=M*S;
 const g=cv.getContext('2d')!;
 g.fillStyle=C.SILKSCREEN;g.textBaseline='middle';g.textAlign='left';g.font=`700 ${Math.round(1.25*S)}px ${MONO}`;
 for(let i=0;i<5;i++)g.fillText(PINS[i]!,(LEFT-3.9)*S,(M/2+pz(i))*S);
 return canvasTexture(cv);
}

function buildMatrix(p:PartProps,g:Group):Inner{
 const n=String(p.modules)==='4'?4:1;
 const W=M*n,right=W+6;
 // PCB under everything: left strip with the input header, the matrices, right strip with the output (DOUT) header
 g.add(solid(new BoxGeometry(LEFT+right,TH,M),PCB_GREEN,{outline:true,edges:true,pos:[(right-LEFT)/2,BY+TH/2,0],own:true,finish:'pcb'}));
 const lab=new Mesh(new PlaneGeometry(LEFT,M),new MeshBasicMaterial({map:stripTex(),transparent:true,toneMapped:false,depthWrite:false}));
 lab.material.userData.own=true;lab.material.userData.ownMap=true;lab.rotation.x=-HALF_PI;lab.position.set(-LEFT/2,TOP+0.03,0);lab.userData.noPick=true;lab.userData.noInk=true;g.add(lab);
 // input header (VCC GND DIN CS CLK)
 g.add(solid(new BoxGeometry(2.54,2.5,5*P),C.HEADER_BLACK,{outline:true,pos:[HX,TOP+1.25,0]}));
 for(let i=0;i<5;i++)g.add(solid(new BoxGeometry(0.64,TIP-TOP-1,0.64),C.GOLD,{pos:[HX,(TIP+TOP+1)/2,pz(i)],cast:false,finish:'metal'}));
 // output header, same shape, short pins (DOUT side, for the next module)
 g.add(solid(new BoxGeometry(2.54,2.5,5*P),C.HEADER_BLACK,{pos:[W+3,TOP+1.25,0]}));
 for(let i=0;i<5;i++)g.add(solid(new BoxGeometry(0.64,5,0.64),C.GOLD,{pos:[W+3,TOP+3,pz(i)],cast:false,finish:'metal'}));
 // one 8x8 housing per module (the real board stacks four 1088-style matrices side by side)
 for(let k=0;k<n;k++){
  g.add(solid(new BoxGeometry(M-0.5,HOUSE,M-0.8),FACE,{outline:true,edges:true,pos:[k*M+M/2,TOP+HOUSE/2,0],own:true}));
 }
 // MAX7219 itself sits on the back of the real board; show its decal on the strip as a small SO-24 package next to the header
 g.add(solid(new BoxGeometry(2.8,0.9,15.4),C.CHIP,{outline:true,pos:[-1.6,TOP+0.45,0],own:true}));
 for(const z of [-11,11])g.add(solid(new CylinderGeometry(0.9,0.9,0.4,12),C.GOLD,{pos:[-3.4,TOP+0.2,z],cast:false,finish:'metal'}));
 // the lit face
 const S=24,cv=document.createElement('canvas');cv.width=8*n*S;cv.height=8*S;
 const ctx=cv.getContext('2d')!;
 const tex=canvasTexture(cv);tex.generateMipmaps=false;
 const face=new Mesh(new PlaneGeometry(W-0.5,M-0.8),new MeshBasicMaterial({map:tex,toneMapped:false}));
 face.material.userData.own=true;face.material.userData.ownMap=true;
 face.rotation.x=-HALF_PI;face.position.set(W/2,TOP+HOUSE+0.04,0);face.userData.noPick=true;face.userData.noInk=true;g.add(face);
 let last='';
 const draw=(fb:string,lum:string):void=>{
  ctx.fillStyle='#120b0c';ctx.fillRect(0,0,cv.width,cv.height);
  for(let k=0;k<n;k++){
   const lv=parseInt(lum.substr(k*2,2),16)/255;
   for(let r=0;r<8;r++){
    const byte=parseInt(fb.substr((k*8+r)*2,2),16);
    for(let col=0;col<8;col++){
     const cx=((k*8+col)+0.5)*S,cy=(r+0.5)*S;
     const on=(byte>>(7-col))&1;
     ctx.beginPath();ctx.arc(cx,cy,S*0.36,0,Math.PI*2);
     if(on){
      const a=0.3+0.7*lv;
      ctx.fillStyle=`rgba(255,${Math.round(60+90*lv)},${Math.round(50+60*lv)},${a})`;
      ctx.shadowColor='rgba(255,50,40,0.9)';ctx.shadowBlur=S*0.5*lv;
     }else{ctx.fillStyle=DOT_OFF;ctx.shadowBlur=0;}
     ctx.fill();ctx.shadowBlur=0;
    }
   }
  }
  tex.needsUpdate=true;
 };
 draw('0'.repeat(16*n),'00'.repeat(n));
 return {
  apply(s){
   const st=extState<Max7219State>(s,'max7219-matrix');
   if(!st||st.modules!==n)return;
   const key=st.fb+'/'+st.lum;
   if(key!==last){last=key;draw(st.fb,st.lum);}
  },
 };
}

export const max7219Matrix=definePart({
 kind:'max7219-matrix',name:c('MAX7219 LED matrix','Matriks LED MAX7219'),deskMm:[40,32],
 pins:{
  VCC:pin([HX,TIP,pz(0)],'power','5V','5V'),GND:pin([HX,TIP,pz(1)],'ground','Ground','Ground'),
  DIN:pin([HX,TIP,pz(2)],'input','DIN (data in, MOSI D11)','DIN (data masuk, MOSI D11)'),
  CS:pin([HX,TIP,pz(3)],'input','CS / LOAD (latches the data)','CS / LOAD (mengunci data)'),
  CLK:pin([HX,TIP,pz(4)],'input','CLK (SPI clock, D13)','CLK (clock SPI, D13)'),
 },
 callouts:[
  callout('face',[M/2,TOP+HOUSE+1,0],'Each lit dot is one bit of a row register the sketch wrote','Setiap titik menyala adalah satu bit dari register baris yang ditulis sketch'),
  callout('din',[HX,TIP+1,pz(2)],'Three signal wires: DIN, CLK and CS (LOAD)','Tiga kabel sinyal: DIN, CLK, dan CS (LOAD)'),
  callout('dout',[M+3,TOP+6,0],'The DOUT header feeds the next module in a chain','Header DOUT menyambung ke modul berikutnya dalam rantai'),
 ],
 make:buildMatrix,
});
