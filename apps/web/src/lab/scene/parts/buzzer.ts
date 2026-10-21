import {BoxGeometry,CylinderGeometry,Group} from 'three';
import type {PartProps} from '../../contract';
import {PITCH} from '../layout';
import {ringTexture,solid} from '../materials';
import * as C from '../palette';
import {sprite,leg,definePart,c,pin,callout,type Inner} from './kit';

function buildBuzzer(_p:PartProps,g:Group):Inner{
 const cx=1.5*PITCH;
 g.add(leg(0,2),leg(3*PITCH,2));
 g.add(solid(new CylinderGeometry(6.6,6.6,9,40),C.BUZZER_BLACK,{outline:true,pos:[cx,4.5+1,0]}));
 g.add(solid(new CylinderGeometry(1.2,1.2,0.2,16),C.HOLE,{pos:[cx,10.55,0],cast:false}));
 g.add(solid(new BoxGeometry(1.8,0.1,0.9),C.GOLD,{pos:[cx-4.3,10.55,0],cast:false,finish:'gold'}));
 const rings=[0,1].map(()=>sprite(ringTexture(),C.LIVE,10,11,cx,false));
 rings.forEach(r=>g.add(r));
 let t=0;
 return {
  apply(s,dt){
   if(s.kind!=='buzzer')return;
   t+=dt;
   rings.forEach((r,i)=>{
    if(!s.on){r.material.opacity=0;return;}
    const ph=(t/650+i*0.5)%1;
    r.scale.setScalar(12+26*ph);r.material.opacity=(1-ph)*0.8;
   });
  },
 };
}

export const buzzer=definePart({kind:'buzzer',name:c('Buzzer','Buzzer'),pins:{'+':pin([0,0,0],'anode','Plus','Plus'),'-':pin([3*PITCH,0,0],'cathode','Minus','Minus')},callouts:[callout('plus',[0,3,0],'Plus leg goes to a pin','Kaki plus ke pin')],make:buildBuzzer});
