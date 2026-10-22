/**
 * HALL-A3144 on a small 3-pin module: TO-92 Hall switch lying flat-face-up on bent leads, an SMD pull-up and an indicator LED.
 * The popover magnet (10 mm disc, 3 mm thick) hangs above the flat face at the simulated distance, pole colour on the face that
 * looks at the sensor (south blue, north red). Pairs with sim/devices/hall-a3144.ts.
 */
import {BoxGeometry,CylinderGeometry,Group,Mesh,MeshBasicMaterial,MeshStandardMaterial,PlaneGeometry} from 'three';
import type {PartProps} from '../../contract';
import type {HallA3144State} from '../../sim/devices/hall-a3144';
import {PITCH} from '../layout';
import {canvasTexture,solid} from '../materials';
import * as C from '../palette';
import {MONO,leg,definePart,extState,c,pin,callout,type Inner} from './kit';

const BOARD=0x24262d; // ds-allow-hex  (dark solder mask of the module)
const SMD=0xb8a27a; // ds-allow-hex  (tan SMD resistor body)

const BX=2*PITCH/2,BW=10,BD=12,BT=1.4,Y0=2.6;
const FACE_Y=Y0+BT+3.4;       // flat face of the sensor

function printTex():ReturnType<typeof canvasTexture>{
 const cv=document.createElement('canvas');cv.width=128;cv.height=64;
 const g=cv.getContext('2d')!;
 g.fillStyle=C.CHIP_PRINT;g.textAlign='center';g.textBaseline='middle';
 g.font=`700 30px ${MONO}`;g.fillText('3144',64,32);
 return canvasTexture(cv);
}

/** Disc magnet of 10 x 3 mm: two halves coloured by pole. Returns the group and its pole materials. */
function magnetGroup():{g:Group;faceMat:MeshStandardMaterial;backMat:MeshStandardMaterial}{
 const g=new Group();
 const face=solid(new CylinderGeometry(5,5,1.5,28),C.RAIL_BLUE,{outline:true,own:true,pos:[0,-0.75,0],finish:'metal'});
 const back=solid(new CylinderGeometry(5,5,1.5,28),C.RED_ALERT,{outline:true,own:true,pos:[0,0.75,0],finish:'metal'});
 g.add(face,back);g.userData.noInk=true;
 return {g,faceMat:face.material as MeshStandardMaterial,backMat:back.material as MeshStandardMaterial};
}

function buildHall(_p:PartProps,g:Group):Inner{
 for(let i=0;i<3;i++)g.add(leg(i*PITCH,Y0+0.4));
 g.add(solid(new BoxGeometry(BW,BT,BD),BOARD,{outline:true,edges:true,pos:[BX,Y0+BT/2,-BD/2+1.5],own:true}));
 const top=Y0+BT;
 // TO-92 half-round body (r 2.05, 4.5 long) lying on its round side, flat face up, on bent leads
 const body=new Mesh(new CylinderGeometry(2.05,2.05,4.5,20,1,false,-Math.PI/2,Math.PI),new MeshStandardMaterial({color:C.CHIP,roughness:0.7}));
 body.material.userData.own=true;body.rotation.x=Math.PI/2;body.position.set(BX,top+2.1,-3.2);g.add(body);
 const flat=solid(new BoxGeometry(4.1,0.12,4.5),C.HEADER_TOP,{outline:true,pos:[BX,top+2.1,-3.2],own:true});g.add(flat);
 const print=new Mesh(new PlaneGeometry(3.4,1.7),new MeshBasicMaterial({map:printTex(),transparent:true,toneMapped:false,depthWrite:false}));
 print.material.userData.own=true;print.material.userData.ownMap=true;
 print.rotation.x=-Math.PI/2;print.position.set(BX,top+2.2,-3.2);print.userData.noPick=true;print.userData.noInk=true;g.add(print);
 for(const dx of [-1.27,0,1.27])g.add(solid(new BoxGeometry(0.4,0.4,2.4),C.SILVER,{pos:[BX+dx,top+0.6,-0.4],cast:false,finish:'metal'}));
 // pull-up resistor and indicator LED
 g.add(solid(new BoxGeometry(1.6,0.5,0.8),SMD,{pos:[BX-3,top+0.25,-8],own:true}));
 const led=solid(new BoxGeometry(1.6,0.6,0.8),C.LED_SMD_OFF,{pos:[BX+3,top+0.3,-8],own:true});g.add(led);
 const ledMat=led.material as MeshStandardMaterial;
 const mag=magnetGroup();mag.g.position.set(BX,FACE_Y+12,-3.2);mag.g.visible=false;g.add(mag.g);
 return {
  apply(s){
   const st=extState<HallA3144State>(s,'hall-a3144');
   if(!st)return;
   ledMat.color.set(st.active?C.LIVE:C.LED_SMD_OFF);ledMat.emissive.set(st.active?C.LIVE:0);ledMat.emissiveIntensity=st.active?1:0;
   // magnet hangs distance mm above the flat face, the pole that faces the sensor is the blue/red half below
   mag.g.visible=st.distance<30;   // beyond 30 mm the field is under 10 G: the magnet is simply not there
   mag.g.position.y=FACE_Y+st.distance+1.5;
   const south=st.pole==='south';
   mag.faceMat.color.set(south?C.RAIL_BLUE:C.RED_ALERT);mag.backMat.color.set(south?C.RED_ALERT:C.RAIL_BLUE);
  },
 };
}

const P=(i:number):[number,number,number]=>[i*PITCH,0,0];
export const hallA3144=definePart({
 kind:'hall-a3144',name:c('Hall effect sensor (A3144)','Sensor efek Hall (A3144)'),
 pins:{VCC:pin(P(0),'power','Power 4.5V to 24V','Daya 4,5V sampai 24V'),SIG:pin(P(1),'output','SIG (LOW when a south pole is near)','SIG (LOW saat kutub selatan dekat)'),GND:pin(P(2),'ground','Ground','Ground')},
 callouts:[
  callout('chip',[BX,FACE_Y+1,-3.2],'The flat face senses the magnet: only a south pole switches it','Sisi datar merasakan magnet: hanya kutub selatan yang menyalakannya'),
  callout('led',[BX+3,Y0+BT+1.5,-8],'The LED lights while the output is pulled LOW','LED menyala saat keluaran ditarik LOW'),
 ],
 make:buildHall,
});
