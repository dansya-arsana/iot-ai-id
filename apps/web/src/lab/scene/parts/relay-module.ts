/** RELAY-MODULE: blue 1-channel board (about 50 x 26 mm) with a 19 x 15 x 15 mm cube relay, status LED and a COM/NO/NC screw block. Pairs with sim/devices/relay-module.ts. */
import {BoxGeometry,CylinderGeometry,Group,Mesh,MeshBasicMaterial,PlaneGeometry} from 'three';
import type {PartProps} from '../../contract';
import type {RelayState} from '../../sim/devices/relay-module';
import {PITCH} from '../layout';
import {canvasTexture,ownToon,solid} from '../materials';
import * as C from '../palette';
import {HALF_PI,MONO,leg,definePart,extState,c,pin,callout,sprite,type Inner} from './kit';
import {glowTexture} from '../materials';

const RELAY_BLUE=0x2a62c9; // ds-allow-hex  (cube relay shell)
const BOARD=0x1d6b4a; // ds-allow-hex  (green-teal module PCB)
const TERM=0x2f6fe0; // ds-allow-hex  (blue screw terminal)

function printTex(text:string,w:number,h:number,px:number):ReturnType<typeof canvasTexture>{
 const cv=document.createElement('canvas');cv.width=w;cv.height=h;
 const g=cv.getContext('2d')!;
 g.fillStyle='#f7f4ea';g.textAlign='center';g.textBaseline='middle';
 g.font=`600 ${px}px ${MONO}`;g.fillText(text,w/2,h/2);
 return canvasTexture(cv);
}
function label(g:Group,text:string,w:number,h:number,x:number,y:number,z:number,col=false):void{
 const m=new Mesh(new PlaneGeometry(w,h),new MeshBasicMaterial({map:printTex(text,256,64,col?44:40),transparent:true,toneMapped:false,depthWrite:false}));
 m.material.userData.own=true;m.material.userData.ownMap=true;m.position.set(x,y,z);m.userData.noPick=true;m.userData.noInk=true;g.add(m);
}

function buildRelay(_p:PartProps,g:Group):Inner{
 const bw=50,bh=26,py=6; // board stands upright on the three legs, like the sonar
 const cx=14,cy=py+bh/2;
 for(let i=0;i<3;i++)g.add(leg(i*PITCH,py+0.4));
 // input header: three black pin housings on the lower edge, where the jumpers plug in
 g.add(solid(new BoxGeometry(3*PITCH,2.6,3.2),C.HEADER_BLACK,{pos:[PITCH,py+1.3,0],cast:false}));
 g.add(solid(new BoxGeometry(bw,bh,1.6),BOARD,{outline:true,edges:true,pos:[cx,cy,0]}));
 // cube relay
 g.add(solid(new BoxGeometry(19,15,15.5),RELAY_BLUE,{outline:true,edges:true,pos:[cx+3,cy+1.5,8.6]}));
 label(g,'SRD-05VDC',17,4.2,cx+3,cy+4,16.4);
 label(g,'10A 250VAC',17,4.2,cx+3,cy-1,16.4);
 // armature (visible through the cutaway on the top of the relay): a bar that tips with the coil
 const arm=new Group();arm.position.set(cx+3,cy+9.1,8.6);g.add(arm);
 arm.add(solid(new BoxGeometry(14,0.8,1.6),C.SILVER,{pos:[0,0,0],cast:false,finish:'metal'}));
 arm.add(solid(new BoxGeometry(2.2,2.2,2.2),C.GOLD,{pos:[7,-1,0],cast:false,finish:'gold'}));
 // screw block: three terminals along the left edge (NC, COM, NO)
 const tx=cx-bw/2+4.4;
 for(let i=0;i<3;i++){
  const y=cy-8+i*8;
  g.add(solid(new BoxGeometry(8.6,7.2,8),TERM,{outline:true,pos:[tx,y,4.8]}));
  g.add(solid(new CylinderGeometry(2,2,0.9,16),C.SILVER,{rot:[HALF_PI,0,0],pos:[tx,y,9.2],finish:'metal'}));
  g.add(solid(new BoxGeometry(2.8,0.5,0.6),C.SILVER_DARK,{pos:[tx,y,9.8],cast:false}));
 }
 label(g,'NC',5,2.2,tx+7.5,cy-8,1,true);label(g,'COM',6,2.2,tx+7.5,cy,1,true);label(g,'NO',5,2.2,tx+7.5,cy+8,1,true);
 // opto, transistor and the status LED
 g.add(solid(new BoxGeometry(6,3.6,2),C.CHIP,{pos:[cx-6,cy-7,1.8],cast:false}));
 g.add(solid(new BoxGeometry(3,1.8,1.6),C.CHIP,{pos:[cx-10,cy+5,1.6],cast:false}));
 const ledMat=ownToon(0x5a1f1c); // ds-allow-hex  (unlit red LED)
 const led=new Mesh(new BoxGeometry(2.4,1.8,1.4),ledMat);led.position.set(cx+19,cy-9,1.5);g.add(led);
 const halo=sprite(glowTexture(),C.RED_ALERT,14,cy-9,cx+19,false);halo.position.z=2.4;g.add(halo);
 label(g,'IN  GND  VCC',14,2.2,cx-9,py+3,0.9);
 let a=0;
 return {
  apply(s,dt){
   const st=extState<RelayState>(s,'relay-module');
   if(!st)return;
   const k=Math.min(1,dt/40);a+=((st.energized?1:0)-a)*k;
   arm.rotation.z=-a*0.14;arm.position.y=cy+9.1-a*0.4;
   ledMat.color.setHex(st.ledOn?C.RED_ALERT:0x5a1f1c); // ds-allow-hex
   ledMat.emissive.setHex(C.RED_ALERT);ledMat.emissiveIntensity=st.ledOn?2.4:0;
   halo.material.opacity=st.ledOn?0.8:0;
  },
 };
}

export const relayModule=definePart({
 kind:'relay-module',name:c('Relay module (1 channel, 5 V)','Modul relay (1 kanal, 5 V)'),
 pins:{VCC:pin([0,0,0],'power','VCC (5V)','VCC (5V)'),GND:pin([PITCH,0,0],'ground','Ground','Ground'),IN:pin([2*PITCH,0,0],'input','IN (active low)','IN (aktif low)')},
 callouts:[
  callout('relay',[17,24,16],'The relay clicks when IN goes low','Relay berbunyi klik saat IN menjadi low'),
  callout('terminals',[-6,18,10],'NC / COM / NO: the switched side','NC / COM / NO: sisi yang disaklar'),
 ],
 make:buildRelay,
});
