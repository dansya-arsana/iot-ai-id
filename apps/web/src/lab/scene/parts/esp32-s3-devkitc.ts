/** ESP32-S3-DevKitC-1 v1.1: 62.74 x 25.4 mm, two 22-pin headers at 2.54 mm (model only). Espressif PCB drawing v1.0, modelled by us; row spacing is [U]. Guide: docs/lab-extending.md */
import {BoxGeometry,CylinderGeometry,Group,Mesh,MeshBasicMaterial,PlaneGeometry} from 'three';
import type {PartProps} from '../../contract';
import {S3_PINS,type S3Pin} from '../../sim/devices/esp32-s3-devkitc';
import {canvasTexture,solid} from '../materials';
import * as C from '../palette';
import {HALF_PI,MONO,definePart,c,pin,callout,type Inner} from './kit';
import type {PinDef} from './types';

const L=62.74,W=25.4,ROW=11.43,P=2.54,BY=3.2,TH=1.6,TOP=BY+TH;
const px=(n:number):number=>26.67-(n-1)*P;                       // J1 and J3 pin 1 are at the antenna end (+x)
const pz=(p:S3Pin):number=>p.hdr==='J1'?-ROW:ROW;

function silk():Mesh{
 const S=30,cv=document.createElement('canvas');cv.width=Math.round(L*S);cv.height=Math.round(W*S);
 const g=cv.getContext('2d')!;
 g.fillStyle=C.SILKSCREEN;g.textBaseline='middle';
 const X=(x:number):number=>(x+L/2)*S,Z=(z:number):number=>(z+W/2)*S;
 g.font=`600 ${Math.round(1.2*S)}px ${MONO}`;
 for(const p of S3_PINS){
  const top=p.hdr==='J1';
  g.save();g.translate(X(px(p.n)),Z(top?-ROW+1.6:ROW-1.6));g.rotate(top?Math.PI/2:-Math.PI/2);g.textAlign='left';g.fillText(p.silk,0,0);g.restore();
 }
 g.font=`700 ${Math.round(1.6*S)}px ${MONO}`;g.textAlign='left';
 g.fillText('RST',X(-27),Z(-7));g.fillText('BOOT',X(-27.5),Z(5.2));g.fillText('UART',X(-31),Z(-3.2));g.fillText('USB',X(-30.6),Z(3.2));
 g.font=`600 ${Math.round(1.5*S)}px ${MONO}`;g.fillText('ESP32-S3-DevKitC-1',X(-10),Z(0.4));
 g.strokeStyle=C.SILKSCREEN;g.lineWidth=3;g.setLineDash([14,10]);g.strokeRect(X(24.2),Z(-9),7*S,18*S);   // antenna keep-out
 const m=new Mesh(new PlaneGeometry(L,W),new MeshBasicMaterial({map:canvasTexture(cv),transparent:true,toneMapped:false,depthWrite:false}));
 m.material.userData.own=true;m.material.userData.ownMap=true;
 m.rotation.x=-HALF_PI;m.position.set(0,TOP+0.02,0);m.userData.noPick=true;m.userData.noInk=true;return m;
}

function build(p:PartProps,g:Group):Inner{
 g.add(solid(new BoxGeometry(L,TH,W),C.CHIP,{outline:true,edges:true,pos:[0,BY+TH/2,0],cast:true}));
 for(const z of [-ROW,ROW]){
  g.add(solid(new BoxGeometry(22*P,2.5,2.54),C.HEADER_BLACK,{pos:[px(11.5),BY-1.25,z],cast:false}));
  for(let n=1;n<=22;n++){
   g.add(solid(new BoxGeometry(0.64,BY+3,0.64),C.GOLD,{pos:[px(n),(BY-3)/2+0.5,z],cast:false,finish:'metal'}));
   g.add(solid(new CylinderGeometry(0.95,0.95,0.06,12),C.GOLD,{pos:[px(n),TOP+0.03,z],cast:false,finish:'metal'}));
  }
 }
 g.add(silk());
 // WROOM-1 module 18 x 25.5: metal shield, the PCB antenna overhangs the +x end
 const mx=L/2-25.5/2;
 g.add(solid(new BoxGeometry(25.5,0.8,18),C.PCB_DARK,{outline:true,pos:[mx,TOP+0.4,0],cast:false}));
 g.add(solid(new BoxGeometry(18.6,2.3,18),C.SILVER,{outline:true,edges:true,pos:[mx-3.45,TOP+0.8+1.15,0],finish:'metal'}));
 for(let i=0;i<6;i++)g.add(solid(new BoxGeometry(4.4,0.1,0.5),C.GOLD,{pos:[L/2-3.1,TOP+0.85,-6.2+i*2.5],cast:false,finish:'metal'}));
 // two USB ports on the -x end: UART (upper) and native USB; micro-USB or USB-C by prop
 const usbC=p.usb==='c';
 for(const z of [-3.6,3.6]){
  g.add(solid(new BoxGeometry(usbC?5:5.6,usbC?2.6:2.6,usbC?7.2:7.4),C.SILVER,{outline:true,pos:[-L/2+2.4,TOP+1.3,z],finish:'metal'}));
  g.add(solid(new BoxGeometry(1.0,1.0,usbC?5.4:5.6),C.HOLE,{pos:[-L/2-0.2,TOP+1.3,z],cast:false}));
 }
 // RST and BOOT buttons, RGB LED, regulator
 for(const z of [-7.2,7.2]){
  g.add(solid(new BoxGeometry(5,1.6,5),C.SILVER_DARK,{pos:[-21,TOP+0.8,z*0.8],cast:false,finish:'metal'}));
  g.add(solid(new CylinderGeometry(1.3,1.3,1.2,16),C.HEADER_BLACK,{pos:[-21,TOP+2.1,z*0.8],cast:false}));
 }
 g.add(solid(new BoxGeometry(2,0.7,2),C.WHITE,{pos:[px(10)-1,TOP+0.35,ROW-4.2],cast:false}));   // RGB LED (GPIO38)
 g.add(solid(new BoxGeometry(6.5,1.7,3.5),C.HEADER_TOP,{pos:[-12,TOP+0.85,6],cast:false}));
 return {apply(){}};
}

const pins:Record<string,PinDef>={};
for(const p of S3_PINS){
 const t:PinDef['type']=p.kind==='power'?'power':p.kind==='ground'?'ground':p.kind==='reset'?'input':'output';
 const bits=p.gpio!==undefined?[`GPIO${p.gpio}`,...(p.adc?[p.adc]:[]),...(p.touch!==undefined?[`Touch${p.touch}`]:[]),...(p.fn?[p.fn]:[])].join(' / '):p.silk;
 pins[p.key]=pin([px(p.n),0.5,pz(p)],t,`${p.hdr}-${p.n} ${bits}: ${p.note.en}`,`${p.hdr}-${p.n} ${bits}: ${p.note.id}`);
}

export const esp32S3Devkitc=definePart({
 kind:'esp32-s3-devkitc',name:c('ESP32-S3-DevKitC-1','ESP32-S3-DevKitC-1'),
 pins,deskMm:[63,26],
 callouts:[
  callout('usb',[-L/2+2.4,TOP+4,0],'Two USB ports: UART (serial monitor and upload) and native USB. Use one power input at a time','Dua port USB: UART (monitor serial dan unggah) dan USB native. Pakai satu input daya dalam satu waktu'),
  callout('boot',[-21,TOP+4,5.8],'BOOT (GPIO0): hold it while pressing RST to enter download mode','BOOT (GPIO0): tahan sambil menekan RST untuk masuk mode unduh'),
  callout('rgb',[px(10)-1,TOP+2,ROW-4.2],'RGB LED on GPIO38 (v1.1 boards)','LED RGB di GPIO38 (papan v1.1)'),
  callout('antenna',[L/2-3,TOP+2,0],'PCB antenna: keep metal and wires away from this end','Antena PCB: jauhkan logam dan kabel dari ujung ini'),
  callout('psram',[px(13),TOP+2,ROW],'On N8R8 and N16R8 modules GPIO35 to 37 are used by the PSRAM; ADC2 stops while Wi-Fi is on','Pada modul N8R8 dan N16R8 GPIO35 sampai 37 dipakai PSRAM; ADC2 berhenti saat Wi-Fi aktif'),
 ],
 make:build,
});
