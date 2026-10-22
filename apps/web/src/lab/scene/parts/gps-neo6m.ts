/** NEO-6M GPS on a GY-GPS6MV2 style breakout: 25 x 35 mm board standing on a 4-pin header, metal receiver can, ceramic patch antenna, backup cell. Pairs with sim/devices/gps-neo6m.ts. */
import {BoxGeometry,CylinderGeometry,Group,Mesh,MeshBasicMaterial,MeshStandardMaterial,PlaneGeometry} from 'three';
import type {PartProps} from '../../contract';
import type {GpsState} from '../../sim/devices/gps-neo6m';
import {PITCH} from '../layout';
import {canvasTexture,solid} from '../materials';
import * as C from '../palette';
import {MONO,hex,leg,definePart,extState,c,pin,callout,type Inner} from './kit';

const BOARD=0x1c62bd; // ds-allow-hex  (blue solder mask of the GY-GPS6MV2 breakout)
const CERAMIC=0xd9c7a0; // ds-allow-hex  (beige ceramic of the patch antenna)
const PATCH=0xb09a63; // ds-allow-hex  (gold silvered patch on the ceramic)

function label(lines:readonly string[],w:number,h:number,px:number,color:string=C.SILKSCREEN):Mesh{
 const cv=document.createElement('canvas');cv.width=256;cv.height=Math.round(256*h/w);
 const g=cv.getContext('2d')!;g.fillStyle=color;g.textAlign='center';g.textBaseline='middle';g.font=`700 ${px}px ${MONO}`;
 lines.forEach((t,i)=>g.fillText(t,128,cv.height*(i+0.5)/lines.length));
 const m=new Mesh(new PlaneGeometry(w,h),new MeshBasicMaterial({map:canvasTexture(cv),transparent:true,toneMapped:false,depthWrite:false}));
 m.material.userData.own=true;m.material.userData.ownMap=true;m.userData.noPick=true;m.userData.noInk=true;
 return m;
}

function buildGps(_p:PartProps,g:Group):Inner{
 const cx=1.5*PITCH,BW=25,BH=35,T=1.4,y0=3,zc=-T/2;
 for(let i=0;i<4;i++)g.add(leg(i*PITCH,y0+0.4));
 g.add(solid(new BoxGeometry(BW,BH,T),BOARD,{outline:true,edges:true,pos:[cx,y0+BH/2,zc],own:true}));
 const zf=T/2+zc;
 // ceramic patch antenna 16 x 16 x 4 mm at the top
 const ay=y0+BH-9.6;
 g.add(solid(new BoxGeometry(16,16,3.6),CERAMIC,{outline:true,edges:true,pos:[cx,ay,zf+1.8],own:true}));
 g.add(solid(new BoxGeometry(12.4,12.4,0.2),PATCH,{pos:[cx,ay,zf+3.7],own:true,finish:'metal'}));
 // receiver can 16 x 12.2 x 2.4 mm, lower middle
 const cy=y0+10.5;
 g.add(solid(new BoxGeometry(16,12.2,2.4),C.SILVER,{outline:true,edges:true,pos:[cx,cy,zf+1.2],own:true,finish:'metal'}));
 const tl=label(['GPS','6M'],10,5,50,hex(C.CHIP));tl.position.set(cx,cy,zf+2.43);g.add(tl);
 // backup cell (a 6 mm rechargeable disc) and the PPS LED
 const cell=solid(new CylinderGeometry(3,3,1.6,18),C.CHIP,{outline:true,pos:[cx+9.4,cy-3,zf+0.8],rot:[Math.PI/2,0,0],own:true});g.add(cell);
 const led=new MeshStandardMaterial({color:C.RED_ALERT,emissive:C.RED_ALERT,emissiveIntensity:0.1});led.userData.own=true;
 const lm=new Mesh(new BoxGeometry(1.6,0.8,0.7),led);lm.position.set(cx-9.4,cy+3,zf+0.35);lm.userData.noPick=true;g.add(lm);
 const sl=label(['VCC RX TX GND'],14,2.4,20);sl.position.set(cx,y0+2.4,zf+0.03);g.add(sl);
 return {
  apply(s){
   const st=extState<GpsState>(s,'gps-neo6m');
   if(!st)return;
   // the LED is the PPS output: one 100 ms flash per second, only with a fix
   led.emissiveIntensity=st.pps?2.4:0.1;
  },
 };
}

const P=(i:number):[number,number,number]=>[i*PITCH,0,0];
export const gpsNeo6m=definePart({
 kind:'gps-neo6m',name:c('NEO-6M GPS module','Modul GPS NEO-6M'),
 pins:{
  VCC:pin(P(0),'power','Power 3.3V to 5V','Daya 3,3V sampai 5V'),RX:pin(P(1),'input','RX (receives from the sketch)','RX (menerima dari sketch)'),
  TX:pin(P(2),'output','TX (sends NMEA to the sketch)','TX (mengirim NMEA ke sketch)'),GND:pin(P(3),'ground','Ground','Ground'),
 },
 callouts:[
  callout('antenna',[1.5*PITCH,3+35-9.6,5],'The ceramic patch hears the satellites','Patch keramik ini mendengar satelit'),
  callout('led',[1.5*PITCH-9.4,3+10.5+3,1.5],'The LED flashes once per second while there is a fix','LED berkedip sekali per detik saat ada fix'),
 ],
 make:buildGps,
});
