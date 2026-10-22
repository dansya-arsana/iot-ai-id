/**
 * REED-SWITCH module: a 14 x 2.3 mm glass capsule with two blades on a small board (3 pins: VCC, SIG, GND) and a pull-down.
 * The blades touch (and glow) while the contact is closed. The popover magnet hangs above the capsule; "along" turns its axis
 * parallel to the glass, "across" upright. Pairs with sim/devices/reed-switch.ts.
 */
import {BoxGeometry,CylinderGeometry,Group,Mesh,MeshStandardMaterial} from 'three';
import type {PartProps} from '../../contract';
import type {ReedSwitchState} from '../../sim/devices/reed-switch';
import {PITCH} from '../layout';
import {solid} from '../materials';
import * as C from '../palette';
import {leg,definePart,extState,c,pin,callout,type Inner} from './kit';

const BOARD=0x2f6f4d; // ds-allow-hex  (green solder mask of the module)
const SMD=0xb8a27a; // ds-allow-hex  (tan SMD resistor body)

const BX=PITCH,BW=15,BD=9,BT=1.4,Y0=2.6;
const CAP_Y=Y0+BT+2.6,CAP_Z=-3.4,CAP_L=14,CAP_R=1.15;

/** Disc magnet of 10 x 3 mm: two halves coloured by pole. Returns the group and its pole materials. */
function magnetGroup():{g:Group;faceMat:MeshStandardMaterial;backMat:MeshStandardMaterial}{
 const g=new Group();
 const face=solid(new CylinderGeometry(5,5,1.5,28),C.RAIL_BLUE,{outline:true,own:true,pos:[0,-0.75,0],finish:'metal'});
 const back=solid(new CylinderGeometry(5,5,1.5,28),C.RED_ALERT,{outline:true,own:true,pos:[0,0.75,0],finish:'metal'});
 g.add(face,back);g.userData.noInk=true;
 return {g,faceMat:face.material as MeshStandardMaterial,backMat:back.material as MeshStandardMaterial};
}

function buildReed(_p:PartProps,g:Group):Inner{
 for(let i=0;i<3;i++)g.add(leg(i*PITCH,Y0+0.4));
 g.add(solid(new BoxGeometry(BW,BT,BD),BOARD,{outline:true,edges:true,pos:[BX,Y0+BT/2,-BD/2+1.5],own:true}));
 const top=Y0+BT;
 // glass capsule (translucent) with two blades and the tungsten-coloured leads bent down to the board
 const glass=new Mesh(new CylinderGeometry(CAP_R,CAP_R,CAP_L-3.2,20),new MeshStandardMaterial({color:C.FILL,transparent:true,opacity:0.38,roughness:0.15}));
 glass.material.userData.own=true;glass.rotation.z=Math.PI/2;glass.position.set(BX,CAP_Y,CAP_Z);glass.userData.noInk=true;g.add(glass);
 for(const sx of [-1,1]){
  g.add(solid(new CylinderGeometry(0.28,0.28,3.4,10),C.SILVER,{pos:[BX+sx*(CAP_L/2-1.2),CAP_Y,CAP_Z],rot:[0,0,Math.PI/2],cast:false,finish:'metal'}));
  g.add(solid(new BoxGeometry(0.4,CAP_Y-top,0.4),C.SILVER,{pos:[BX+sx*(CAP_L/2),(CAP_Y+top)/2,CAP_Z],cast:false,finish:'metal'}));
 }
 // blades: flat reeds overlapping in the middle; the gap closes when the field pulls them in
 const bladeL=(CAP_L-3.2)/2+0.5;
 const bladeMat=(col:number)=>{const m=solid(new BoxGeometry(bladeL,0.12,0.9),col,{own:true,cast:false,finish:'metal'});return m;};
 const bl=bladeMat(C.GOLD),br=bladeMat(C.GOLD);
 const rest=0.32;
 bl.position.set(BX-bladeL/2+0.35,CAP_Y+rest,CAP_Z);br.position.set(BX+bladeL/2-0.35,CAP_Y-rest,CAP_Z);
 g.add(bl,br);
 const blMat=bl.material as MeshStandardMaterial,brMat=br.material as MeshStandardMaterial;
 // pull-down resistor, indicator LED, three module legs on the front edge
 g.add(solid(new BoxGeometry(1.6,0.5,0.8),SMD,{pos:[BX-3.4,top+0.25,-7],own:true}));
 const led=solid(new BoxGeometry(1.6,0.6,0.8),C.LED_SMD_OFF,{pos:[BX+3.4,top+0.3,-7],own:true});g.add(led);
 const ledMat=led.material as MeshStandardMaterial;
 const mag=magnetGroup();mag.g.position.set(BX,CAP_Y+12,CAP_Z);mag.g.visible=false;g.add(mag.g);
 let cur=0;
 return {
  apply(s,dt){
   const st=extState<ReedSwitchState>(s,'reed-switch');
   if(!st)return;
   cur+=((st.closed?1:0)-cur)*Math.min(1,dt/18);
   bl.position.y=CAP_Y+rest*(1-cur);br.position.y=CAP_Y-rest*(1-cur);
   const hot=st.closed?1:0;
   for(const m of [blMat,brMat]){m.emissive.set(hot?C.LIVE:0);m.emissiveIntensity=hot*0.5;}
   ledMat.color.set(st.high?C.LIVE:C.LED_SMD_OFF);ledMat.emissive.set(st.high?C.LIVE:0);ledMat.emissiveIntensity=st.high?1:0;
   // magnet sits distance mm above the glass; axis horizontal (along the glass) or upright (across it)
   mag.g.visible=st.distance<30;
   mag.g.position.y=CAP_Y+CAP_R+st.distance+(st.orient==='along'?5:1.5);
   mag.g.rotation.z=st.orient==='along'?Math.PI/2:0;
  },
 };
}

const P=(i:number):[number,number,number]=>[i*PITCH,0,0];
export const reedSwitch=definePart({
 kind:'reed-switch',name:c('Reed switch module','Modul reed switch'),
 pins:{VCC:pin(P(0),'power','Power 3.3V to 5V','Daya 3,3V sampai 5V'),SIG:pin(P(1),'output','SIG (HIGH while closed)','SIG (HIGH saat menutup)'),GND:pin(P(2),'ground','Ground','Ground')},
 callouts:[
  callout('glass',[BX,CAP_Y+2,CAP_Z],'Two metal blades sealed in glass touch when a magnet comes near','Dua bilah logam dalam kaca bersentuhan saat magnet mendekat'),
  callout('led',[BX+3.4,Y0+BT+1.5,-7],'The LED follows SIG','LED mengikuti SIG'),
 ],
 make:buildReed,
});
