/** BMP280 on a blue GY-BMP280 style breakout (15 x 11.5 mm, six pins). The sensor is the real 2.0 x 2.5 x 0.95 mm metal-lid LGA. Pairs with sim/devices/bmp280.ts (I2C). */
import {BoxGeometry,CylinderGeometry,Group,Mesh,MeshBasicMaterial,MeshStandardMaterial,PlaneGeometry} from 'three';
import type {PartProps} from '../../contract';
import type {Bmp280State} from '../../sim/devices/bmp280';
import {PITCH} from '../layout';
import {canvasTexture,solid} from '../materials';
import * as C from '../palette';
import {MONO,leg,definePart,extState,c,pin,callout,type Inner} from './kit';

const LID=0xc9ced6; // ds-allow-hex  (brushed metal lid of the sensor)
const SMD=0xb8a27a; // ds-allow-hex  (tan ceramic capacitor / resistor body)
const PINS=['VCC','GND','SCL','SDA','CSB','SDO'];

function printTex():ReturnType<typeof canvasTexture>{
 const cv=document.createElement('canvas');cv.width=256;cv.height=96;
 const g=cv.getContext('2d')!;
 g.fillStyle=C.SILKSCREEN;g.textAlign='left';g.textBaseline='middle';
 g.font=`700 40px ${MONO}`;g.fillText('BMP280',10,26);
 g.font=`500 24px ${MONO}`;g.fillText('P  T  I2C  3V3',10,70);
 return canvasTexture(cv);
}

function buildBmp(_p:PartProps,g:Group):Inner{
 const cx=2.5*PITCH,W=15,D=11.5,T=1.6,y0=2.6,zc=-D/2+1;
 for(let i=0;i<PINS.length;i++)g.add(leg(i*PITCH,y0+0.4));
 const yTop=y0+T;
 g.add(solid(new BoxGeometry(W,T,D),C.SONAR_PCB,{outline:true,edges:true,pos:[cx,y0+T/2,zc],own:true}));
 for(let i=0;i<PINS.length;i++){
  const pad=new Mesh(new CylinderGeometry(0.9,0.9,0.05,14),new MeshStandardMaterial({color:C.GOLD,metalness:0.6,roughness:0.4}));
  pad.material.userData.own=true;pad.position.set(i*PITCH,yTop+0.03,0);pad.userData.noPick=true;pad.userData.noInk=true;g.add(pad);
 }
 // the sensor: 2.0 x 0.95 x 2.5 mm metal lid (x, y, z) with the single pressure port hole near one corner
 g.add(solid(new BoxGeometry(2.0,0.95,2.5),LID,{outline:true,edges:true,pos:[cx+3.2,yTop+0.48,zc-0.6],own:true,finish:'metal'}));
 const port=new Mesh(new CylinderGeometry(0.3,0.3,0.04,12),new MeshStandardMaterial({color:C.HOLE}));
 port.material.userData.own=true;port.position.set(cx+3.2-0.45,yTop+0.97,zc-0.6-0.7);port.userData.noPick=true;port.userData.noInk=true;g.add(port);
 const portMat=port.material as MeshStandardMaterial;
 // 3.3 V regulator (SOT-23-5) and passives
 g.add(solid(new BoxGeometry(2.9,1.1,1.6),C.CHIP,{outline:true,pos:[cx-4,yTop+0.55,zc-0.5],own:true}));
 for(const [x,z] of [[-1.2,-2.8],[0.4,-3.2],[1.8,-2.4],[-0.4,2.4-D/2+1],[-5.2,-4.8]] as const){
  g.add(solid(new BoxGeometry(1.0,0.5,0.55),SMD,{pos:[cx+x,yTop+0.25,zc+z],own:true}));
 }
 const print=new Mesh(new PlaneGeometry(7.6,2.85),new MeshBasicMaterial({map:printTex(),transparent:true,toneMapped:false,depthWrite:false}));
 print.material.userData.own=true;print.material.userData.ownMap=true;
 print.rotation.x=-Math.PI/2;print.position.set(cx-2.2,yTop+0.04,zc+2.7);print.userData.noPick=true;print.userData.noInk=true;g.add(print);
 return {
  apply(s){
   const st=extState<Bmp280State>(s,'bmp280');
   if(!st)return;
   // the pressure port glows green while a conversion runs
   portMat.color.set(st.measuring?C.LIVE:C.HOLE);
   portMat.emissive.set(st.measuring?C.LIVE:0);portMat.emissiveIntensity=st.measuring?1:0;
  },
 };
}

const P=(i:number):[number,number,number]=>[i*PITCH,0,0];
export const bmp280=definePart({
 kind:'bmp280',name:c('BMP280 sensor','Sensor BMP280'),
 pins:{
  VCC:pin(P(0),'power','Power 3.3V (not 5V)','Daya 3,3V (bukan 5V)'),GND:pin(P(1),'ground','Ground','Ground'),
  SCL:pin(P(2),'input','SCL (I2C clock)','SCL (clock I2C)'),SDA:pin(P(3),'input','SDA (I2C data)','SDA (data I2C)'),
  CSB:pin(P(4),'passive','CSB (leave open for I2C)','CSB (biarkan untuk I2C)'),SDO:pin(P(5),'passive','SDO (address: GND 0x76, supply 0x77)','SDO (alamat: GND 0x76, suplai 0x77)'),
 },
 callouts:[
  callout('lid',[2.5*PITCH+3.2,6,-1.2],'The metal lid has one small port: air reaches the pressure sensor through it','Tutup logam punya satu lubang kecil: udara sampai ke sensor tekanan lewat situ'),
  callout('sdo',[5*PITCH,1,0],'SDO picks the I2C address','SDO memilih alamat I2C'),
 ],
 make:buildBmp,
});
