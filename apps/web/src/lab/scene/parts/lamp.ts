import {BackSide,Color,ConeGeometry,CylinderGeometry,DoubleSide,Group,Mesh,MeshBasicMaterial,MeshStandardMaterial} from 'three';
import type {PartProps} from '../../contract';
import {lampMm} from '../layout';
import {addOutline,glowTexture,ownToon,solid} from '../materials';
import * as C from '../palette';
import {sprite,addShadow,definePart,c,callout,type Inner} from './kit';

function buildLamp(_p:PartProps,g:Group):Inner{
 const inner=new Group();g.add(inner);
 inner.add(solid(new CylinderGeometry(10,11,3,36),C.LAMP_BODY,{outline:true,pos:[0,1.5,0]}));
 inner.add(solid(new CylinderGeometry(1.6,1.6,34,12),C.SILVER,{outline:true,pos:[0,19,0],finish:'metal'}));
 const head=new Group();head.position.set(0,37,0);head.rotation.z=-0.55;inner.add(head);
 const shadeMat=ownToon(C.LAMP_BODY);shadeMat.side=DoubleSide;
 const shade=new Mesh(new ConeGeometry(11,12,36,1,true),shadeMat);shade.castShadow=true;head.add(shade);addOutline(shade);
 const lit=new MeshStandardMaterial({color:C.LAMP_LIGHT,emissive:C.LAMP_LIGHT,emissiveIntensity:0,side:BackSide,roughness:1});lit.userData.own=true;
 const inside=new Mesh(new ConeGeometry(10.5,11.5,36,1,true),lit);inside.userData.noPick=true;inside.userData.noInk=true;head.add(inside);
 const bulb=new Mesh(new CylinderGeometry(3,3,3,16),ownToon(C.LAMP_LIGHT));bulb.position.set(0,-4,0);head.add(bulb);
 const bulbMat=bulb.material as MeshStandardMaterial;
 const cone=new Mesh(new ConeGeometry(18,38,32,1,true),new MeshBasicMaterial({color:C.LAMP_LIGHT,transparent:true,opacity:0.2,depthWrite:false}));
 cone.material.userData.own=true;cone.position.set(0,-25,0);cone.userData.noPick=true;cone.userData.noInk=true;
 head.add(cone);
 const hs=new Group();hs.name='hotspot';hs.userData.noPick=true;head.add(hs);
 const glow=sprite(glowTexture(),C.LAMP_LIGHT,34,-4,0,false);head.add(glow);
 addShadow(inner,24,24,0.35,6,0,0.03,0);
 const dim=new Color(C.SILVER_DARK),on=new Color(C.LAMP_LIGHT);
 return {
  apply(s){
   if(s.kind!=='lamp')return;
   inner.position.x=lampMm(s.distanceCm);
   cone.visible=s.on;glow.material.opacity=s.on?0.7:0;
   lit.emissiveIntensity=s.on?1.6:0;bulbMat.emissive.copy(on);bulbMat.emissiveIntensity=s.on?1.8:0;
   bulbMat.color.copy(s.on?on:dim);
  },
 };
}


export const lamp=definePart({kind:'lamp',name:c('Desk lamp','Lampu meja'),pins:{},deskMm:[24,24],callouts:[callout('drag',[0,40,0],'Drag to move, click to switch','Seret untuk geser, klik untuk nyala/mati')],interact:{drag:{handle:'toggle-slide',prop:'distanceCm',range:[5,150]},controls:[{type:'range',key:'distanceCm',label:c('Distance from sensor','Jarak ke sensor'),min:5,max:150,step:1,unit:'cm'},{type:'toggle',key:'on',label:c('Lamp on','Lampu menyala')},{type:'action',action:'focus',label:c('Zoom to it','Perbesar ke sini')}]},make:buildLamp});
