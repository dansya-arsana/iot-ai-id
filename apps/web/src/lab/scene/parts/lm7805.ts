/** LM7805: TO-220 regulator, 10.2 x 4.5 mm plastic body with a metal tab (datasheet outline), three 0.8 mm legs on a 2.54 mm pitch. Pairs with sim/devices/lm7805.ts. */
import {BoxGeometry,CylinderGeometry,Group,Mesh,MeshBasicMaterial,PlaneGeometry} from 'three';
import type {PartProps} from '../../contract';
import type {Lm7805State} from '../../sim/devices/lm7805';
import {PITCH} from '../layout';
import {canvasTexture,solid} from '../materials';
import * as C from '../palette';
import {HALF_PI,MONO,leg,definePart,extState,c,pin,callout,type Inner} from './kit';

function buildLm7805(_p:PartProps,g:Group):Inner{
 const cx=PITCH;
 for(let i=0;i<3;i++)g.add(leg(i*PITCH,4));
 // plastic body: 10.2 wide, 4.5 deep, 9 tall above the leg shoulder
 g.add(solid(new BoxGeometry(10.2,9,4.5),C.CHIP,{outline:true,edges:true,pos:[cx,4+4.5,0.4]}));
 // metal tab behind the body: 10.2 wide, 1.3 thick, 6.5 above the body, with the 3.8 mm mounting hole
 const tab=solid(new BoxGeometry(10.2,15.5,1.3),C.SILVER,{outline:true,pos:[cx,4+7.75,-2.4],finish:'metal'});
 g.add(tab);
 const hole=solid(new CylinderGeometry(1.9,1.9,1.6,20),C.HOLE,{rot:[HALF_PI,0,0],pos:[cx,4+9+3.8,-2.4],cast:false});
 g.add(hole);
 // printed type on the front face
 const cv=document.createElement('canvas');cv.width=256;cv.height=96;
 const k=cv.getContext('2d')!;k.fillStyle=C.CHIP_PRINT;k.textAlign='center';k.textBaseline='middle';k.font=`600 54px ${MONO}`;k.fillText('7805',128,48);
 const label=new Mesh(new PlaneGeometry(8,3),new MeshBasicMaterial({map:canvasTexture(cv),transparent:true,toneMapped:false,depthWrite:false}));
 label.material.userData.own=true;label.material.userData.ownMap=true;label.position.set(cx,4+5,2.7);label.userData.noPick=true;label.userData.noInk=true;g.add(label);
 return {apply(s){extState<Lm7805State>(s,'lm7805');}};
}

export const lm7805=definePart({
 kind:'lm7805',name:c('LM7805 regulator (5 V)','Regulator LM7805 (5 V)'),
 pins:{IN:pin([0,0,0],'power','IN (7-35 V)','IN (7-35 V)'),GND:pin([PITCH,0,0],'ground','Ground','Ground'),OUT:pin([2*PITCH,0,0],'output','OUT (5 V)','OUT (5 V)')},
 callouts:[callout('tab',[PITCH,22,-2.4],'The metal tab is ground and carries the heat','Tab logam adalah ground dan membawa panas'),callout('body',[PITCH,10,2.7],'Left to right: IN, GND, OUT','Kiri ke kanan: IN, GND, OUT')],
 make:buildLm7805,
});
