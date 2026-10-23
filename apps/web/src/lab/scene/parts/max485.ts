/** MAX485 TTL-to-RS-485 module (about 44 x 14 mm): blue PCB, SOIC-8 chip, power LED, blue 2-way screw terminal, 120 ohm SMD. Pairs with sim/devices/max485.ts. */
import {BoxGeometry,Color,Group,MeshStandardMaterial} from 'three';
import type {PartProps} from '../../contract';
import {MAX485_DIMS as D,type Max485State} from '../../sim/devices/max485';
import {PITCH} from '../layout';
import {solid} from '../materials';
import * as C from '../palette';
import {leg,definePart,extState,c,pin,callout,type Inner} from './kit';

const Y0=5,T=1.4,TOP=Y0+T;   // board underside, thickness, top face
const X0=-2,CX=X0+D.l/2;     // board spans x -2..42, centred on z 0 (legs at the left end)
const BUS_X=[33,35.5,38,40.5] as const;   // VCC B A GND header at the far end
const TERM_X=[24,29] as const;            // A and B screw terminal poles

function buildMax485(_p:PartProps,g:Group):Inner{
 for(let i=0;i<4;i++)g.add(leg(i*PITCH,Y0));
 g.add(solid(new BoxGeometry(D.l,T,D.w),C.SONAR_PCB,{outline:true,edges:true,pos:[CX,Y0+T/2,0]}));
 // logic header (pins up through the board) and bus header
 g.add(solid(new BoxGeometry(4*PITCH,2.4,2.4),C.HEADER_BLACK,{pos:[1.5*PITCH,TOP+1.2,-D.w/2+1.8],cast:false}));
 g.add(solid(new BoxGeometry(4*PITCH,2.4,2.4),C.HEADER_BLACK,{pos:[(BUS_X[0]+BUS_X[3])/2,TOP+1.2,D.w/2-1.8],cast:false}));
 // MAX485 in SOIC-8 (4.9 x 3.9 mm)
 g.add(solid(new BoxGeometry(4.9,1.4,3.9),C.CHIP,{pos:[14,TOP+0.7,0],cast:false}));
 // blue 2-way 5.0 mm screw terminal
 g.add(solid(new BoxGeometry(10.2,7.5,8),C.BUTTON_CAP,{outline:true,pos:[26.5,TOP+3.75,-1.5]}));
 for(const x of TERM_X)g.add(solid(new BoxGeometry(3.6,0.4,3.6),C.SILVER,{pos:[x+0.0,TOP+7.6,-1.5],cast:false,finish:'metal'}));
 // 120 ohm termination resistor (SMD 0805, marked in the callout) and a few passives
 g.add(solid(new BoxGeometry(2,0.6,1.2),C.RESISTOR_BODY,{pos:[19,TOP+0.3,-4],cast:false}));
 for(const x of [8,10.5])g.add(solid(new BoxGeometry(1.6,0.5,1),C.CREAM_DARK,{pos:[x,TOP+0.25,3.5],cast:false}));
 // power LED: red/green SMD, glows while the module is powered
 const led=solid(new BoxGeometry(1.6,0.6,0.9),C.LED_SMD_OFF,{pos:[7,TOP+0.3,-3.5],cast:false,own:true});
 g.add(led);
 const mat=led.material as MeshStandardMaterial;
 const off=new Color(C.LED_SMD_OFF),on=new Color(C.LED_ON_GREEN);
 return {
  apply(s){
   const st=extState<Max485State>(s,'max485');
   mat.color.copy(st&&(st.driverOn||st.busBytes>0)?on:off);
  },
 };
}

export const max485=definePart({
 kind:'max485',name:c('MAX485 RS-485 module','Modul RS-485 MAX485'),
 pins:{
  RO:pin([0*PITCH,0,0],'output','RO (receiver out, 5 V)','RO (keluaran penerima, 5 V)'),
  RE:pin([1*PITCH,0,0],'input','RE (receive enable, active low)','RE (enable terima, aktif low)'),
  DE:pin([2*PITCH,0,0],'input','DE (driver enable, active high)','DE (enable kirim, aktif high)'),
  DI:pin([3*PITCH,0,0],'input','DI (driver in)','DI (masukan kirim)'),
  VCC:pin([BUS_X[0],TOP+2.4,D.w/2-1.8],'power','VCC (5 V)','VCC (5 V)'),
  B:pin([BUS_X[1],TOP+2.4,D.w/2-1.8],'passive','B (bus D-)','B (bus D-)'),
  A:pin([BUS_X[2],TOP+2.4,D.w/2-1.8],'passive','A (bus D+)','A (bus D+)'),
  GND:pin([BUS_X[3],TOP+2.4,D.w/2-1.8],'ground','Ground','Ground'),
  A_T:pin([TERM_X[0],TOP+7.8,-1.5],'passive','A terminal','Terminal A'),
  B_T:pin([TERM_X[1],TOP+7.8,-1.5],'passive','B terminal','Terminal B'),
 },
 callouts:[
  callout('de',[2*PITCH,TOP+4,-D.w/2],'DE and RE: bridge them to one pin, high = transmit','DE dan RE: jumper ke satu pin, high = kirim'),
  callout('term',[26.5,TOP+9,-1.5],'A/B screw terminal to the bus cable','Terminal sekrup A/B ke kabel bus'),
  callout('r120',[19,TOP+2,-4],'120 ohm terminator: keep it only at the two ends of the bus','Terminator 120 ohm: pasang hanya di dua ujung bus'),
  callout('v5',[14,TOP+3,0],'RO swings to 5 V: divide it before a 3.3 V pin','RO naik sampai 5 V: bagi dulu sebelum pin 3,3 V'),
 ],
 make:buildMax485,
});
