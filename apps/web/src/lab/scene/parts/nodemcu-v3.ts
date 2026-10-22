/** NodeMCU v3 (LoLin style): board about 58 x 31 mm, 2 x 15 pins at 2.54 mm pitch, rows 27.94 mm apart, ESP-12E module with antenna, micro-USB, FLASH and RST buttons. Modelled by us from the public drawing. */
import {BoxGeometry,CylinderGeometry,Group,Mesh,MeshBasicMaterial,PlaneGeometry} from 'three';
import type {PartProps} from '../../contract';
import {NODE_PINS,type NodePin} from '../../sim/devices/nodemcu-v3';
import {canvasTexture,solid} from '../materials';
import * as C from '../palette';
import {HALF_PI,MONO,definePart,c,pin,callout,type Inner} from './kit';
import type {PinDef} from './types';

const L=58,W=31,ROW=13.97,P=2.54,BY=3.2,TH=1.6,TOP=BY+TH;
const px=(i:number):number=>-L/2+10+i*P;   // idx 0 near the USB end (-x)
const BLACK_PCB=0x14161a; // ds-allow-hex  (matte black dev-board PCB)

function silk():Mesh{
 const S=30,cv=document.createElement('canvas');cv.width=Math.round(L*S);cv.height=Math.round(W*S);
 const g=cv.getContext('2d')!;
 g.fillStyle='#f7f4ea';g.textBaseline='middle';
 const X=(x:number):number=>(x+L/2)*S,Z=(z:number):number=>(z+W/2)*S;
 g.font=`600 ${Math.round(1.3*S)}px ${MONO}`;g.textAlign='left';
 for(const p of NODE_PINS){
  const top=p.side==='L';
  g.save();g.translate(X(px(p.idx)),Z(top?-ROW+1.7:ROW-1.7));g.rotate(top?Math.PI/2:-Math.PI/2);g.fillText(p.silk,0,0);g.restore();
 }
 g.font=`700 ${Math.round(1.5*S)}px ${MONO}`;g.fillText('FLASH',X(-22.5),Z(-8.6));g.fillText('RST',X(-22.5),Z(8.6));
 g.font=`600 ${Math.round(1.6*S)}px ${MONO}`;g.fillText('NodeMCU',X(-6),Z(-2.5));g.fillText('v3',X(-6),Z(1.2));
 const m=new Mesh(new PlaneGeometry(L,W),new MeshBasicMaterial({map:canvasTexture(cv),transparent:true,toneMapped:false,depthWrite:false}));
 m.material.userData.own=true;m.material.userData.ownMap=true;
 m.rotation.x=-HALF_PI;m.position.set(0,TOP+0.02,0);m.userData.noPick=true;m.userData.noInk=true;return m;
}

function build(_p:PartProps,g:Group):Inner{
 g.add(solid(new BoxGeometry(L,TH,W),BLACK_PCB,{outline:true,edges:true,pos:[0,BY+TH/2,0],cast:true}));
 for(const z of [-ROW,ROW]){
  g.add(solid(new BoxGeometry(15*P,2.5,2.54),C.HEADER_BLACK,{pos:[px(7),BY-1.25,z],cast:false}));
  for(let i=0;i<15;i++){
   g.add(solid(new BoxGeometry(0.64,BY+3,0.64),C.GOLD,{pos:[px(i),(BY-3)/2+0.5,z],cast:false,finish:'metal'}));
   g.add(solid(new CylinderGeometry(0.95,0.95,0.06,12),C.GOLD,{pos:[px(i),TOP+0.03,z],cast:false,finish:'metal'}));
  }
 }
 g.add(silk());
 // ESP-12E module: 16 x 24 x 3 mm, metal can, printed antenna at the +x end
 const mx=L/2-12;
 g.add(solid(new BoxGeometry(24,0.8,16),C.PCB_DARK,{outline:true,pos:[mx,TOP+0.4,0],cast:false}));
 g.add(solid(new BoxGeometry(15,2.0,12),C.SILVER,{outline:true,edges:true,pos:[mx-4,TOP+0.8+1,0],finish:'metal'}));
 for(let i=0;i<6;i++)g.add(solid(new BoxGeometry(5.5,0.1,0.55),C.GOLD,{pos:[mx+8,TOP+0.85,-6+i*2.4],cast:false,finish:'metal'}));
 // micro-USB, USB-UART chip, regulator, buttons, user LED
 g.add(solid(new BoxGeometry(5.6,2.6,7.4),C.SILVER,{outline:true,pos:[-L/2+2.2,TOP+1.3,0],finish:'metal'}));
 g.add(solid(new BoxGeometry(1.0,1.0,5.6),C.HOLE,{pos:[-L/2-0.6,TOP+1.3,0],cast:false}));
 g.add(solid(new BoxGeometry(5,1.4,4.5),C.CHIP,{pos:[-8,TOP+0.7,-6]}));
 g.add(solid(new BoxGeometry(6.5,1.7,3.5),C.HEADER_TOP,{pos:[-8,TOP+0.85,7]}));
 for(const z of [-8.2,8.2]){
  g.add(solid(new BoxGeometry(6,1.8,6),C.SILVER_DARK,{pos:[-18,TOP+0.9,z*0.8],cast:false,finish:'metal'}));
  g.add(solid(new CylinderGeometry(1.5,1.5,1.4,16),C.HEADER_BLACK,{pos:[-18,TOP+2.5,z*0.8],cast:false}));
 }
 g.add(solid(new BoxGeometry(1.6,0.6,0.9),C.LED_TX_YELLOW,{pos:[-14,TOP+0.3,-10],cast:false}));
 return {apply(){}};
}

const label=(p:NodePin,lang:'en'|'id'):string=>(p.gpio!==undefined?`GPIO${p.gpio}: `:p.silk+': ')+p.note[lang];
const pins:Record<string,PinDef>={};
for(const p of NODE_PINS){
 const t:PinDef['type']=p.kind==='power'?'power':p.kind==='ground'?'ground':p.kind==='analog'||p.kind==='reset'?'input':'output';
 pins[p.key]=pin([px(p.idx),0.5,p.side==='L'?-ROW:ROW],t,label(p,'en'),label(p,'id'));
}

export const nodemcuV3=definePart({
 kind:'nodemcu-v3',name:c('NodeMCU v3 (ESP8266)','NodeMCU v3 (ESP8266)'),
 pins,deskMm:[58,31],
 callouts:[
  callout('module',[L/2-16,TOP+4,0],'ESP-12E module: ESP8266 chip, flash and Wi-Fi antenna','Modul ESP-12E: chip ESP8266, flash dan antena Wi-Fi'),
  callout('usb',[-L/2+1,TOP+4,0],'Micro-USB: power and serial upload','Micro-USB: daya dan unggah serial'),
  callout('buttons',[-18,TOP+4,0],'FLASH (GPIO0) held at reset enters flash mode, RST restarts','FLASH (GPIO0) ditahan saat reset masuk mode flash, RST memulai ulang'),
  callout('adc',[px(0),TOP+2,-ROW],'A0 is the only analog input and reads 0 to 1 V','A0 satu-satunya masukan analog dan membaca 0 sampai 1 V'),
  callout('runtime',[-8,TOP+6,0],'Wiring only: ESP8266 code does not run in the browser (AVR only)','Hanya pengkabelan: kode ESP8266 tidak berjalan di browser (hanya AVR)'),
 ],
 make:build,
});
