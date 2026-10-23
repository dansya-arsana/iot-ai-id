/**
 * Ai-Thinker Ra-02 LoRa module (SX1278, 433 MHz): 17 x 16 x 3.2 mm, 16 half-hole pads at 2.0 mm pitch (8 per side), a tin RF shield,
 * an IPEX/U.FL antenna connector at one corner. Public Ai-Thinker spec dimensions, modelled by us (no vendor model, no logo).
 * Learn lab only: 433 MHz is not the Indonesian LoRa band. Pairs with sim/devices/lora-ra02.ts. Guide: docs/lab-extending.md
 */
import {BoxGeometry,Color,CylinderGeometry,Group,MeshStandardMaterial} from 'three';
import type {PartProps} from '../../contract';
import {device} from '../../sim/devices/lora-ra02';
import type {LoraRa02State} from '../../sim/devices/lora-ra02';
import {solid} from '../materials';
import * as C from '../palette';
import {definePart,extState,c,pin,callout,type Inner} from './kit';
import type {PinDef} from './types';

const W=17,D=16,PADP=2.0,BY=0.6,TH=1.0,TOP=BY+TH;
/** Pad i (0-based, spec order) -> x,z: pads 1-8 down the left side, 9-16 back up the right side. */
const padAt=(i:number):[number,number]=>i<8?[-W/2,-7+i*PADP]:[W/2,7-(i-8)*PADP];

function buildRa02(_p:PartProps,g:Group):Inner{
 g.add(solid(new BoxGeometry(W,TH,D),C.SONAR_PCB,{outline:true,edges:true,pos:[0,BY+TH/2,0],cast:true}));
 for(let i=0;i<16;i++){const [x,z]=padAt(i);g.add(solid(new BoxGeometry(1.1,TH+0.1,1.2),C.GOLD,{pos:[x+(x<0?0.45:-0.45),BY+TH/2,z],cast:false,finish:'metal'}));}
 // tin shield 12 x 10 x 1.6 and the IPEX connector (3 x 3 x 1.2) at the top-right corner
 const can=solid(new BoxGeometry(12,1.6,10),C.SILVER,{outline:true,edges:true,pos:[-1.5,TOP+0.8,-1.2],finish:'metal',own:true});
 g.add(can);
 g.add(solid(new BoxGeometry(3,1.2,3),C.SILVER_DARK,{outline:true,pos:[W/2-3.4,TOP+0.6,D/2-2.2],finish:'metal'}));
 g.add(solid(new CylinderGeometry(0.8,0.8,0.5,14),C.GOLD,{pos:[W/2-3.4,TOP+1.4,D/2-2.2],cast:false,finish:'metal'}));
 for(let i=0;i<3;i++)g.add(solid(new BoxGeometry(1.0,0.4,0.5),C.CREAM_DARK,{pos:[-5+i*1.6,TOP+0.2,6.4],cast:false}));
 const mat=can.material as MeshStandardMaterial;
 const idle=new Color(C.SILVER),tx=new Color(C.PWM),rx=new Color(C.LIVE);
 return {
  apply(s){
   const st=extState<LoraRa02State>(s,'lora-ra02');
   if(!st)return;
   mat.color.copy(st.mode==='tx'?tx:st.mode==='rxcont'||st.mode==='rxsingle'?rx:idle);
  },
 };
}

const pins:Record<string,PinDef>={};
device.pins.forEach((k,i)=>{
 const [x,z]=padAt(i);
 const t:PinDef['type']=k==='3V3'?'power':k.startsWith('GND')?'ground':k==='MISO'||k.startsWith('DIO')?'output':'input';
 pins[k]=pin([x,TOP,z],t,k.startsWith('DIO')?`${k}: interrupt output`:k,k.startsWith('DIO')?`${k}: keluaran interupsi`:k);
});

export const loraRa02=definePart({
 kind:'lora-ra02',name:c('Ra-02 LoRa module (433 MHz)','Modul LoRa Ra-02 (433 MHz)'),
 pins,deskMm:[19,18],
 callouts:[
  callout('band',[-1.5,TOP+2,-1.2],'433 MHz band: fine for learning, wrong for Indonesian field designs (920-923 MHz)','Pita 433 MHz: boleh untuk belajar, salah untuk desain lapangan Indonesia (920-923 MHz)'),
  callout('ipex',[W/2-3.4,TOP+2,D/2-2.2],'IPEX connector: attach an antenna before any transmit','Konektor IPEX: pasang antena sebelum memancar'),
  callout('supply',[-W/2,TOP+1,-7+2*PADP],'3.3 V only: 5 V destroys the module (the lab warns)','Hanya 3,3 V: 5 V merusak modul (lab memperingatkan)'),
 ],
 make:buildRa02,
});
