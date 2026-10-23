/**
 * SOLENOID-VALVE-12V: a 1/2" normally closed water valve, about 76 x 57 x 51 mm (Adafruit 997): a white nylon body with two threaded ports, a flow arrow,
 * a black cylindrical coil housing on top with two spade tabs, and red and black leads. The plunger shows through a window when open. Pairs with sim/devices/solenoid-valve-12v.ts.
 */
import {BoxGeometry,CylinderGeometry,Group,Mesh,MeshBasicMaterial,MeshStandardMaterial,ConeGeometry} from 'three';
import type {PartProps} from '../../contract';
import type {SolenoidValveState} from '../../sim/devices/solenoid-valve-12v';
import {solid} from '../materials';
import * as C from '../palette';
import {HALF_PI,definePart,extState,c,pin,callout,type Inner} from './kit';

const NYLON=0xeeece4; // ds-allow-hex  (white nylon valve body)
const WATER=0x6cb8ff; // ds-allow-hex  (water tint)
export const DIMS={l:76,w:57,h:51,mm:true as const};
const LEAD_X=-48;
const pinAt=(sign:number):[number,number,number]=>[LEAD_X,18,sign*6];

function buildValve(_p:PartProps,g:Group):Inner{
 // body: a block between the ports, ports as threaded cylinders along x
 g.add(solid(new BoxGeometry(34,24,30),NYLON,{outline:true,edges:true,pos:[0,13,0]}));
 for(const s of [-1,1]){
  g.add(solid(new CylinderGeometry(9,9,22,28),NYLON,{outline:true,rot:[0,0,HALF_PI],pos:[s*28,13,0]}));
  for(let i=0;i<4;i++)g.add(solid(new CylinderGeometry(9.6,9.6,1.2,28),C.CREAM_DARK,{rot:[0,0,HALF_PI],pos:[s*(33+i*2.6)*(1)-s*2,13,0],cast:false}));
  g.add(solid(new CylinderGeometry(5.2,5.2,0.5,20),C.HOLE,{rot:[0,0,HALF_PI],pos:[s*39.1,13,0],cast:false}));
 }
 // flow arrow on the +z face of the body (points to +x)
 const arrow=new Mesh(new ConeGeometry(3.4,7,3),new MeshBasicMaterial({color:C.INK}));
 arrow.material.userData.own=true;arrow.rotation.set(0,0,-HALF_PI);arrow.position.set(6,13,15.2);arrow.userData.noPick=true;arrow.userData.noInk=true;g.add(arrow);
 g.add(solid(new BoxGeometry(12,1.6,0.4),C.INK,{pos:[-3,13,15.2],cast:false}));
 // bonnet, coil housing and spade tabs
 g.add(solid(new CylinderGeometry(7,7,6,24),C.SILVER_DARK,{pos:[0,28,0],finish:'metal'}));
 const coil=solid(new CylinderGeometry(13,13,24,32),C.CHIP,{outline:true,pos:[0,43,0],own:true});
 g.add(coil);
 g.add(solid(new CylinderGeometry(13.2,13.2,2,32),C.SILVER_DARK,{pos:[0,55,0],finish:'metal'}));
 for(const sign of [1,-1])g.add(solid(new BoxGeometry(0.8,6.4,2.8),C.GOLD,{pos:[-13.4,33,sign*6],cast:false,finish:'metal'}));
 // leads from the tabs to the pin anchors (red +, black -)
 for(const [sign,col] of [[1,C.RED_ALERT],[-1,C.CHIP]] as const){
  g.add(solid(new BoxGeometry(-LEAD_X-13.4,1.4,1.4),col,{pos:[(LEAD_X-13.4)/2,18,sign*6],cast:false}));
  g.add(solid(new BoxGeometry(2.6,0.9,0.9),C.SILVER,{pos:[LEAD_X+1.3,18,sign*6],cast:false,finish:'metal'}));
 }
 // water window: a translucent block in the flow channel, lit when water flows
 const wmat=new MeshStandardMaterial({color:WATER,transparent:true,opacity:0.0,depthWrite:false});wmat.userData.own=true;
 const water=new Mesh(new BoxGeometry(70,9,10),wmat);water.position.set(0,13,0);water.userData.noPick=true;water.userData.noInk=true;water.renderOrder=2;g.add(water);
 const cmat=coil.material as unknown as MeshStandardMaterial;
 return {
  apply(s){
   const st=extState<SolenoidValveState>(s,'solenoid-valve-12v');
   if(!st)return;
   wmat.opacity=st.flowing?0.55:0;
   // the coil housing glows faintly green while it is energised
   cmat.emissive?.set(st.ma>50?C.LIVE:0);if(cmat.emissive)cmat.emissiveIntensity=st.ma>50?0.18:0;
  },
 };
}

export const solenoidValve12v=definePart({
 kind:'solenoid-valve-12v',name:c('Solenoid valve 12 V (1/2")','Katup solenoid 12 V (1/2")'),
 pins:{'+':pin(pinAt(1),'power','Plus (red)','Plus (merah)'),'-':pin(pinAt(-1),'ground','Minus (black)','Minus (hitam)')},
 deskMm:[90,60],
 callouts:[
  callout('flow',[6,20,15],'Flow direction: water only goes the way of the arrow','Arah aliran: air hanya mengalir searah panah'),
  callout('coil',[0,58,0],'Coil 12 V, about 320 mA: switch it with a relay, add a flyback diode','Koil 12 V, sekitar 320 mA: sakelar dengan relay, pasang dioda flyback'),
  callout('pressure',[-28,22,0],'Needs at least about 20 kPa (3 PSI) to open and seal','Butuh minimal sekitar 20 kPa (3 PSI) untuk membuka dan menutup rapat'),
 ],
 make:buildValve,
});
