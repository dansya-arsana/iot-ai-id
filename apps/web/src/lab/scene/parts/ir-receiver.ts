/** IR receiver (VS1838B style): black epoxy body with a round lens window, three leads (OUT, GND, VCC). Pairs with sim/devices/ir-receiver.ts. */
import {BoxGeometry,Color,CylinderGeometry,Group,Mesh,MeshStandardMaterial,SphereGeometry} from 'three';
import type {PartProps} from '../../contract';
import type {IrReceiverState} from '../../sim/devices/ir-receiver';
import {PITCH} from '../layout';
import {addOutline,ownToon,solid} from '../materials';
import * as C from '../palette';
import {leg,definePart,extState,c,pin,callout,type Inner} from './kit';

const EPOXY=0x1a1b1f; // ds-allow-hex  (black IR-pass epoxy)
const WINDOW=0x3a1f24; // ds-allow-hex  (dark red-black lens window)

function buildIr(_p:PartProps,g:Group):Inner{
 const cx=PITCH,y0=7;                                  // long leads, body stands about 7 mm over the board
 for(let i=0;i<3;i++)g.add(leg(i*PITCH,y0+0.4));
 g.add(solid(new BoxGeometry(7,8,5),EPOXY,{outline:true,edges:true,pos:[cx,y0+4,0]}));
 // metal shield visible as a thin band at the base, then the round lens bump on the front face
 g.add(solid(new BoxGeometry(7.1,0.6,5.1),C.SILVER,{pos:[cx,y0+0.5,0],finish:'metal',cast:false}));
 const win=new Mesh(new SphereGeometry(2.7,28,14,0,Math.PI*2,0,Math.PI/2),ownToon(WINDOW));
 win.rotation.x=Math.PI/2;win.position.set(cx,y0+4.6,2.3);win.castShadow=true;addOutline(win);g.add(win);
 g.add(solid(new CylinderGeometry(2.9,2.9,0.5,28),EPOXY,{pos:[cx,y0+4.6,2.3],rot:[Math.PI/2,0,0],cast:false}));
 const mat=win.material as MeshStandardMaterial;
 const idle=new Color(WINDOW),live=new Color(C.LIVE);
 return {
  apply(s){
   const st=extState<IrReceiverState>(s,'ir-receiver');
   if(!st)return;
   const on=st.receiving;
   mat.color.copy(on?live:idle);
   mat.emissive.copy(live);mat.emissiveIntensity=on?0.8:0;
  },
 };
}

export const irReceiver=definePart({
 kind:'ir-receiver',name:c('IR receiver (VS1838B)','Penerima IR (VS1838B)'),
 pins:{OUT:pin([0,0,0],'output','OUT (demodulated)','OUT (terdemodulasi)'),GND:pin([PITCH,0,0],'ground','Ground','Ground'),VCC:pin([2*PITCH,0,0],'power','5V','5V')},
 callouts:[
  callout('window',[PITCH,11.6,4.5],'Infrared enters through this window','Inframerah masuk lewat jendela ini'),
  callout('out',[0,0,0],'OUT idles HIGH and pulses LOW with each burst','OUT diam di HIGH dan berdenyut LOW tiap burst'),
 ],
 make:buildIr,
});
