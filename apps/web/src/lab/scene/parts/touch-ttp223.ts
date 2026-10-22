/**
 * TOUCH-TTP223: capacitive touch module standing on the breadboard. PCB 24 x 24 mm, 3-pin header, a 12 mm ring-shaped sensing pad,
 * the 6-pin TTP223 package, an indicator LED and two jumper pads (public dimensions of this module family, modelled by us).
 * Pairs with sim/devices/touch-ttp223.ts. Press and hold the pad (a click is a momentary touch).
 */
import {BoxGeometry,Color,CylinderGeometry,Group,MeshStandardMaterial,RingGeometry} from 'three';
import type {PartProps} from '../../contract';
import type {TouchTtp223State} from '../../sim/devices/touch-ttp223';
import {ownToon,solid} from '../materials';
import * as C from '../palette';
import {PITCH,leg,definePart,extState,c,pin,callout,type Inner} from './kit';
import {labelRow} from './input-labels';

const PAD=0xc9a24a; // ds-allow-hex  (gold-finish sensing pad)

function buildTouch(_p:PartProps,g:Group):Inner{
 const cx=PITCH,W=24,H=24,y0=6,cy=y0+H/2+1;
 for(let i=0;i<3;i++)g.add(leg(i*PITCH,y0+0.4));
 g.add(solid(new BoxGeometry(3*PITCH,2.5,2.5),C.HEADER_BLACK,{outline:true,pos:[cx,y0-1.25,0.2]}));
 g.add(solid(new BoxGeometry(W,H,1.6),C.SONAR_PCB,{outline:true,edges:true,pos:[cx,y0+H/2,-0.8],own:true,finish:'pcb'}));
 const lab=labelRow(['I/O','VCC','GND'],cx,9,3,38);
 lab.position.set(cx,y0+2.4,0.05);g.add(lab);
 // sensing pad: gold disc with an inner ring cut, lights up while touched
 const padMat=ownToon(PAD,'gold');
 const disc=solid(new CylinderGeometry(5.6,5.6,0.35,40),PAD,{pos:[cx,cy+1,0.2],rot:[Math.PI/2,0,0],cast:false,own:true,finish:'gold'});
 disc.material=padMat;g.add(disc);
 g.add(solid(new RingGeometry(3.2,3.9,40),C.SONAR_PCB,{pos:[cx,cy+1,0.42],cast:false}));
 // TTP223 package, jumper pads A and B, indicator LED
 g.add(solid(new BoxGeometry(2.9,1.6,0.9),C.CHIP,{outline:true,pos:[cx+7.2,cy+7.4,0.45]}));
 for(const [i,x] of [[0,cx-8],[1,cx-5.4]] as const)g.add(solid(new BoxGeometry(1.8,2.6,0.3),C.GOLD,{pos:[x,cy+7.3,0.2+i*0],cast:false}));
 const ledMat=ownToon(C.LED_SMD_OFF);
 const led=solid(new BoxGeometry(2.2,1.2,0.8),C.LED_SMD_OFF,{pos:[cx+7.4,cy-6.8,0.4],cast:false,own:true});
 led.material=ledMat;g.add(led);
 const idleLed=new Color(C.LED_SMD_OFF),onLed=new Color(C.RED_ALERT),idlePad=new Color(PAD),touchPad=new Color(C.LIVE);
 return {
  apply(s){
   const st=extState<TouchTtp223State>(s,'touch-ttp223');
   if(!st)return;
   ledMat.color.copy(st.out?onLed:idleLed);(ledMat as MeshStandardMaterial).emissive.copy(st.out?onLed:new Color(0));(ledMat as MeshStandardMaterial).emissiveIntensity=st.out?0.9:0;
   padMat.color.copy(st.touched?touchPad:idlePad);
  },
 };
}

export const touchTtp223=definePart({
 kind:'touch-ttp223',name:c('Touch sensor (TTP223)','Sensor sentuh (TTP223)'),
 pins:{
  OUT:pin([0,0,0],'output','I/O (signal)','I/O (sinyal)'),
  VCC:pin([PITCH,0,0],'power','5V','5V'),
  GND:pin([2*PITCH,0,0],'ground','Ground','Ground'),
 },
 callouts:[
  callout('pad',[PITCH,19,2],'Press and hold the pad to touch it','Tekan dan tahan bantalan untuk menyentuhnya'),
  callout('led',[PITCH+7.4,12,2],'This LED mirrors the output','LED ini mengikuti keluaran'),
 ],
 interact:{drag:{handle:'press',cursor:{hover:'pointer',active:'pointer'}}},
 make:buildTouch,
});
