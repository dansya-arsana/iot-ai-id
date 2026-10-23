/**
 * LoRa/GPS HAT for the Raspberry Pi: 65 x 56.5 mm HAT outline, mounting holes on a 58 x 49 mm rectangle (raspberrypi/hats mechanical spec),
 * a 2x20 header at 2.54 mm pitch along one long edge, about 12 mm standoffs, an RFM95-style can, an SMA jack with a stub antenna,
 * a GPS patch module and a CR1220 holder. Modelled by us, no brand, no vendor model. MODEL ONLY. Pairs with sim/devices/rpi-lora-hat.ts.
 */
import {BoxGeometry,CylinderGeometry,Group} from 'three';
import type {PartProps} from '../../contract';
import {HAT_PINS} from '../../sim/devices/rpi-lora-hat';
import {solid} from '../materials';
import * as C from '../palette';
import {definePart,c,pin,callout,type Inner} from './kit';
import type {PinDef} from './types';

const L=65,W=56.5,TH=1.6,BY=12,TOP=BY+TH,P=2.54;   // HAT length (x), width (z), PCB thickness, standoff height, pitch
const ZE=-W/2;                                      // header edge
/** Header pin n (1-40) on the top of the board: even pins are the outer row. */
const hdr=(n:number):[number,number,number]=>[-24.13+Math.floor((n-1)/2)*P,TOP+2.5,ZE+(n%2===0?2.23:4.77)];
const ANT:[number,number,number]=[L/2-4,TOP+3,6];

function buildHat(_p:PartProps,g:Group):Inner{
 g.add(solid(new BoxGeometry(L,TH,W),C.CHIP,{outline:true,edges:true,pos:[0,BY+TH/2,0],cast:true}));
 // standoffs on the 58 x 49 hole rectangle (3.5 mm in from the header-side corner)
 for(const [x,z] of [[-29,ZE+3.5],[29,ZE+3.5],[-29,ZE+3.5+49],[29,ZE+3.5+49]] as const)g.add(solid(new CylinderGeometry(2.6,2.6,BY,6),C.SILVER_DARK,{pos:[x,BY/2,z],cast:false,finish:'metal'}));
 // 2x20 stacking header with long pins
 g.add(solid(new BoxGeometry(20*P,2.5,2*P),C.HEADER_BLACK,{outline:true,pos:[0,TOP+1.25,ZE+3.5],cast:true}));
 for(let n=1;n<=40;n++){const [x,,z]=hdr(n);g.add(solid(new BoxGeometry(0.64,6,0.64),C.GOLD,{pos:[x,TOP+3,z],cast:false,finish:'metal'}));}
 // RFM95-style can on its PCB
 g.add(solid(new BoxGeometry(16,1,16),C.PCB_DARK,{outline:true,pos:[10,TOP+0.5,12],cast:false}));
 g.add(solid(new BoxGeometry(11,1.4,11),C.SILVER,{outline:true,edges:true,pos:[8.5,TOP+1.7,10.5],finish:'metal'}));
 // SMA jack on the +x edge and a stub antenna
 g.add(solid(new CylinderGeometry(3,3,5,6),C.SILVER,{outline:true,pos:[ANT[0],TOP+2.5,ANT[2]],finish:'metal'}));
 g.add(solid(new CylinderGeometry(0.8,0.8,3,10),C.GOLD,{pos:[ANT[0],TOP+6.5,ANT[2]],cast:false,finish:'metal'}));
 g.add(solid(new CylinderGeometry(3.3,3.3,6,10),C.HEADER_BLACK,{outline:true,pos:[ANT[0],TOP+8,ANT[2]],cast:false}));
 g.add(solid(new CylinderGeometry(1.7,1.7,28,14),C.HEADER_BLACK,{outline:true,pos:[ANT[0],TOP+25,ANT[2]],cast:false}));
 // GPS patch module (cream ceramic square on a small PCB) and CR1220 holder
 g.add(solid(new BoxGeometry(18,1,18),C.PCB_DARK,{pos:[-17,TOP+0.5,14],cast:false}));
 g.add(solid(new BoxGeometry(15,4,15),C.CREAM,{outline:true,edges:true,pos:[-17,TOP+3,14],cast:false}));
 g.add(solid(new CylinderGeometry(7.5,7.5,3.2,24),C.SILVER,{outline:true,pos:[-5,TOP+1.6,19],finish:'metal',cast:false}));
 return {apply(){}};
}

const pins:Record<string,PinDef>={};
for(const p of HAT_PINS){
 if(p.header===null){pins[p.key]=pin(ANT,'passive',`${p.key}: ${p.note.en}`,`${p.key}: ${p.note.id}`);continue;}
 const t:PinDef['type']=p.role==='power'?'power':p.role==='ground'?'ground':p.role==='DIO0'||p.role==='DIO1'||p.role==='DIO2'||p.role==='MISO'||p.role==='GPS TX'?'output':'input';
 pins[p.key]=pin(hdr(p.header),t,`${p.key} (pin ${p.header}): ${p.note.en}`,`${p.key} (pin ${p.header}): ${p.note.id}`);
}

export const rpiLoraHat=definePart({
 kind:'rpi-lora-hat',name:c('LoRa/GPS HAT for Raspberry Pi','HAT LoRa/GPS untuk Raspberry Pi'),
 pins,deskMm:[66,57],
 callouts:[
  callout('radio',[8.5,TOP+3,10.5],'Radio module (SX1276): the LoRa link, 868/915 class','Modul radio (SX1276): tautan LoRa, kelas 868/915'),
  callout('antenna',[ANT[0],TOP+14,ANT[2]],'SMA antenna jack: never transmit without an antenna','Konektor antena SMA: jangan memancar tanpa antena'),
  callout('nss',hdr(22),'Chip select is GPIO25 (pin 22), a manual pin, not CE0','Chip select adalah GPIO25 (pin 22), pin manual, bukan CE0'),
  callout('gps',[-17,TOP+6,14],'GPS module on the serial port (GPIO14 and GPIO15)','Modul GPS di port serial (GPIO14 dan GPIO15)'),
  callout('single',[-8,TOP+1,-4],'Single channel only: good for point-to-point, not a LoRaWAN gateway','Satu kanal saja: cocok titik-ke-titik, bukan gateway LoRaWAN'),
 ],
 make:buildHat,
});
