import {CylinderGeometry,Group} from 'three';
import type {PartProps} from '../../contract';
import {PITCH} from '../layout';
import {solid} from '../materials';
import * as C from '../palette';
import {noop,HALF_PI,leg,definePart,c,pin,callout,type Inner} from './kit';

function buildDiode(_p:PartProps,g:Group):Inner{
 const span=3*PITCH,cx=span/2,y=3.8;
 g.add(leg(0,y),leg(span,y));
 g.add(solid(new CylinderGeometry(1.9,1.9,span-1.6,24),C.DIODE_BODY,{outline:true,rot:[0,0,HALF_PI],pos:[cx,y,0]}));
 g.add(solid(new CylinderGeometry(1.96,1.96,0.9,24),C.SILVER,{rot:[0,0,HALF_PI],pos:[span-1.6,y,0],cast:false,finish:'metal'}));
 return {apply:noop};
}

export const diode=definePart({kind:'diode',name:c('Diode','Dioda'),pins:{A:pin([0,0,0],'anode','Anode','Anoda'),K:pin([3*PITCH,0,0],'cathode','Cathode (stripe)','Katoda (garis)')},callouts:[callout('stripe',[3*PITCH-1.6,6,0],'Stripe marks the cathode','Garis menandai katoda')],make:buildDiode});
