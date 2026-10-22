/** ACS712-5A module: blue board about 31 x 13 mm, a SOIC-8 Hall sensor, a two-way green screw terminal for the measured wire and a 3-pin header. Pairs with sim/devices/acs712-5a.ts. */
import {BoxGeometry,CylinderGeometry,Group,Mesh,MeshBasicMaterial,PlaneGeometry} from 'three';
import type {PartProps} from '../../contract';
import type {Acs7125aState} from '../../sim/devices/acs712-5a';
import {PITCH} from '../layout';
import {canvasTexture,ownToon,solid} from '../materials';
import * as C from '../palette';
import {HALF_PI,MONO,leg,definePart,extState,c,pin,callout,type Inner} from './kit';

const BOARD_BLUE=0x1f5fb8; // ds-allow-hex  (sensor module PCB)
const TERM_GREEN=0x2f9a58; // ds-allow-hex  (screw terminal housing)
const LED_OFF=0x2a3a30; // ds-allow-hex  (unlit indicator)

function label(g:Group,text:string,w:number,h:number,x:number,y:number,z:number):void{
 const cv=document.createElement('canvas');cv.width=256;cv.height=Math.max(16,Math.round(256*h/w));
 const k=cv.getContext('2d')!;
 k.fillStyle='#f7f4ea';k.textAlign='center';k.textBaseline='middle';k.font=`600 ${Math.round(cv.height*0.7)}px ${MONO}`;k.fillText(text,128,cv.height/2);
 const m=new Mesh(new PlaneGeometry(w,h),new MeshBasicMaterial({map:canvasTexture(cv),transparent:true,toneMapped:false,depthWrite:false}));
 m.material.userData.own=true;m.material.userData.ownMap=true;m.position.set(x,y,z);m.userData.noPick=true;m.userData.noInk=true;g.add(m);
}

const BW=31,BH=13,PY=5,CX=13,CY=PY+BH/2;
/** Terminal anchors in mm (the screw heads buildAcs draws). */
const TX=23.5,TZ=9.4,TY_PLUS=CY+2.54,TY_MINUS=CY-2.54;

function buildAcs(_p:PartProps,g:Group):Inner{
 for(let i=0;i<3;i++)g.add(leg(i*PITCH,PY+0.4));
 g.add(solid(new BoxGeometry(BW,BH,1.6),BOARD_BLUE,{outline:true,edges:true,pos:[CX,CY,0]}));
 // two-way screw terminal (5.08 mm pitch) with its wire entries on the right edge
 g.add(solid(new BoxGeometry(10,10.16,8.2),TERM_GREEN,{outline:true,pos:[TX,CY,4.6]}));
 for(const sy of [-1,1]){
  g.add(solid(new CylinderGeometry(1.7,1.7,0.9,14),C.SILVER,{rot:[HALF_PI,0,0],pos:[TX,CY+sy*2.54,9.0],finish:'metal'}));
  g.add(solid(new BoxGeometry(0.6,3.4,3.4),C.HOLE,{pos:[TX+5,CY+sy*2.54,4.6],cast:false}));
 }
 // SOIC-8 Hall sensor (4.9 x 3.9 mm) with four gull-wing legs on each long side, and its print
 const chipX=9.5,chipY=CY+0.2;
 g.add(solid(new BoxGeometry(3.9,4.9,1.5),C.CHIP,{outline:true,pos:[chipX,chipY,1.55]}));
 for(const sx of [-1,1])for(let i=0;i<4;i++)g.add(solid(new BoxGeometry(0.9,0.42,0.3),C.SILVER,{pos:[chipX+sx*2.2,chipY+(i-1.5)*1.27,0.95],cast:false,finish:'metal'}));
 label(g,'ACS712',3.6,1.1,chipX,chipY,2.32);
 // decoupling capacitors, a resistor and the power LED
 for(const [x,y] of [[15,CY+3],[15,CY-3],[5,CY-0.5]] as const)g.add(solid(new BoxGeometry(1.6,0.8,0.8),C.CREAM_DARK,{pos:[x,y,1.2],cast:false}));
 const power=ownToon(LED_OFF);
 const pw=new Mesh(new BoxGeometry(1.6,0.9,0.7),power);pw.position.set(5,CY+3.6,1.2);g.add(pw);
 // reading bar (not on the real board): length and colour show the current, green one way and amber the other
 const barMat=ownToon(LED_OFF);
 const bar=new Mesh(new BoxGeometry(1,1.1,0.8),barMat);bar.position.set(CX+2,CY+5.4,1.2);g.add(bar);
 label(g,'VCC OUT GND',9,1.6,PITCH,PY+1.4,0.9);label(g,'IP+  IP-',8,1.6,TX-3.2,PY+0.9,0.9);
 return {
  apply(s){
   const st=extState<Acs7125aState>(s,'acs712-5a');
   if(!st)return;
   power.color.setHex(st.powered?C.LED_ON_GREEN:LED_OFF);power.emissive.setHex(C.LED_ON_GREEN);power.emissiveIntensity=st.powered?1.6:0;
   const mag=Math.min(1,Math.abs(st.amps)/5),col=st.amps>=0?C.LIVE:C.PWM;
   bar.scale.x=Math.max(0.001,mag*8);bar.position.x=CX+2+(st.amps>=0?1:-1)*mag*4;
   bar.visible=st.powered&&mag>0.01;
   barMat.color.setHex(col);barMat.emissive.setHex(col);barMat.emissiveIntensity=0.5+2*mag;
  },
 };
}

export const acs7125a=definePart({
 kind:'acs712-5a',name:c('ACS712 current sensor (5 A)','Sensor arus ACS712 (5 A)'),
 pins:{
  VCC:pin([0,0,0],'power','5V','5V'),OUT:pin([PITCH,0,0],'output','OUT (analog)','OUT (analog)'),GND:pin([2*PITCH,0,0],'ground','Ground','Ground'),
  'IP+':pin([TX,TY_PLUS,TZ],'input','IP+ (current in)','IP+ (arus masuk)'),'IP-':pin([TX,TY_MINUS,TZ],'output','IP- (current out)','IP- (arus keluar)'),
 },
 callouts:[
  callout('terminal',[TX,CY+8,TZ],'Measured wire goes through these two screws','Kabel yang diukur lewat dua sekrup ini'),
  callout('chip',[9.5,CY+5,3],'The Hall chip senses the current, no contact needed','Chip Hall merasakan arus tanpa kontak'),
 ],
 make:buildAcs,
});
