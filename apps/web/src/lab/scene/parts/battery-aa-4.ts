/** 4 x AA holder: open tray 63 x 58 x 16 mm, cells 14.5 x 50.5 mm lying side by side, slide switch and two leads. */
import {BoxGeometry,CatmullRomCurve3,CylinderGeometry,Group,TubeGeometry,Vector3} from 'three';
import type {PartProps} from '../../contract';
import type {BatteryAa4State} from '../../sim/devices/battery-aa-4';
import {solid} from '../materials';
import * as C from '../palette';
import {addShadow,definePart,extState,c,pin,callout,type Inner} from './kit';

const CELL=0xc58a3a; // ds-allow-hex  generic alkaline jacket
const CELL_BAND=0x232830; // ds-allow-hex
const WIRE_RED=0xd23b32; // ds-allow-hex
const WIRE_BLACK=0x15171a; // ds-allow-hex
const TIP_PLUS:[number,number,number]=[-44,4,22];
const TIP_MINUS:[number,number,number]=[-44,4,12];

function lead(g:Group,from:Vector3,tip:readonly number[],color:number):void{
 const curve=new CatmullRomCurve3([from,new Vector3(from.x-6,from.y,from.z),new Vector3(tip[0]!+8,tip[1]!+1,tip[2]),new Vector3(tip[0],tip[1],tip[2])]);
 g.add(solid(new TubeGeometry(curve,20,0.9,8),color,{outline:true}));
 g.add(solid(new CylinderGeometry(1.0,1.0,2.4,10),C.SILVER,{pos:[tip[0]!,tip[1]!,tip[2]!],rot:[0,0,Math.PI/2],finish:'metal',cast:false}));
}

function buildHolder(_p:PartProps,g:Group):Inner{
 const L=63,Wd=58,H=16,wall=1.6,r=7.25,len=50.5;
 // tray: floor plus four walls and three dividers
 g.add(solid(new BoxGeometry(L,2,Wd),C.HEADER_BLACK,{outline:true,pos:[0,1,0]}));
 for(const sz of [-1,1])g.add(solid(new BoxGeometry(L,H,wall),C.HEADER_BLACK,{outline:true,pos:[0,H/2,sz*(Wd/2-wall/2)]}));
 for(const sx of [-1,1])g.add(solid(new BoxGeometry(wall,H,Wd),C.HEADER_BLACK,{outline:true,pos:[sx*(L/2-wall/2),H/2,0]}));
 for(let i=1;i<4;i++)g.add(solid(new BoxGeometry(L-2*wall,H*0.55,0.8),C.HEADER_TOP,{pos:[0,H*0.275+1,-Wd/2+i*Wd/4],cast:false}));
 // cells with nipple (+) at -x and flat minus at +x, each sitting in its slot
 const pitchZ=Wd/4;
 for(let i=0;i<4;i++){
  const z=-Wd/2+pitchZ*(i+0.5);
  const cell=new Group();cell.position.set(0,2+r+0.2,z);if(i%2)cell.rotation.y=Math.PI; // a series holder alternates the cells
  g.add(cell);
  cell.add(solid(new CylinderGeometry(r,r,len,28),CELL,{outline:true,rot:[0,0,Math.PI/2]}));
  cell.add(solid(new CylinderGeometry(r+0.02,r+0.02,len*0.3,28),CELL_BAND,{pos:[0,0,0],rot:[0,0,Math.PI/2],cast:false}));
  cell.add(solid(new CylinderGeometry(r*0.98,r*0.98,1.6,28),C.SILVER,{pos:[len/2,0,0],rot:[0,0,Math.PI/2],finish:'metal',cast:false}));
  cell.add(solid(new CylinderGeometry(2.6,2.6,1.4,16),C.SILVER,{pos:[-len/2-0.7,0,0],rot:[0,0,Math.PI/2],finish:'metal',cast:false}));
  // polarity ticks on the tray end wall
  g.add(solid(new BoxGeometry(0.3,1.2,2.2),C.RAIL_RED,{pos:[(i%2?1:-1)*(L/2-wall-0.2),H-2,z],cast:false}));
 }
 // contact springs at the +x end
 for(let i=0;i<4;i++){
  const z=-Wd/2+pitchZ*(i+0.5);
  g.add(solid(new CylinderGeometry(1.6,1.6,3,10),C.SILVER_DARK,{pos:[(i%2?-1:1)*(L/2-wall-1.2),2+r+0.2,z],rot:[0,0,Math.PI/2],finish:'metal',cast:false}));
 }
 // slide switch on the end wall, thumb moves with the on state
 g.add(solid(new BoxGeometry(5,3,9),C.HEADER_TOP,{outline:true,pos:[-L/2-0.5,H-3,-Wd/4]}));
 const thumb=solid(new BoxGeometry(3,2.6,3.2),C.CREAM,{outline:true,pos:[-L/2-1.5,H-0.6,-Wd/4]});g.add(thumb);
 // leads leave through the end wall near the switch
 lead(g,new Vector3(-L/2,6,Wd/2-12),TIP_PLUS,WIRE_RED);
 lead(g,new Vector3(-L/2,6,Wd/2-17),TIP_MINUS,WIRE_BLACK);
 addShadow(g,L+10,Wd+10,0.3,4,0,0.03,0);
 return {
  apply(s){
   const st=extState<BatteryAa4State>(s,'battery-aa-4');
   if(!st)return;
   thumb.position.z=-Wd/4+(st.on?2:-2);
  },
 };
}

export const batteryAa4=definePart({
 kind:'battery-aa-4',name:c('4 x AA holder','Holder 4 x AA'),deskMm:[80,58],
 pins:{PLUS:pin(TIP_PLUS,'power','Red lead (+)','Kabel merah (+)'),MINUS:pin(TIP_MINUS,'ground','Black lead (-)','Kabel hitam (-)')},
 callouts:[callout('switch',[-33,22,-14],'Slide switch cuts the leads','Saklar geser memutus kabel')],
 make:buildHolder,
});
