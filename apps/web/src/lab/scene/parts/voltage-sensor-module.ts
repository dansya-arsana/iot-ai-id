/** Voltage sensor module: red board about 28 x 13 mm with a blue two-way screw terminal, two SMD resistors forming the 5:1 divider and a 3-pin header (S, +, -). Pairs with sim/devices/voltage-sensor-module.ts. */
import {BoxGeometry,CylinderGeometry,Group,Mesh,MeshBasicMaterial,PlaneGeometry} from 'three';
import type {PartProps} from '../../contract';
import type {VoltageSensorState} from '../../sim/devices/voltage-sensor-module';
import {PITCH} from '../layout';
import {canvasTexture,ownToon,solid} from '../materials';
import * as C from '../palette';
import {HALF_PI,MONO,leg,definePart,extState,c,pin,callout,type Inner} from './kit';

const BOARD_RED=0xb8312f; // ds-allow-hex  (voltage module PCB)
const TERM_BLUE=0x2f6fe0; // ds-allow-hex  (blue screw terminal)
const LED_OFF=0x2a3a30; // ds-allow-hex  (unlit indicator)

function label(g:Group,text:string,w:number,h:number,x:number,y:number,z:number):void{
 const cv=document.createElement('canvas');cv.width=256;cv.height=Math.max(16,Math.round(256*h/w));
 const k=cv.getContext('2d')!;
 k.fillStyle='#f7f4ea';k.textAlign='center';k.textBaseline='middle';k.font=`600 ${Math.round(cv.height*0.7)}px ${MONO}`;k.fillText(text,128,cv.height/2);
 const m=new Mesh(new PlaneGeometry(w,h),new MeshBasicMaterial({map:canvasTexture(cv),transparent:true,toneMapped:false,depthWrite:false}));
 m.material.userData.own=true;m.material.userData.ownMap=true;m.position.set(x,y,z);m.userData.noPick=true;m.userData.noInk=true;g.add(m);
}

const BW=24.5,BH=13,PY=5,CX=10,CY=PY+BH/2;
const TX=16.5,TZ=9.4,TY_PLUS=CY+2.54,TY_MINUS=CY-2.54;

function buildVsm(_p:PartProps,g:Group):Inner{
 for(let i=0;i<3;i++)g.add(leg(i*PITCH,PY+0.4));
 g.add(solid(new BoxGeometry(BW,BH,1.6),BOARD_RED,{outline:true,edges:true,pos:[CX,CY,0]}));
 // blue two-way screw terminal on the right
 g.add(solid(new BoxGeometry(10,10.16,8.2),TERM_BLUE,{outline:true,pos:[TX,CY,4.6]}));
 for(const sy of [-1,1]){
  g.add(solid(new CylinderGeometry(1.7,1.7,0.9,14),C.SILVER,{rot:[HALF_PI,0,0],pos:[TX,CY+sy*2.54,9.0],finish:'metal'}));
  g.add(solid(new BoxGeometry(0.6,3.4,3.4),C.HOLE,{pos:[TX+5,CY+sy*2.54,4.6],cast:false}));
 }
 // the divider: R1 (30 k, "303") and R2 (7.5 k, "751"), 0805 size, with their printed codes
 for(const [x,t] of [[3,'303'],[6.5,'751']] as const){
  g.add(solid(new BoxGeometry(2,1.25,0.5),C.CHIP,{pos:[x,CY+1.5,1.05],cast:false}));
  g.add(solid(new BoxGeometry(0.5,1.3,0.55),C.SILVER,{pos:[x-0.8,CY+1.5,1.08],cast:false,finish:'metal'}));
  g.add(solid(new BoxGeometry(0.5,1.3,0.55),C.SILVER,{pos:[x+0.8,CY+1.5,1.08],cast:false,finish:'metal'}));
  label(g,t,1.6,0.8,x,CY+1.5,1.32);
 }
 g.add(solid(new BoxGeometry(1.6,0.8,0.8),C.CREAM_DARK,{pos:[4.5,CY-2.2,1.2],cast:false}));
 // reading bar: how full the 0-5 V output is (not on the real board)
 const barMat=ownToon(LED_OFF);
 const bar=new Mesh(new BoxGeometry(1,1.1,0.8),barMat);bar.position.set(CX-3,CY+5.2,1.2);g.add(bar);
 label(g,'S + -',5.5,1.6,PITCH,PY+2.4,0.9);label(g,'0-25V',5.6,1.6,CX-4.5,CY-4.2,0.9);
 return {
  apply(s){
   const st=extState<VoltageSensorState>(s,'voltage-sensor-module');
   if(!st)return;
   const mag=Math.min(1,st.vout/5),col=st.over?C.RED_ALERT:C.LIVE;
   bar.scale.x=Math.max(0.001,mag*12);bar.position.x=CX-9+mag*6;bar.visible=mag>0.01;
   barMat.color.setHex(col);barMat.emissive.setHex(col);barMat.emissiveIntensity=0.6+1.6*mag;
  },
 };
}

export const voltageSensorModule=definePart({
 kind:'voltage-sensor-module',name:c('Voltage sensor module (0-25 V)','Modul sensor tegangan (0-25 V)'),
 pins:{
  S:pin([0,0,0],'output','S (signal, 0-5 V)','S (sinyal, 0-5 V)'),NC:pin([PITCH,0,0],'input','+ (not connected)','+ (tidak terhubung)'),GND:pin([2*PITCH,0,0],'ground','- (ground)','- (ground)'),
  'VIN+':pin([TX,TY_PLUS,TZ],'input','VIN+ (voltage to measure)','VIN+ (tegangan yang diukur)'),'VIN-':pin([TX,TY_MINUS,TZ],'ground','VIN- (its ground)','VIN- (ground-nya)'),
 },
 callouts:[
  callout('terminal',[TX,CY+8,TZ],'Screw in the voltage to measure, up to 25 V','Pasang tegangan yang diukur di sini, hingga 25 V'),
  callout('divider',[5,CY+5,2],'Two resistors divide the voltage by 5','Dua resistor membagi tegangan dengan 5'),
 ],
 make:buildVsm,
});
