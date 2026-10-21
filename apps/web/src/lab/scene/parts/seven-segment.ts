/** SEVEN-SEGMENT: 0.56 in single digit (about 19 x 12.6 x 7 mm) in a 9-way socket strip. Pairs with sim/devices/seven-segment.ts. */
import {BoxGeometry,CircleGeometry,Color,Group,Mesh,MeshBasicMaterial,MeshStandardMaterial} from 'three';
import type {PartProps} from '../../contract';
import type {SevenSegmentState} from '../../sim/devices/seven-segment';
import {SEGMENTS} from '../../sim/devices/seven-segment';
import {PITCH} from '../layout';
import {ownToon,solid} from '../materials';
import * as C from '../palette';
import {leg,definePart,extState,c,pin,callout,type Inner} from './kit';

const LED_RED=0xff3b30; // ds-allow-hex  (lit red segment)
const LED_OFF=0x4a2326; // ds-allow-hex  (unlit segment, dark red die under the lens)
const LED_GREEN=0x3fcf6e; // ds-allow-hex
const LED_YELLOW=0xf2c230; // ds-allow-hex
const LED_BLUE=0x3b8cff; // ds-allow-hex
const LIT:Record<string,number>={red:LED_RED,green:LED_GREEN,yellow:LED_YELLOW,blue:LED_BLUE};

function buildSeg(p:PartProps,g:Group):Inner{
 const cx=4*PITCH;                // centre of the 9-pin row
 const W=12.6,H=19,D=7,y0=6;
 for(let i=0;i<9;i++)g.add(leg(i*PITCH,y0+0.4));
 // socket strip the digit sits in
 g.add(solid(new BoxGeometry(8*PITCH+2.6,2.6,5.5),C.HEADER_BLACK,{outline:true,pos:[cx,y0-1.3+0.3,0]}));
 // grey-black epoxy body with a darker front face
 g.add(solid(new BoxGeometry(W,H,D),0x2a2c31,{outline:true,edges:true,pos:[cx,y0+1.3+H/2,0]})); // ds-allow-hex  (digit housing)
 g.add(solid(new BoxGeometry(W-1.2,H-1.2,0.3),C.CHIP,{cast:false,pos:[cx,y0+1.3+H/2,D/2+0.02]}));
 const color=LIT[String(p.color)]??LED_RED;
 const full=new Color(color),dim=new Color(LED_OFF);
 const fy=y0+1.3+H/2,fz=D/2+0.35;
 const t=1.4,L=4.8,hx=cx-0.5; // segment thickness, bar length, digit axis (slightly left of centre to leave room for dp)
 const place:Record<string,[number,number,boolean]>={ // x,y offset from digit centre, horizontal?
  a:[0,6.9,true],g:[0,0,true],d:[0,-6.9,true],f:[-3.4,3.45,false],b:[3.4,3.45,false],e:[-3.4,-3.45,false],c:[3.4,-3.45,false],
 };
 const mats:Record<string,MeshStandardMaterial>={};
 for(const s of SEGMENTS){
  const m=ownToon(LED_OFF);mats[s]=m;
  let mesh:Mesh;
  if(s==='dp'){mesh=new Mesh(new CircleGeometry(0.95,16),m);mesh.position.set(hx+5.1,fy-8.5,fz);}
  else{
   const [x,y,h]=place[s]!;
   mesh=new Mesh(new BoxGeometry(h?L:t,h?t:L,0.5),m);mesh.position.set(hx+x,fy+y,fz);
  }
  mesh.userData.noInk=true;g.add(mesh);
 }
 // thin white bezel print so the face reads as a digit module
 const mark=new Mesh(new CircleGeometry(0.35,10),new MeshBasicMaterial({color:C.CHIP_PRINT,toneMapped:false}));
 mark.material.userData.own=true;mark.position.set(cx-W/2+1.2,fy+H/2-1.4,fz-0.1);mark.userData.noPick=true;mark.userData.noInk=true;g.add(mark);
 return {
  apply(s){
   const st=extState<SevenSegmentState>(s,'seven-segment');
   if(!st)return;
   for(const k of SEGMENTS){
    const b=Math.sqrt(Math.min(1,st[k]));
    mats[k]!.color.copy(dim).lerp(full,b);mats[k]!.emissive.copy(full);mats[k]!.emissiveIntensity=b>0.01?0.3+0.8*b:0;
   }
  },
 };
}

const NAMES=['a','b','c','d','e','f','g','dp'];
export const sevenSegment=definePart({
 kind:'seven-segment',name:c('7-segment digit (0.56 in)','Digit 7-segmen (0,56 in)'),
 pins:{...Object.fromEntries(NAMES.map((n,i)=>[n,pin([i*PITCH,0,0],'input',`Segment ${n.toUpperCase()}`,`Segmen ${n.toUpperCase()}`)])),COM:pin([8*PITCH,0,0],'ground','COM (cathode)','COM (katoda)')},
 callouts:[
  callout('digit',[4*PITCH,17,4],'Each bar is one LED; drive its pin HIGH to light it','Tiap batang adalah satu LED; beri HIGH pada pinnya untuk menyalakan'),
  callout('com',[8*PITCH,6,0],'COM goes to ground, with a resistor on every segment','COM ke ground, dengan resistor di setiap segmen'),
 ],
 make:buildSeg,
});
