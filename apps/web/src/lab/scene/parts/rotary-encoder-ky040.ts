/**
 * ROTARY-ENCODER-KY040: encoder module standing on the breadboard. PCB 30 x 19 mm with a 5-pin header, an EC11-class encoder
 * (12 x 12 x 6.5 mm case, 7 mm threaded bushing, 6 mm D-shaft) and a 17 mm knurled knob (public dimensions, modelled by us).
 * Pairs with sim/devices/rotary-encoder-ky040.ts. Click the knob = push SW, drag round it = turn; the knob angle follows the simulated shaft.
 */
import {BoxGeometry,CylinderGeometry,Group} from 'three';
import type {PartProps} from '../../contract';
import type {RotaryEncoderKy040State} from '../../sim/devices/rotary-encoder-ky040';
import {solid} from '../materials';
import * as C from '../palette';
import {PITCH,leg,definePart,extState,c,pin,callout,type Inner} from './kit';
import {labelRow} from './input-labels';

function buildEncoder(_p:PartProps,g:Group):Inner{
 const cx=2*PITCH,W=30,H=19,y0=6,cy=y0+H/2+1;
 for(let i=0;i<5;i++)g.add(leg(i*PITCH,y0+0.4));
 g.add(solid(new BoxGeometry(5*PITCH,2.5,2.5),C.HEADER_BLACK,{outline:true,pos:[cx,y0-1.25,0.2]}));
 g.add(solid(new BoxGeometry(W,H,1.6),C.PCB_DARK,{outline:true,edges:true,pos:[cx,y0+H/2,-0.8],own:true,finish:'pcb'}));
 const lab=labelRow(['CLK','DT','SW','+','GND'],cx,16,3.6,38);
 lab.position.set(cx,y0+2.6,0.05);g.add(lab);
 // three 10k pull-up resistors would sit here; a small SMD row suggests them
 for(let i=0;i<3;i++)g.add(solid(new BoxGeometry(2.2,1.2,0.6),C.CHIP,{pos:[cx-5+i*3.4,y0+5.6,0.3],cast:false}));
 // encoder body, bushing, shaft
 g.add(solid(new BoxGeometry(12,12,6.5),C.SILVER,{outline:true,edges:true,pos:[cx,cy+1.5,3.25],finish:'metal'}));
 g.add(solid(new CylinderGeometry(3.5,3.5,6,24),C.SILVER_DARK,{outline:true,pos:[cx,cy+1.5,9.5],rot:[Math.PI/2,0,0],finish:'metal'}));
 const turn=new Group();turn.position.set(cx,cy+1.5,0);g.add(turn);
 const push=new Group();turn.add(push);
 push.userData.grab={type:'knob',key:'position',min:0,max:60,perTurn:20};   // drag around the knob to turn it; a click pushes it
 push.add(solid(new CylinderGeometry(3,3,11,20),C.SILVER,{pos:[0,0,12.5],rot:[Math.PI/2,0,0],finish:'metal'}));
 // knob: 17 mm, knurled, with a pointer notch
 push.add(solid(new CylinderGeometry(8.5,8.5,11,40),C.KNOB,{outline:true,pos:[0,0,19],rot:[Math.PI/2,0,0]}));
 for(let i=0;i<30;i++){
  const a=(i/30)*Math.PI*2;
  push.add(solid(new BoxGeometry(0.7,0.9,9.6),C.CREAM_DARK,{pos:[Math.sin(a)*8.5,Math.cos(a)*8.5,19],rot:[0,0,-a],cast:false}));
 }
 push.add(solid(new CylinderGeometry(6.6,6.6,0.4,32),C.CREAM_DARK,{pos:[0,0,24.6],rot:[Math.PI/2,0,0],cast:false}));
 push.add(solid(new BoxGeometry(1.2,5,0.5),C.HEADER_BLACK,{pos:[0,3.3,24.9],cast:false}));
 return {
  apply(s,dt){
   const st=extState<RotaryEncoderKy040State>(s,'rotary-encoder-ky040');
   if(!st)return;
   turn.rotation.z=-st.angle*Math.PI/180;
   push.position.z+=((st.pressed?-1.5:0)-push.position.z)*Math.min(1,dt/35||1);
  },
 };
}

export const rotaryEncoderKy040=definePart({
 kind:'rotary-encoder-ky040',name:c('Rotary encoder (KY-040)','Rotary encoder (KY-040)'),
 pins:{
  CLK:pin([0,0,0],'output','CLK (channel A)','CLK (kanal A)'),
  DT:pin([PITCH,0,0],'output','DT (channel B)','DT (kanal B)'),
  SW:pin([2*PITCH,0,0],'output','Push switch (LOW when pushed)','Saklar tekan (LOW saat ditekan)'),
  '+':pin([3*PITCH,0,0],'power','5V','5V'),
  GND:pin([4*PITCH,0,0],'ground','Ground','Ground'),
 },
 callouts:[
  callout('knob',[2*PITCH,15,24],'Click the knob to push it, drag around it to turn it','Klik kenop untuk menekannya, seret mengelilinginya untuk memutar'),
  callout('pulls',[2*PITCH,12,1],'10 k pull-ups hold CLK and DT HIGH at rest','Pull-up 10 k menahan CLK dan DT di HIGH saat diam'),
 ],
 make:buildEncoder,
});
