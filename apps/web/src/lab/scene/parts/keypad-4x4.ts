/**
 * KEYPAD-4X4: 16-key membrane keypad lying on the desk. Membrane 69 x 77 mm and about 1.5 mm thick, 16 raised keys on a
 * 15.5 mm pitch, an 8-wire ribbon with a 2.54 mm header (public dimensions of this common keypad, modelled by us).
 * Pairs with sim/devices/keypad-4x4.ts. Keys are chosen in the panel; a pressed key sinks and turns green, a ghost key turns amber.
 * Local frame: origin at the membrane centre, x right, z toward the viewer; the ribbon leaves the front edge.
 */
import {BoxGeometry,Color,Group,Mesh,MeshBasicMaterial,MeshStandardMaterial,PlaneGeometry} from 'three';
import {RoundedBoxGeometry} from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';
import type {PartProps} from '../../contract';
import {KEY_ROWS,LINES,type Keypad4x4State} from '../../sim/devices/keypad-4x4';
import {canvasTexture,ownToon,solid} from '../materials';
import * as C from '../palette';
import {MONO,leg,definePart,extState,c,pin,callout,type Inner} from './kit';

const MW=69,MD=77,TH=1.5,KP=15.5,KS=12.5;
const HEADER_Z=MD/2+30;       // ribbon end
const HX=(i:number):number=>(i-3.5)*2.54;
const FILM=0x3a3d44; // ds-allow-hex  (dark membrane film)
const GHOST=0xf0902a; // ds-allow-hex  (= amber warning)

function keyLabel(t:string):MeshBasicMaterial{
 const cv=document.createElement('canvas');cv.width=96;cv.height=96;
 const g=cv.getContext('2d')!;
 g.fillStyle='#1b1d21';g.textAlign='center';g.textBaseline='middle';g.font=`700 58px ${MONO}`;g.fillText(t,48,52);
 const m=new MeshBasicMaterial({map:canvasTexture(cv),transparent:true,toneMapped:false,depthWrite:false});
 m.userData.own=true;m.userData.ownMap=true;return m;
}

function buildKeypad(_p:PartProps,g:Group):Inner{
 // membrane and a lighter bezel strip
 g.add(solid(new RoundedBoxGeometry(MW,TH,MD,2,0.6),FILM,{outline:true,edges:true,pos:[0,TH/2,0],own:true}));
 // ribbon (flat, 8 conductors under a clear film) running to the header
 const ribLen=HEADER_Z-(MD/2-1);
 g.add(solid(new BoxGeometry(20.4,0.5,ribLen),C.CREAM_DARK,{pos:[0,0.35,MD/2-1+ribLen/2],cast:false}));
 const keys:{mesh:Mesh;mat:MeshStandardMaterial;k:string;y0:number}[]=[];
 KEY_ROWS.forEach((row,r)=>row.forEach((k,cI)=>{
  const mat=ownToon(cI===3?C.CREAM_DARK:C.KNOB);
  const mesh=new Mesh(new RoundedBoxGeometry(KS,1.1,KS,2,0.5),mat);
  mesh.position.set((cI-1.5)*KP,TH+0.55,(r-1.5)*KP);mesh.castShadow=true;mesh.receiveShadow=true;
  const lab=new Mesh(new PlaneGeometry(7,7),keyLabel(k));lab.rotation.x=-Math.PI/2;lab.position.y=0.58;lab.userData.noPick=true;lab.userData.noInk=true;
  mesh.add(lab);g.add(mesh);keys.push({mesh,mat,k,y0:mesh.position.y});
 }));
 // 8-pin header at the ribbon end
 g.add(solid(new BoxGeometry(8*2.54,2.5,2.5),C.HEADER_BLACK,{outline:true,pos:[0,1.25,HEADER_Z]}));
 for(let i=0;i<8;i++)g.add(leg(HX(i),4,HEADER_Z));
 const idle=new Color(C.KNOB),idleD=new Color(C.CREAM_DARK),live=new Color(C.LIVE),ghost=new Color(GHOST);
 return {
  apply(s,dt){
   const st=extState<Keypad4x4State>(s,'keypad-4x4');
   if(!st)return;
   const down=new Set(st.pressed?st.pressed.split(','):[]),gh=new Set(st.ghost?st.ghost.split(','):[]);
   const kk=Math.min(1,dt/30||1);
   for(const x of keys){
    const on=down.has(x.k);
    x.mesh.position.y+=((x.y0-(on?0.7:0))-x.mesh.position.y)*kk;
    x.mat.color.copy(on?live:gh.has(x.k)?ghost:(KEY_ROWS.some(r=>r[3]===x.k)?idleD:idle));
   }
  },
 };
}

const pins=Object.fromEntries(LINES.map((n,i)=>[n,pin([HX(i),4,HEADER_Z],'passive',n.startsWith('R')?`Row ${n.slice(1)}`:`Column ${n.slice(1)}`,n.startsWith('R')?`Baris ${n.slice(1)}`:`Kolom ${n.slice(1)}`)]));

export const keypad4x4=definePart({
 kind:'keypad-4x4',name:c('4x4 membrane keypad','Keypad membran 4x4'),
 pins,deskMm:[MW,MD+32],
 callouts:[
  callout('keys',[0,6,0],'Each key joins one row wire to one column wire','Setiap tombol menyambung satu kabel baris ke satu kabel kolom'),
  callout('ribbon',[0,3,HEADER_Z],'R1-R4 are rows, C1-C4 are columns','R1-R4 adalah baris, C1-C4 adalah kolom'),
 ],
 make:buildKeypad,
});
