/**
 * FC-51 IR obstacle module: 31 x 14 mm blue board, 3-pin header (OUT, GND, VCC), a clear IR LED and a dark photodiode (5 mm)
 * side by side at the far end pointing along the board, a trimmer, an LM393 and two LEDs. A faint beam shows while it sees something.
 * Pairs with sim/devices/ir-obstacle-fc51.ts.
 */
import {BoxGeometry,CanvasTexture,Color,ConeGeometry,CylinderGeometry,Group,Mesh,MeshBasicMaterial,MeshStandardMaterial,PlaneGeometry,SphereGeometry} from 'three';
import type {PartProps} from '../../contract';
import type {IrObstacleFc51State} from '../../sim/devices/ir-obstacle-fc51';
import {PITCH} from '../layout';
import {canvasTexture,ownToon,solid} from '../materials';
import * as C from '../palette';
import {leg,definePart,extState,hex,MONO,HALF_PI,c,pin,callout,type Inner} from './kit';

const TRIM_BLUE=0x2a6fd6; // ds-allow-hex  (blue multi-turn trimmer)
const CLEAR=0xe9f1f5; // ds-allow-hex  (clear epoxy of the IR LED)

function silk():CanvasTexture{
 const cv=document.createElement('canvas');cv.width=512;cv.height=256;
 const g=cv.getContext('2d')!;
 g.fillStyle=hex(0xffffff);g.textAlign='center';g.textBaseline='middle'; // ds-allow-hex  (white silkscreen)
 g.font=`600 46px ${MONO}`;g.fillText('IR OBST',256,70);
 g.font=`500 38px ${MONO}`;
 ['OUT','GND','VCC'].forEach((t,i)=>g.fillText(t,86+i*170,214));
 return canvasTexture(cv);
}

function buildFc51(_p:PartProps,g:Group):Inner{
 const y0=4,L=31,W=14,cz=-(L/2-2.5),cx=PITCH;
 for(let i=0;i<3;i++)g.add(leg(i*PITCH,y0+0.4));
 g.add(solid(new BoxGeometry(3*PITCH,2.5,2.5),C.HEADER_BLACK,{outline:true,pos:[cx,y0+1.25,0]}));
 const b=new Group();b.position.set(cx,y0,cz);g.add(b);
 b.add(solid(new BoxGeometry(W,1.6,L),C.SONAR_PCB,{outline:true,edges:true,pos:[0,0.8,0]}));
 // IR LED (clear) and photodiode (dark): lying cylinders with domed tips facing the far end
 const eye=(x:number,col:number,fin:'plastic'|'epoxy'):void=>{
  const z=-L/2+3.5;
  b.add(solid(new CylinderGeometry(2.5,2.5,6,24),col,{outline:true,rot:[HALF_PI,0,0],pos:[x,1.6+3,z+1.2],finish:fin}));
  b.add(solid(new SphereGeometry(2.5,24,12,0,Math.PI*2,0,HALF_PI),col,{outline:true,rot:[-HALF_PI,0,0],pos:[x,1.6+3,z-1.8],finish:fin}));
  b.add(solid(new CylinderGeometry(3,3,0.7,24),col,{rot:[HALF_PI,0,0],pos:[x,1.6+3,z+3.9],cast:false}));
 };
 eye(-3.6,CLEAR,'epoxy');eye(3.6,C.HEADER_BLACK,'plastic');
 b.add(solid(new BoxGeometry(9.5,5,4.2),TRIM_BLUE,{outline:true,pos:[0,1.6+2.5,-L/2+13.5]}));
 b.add(solid(new CylinderGeometry(1.5,1.5,0.5,18),C.SILVER,{pos:[0,1.6+5.2,-L/2+13.5],finish:'metal',cast:false}));
 b.add(solid(new BoxGeometry(2.8,0.3,0.6),C.SILVER_DARK,{pos:[0,1.6+5.5,-L/2+13.5],cast:false}));
 b.add(solid(new BoxGeometry(4.6,1.4,4),C.CHIP,{pos:[-3.6,1.6+0.7,-L/2+19.5],cast:false}));
 const led=(x:number,z:number,col:number):MeshStandardMaterial=>{
  const m=ownToon(col) as MeshStandardMaterial;
  const l=new Mesh(new BoxGeometry(1.8,0.7,1.2),m);l.position.set(x,1.6+0.35,z);l.userData.noPick=true;b.add(l);return m;
 };
 const pwr=led(4.8,L/2-8,C.LED_ON_GREEN),det=led(4.8,L/2-5.2,C.LED_SMD_OFF);
 pwr.emissive.set(C.LED_ON_GREEN);pwr.emissiveIntensity=0.7;
 const print=new Mesh(new PlaneGeometry(12,6),new MeshBasicMaterial({map:silk(),transparent:true,toneMapped:false,depthWrite:false}));
 print.material.userData.own=true;print.material.userData.ownMap=true;print.rotation.x=-HALF_PI;print.position.set(0,1.62,L/2-6.8);print.userData.noPick=true;print.userData.noInk=true;b.add(print);
 // beam: a translucent cone from the IR LED, long when the obstacle is far
 const beamMat=new MeshBasicMaterial({color:C.LIVE,transparent:true,opacity:0.22,depthWrite:false});beamMat.userData.own=true;
 const beam=new Mesh(new ConeGeometry(1,1,20,1,true),beamMat);beam.rotation.x=-HALF_PI;beam.userData.noPick=true;beam.userData.noInk=true;beam.visible=false;b.add(beam);
 const dim=new Color(C.LED_SMD_OFF),on=new Color(C.RED_ALERT);
 return {
  apply(s){
   const st=extState<IrObstacleFc51State>(s,'ir-obstacle-fc51');
   if(!st)return;
   det.color.copy(st.detected?on:dim);det.emissive.copy(on);det.emissiveIntensity=st.detected?0.9:0;
   beam.visible=st.detected;
   if(st.detected){
    const len=Math.min(60,st.sunlight?st.rangeCm:st.distanceCm)*0.6;
    beam.scale.set(len*0.35,len,len*0.35);beam.position.set(-3.6,1.6+3,-L/2+3.5-2-len/2);
   }
  },
 };
}

export const irObstacleFc51=definePart({
 kind:'ir-obstacle-fc51',name:c('IR obstacle sensor (FC-51)','Sensor halangan IR (FC-51)'),
 pins:{
  OUT:pin([0,0,0],'output','OUT (LOW on obstacle)','OUT (LOW saat ada halangan)'),GND:pin([PITCH,0,0],'ground','Ground','Ground'),VCC:pin([2*PITCH,0,0],'power','5V','5V'),
 },
 callouts:[
  callout('eyes',[PITCH,13,-25],'Clear LED sends infrared, dark diode listens for the bounce','LED bening memancarkan inframerah, dioda gelap mendengarkan pantulannya'),
  callout('trim',[PITCH,13,-13],'Trimmer sets how far it sees','Trimmer mengatur seberapa jauh jangkauannya'),
 ],
 make:buildFc51,
});
