/** BH1750 on a GY-302 style breakout: about 18.5 x 13.9 mm blue PCB, 5-pin header, the clear-top sensor (3.0 x 1.6 mm), the 662K regulator and two mounting holes. Pairs with sim/devices/bh1750.ts. */
import {BoxGeometry,CylinderGeometry,Group,Mesh,MeshBasicMaterial,MeshStandardMaterial,PlaneGeometry} from 'three';
import type {PartProps} from '../../contract';
import type {Bh1750State} from '../../sim/devices/bh1750';
import {PITCH} from '../layout';
import {canvasTexture,solid} from '../materials';
import * as C from '../palette';
import {MONO,leg,definePart,extState,c,pin,callout,type Inner} from './kit';

const BLUE=0x1f4fa8; // ds-allow-hex  (blue solder mask of the GY-302 breakout)
const CLEAR=0xdfe6ea; // ds-allow-hex  (clear plastic top of the light sensor)
const SMD=0xb8a27a; // ds-allow-hex  (tan SMD passive body)
/** mm: l is along the header, w the depth, h the board thickness. */
export const DIMS={l:18.5,w:13.9,h:1.6,mm:true as const,holes:[[1.8,2,3],[16.7,2,3]] as [number,number,number][]};
const PINS=['VCC','GND','SCL','SDA','ADDR'];

function printTex():ReturnType<typeof canvasTexture>{
 const cv=document.createElement('canvas');cv.width=256;cv.height=96;
 const g=cv.getContext('2d')!;
 g.fillStyle=C.SILKSCREEN;g.textAlign='left';g.textBaseline='middle';
 g.font=`700 42px ${MONO}`;g.fillText('GY-302',8,28);
 g.font=`500 24px ${MONO}`;g.fillText('LUX  I2C',8,72);
 return canvasTexture(cv);
}

function buildBh(_p:PartProps,g:Group):Inner{
 const cx=2*PITCH,W=DIMS.l,D=DIMS.w,T=DIMS.h,y0=2.6,zc=-D/2+1;
 for(let i=0;i<PINS.length;i++)g.add(leg(i*PITCH,y0+0.4));
 const yTop=y0+T;
 g.add(solid(new BoxGeometry(W,T,D),BLUE,{outline:true,edges:true,pos:[cx,y0+T/2,zc],own:true}));
 // header housing under the pins and two mounting holes
 g.add(solid(new BoxGeometry(5*PITCH,1.6,2.5),C.HEADER_BLACK,{pos:[cx,y0+T+0.8,0.2],cast:false,own:true}));
 for(const [hx,hz] of [[-W/2+1.8,-D+3],[W/2-1.8,-D+3]] as const){
  const m=new Mesh(new CylinderGeometry(1.5,1.5,0.06,16),new MeshStandardMaterial({color:C.HOLE}));
  m.material.userData.own=true;m.position.set(cx+hx,yTop+0.04,hz);m.userData.noPick=true;m.userData.noInk=true;g.add(m);
 }
 // the sensor: 3.0 x 1.6 mm clear window, glows with the light level
 const win=solid(new BoxGeometry(3.0,0.7,1.6),CLEAR,{outline:true,edges:true,pos:[cx-1.5,yTop+0.35,zc-1],own:true});
 g.add(win);
 const wmat=win.material as unknown as MeshStandardMaterial;
 // 662K regulator (SOT-23) and passives
 g.add(solid(new BoxGeometry(2.9,1.1,1.6),C.CHIP,{outline:true,pos:[cx+4.2,yTop+0.55,zc-2],own:true}));
 for(const [x,z] of [[-5.5,-3.6],[-3,-4.8],[2.2,-4.4],[5.4,-4.6]] as const)g.add(solid(new BoxGeometry(1.0,0.5,0.55),SMD,{pos:[cx+x,yTop+0.25,zc+z],own:true}));
 const print=new Mesh(new PlaneGeometry(8.4,3.1),new MeshBasicMaterial({map:printTex(),transparent:true,toneMapped:false,depthWrite:false}));
 print.material.userData.own=true;print.material.userData.ownMap=true;
 print.rotation.x=-Math.PI/2;print.position.set(cx+2.8,yTop+0.04,zc+3.4);print.userData.noPick=true;print.userData.noInk=true;g.add(print);
 return {
  apply(s){
   const st=extState<Bh1750State>(s,'bh1750');
   if(!st)return;
   // the window warms from clear to pale yellow with the lux, and glows green while a conversion has latched
   const k=Math.min(1,Math.log10(1+st.lux)/5);
   wmat.color.setRGB(0.87+0.13*k,0.9+0.05*k,0.92-0.5*k);
   wmat.emissive.set(st.ready&&st.powered?C.LIVE:0);wmat.emissiveIntensity=st.ready&&st.powered?0.25:0;
  },
 };
}

const P=(i:number):[number,number,number]=>[i*PITCH,0,0];
export const bh1750=definePart({
 kind:'bh1750',name:c('BH1750 light sensor (GY-302)','Sensor cahaya BH1750 (GY-302)'),
 pins:{
  VCC:pin(P(0),'power','Power 3V to 5V','Daya 3V sampai 5V'),GND:pin(P(1),'ground','Ground','Ground'),
  SCL:pin(P(2),'input','SCL (I2C clock)','SCL (clock I2C)'),SDA:pin(P(3),'input','SDA (I2C data)','SDA (data I2C)'),
  ADDR:pin(P(4),'passive','ADDR (low or open 0x23, VCC 0x5C)','ADDR (low atau terbuka 0x23, VCC 0x5C)'),
 },
 callouts:[
  callout('window',[2*PITCH-1.5,8,-DIMS.w/2],'The light window: face the sky and shade it from rain','Jendela cahaya: hadapkan ke langit dan lindungi dari hujan'),
  callout('addr',[4*PITCH,6,0],'ADDR picks the address: low 0x23, high 0x5C','ADDR memilih alamat: low 0x23, high 0x5C'),
  callout('supply',[0,6,0],'Works from 3 V to 5 V (the module has its own regulator)','Bekerja dari 3 V sampai 5 V (modul punya regulator sendiri)'),
 ],
 make:buildBh,
});
