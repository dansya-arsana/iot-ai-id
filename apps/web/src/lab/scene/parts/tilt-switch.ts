/** TILT-SWITCH (SW-520D): small blue module board with a metal can that tips when tilted. Pairs with sim/devices/tilt-switch.ts. */
import {BoxGeometry,CylinderGeometry,Group} from 'three';
import type {PartProps} from '../../contract';
import type {TiltSwitchState} from '../../sim/devices/tilt-switch';
import {PITCH} from '../layout';
import {solid} from '../materials';
import * as C from '../palette';
import {leg,definePart,extState,c,pin,callout,type Inner} from './kit';

function buildTiltSwitch(_p:PartProps,g:Group):Inner{
 for(let i=0;i<3;i++)g.add(leg(i*PITCH,3));
 g.add(solid(new BoxGeometry(3*PITCH+2,1.2,8),C.HEADER_BLACK,{outline:true,pos:[PITCH,3.6,0]}));
 const tip=new Group();
 tip.position.set(PITCH,4.2,0);
 tip.add(solid(new CylinderGeometry(1.8,1.8,7,20),C.SILVER,{outline:true,pos:[0,3.5,0],finish:'metal'}));
 g.add(tip);
 let cur=0;
 return {
  apply(s,dt){
   const st=extState<TiltSwitchState>(s,'tilt-switch');
   if(!st)return;
   cur+=((st.tilted?1:0)-cur)*Math.min(1,dt/80);
   tip.rotation.z=-cur*0.9;
  },
 };
}

export const tiltSwitch=definePart({
 kind:'tilt-switch',name:c('Tilt switch (SW-520D)','Saklar miring (SW-520D)'),
 pins:{VCC:pin([0,0,0],'power','5V','5V'),SIG:pin([PITCH,0,0],'input','SIG','SIG'),GND:pin([2*PITCH,0,0],'ground','Ground','Ground')},
 callouts:[callout('can',[PITCH,11,0],'Click to tilt it','Klik untuk memiringkan')],
 make:buildTiltSwitch,
});
