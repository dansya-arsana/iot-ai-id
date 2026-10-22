/**
 * ULN2003 stepper driver board: a blue PCB about 35 x 31 mm with the ULN2003A in a 16-pin DIP, four LEDs (A-D), a five-pin white motor
 * socket on top, a header for IN1-IN4 and a two-pin power header. Pairs with sim/devices/uln2003-driver.ts.
 */
import {BoxGeometry,CylinderGeometry,Group,Mesh,MeshBasicMaterial,PlaneGeometry} from 'three';
import type {PartProps} from '../../contract';
import type {Uln2003State} from '../../sim/devices/uln2003-driver';
import {PITCH} from '../layout';
import {canvasTexture,ownToon,solid} from '../materials';
import * as C from '../palette';
import {MONO,leg,definePart,extState,c,pin,callout,type Inner} from './kit';

const PCB_BLUE=0x1d5fb8; // ds-allow-hex  (ULN2003 board: blue solder mask)
const LED_OFF=0x4a2a2a; // ds-allow-hex  (unlit red LED)
const BW=35.5,BH=31,PY=5,CX=16,CY=PY+BH/2;
const SOCK_Y=PY+BH-4.5,SOCK_Z=7.4;
const sockX=(k:number):number=>CX+8+(k-2)*2.54;

function label(g:Group,text:string,w:number,h:number,x:number,y:number):void{
 const cv=document.createElement('canvas');cv.width=256;cv.height=Math.round(256*h/w);
 const k=cv.getContext('2d')!;
 k.fillStyle='#f7f4ea';k.textAlign='center';k.textBaseline='middle';k.font=`600 ${Math.round(cv.height*0.7)}px ${MONO}`;k.fillText(text,128,cv.height/2); // ds-allow-hex
 const m=new Mesh(new PlaneGeometry(w,h),new MeshBasicMaterial({map:canvasTexture(cv),transparent:true,toneMapped:false,depthWrite:false}));
 m.material.userData.own=true;m.material.userData.ownMap=true;m.position.set(x,y,0.85);m.userData.noPick=true;m.userData.noInk=true;g.add(m);
}

function buildUln(_p:PartProps,g:Group):Inner{
 for(let i=0;i<6;i++)g.add(leg(i*PITCH,PY+0.4));
 g.add(solid(new BoxGeometry(BW,BH,1.6),PCB_BLUE,{outline:true,edges:true,pos:[CX,CY,0]}));
 // six-pin header along the bottom
 g.add(solid(new BoxGeometry(6*PITCH,2.5,2.5),C.HEADER_BLACK,{pos:[2.5*PITCH,PY+1.6,1.8],cast:false}));
 // ULN2003A in a 16-pin DIP: 19.2 x 6.4 mm, notch at the left
 g.add(solid(new BoxGeometry(19.2,6.4,3.4),C.CHIP,{outline:true,pos:[CX-1,CY-3,2.4]}));
 g.add(solid(new CylinderGeometry(1,1,0.2,14),C.HEADER_TOP,{pos:[CX-9.2,CY-3,4.2],rot:[Math.PI/2,0,0],cast:false}));
 for(let i=0;i<8;i++)for(const sy of [-1,1])g.add(solid(new BoxGeometry(0.6,0.9,0.4),C.SILVER,{pos:[CX-1-8.9+i*2.54+0.6,CY-3+sy*3.4,1.1],cast:false,finish:'metal'}));
 // motor socket (white shroud, five pins, key on the top)
 g.add(solid(new BoxGeometry(14.2,6.4,SOCK_Z-0.8),C.CREAM,{outline:true,pos:[CX+8,SOCK_Y,0.8+(SOCK_Z-0.8)/2]}));
 g.add(solid(new BoxGeometry(5,1.2,SOCK_Z-0.8),C.CREAM_DARK,{pos:[CX+8,SOCK_Y+3.6,0.8+(SOCK_Z-0.8)/2],cast:false}));
 for(let k=0;k<5;k++)g.add(solid(new BoxGeometry(0.64,0.64,1.2),C.GOLD,{pos:[sockX(k),SOCK_Y,SOCK_Z-0.4],cast:false,finish:'gold'}));
 // power header jumper (black cap) and four LEDs A-D
 g.add(solid(new BoxGeometry(5.4,2.6,2.8),C.HEADER_BLACK,{outline:true,pos:[CX-12,CY+3,2]}));
 const leds=[0,1,2,3].map(k=>{
  const mat=ownToon(LED_OFF);
  const mesh=new Mesh(new BoxGeometry(3,2,1.4),mat);mesh.position.set(CX-14+k*3.9,CY+11,1.2);mesh.castShadow=true;g.add(mesh);
  return mat;
 });
 label(g,'IN1  IN2  IN3  IN4  -  +',19,2.1,2.5*PITCH,PY+4.6);
 label(g,'A   B   C   D',13,2,CX-9.2,CY+8.6);
 label(g,'ULN2003',9,2.4,CX-1,CY-8.2);
 return {
  apply(s){
   const st=extState<Uln2003State>(s,'uln2003-driver');
   if(!st)return;
   leds.forEach((m,k)=>{
    const on=(st.outMask&(1<<k))!==0;
    m.color.setHex(on?C.RED_ALERT:LED_OFF);m.emissive.setHex(C.RED_ALERT);m.emissiveIntensity=on?1.6:0;
   });
  },
 };
}

export const uln2003Driver=definePart({
 kind:'uln2003-driver',name:c('ULN2003 stepper driver','Driver stepper ULN2003'),
 pins:{
  IN1:pin([0,0,0],'input','IN1 (coil 1)','IN1 (kumparan 1)'),IN2:pin([PITCH,0,0],'input','IN2 (coil 2)','IN2 (kumparan 2)'),
  IN3:pin([2*PITCH,0,0],'input','IN3 (coil 3)','IN3 (kumparan 3)'),IN4:pin([3*PITCH,0,0],'input','IN4 (coil 4)','IN4 (kumparan 4)'),
  '-':pin([4*PITCH,0,0],'ground','Ground (-)','Ground (-)'),'+':pin([5*PITCH,0,0],'power','Motor supply (+5 V)','Catu motor (+5 V)'),
  OUT1:pin([sockX(0),SOCK_Y,SOCK_Z],'output','Motor pin 1 (blue)','Pin motor 1 (biru)'),OUT2:pin([sockX(1),SOCK_Y,SOCK_Z],'output','Motor pin 2 (pink)','Pin motor 2 (merah muda)'),
  OUT3:pin([sockX(2),SOCK_Y,SOCK_Z],'output','Motor pin 3 (yellow)','Pin motor 3 (kuning)'),OUT4:pin([sockX(3),SOCK_Y,SOCK_Z],'output','Motor pin 4 (orange)','Pin motor 4 (oranye)'),
  COM:pin([sockX(4),SOCK_Y,SOCK_Z],'power','Motor pin 5 (red, +)','Pin motor 5 (merah, +)'),
 },
 callouts:[
  callout('chip',[CX-1,CY-3,6],'ULN2003A: four switches that sink the coil current','ULN2003A: empat saklar yang menyerap arus kumparan'),
  callout('leds',[CX-8,CY+11,4],'LEDs A-D show which coils are on right now','LED A-D menunjukkan kumparan yang menyala saat ini'),
  callout('plug',[CX+8,SOCK_Y,SOCK_Z+3],'The five-pin socket takes the motor plug','Soket lima pin untuk colokan motor'),
 ],
 make:buildUln,
});
