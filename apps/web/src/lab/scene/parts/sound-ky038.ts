/**
 * KY-038 sound module: 35 x 16 mm blue board, 4-pin header (AO, GND, VCC, DO) on the short edge, a 6 mm electret microphone
 * can at the far end, a blue multi-turn trimmer, an LM393 comparator and two LEDs (power, signal). Pairs with sim/devices/sound-ky038.ts.
 * The mic shows sound waves while loud; the signal LED follows DO.
 */
import {BoxGeometry,CanvasTexture,Color,CylinderGeometry,Group,Mesh,MeshBasicMaterial,MeshStandardMaterial,PlaneGeometry,TorusGeometry} from 'three';
import type {PartProps} from '../../contract';
import type {SoundKy038State} from '../../sim/devices/sound-ky038';
import {PITCH} from '../layout';
import {canvasTexture,ownToon,solid} from '../materials';
import * as C from '../palette';
import {leg,definePart,extState,hex,MONO,HALF_PI,c,pin,callout,type Inner} from './kit';

const TRIM_BLUE=0x2a6fd6; // ds-allow-hex  (blue multi-turn trimmer)

function silk():CanvasTexture{
 const cv=document.createElement('canvas');cv.width=512;cv.height=256;
 const g=cv.getContext('2d')!;
 g.fillStyle=hex(0xffffff);g.textAlign='center';g.textBaseline='middle'; // ds-allow-hex  (white silkscreen)
 g.font=`600 54px ${MONO}`;g.fillText('SOUND',256,70);
 g.font=`500 38px ${MONO}`;
 ['AO','G','+','DO'].forEach((t,i)=>g.fillText(t,64+i*128,214));
 return canvasTexture(cv);
}

function buildSound(_p:PartProps,g:Group):Inner{
 const y0=4,L=35,W=16,cz=-(L/2-2.5),cx=1.5*PITCH;
 for(let i=0;i<4;i++)g.add(leg(i*PITCH,y0+0.4));
 g.add(solid(new BoxGeometry(4*PITCH,2.5,2.5),C.HEADER_BLACK,{outline:true,pos:[cx,y0+1.25,0]}));
 const b=new Group();b.position.set(cx,y0,cz);g.add(b);
 b.add(solid(new BoxGeometry(W,1.6,L),C.SONAR_PCB,{outline:true,edges:true,pos:[0,0.8,0]}));
 // microphone can: silver cylinder, black sound hole in the top
 const micZ=-L/2+6.5;
 b.add(solid(new CylinderGeometry(3.4,3.4,5.2,28),C.SILVER,{outline:true,pos:[0,1.6+2.6,micZ],finish:'metal'}));
 b.add(solid(new CylinderGeometry(1.1,1.1,0.2,16),C.HOLE,{pos:[0,1.6+5.25,micZ],cast:false}));
 // trimmer, comparator, resistor row
 b.add(solid(new BoxGeometry(9.5,5,4.2),TRIM_BLUE,{outline:true,pos:[2.5,1.6+2.5,-L/2+17]}));
 b.add(solid(new CylinderGeometry(1.5,1.5,0.5,18),C.SILVER,{pos:[2.5,1.6+5.2,-L/2+17],finish:'metal',cast:false}));
 b.add(solid(new BoxGeometry(2.8,0.3,0.6),C.SILVER_DARK,{pos:[2.5,1.6+5.5,-L/2+17],cast:false}));
 b.add(solid(new BoxGeometry(4.6,1.4,4),C.CHIP,{pos:[-3.4,1.6+0.7,2.5],cast:false}));
 for(const z of [-3.5,-1.2])b.add(solid(new BoxGeometry(2,0.8,1.2),C.CHIP,{pos:[5,1.6+0.4,z],cast:false}));
 const led=(x:number,z:number,col:number):MeshStandardMaterial=>{
  const m=ownToon(col) as MeshStandardMaterial;
  const l=new Mesh(new BoxGeometry(1.8,0.7,1.2),m);l.position.set(x,1.6+0.35,z);l.userData.noPick=true;b.add(l);return m;
 };
 const pwr=led(-5.5,L/2-9,C.LED_ON_GREEN),sig=led(-5.5,L/2-6.2,C.LED_SMD_OFF);
 pwr.emissive.set(C.LED_ON_GREEN);pwr.emissiveIntensity=0.7;
 const print=new Mesh(new PlaneGeometry(14,7),new MeshBasicMaterial({map:silk(),transparent:true,toneMapped:false,depthWrite:false}));
 print.material.userData.own=true;print.material.userData.ownMap=true;print.rotation.x=-HALF_PI;print.position.set(0,1.62,L/2-7.2);print.userData.noPick=true;print.userData.noInk=true;b.add(print);
 // sound waves: three arcs that travel out of the mic while it hears something
 const rings=[0,1,2].map(()=>{
  const m=new Mesh(new TorusGeometry(5,0.3,6,32,Math.PI*1.1),new MeshBasicMaterial({color:C.LIVE,transparent:true,opacity:0,depthWrite:false}));
  m.material.userData.own=true;m.rotation.x=-HALF_PI;m.position.set(0,1.6+6.4,micZ);m.userData.noPick=true;m.userData.noInk=true;m.visible=false;b.add(m);return m;
 });
 const dim=new Color(C.LED_SMD_OFF),sigOn=new Color(C.RED_ALERT);
 let t=0;
 return {
  apply(s,dt){
   const st=extState<SoundKy038State>(s,'sound-ky038');
   if(!st)return;
   t+=dt;
   sig.color.copy(st.doHigh?sigOn:dim);sig.emissive.copy(sigOn);sig.emissiveIntensity=st.doHigh?0.9:0;
   const loud=st.level/100;
   rings.forEach((r,i)=>{
    r.visible=loud>0.03;
    if(!r.visible)return;
    const ph=(t/700+i/3)%1;
    r.position.y=1.6+6.4+ph*10;r.scale.setScalar(0.8+ph*(0.6+loud));(r.material as MeshBasicMaterial).opacity=Math.min(1,0.3+loud)*(1-ph);
   });
  },
 };
}

export const soundKy038=definePart({
 kind:'sound-ky038',name:c('Sound sensor (KY-038)','Sensor suara (KY-038)'),
 pins:{
  AO:pin([0,0,0],'analog-out','AO (sound wave)','AO (gelombang suara)'),GND:pin([PITCH,0,0],'ground','Ground','Ground'),
  VCC:pin([2*PITCH,0,0],'power','5V','5V'),DO:pin([3*PITCH,0,0],'output','DO (HIGH above level)','DO (HIGH di atas level)'),
 },
 callouts:[
  callout('mic',[1.5*PITCH,16,-27],'Electret microphone: turns air pressure into a tiny voltage','Mikrofon elektret: mengubah tekanan udara jadi tegangan kecil'),
  callout('trim',[1.5*PITCH+2.5,13,-16],'Trimmer sets the DO level','Trimmer mengatur level DO'),
 ],
 make:buildSound,
});
