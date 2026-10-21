/** BME280 on a purple GY-BME280 breakout (about 15 x 11.5 mm, six pins). Pairs with sim/devices/bme280.ts (I2C register model). */
import {BoxGeometry,CylinderGeometry,Group,Mesh,MeshBasicMaterial,MeshStandardMaterial,PlaneGeometry} from 'three';
import type {PartProps} from '../../contract';
import type {Bme280State} from '../../sim/devices/bme280';
import {PITCH} from '../layout';
import {canvasTexture,solid} from '../materials';
import * as C from '../palette';
import {MONO,leg,definePart,extState,c,pin,callout,type Inner} from './kit';

const PURPLE=0x5b2a86; // ds-allow-hex  (purple solder mask of the GY-BME280 breakout)
const LID=0xc9ced6; // ds-allow-hex  (brushed metal lid of the sensor)
const SMD=0xb8a27a; // ds-allow-hex  (tan ceramic capacitor / resistor body)

const PINS=['VCC','GND','SCL','SDA','CSB','SDO'];

function printTex():ReturnType<typeof canvasTexture>{
 const cv=document.createElement('canvas');cv.width=256;cv.height=96;
 const g=cv.getContext('2d')!;
 g.fillStyle=C.SILKSCREEN;g.textAlign='left';g.textBaseline='middle';
 g.font=`700 40px ${MONO}`;g.fillText('BME280',10,26);
 g.font=`500 24px ${MONO}`;g.fillText('T  H  P  I2C',10,70);
 return canvasTexture(cv);
}

function buildBme(_p:PartProps,g:Group):Inner{
 const cx=2.5*PITCH,W=15,D=11.5,T=1.6,y0=2.6,zc=-D/2+1;   // header edge at z=+1, board runs back to z=-10.5
 for(let i=0;i<PINS.length;i++)g.add(leg(i*PITCH,y0+0.4));
 const yTop=y0+T;
 g.add(solid(new BoxGeometry(W,T,D),PURPLE,{outline:true,edges:true,pos:[cx,y0+T/2,zc],own:true}));
 // pad row along the header edge
 for(let i=0;i<PINS.length;i++){
  const pad=new Mesh(new CylinderGeometry(0.9,0.9,0.05,14),new MeshStandardMaterial({color:C.GOLD,metalness:0.6,roughness:0.4}));
  pad.material.userData.own=true;pad.position.set(i*PITCH,yTop+0.03,0);pad.userData.noPick=true;pad.userData.noInk=true;g.add(pad);
 }
 // the sensor: 2.5 x 2.5 x 0.93 mm metal lid with the pressure/humidity vent hole
 const lid=solid(new BoxGeometry(2.5,0.93,2.5),LID,{outline:true,edges:true,pos:[cx+3.4,yTop+0.47,zc-0.8],own:true,finish:'metal'});
 g.add(lid);
 const vent=new Mesh(new CylinderGeometry(0.28,0.28,0.04,12),new MeshStandardMaterial({color:C.HOLE}));
 vent.material.userData.own=true;vent.position.set(cx+3.4-0.5,yTop+0.95,zc-0.8-0.5);vent.userData.noPick=true;vent.userData.noInk=true;g.add(vent);
 const ventMat=vent.material as MeshStandardMaterial;
 // regulator (SOT-23-5) and passives
 g.add(solid(new BoxGeometry(2.9,1.1,1.6),C.CHIP,{outline:true,pos:[cx-4,yTop+0.55,zc-0.5],own:true}));
 for(const [x,z] of [[-1.2,-2.8],[0.4,-3.2],[1.8,-2.4],[-0.4,2.4-D/2+1],[-5.2,-4.8]] as const){
  g.add(solid(new BoxGeometry(1.0,0.5,0.55),SMD,{pos:[cx+x,yTop+0.25,zc+z],own:true}));
 }
 // mounting-free silkscreen
 const print=new Mesh(new PlaneGeometry(7.6,2.85),new MeshBasicMaterial({map:printTex(),transparent:true,toneMapped:false,depthWrite:false}));
 print.material.userData.own=true;print.material.userData.ownMap=true;
 print.rotation.x=-Math.PI/2;print.position.set(cx-2.2,yTop+0.04,zc+2.7);print.userData.noPick=true;print.userData.noInk=true;g.add(print);
 return {
  apply(s){
   const st=extState<Bme280State>(s,'bme280');
   if(!st)return;
   // the vent hole glows green while a conversion runs
   ventMat.color.set(st.measuring?C.LIVE:C.HOLE);
   ventMat.emissive.set(st.measuring?C.LIVE:0);ventMat.emissiveIntensity=st.measuring?1:0;
  },
 };
}

const P=(i:number):[number,number,number]=>[i*PITCH,0,0];
export const bme280=definePart({
 kind:'bme280',name:c('BME280 sensor','Sensor BME280'),
 pins:{
  VCC:pin(P(0),'power','Power 3.3V to 5V','Daya 3,3V sampai 5V'),GND:pin(P(1),'ground','Ground','Ground'),
  SCL:pin(P(2),'input','SCL (I2C clock)','SCL (clock I2C)'),SDA:pin(P(3),'input','SDA (I2C data)','SDA (data I2C)'),
  CSB:pin(P(4),'passive','CSB (leave open for I2C)','CSB (biarkan untuk I2C)'),SDO:pin(P(5),'passive','SDO (address: GND 0x76, 5V 0x77)','SDO (alamat: GND 0x76, 5V 0x77)'),
 },
 callouts:[
  callout('lid',[2.5*PITCH+3.4,6,-1.8],'The metal lid hides temperature, humidity and pressure sensors','Tutup logam menyembunyikan sensor suhu, kelembapan, dan tekanan'),
  callout('sdo',[5*PITCH,1,0],'SDO picks the I2C address','SDO memilih alamat I2C'),
 ],
 make:buildBme,
});
