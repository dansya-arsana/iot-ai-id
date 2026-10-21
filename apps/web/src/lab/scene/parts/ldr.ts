import {CylinderGeometry,Group,Mesh,MeshBasicMaterial} from 'three';
import type {CanvasTexture} from 'three';
import type {PartProps} from '../../contract';
import {PITCH} from '../layout';
import {canvasTexture,solid} from '../materials';
import * as C from '../palette';
import {noop,hex,leg,definePart,c,pin,callout,type Inner} from './kit';

let squiggle:CanvasTexture|null=null;
function squiggleTex():CanvasTexture{
 if(squiggle)return squiggle;
 const cv=document.createElement('canvas');cv.width=256;cv.height=256;
 const g=cv.getContext('2d')!;
 g.fillStyle=hex(C.LDR_DISC);g.fillRect(0,0,256,256);
 g.strokeStyle=hex(C.LDR_TRACK);g.lineWidth=14;g.lineJoin='round';
 g.beginPath();g.moveTo(44,48);
 for(let i=0;i<5;i++){g.lineTo(212,48+i*40+16);g.lineTo(44,48+i*40+36);}
 g.stroke();
 squiggle=canvasTexture(cv);
 return squiggle;
}
function buildLdr(_p:PartProps,g:Group):Inner{
 const cx=PITCH;
 g.add(leg(0,3),leg(2*PITCH,3));
 g.add(solid(new CylinderGeometry(3.3,3.3,1.8,32),C.LDR_DISC,{outline:true,pos:[cx,3.9,0]}));
 const top=new Mesh(new CylinderGeometry(2.9,2.9,0.05,32),new MeshBasicMaterial({map:squiggleTex(),toneMapped:false}));
 top.material.userData.own=true;
 top.position.set(cx,4.84,0);top.userData.noPick=true;g.add(top);
 return {apply:noop};
}

export const ldr=definePart({kind:'ldr',name:c('Light sensor (LDR)','Sensor cahaya (LDR)'),pins:{A:pin([0,0,0],'passive'),B:pin([2*PITCH,0,0],'passive')},callouts:[callout('eye',[PITCH,5.5,0],'Brighter light = lower resistance','Cahaya lebih terang = hambatan lebih kecil')],make:buildLdr});
