/**
 * IRF520 MOSFET module: a red PCB about 34 x 24 mm with the IRF520 in a TO-220 package (10 x 4.5 mm body, silver tab with a mounting hole),
 * two blue two-way screw terminals (load V+/V-, supply VIN+/VIN-), a three-pin header (SIG, VCC, GND) and a red drive LED.
 * Pairs with sim/devices/irf520-mosfet-module.ts.
 */
import {BoxGeometry,CylinderGeometry,Group,Mesh,MeshBasicMaterial,PlaneGeometry} from 'three';
import type {PartProps} from '../../contract';
import type {Irf520State} from '../../sim/devices/irf520-mosfet-module';
import {PITCH} from '../layout';
import {canvasTexture,ownToon,solid} from '../materials';
import * as C from '../palette';
import {HALF_PI,MONO,leg,definePart,extState,c,pin,callout,type Inner} from './kit';

const PCB_RED=0xb8312f; // ds-allow-hex  (IRF520 module PCB, red solder mask)
const TERM=0x2f6fe0; // ds-allow-hex  (blue screw terminal)
const LED_OFF=0x4a2a2a; // ds-allow-hex  (unlit red LED)
const BW=34,BH=24,PY=5,CX=12,CY=PY+BH/2;
const TLX=CX-BW/2+4,TRX=CX+BW/2-4,TZ=10;
const TY=CY+3;   // centre of both terminal blocks
const POLE=5.08;

function label(g:Group,text:string,w:number,h:number,x:number,y:number):void{
 const cv=document.createElement('canvas');cv.width=256;cv.height=Math.round(256*h/w);
 const k=cv.getContext('2d')!;
 k.fillStyle='#f7f4ea';k.textAlign='center';k.textBaseline='middle';k.font=`600 ${Math.round(cv.height*0.7)}px ${MONO}`;k.fillText(text,128,cv.height/2); // ds-allow-hex
 const m=new Mesh(new PlaneGeometry(w,h),new MeshBasicMaterial({map:canvasTexture(cv),transparent:true,toneMapped:false,depthWrite:false}));
 m.material.userData.own=true;m.material.userData.ownMap=true;m.position.set(x,y,0.85);m.userData.noPick=true;m.userData.noInk=true;g.add(m);
}

function buildIrf(_p:PartProps,g:Group):Inner{
 for(let i=0;i<3;i++)g.add(leg(i*PITCH,PY+0.4));
 g.add(solid(new BoxGeometry(BW,BH,1.6),PCB_RED,{outline:true,edges:true,pos:[CX,CY,0]}));
 g.add(solid(new BoxGeometry(3*PITCH,2.5,2.5),C.HEADER_BLACK,{pos:[PITCH,PY+1.6,1.8],cast:false}));
 // two blue screw terminals, two poles each (5.08 mm pitch)
 for(const x of [TLX,TRX]){
  g.add(solid(new BoxGeometry(8,2*POLE,9),TERM,{outline:true,pos:[x,TY,5.3]}));
  for(let i=0;i<2;i++)g.add(solid(new CylinderGeometry(1.8,1.8,0.9,14),C.SILVER,{rot:[HALF_PI,0,0],pos:[x,TY+(i?-1:1)*POLE/2,9.8],finish:'metal'}));
 }
 // IRF520 in a TO-220: black body 10 x 9.2 x 4.5, silver tab with a 3.7 mm hole above it, three leads down to the board
 const bx=CX,by=PY+8;
 for(let i=-1;i<=1;i++)g.add(solid(new BoxGeometry(0.8,5,0.5),C.SILVER,{pos:[bx+i*2.54,PY+4.8,3.4],cast:false,finish:'metal'}));
 g.add(solid(new BoxGeometry(10,9.2,4.5),C.CHIP,{outline:true,pos:[bx,by+4.6,3.4]}));
 g.add(solid(new BoxGeometry(10,6.3,1.3),C.SILVER,{outline:true,pos:[bx,by+9.2+3.1,2.2],finish:'metal'}));
 g.add(solid(new CylinderGeometry(1.85,1.85,1.4,18),C.HOLE,{rot:[HALF_PI,0,0],pos:[bx,by+9.2+3.9,2.2],cast:false}));
 // drive LED
 const ledMat=ownToon(LED_OFF);
 const led=new Mesh(new BoxGeometry(3,2,1.2),ledMat);led.position.set(CX+9,PY+5.2,1.2);led.castShadow=true;g.add(led);
 label(g,'SIG  VCC  GND',12,2.1,PITCH,PY+4.4);
 label(g,'V+   V-',8,2.1,TLX,TY-POLE-3.6);label(g,'VIN+ VIN-',8.8,2.1,TRX,TY-POLE-3.6);
 label(g,'IRF520',8,2.4,CX,CY+10);
 return {
  apply(s){
   const st=extState<Irf520State>(s,'irf520-mosfet-module');
   if(!st)return;
   ledMat.color.setHex(st.ledOn?C.RED_ALERT:LED_OFF);ledMat.emissive.setHex(C.RED_ALERT);ledMat.emissiveIntensity=st.ledOn?0.5+1.5*st.duty:0;
  },
 };
}

export const irf520MosfetModule=definePart({
 kind:'irf520-mosfet-module',name:c('IRF520 MOSFET module','Modul MOSFET IRF520'),
 pins:{
  SIG:pin([0,0,0],'input','SIG (gate drive)','SIG (pemicu gate)'),VCC:pin([PITCH,0,0],'power','VCC (5 V, LED)','VCC (5 V, LED)'),GND:pin([2*PITCH,0,0],'ground','Ground','Ground'),
  'VIN+':pin([TRX,TY+POLE/2,TZ],'power','VIN+ (load supply)','VIN+ (catu beban)'),'VIN-':pin([TRX,TY-POLE/2,TZ],'ground','VIN- (supply ground)','VIN- (ground catu)'),
  'V+':pin([TLX,TY+POLE/2,TZ],'output','V+ (load plus)','V+ (plus beban)'),'V-':pin([TLX,TY-POLE/2,TZ],'output','V- (load minus, switched)','V- (minus beban, disakelar)'),
 },
 callouts:[
  callout('fet',[CX,PY+16,6],'IRF520: wants about 10 V on the gate, so at 5 V it runs warm','IRF520: butuh sekitar 10 V di gate, jadi pada 5 V ia menghangat'),
  callout('led',[CX+9,PY+5.2,3],'Red LED: the gate is being driven','LED merah: gate sedang dipicu'),
  callout('term',[TLX,TY,TZ+3],'Wire the load between V+ and V-','Pasang beban antara V+ dan V-'),
 ],
 make:buildIrf,
});
