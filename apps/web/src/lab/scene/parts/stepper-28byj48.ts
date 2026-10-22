/**
 * STEPPER-28BYJ-48: 28 mm silver can, 19 mm tall, with a 5 mm double-D output shaft 8 mm off the centre, two mounting ears 35 mm apart
 * and a side box with the five-wire cable (blue, pink, yellow, orange, red) ending in a white five-pin plug. The cable is shortened for the desk.
 * The slim pointer on the shaft is a teaching aid (not in the box) so the angle can be read. Pairs with sim/devices/stepper-28byj48.ts.
 */
import {BoxGeometry,CylinderGeometry,Group} from 'three';
import type {PartProps} from '../../contract';
import type {StepperState} from '../../sim/devices/stepper-28byj48';
import {solid} from '../materials';
import * as C from '../palette';
import {definePart,extState,c,pin,callout,type Inner} from './kit';

const WIRE=[0x2f63c8,0xe58fb0,0xe6c935,0xe8832a,0xd23a30]; // ds-allow-hex  (28BYJ-48 cable: blue, pink, yellow, orange, red)
const CAN_R=14,CAN_H=19,SHAFT_X=8;
const CABLE_Z0=21,CABLE_Z1=64;   // from the side box to the plug
const PLUG_Z=CABLE_Z1+12;
const PIN_Y=3.4;
/** A plug seated in a ULN2003 socket sits above the desk (the socket is on a standing board): the cable climbs to it. */
const SEAT_LIFT=28.1;
const pinAt=(k:number):[number,number,number]=>[(2-k)*2.54,PIN_Y,PLUG_Z];

function buildStepper(_p:PartProps,g:Group):Inner{
 const lift=typeof _p.target==='string'?SEAT_LIFT:0;
 // metal can with a thin darker lip at the top
 g.add(solid(new CylinderGeometry(CAN_R,CAN_R,CAN_H,48),C.SILVER,{outline:true,pos:[0,CAN_H/2,0],finish:'metal'}));
 g.add(solid(new CylinderGeometry(CAN_R+0.15,CAN_R+0.15,1.2,48),C.SILVER_DARK,{pos:[0,CAN_H-0.6,0],finish:'metal',cast:false}));
 // mounting ears, 35 mm between the centres, 4.2 mm holes
 for(const sx of [-1,1]){
  g.add(solid(new BoxGeometry(8,0.8,7),C.SILVER_DARK,{outline:true,pos:[sx*17.5,CAN_H-0.4,0],finish:'metal'}));
  g.add(solid(new CylinderGeometry(2.1,2.1,0.9,16),C.HOLE,{pos:[sx*17.5,CAN_H-0.4,0],cast:false}));
 }
 // gear plate on the bottom side box
 g.add(solid(new BoxGeometry(17,15.5,9),C.SILVER,{outline:true,pos:[0,7.75,CAN_R+3.6],finish:'metal'}));
 g.add(solid(new BoxGeometry(14,10,0.4),C.SILVER_DARK,{pos:[0,8,CAN_R+8.2],cast:false,finish:'metal'}));
 // boss and double-D shaft
 g.add(solid(new CylinderGeometry(4.5,4.5,1.5,24),C.SILVER_DARK,{pos:[SHAFT_X,CAN_H+0.75,0],finish:'metal'}));
 const shaft=new Group();shaft.position.set(SHAFT_X,CAN_H+1.5,0);g.add(shaft);
 shaft.add(solid(new CylinderGeometry(2.5,2.5,6,24),C.SILVER,{outline:true,pos:[0,3,0],finish:'metal'}));
 for(const sx of [-1,1])shaft.add(solid(new BoxGeometry(0.5,6.05,3),C.SILVER_DARK,{pos:[sx*1.55,3,0],cast:false}));
 // pointer: a teaching aid on top of the shaft
 shaft.add(solid(new BoxGeometry(15,0.9,2.6),C.WHITE,{outline:true,pos:[6,6.45,0]}));
 shaft.add(solid(new BoxGeometry(2.6,0.95,2.8),C.RED_ALERT,{pos:[12.8,6.45,0],cast:false}));
 // cable: five flat wires from the box to the plug, then the plug itself
 const dz=CABLE_Z1-CABLE_Z0,len=Math.hypot(dz,lift),tilt=Math.atan2(lift,dz);
 for(let k=0;k<5;k++){
  const w=solid(new BoxGeometry(1.25,1.25,len),WIRE[k]!,{pos:[(2-k)*1.35,1.3+lift/2,(CABLE_Z0+CABLE_Z1)/2],cast:false});
  w.rotation.x=-tilt;g.add(w);
 }
 g.add(solid(new BoxGeometry(15.2,6.8,12),C.CREAM,{outline:true,pos:[0,3.4+lift,CABLE_Z1+6]}));
 for(let k=0;k<5;k++)g.add(solid(new BoxGeometry(0.64,0.64,1.2),C.GOLD,{pos:[(2-k)*2.54,PIN_Y+lift,PLUG_Z-0.5],cast:false,finish:'gold'}));
 return {
  apply(s){
   const st=extState<StepperState>(s,'stepper-28byj48');
   if(!st)return;
   shaft.rotation.y=-st.angleDeg*Math.PI/180;
  },
 };
}

export const stepper28byj48=definePart({
 kind:'stepper-28byj48',name:c('28BYJ-48 stepper','Stepper 28BYJ-48'),
 pins:{
  BLU:pin(pinAt(0),'output','Blue (coil 1)','Biru (kumparan 1)'),PNK:pin(pinAt(1),'output','Pink (coil 2)','Merah muda (kumparan 2)'),
  YEL:pin(pinAt(2),'output','Yellow (coil 3)','Kuning (kumparan 3)'),ORG:pin(pinAt(3),'output','Orange (coil 4)','Oranye (kumparan 4)'),
  RED:pin(pinAt(4),'power','Red (common +5 V)','Merah (common +5 V)'),
 },
 deskMm:[42,80],
 callouts:[
  callout('shaft',[SHAFT_X,CAN_H+8,0],'The shaft turns a tiny step each time the coil pattern moves on','Poros berputar selangkah kecil tiap pola kumparan bergeser'),
  callout('plug',[0,9,PLUG_Z],'Five wires: four coil ends and the red common','Lima kabel: empat ujung kumparan dan common merah'),
 ],
 make:buildStepper,
});
