/** 9 V PP3 battery, 26.5 x 48.5 x 17.5 mm, standing upright with a snap clip and two leads. Dimensions from the public PP3 size. */
import {CatmullRomCurve3,CylinderGeometry,Group,TubeGeometry,Vector3} from 'three';
import {RoundedBoxGeometry} from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';
import type {PartProps} from '../../contract';
import type {Battery9vState} from '../../sim/devices/battery-9v';
import {solid} from '../materials';
import * as C from '../palette';
import {addShadow,definePart,extState,c,pin,callout,type Inner} from './kit';

const WRAP=0x2b2f38; // ds-allow-hex  dark jacket
const BAND=0xd08a2c; // ds-allow-hex  copper-tone top band
const WIRE_RED=0xd23b32; // ds-allow-hex
const WIRE_BLACK=0x15171a; // ds-allow-hex
const TIP_PLUS:[number,number,number]=[-17,6,16];
const TIP_MINUS:[number,number,number]=[17,6,16];

function lead(g:Group,from:Vector3,tip:readonly number[],color:number):void{
 const curve=new CatmullRomCurve3([from,new Vector3(from.x,from.y+7,from.z+2),new Vector3(tip[0]!*0.8,tip[1]!+14,tip[2]!*0.6),new Vector3(tip[0],tip[1],tip[2])]);
 g.add(solid(new TubeGeometry(curve,24,0.9,8),color,{outline:true}));
 g.add(solid(new CylinderGeometry(1.0,1.0,2.4,10),C.SILVER,{pos:[tip[0]!,tip[1]!,tip[2]!],finish:'metal',cast:false}));
}

function buildBattery(_p:PartProps,g:Group):Inner{
 const W=26.5,H=48.5,D=17.5;
 g.add(solid(new RoundedBoxGeometry(W,H,D,3,1.2),WRAP,{outline:true,pos:[0,H/2,0]}));
 g.add(solid(new RoundedBoxGeometry(W+0.2,5,D+0.2,3,0.8),BAND,{pos:[0,H-9,0],cast:false}));
 g.add(solid(new RoundedBoxGeometry(W+0.2,5,D+0.2,3,0.8),BAND,{pos:[0,9,0],cast:false}));
 // top plate with the two terminals 12.7 mm apart: round stud (+) and hex socket (-)
 g.add(solid(new CylinderGeometry(8.2,8.2,0.8,24),C.SILVER,{pos:[0,H+0.2,0],finish:'metal',cast:false}));
 const tx=6.35;
 // snap clip: black cap that grips both terminals, red lead on the +, black on the -
 g.add(solid(new RoundedBoxGeometry(18,5,12,2,0.8),C.HEADER_BLACK,{outline:true,pos:[0,H+3.2,0]}));
 for(const sx of [-tx,tx])g.add(solid(new CylinderGeometry(2.6,2.6,1.6,6),C.SILVER_DARK,{pos:[sx,H+6.1,0],finish:'metal',cast:false}));
 g.add(solid(new CylinderGeometry(2.0,2.0,1.4,18),C.SILVER_DARK,{pos:[tx,H+6.1,0],finish:'metal',cast:false}));
 // leads (plus is the round stud side, so left in view is the red lead)
 lead(g,new Vector3(-tx,H+5,0),[TIP_PLUS[0],H+TIP_PLUS[1]+12,TIP_PLUS[2]],WIRE_RED);
 lead(g,new Vector3(tx,H+5,0),[TIP_MINUS[0],H+TIP_MINUS[1]+12,TIP_MINUS[2]],WIRE_BLACK);
 addShadow(g,W+6,D+6,0.3,3,0,0.03,0);
 return {
  apply(s){
   const st=extState<Battery9vState>(s,'battery-9v');
   if(!st)return;
   g.scale.setScalar(1);
  },
 };
}

export const battery9v=definePart({
 kind:'battery-9v',name:c('9 V battery','Baterai 9 V'),deskMm:[28,20],
 pins:{PLUS:pin([TIP_PLUS[0],48.5+TIP_PLUS[1]+12,TIP_PLUS[2]],'power','Red lead (+)','Kabel merah (+)'),MINUS:pin([TIP_MINUS[0],48.5+TIP_MINUS[1]+12,TIP_MINUS[2]],'ground','Black lead (-)','Kabel hitam (-)')},
 callouts:[callout('snap',[0,60,0],'Snap clip: red is plus, black is minus','Klip snap: merah plus, hitam minus')],
 make:buildBattery,
});
