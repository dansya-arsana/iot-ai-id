/** BATTERY-LIFEPO4-12V: sealed ABS block (retail class sizes, 6/12/20/50 Ah), two terminals with covers, label panel. Own work. */
import {BoxGeometry,CylinderGeometry,Group} from 'three';
import {RoundedBoxGeometry} from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';
import type {PartProps} from '../../contract';
import {lifepo4Case,type Lifepo4State} from '../../sim/devices/battery-lifepo4-12v';
import {solid} from '../materials';
import * as C from '../palette';
import {addShadow,definePart,extState,c,pin,callout,type Inner} from './kit';

const CASE=0x3b4048; // ds-allow-hex  dark grey ABS
const LABEL=0x2f9e6a; // ds-allow-hex  green LFP label stripe
const CAP_RED=0xd23b32; // ds-allow-hex
const CAP_BLACK=0x15171a; // ds-allow-hex
const K=lifepo4Case({ah:12});
const TY=K.h+4;

function buildBlock(p:PartProps,g:Group):Inner{
 const k=lifepo4Case(p),{l,w,h}=k;
 g.add(solid(new RoundedBoxGeometry(l,h,w,3,2),CASE,{outline:true,pos:[0,h/2,0]}));
 g.add(solid(new BoxGeometry(l*0.7,h*0.35,0.6),LABEL,{pos:[0,h*0.55,w/2+0.2],cast:false}));
 g.add(solid(new BoxGeometry(l*0.9,2,w*0.9),C.HEADER_BLACK,{pos:[0,h+0.6,0],cast:false}));
 for(const [sx,col] of [[-1,CAP_RED],[1,CAP_BLACK]] as const){
  g.add(solid(new BoxGeometry(18,3,14),C.SILVER_DARK,{pos:[sx*l*0.3,h+3,0],cast:false,finish:'metal'}));
  g.add(solid(new CylinderGeometry(3.4,3.4,4,14),col,{pos:[sx*l*0.3,h+6,0],cast:false}));
 }
 addShadow(g,l+14,w+14,0.3,4,0,0.03,0);
 return {apply(s){const st=extState<Lifepo4State>(s,'battery-lifepo4-12v');if(!st)return;g.scale.setScalar(1);}};
}
const x0=K.l*0.3;

export const batteryLifepo412v=definePart({
 kind:'battery-lifepo4-12v',name:c('12.8 V LiFePO4 battery','Baterai LiFePO4 12,8 V'),deskMm:[K.l+10,K.w+10],
 pins:{'P+':pin([-x0,TY+6,0],'power','Positive terminal (red cap)','Terminal positif (tutup merah)'),'P-':pin([x0,TY+6,0],'ground','Negative terminal (black cap)','Terminal negatif (tutup hitam)')},
 callouts:[
  callout('bms',[0,K.h*0.55,K.w/2],'Built-in BMS: cuts the output when empty, stops charging below 0 C','BMS bawaan: memutus keluaran saat kosong, menghentikan pengisian di bawah 0 C'),
  callout('lfp',[0,K.h+8,0],'Set the charge controller to LFP by hand; voltage is flat from 20 to 90 %','Atur pengontrol ke LFP manual; tegangan datar dari 20 sampai 90 %'),
 ],
 make:buildBlock,
});
