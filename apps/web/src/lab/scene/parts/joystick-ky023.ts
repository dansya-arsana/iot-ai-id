/**
 * JOYSTICK-KY023: thumb joystick module standing on the breadboard. PCB 26 x 34 mm, 5-pin header on the short edge, a 16 x 16 mm
 * mini-joystick housing with a 18 mm dished mushroom cap on a shaft that tilts about +-23 degrees (public dimensions of this module family,
 * modelled by us). Pairs with sim/devices/joystick-ky023.ts. Click the cap = press SW, drag it = tilt X and Y (springs back); the panel sets X and Y too.
 */
import {BoxGeometry,CylinderGeometry,Group,TorusGeometry} from 'three';
import type {PartProps} from '../../contract';
import type {JoystickKy023State} from '../../sim/devices/joystick-ky023';
import {solid} from '../materials';
import * as C from '../palette';
import {PITCH,leg,definePart,extState,c,pin,callout,type Inner} from './kit';
import {labelRow} from './input-labels';

const TILT=0.4; // rad at full deflection

function buildJoystick(_p:PartProps,g:Group):Inner{
 const cx=2*PITCH,W=26,H=34,y0=6,cy=y0+H/2+2;
 for(let i=0;i<5;i++)g.add(leg(i*PITCH,y0+0.4));
 g.add(solid(new BoxGeometry(5*PITCH,2.5,2.5),C.HEADER_BLACK,{outline:true,pos:[cx,y0-1.25,0.2]}));
 g.add(solid(new BoxGeometry(W,H,1.6),C.PCB,{outline:true,edges:true,pos:[cx,y0+H/2,-0.8],own:true,finish:'pcb'}));
 const lab=labelRow(['GND','+5V','VRx','VRy','SW'],cx,16,3.6,38);
 lab.position.set(cx,y0+2.6,0.05);g.add(lab);
 // joystick housing and collar
 g.add(solid(new BoxGeometry(16,16,5.4),C.HEADER_BLACK,{outline:true,edges:true,pos:[cx,cy,2.7]}));
 g.add(solid(new CylinderGeometry(6.6,6.6,1.4,28),C.HEADER_TOP,{pos:[cx,cy,6.1],rot:[Math.PI/2,0,0],cast:false}));
 // tilting stick: pivot sits at the collar
 const piv=new Group();piv.position.set(cx,cy,6.6);g.add(piv);
 const stick=new Group();piv.add(stick);
 stick.userData.grab={type:'stick',x:'x',y:'y',max:1023,travelPx:44};   // drag to tilt (springs back on release); a click presses the switch
 stick.add(solid(new CylinderGeometry(2.1,2.1,6.5,18),C.SILVER_DARK,{pos:[0,0,3.2],rot:[Math.PI/2,0,0],finish:'metal'}));
 stick.add(solid(new CylinderGeometry(8.8,5.4,3.6,36),C.CHIP,{outline:true,pos:[0,0,7.6],rot:[Math.PI/2,0,0]}));
 const dish=solid(new TorusGeometry(8.1,0.7,10,40),C.HEADER_TOP,{pos:[0,0,9.3],cast:false});
 stick.add(dish);
 stick.add(solid(new CylinderGeometry(7.4,7.4,0.4,36),C.HEADER_BLACK,{pos:[0,0,9.1],rot:[Math.PI/2,0,0],cast:false}));
 const pcbText=labelRow(['KY-023'],0,14,3.2,60);pcbText.position.set(cx+1,y0+H-3.6,0.05);g.add(pcbText);
 return {
  apply(s,dt){
   const st=extState<JoystickKy023State>(s,'joystick-ky023');
   if(!st)return;
   const k=Math.min(1,dt/60||1);
   const tx=(st.x-512)/512,ty=(st.y-512)/512;
   stick.rotation.y+=(tx*TILT-stick.rotation.y)*k;
   stick.rotation.x+=(ty*TILT-stick.rotation.x)*k;
   const z=st.pressed?-1.6:0;
   stick.position.z+=(z-stick.position.z)*Math.min(1,dt/35||1);
  },
 };
}

export const joystickKy023=definePart({
 kind:'joystick-ky023',name:c('Joystick module (KY-023)','Modul joystick (KY-023)'),
 pins:{
  GND:pin([0,0,0],'ground','Ground','Ground'),
  '+5V':pin([PITCH,0,0],'power','5V','5V'),
  VRx:pin([2*PITCH,0,0],'analog-out','X axis (analog)','Sumbu X (analog)'),
  VRy:pin([3*PITCH,0,0],'analog-out','Y axis (analog)','Sumbu Y (analog)'),
  SW:pin([4*PITCH,0,0],'output','Push switch (LOW when pressed)','Saklar tekan (LOW saat ditekan)'),
 },
 callouts:[
  callout('stick',[2*PITCH,28,10],'Click the stick to press the switch, drag it to tilt','Klik stick untuk menekan saklar, seret untuk memiringkan'),
  callout('axes',[2*PITCH,10,1],'Two potentiometers: X and Y read as voltages','Dua potensiometer: X dan Y terbaca sebagai tegangan'),
 ],
 make:buildJoystick,
});
