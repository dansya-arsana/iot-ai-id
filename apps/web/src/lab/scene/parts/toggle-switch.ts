/** TOGGLE-SWITCH (SPST): MTS-101-style miniature toggle, 6 mm threaded bushing, hex nut, chrome lever, two solder lugs. Pairs with sim/devices/toggle-switch.ts. */
import {BoxGeometry,CylinderGeometry,Group} from 'three';
import type {PartProps} from '../../contract';
import type {ToggleSwitchState} from '../../sim/devices/toggle-switch';
import {PITCH} from '../layout';
import {solid} from '../materials';
import * as C from '../palette';
import {leg,definePart,extState,c,pin,callout,type Inner} from './kit';

function buildToggle(_p:PartProps,g:Group):Inner{
 const cx=PITCH;
 g.add(leg(0,3),leg(2*PITCH,3));
 // square plastic body 8 x 8 x 5, then the threaded bushing (6 mm), then a hex nut (9 mm across, 2 mm thick)
 g.add(solid(new BoxGeometry(8,5,8),C.HEADER_BLACK,{outline:true,edges:true,pos:[cx,3+2.5,0]}));
 g.add(solid(new CylinderGeometry(3,3,5.5,24),C.SILVER,{outline:true,pos:[cx,8+2.75,0],finish:'metal'}));
 g.add(solid(new CylinderGeometry(4.5,4.5,2,6),C.SILVER_DARK,{outline:true,pos:[cx,8+4.4,0],finish:'metal'}));
 // lever pivots at the bushing top; ~35 degrees each way
 const lever=new Group();lever.position.set(cx,8+5.5,0);
 lever.add(solid(new CylinderGeometry(0.9,1.3,8.5,14),C.SILVER,{outline:true,pos:[0,4.2,0],finish:'metal'}));
 lever.add(solid(new CylinderGeometry(1.5,1.5,1.4,14),C.SILVER,{outline:true,pos:[0,8.5,0],finish:'metal'}));
 g.add(lever);
 let cur=0;
 return {
  apply(s,dt){
   const st=extState<ToggleSwitchState>(s,'toggle-switch');
   if(!st)return;
   cur+=((st.on?1:0)-cur)*Math.min(1,dt/60);
   lever.rotation.z=(0.5-cur)*1.2;   // ON = tilted up/left, OFF = down/right
  },
 };
}

export const toggleSwitch=definePart({
 kind:'toggle-switch',name:c('Toggle switch (SPST)','Saklar toggle (SPST)'),
 pins:{A:pin([0,0,0],'passive','Terminal A','Terminal A'),B:pin([2*PITCH,0,0],'passive','Terminal B','Terminal B')},
 callouts:[callout('lever',[PITCH,22,0],'Click to flip the lever','Klik untuk membalik tuas')],
 make:buildToggle,
});
