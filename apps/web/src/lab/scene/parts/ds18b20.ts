/**
 * DS18B20: TO-92 chip (D-shaped black epoxy body, 4.8 x 3.9 mm, 5 mm tall, three legs fanned out to the 2.54 mm grid)
 * or the waterproof probe (6 mm stainless tube, about 36 mm long, on a short black cable that splits into black, yellow and red wires).
 * Pairs with sim/devices/ds18b20.ts (1-Wire). The package is a popover choice; the part is rebuilt when it changes.
 * `to92Body` is shared with lm35.ts (same package).
 */
import {BoxGeometry,CylinderGeometry,ExtrudeGeometry,Group,Mesh,MeshBasicMaterial,MeshStandardMaterial,PlaneGeometry,Shape,SphereGeometry} from 'three';
import type {PartProps} from '../../contract';
import type {Ds18b20State} from '../../sim/devices/ds18b20';
import {PITCH} from '../layout';
import {canvasTexture,solid} from '../materials';
import * as C from '../palette';
import {MONO,leg,definePart,extState,c,pin,callout,type Inner} from './kit';

const WIRE_RED=0xd8392f; // ds-allow-hex  (probe cable, VDD)
const WIRE_YEL=0xe9c11f; // ds-allow-hex  (probe cable, DQ)
const WIRE_BLK=0x2a2c31; // ds-allow-hex  (probe cable, GND)

/** A straight leg from (x0,0) on the board up to (x1,y1) under the body, tilted like a fanned-out TO-92 leg. */
function slantLeg(x0:number,x1:number,y1:number):Mesh{
 const dx=x1-x0,L=Math.hypot(dx,y1);
 return solid(new BoxGeometry(0.5,L,0.5),C.SILVER,{pos:[(x0+x1)/2,y1/2,0],rot:[0,0,-Math.asin(dx/L)],cast:false,finish:'metal'});
}
function printTex(text:string):ReturnType<typeof canvasTexture>{
 const cv=document.createElement('canvas');cv.width=256;cv.height=128;
 const g=cv.getContext('2d')!;
 g.fillStyle=C.CHIP_PRINT;g.textAlign='center';g.textBaseline='middle';
 g.font=`700 44px ${MONO}`;g.fillText(text,128,44);
 g.font=`500 28px ${MONO}`;g.fillText('2615',128,92);
 return canvasTexture(cv);
}
/** The shared TO-92 package: D-shaped body (flat face toward the viewer), three fanned legs, print on the flat face and an activity light on top. */
export function to92Body(g:Group,label:string):{light:MeshStandardMaterial}{
 const R=2.4,flat=1.5,H=5,y0=3;     // radius, flat face distance from the axis, body height, body bottom
 const cx=PITCH;
 for(let i=0;i<3;i++)g.add(slantLeg(i*PITCH,cx+(i-1)*1.27,y0+0.2));
 const a=Math.asin(flat/R),hw=Math.cos(a)*R;
 const sh=new Shape();sh.moveTo(hw,-flat);sh.absarc(0,0,R,-a,Math.PI+a,false);sh.closePath();
 const geo=new ExtrudeGeometry(sh,{depth:H,bevelEnabled:false,curveSegments:24});
 const body=solid(geo,C.CHIP,{outline:true,edges:true,pos:[cx,y0,0],rot:[-Math.PI/2,0,0],own:true});
 g.add(body);
 const print=new Mesh(new PlaneGeometry(3.3,1.7),new MeshBasicMaterial({map:printTex(label),transparent:true,toneMapped:false,depthWrite:false}));
 print.material.userData.own=true;print.material.userData.ownMap=true;
 print.position.set(cx,y0+H/2,flat+0.02);print.userData.noPick=true;print.userData.noInk=true;g.add(print);
 const light=new Mesh(new CylinderGeometry(0.8,0.8,0.05,16),new MeshStandardMaterial({color:C.HEADER_TOP}));
 light.material.userData.own=true;light.position.set(cx,y0+H+0.03,0);light.userData.noPick=true;light.userData.noInk=true;g.add(light);
 return {light:light.material as MeshStandardMaterial};
}

function buildProbe(g:Group):{band:MeshStandardMaterial}{
 const cx=PITCH,r=3,tube=36,z1=-16;
 // three pigtail wires from the holes up to the cable (black, yellow, red = GND, DQ, VDD)
 const cols=[WIRE_BLK,WIRE_YEL,WIRE_RED];
 for(let i=0;i<3;i++){
  g.add(leg(i*PITCH,3));
  const x0=i*PITCH,dx=cx-x0,dz=-5,L=Math.hypot(dx,dz);
  const m=solid(new BoxGeometry(0.9,0.9,L),cols[i]!,{pos:[(x0+cx)/2,3,dz/2],rot:[0,Math.atan2(dx,dz),0],cast:false});
  g.add(m);
 }
 // cable sheath and the strain-relief boot
 g.add(solid(new CylinderGeometry(1.5,1.5,6,16),C.CHIP,{pos:[cx,3,-8],rot:[Math.PI/2,0,0],outline:true}));
 g.add(solid(new CylinderGeometry(2.2,2.2,4,16),C.CHIP,{pos:[cx,3,-12],rot:[Math.PI/2,0,0],outline:true,edges:true}));
 // the stainless sensor tube, lying on the board
 g.add(solid(new CylinderGeometry(r,r,tube,28),C.SILVER,{pos:[cx,r,z1-tube/2],rot:[Math.PI/2,0,0],outline:true,finish:'metal'}));
 const cap=solid(new SphereGeometry(r,20,12,0,Math.PI*2,0,Math.PI/2),C.SILVER,{pos:[cx,r,z1-tube],rot:[-Math.PI/2,0,0],finish:'metal'});
 g.add(cap);
 // a thin band near the tip glows green while a conversion runs
 const band=new Mesh(new CylinderGeometry(r+0.08,r+0.08,2,28),new MeshStandardMaterial({color:C.SILVER_DARK}));
 band.material.userData.own=true;band.position.set(cx,r,z1-tube+6);band.rotation.x=Math.PI/2;band.userData.noPick=true;band.userData.noInk=true;g.add(band);
 return {band:band.material as MeshStandardMaterial};
}

function buildDs(p:PartProps,g:Group):Inner{
 const idle=C.HEADER_TOP;
 const glow=(m:MeshStandardMaterial,on:boolean):void=>{m.color.set(on?C.LIVE:idle);m.emissive.set(on?C.LIVE:0);m.emissiveIntensity=on?0.9:0;};
 if(p.form==='probe'){
  const pr=buildProbe(g);
  return {apply(s){const st=extState<Ds18b20State>(s,'ds18b20');if(!st)return;pr.band.color.set(st.converting||st.active?C.LIVE:C.SILVER_DARK);pr.band.emissive.set(st.converting||st.active?C.LIVE:0);pr.band.emissiveIntensity=st.converting||st.active?0.9:0;}};
 }
 const b=to92Body(g,'DS18B20');
 return {apply(s){const st=extState<Ds18b20State>(s,'ds18b20');if(st)glow(b.light,st.converting||st.active);}};
}

const P=(i:number):[number,number,number]=>[i*PITCH,0,0];
export const ds18b20=definePart({
 kind:'ds18b20',name:c('DS18B20 thermometer','Termometer DS18B20'),
 pins:{GND:pin(P(0),'ground','Ground (black wire on the probe)','Ground (kabel hitam pada probe)'),DQ:pin(P(1),'output','DQ: the one-wire data line, needs a 4.7k pull-up (yellow wire)','DQ: jalur data satu kabel, perlu pull-up 4,7k (kabel kuning)'),VDD:pin(P(2),'power','VDD 3V to 5.5V (red wire)','VDD 3V sampai 5,5V (kabel merah)')},
 callouts:[
  callout('body',[PITCH,10,0],'Flat face toward you: GND, DQ, VDD from the left','Sisi datar menghadap Anda: GND, DQ, VDD dari kiri'),
  callout('dq',[PITCH,1,0],'DQ carries every bit, in both directions, on one wire','DQ membawa semua bit, dua arah, lewat satu kabel'),
 ],
 make:buildDs,
});
