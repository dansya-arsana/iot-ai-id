/**
 * RFM95W LoRa module: 16 x 16 mm castellated module, 16 pads at 2.0 mm pitch (8 per side), silver RF shield over the SX1276,
 * a bare antenna pad. Public HopeRF datasheet dimensions, modelled by us (no vendor model, no logo). Pairs with sim/devices/lora-rfm95w.ts.
 * Pin order: pads 1-8 down the left side (z-), pads 9-16 back up the right side. Guide: docs/lab-extending.md
 */
import {BoxGeometry,Color,CylinderGeometry,Group,MeshStandardMaterial} from 'three';
import type {PartProps} from '../../contract';
import {device} from '../../sim/devices/lora-rfm95w';
import type {Sx127xState} from '../../sim/devices/lora-rfm95w';
import {solid} from '../materials';
import * as C from '../palette';
import {definePart,extState,c,pin,callout,type Inner} from './kit';
import type {PinDef} from './types';

const S=16,PADP=2.0,BY=0.6,TH=1.0,TOP=BY+TH;   // module side, pad pitch, board underside, thickness
/** Pad i (0-based, datasheet order) -> x,z on the board. */
const padAt=(i:number):[number,number]=>i<8?[-S/2,-7+i*PADP]:[S/2,7-(i-8)*PADP];

function buildRfm95w(_p:PartProps,g:Group):Inner{
 g.add(solid(new BoxGeometry(S,TH,S),C.PCB_DARK,{outline:true,edges:true,pos:[0,BY+TH/2,0],cast:true}));
 for(let i=0;i<16;i++){const [x,z]=padAt(i);g.add(solid(new BoxGeometry(1.1,TH+0.1,1.2),C.GOLD,{pos:[x+(x<0?0.45:-0.45),BY+TH/2,z],cast:false,finish:'metal'}));}
 // RF shield (SX1276 under it), 11 x 11 mm, 1.4 mm tall
 const can=solid(new BoxGeometry(11,1.4,11),C.SILVER,{outline:true,edges:true,pos:[-1.5,TOP+0.7,-1.5],finish:'metal',own:true});
 g.add(can);
 // crystal and passives
 g.add(solid(new BoxGeometry(3.2,0.8,2.5),C.SILVER_DARK,{pos:[4.8,TOP+0.4,4.8],cast:false,finish:'metal'}));
 for(let i=0;i<4;i++)g.add(solid(new BoxGeometry(1.0,0.4,0.5),C.CREAM_DARK,{pos:[-6+i*1.6,TOP+0.2,6.6],cast:false}));
 // bare antenna pad on pad 9 side (ANT is pad 9, right side)
 g.add(solid(new CylinderGeometry(0.9,0.9,0.08,14),C.GOLD,{pos:[S/2-0.9,TOP+0.04,7-PADP],cast:false,finish:'metal'}));
 const mat=can.material as MeshStandardMaterial;
 const idle=new Color(C.SILVER),tx=new Color(C.PWM),rx=new Color(C.LIVE);
 return {
  apply(s){
   const st=extState<Sx127xState>(s,'lora-rfm95w');
   if(!st)return;
   mat.color.copy(st.mode==='tx'?tx:st.mode==='rxcont'||st.mode==='rxsingle'?rx:idle);   // the shield tints while the PA or the receiver is on
  },
 };
}

const pins:Record<string,PinDef>={};
device.pins.forEach((k,i)=>{
 const [x,z]=padAt(i);
 const t:PinDef['type']=k==='3V3'?'power':k.startsWith('GND')?'ground':k==='MISO'||k.startsWith('DIO')?'output':k==='ANT'?'passive':'input';
 pins[k]=pin([x,TOP,z],t,k==='ANT'?'ANT: RF output, to the antenna':k.startsWith('DIO')?`${k}: interrupt output`:k,k==='ANT'?'ANT: keluaran RF, ke antena':k.startsWith('DIO')?`${k}: keluaran interupsi`:k);
});

export const loraRfm95w=definePart({
 kind:'lora-rfm95w',name:c('RFM95W LoRa module','Modul LoRa RFM95W'),
 pins,deskMm:[18,18],
 callouts:[
  callout('shield',[-1.5,TOP+1.6,-1.5],'RF shield over the SX1276 radio chip','Pelindung RF di atas chip radio SX1276'),
  callout('ant',[S/2-0.9,TOP+0.6,7-PADP],'ANT pad: connect an antenna before any transmit','Pad ANT: pasang antena sebelum memancar'),
  callout('nss',[-S/2,TOP+0.8,-7+4*PADP],'NSS is the SPI chip select, pulled low for each transfer','NSS adalah chip select SPI, ditarik low tiap transfer'),
  callout('supply',[S/2,TOP+0.8,-7+4*PADP-PADP*0],'3.3 V only: 5 V destroys the module','Hanya 3,3 V: 5 V merusak modul'),
 ],
 make:buildRfm95w,
});
