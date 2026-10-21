/** Water level strip sensor: red PCB about 62 x 20 mm with 10 power + 10 sense traces. Pairs with sim/devices/water-level.ts. */
import {BoxGeometry,Color,Group,MeshStandardMaterial} from 'three';
import type {PartProps} from '../../contract';
import type {WaterLevelState} from '../../sim/devices/water-level';
import {WATER_TRACE_MM} from '../../sim/devices/water-level';
import {PITCH} from '../layout';
import {solid} from '../materials';
import * as C from '../palette';
import {leg,definePart,extState,c,pin,callout,type Inner} from './kit';

const MASK=0xb8322c; // ds-allow-hex  (red solder mask)
const WATER=0x4a90c8; // ds-allow-hex

function buildWater(_p:PartProps,g:Group):Inner{
 const cx=PITCH,W=20,H=62,T=1.2,y0=5;
 for(let i=0;i<3;i++)g.add(leg(i*PITCH,y0));
 g.add(solid(new BoxGeometry(3*PITCH-0.4,2.6,2.6),C.HEADER_BLACK,{pos:[cx,y0+1.3,0],cast:false}));
 const yb=y0+2.6;
 g.add(solid(new BoxGeometry(W,H,T),MASK,{outline:true,edges:true,pos:[cx,yb+H/2,0]}));
 // 20 traces: alternating power and sense, 40 mm long at the free end
 const top=yb+H-1,traceTop=top;
 const pitch=(W-3)/19;
 for(let i=0;i<20;i++){
  const x=cx-(W-3)/2+i*pitch;
  g.add(solid(new BoxGeometry(0.55,WATER_TRACE_MM,0.2),i%2?C.SILVER:C.GOLD,{pos:[x,traceTop-WATER_TRACE_MM/2,T/2+0.1],cast:false}));
 }
 // pin labels as small silk blocks and the pad row
 for(let i=0;i<3;i++)g.add(solid(new BoxGeometry(2,1,0.2),C.WHITE,{pos:[cx+(i-1)*PITCH,yb+3,T/2+0.1],cast:false}));
 // power led-free: a small smd resistor row at the base
 for(let i=0;i<3;i++)g.add(solid(new BoxGeometry(2,1.2,0.7),C.CHIP,{pos:[cx+(i-1)*4,yb+8,T/2+0.4],cast:false}));
 // water body: translucent block rising from the free tip
 const water=solid(new BoxGeometry(W+1.5,1,3),WATER,{pos:[cx,0,0],cast:false,own:true});
 g.add(water);
 const mat=water.material as MeshStandardMaterial;
 mat.transparent=true;mat.opacity=0.45;mat.depthWrite=false;
 water.userData.noPick=true;water.visible=false;
 const wc=new Color(WATER);mat.color.copy(wc);
 const tip=traceTop-WATER_TRACE_MM;
 return {
  apply(s){
   const st=extState<WaterLevelState>(s,'water-level');
   if(!st)return;
   const d=Math.max(0.01,st.depth);
   // water fills from the bottom of the traces upward by d mm
   water.scale.y=d;water.position.y=tip+d/2;
   water.visible=st.depth>0;
  },
 };
}

export const waterLevel=definePart({
 kind:'water-level',name:c('Water level sensor','Sensor level air'),
 pins:{SIG:pin([0,0,0],'analog-out','S (signal)','S (sinyal)'),VCC:pin([PITCH,0,0],'power','+ (3-5V)','+ (3-5V)'),GND:pin([2*PITCH,0,0],'ground','- (Ground)','- (Ground)')},
 callouts:[callout('traces',[PITCH,55,0],'Water bridging the copper traces raises the signal','Air yang menghubungkan jalur tembaga menaikkan sinyal')],
 make:buildWater,
});
