/**
 * Rain sensor: a 50 x 40 mm plate with silver comb traces on a dark board, joined by a short cable to a 30 x 16 mm control board
 * (4-pin header VCC, GND, DO, AO; trimmer, LM393, two LEDs). Water drops grow on the plate with the wetness.
 * Pairs with sim/devices/rain-sensor.ts.
 */
import {BoxGeometry,CanvasTexture,Color,CylinderGeometry,Group,Mesh,MeshBasicMaterial,MeshStandardMaterial,PlaneGeometry,SphereGeometry} from 'three';
import type {PartProps} from '../../contract';
import type {RainSensorState} from '../../sim/devices/rain-sensor';
import {PITCH} from '../layout';
import {canvasTexture,ownToon,solid} from '../materials';
import * as C from '../palette';
import {leg,definePart,extState,hex,MONO,HALF_PI,c,pin,callout,type Inner} from './kit';

const TRIM_BLUE=0x2a6fd6; // ds-allow-hex  (blue multi-turn trimmer)
const DROP=0x8fc8ff; // ds-allow-hex  (water drop)

function combTex():CanvasTexture{
 const cv=document.createElement('canvas');cv.width=256;cv.height=204;
 const g=cv.getContext('2d')!;
 g.fillStyle=hex(0x24303a);g.fillRect(0,0,256,204); // ds-allow-hex  (dark plate)
 g.strokeStyle=hex(C.SILVER);g.lineWidth=7;g.lineCap='round';
 // two interleaved combs: one hangs from the top rail, the other rises from the bottom rail
 g.beginPath();g.moveTo(14,16);g.lineTo(242,16);g.moveTo(14,188);g.lineTo(242,188);g.stroke();
 for(let i=0;i<9;i++){
  const x=30+i*25;
  g.beginPath();if(i%2===0){g.moveTo(x,16);g.lineTo(x,160);}else{g.moveTo(x,188);g.lineTo(x,44);}g.stroke();
 }
 return canvasTexture(cv);
}
function silk():CanvasTexture{
 const cv=document.createElement('canvas');cv.width=512;cv.height=256;
 const g=cv.getContext('2d')!;
 g.fillStyle=hex(0xffffff);g.textAlign='center';g.textBaseline='middle'; // ds-allow-hex  (white silkscreen)
 g.font=`600 46px ${MONO}`;g.fillText('RAIN',256,70);
 g.font=`500 36px ${MONO}`;
 ['VCC','GND','DO','AO'].forEach((t,i)=>g.fillText(t,64+i*128,214));
 return canvasTexture(cv);
}

function buildRain(_p:PartProps,g:Group):Inner{
 const y0=4,L=30,W=16,cz=-(L/2-2.5),cx=1.5*PITCH;
 for(let i=0;i<4;i++)g.add(leg(i*PITCH,y0+0.4));
 g.add(solid(new BoxGeometry(4*PITCH,2.5,2.5),C.HEADER_BLACK,{outline:true,pos:[cx,y0+1.25,0]}));
 const b=new Group();b.position.set(cx,y0,cz);g.add(b);
 b.add(solid(new BoxGeometry(W,1.6,L),C.SONAR_PCB,{outline:true,edges:true,pos:[0,0.8,0]}));
 b.add(solid(new BoxGeometry(9.5,5,4.2),TRIM_BLUE,{outline:true,pos:[2.5,1.6+2.5,-L/2+8]}));
 b.add(solid(new CylinderGeometry(1.5,1.5,0.5,18),C.SILVER,{pos:[2.5,1.6+5.2,-L/2+8],finish:'metal',cast:false}));
 b.add(solid(new BoxGeometry(2.8,0.3,0.6),C.SILVER_DARK,{pos:[2.5,1.6+5.5,-L/2+8],cast:false}));
 b.add(solid(new BoxGeometry(4.6,1.4,4),C.CHIP,{pos:[-3.4,1.6+0.7,0],cast:false}));
 b.add(solid(new BoxGeometry(5,2,2.6),C.CREAM,{outline:true,pos:[-2,1.6+1,-L/2+2.6],cast:false}));   // plate connector
 const led=(x:number,z:number,col:number):MeshStandardMaterial=>{
  const m=ownToon(col) as MeshStandardMaterial;
  const l=new Mesh(new BoxGeometry(1.8,0.7,1.2),m);l.position.set(x,1.6+0.35,z);l.userData.noPick=true;b.add(l);return m;
 };
 const pwr=led(-5.5,L/2-8.5,C.LED_ON_GREEN),dol=led(-5.5,L/2-5.7,C.LED_SMD_OFF);
 pwr.emissive.set(C.LED_ON_GREEN);pwr.emissiveIntensity=0.7;
 const print=new Mesh(new PlaneGeometry(14,7),new MeshBasicMaterial({map:silk(),transparent:true,toneMapped:false,depthWrite:false}));
 print.material.userData.own=true;print.material.userData.ownMap=true;print.rotation.x=-HALF_PI;print.position.set(0,1.62,L/2-7.2);print.userData.noPick=true;print.userData.noInk=true;b.add(print);
 // cable: a flat two-wire lead from the connector, then the plate lying behind
 const tz=-L/2+2.6;
 b.add(solid(new BoxGeometry(3.4,0.9,14),C.HEADER_BLACK,{pos:[-2,1.6+0.5,tz-9],cast:false}));
 const plate=new Group();plate.position.set(-2,1.6+0.5,tz-16-20);b.add(plate);
 plate.add(solid(new BoxGeometry(40,1.4,50),0x24303a,{outline:true,edges:true,pos:[0,0.7,0]})); // ds-allow-hex  (dark plate)
 const comb=new Mesh(new PlaneGeometry(38,46),new MeshBasicMaterial({map:combTex(),toneMapped:false}));
 comb.material.userData.own=true;comb.material.userData.ownMap=true;comb.rotation.x=-HALF_PI;comb.position.set(0,1.42,0);comb.userData.noPick=true;comb.userData.noInk=true;plate.add(comb);
 // twelve drops at fixed spots; drop i shows when wetness passes its share
 const drops:Mesh[]=[];
 const spots:[number,number][]=[[-10,-14],[8,-16],[-4,-6],[13,-4],[-13,2],[2,4],[10,12],[-8,12],[0,-19],[16,18],[-16,-4],[5,-10]];
 const dm=ownToon(DROP) as MeshStandardMaterial;dm.transparent=true;dm.opacity=0.8;
 spots.forEach(([x,z],i)=>{
  const d=new Mesh(new SphereGeometry(1.7,14,8),dm);d.scale.y=0.45;d.position.set(x,1.9,z);d.userData.noPick=true;d.visible=false;d.userData.at=(i+0.5)/spots.length;plate.add(d);drops.push(d);
 });
 const dim=new Color(C.LED_SMD_OFF),on=new Color(C.RED_ALERT);
 return {
  apply(s){
   const st=extState<RainSensorState>(s,'rain-sensor');
   if(!st)return;
   dol.color.copy(st.doLow?on:dim);dol.emissive.copy(on);dol.emissiveIntensity=st.doLow?0.9:0;
   const w=st.wetness/100;
   for(const d of drops){const at=d.userData.at as number;d.visible=w>at*0.98;d.scale.set(1+0.5*w,0.45,1+0.5*w);}
  },
 };
}

export const rainSensor=definePart({
 kind:'rain-sensor',name:c('Rain sensor','Sensor hujan'),
 pins:{
  VCC:pin([0,0,0],'power','5V','5V'),GND:pin([PITCH,0,0],'ground','Ground','Ground'),
  DO:pin([2*PITCH,0,0],'output','DO (LOW when wet)','DO (LOW saat basah)'),AO:pin([3*PITCH,0,0],'analog-out','AO (falls with water)','AO (turun saat basah)'),
 },
 callouts:[
  callout('plate',[1.5*PITCH-2,12,-60],'Bare comb traces: water joins them and lets current through','Jalur sisir telanjang: air menyambungkannya sehingga arus mengalir'),
  callout('trim',[1.5*PITCH+2.5,13,-8],'Trimmer sets the DO level','Trimmer mengatur level DO'),
 ],
 make:buildRain,
});
