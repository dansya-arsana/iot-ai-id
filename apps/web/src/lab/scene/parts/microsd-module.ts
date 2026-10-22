/** microSD card module: the common 6-pin SPI breakout (about 42 x 24 mm) with a push-push slot, a 3.3 V regulator and a level-shifter chip. Pairs with sim/devices/microsd-module.ts. */
import {BoxGeometry,Group,Mesh,MeshBasicMaterial,PlaneGeometry} from 'three';
import type {PartProps} from '../../contract';
import type {MicrosdState} from '../../sim/devices/microsd-module';
import {canvasTexture,solid} from '../materials';
import * as C from '../palette';
import {HALF_PI,MONO,definePart,extState,c,pin,callout,type Inner} from './kit';

const L=42,W=24,BY=1.6,TH=1.2,TOP=BY+TH,P=2.54;
const BOARD=0x17181b; // ds-allow-hex  (black solder mask of the breakout)
const HX=18.4;
const pz=(i:number):number=>(i-2.5)*P;                  // pin i along z
const TIP=TOP+8;
const PINS=['GND','VCC','MISO','MOSI','SCK','CS'];
const SLOT_X=-L/2+6.5;                                  // centre of the slot shell

function silk():ReturnType<typeof canvasTexture>{
 const S=20,cv=document.createElement('canvas');cv.width=L*S;cv.height=W*S;
 const g=cv.getContext('2d')!;
 g.fillStyle=C.SILKSCREEN;g.textBaseline='middle';g.textAlign='right';g.font=`700 ${Math.round(1.25*S)}px ${MONO}`;
 for(let i=0;i<6;i++)g.fillText(PINS[i]!,(L/2+HX-3.6)*S,(W/2+pz(i))*S);
 g.textAlign='left';g.font=`700 ${Math.round(1.7*S)}px ${MONO}`;g.fillText('microSD',(L/2-17)*S,(W/2+8.6)*S);
 return canvasTexture(cv);
}

function buildSd(_p:PartProps,g:Group):Inner{
 g.add(solid(new BoxGeometry(L,TH,W),BOARD,{outline:true,edges:true,pos:[0,BY+TH/2,0],own:true,finish:'pcb'}));
 const sl=new Mesh(new PlaneGeometry(L,W),new MeshBasicMaterial({map:silk(),transparent:true,toneMapped:false,depthWrite:false}));
 sl.material.userData.own=true;sl.material.userData.ownMap=true;sl.rotation.x=-HALF_PI;sl.position.set(0,TOP+0.03,0);sl.userData.noPick=true;sl.userData.noInk=true;g.add(sl);
 // push-push slot: 15 x 14.5 x 1.9 steel shell, open at the -x end, overhanging the board edge by 2 mm
 g.add(solid(new BoxGeometry(15,1.9,14.5),C.SILVER,{outline:true,edges:true,pos:[SLOT_X-1,TOP+0.95,0],finish:'metal'}));
 g.add(solid(new BoxGeometry(0.4,1.1,11.6),C.HOLE,{pos:[SLOT_X-8.6,TOP+0.95,0],cast:false}));       // the dark mouth of the slot
 // the card, visible while one is inserted: sticks out 4 mm from the mouth
 const card=new Group();
 card.add(solid(new BoxGeometry(15,0.9,11),C.CHIP,{outline:true,edges:true,pos:[0,0,0],own:true}));
 card.add(solid(new BoxGeometry(5,0.12,9.5),C.BUTTON_CAP,{pos:[-5,0.5,0],cast:false,own:true}));
 card.add(solid(new BoxGeometry(6,0.12,8.6),C.GOLD,{pos:[4,-0.46,0],cast:false,finish:'metal'}));
 card.position.set(SLOT_X-8.6+(15/2)-4,TOP+0.95,0);g.add(card);
 // level shifter (SOIC-14 8.7 x 3.9), AMS1117-3.3 (SOT-223), capacitors, resistors
 g.add(solid(new BoxGeometry(8.7,1.5,3.9),C.CHIP,{outline:true,edges:true,pos:[3.5,TOP+0.75,-5.5],own:true}));
 g.add(solid(new BoxGeometry(6.5,1.6,3.5),C.CHIP,{outline:true,pos:[7.5,TOP+0.8,5],own:true}));
 g.add(solid(new BoxGeometry(3.0,0.6,3.0),C.SILVER,{pos:[11.5,TOP+0.8,5],cast:false,finish:'metal'}));
 for(const [x,z] of [[0,3],[-1.8,3],[3,2.6],[4.8,2.6],[11,-1.5],[11,-3.4],[11,-5.3]] as const)g.add(solid(new BoxGeometry(1.6,0.7,0.9),C.CREAM_DARK,{pos:[x,TOP+0.35,z],cast:false}));
 // 6-pin header
 g.add(solid(new BoxGeometry(2.54,2.5,6*P),C.HEADER_BLACK,{outline:true,pos:[HX,TOP+1.25,0]}));
 for(let i=0;i<6;i++)g.add(solid(new BoxGeometry(0.64,TIP-TOP-1,0.64),C.GOLD,{pos:[HX,(TIP+TOP+1)/2,pz(i)],cast:false,finish:'metal'}));
 return {
  apply(s){
   const st=extState<MicrosdState>(s,'microsd-module');
   if(!st)return;
   card.visible=st.card!=='none';
  },
 };
}

export const microsdModule=definePart({
 kind:'microsd-module',name:c('microSD card module','Modul kartu microSD'),deskMm:[42,24],
 pins:{
  GND:pin([HX,TIP,pz(0)],'ground','Ground','Ground'),VCC:pin([HX,TIP,pz(1)],'power','5V (the board has a 3.3 V regulator)','5V (papan punya regulator 3,3 V)'),
  MISO:pin([HX,TIP,pz(2)],'output','MISO (data out, D12)','MISO (data keluar, D12)'),MOSI:pin([HX,TIP,pz(3)],'input','MOSI (data in, D11)','MOSI (data masuk, D11)'),
  SCK:pin([HX,TIP,pz(4)],'input','SCK (SPI clock, D13)','SCK (clock SPI, D13)'),CS:pin([HX,TIP,pz(5)],'input','CS (chip select)','CS (chip select)'),
 },
 callouts:[
  callout('slot',[SLOT_X-1,TOP+3,0],'Push-push slot: the card answers the start-up commands over SPI','Slot dorong-dorong: kartu menjawab perintah awal lewat SPI'),
  callout('shifter',[3.5,TOP+2.5,-5.5],'The level-shifter chip turns the 5 V signals into the 3.3 V a card needs','Chip pengubah level mengubah sinyal 5 V menjadi 3,3 V yang dibutuhkan kartu'),
  callout('reg',[7.5,TOP+2.5,5],'A 3.3 V regulator powers the card from the 5 V pin','Regulator 3,3 V memberi daya kartu dari pin 5 V'),
 ],
 make:buildSd,
});
