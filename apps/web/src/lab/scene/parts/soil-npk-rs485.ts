/** RS-485 soil NPK/EC/pH probe: dark ABS cylinder (about 45 x 75 mm), stainless needle fork, cable gland and a 4-core cable that splits into four wires. Pairs with sim/devices/soil-npk-rs485.ts. */
import {BoxGeometry,CylinderGeometry,Group} from 'three';
import type {PartProps} from '../../contract';
import {SOIL_NPK_DIMS as D,SOIL_NPK_PINS} from '../../sim/devices/soil-npk-rs485';
import {solid} from '../materials';
import * as C from '../palette';
import {definePart,c,pin,callout,type Inner} from './kit';

// wire colours of the cable ([U]: vendors differ), kept local to this part
const WIRE_HEX:Record<string,number>={brown:0x6b4423,black:0x15161a,yellow:0xe6c35a,blue:0x2a58a8}; // ds-allow-hex  (probe cable core colours: brown, black, yellow, blue)
const R=D.w/2*0.5;   // cylinder radius in mm of the scene (body drawn at half of 45 mm so it fits next to a board; proportions kept)
const BODY_H=D.l*0.5;
const NL=D.needleLenMm*0.5;

function buildNpk(_p:PartProps,g:Group):Inner{
 // lies flat on the desk: axis along x, needles to -x, gland and cable to +x
 const y=R;
 const body=solid(new CylinderGeometry(R,R,BODY_H,28),C.CHIP,{outline:true,pos:[0,y,0],rot:[0,0,Math.PI/2]});
 g.add(body);
 g.add(solid(new CylinderGeometry(R+0.3,R+0.3,2,28),C.HEADER_TOP,{pos:[-BODY_H/2+1,y,0],rot:[0,0,Math.PI/2],cast:false}));
 // stainless needle fork: 3 needles, 3 mm x 60 mm drawn at the same half scale
 const nl=NL;
 for(const z of [-R*0.55,0,R*0.55])g.add(solid(new CylinderGeometry(0.8,0.5,nl,10),C.SILVER,{pos:[-BODY_H/2-nl/2,y,z],rot:[0,0,Math.PI/2],cast:false,finish:'metal'}));
 // cable gland + cable
 g.add(solid(new CylinderGeometry(R*0.4,R*0.5,4,16),C.HEADER_TOP,{pos:[BODY_H/2+2,y,0],rot:[0,0,Math.PI/2],cast:false}));
 g.add(solid(new CylinderGeometry(1.6,1.6,14,12),C.HEADER_BLACK,{pos:[BODY_H/2+10,y,0],rot:[0,0,Math.PI/2],cast:false}));
 // four coloured wires fanning out of the cable
 SOIL_NPK_PINS.forEach((p,i)=>{
  const z=(i-1.5)*2.4;
  g.add(solid(new BoxGeometry(14,1.2,1.2),WIRE_HEX[p.wire]!,{pos:[BODY_H/2+24,y,z],cast:false}));
 });
 return {apply(){}};
}

const WX=BODY_H/2+31,WY=R;
export const soilNpkRs485=definePart({
 kind:'soil-npk-rs485',name:c('Soil NPK / EC / pH probe (RS-485)','Probe tanah NPK / EC / pH (RS-485)'),deskMm:[BODY_H+NL+45,R*2+4],
 pins:{
  VCC:pin([WX,WY,-3.6],'power','V+ (brown, 5-30 V)','V+ (cokelat, 5-30 V)'),
  GND:pin([WX,WY,-1.2],'ground','V- (black)','V- (hitam)'),
  A:pin([WX,WY,1.2],'passive','A+ (yellow, RS-485)','A+ (kuning, RS-485)'),
  B:pin([WX,WY,3.6],'passive','B- (blue, RS-485)','B- (biru, RS-485)'),
 },
 callouts:[
  callout('needles',[-BODY_H/2-NL/2,R+2,0],'Needles fully into the soil, no air gap','Jarum masuk penuh ke tanah, tanpa celah udara'),
  callout('cable',[BODY_H/2+24,R+3,0],'Wire colours vary: check the label before wiring','Warna kabel berbeda tiap merek: cek label sebelum memasang'),
  callout('label',[0,R*2+1,0],'Modbus address 1, 4800 baud 8N1 by default','Alamat Modbus 1, 4800 baud 8N1 secara bawaan'),
 ],
 make:buildNpk,
});
