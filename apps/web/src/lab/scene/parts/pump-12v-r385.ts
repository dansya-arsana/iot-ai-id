/**
 * PUMP-12V-R385: a 12 V diaphragm pump, about 90 x 40 x 35 mm: a black 385 motor can (diameter about 28 mm) on a dark-grey diaphragm head with two
 * white barbed nozzles side by side (inlet and outlet), and red and black leads. Pairs with sim/devices/pump-12v-r385.ts.
 */
import {BoxGeometry,CylinderGeometry,Group,Mesh,MeshBasicMaterial,SphereGeometry} from 'three';
import type {PartProps} from '../../contract';
import type {Pump12vState} from '../../sim/devices/pump-12v-r385';
import {solid} from '../materials';
import * as C from '../palette';
import {HALF_PI,definePart,extState,c,pin,callout,type Inner} from './kit';

const HEAD=0x4a4f58; // ds-allow-hex  (dark-grey pump head)
const WATER=0x6cb8ff; // ds-allow-hex  (water drops)
export const DIMS={l:90,w:40,h:35,mm:true as const};
const LEAD_X=-58;
const NOZ_X=26,NOZ_Z=[-7,7] as const,NOZ_TOP=34;
const pinAt=(sign:number):[number,number,number]=>[LEAD_X,6,sign*3];

function buildPump(_p:PartProps,g:Group):Inner{
 const Y=15;
 // motor can along x (diameter 28), end cap with the two terminals
 g.add(solid(new CylinderGeometry(14,14,40,36),C.CHIP,{outline:true,rot:[0,0,HALF_PI],pos:[-12,Y,0]}));
 g.add(solid(new CylinderGeometry(14.2,14.2,2,36),C.SILVER_DARK,{rot:[0,0,HALF_PI],pos:[-33,Y,0],finish:'metal'}));
 g.add(solid(new CylinderGeometry(3.2,3.2,3,16),C.SILVER,{rot:[0,0,HALF_PI],pos:[-35,Y,0],finish:'metal'}));
 // diaphragm head: a block with four screws
 g.add(solid(new BoxGeometry(26,28,36),HEAD,{outline:true,edges:true,pos:[13,Y,0]}));
 for(const [sx,sz] of [[6,-14],[6,14],[20,-14],[20,14]] as const)g.add(solid(new CylinderGeometry(1.7,1.7,1,10),C.SILVER,{pos:[sx,Y+14.4,sz],cast:false,finish:'metal'}));
 // two barbed nozzles on top
 for(const z of NOZ_Z){
  g.add(solid(new CylinderGeometry(3,3,NOZ_TOP-Y-14+2,16),C.CREAM,{outline:true,pos:[NOZ_X-6,(NOZ_TOP+Y+14)/2-1,z]}));
  g.add(solid(new CylinderGeometry(3.8,2.4,3,16),C.CREAM,{outline:true,pos:[NOZ_X-6,NOZ_TOP-1.5,z]}));
  g.add(solid(new CylinderGeometry(1.6,1.6,0.4,12),C.HOLE,{pos:[NOZ_X-6,NOZ_TOP+0.1,z],cast:false}));
 }
 // leads from the end cap to the pin anchors
 for(const [sign,col] of [[1,C.RED_ALERT],[-1,C.CHIP]] as const){
  g.add(solid(new BoxGeometry(-LEAD_X-35,1.2,1.2),col,{pos:[(LEAD_X-35)/2,6,sign*3],cast:false}));
  g.add(solid(new BoxGeometry(2.6,0.9,0.9),C.SILVER,{pos:[LEAD_X+1.3,6,sign*3],cast:false,finish:'metal'}));
 }
 // droplets leave the outlet nozzle (z=+7) while it pumps
 const dmat=new MeshBasicMaterial({color:WATER,transparent:true,opacity:0.9});dmat.userData.own=true;
 const drops:{m:Mesh;t:number}[]=[];
 for(let i=0;i<7;i++){const m=new Mesh(new SphereGeometry(1.1,10,8),dmat);m.visible=false;m.userData.noPick=true;m.userData.noInk=true;g.add(m);drops.push({m,t:i/7});}
 return {
  apply(s,dt){
   const st=extState<Pump12vState>(s,'pump-12v-r385');
   if(!st)return;
   const rate=Math.min(1,st.flowLmin/1.5);
   for(const d of drops){
    d.t=(d.t+dt/1000*(0.5+1.5*rate))%1;
    d.m.visible=rate>0.02;
    const t=d.t;
    d.m.position.set(NOZ_X-6+t*8*rate,NOZ_TOP+0.5+(t*8-t*t*8)*(5*rate),NOZ_Z[1]);
    d.m.scale.setScalar(0.6+0.6*(1-t));
   }
  },
 };
}

export const pump12vR385=definePart({
 kind:'pump-12v-r385',name:c('Diaphragm pump 12 V (R385)','Pompa diafragma 12 V (R385)'),
 pins:{'+':pin(pinAt(1),'power','Plus (red)','Plus (merah)'),'-':pin(pinAt(-1),'ground','Minus (black)','Minus (hitam)')},
 deskMm:[110,44],
 callouts:[
  callout('outlet',[NOZ_X-6,NOZ_TOP+4,NOZ_Z[1]],'Outlet nozzle: water leaves here (the other one is the inlet)','Nozel keluar: air keluar di sini (yang lain adalah masuk)'),
  callout('surge',[-35,15,0],'Start surge up to about 2 A: size the relay, fuse and supply for it','Lonjakan awal hingga sekitar 2 A: ukur relay, sekring, dan catu untuk itu'),
  callout('dry',[13,32,0],'Not submersible: keep it dry, and fill the hose before starting','Tidak tahan terendam: jaga tetap kering, dan isi selang sebelum menyala'),
 ],
 make:buildPump,
});
