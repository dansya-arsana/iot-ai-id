/** Capacitive soil moisture probe v1.2 (about 98 x 23 mm board). Pairs with sim/devices/soil-moisture.ts. */
import {BoxGeometry,Color,ExtrudeGeometry,Group,MeshStandardMaterial,Shape} from 'three';
import type {PartProps} from '../../contract';
import type {SoilMoistureState} from '../../sim/devices/soil-moisture';
import {PITCH} from '../layout';
import {solid} from '../materials';
import * as C from '../palette';
import {HALF_PI,leg,definePart,extState,c,pin,callout,type Inner} from './kit';

const BOARD=0x2c3a2f; // ds-allow-hex  (dark green solder mask of the probe)
const PAD=0x34483a; // ds-allow-hex  (solder mask over the sensing pad, a shade lighter than the board)
const SOAK=0x3b6f8f; // ds-allow-hex  (blue wash that creeps up the probe when wet)

function buildSoil(_p:PartProps,g:Group):Inner{
 // Lies flat with its long probe pointing at the viewer, so it never stands in front of the part behind it (the LCD).
 const cx=PITCH,W=23,L1=33,L2=65,T=1.2,y0=5,s0=-2;
 const yb=y0+2.6+T/2,yTop=yb+T/2;
 for(let i=0;i<3;i++)g.add(leg(i*PITCH,y0));
 // 3-pin header block under the board's electronics end
 g.add(solid(new BoxGeometry(3*PITCH-0.4,2.6,2.6),C.HEADER_BLACK,{pos:[cx,y0+1.3,0],cast:false}));
 // board: electronics end (near the legs) and the long probe (narrower tail with a chamfered tip)
 g.add(solid(new BoxGeometry(W,T,L1),BOARD,{outline:true,edges:true,pos:[cx,yb,s0+L1/2]}));
 const z0=s0+L1,z1=z0+L2,hw=(W-1)/2,ch=5;
 const shape=new Shape();
 shape.moveTo(-hw,-z0);shape.lineTo(hw,-z0);shape.lineTo(hw,-(z1-ch));shape.lineTo(hw-ch,-z1);shape.lineTo(-hw+ch,-z1);shape.lineTo(-hw,-(z1-ch));shape.closePath();
 g.add(solid(new ExtrudeGeometry(shape,{depth:T,bevelEnabled:false}),BOARD,{outline:true,edges:true,rot:[-HALF_PI,0,0],pos:[cx,yb-T/2,0]}));
 // sensing pad: hidden under the dark solder mask on the real probe, so only a slightly lighter wash with a thin gap line
 g.add(solid(new BoxGeometry(W-6,0.12,52),PAD,{pos:[cx,yTop+0.05,z0+33],cast:false}));
 g.add(solid(new BoxGeometry(0.8,0.2,50),BOARD,{pos:[cx,yTop+0.1,z0+33],cast:false}));
 // electronics: timer chip, regulator, passives
 g.add(solid(new BoxGeometry(5,1,3.8),C.CHIP,{pos:[cx-4,yTop+0.5,s0+8],cast:false}));
 g.add(solid(new BoxGeometry(3,1,3),C.CHIP,{pos:[cx+5,yTop+0.5,s0+14],cast:false}));
 for(const [dx,dz] of [[-7,16],[7,6],[0,19]] as const)g.add(solid(new BoxGeometry(2,0.8,1.2),C.RESISTOR_BODY,{pos:[cx+dx,yTop+0.4,s0+dz],cast:false}));
 // white "do not submerge past here" line
 g.add(solid(new BoxGeometry(W-1,0.2,0.8),C.WHITE,{pos:[cx,yTop+0.1,z0+0.5],cast:false}));
 // wet wash, anchored at the tip and creeping toward the electronics
 const wash=solid(new BoxGeometry(W-1.4,0.3,1),SOAK,{pos:[cx,yTop+0.25,z1],cast:false,own:true});
 g.add(wash);
 const mat=wash.material as MeshStandardMaterial;
 const dry=new Color(PAD),wet=new Color(SOAK);
 const len=L2-3;
 return {
  apply(s){
   const st=extState<SoilMoistureState>(s,'soil-moisture');
   if(!st)return;
   const f=Math.min(1,Math.max(0.001,st.wetness/100));
   wash.scale.z=f*len;wash.position.z=z1-ch*0.4-f*len/2;
   mat.color.copy(dry).lerp(wet,0.4+0.6*f);
  },
 };
}

export const soilMoisture=definePart({
 kind:'soil-moisture',name:c('Soil moisture sensor','Sensor kelembapan tanah'),
 pins:{VCC:pin([0,0,0],'power','VCC (3.3-5V)','VCC (3,3-5V)'),SIG:pin([PITCH,0,0],'analog-out','AOUT (signal)','AOUT (sinyal)'),GND:pin([2*PITCH,0,0],'ground','Ground','Ground')},
 callouts:[callout('probe',[cx0(),9,60],'Push this end into the soil, not past the white line','Tancapkan ujung ini ke tanah, jangan melewati garis putih')],
 make:buildSoil,
});
function cx0():number{return PITCH;}
