import {SphereGeometry,BoxGeometry,BufferAttribute,BufferGeometry,CylinderGeometry,Group,Line,LineDashedMaterial,Mesh,MeshBasicMaterial,PlaneGeometry} from 'three';
import {RoundedBoxGeometry} from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';
import type {CanvasTexture} from 'three';
import type {PartProps} from '../../contract';
import {obstacleMm} from '../layout';
import {canvasTexture,solid} from '../materials';
import * as C from '../palette';
import {HALF_PI,addShadow,definePart,c,callout,type Inner} from './kit';

function hatchTex():CanvasTexture{
 const cv=document.createElement('canvas');cv.width=256;cv.height=192;
 const g=cv.getContext('2d')!;
 g.clearRect(0,0,256,192);g.strokeStyle='rgba(10,10,10,0.28)';g.lineWidth=5;
 for(let i=-192;i<256;i+=22){g.beginPath();g.moveTo(i,192);g.lineTo(i+192,0);g.stroke();}
 g.strokeStyle='rgba(10,10,10,0.5)';g.lineWidth=6;g.strokeRect(8,8,240,176);
 return canvasTexture(cv);
}
function buildObstacle(props:PartProps,g:Group):Inner{
 const shape=props.shape==='car'||props.shape==='ball'||props.shape==='wall'?props.shape:'box';
 const inner=new Group();g.add(inner);
 if(shape==='box'){
  inner.add(solid(new RoundedBoxGeometry(46,30,14,3,2),C.OBSTACLE_BOX,{outline:true,pos:[0,15,7]}));
  const h=new Mesh(new PlaneGeometry(40,24),new MeshBasicMaterial({map:hatchTex(),transparent:true,toneMapped:false,depthWrite:false}));
  h.material.userData.own=true;h.material.userData.ownMap=true;h.position.set(0,15,-0.04);h.rotation.y=Math.PI;h.userData.noPick=true;h.userData.noInk=true;inner.add(h);
  addShadow(inner,46,14,0.35,6,0,0.03,7);
 }else if(shape==='ball'){
  inner.add(solid(new SphereGeometry(13,32,20),C.OBSTACLE_BOX,{outline:true,pos:[0,13,13]}));
  addShadow(inner,26,26,0.35,6,0,0.03,13);
 }else if(shape==='wall'){
  inner.add(solid(new RoundedBoxGeometry(90,34,6,2,1.5),C.OBSTACLE_BOX,{outline:true,pos:[0,17,3]}));
  addShadow(inner,90,6,0.35,6,0,0.03,3);
 }else{
  inner.add(solid(new RoundedBoxGeometry(24,9,46,3,3),C.CAR_BODY,{outline:true,pos:[0,9,23]}));
  inner.add(solid(new RoundedBoxGeometry(20,8,22,3,2.5),C.CAR_BODY,{outline:true,pos:[0,17,27]}));
  inner.add(solid(new BoxGeometry(18.6,5,0.4),C.CAR_GLASS,{pos:[0,17.4,16.0],cast:false,finish:'epoxy'}));
  for(const sx of [-1,1])inner.add(solid(new BoxGeometry(0.4,4.6,16),C.CAR_GLASS,{pos:[sx*10.1,17.4,27],cast:false,finish:'epoxy'}));
  for(const sx of [-1,1]){
   inner.add(solid(new BoxGeometry(3.4,2,0.4),C.LAMP_LIGHT,{pos:[sx*8,10,0.05],cast:false}));
   for(const sz of [10,36]){
    inner.add(solid(new CylinderGeometry(5,5,4,28),C.TIRE,{outline:true,rot:[0,0,HALF_PI],pos:[sx*12.5,5,sz]}));
    inner.add(solid(new CylinderGeometry(2.6,2.6,0.4,20),C.SILVER,{rot:[0,0,HALF_PI],pos:[sx*14.6,5,sz],cast:false,finish:'metal'}));
   }
  }
  addShadow(inner,24,46,0.35,6,0,0.03,23);
 }
 // dashed beam sensor -> obstacle
 const pos=new Float32Array([0,14.5,0,0,14.5,1]);
 const geo=new BufferGeometry();geo.setAttribute('position',new BufferAttribute(pos,3));
 const beam=new Line(geo,new LineDashedMaterial({color:C.LIVE,dashSize:3,gapSize:2.2}));
 beam.material.userData.own=true;beam.userData.noPick=true;beam.userData.noInk=true;g.add(beam);
 let last=-1;
 return {
  apply(s){
   if(s.kind!=='obstacle')return;
   const mm=obstacleMm(s.distanceCm);
   if(mm===last)return;
   last=mm;
   inner.position.z=mm;pos[5]=mm;
   geo.attributes.position!.needsUpdate=true;beam.computeLineDistances();
   geo.computeBoundingSphere();
  },
 };
}

export const obstacle=definePart({kind:'obstacle',name:c('Obstacle','Halangan'),pins:{},deskMm:[46,46],callouts:[callout('drag',[0,32,10],'Drag me closer or farther','Seret aku lebih dekat atau jauh')],interact:{drag:{handle:'slide-z',prop:'distanceCm',range:[3,250]},controls:[{type:'choice',key:'shape',label:c('Type','Jenis'),options:[{value:'car',label:c('Car','Mobil')},{value:'box',label:c('Box','Kotak')},{value:'ball',label:c('Ball','Bola')},{value:'wall',label:c('Wall','Dinding')}]},{type:'range',key:'distanceCm',label:c('Distance','Jarak'),min:3,max:250,step:1,unit:'cm'},{type:'toggle',key:'sweep',label:c('Drive back and forth while running','Maju-mundur saat berjalan')},{type:'action',action:'focus',label:c('Zoom to it','Perbesar ke sini')}]},make:buildObstacle});
