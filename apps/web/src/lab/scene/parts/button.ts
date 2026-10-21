import {CylinderGeometry,Group} from 'three';
import {RoundedBoxGeometry} from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';
import type {PartProps} from '../../contract';
import {PITCH} from '../layout';
import {solid} from '../materials';
import * as C from '../palette';
import {leg,definePart,c,pin,callout,type Inner} from './kit';

function buildButton(_p:PartProps,g:Group):Inner{
 const cx=PITCH;
 g.add(solid(new RoundedBoxGeometry(7,3.8,7,3,0.5),C.HEADER_BLACK,{outline:true,pos:[cx,0.9+1.9,0]}));
 for(const sx of [-1,1])for(const sz of [-1,1])g.add(leg(cx+sx*3.5,2.4,sz*2.4));
 g.add(leg(0,1.4),leg(2*PITCH,1.4));
 const cap=solid(new CylinderGeometry(2.6,2.6,2.4,28),C.BUTTON_CAP,{outline:true,pos:[cx,0.9+3.8+1.2,0]});
 g.add(cap);
 const y0=cap.position.y;let cur=0;
 return {
  
  apply(s,dt){
   if(s.kind!=='button')return;
   cur+=((s.pressed?1:0)-cur)*Math.min(1,dt/35);
   cap.position.y=y0-0.7*cur;
  },
 };
}

export const button=definePart({kind:'button',name:c('Push button','Tombol tekan'),pins:{'1':pin([0,0,0],'passive'),'2':pin([2*PITCH,0,0],'passive')},callouts:[callout('cap',[PITCH,8,0],'Click to press','Klik untuk menekan')],interact:{drag:{handle:'press',cursor:{hover:'pointer',active:'pointer'}}},make:buildButton});
