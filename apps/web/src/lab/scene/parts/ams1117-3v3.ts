/** AMS1117-3.3: SOT-223 regulator (6.5 x 3.5 mm body, wide tab) on a small 15 x 11 mm breakout with two capacitors. Pairs with sim/devices/ams1117-3v3.ts. */
import {BoxGeometry,CylinderGeometry,Group} from 'three';
import type {PartProps} from '../../contract';
import type {Ams1117State} from '../../sim/devices/ams1117-3v3';
import {PITCH} from '../layout';
import {solid} from '../materials';
import * as C from '../palette';
import {leg,definePart,extState,c,pin,callout,type Inner} from './kit';

function buildAms1117(_p:PartProps,g:Group):Inner{
 const cx=PITCH;
 for(let i=0;i<3;i++)g.add(leg(i*PITCH,3));
 // breakout board, standing flat on three short legs
 g.add(solid(new BoxGeometry(15,1.4,11),C.PCB,{outline:true,edges:true,pos:[cx,3.7,-1]}));
 // SOT-223 package: 6.5 x 3.5 mm body, 6.9 x 1.7 mm heat tab on the far side, three gull-wing legs
 g.add(solid(new BoxGeometry(6.5,1.7,3.5),C.CHIP,{outline:true,pos:[cx,5.25,-1]}));
 g.add(solid(new BoxGeometry(3.4,0.5,1.8),C.SILVER,{pos:[cx,5.1,-3.8],finish:'metal',cast:false}));
 for(const sx of [-2.3,0,2.3])g.add(solid(new BoxGeometry(0.7,0.3,1.4),C.SILVER,{pos:[cx+sx,4.6,1.4],finish:'metal',cast:false}));
 // two electrolytic-style smoothing capacitors (10 uF), lying on the board
 for(const sx of [-4.6,4.6])g.add(solid(new CylinderGeometry(1.6,1.6,3,16),0x1b2230,{outline:true,pos:[cx+sx,6,-1.5]})); // ds-allow-hex  (capacitor sleeve)
 return {apply(s){extState<Ams1117State>(s,'ams1117-3v3');}};
}

export const ams1117=definePart({
 kind:'ams1117-3v3',name:c('AMS1117-3.3 regulator','Regulator AMS1117-3.3'),
 pins:{VIN:pin([0,0,0],'power','VIN (4.4-15 V)','VIN (4,4-15 V)'),GND:pin([PITCH,0,0],'ground','Ground','Ground'),VOUT:pin([2*PITCH,0,0],'output','VOUT (3.3 V)','VOUT (3,3 V)')},
 callouts:[callout('chip',[PITCH,8,-1],'SOT-223 regulator: 5 V in, 3.3 V out','Regulator SOT-223: masuk 5 V, keluar 3,3 V')],
 make:buildAms1117,
});
