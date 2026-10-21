/**
 * PIR-HC-SR501: 32 x 24 mm green board, 23 mm white Fresnel dome on a lens ring, two orange trimmers (hold time Tx, sensitivity Sx),
 * an H/L jumper and a 3-pin header (VCC, OUT, GND). Pairs with sim/devices/pir-hc-sr501.ts.
 */
import {BoxGeometry,Color,CylinderGeometry,Group,LatheGeometry,Mesh,MeshStandardMaterial,Vector2} from 'three';
import type {PartProps} from '../../contract';
import type {PirHcSr501State} from '../../sim/devices/pir-hc-sr501';
import {PITCH} from '../layout';
import {addOutline,ownToon,solid} from '../materials';
import * as C from '../palette';
import {leg,definePart,extState,c,pin,callout,type Inner} from './kit';

const BOARD=0x23834f; // ds-allow-hex  (green HC-SR501 solder mask)
const LENS=0xf1f0e8; // ds-allow-hex  (milky white polyethylene Fresnel lens)
const TRIMMER=0xe0932e; // ds-allow-hex  (orange trimmer body)

/** Dome with stepped concentric rings, like a Fresnel lens. */
function fresnelGeo(R:number,H:number,rings:number):LatheGeometry{
 const pts:Vector2[]=[];
 const y=(r:number):number=>H*Math.sqrt(Math.max(0,1-(r/R)**2*0.97));
 for(let i=0;i<rings;i++){
  const r0=(i*R)/rings,r1=((i+1)*R)/rings;
  pts.push(new Vector2(r0,y(r0)),new Vector2(r1-0.02,y(r1)+0.55));
 }
 pts.push(new Vector2(R,y(R)),new Vector2(R,0));
 return new LatheGeometry(pts.reverse(),48);
}

function trimmer(x:number,z:number):Group{
 const t=new Group();t.position.set(x,0,z);
 t.add(solid(new BoxGeometry(6,5,6),TRIMMER,{outline:true,pos:[0,2.5,0]}));
 t.add(solid(new CylinderGeometry(1.9,1.9,0.7,20),C.SILVER,{pos:[0,5.2,0],finish:'metal',cast:false}));
 t.add(solid(new BoxGeometry(2.8,0.3,0.6),C.SILVER_DARK,{pos:[0,5.6,0],cast:false}));
 return t;
}

function buildPir(_p:PartProps,g:Group):Inner{
 const cx=PITCH,y0=4,cz=-10;                      // board centre; pins sit on its front edge
 for(let i=0;i<3;i++)g.add(leg(i*PITCH,y0+0.4));
 const base=new Group();base.position.set(cx,y0,cz);g.add(base);
 base.add(solid(new BoxGeometry(32,1.6,24),BOARD,{outline:true,edges:true,pos:[0,0.8,0]}));
 // header body under the pins (3 pins), silkscreen-black
 g.add(solid(new BoxGeometry(3*PITCH,2.5,2.5),C.HEADER_BLACK,{outline:true,pos:[PITCH,y0+1.25,0]}));
 // lens ring and dome
 base.add(solid(new CylinderGeometry(11.8,11.8,2.6,40),LENS,{outline:true,pos:[0,1.6+1.3,0]}));
 const dome=new Mesh(fresnelGeo(11.5,10.5,7),ownToon(LENS));
 dome.position.set(0,1.6+2.6,0);dome.castShadow=true;addOutline(dome);base.add(dome);
 // trimmers (Tx, Sx) at the back corners, H/L jumper at the front left
 base.add(trimmer(-12.2,-8.6),trimmer(12.2,-8.6));
 base.add(solid(new BoxGeometry(7.6,2.5,2.5),C.HEADER_BLACK,{outline:true,pos:[-12.2,1.6+1.25,8.6],rot:[0,Math.PI/2,0]}));
 base.add(solid(new BoxGeometry(2.6,2.4,3.4),C.CHIP,{pos:[-12.2,1.6+3,7.4],cast:false}));
 // small chip and caps near the header
 base.add(solid(new BoxGeometry(4.5,1.1,5),C.CHIP,{pos:[8,1.6+0.55,6.6],cast:false}));
 const mat=dome.material as MeshStandardMaterial;
 const idle=new Color(LENS),live=new Color(C.TEAL_LIGHT);
 return {
  apply(s){
   const st=extState<PirHcSr501State>(s,'pir-hc-sr501');
   if(!st)return;
   const on=st.out;
   mat.color.copy(on?live:idle);
   mat.emissive.copy(on?new Color(C.LIVE):new Color(0));
   mat.emissiveIntensity=on?0.35:0;
  },
 };
}

export const pirHcSr501=definePart({
 kind:'pir-hc-sr501',name:c('PIR motion sensor (HC-SR501)','Sensor gerak PIR (HC-SR501)'),
 pins:{VCC:pin([0,0,0],'power','5V','5V'),OUT:pin([PITCH,0,0],'output','OUT (HIGH on motion)','OUT (HIGH saat gerak)'),GND:pin([2*PITCH,0,0],'ground','Ground','Ground')},
 callouts:[
  callout('lens',[PITCH,18,-10],'Fresnel lens focuses body heat onto the sensor','Lensa Fresnel memfokuskan panas tubuh ke sensor'),
  callout('trim',[PITCH+12,10,-18.5],'Trimmers set hold time and range','Trimmer mengatur waktu tahan dan jangkauan'),
 ],
 make:buildPir,
});
