/** DHT22 / AM2302: white grille body on four legs. Pairs with sim/devices/dht22.ts (single-wire protocol). */
import {BoxGeometry,Color,Group,Mesh,MeshBasicMaterial,MeshStandardMaterial,PlaneGeometry} from 'three';
import type {PartProps} from '../../contract';
import type {Dht22State} from '../../sim/devices/dht22';
import {PITCH} from '../layout';
import {canvasTexture,ownToon,solid} from '../materials';
import * as C from '../palette';
import {MONO,leg,definePart,extState,c,pin,callout,type Inner} from './kit';

const CASE=0xf4f4f1; // ds-allow-hex  (white AM2302 plastic)
const SLOT=0x9a9d99; // ds-allow-hex

function printTex():ReturnType<typeof canvasTexture>{
 const cv=document.createElement('canvas');cv.width=256;cv.height=128;
 const g=cv.getContext('2d')!;
 g.fillStyle='#2b2d31';g.textAlign='center';g.textBaseline='middle';
 g.font=`700 52px ${MONO}`;g.fillText('AM2302',128,40);
 g.font=`500 34px ${MONO}`;g.fillText('DHT22',128,92);
 return canvasTexture(cv);
}

function buildDht(_p:PartProps,g:Group):Inner{
 const cx=1.5*PITCH,W=15.1,H=20,D=7.7,y0=4;
 for(let i=0;i<4;i++)g.add(leg(i*PITCH,y0+0.4));
 g.add(solid(new BoxGeometry(W,H,D),CASE,{outline:true,edges:true,pos:[cx,y0+H/2,0],own:true}));
 // sensing grille: rows of slots on the front face
 const slotMat=ownToon(SLOT);
 const slots:Mesh[]=[];
 for(let r=0;r<7;r++){
  const m=new Mesh(new BoxGeometry(W-5,0.8,0.5),slotMat);
  m.position.set(cx,y0+H-3.2-r*1.7,D/2+0.05);m.userData.noPick=true;m.userData.noInk=true;g.add(m);slots.push(m);
 }
 const print=new Mesh(new PlaneGeometry(12,6),new MeshBasicMaterial({map:printTex(),transparent:true,toneMapped:false,depthWrite:false}));
 print.material.userData.own=true;print.material.userData.ownMap=true;print.position.set(cx,y0+4.2,D/2+0.06);print.userData.noPick=true;print.userData.noInk=true;g.add(print);
 const idle=new Color(SLOT),live=new Color(C.LIVE);
 return {
  apply(s){
   const st=extState<Dht22State>(s,'dht22');
   if(!st)return;
   const col=st.active?live:idle;
   slotMat.color.copy(col);
   (slotMat as MeshStandardMaterial).emissive.copy(st.active?live:new Color(0));
   (slotMat as MeshStandardMaterial).emissiveIntensity=st.active?0.9:0;
  },
 };
}

export const dht22=definePart({
 kind:'dht22',name:c('DHT22 sensor','Sensor DHT22'),
 pins:{VCC:pin([0,0,0],'power','5V','5V'),DATA:pin([PITCH,0,0],'output','Data (one wire)','Data (satu kabel)'),NC:pin([2*PITCH,0,0],'passive','Not connected','Tidak terhubung'),GND:pin([3*PITCH,0,0],'ground','Ground','Ground')},
 callouts:[callout('grille',[1.5*PITCH,18,5],'Humidity and temperature enter here','Kelembapan dan suhu masuk di sini'),callout('data',[PITCH,0,0],'One wire carries all 40 bits','Satu kabel membawa 40 bit')],
 make:buildDht,
});
