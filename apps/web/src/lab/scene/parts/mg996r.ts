/**
 * MG996R: the 40.7 x 19.7 mm hobby servo, 36.5 mm to the top of the case and 42.9 mm to the top of the spline, mounting flange 53.9 mm
 * across. Black case, a gold-coloured metal-gear bushing around the output, a white single-arm horn and a three-wire cable ending in a
 * black three-pin plug (shortened for the desk). Same horn motion as the SG90 part. Pairs with sim/devices/mg996r.ts.
 */
import {BoxGeometry,CylinderGeometry,Group} from 'three';
import {RoundedBoxGeometry} from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';
import type {PartProps} from '../../contract';
import type {Mg996rState} from '../../sim/devices/mg996r';
import {solid} from '../materials';
import * as C from '../palette';
import {definePart,extState,c,pin,callout,type Inner} from './kit';

const CASE=0x24262b; // ds-allow-hex  (MG996R: black plastic case)
const BROWN=0x6b4a2e; // ds-allow-hex  (servo cable ground wire)
const L=40.7,W=19.7,FLANGE_Y=26.5,TOP_Y=36.5,SPLINE_Y=42.9;
const OUT_X=10.2;   // output axis from the case centre
const PIN_X=-52;
const pinAt=(k:number):[number,number,number]=>[PIN_X,5,(k-1)*2.54];

function buildMg(_p:PartProps,g:Group):Inner{
 g.add(solid(new RoundedBoxGeometry(L,FLANGE_Y,W,2,0.8),CASE,{outline:true,pos:[0,FLANGE_Y/2,0]}));
 g.add(solid(new BoxGeometry(53.9,2.6,W),CASE,{outline:true,edges:true,pos:[0,FLANGE_Y+1.3,0]}));
 for(const sx of [-1,1])for(const sz of [-1,1])g.add(solid(new CylinderGeometry(2.1,2.1,2.8,14),C.HOLE,{pos:[sx*25.4,FLANGE_Y+1.3,sz*7.2],cast:false}));
 g.add(solid(new RoundedBoxGeometry(L,TOP_Y-FLANGE_Y-2.6,W,2,0.8),CASE,{outline:true,pos:[0,(TOP_Y+FLANGE_Y+2.6)/2,0]}));
 // gear-case bumps: the large one carries the output
 g.add(solid(new CylinderGeometry(7.2,7.2,3.4,28),CASE,{outline:true,pos:[OUT_X,TOP_Y+1.7,0]}));
 g.add(solid(new CylinderGeometry(5.2,5.2,1.6,24),C.GOLD,{pos:[OUT_X,TOP_Y+3.4,0],finish:'gold'}));
 g.add(solid(new CylinderGeometry(3,3,SPLINE_Y-TOP_Y-3,20),C.SILVER,{pos:[OUT_X,TOP_Y+3.4+(SPLINE_Y-TOP_Y-3)/2,0],finish:'metal'}));
 g.add(solid(new CylinderGeometry(3.8,3.8,2.4,24),CASE,{pos:[OUT_X-10.5,TOP_Y+1.2,0],cast:false}));
 // label plate (no logo): plain lighter panel on the side
 g.add(solid(new BoxGeometry(24,10,0.3),C.CREAM_DARK,{pos:[-5,16,W/2+0.05],cast:false}));
 const horn=new Group();horn.position.set(OUT_X,SPLINE_Y-0.6,0);g.add(horn);
 horn.add(solid(new CylinderGeometry(4,4,1.6,24),C.SERVO_HORN,{outline:true}));
 horn.add(solid(new BoxGeometry(34,1.4,6.4),C.SERVO_HORN,{outline:true,pos:[12,0,0]}));
 horn.add(solid(new CylinderGeometry(3.2,3.2,1.4,18),C.SERVO_HORN,{pos:[29,0,0]}));
 horn.add(solid(new CylinderGeometry(0.9,0.9,1.5,10),C.HOLE,{pos:[29,0,0],cast:false}));
 // cable out of the left end, then a black three-pin plug
 const wires=[0xd9803f,C.RED_ALERT,BROWN]; // ds-allow-hex  (signal orange)
 for(let k=0;k<3;k++)g.add(solid(new BoxGeometry(PIN_X+L/2+8,1.1,1.1),wires[k]!,{pos:[(PIN_X+L/2+8)/2-L/2,5,(k-1)*2.54],cast:false}));
 g.add(solid(new BoxGeometry(10,3.4,9),C.HEADER_BLACK,{outline:true,pos:[PIN_X+5,5,0]}));
 for(let k=0;k<3;k++)g.add(solid(new BoxGeometry(1.4,0.64,0.64),C.GOLD,{pos:[PIN_X-0.4,5,(k-1)*2.54],cast:false,finish:'gold'}));
 let cur:number|null=null;
 return {
  apply(s,dt){
   const st=extState<Mg996rState>(s,'mg996r');
   if(!st)return;
   // the sim already moves the angle at the real speed; just smooth the frame step
   if(cur===null)cur=st.angleDeg;else cur+=(st.angleDeg-cur)*Math.min(1,dt/1000*30);
   horn.rotation.y=(cur*Math.PI)/180;
  },
 };
}

export const mg996r=definePart({
 kind:'mg996r',name:c('MG996R metal-gear servo','Servo gigi logam MG996R'),
 pins:{
  SIG:pin(pinAt(0),'input','Signal (orange)','Sinyal (oranye)'),V:pin(pinAt(1),'power','V (4.8-7.2 V, red)','V (4,8-7,2 V, merah)'),GND:pin(pinAt(2),'ground','Ground (brown)','Ground (cokelat)'),
 },
 deskMm:[85,22],
 callouts:[
  callout('horn',[OUT_X,SPLINE_Y+3,0],'The horn goes to the angle of the pulse, at about 0.14 s per 60 degrees','Lengan menuju sudut sesuai pulsa, sekitar 0,14 detik per 60 derajat'),
  callout('gear',[OUT_X,TOP_Y+5,7],'Metal gears inside: about 10 kg.cm of torque','Gigi logam di dalam: torsi sekitar 10 kg.cm'),
 ],
 make:buildMg,
});
