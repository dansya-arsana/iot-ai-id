/** HC-05 Bluetooth module on its breakout (15.5 x 36 mm, six pins) with a small floating phone that shows the terminal. Pairs with sim/devices/hc05-bluetooth.ts. */
import {BoxGeometry,Group,Mesh,MeshBasicMaterial,MeshStandardMaterial,PlaneGeometry} from 'three';
import type {PartProps} from '../../contract';
import type {Hc05State} from '../../sim/devices/hc05-bluetooth';
import {PITCH} from '../layout';
import {canvasTexture,solid} from '../materials';
import * as C from '../palette';
import {MONO,hex,leg,definePart,extState,c,pin,callout,type Inner} from './kit';

const MODULE=0x2a6fb5; // ds-allow-hex  (blue core module board)
const BUTTON=0x2f2f33; // ds-allow-hex  (black tact switch body)
const PHONE=0x15171b; // ds-allow-hex  (phone bezel)

const PINS=['STATE','RXD','TXD','GND','VCC','EN'];

function label(lines:readonly string[],w:number,h:number,px:number,color:string=C.SILKSCREEN):Mesh{
 const cv=document.createElement('canvas');cv.width=256;cv.height=Math.round(256*h/w);
 const g=cv.getContext('2d')!;g.fillStyle=color;g.textAlign='center';g.textBaseline='middle';g.font=`700 ${px}px ${MONO}`;
 lines.forEach((t,i)=>g.fillText(t,128,cv.height*(i+0.5)/lines.length));
 const m=new Mesh(new PlaneGeometry(w,h),new MeshBasicMaterial({map:canvasTexture(cv),transparent:true,toneMapped:false,depthWrite:false}));
 m.material.userData.own=true;m.material.userData.ownMap=true;m.userData.noPick=true;m.userData.noInk=true;
 return m;
}

function buildHc05(_p:PartProps,g:Group):Inner{
 const cx=2.5*PITCH,BW=15.5,BH=36,T=1.4,y0=3,zc=-T/2;
 for(let i=0;i<PINS.length;i++)g.add(leg(i*PITCH,y0+0.4));
 g.add(solid(new BoxGeometry(BW,BH,T),C.PCB,{outline:true,edges:true,pos:[cx,y0+BH/2,zc],own:true}));
 const zf=T/2+zc;
 // the core module board 13.5 x 26.9 mm, standing on the carrier
 const my=y0+BH-26.9/2-1.4;
 g.add(solid(new BoxGeometry(13.5,26.9,1.0),MODULE,{outline:true,edges:true,pos:[cx,my,zf+0.5],own:true}));
 // metal shield over the radio chip, the meander antenna is the bare top end
 g.add(solid(new BoxGeometry(12.2,15.4,2.2),C.SILVER,{outline:true,edges:true,pos:[cx,my-3.4,zf+1.0+1.1],own:true,finish:'metal'}));
 const ml=label(['HC-05'],10,3,48,hex(C.CHIP));ml.position.set(cx,my-3.4,zf+3.23);g.add(ml);
 // key / EN button and the status LED
 g.add(solid(new BoxGeometry(3.6,3.6,1.6),BUTTON,{outline:true,pos:[cx-4.4,y0+7,zf+0.8],own:true}));
 const led=new MeshStandardMaterial({color:C.RED_ALERT,emissive:C.RED_ALERT,emissiveIntensity:0.05});led.userData.own=true;
 const lm=new Mesh(new BoxGeometry(1.6,0.8,0.7),led);lm.position.set(cx+3.6,y0+7,zf+0.35);lm.userData.noPick=true;g.add(lm);
 const sl=label(['STA RXD TXD GND VCC EN'],14,2.2,16);sl.position.set(cx,y0+2.6,zf+0.03);g.add(sl);
 // the phone: landscape 44 x 24 mm bezel floating above the module, screen = the terminal
 const phone=new Group();phone.position.set(cx,y0+BH+27,zf+2);g.add(phone);
 phone.add(solid(new BoxGeometry(46,25,1.6),PHONE,{outline:true,edges:true,own:true}));
 const cv=document.createElement('canvas');cv.width=368;cv.height=192;
 const tex=canvasTexture(cv);
 const scr=new Mesh(new PlaneGeometry(43,22.5),new MeshBasicMaterial({map:tex,toneMapped:false}));
 scr.material.userData.own=true;scr.material.userData.ownMap=true;scr.position.z=0.82;scr.userData.noPick=true;scr.userData.noInk=true;phone.add(scr);
 // the floating phone is a prop: it stays out of the framing of thumbnails and the camera, so the module itself fills the card
 phone.traverse(o=>{o.userData.noFit=true;});
 let last='#';
 const draw=(st:Hc05State):void=>{
  const key=st.connected+'|'+st.transcript+'|'+st.atMode;
  if(key===last)return;last=key;
  const k=cv.getContext('2d')!;
  k.fillStyle=st.connected?'#0b1220':'#20242b';k.fillRect(0,0,368,192);
  k.font=`600 20px ${MONO}`;k.textBaseline='top';
  k.fillStyle=st.connected?'#58b8ff':'#8b919c';
  k.fillText(st.atMode?'AT mode (phone off)':st.connected?'Serial terminal':'not connected',8,6);
  const rows=st.transcript.split('\n').filter(Boolean).slice(-6);
  rows.forEach((r,i)=>{k.fillStyle=r.startsWith('>')?'#9be8b4':'#e9f1ff';k.fillText(r.slice(0,26),8,36+i*25);});
  tex.needsUpdate=true;
 };
 draw({connected:true,atMode:false,transcript:'< hello from the board\n> LED ON'} as Hc05State);
 return {
  apply(s){
   const st=extState<Hc05State>(s,'hc05-bluetooth');
   if(!st)return;
   led.emissiveIntensity=st.led?2.4:0.05;
   draw(st);
  },
 };
}

const P=(i:number):[number,number,number]=>[i*PITCH,0,0];
export const hc05Bluetooth=definePart({
 kind:'hc05-bluetooth',name:c('HC-05 Bluetooth module','Modul Bluetooth HC-05'),
 pins:{
  STATE:pin(P(0),'output','STATE (high while paired)','STATE (tinggi saat terhubung)'),RXD:pin(P(1),'input','RXD (receives from the sketch)','RXD (menerima dari sketch)'),
  TXD:pin(P(2),'output','TXD (sends to the sketch)','TXD (mengirim ke sketch)'),GND:pin(P(3),'ground','Ground','Ground'),
  VCC:pin(P(4),'power','Power 3.6V to 6V','Daya 3,6V sampai 6V'),EN:pin(P(5),'input','EN (high = AT command mode)','EN (tinggi = mode perintah AT)'),
 },
 callouts:[
  callout('shield',[2.5*PITCH,3+36-14,4],'The metal shield covers the Bluetooth radio','Pelindung logam menutupi radio Bluetooth'),
  callout('led',[2.5*PITCH+3.6,3+7,2],'The LED speed tells the state: fast = waiting, slow = AT mode, double = paired','Kecepatan LED menandai keadaan: cepat = menunggu, lambat = mode AT, ganda = terhubung'),
  callout('phone',[2.5*PITCH,3+36+27,3],'The floating phone shows the terminal text','Ponsel melayang menampilkan teks terminal'),
 ],
 make:buildHc05,
});
