/** Capacitive soil moisture probe v2.0 (about 98 x 23 mm): black PCB blade, white max-insert line, PH2.0 socket and a 3-wire cable. Pairs with sim/devices/soil-capacitive-v2.ts. */
import {BoxGeometry,Color,ExtrudeGeometry,Group,MeshStandardMaterial,Shape} from 'three';
import type {PartProps} from '../../contract';
import {SOIL_V2_DIMS as D,type SoilCapacitiveV2State} from '../../sim/devices/soil-capacitive-v2';
import {solid} from '../materials';
import * as C from '../palette';
import {HALF_PI,definePart,extState,c,pin,callout,type Inner} from './kit';

const BOARD=0x1c1f24; // ds-allow-hex  (black solder mask of the v2.0 blade)
const SOAK=0x3b6f8f; // ds-allow-hex  (blue wash that creeps up the blade when wet)
const WIRE={GND:0x15161a,VCC:0xd04a3c,AOUT:0x2a58a8} as const; // ds-allow-hex  (cable colours: black, red, blue)

const W=D.w,T=1.2,E=30,L=D.l-E,Y=2;   // width, thickness, electronics end length, probe length (lies flat on the desk, probe toward the viewer)

function buildV2(_p:PartProps,g:Group):Inner{
 const yTop=Y+T;
 g.add(solid(new BoxGeometry(W,T,E),BOARD,{outline:true,edges:true,pos:[0,Y+T/2,-E/2]}));
 const hw=(W-1)/2,ch=5;
 const shape=new Shape();
 shape.moveTo(-hw,0);shape.lineTo(hw,0);shape.lineTo(hw,-(L-ch));shape.lineTo(hw-ch,-L);shape.lineTo(-hw+ch,-L);shape.lineTo(-hw,-(L-ch));shape.closePath();
 g.add(solid(new ExtrudeGeometry(shape,{depth:T,bevelEnabled:false}),BOARD,{outline:true,edges:true,rot:[-HALF_PI,0,0],pos:[0,Y,0]}));
 // PH2.0 socket at the top of the board, white shell, and the 3-wire cable
 g.add(solid(new BoxGeometry(8,4.5,5.8),C.CREAM,{outline:true,pos:[0,yTop+2.25,-E+4],cast:false}));
 (['GND','VCC','AOUT'] as const).forEach((k,i)=>g.add(solid(new BoxGeometry(1.2,1.2,12),WIRE[k],{pos:[(i-1)*2,yTop+2.4,-E-3],cast:false})));
 // timer chip, regulator, passives
 g.add(solid(new BoxGeometry(5,1,3.8),C.CHIP,{pos:[-4,yTop+0.5,-E/2-2],cast:false}));
 g.add(solid(new BoxGeometry(3,1,3),C.CHIP,{pos:[5,yTop+0.5,-E/2+3],cast:false}));
 for(const [dx,dz] of [[-7,-8],[7,-14],[0,-6]] as const)g.add(solid(new BoxGeometry(2,0.8,1.2),C.RESISTOR_BODY,{pos:[dx,yTop+0.4,dz],cast:false}));
 // white max-insert line
 g.add(solid(new BoxGeometry(W-1,0.2,0.8),C.WHITE,{pos:[0,yTop+0.1,-0.5],cast:false}));
 // wet wash from the tip
 const wash=solid(new BoxGeometry(W-1.4,0.3,1),SOAK,{pos:[0,yTop+0.25,L],cast:false,own:true});
 g.add(wash);
 const mat=wash.material as MeshStandardMaterial;
 const dry=new Color(BOARD),wet=new Color(SOAK);
 const len=L-3;
 return {
  apply(s){
   const st=extState<SoilCapacitiveV2State>(s,'soil-capacitive-v2');
   if(!st)return;
   const f=Math.min(1,Math.max(0.001,(st.fault?0:st.wetness)/100));
   wash.scale.z=f*len;wash.position.z=L-2-f*len/2;
   mat.color.copy(dry).lerp(wet,0.4+0.6*f);
  },
 };
}

export const soilCapacitiveV2=definePart({
 kind:'soil-capacitive-v2',name:c('Capacitive soil moisture sensor v2.0','Sensor kelembapan tanah kapasitif v2.0'),deskMm:[W+4,D.l+14],
 pins:{
  GND:pin([-2,Y+T+2.4,-E-9],'ground','GND (black)','GND (hitam)'),
  VCC:pin([0,Y+T+2.4,-E-9],'power','VCC (3.3-5.5 V)','VCC (3,3-5,5 V)'),
  AOUT:pin([2,Y+T+2.4,-E-9],'analog-out','AOUT (signal)','AOUT (sinyal)'),
 },
 callouts:[
  callout('line',[0,Y+T+2,-0.5],'Insert up to the white line, never past it; seal the top edge with lacquer','Tancap sampai garis putih, jangan lewat; segel tepi atas dengan pernis'),
  callout('ph2',[0,Y+T+6,-E+4],'PH2.0 socket: GND, VCC, AOUT. Check the order on your board','Soket PH2.0: GND, VCC, AOUT. Cek urutan di papan Anda'),
  callout('v33',[4,Y+T+2,-E/2+3],'NE555 clones stall on 3.3 V: use a TLC555 board or 5 V','Klon NE555 macet di 3,3 V: pakai papan TLC555 atau 5 V'),
 ],
 make:buildV2,
});
