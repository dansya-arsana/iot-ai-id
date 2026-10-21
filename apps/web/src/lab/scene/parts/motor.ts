import {BoxGeometry,CylinderGeometry,Group} from 'three';
import type {PartProps} from '../../contract';
import {MOTOR_MAX_RPM} from '../../contract';
import {solid} from '../materials';
import * as C from '../palette';
import {clamp01,HALF_PI,definePart,c,pin,callout,type Inner} from './kit';

function buildMotor(p:PartProps,g:Group):Inner{
 const load=clamp01(Number(p.load??0)/100);
 const y=11.5;
 g.add(solid(new CylinderGeometry(11,11,24,40),C.MOTOR_CAN,{outline:true,rot:[0,0,HALF_PI],pos:[0,y,0],finish:'metal'}));
 g.add(solid(new CylinderGeometry(11.2,11.2,3,40),C.MOTOR_CAP,{rot:[0,0,HALF_PI],pos:[-12,y,0]}));
 g.add(solid(new CylinderGeometry(3.2,3.2,3,20),C.SILVER,{rot:[0,0,HALF_PI],pos:[13.5,y,0],finish:'metal'}));
 g.add(solid(new CylinderGeometry(1.1,1.1,12,12),C.SILVER,{rot:[0,0,HALF_PI],pos:[19,y,0],finish:'metal'}));
 for(const sz of [-1,1])g.add(solid(new BoxGeometry(3,0.4,1.6),C.GOLD,{pos:[-14.5,y,sz*3.2],cast:false,finish:'gold'}));
 const spin=new Group();spin.position.set(24,y,0);g.add(spin);
 for(let i=0;i<3;i++){
  const blade=solid(new BoxGeometry(0.9,9,3.2),C.FAN,{outline:true,pos:[0,4.5,0]});
  const holder=new Group();holder.rotation.x=(i*2*Math.PI)/3;holder.add(blade);spin.add(holder);
 }
 return {
  apply(s,dt){
   if(s.kind!=='motor')return;
   spin.rotation.x+=clamp01(s.rpm/MOTOR_MAX_RPM)*(1-0.75*load)*4*2*Math.PI*dt/1000; // load slows the shaft
  },
 };
}

export const motor=definePart({kind:'motor',name:c('DC motor','Motor DC'),pins:{'+':pin([-14.5,11.5,3.2],'power','Plus','Plus'),'-':pin([-14.5,11.5,-3.2],'ground','Minus','Minus')},deskMm:[48,24],callouts:[callout('shaft',[24,11.5,0],'Spins faster with more power','Berputar lebih cepat dengan daya lebih besar')],interact:{controls:[{type:'range',key:'load',label:c('Load on the shaft','Beban pada poros'),min:0,max:100,step:5,unit:'%'},{type:'action',action:'focus',label:c('Zoom to it','Perbesar ke sini')}]},make:buildMotor});
