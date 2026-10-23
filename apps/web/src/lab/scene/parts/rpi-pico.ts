/** Raspberry Pi Pico (RP2040): 51 x 21 mm, castellated pads at 2.54 mm, rows 17.78 mm apart (model only). Pico datasheet mechanical drawing, modelled by us. Guide: docs/lab-extending.md */
import {BoxGeometry,CylinderGeometry,Group} from 'three';
import type {PartProps} from '../../contract';
import {PICO_PINS,type PicoPin} from '../../sim/devices/rpi-pico';
import {solid} from '../materials';
import * as C from '../palette';
import {PI_PCB_GREEN} from '../rpi-body';
import {definePart,c,pin,callout,type Inner} from './kit';
import type {PinDef} from './types';

const L=51,W=21,TH=1,BY=1.5,ROW=8.89,P=2.54,TOP=BY+TH;
const byKey=(k:string):PicoPin=>PICO_PINS.find(p=>p.key===k)!;
const at=(p:PicoPin):[number,number,number]=>{
 if(p.phys===undefined)return [22.5,TOP,{SWCLK:-P,GND_D:0,SWDIO:P}[p.key]!];
 return p.phys<=20?[-24.13+(p.phys-1)*P,TOP,-ROW]:[-24.13+(40-p.phys)*P,TOP,ROW];
};

function build(_p:PartProps,g:Group):Inner{
 g.add(solid(new BoxGeometry(L,TH,W),PI_PCB_GREEN,{outline:true,edges:true,pos:[0,BY+TH/2,0],cast:true,finish:'pcb'}));
 for(const p of PICO_PINS)g.add(solid(new CylinderGeometry(0.8,0.8,0.1,10),C.GOLD,{pos:[at(p)[0],TOP+0.05,at(p)[2]],cast:false,finish:'metal'}));
 g.add(solid(new BoxGeometry(7,0.9,7),C.CHIP,{outline:true,pos:[2,TOP+0.45,0]}));                                  // RP2040 QFN
 g.add(solid(new BoxGeometry(5,0.9,6),C.CHIP,{pos:[11,TOP+0.45,-2],cast:false}));                                  // W25Q16 flash
 g.add(solid(new BoxGeometry(5.6,2.8,7.6),C.SILVER,{outline:true,pos:[-L/2+2,TOP+1.4,0],finish:'metal'}));          // micro-USB
 g.add(solid(new BoxGeometry(4,1.6,4),C.SILVER_DARK,{pos:[-17,TOP+0.8,-3],finish:'metal',cast:false}));              // BOOTSEL
 g.add(solid(new BoxGeometry(1.6,0.6,0.9),C.LED_ON_GREEN,{pos:[-10,TOP+0.3,5],cast:false}));                       // LED (GP25)
 return {apply(){}};
}

const pins:Record<string,PinDef>={};
for(const p of PICO_PINS)pins[p.key]=pin(at(p),p.kind==='power'?'power':p.kind==='ground'?'ground':p.kind==='reset'?'input':'output',`${p.key}: ${p.note.en}`,`${p.key}: ${p.note.id}`);

export const rpiPico=definePart({
 kind:'rpi-pico',name:c('Raspberry Pi Pico','Raspberry Pi Pico'),
 pins,deskMm:[L,W],
 callouts:[
  callout('usb',[-L/2+2,TOP+4,0],'Micro-USB: power (VBUS) and upload; hold BOOTSEL while plugging in for the drive mode','Micro-USB: daya (VBUS) dan unggah; tahan BOOTSEL saat dicolok untuk mode drive'),
  callout('bootsel',[-17,TOP+3,-3],'BOOTSEL button','Tombol BOOTSEL'),
  callout('vsys',[at(byKey('VSYS'))[0],TOP+2,ROW],'VSYS takes 1.8 to 5.5 V; GPIO is 3.3 V and not 5 V tolerant','VSYS menerima 1,8 sampai 5,5 V; GPIO 3,3 V dan tidak tahan 5 V'),
  callout('adc',[at(byKey('GP27'))[0],TOP+2,ROW],'ADC on GP26 to GP28, 12-bit','ADC di GP26 sampai GP28, 12-bit'),
  callout('swd',[22.5,TOP+3,0],'SWD debug pads: SWCLK, GND, SWDIO','Pad debug SWD: SWCLK, GND, SWDIO'),
 ],
 make:build,
});
