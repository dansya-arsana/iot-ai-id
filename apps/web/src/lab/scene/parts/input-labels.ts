/** Shared silkscreen helper of the input-module parts (joystick, encoder, touch). Exports no PartModule, so discovery ignores it. */
import {Mesh,MeshBasicMaterial,PlaneGeometry} from 'three';
import {canvasTexture} from '../materials';
import * as C from '../palette';
import {MONO,PITCH} from './kit';

/** One silkscreen row of pin names under the header, aligned to the legs. */
export function labelRow(names:readonly string[],cx:number,w:number,h:number,font=34):Mesh{
 const cv=document.createElement('canvas');cv.width=512;cv.height=Math.round(512*h/w);
 const g=cv.getContext('2d')!;
 g.fillStyle=C.SILKSCREEN;g.textAlign='center';g.textBaseline='middle';g.font=`700 ${font}px ${MONO}`;
 names.forEach((n,i)=>g.fillText(n,((i*PITCH-cx)/w+0.5)*512,cv.height/2));
 const m=new Mesh(new PlaneGeometry(w,h),new MeshBasicMaterial({map:canvasTexture(cv),transparent:true,toneMapped:false,depthWrite:false}));
 m.material.userData.own=true;m.material.userData.ownMap=true;m.userData.noPick=true;m.userData.noInk=true;
 return m;
}

