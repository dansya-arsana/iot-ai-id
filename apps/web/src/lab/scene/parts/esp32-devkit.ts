/** ESP32-DevKitC V4: board 54.4 x 27.9 mm, 38 pins at 2.54 mm pitch, rows 25.4 mm apart (public Espressif drawing, modelled by us). Guide: docs/lab-extending.md */
import {BoxGeometry,CylinderGeometry,Group,Mesh,MeshBasicMaterial,PlaneGeometry} from 'three';
import type {PartProps} from '../../contract';
import {ESP32_PINS,type Esp32Pin} from '../../sim/devices/esp32-devkit';
import {canvasTexture,solid} from '../materials';
import * as C from '../palette';
import {HALF_PI,MONO,definePart,c,pin,callout,type Inner} from './kit';
import type {PinDef} from './types';

const L=54.4,W=27.9,ROW=12.7,P=2.54,BY=3.2,TH=1.6;   // board length, width, row half-spacing, pitch, board underside y, thickness
const px=(i:number):number=>22.86-i*P;
const TOP=BY+TH;

function silk():Mesh{
 const S=40,cv=document.createElement('canvas');cv.width=Math.round(L*S);cv.height=Math.round(W*S);
 const g=cv.getContext('2d')!;
 g.fillStyle='#f7f4ea';g.textBaseline='middle';
 const X=(x:number):number=>(x+L/2)*S,Z=(z:number):number=>(z+W/2)*S;
 g.font=`600 ${Math.round(1.25*S)}px ${MONO}`;
 for(const p of ESP32_PINS){
  const top=p.side==='L';   // L row is z-, canvas top
  g.save();g.translate(X(px(p.idx)),Z(top?-ROW+1.7:ROW-1.7));g.rotate(top?Math.PI/2:-Math.PI/2);
  g.textAlign='left';g.fillText(p.silk,0,0);g.restore();
 }
 g.font=`700 ${Math.round(1.7*S)}px ${MONO}`;g.textAlign='left';
 g.fillText('EN',X(-23.2),Z(-7.2));g.fillText('BOOT',X(-23.9),Z(5.2));
 g.font=`600 ${Math.round(1.5*S)}px ${MONO}`;g.fillText('ESP32-DevKitC',X(-12.5),Z(0.4));
 // meander keep-out outline under the antenna
 g.strokeStyle='#f7f4ea';g.lineWidth=3;g.setLineDash([14,10]);g.strokeRect(X(21.2),Z(-9.2),6.0*S,18.4*S);
 const m=new Mesh(new PlaneGeometry(L,W),new MeshBasicMaterial({map:canvasTexture(cv),transparent:true,toneMapped:false,depthWrite:false}));
 m.material.userData.own=true;m.material.userData.ownMap=true;
 m.rotation.x=-HALF_PI;m.position.set(0,TOP+0.02,0);m.userData.noPick=true;m.userData.noInk=true;return m;
}

function buildDevkit(_p:PartProps,g:Group):Inner{
 // PCB, black
 g.add(solid(new BoxGeometry(L,TH,W),C.CHIP,{outline:true,edges:true,pos:[0,BY+TH/2,0],cast:true}));
 // header strips under the board and pins down to the desk
 for(const z of [-ROW,ROW]){
  g.add(solid(new BoxGeometry(19*P,2.5,2.54),C.HEADER_BLACK,{pos:[0,BY-1.25,z],cast:false}));
  for(let i=0;i<19;i++){
   g.add(solid(new BoxGeometry(0.64,BY+3,0.64),C.GOLD,{pos:[px(i),(BY-3)/2+0.5,z],cast:false,finish:'metal'}));
   g.add(solid(new CylinderGeometry(0.95,0.95,0.06,12),C.GOLD,{pos:[px(i),TOP+0.03,z],cast:false,finish:'metal'}));
  }
 }
 g.add(silk());
 // WROOM-32 module: 18 x 25.5 x 3.1, metal shield over the RF part, PCB antenna overhang at the +x end
 const mx=27.2-25.5/2;
 g.add(solid(new BoxGeometry(25.5,0.8,18),C.PCB_DARK,{outline:true,pos:[mx,TOP+0.4,0],cast:false}));
 g.add(solid(new BoxGeometry(18.6,2.3,18),C.SILVER,{outline:true,edges:true,pos:[mx-3.45,TOP+0.8+1.15,0],finish:'metal'}));
 // antenna meander (copper trace, raised slightly)
 const ax=27.2-3.1;
 for(let i=0;i<6;i++)g.add(solid(new BoxGeometry(4.4,0.1,0.5),C.GOLD,{pos:[ax,TOP+0.85,-6.2+i*2.5],cast:false,finish:'metal'}));
 for(let i=0;i<5;i++)g.add(solid(new BoxGeometry(0.5,0.1,2.0+0.5),C.GOLD,{pos:[ax+(i%2?-2.1:2.1),TOP+0.85,-5+i*2.5],cast:false,finish:'metal'}));
 // USB micro-B on the -x end
 g.add(solid(new BoxGeometry(5.6,2.6,7.4),C.SILVER,{outline:true,pos:[-L/2+2.0,TOP+1.3,0],finish:'metal'}));
 g.add(solid(new BoxGeometry(1.0,1.0,5.6),C.HOLE,{pos:[-L/2-0.7,TOP+1.3,0],cast:false}));
 // CP2102 USB-UART, AMS1117 regulator (SOT-223), buttons, LED, passives
 g.add(solid(new BoxGeometry(5,0.9,5),C.HEADER_TOP,{pos:[-14.5,TOP+0.45,-5.5]}));
 g.add(solid(new BoxGeometry(6.5,1.7,3.5),C.HEADER_TOP,{pos:[-15,TOP+0.85,6]}));
 for(const [z,x] of [[-8.2,-21.5],[8.2,-21.5]] as const){
  g.add(solid(new BoxGeometry(6,1.8,6),C.SILVER_DARK,{pos:[x,TOP+0.9,z*0.55],cast:false,finish:'metal'}));
  g.add(solid(new CylinderGeometry(1.5,1.5,1.4,16),C.HEADER_BLACK,{pos:[x,TOP+2.5,z*0.55],cast:false}));
 }
 g.add(solid(new BoxGeometry(1.6,0.6,0.9),C.RED_ALERT,{pos:[-9,TOP+0.3,-7.2],cast:false}));   // power LED
 for(let i=0;i<5;i++)g.add(solid(new BoxGeometry(1.0,0.5,0.5),C.CREAM_DARK,{pos:[-8+i*1.8,TOP+0.25,8.8],cast:false}));
 return {apply(){}};
}

const pins:Record<string,PinDef>={};
for(const p of ESP32_PINS){
 const t:PinDef['type']=p.kind==='power'?'power':p.kind==='ground'?'ground':p.kind==='input-only'||p.kind==='reset'?'input':'output';
 pins[p.key]=pin([px(p.idx),0.5,p.side==='L'?-ROW:ROW],t,label(p),labelId(p));
}
function label(p:Esp32Pin):string{
 if(p.kind==='power'||p.kind==='ground'||p.kind==='reset')return `${p.silk}: ${p.note.en}`;
 const bits=[`GPIO${p.gpio}`];
 if(p.adc)bits.push(p.adc);if(p.touch!==undefined)bits.push(`Touch${p.touch}`);if(p.dac)bits.push(`DAC${p.dac}`);
 return `${bits.join(' / ')}: ${p.note.en}`;
}
function labelId(p:Esp32Pin):string{
 if(p.kind==='power'||p.kind==='ground'||p.kind==='reset')return `${p.silk}: ${p.note.id}`;
 const bits=[`GPIO${p.gpio}`];
 if(p.adc)bits.push(p.adc);if(p.touch!==undefined)bits.push(`Touch${p.touch}`);if(p.dac)bits.push(`DAC${p.dac}`);
 return `${bits.join(' / ')}: ${p.note.id}`;
}

export const esp32Devkit=definePart({
 kind:'esp32-devkit',name:c('ESP32-DevKitC','ESP32-DevKitC'),
 pins,deskMm:[55,28],
 callouts:[
  callout('module',[mx0(),TOP+3.6,0],'WROOM-32 module: dual-core CPU, Wi-Fi and Bluetooth under the metal shield','Modul WROOM-32: CPU dua inti, Wi-Fi dan Bluetooth di bawah pelindung logam'),
  callout('antenna',[24.2,TOP+1.6,0],'PCB antenna: keep metal and wires away from it','Antena PCB: jauhkan logam dan kabel darinya'),
  callout('usb',[-L/2+1,TOP+4,0],'Micro-USB: power and serial upload','Micro-USB: daya dan unggah serial'),
  callout('buttons',[-21.5,TOP+4,0],'EN resets, BOOT (GPIO0) held at reset enters download mode','EN mereset, BOOT (GPIO0) ditahan saat reset masuk mode unduh'),
  callout('adc',[px(6),TOP+2,-ROW],'GPIO34-39 are input only; ADC2 pins stop working while Wi-Fi is on','GPIO34-39 hanya input; pin ADC2 tidak jalan saat Wi-Fi aktif'),
  callout('strap',[px(14),TOP+2,ROW],'Strapping pins 0, 2, 5, 12, 15 are read at boot: do not hold them wrongly','Pin strapping 0, 2, 5, 12, 15 dibaca saat boot: jangan ditahan salah'),
  callout('runtime',[-8,TOP+6,0],'Wiring only: ESP32 code does not run in the browser yet (AVR only)','Hanya pengkabelan: kode ESP32 belum berjalan di browser (hanya AVR)'),
 ],
 make:buildDevkit,
});
function mx0():number{return 27.2-25.5/2-3.45;}
