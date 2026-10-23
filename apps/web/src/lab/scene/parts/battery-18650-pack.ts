/** BATTERY-18650-PACK: 18650 cells (Ø18.4 x 65.2 mm) lying side by side in PVC shrink, nickel strips, green BMS board, red/black leads. Size follows the chem and parallel props. Own work. */
import {BoxGeometry,CatmullRomCurve3,CylinderGeometry,Group,TubeGeometry,Vector3} from 'three';
import type {PartProps} from '../../contract';
import {CELL_MM,CHEM,chemOf,packDims,parallelOf,type Battery18650State} from '../../sim/devices/battery-18650-pack';
import {solid} from '../materials';
import * as C from '../palette';
import {addShadow,definePart,extState,c,pin,callout,type Inner} from './kit';

const WRAP_LFP=0x6a7480; // ds-allow-hex  grey LFP shrink
const WRAP_LI=0x2f6fb5; // ds-allow-hex  blue Li-ion shrink
const NICKEL=0xa9aeb5; // ds-allow-hex
const BMS_PCB=0x1f7a45; // ds-allow-hex  green BMS board
const WIRE_RED=0xd23b32; // ds-allow-hex
const WIRE_BLACK=0x15171a; // ds-allow-hex
const TIP_P:[number,number,number]=[60,6,50],TIP_M:[number,number,number]=[60,6,66];

function lead(g:Group,from:Vector3,tip:readonly number[],color:number):void{
 const curve=new CatmullRomCurve3([from,new Vector3(from.x+8,from.y,from.z+8),new Vector3(tip[0]!-8,tip[1]!+8,tip[2]!-4),new Vector3(tip[0],tip[1],tip[2])]);
 g.add(solid(new TubeGeometry(curve,20,1.1,8),color,{outline:true}));
}
function buildPack(p:PartProps,g:Group):Inner{
 const chem=chemOf(p),n=CHEM[chem].series,par=parallelOf(p),d=CELL_MM.d,L=CELL_MM.l;
 const wrap=chem==='lfp-4s'?WRAP_LFP:WRAP_LI;
 const z0=-(n-1)*d/2,y0=d/2;
 for(let i=0;i<n;i++)for(let j=0;j<par;j++){
  const cell=solid(new CylinderGeometry(d/2,d/2,L,20),wrap,{outline:true,pos:[0,y0+j*d,z0+i*d],rot:[0,0,Math.PI/2]});
  g.add(cell);
  for(const sx of [-1,1])g.add(solid(new CylinderGeometry(3.6,3.6,0.8,12),C.SILVER,{pos:[sx*(L/2+0.3),y0+j*d,z0+i*d],rot:[0,0,Math.PI/2],cast:false,finish:'metal'}));
 }
 const H=par*d;
 for(const sx of [-1,1])g.add(solid(new BoxGeometry(0.6,H-1,n*d-1),NICKEL,{pos:[sx*(L/2+1),H/2,0],cast:false,finish:'metal'}));
 const dims=packDims(p);
 g.add(solid(new BoxGeometry(2,H*0.7,n*d*0.8),BMS_PCB,{outline:true,pos:[L/2+3,H*0.4,0]}));
 for(let i=0;i<n+1;i++)g.add(solid(new BoxGeometry(0.4,0.4,0.4),C.GOLD,{pos:[L/2+4.4,H*0.7,-n*d*0.3+i*(n*d*0.6/n)],cast:false}));
 lead(g,new Vector3(L/2+4,H*0.3,-3),TIP_P,WIRE_RED);lead(g,new Vector3(L/2+4,H*0.3,3),TIP_M,WIRE_BLACK);
 addShadow(g,dims.l+20,dims.w+20,0.28,4,0,0.03,0);
 return {apply(s){const st=extState<Battery18650State>(s,'battery-18650-pack');if(!st)return;g.scale.setScalar(1);}};
}

export const battery18650Pack=definePart({
 kind:'battery-18650-pack',name:c('18650 battery pack with BMS','Paket baterai 18650 dengan BMS'),deskMm:[90,90],
 pins:{'P+':pin(TIP_P,'power','Red lead (P+)','Kabel merah (P+)'),'P-':pin(TIP_M,'ground','Black lead (P-)','Kabel hitam (P-)')},
 callouts:[
  callout('bms',[65,20,0],'BMS board: stops over-charge, over-discharge and over-current; LFP must not charge below 0 C','Papan BMS: mencegah kelebihan isi, kosong total dan arus lebih; LFP tidak boleh diisi di bawah 0 C'),
  callout('chem',[0,40,0],'Chemistry must match the controller: 4S LiFePO4 for an LFP controller','Kimia harus cocok dengan pengontrol: LiFePO4 4S untuk pengontrol LFP'),
  callout('fuse',[60,12,58],'Fuse P+ within 10 cm of the pack','Pasang sekring di P+ dalam 10 cm dari paket'),
 ],
 make:buildPack,
});
