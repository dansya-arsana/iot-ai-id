/**
 * NTC thermistor module: a small green board (15 x 9 mm, 1.2 mm thick) with a 10k SMD series resistor and a 3 mm 10k B3950 epoxy bead
 * on two long leads, three header legs VCC SIG GND on the 2.54 mm grid. Pairs with sim/devices/ntc-thermistor.ts (analog divider).
 */
import {BoxGeometry,Color,CylinderGeometry,Group,Mesh,MeshBasicMaterial,MeshStandardMaterial,PlaneGeometry,SphereGeometry} from 'three';
import type {PartProps} from '../../contract';
import type {NtcState} from '../../sim/devices/ntc-thermistor';
import {PITCH} from '../layout';
import {canvasTexture,solid} from '../materials';
import * as C from '../palette';
import {MONO,leg,definePart,extState,c,pin,callout,type Inner} from './kit';

const GREEN=0x2f7d4f; // ds-allow-hex  (green solder mask of the module)
const BEAD=0xa5521f; // ds-allow-hex  (orange-brown epoxy of the thermistor bead)

function printTex():ReturnType<typeof canvasTexture>{
 const cv=document.createElement('canvas');cv.width=256;cv.height=96;
 const g=cv.getContext('2d')!;
 g.fillStyle=C.SILKSCREEN;g.textAlign='left';g.textBaseline='middle';
 g.font=`700 38px ${MONO}`;g.fillText('NTC 10k',10,26);
 g.font=`500 26px ${MONO}`;g.fillText('B3950',10,70);
 return canvasTexture(cv);
}

function buildNtc(_p:PartProps,g:Group):Inner{
 const cx=PITCH,W=15,D=9,T=1.2,y0=2.6,zc=-D/2+1;
 for(let i=0;i<3;i++)g.add(leg(i*PITCH,y0+0.4));
 const yTop=y0+T;
 g.add(solid(new BoxGeometry(W,T,D),GREEN,{outline:true,edges:true,pos:[cx,y0+T/2,zc],own:true}));
 // pad row and the series resistor (0603-like, tan)
 for(let i=0;i<3;i++){
  const pad=new Mesh(new CylinderGeometry(0.9,0.9,0.05,14),new MeshStandardMaterial({color:C.GOLD,metalness:0.6,roughness:0.4}));
  pad.material.userData.own=true;pad.position.set(i*PITCH,yTop+0.03,0);pad.userData.noPick=true;pad.userData.noInk=true;g.add(pad);
 }
 g.add(solid(new BoxGeometry(1.6,0.5,0.8),C.RESISTOR_BODY,{pos:[cx+3.8,yTop+0.25,zc+0.8],own:true}));
 // the bead on two long leads that rise and lean back, 3 mm epoxy drop
 for(const sx of [-0.7,0.7]){
  g.add(solid(new BoxGeometry(0.4,9,0.4),C.SILVER,{pos:[cx+sx,yTop+4.5,zc-1.2],cast:false,finish:'metal'}));
 }
 const bead=solid(new SphereGeometry(1.5,20,14),BEAD,{outline:true,pos:[cx,yTop+9.8,zc-1.2],own:true});
 g.add(bead);
 const mat=bead.material as MeshStandardMaterial;
 const print=new Mesh(new PlaneGeometry(7.6,2.85),new MeshBasicMaterial({map:printTex(),transparent:true,toneMapped:false,depthWrite:false}));
 print.material.userData.own=true;print.material.userData.ownMap=true;
 print.rotation.x=-Math.PI/2;print.position.set(cx-3.2,yTop+0.04,zc+1.2);print.userData.noPick=true;print.userData.noInk=true;g.add(print);
 const cool=new Color(BEAD),hot=new Color(C.RED_ALERT);
 return {
  apply(s){
   const st=extState<NtcState>(s,'ntc-thermistor');
   if(!st)return;
   // the bead blushes with the temperature it senses (-40 to 125 degC)
   const t=Math.min(1,Math.max(0,(st.tempC+40)/165));
   mat.color.copy(cool).lerp(hot,t*0.7);
  },
 };
}

const P=(i:number):[number,number,number]=>[i*PITCH,0,0];
export const ntcThermistor=definePart({
 kind:'ntc-thermistor',name:c('NTC thermistor 10k','Termistor NTC 10k'),
 pins:{VCC:pin(P(0),'power','Power 3.3V or 5V','Daya 3,3V atau 5V'),SIG:pin(P(1),'analog-out','SIG: divider voltage (rises when warm)','SIG: tegangan pembagi (naik saat hangat)'),GND:pin(P(2),'ground','Ground','Ground')},
 callouts:[
  callout('bead',[PITCH,14,-2],'The bead is the sensor: warmer means lower resistance','Bead adalah sensornya: makin hangat hambatannya makin kecil'),
  callout('divider',[PITCH+3.8,5,-3],'A fixed 10k resistor below it forms the divider','Resistor tetap 10k di bawahnya membentuk pembagi'),
 ],
 make:buildNtc,
});
