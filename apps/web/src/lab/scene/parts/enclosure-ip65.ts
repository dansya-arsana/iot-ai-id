/** ENCLOSURE-IP65: light-grey ABS box, slightly domed grey or clear lid, four corner screws, inner mounting plate, black glands with dome nuts on the bottom face, optional breather. Sizes from the device. Own work. */
import {BoxGeometry,CylinderGeometry,Group,SphereGeometry} from 'three';
import {RoundedBoxGeometry} from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';
import type {PartProps} from '../../contract';
import {glandCount,glandOf,sizeOf,type EnclosureState} from '../../sim/devices/enclosure-ip65';
import {solid} from '../materials';
import * as C from '../palette';
import {addShadow,definePart,extState,c,callout,type Inner} from './kit';

const BOX=0xd6d9dd; // ds-allow-hex  light grey ABS
const PLATE=0xe8e2cf; // ds-allow-hex  beige mounting plate

function buildBox(p:PartProps,g:Group):Inner{
 const s=sizeOf(p),{l,w,h}=s,n=glandCount(p),gl=glandOf(p);
 const body=new Group();body.userData.section=true; // convention proposal: a future section tool can cut this
 const wall=3;
 // walls and floor (open top so the plate shows when the lid is clear)
 body.add(solid(new BoxGeometry(l,wall,w),BOX,{outline:true,pos:[0,wall/2,0]}));
 body.add(solid(new BoxGeometry(l,h,wall),BOX,{outline:true,pos:[0,h/2,w/2-wall/2]}));
 body.add(solid(new BoxGeometry(l,h,wall),BOX,{outline:true,pos:[0,h/2,-w/2+wall/2]}));
 body.add(solid(new BoxGeometry(wall,h,w-2*wall),BOX,{outline:true,pos:[l/2-wall/2,h/2,0]}));
 body.add(solid(new BoxGeometry(wall,h,w-2*wall),BOX,{outline:true,pos:[-l/2+wall/2,h/2,0]}));
 g.add(body);
 g.add(solid(new BoxGeometry(s.plate[0],1.6,s.plate[1]),PLATE,{pos:[0,wall+1,0],cast:false}));
 const lid=new Group();lid.userData.section=true;
 const clear=p.lid==='clear';
 const lidMesh=solid(new RoundedBoxGeometry(l,6,w,2,2),clear?C.FILL:BOX,{outline:true,pos:[0,h+3,0],own:true});
 if(clear){const m=lidMesh.material as unknown as {transparent:boolean;opacity:number};m.transparent=true;m.opacity=0.35;}
 lid.add(lidMesh);
 lid.add(solid(new SphereGeometry(Math.min(l,w)*0.5,20,8,0,Math.PI*2,0,0.35).scale(l/Math.min(l,w)*0.9,0.18,w/Math.min(l,w)*0.9),clear?C.FILL:BOX,{pos:[0,h+6,0],cast:false}));
 for(const sx of [-1,1])for(const sz of [-1,1])lid.add(solid(new CylinderGeometry(3,3,2,12),C.SILVER_DARK,{pos:[sx*(l/2-9),h+7,sz*(w/2-9)],cast:false,finish:'metal'}));
 g.add(lid);
 // glands on the bottom face (front wall, near the floor) with dome nuts
 const r=gl.holeMm/2+2;
 for(let i=0;i<n;i++){
  const x=(i-(n-1)/2)*Math.min(l/(n+0.5),gl.holeMm*2.4);
  g.add(solid(new CylinderGeometry(r,r,10,14),C.HEADER_BLACK,{outline:true,pos:[x,wall+r+2,w/2+4],rot:[Math.PI/2,0,0]}));
  g.add(solid(new SphereGeometry(r*0.9,12,8,0,Math.PI*2,0,Math.PI/2),C.HEADER_BLACK,{pos:[x,wall+r+2,w/2+9],rot:[Math.PI/2,0,0],cast:false}));
 }
 if(p.breather!==false)g.add(solid(new CylinderGeometry(4,4,5,12),C.CREAM_DARK,{pos:[l/2-18,h-8,w/2+2],rot:[Math.PI/2,0,0],cast:false}));
 addShadow(g,l+14,w+14,0.3,5,0,0.03,0);
 return {apply(st){const x=extState<EnclosureState>(st,'enclosure-ip65');if(!x)return;g.scale.setScalar(1);}};
}

export const enclosureIp65=definePart({
 kind:'enclosure-ip65',name:c('IP65 junction box','Kotak sambungan IP65'),deskMm:[210,130],
 pins:{},
 callouts:[
  callout('glands',[0,20,70],'Glands on the bottom face only: leave a drip loop on every cable','Gland hanya di sisi bawah: beri lengkung tetes pada setiap kabel'),
  callout('lid',[0,80,0],'Gasket and four lid screws keep out dust and water jets (IP65)','Packing dan empat sekrup tutup menahan debu dan semprotan air (IP65)'),
  callout('breather',[80,67,62],'Breather plug lets humid air out: condensation is common in the tropics','Sumbat napas melepas udara lembap: kondensasi umum di daerah tropis'),
  callout('plate',[0,6,0],'Mounting plate for the node electronics','Pelat dudukan untuk elektronik node'),
 ],
 make:buildBox,
});
