/**
 * DC-PUMP: a mini submersible pump, about 45 x 24 x 30 mm: a barrel-shaped motor housing, a pump head with a side inlet grille and a
 * vertical outlet nozzle, and two leads (red and black, shortened for the desk). It sits in a translucent block of water; a few drops
 * leave the nozzle while it pumps. Pairs with sim/devices/dc-pump.ts.
 */
import {BoxGeometry,CylinderGeometry,Group,Mesh,MeshBasicMaterial,SphereGeometry} from 'three';
import type {PartProps} from '../../contract';
import type {DcPumpState} from '../../sim/devices/dc-pump';
import {solid} from '../materials';
import * as C from '../palette';
import {HALF_PI,definePart,extState,c,pin,callout,type Inner} from './kit';

const PUMP_BLUE=0x2a6f97; // ds-allow-hex  (pump housing, blue-grey plastic)
const WATER=0x6cb8ff; // ds-allow-hex  (water tint)
const NOZ_X=22,NOZ_TOP=30;
const LEAD_X=-34;
const pinAt=(sign:number):[number,number,number]=>[LEAD_X,5,sign*3];

function buildPump(p:PartProps,g:Group):Inner{
 const Y=12;
 g.add(solid(new CylinderGeometry(11.5,11.5,28,32),PUMP_BLUE,{outline:true,rot:[0,0,HALF_PI],pos:[0,Y,0]}));
 g.add(solid(new CylinderGeometry(11.7,11.7,2.4,32),C.SILVER_DARK,{rot:[0,0,HALF_PI],pos:[-14,Y,0],finish:'metal'}));
 g.add(solid(new BoxGeometry(17,22,22),C.CREAM,{outline:true,pos:[22.5,Y,0]}));
 g.add(solid(new CylinderGeometry(3.8,3.8,NOZ_TOP-Y-8,18),C.CREAM,{outline:true,pos:[NOZ_X,(NOZ_TOP+Y+8)/2,0]}));
 g.add(solid(new CylinderGeometry(2.4,2.4,0.4,16),C.HOLE,{pos:[NOZ_X,NOZ_TOP,0],cast:false}));
 // inlet grille on the +x face
 g.add(solid(new CylinderGeometry(7,7,0.5,24),C.GROOVE,{rot:[0,0,HALF_PI],pos:[31.1,Y,0],cast:false}));
 for(let i=-2;i<=2;i++)g.add(solid(new BoxGeometry(0.4,12,0.8),C.HOLE,{pos:[31.5,Y,i*2.2],cast:false}));
 // leads, ending in bare tips (the pin anchors)
 for(const [sign,col] of [[1,C.RED_ALERT],[-1,C.CHIP]] as const){
  g.add(solid(new BoxGeometry(-LEAD_X-14,1.2,1.2),col,{pos:[(LEAD_X-14)/2,5,sign*3],cast:false}));
  g.add(solid(new BoxGeometry(2.6,0.9,0.9),C.SILVER,{pos:[LEAD_X+1.3,5,sign*3],cast:false,finish:'metal'}));
 }
 // water block (visible when the pump is in the water) and droplets
 const wmat=new MeshBasicMaterial({color:WATER,transparent:true,opacity:0.28,depthWrite:false});wmat.userData.own=true;
 const water=new Mesh(new BoxGeometry(70,17,40),wmat);water.position.set(0,8.6,0);water.userData.noPick=true;water.userData.noInk=true;water.renderOrder=2;g.add(water);
 const dmat=new MeshBasicMaterial({color:WATER,transparent:true,opacity:0.9});dmat.userData.own=true;
 const drops:{m:Mesh;t:number}[]=[];
 for(let i=0;i<7;i++){const m=new Mesh(new SphereGeometry(1.1,10,8),dmat);m.visible=false;m.userData.noPick=true;m.userData.noInk=true;g.add(m);drops.push({m,t:i/7});}
 water.visible=p.submerged!==false;
 return {
  apply(s,dt){
   const st=extState<DcPumpState>(s,'dc-pump');
   if(!st)return;
   water.visible=st.submerged;
   const rate=st.flowLh/100;   // 0..1
   for(const d of drops){
    d.t=(d.t+dt/1000*(0.5+1.5*rate))%1;
    d.m.visible=rate>0.02;
    // a short arc: up and slightly forward, then falling back
    const t=d.t;
    d.m.position.set(NOZ_X+t*10*rate,NOZ_TOP+0.5+(t*8-t*t*8)*(6*rate),((d.t*7)%1-0.5)*1.2);
    d.m.scale.setScalar(0.6+0.6*(1-t));
   }
  },
 };
}

export const dcPump=definePart({
 kind:'dc-pump',name:c('Mini submersible pump','Pompa mini celup'),
 pins:{'+':pin(pinAt(1),'power','Plus (red)','Plus (merah)'),'-':pin(pinAt(-1),'ground','Minus (black)','Minus (hitam)')},
 deskMm:[80,28],
 callouts:[
  callout('nozzle',[NOZ_X,NOZ_TOP+4,0],'Water leaves here: more volts, more litres per hour','Air keluar di sini: makin besar volt, makin banyak liter per jam'),
  callout('inlet',[31.5,12,0],'The inlet grille: the pump must be under water','Kisi masuk: pompa harus terendam'),
 ],
 make:buildPump,
});
