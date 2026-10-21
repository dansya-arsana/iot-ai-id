import {BoxGeometry,CylinderGeometry,Group} from 'three';
import type {PartProps} from '../../contract';
import {PITCH} from '../layout';
import {solid} from '../materials';
import * as C from '../palette';
import {noop,HALF_PI,leg,definePart,c,pin,type Inner} from './kit';

function buildTransistor(_p:PartProps,g:Group):Inner{
 const cx=PITCH;
 g.add(leg(0,8),leg(PITCH,8),leg(2*PITCH,8));
 g.add(solid(new BoxGeometry(10,9,4.4),C.CHIP,{outline:true,edges:true,pos:[cx,12.5,0]}));
 g.add(solid(new BoxGeometry(10,6.5,1.2),C.SILVER,{outline:true,pos:[cx,19.3,-1.6],finish:'metal'}));
 g.add(solid(new CylinderGeometry(1.7,1.7,1.4,16),C.HOLE,{rot:[HALF_PI,0,0],pos:[cx,20.5,-1.6],cast:false}));
 return {apply:noop};
}


export const transistor=definePart({kind:'transistor',name:c('Transistor','Transistor'),pins:{B:pin([0,0,0],'base','Base','Basis'),C:pin([PITCH,0,0],'collector','Collector','Kolektor'),E:pin([2*PITCH,0,0],'emitter','Emitter','Emitor')},make:buildTransistor});
