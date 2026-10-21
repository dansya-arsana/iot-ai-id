/**
 * MQ-2 breakout: 32 x 22 mm blue board, 16 mm steel-mesh gas sensor on a black base, LM393 comparator, threshold trimmer, two LEDs and a
 * 4-pin header (VCC, GND, DO, AO). Pairs with sim/devices/mq2.ts.
 */
import {BoxGeometry,CanvasTexture,CircleGeometry,Color,CylinderGeometry,Group,Mesh,MeshBasicMaterial,MeshStandardMaterial} from 'three';
import type {PartProps} from '../../contract';
import type {Mq2State} from '../../sim/devices/mq2';
import {PITCH} from '../layout';
import {canvasTexture,ownToon,solid} from '../materials';
import * as C from '../palette';
import {leg,definePart,extState,c,pin,callout,type Inner} from './kit';

const TRIM_BLUE=0x2a6fd6; // ds-allow-hex  (blue multi-turn trimmer)
const HOT=0xff7a2a; // ds-allow-hex  (glowing heater coil)

function meshTex():CanvasTexture{
 const cv=document.createElement('canvas');cv.width=cv.height=256;
 const g=cv.getContext('2d')!;
 g.clearRect(0,0,256,256);
 g.strokeStyle='#8f97a3';g.lineWidth=5;                  // ds-allow-hex
 for(let i=-256;i<512;i+=22){g.beginPath();g.moveTo(i,0);g.lineTo(i+256,256);g.stroke();g.beginPath();g.moveTo(i+256,0);g.lineTo(i,256);g.stroke();}
 g.lineWidth=14;g.beginPath();g.arc(128,128,121,0,Math.PI*2);g.stroke();
 return canvasTexture(cv);
}

function buildMq2(_p:PartProps,g:Group):Inner{
 const cx=1.5*PITCH,y0=4,cz=-14;
 for(let i=0;i<4;i++)g.add(leg(i*PITCH,y0+0.4));
 g.add(solid(new BoxGeometry(4*PITCH,2.5,2.5),C.HEADER_BLACK,{outline:true,pos:[1.5*PITCH,y0+1.25,0]}));
 const b=new Group();b.position.set(cx,y0,cz);g.add(b);
 b.add(solid(new BoxGeometry(22,1.6,32),C.SONAR_PCB,{outline:true,edges:true,pos:[0,0.8,0]}));
 // sensor: black ceramic base, steel can, mesh cap, heater glow behind the mesh
 b.add(solid(new CylinderGeometry(8.2,8.2,2,36),C.HEADER_BLACK,{outline:true,pos:[0,2.6,-6]}));
 b.add(solid(new CylinderGeometry(7.9,7.9,6.4,40,1,true),C.SILVER,{pos:[0,6.8,-6],finish:'metal'}));
 b.add(solid(new CylinderGeometry(7.9,7.9,0.6,40),C.SILVER_DARK,{outline:true,pos:[0,10,-6],finish:'metal'}));
 const glow=ownToon(0x555a62) as MeshStandardMaterial; // ds-allow-hex  (cold heater coil)
 const heater=new Mesh(new CircleGeometry(6.4,32),glow);heater.rotation.x=-Math.PI/2;heater.position.set(0,10.32,-6);heater.userData.noPick=true;b.add(heater);
 const mesh=new Mesh(new CircleGeometry(7.2,40),new MeshBasicMaterial({map:meshTex(),transparent:true,toneMapped:false,depthWrite:false}));
 mesh.material.userData.own=true;mesh.material.userData.ownMap=true;
 mesh.rotation.x=-Math.PI/2;mesh.position.set(0,10.36,-6);mesh.userData.noPick=true;mesh.userData.noInk=true;b.add(mesh);
 // comparator side
 b.add(solid(new BoxGeometry(10,5.4,10),TRIM_BLUE,{outline:true,pos:[5.5,1.6+2.7,10]}));
 b.add(solid(new CylinderGeometry(1.7,1.7,0.6,20),C.SILVER,{pos:[5.5,1.6+5.7,10],finish:'metal',cast:false}));
 b.add(solid(new BoxGeometry(2.8,0.3,0.6),C.SILVER_DARK,{pos:[5.5,1.6+6.1,10],cast:false}));
 b.add(solid(new BoxGeometry(5,1.6,4),C.CHIP,{pos:[-5,1.6+0.8,8],cast:false}));
 const led=(x:number,z:number,on:number):MeshStandardMaterial=>{
  const m=ownToon(on) as MeshStandardMaterial;
  const l=new Mesh(new BoxGeometry(1.6,0.7,1),m);l.position.set(x,1.6+0.35,z);l.userData.noPick=true;b.add(l);return m;
 };
 const pwr=led(-8,3,C.LED_ON_GREEN),dol=led(-1.5,3,C.RED_ALERT);
 pwr.emissive.set(C.LED_ON_GREEN);pwr.emissiveIntensity=0.7;
 const dim=new Color(C.LED_SMD_OFF),redOn=new Color(C.RED_ALERT),cold=new Color(0x555a62),hot=new Color(HOT); // ds-allow-hex
 return {
  apply(s){
   const st=extState<Mq2State>(s,'mq2');
   if(!st)return;
   glow.color.copy(cold).lerp(hot,st.heat);
   glow.emissive.copy(hot);glow.emissiveIntensity=st.heat*0.9;
   dol.color.copy(st.doLow?redOn:dim);dol.emissive.copy(redOn);dol.emissiveIntensity=st.doLow?0.9:0;
  },
 };
}

export const mq2=definePart({
 kind:'mq2',name:c('Gas sensor (MQ-2)','Sensor gas (MQ-2)'),
 pins:{
  VCC:pin([0,0,0],'power','5V','5V'),GND:pin([PITCH,0,0],'ground','Ground','Ground'),
  DO:pin([2*PITCH,0,0],'output','DO (LOW over threshold)','DO (LOW di atas ambang)'),AO:pin([3*PITCH,0,0],'analog-out','AO (gas level)','AO (kadar gas)'),
 },
 callouts:[
  callout('mesh',[1.5*PITCH,16,-20],'Heated mesh: resistance falls in gas','Mesh panas: hambatan turun saat ada gas'),
  callout('trim',[1.5*PITCH+5.5,12,-4],'Trimmer sets the DO threshold','Trimmer mengatur ambang DO'),
 ],
 make:buildMq2,
});
