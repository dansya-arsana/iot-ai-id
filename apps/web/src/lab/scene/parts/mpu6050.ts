/**
 * MPU6050 on a GY-521 style breakout (about 21 x 16 x 1.6 mm, eight header pins). Pairs with sim/devices/mpu6050.ts.
 * The board hangs on tall header legs and tilts about its own centre: roll lifts the back edge, pitch drops the right edge,
 * with the same sign convention as the accelerometer formulas in the device. A small X/Y/Z triad shows the chip axes.
 */
import {BoxGeometry,CylinderGeometry,Group,Mesh,MeshBasicMaterial,MeshStandardMaterial,PlaneGeometry} from 'three';
import type {PartProps} from '../../contract';
import type {Mpu6050State} from '../../sim/devices/mpu6050';
import {PITCH} from '../layout';
import {canvasTexture,solid} from '../materials';
import * as C from '../palette';
import {MONO,leg,definePart,extState,c,pin,callout,type Inner} from './kit';

const BLUE=0x1d4f9e; // ds-allow-hex  (blue solder mask of the GY-521 breakout)
const SMD=0xb8a27a; // ds-allow-hex  (tan ceramic capacitor / resistor body)

const PINS=['VCC','GND','SCL','SDA','XDA','XCL','AD0','INT'];
const LEG_H=12;
const BW=21.2,BD=16.4,BT=1.6;

function printTex():ReturnType<typeof canvasTexture>{
 const cv=document.createElement('canvas');cv.width=256;cv.height=128;
 const g=cv.getContext('2d')!;
 g.fillStyle=C.SILKSCREEN;g.textAlign='left';g.textBaseline='middle';
 g.font=`700 40px ${MONO}`;g.fillText('GY-521',8,24);
 g.font=`500 22px ${MONO}`;g.fillText('MPU6050 6-axis',8,64);
 g.font=`700 24px ${MONO}`;g.fillText('X>  Y^',8,102);
 return canvasTexture(cv);
}

function axis(len:number,color:number,rot:[number,number,number],pos:[number,number,number]):Mesh{
 const m=solid(new BoxGeometry(len,0.35,0.35),color,{pos,own:true});
 m.rotation.set(...rot);m.userData.noPick=true;return m;
}

function buildMpu(_p:PartProps,g:Group):Inner{
 const cx=3.5*PITCH,zc=-BD/2+1.8;
 for(let i=0;i<PINS.length;i++)g.add(leg(i*PITCH,LEG_H));
 // fixed black header strip the legs come out of
 g.add(solid(new BoxGeometry(8*PITCH,2.5,2.5),C.HEADER_BLACK,{outline:true,pos:[cx,1.25,0]}));
 const tilt=new Group();tilt.position.set(cx,LEG_H,zc);g.add(tilt);
 const add=(m:Mesh)=>{tilt.add(m);return m;};
 add(solid(new BoxGeometry(BW,BT,BD),BLUE,{outline:true,edges:true,pos:[0,0,0],own:true}));
 const top=BT/2;
 for(let i=0;i<PINS.length;i++){
  const pad=new Mesh(new CylinderGeometry(0.9,0.9,0.05,14),new MeshStandardMaterial({color:C.GOLD,metalness:0.6,roughness:0.4}));
  pad.material.userData.own=true;pad.position.set((i-3.5)*PITCH,top+0.03,BD/2-1.8);pad.userData.noPick=true;pad.userData.noInk=true;tilt.add(pad);
 }
 // MPU-6050 itself: 4 x 4 x 0.9 mm QFN with the pin-1 dot
 add(solid(new BoxGeometry(4,0.9,4),C.CHIP,{outline:true,edges:true,pos:[1.5,top+0.45,-1.2],own:true}));
 const dot=new Mesh(new CylinderGeometry(0.28,0.28,0.04,12),new MeshStandardMaterial({color:C.CHIP_PRINT}));
 dot.material.userData.own=true;dot.position.set(0.3,top+0.92,-2.4);dot.userData.noPick=true;dot.userData.noInk=true;tilt.add(dot);
 // 3.3 V regulator (SOT-23-5), power LED and passives
 add(solid(new BoxGeometry(2.9,1.1,1.6),C.CHIP,{outline:true,pos:[-6.2,top+0.55,-2.4],own:true}));
 const led=add(solid(new BoxGeometry(1.6,0.6,0.8),C.LED_SMD_OFF,{pos:[-8,top+0.3,1],own:true}));
 const ledMat=led.material as MeshStandardMaterial;
 for(const [x,z] of [[-3.4,-4.4],[-3.4,-2.6],[5.6,-4.6],[5.6,2.4],[-0.8,3.6],[-5.8,1.2]] as const){
  add(solid(new BoxGeometry(1.0,0.5,0.55),SMD,{pos:[x,top+0.25,z],own:true}));
 }
 const print=new Mesh(new PlaneGeometry(9,4.5),new MeshBasicMaterial({map:printTex(),transparent:true,toneMapped:false,depthWrite:false}));
 print.material.userData.own=true;print.material.userData.ownMap=true;
 print.rotation.x=-Math.PI/2;print.position.set(-1.4,top+0.04,3.9);print.userData.noPick=true;print.userData.noInk=true;tilt.add(print);
 // axis triad on the chip: X right (red), Y toward the back (green), Z up (blue)
 const ax=top+1.1;
 add(axis(5,C.RED_ALERT,[0,0,0],[4,ax,-1.2]));
 add(axis(5,C.LIVE,[0,Math.PI/2,0],[1.5,ax,-3.8]));
 add(axis(5,C.RAIL_BLUE,[0,0,Math.PI/2],[1.5,ax+2.5,-1.2]));
 return {
  apply(s){
   const st=extState<Mpu6050State>(s,'mpu6050');
   if(!st)return;
   // Ry(pitch) Rx(roll) in the sensor frame: sensor Y is scene -z, so pitch turns about -z
   tilt.rotation.set(st.roll*Math.PI/180,0,-st.pitch*Math.PI/180,'ZXY');
   const on=!st.asleep;
   ledMat.color.set(on?C.LIVE:C.LED_SMD_OFF);ledMat.emissive.set(on?C.LIVE:0);ledMat.emissiveIntensity=on?1:0;
  },
 };
}

const P=(i:number):[number,number,number]=>[i*PITCH,0,0];
export const mpu6050=definePart({
 kind:'mpu6050',name:c('MPU6050 motion sensor (GY-521)','Sensor gerak MPU6050 (GY-521)'),
 pins:{
  VCC:pin(P(0),'power','Power 3.3V to 5V','Daya 3,3V sampai 5V'),GND:pin(P(1),'ground','Ground','Ground'),
  SCL:pin(P(2),'input','SCL (I2C clock)','SCL (clock I2C)'),SDA:pin(P(3),'input','SDA (I2C data)','SDA (data I2C)'),
  XDA:pin(P(4),'passive','XDA (aux I2C data, unused)','XDA (data I2C bantu, tak dipakai)'),XCL:pin(P(5),'passive','XCL (aux I2C clock, unused)','XCL (clock I2C bantu, tak dipakai)'),
  AD0:pin(P(6),'input','AD0 (address: GND 0x68, 5V 0x69)','AD0 (alamat: GND 0x68, 5V 0x69)'),INT:pin(P(7),'output','INT (data ready)','INT (data siap)'),
 },
 callouts:[
  callout('chip',[3.5*PITCH+1.5,LEG_H+3,-1.2-BD/2+1.8],'The motion chip: accelerometer, gyroscope and a thermometer in one','Chip gerak: akselerometer, giroskop, dan termometer dalam satu'),
  callout('ad0',[6*PITCH,LEG_H+1,0],'AD0 picks the I2C address, 0x68 or 0x69','AD0 memilih alamat I2C, 0x68 atau 0x69'),
 ],
 make:buildMpu,
});
