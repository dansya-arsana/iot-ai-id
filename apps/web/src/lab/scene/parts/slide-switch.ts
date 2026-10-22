/** SLIDE-SWITCH (SPDT): SS12D00-style slider, a tinned steel can about 8.6 x 3.6 x 3.5 mm with a black plastic lever. Pairs with sim/devices/slide-switch.ts. */
import {BoxGeometry,Group} from 'three';
import type {PartProps} from '../../contract';
import type {SlideSwitchState} from '../../sim/devices/slide-switch';
import {PITCH} from '../layout';
import {solid} from '../materials';
import * as C from '../palette';
import {leg,definePart,extState,c,pin,callout,type Inner} from './kit';

function buildSlideSwitch(_p:PartProps,g:Group):Inner{
 const cx=PITCH;
 for(let i=0;i<3;i++)g.add(leg(i*PITCH,2.6));
 g.add(solid(new BoxGeometry(8.6,3.5,3.6),C.SILVER,{outline:true,edges:true,pos:[cx,2.6+1.75,0],finish:'metal'}));
 // dark slot the lever travels in
 g.add(solid(new BoxGeometry(5.2,0.3,1.3),C.HOLE,{cast:false,pos:[cx,2.6+3.55,0]}));
 const lever=solid(new BoxGeometry(1.8,3.2,1.1),C.HEADER_BLACK,{outline:true,pos:[cx-PITCH/2,2.6+3.5+1.6,0]});
 g.add(lever);
 let cur=0;
 return {
  apply(s,dt){
   const st=extState<SlideSwitchState>(s,'slide-switch');
   if(!st)return;
   cur+=((st.toB?1:0)-cur)*Math.min(1,dt/45);
   lever.position.x=cx+(cur-0.5)*PITCH;
  },
 };
}

export const slideSwitch=definePart({
 kind:'slide-switch',name:c('Slide switch (SPDT)','Saklar geser (SPDT)'),
 pins:{A:pin([0,0,0],'passive','Throw A','Posisi A'),COM:pin([PITCH,0,0],'passive','COM (common)','COM (bersama)'),B:pin([2*PITCH,0,0],'passive','Throw B','Posisi B')},
 callouts:[callout('lever',[PITCH,10,0],'Click to slide the lever to the other side','Klik untuk menggeser tuas ke sisi lain')],
 make:buildSlideSwitch,
});
