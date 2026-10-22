/**
 * VIBRATION-MOTOR: a coin (pancake) motor, 10 mm across and 2.7 mm thick, lying on the desk with two 25 mm flying leads (red +, blue -).
 * It shakes with the simulated rpm: the picture is slowed down and exaggerated so the eye can follow it. Pairs with sim/devices/vibration-motor.ts.
 */
import {BoxGeometry,CylinderGeometry,Group} from 'three';
import type {PartProps} from '../../contract';
import type {VibrationMotorState} from '../../sim/devices/vibration-motor';
import {solid} from '../materials';
import * as C from '../palette';
import {definePart,extState,c,pin,callout,type Inner} from './kit';

const LEAD_Z=26;

function buildCoin(_p:PartProps,g:Group):Inner{
 // the body shakes, the leads stay put (they leave the disc edge toward the viewer)
 const body=new Group();g.add(body);
 body.add(solid(new CylinderGeometry(5,5,2.7,32),C.MOTOR_CAN,{outline:true,pos:[0,1.35,0],finish:'metal'}));
 // adhesive pad and the label ring
 body.add(solid(new CylinderGeometry(5.05,5.05,0.5,32),C.CREAM_DARK,{pos:[0,0.25,0],cast:false}));
 body.add(solid(new CylinderGeometry(3.4,3.4,0.2,28),C.MOTOR_CAP,{pos:[0,2.8,0],cast:false}));
 // a tick mark that turns with the shaft
 const tick=new Group();body.add(tick);
 tick.add(solid(new BoxGeometry(0.7,0.2,3.2),C.WHITE,{pos:[0,2.95,-1.6],cast:false}));
 // the two leads from the edge to the wire ends
 const wireCol=[C.WIRE_COLOR.red,C.WIRE_COLOR.blue];
 [-1.5,1.5].forEach((x,i)=>{
  const len=LEAD_Z-4.6;
  g.add(solid(new BoxGeometry(0.9,0.9,len),wireCol[i]!,{pos:[x,0.6,4.6+len/2],cast:false}));
  g.add(solid(new BoxGeometry(1.2,0.5,1.6),C.GOLD,{pos:[x,0.55,LEAD_Z],cast:false,finish:'gold'}));
 });
 let t=0,ang=0;
 return {
  apply(s,dt){
   const st=extState<VibrationMotorState>(s,'vibration-motor');
   if(!st)return;
   t+=dt;
   // visual spin: 1 turn per second at the rated speed, clipped so the frame rate can show it
   ang+=dt/1000*Math.PI*2*Math.max(-2,Math.min(2,st.rpm/12000));
   tick.rotation.y=ang;
   const amp=Math.min(0.45,st.shake*0.3);
   body.position.x=amp*Math.sin(t*0.09);body.position.z=amp*Math.cos(t*0.11);
  },
 };
}

export const vibrationMotor=definePart({
 kind:'vibration-motor',name:c('Coin vibration motor','Motor getar koin'),
 pins:{'+':pin([-1.5,0.7,LEAD_Z],'power','Plus (red)','Plus (merah)'),'-':pin([1.5,0.7,LEAD_Z],'ground','Minus (blue)','Minus (biru)')},
 callouts:[callout('disc',[0,6,0],'An off-centre weight shakes the disc','Beban tidak di tengah menggetarkan cakram'),callout('leads',[0,4,LEAD_Z],'Use a driver, not a pin','Pakai driver, bukan pin')],
 deskMm:[12,32],
 make:buildCoin,
});
