/**
 * IR flame module: 31 x 15 mm blue board, 4-pin header (AO, GND, VCC, DO), a black 5 mm phototransistor on bent leads at the
 * far end, a trimmer, an LM393 and two LEDs. When the flame is lit a small candle flame flickers in front of the sensor.
 * Pairs with sim/devices/flame-sensor.ts.
 */
import {BoxGeometry,CanvasTexture,Color,ConeGeometry,CylinderGeometry,Group,Mesh,MeshBasicMaterial,MeshStandardMaterial,PlaneGeometry,SphereGeometry} from 'three';
import type {PartProps} from '../../contract';
import type {FlameSensorState} from '../../sim/devices/flame-sensor';
import {PITCH} from '../layout';
import {canvasTexture,ownToon,solid} from '../materials';
import * as C from '../palette';
import {leg,definePart,extState,hex,MONO,HALF_PI,c,pin,callout,type Inner} from './kit';

const TRIM_BLUE=0x2a6fd6; // ds-allow-hex  (blue multi-turn trimmer)
const FLAME_OUT=0xff8a1f; // ds-allow-hex  (flame outer, orange)
const FLAME_IN=0xffd84a; // ds-allow-hex  (flame core, yellow)
const WAX=0xf2ead6; // ds-allow-hex  (candle)

function silk():CanvasTexture{
 const cv=document.createElement('canvas');cv.width=512;cv.height=256;
 const g=cv.getContext('2d')!;
 g.fillStyle=hex(0xffffff);g.textAlign='center';g.textBaseline='middle'; // ds-allow-hex  (white silkscreen)
 g.font=`600 46px ${MONO}`;g.fillText('FLAME',256,70);
 g.font=`500 38px ${MONO}`;
 ['AO','G','+','DO'].forEach((t,i)=>g.fillText(t,64+i*128,214));
 return canvasTexture(cv);
}

function buildFlame(_p:PartProps,g:Group):Inner{
 const y0=4,L=31,W=15,cz=-(L/2-2.5),cx=1.5*PITCH;
 for(let i=0;i<4;i++)g.add(leg(i*PITCH,y0+0.4));
 g.add(solid(new BoxGeometry(4*PITCH,2.5,2.5),C.HEADER_BLACK,{outline:true,pos:[cx,y0+1.25,0]}));
 const b=new Group();b.position.set(cx,y0,cz);g.add(b);
 b.add(solid(new BoxGeometry(W,1.6,L),C.SONAR_PCB,{outline:true,edges:true,pos:[0,0.8,0]}));
 // phototransistor: dark epoxy dome, flat rim, two bent leads, leaning toward the flame (far end)
 const pt=new Group();pt.position.set(0,1.6+7,-L/2+3.5);pt.rotation.x=-0.5;b.add(pt);
 pt.add(solid(new CylinderGeometry(2.5,2.5,5.5,24),C.HEADER_BLACK,{outline:true,pos:[0,0,0]}));
 pt.add(solid(new SphereGeometry(2.5,24,12,0,Math.PI*2,0,HALF_PI),C.HEADER_BLACK,{outline:true,pos:[0,2.75,0]}));
 pt.add(solid(new CylinderGeometry(3,3,0.7,24),C.HEADER_BLACK,{pos:[0,-2.4,0],cast:false}));
 for(const sx of [-1,1])b.add(solid(new BoxGeometry(0.5,6,0.5),C.SILVER,{pos:[sx*1.3,1.6+3,-L/2+4.2],cast:false,finish:'metal'}));
 b.add(solid(new BoxGeometry(9.5,5,4.2),TRIM_BLUE,{outline:true,pos:[2.2,1.6+2.5,-L/2+15]}));
 b.add(solid(new CylinderGeometry(1.5,1.5,0.5,18),C.SILVER,{pos:[2.2,1.6+5.2,-L/2+15],finish:'metal',cast:false}));
 b.add(solid(new BoxGeometry(2.8,0.3,0.6),C.SILVER_DARK,{pos:[2.2,1.6+5.5,-L/2+15],cast:false}));
 b.add(solid(new BoxGeometry(4.6,1.4,4),C.CHIP,{pos:[-3.2,1.6+0.7,1.5],cast:false}));
 const led=(x:number,z:number,col:number):MeshStandardMaterial=>{
  const m=ownToon(col) as MeshStandardMaterial;
  const l=new Mesh(new BoxGeometry(1.8,0.7,1.2),m);l.position.set(x,1.6+0.35,z);l.userData.noPick=true;b.add(l);return m;
 };
 const pwr=led(-5,L/2-9,C.LED_ON_GREEN),dol=led(-5,L/2-6.2,C.LED_SMD_OFF);
 pwr.emissive.set(C.LED_ON_GREEN);pwr.emissiveIntensity=0.7;
 const print=new Mesh(new PlaneGeometry(13,6.5),new MeshBasicMaterial({map:silk(),transparent:true,toneMapped:false,depthWrite:false}));
 print.material.userData.own=true;print.material.userData.ownMap=true;print.rotation.x=-HALF_PI;print.position.set(0,1.62,L/2-7);print.userData.noPick=true;print.userData.noInk=true;b.add(print);
 // candle with a flame, standing 22 mm in front of the sensor tip; shown only while lit
 const candle=new Group();candle.position.set(0,0,-L/2-22);candle.visible=false;b.add(candle);
 candle.add(solid(new CylinderGeometry(2.6,2.6,9,20),WAX,{outline:true,pos:[0,4.5,0]}));
 const fl=ownToon(FLAME_OUT) as MeshStandardMaterial;fl.emissive.set(FLAME_OUT);fl.emissiveIntensity=0.9;
 const core=ownToon(FLAME_IN) as MeshStandardMaterial;core.emissive.set(FLAME_IN);core.emissiveIntensity=1;
 const flame=new Group();flame.position.set(0,9.4,0);candle.add(flame);
 const outer=new Mesh(new ConeGeometry(1.9,6.4,16),fl);outer.position.y=3.2;outer.userData.noPick=true;flame.add(outer);
 const inner=new Mesh(new ConeGeometry(1,3.4,12),core);inner.position.y=1.9;inner.userData.noPick=true;flame.add(inner);
 const dim=new Color(C.LED_SMD_OFF),on=new Color(C.RED_ALERT);
 let t=0;
 return {
  apply(s,dt){
   const st=extState<FlameSensorState>(s,'flame-sensor');
   if(!st)return;
   t+=dt;
   dol.color.copy(st.doLow?on:dim);dol.emissive.copy(on);dol.emissiveIntensity=st.doLow?0.9:0;
   candle.visible=st.lit;
   if(st.lit){
    const k=1+0.12*Math.sin(t/70)+0.07*Math.sin(t/31+1);
    flame.scale.set(1/k,k,1/k);flame.rotation.z=0.08*Math.sin(t/110);
   }
  },
 };
}

export const flameSensor=definePart({
 kind:'flame-sensor',name:c('Flame sensor (IR)','Sensor api (IR)'),
 pins:{
  AO:pin([0,0,0],'analog-out','AO (falls with flame)','AO (turun saat ada api)'),GND:pin([PITCH,0,0],'ground','Ground','Ground'),
  VCC:pin([2*PITCH,0,0],'power','5V','5V'),DO:pin([3*PITCH,0,0],'output','DO (LOW on flame)','DO (LOW saat ada api)'),
 },
 callouts:[
  callout('eye',[0,15,-25],'Black phototransistor: sees the infrared of a flame','Fototransistor hitam: melihat inframerah api'),
  callout('trim',[1.5*PITCH+2.2,13,-13],'Trimmer sets the DO level','Trimmer mengatur level DO'),
 ],
 make:buildFlame,
});
