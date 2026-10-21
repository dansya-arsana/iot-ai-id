import {BoxGeometry,CylinderGeometry,Group} from 'three';
import {RoundedBoxGeometry} from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';
import type {PartProps} from '../../contract';
import {PITCH} from '../layout';
import {solid} from '../materials';
import * as C from '../palette';
import {definePart,c,pin,callout,type Inner} from './kit';

function buildServo(p:PartProps,g:Group):Inner{
 const load=Math.min(1,Math.max(0,Number(p.load??0)/100));
 let cur:number|null=null;
 g.add(solid(new RoundedBoxGeometry(23,22,12,3,0.8),C.SERVO_BLUE,{outline:true,pos:[0,11,0]}));
 g.add(solid(new BoxGeometry(33,2.2,12),C.SERVO_BLUE,{outline:true,edges:true,pos:[0,17,0]}));
 for(const sx of [-1,1])g.add(solid(new CylinderGeometry(1,1,2.4,10),C.HOLE,{pos:[sx*14,17,0],cast:false}));
 g.add(solid(new CylinderGeometry(3.4,3.4,3,24),C.SERVO_HORN,{pos:[5,23.5,0]}));
 const horn=new Group();horn.position.set(5,25.4,0);g.add(horn);
 horn.add(solid(new BoxGeometry(18,1.6,4.2),C.SERVO_HORN,{outline:true,pos:[8,0,0]}));
 horn.add(solid(new CylinderGeometry(2.6,2.6,1.6,20),C.SERVO_HORN,{outline:true,pos:[0,0,0]}));
 for(let i=0;i<3;i++)g.add(solid(new BoxGeometry(2.4,2.4,2.4),C.HEADER_BLACK,{pos:[-12.4,8,(i-1)*PITCH],cast:false}));
 return {
  apply(s,dt){
   if(s.kind!=='servo')return;
   // a loaded horn lags behind the commanded angle (heavier load, slower approach)
   if(cur===null||load===0)cur=s.angleDeg;
   else cur+=(s.angleDeg-cur)*Math.min(1,(dt/1000)*14*(1-0.88*load));
   horn.rotation.y=(cur*Math.PI)/180;
  },
 };
}


export const servo=definePart({kind:'servo',name:c('Servo','Servo'),pins:{SIG:pin([-13.6,8,-PITCH],'input','Signal','Sinyal'),V:pin([-13.6,8,0],'power','5V','5V'),GND:pin([-13.6,8,PITCH],'ground','Ground','Ground')},deskMm:[33,12],callouts:[callout('horn',[5,28,0],'The horn turns to the angle you ask for','Lengan berputar ke sudut yang diminta')],interact:{controls:[{type:'range',key:'load',label:c('Load on the horn','Beban pada lengan'),min:0,max:100,step:5,unit:'%'},{type:'action',action:'focus',label:c('Zoom to it','Perbesar ke sini')}]},make:buildServo});
