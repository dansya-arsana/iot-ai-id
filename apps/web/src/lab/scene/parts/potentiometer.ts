import {BoxGeometry,CylinderGeometry,Group,Mesh} from 'three';
import {RoundedBoxGeometry} from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';
import type {PartProps} from '../../contract';
import {PITCH} from '../layout';
import {addOutline,solid} from '../materials';
import * as C from '../palette';
import {clamp01,leg,definePart,c,pin,callout,type Inner} from './kit';

function buildPot(_p:PartProps,g:Group):Inner{
 const cx=PITCH;
 g.add(solid(new RoundedBoxGeometry(13,6,13,3,0.6),C.POT_BLUE,{outline:true,pos:[cx,3.6,0]}));
 g.add(leg(0,2),leg(PITCH,2),leg(2*PITCH,2));
 g.add(solid(new CylinderGeometry(5.6,5.6,1.2,32),C.HEADER_BLACK,{pos:[cx,6.8,0],cast:false}));
 const knob=new Group();knob.position.set(cx,7.4,0);g.add(knob);
 knob.add(solid(new CylinderGeometry(5,5,5.2,32),C.KNOB,{pos:[0,2.6,0]}));
 for(let i=0;i<24;i++){
  const a=(i/24)*Math.PI*2;
  knob.add(solid(new BoxGeometry(0.7,5.0,0.9),C.KNOB,{pos:[Math.sin(a)*5.0,2.6,Math.cos(a)*5.0],rot:[0,a,0],cast:false}));
 }
 knob.add(solid(new CylinderGeometry(4.4,4.4,0.3,32),C.CREAM_DARK,{pos:[0,5.3,0],cast:false}));
 knob.add(solid(new BoxGeometry(0.9,0.4,4.2),C.WHITE,{pos:[0,5.5,-1.9],cast:false}));
 addOutline(knob.children[0] as Mesh);
 return {
  
  apply(s){
   if(s.kind!=='potentiometer')return;
   knob.rotation.y=-((clamp01(s.value/1023)*270-135)*Math.PI)/180;
  },
 };
}

export const potentiometer=definePart({kind:'potentiometer',name:c('Potentiometer','Potensiometer'),pins:{VCC:pin([0,0,0],'power','5V','5V'),SIG:pin([PITCH,0,0],'analog-out','Wiper (signal)','Wiper (sinyal)'),GND:pin([2*PITCH,0,0],'ground','Ground','Ground')},callouts:[callout('knob',[PITCH,13.5,0],'Drag the knob to turn it','Seret kenop untuk memutar')],interact:{drag:{handle:'rotate',prop:'value',range:[0,1023]}},make:buildPot});
