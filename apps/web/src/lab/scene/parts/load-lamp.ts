/** LOAD-LAMP: a small 12 V screw-base bulb on a desk. It glows warm while its relay is closed. Pairs with sim/devices/load-lamp.ts. Guide: docs/lab-extending.md */
import {BoxGeometry,CylinderGeometry,Color,Group,Mesh,MeshBasicMaterial,SphereGeometry,TorusGeometry} from 'three';
import type {PartProps} from '../../contract';
import type {LoadLampState} from '../../sim/devices/load-lamp';
import {glowTexture,ownToon,solid} from '../materials';
import * as C from '../palette';
import {definePart,extState,sprite,c,callout,pin,type Inner} from './kit';

/** A small 12 V indicator bulb, about 28 mm globe on an E10 screw base (10 mm). Units are mm. */
function buildLoadLamp(_p:PartProps,g:Group):Inner{
 // small plate so it sits on the desk like the other props
 g.add(solid(new CylinderGeometry(10,10.5,1.6,32),C.CREAM_DARK,{outline:true,pos:[0,0.8,0]}));
 // E10 screw base: a silver can with thread rings
 g.add(solid(new CylinderGeometry(5,5,9,24),C.SILVER,{outline:true,pos:[0,6.1,0],finish:'metal'}));
 for(let i=0;i<3;i++){
  const ring=new Mesh(new TorusGeometry(5,0.45,6,24),ownToon(C.SILVER_DARK,'metal'));
  ring.rotation.x=Math.PI/2;ring.position.y=3.4+i*2.6;g.add(ring);
 }
 g.add(solid(new CylinderGeometry(5.3,5.3,2.2,24),C.HEADER_BLACK,{outline:true,pos:[0,11.7,0]}));
 // two solder lugs on the plate take the wires: + on the left, - on the right
 for(const sx of [-7,7])g.add(solid(new BoxGeometry(2.6,0.7,4),C.GOLD,{pos:[sx,1.95,0],cast:false,finish:'gold'}));
 // glass globe, translucent; the filament shows through
 const glassMat=ownToon(C.FILL,'epoxy');
 glassMat.transparent=true;glassMat.opacity=0.34;glassMat.depthWrite=false;
 const glass=new Mesh(new SphereGeometry(14,28,20),glassMat);
 glass.position.y=26;g.add(glass);
 // two support wires and the filament between their tips
 for(const sx of [-2.2,2.2])g.add(solid(new CylinderGeometry(0.25,0.25,10,6),C.SILVER_DARK,{pos:[sx,18.5,0],cast:false,finish:'metal'}));
 const fil=new Mesh(new CylinderGeometry(0.5,0.5,4.4,8),ownToon(0x6b5a40,'metal')); // ds-allow-hex  cold tungsten
 fil.rotation.z=Math.PI/2;fil.position.set(0,23.8,0);g.add(fil);
 const halo=sprite(glowTexture(),C.LAMP_LIGHT,70,26,0,true);
 g.add(halo);
 const pool=new Mesh(new CylinderGeometry(24,24,0.2,32),new MeshBasicMaterial({color:C.LAMP_LIGHT,transparent:true,opacity:0,depthWrite:false}));
 pool.position.y=1.8;g.add(pool);
 const cold=new Color(0x6b5a40),hot=new Color(C.LAMP_LIGHT); // ds-allow-hex  cold tungsten
 let cur=0;
 return {
  apply(s,dt){
   const st=extState<LoadLampState>(s,'load-lamp');
   if(!st)return;
   cur+=((st.on?1:0)-cur)*Math.min(1,dt/70);
   const m=fil.material as unknown as {color:Color;emissive:Color;emissiveIntensity:number};
   m.color.copy(cold).lerp(hot,cur);m.emissive.copy(hot);m.emissiveIntensity=cur*2.4;
   const gm=glass.material as unknown as {color:Color;emissive:Color;emissiveIntensity:number};
   gm.color.set(C.FILL).lerp(hot,cur*0.6);gm.emissive.copy(hot);gm.emissiveIntensity=cur*0.7;
   halo.material.opacity=0.9*cur;halo.scale.setScalar(50+40*cur);
   (pool.material as MeshBasicMaterial).opacity=0.4*cur;
  },
 };
}

export const loadLamp=definePart({
 kind:'load-lamp',name:c('Lamp on the relay contact','Lampu di kontak relay'),
 pins:{'+':pin([-7,2.6,0],'power','Plus','Plus'),'-':pin([7,2.6,0],'ground','Minus','Minus')},
 callouts:[callout('bulb',[0,42,0],'Lights when the relay closes','Menyala saat relay menutup'),callout('base',[0,8,0],'Own supply, not from the Arduino','Catu sendiri, bukan dari Arduino')],
 deskMm:[22,22],
 make:buildLoadLamp,
});
