/** DIN-RAIL-TERMINALS: 35 x 7.5 mm TS35 rail, six grey feed-through blocks (5.2 mm pitch, wire ports on both sides), end stops, jumper bar. Own work. */
import {BoxGeometry,CylinderGeometry,Group,Mesh} from 'three';
import type {PartProps} from '../../contract';
import {BLOCKS,PITCH_MM,RAIL_MM,TERMINAL_PINS,type DinRailState} from '../../sim/devices/din-rail-terminals';
import {solid} from '../materials';
import * as C from '../palette';
import {addShadow,definePart,extState,c,pin,callout,type Inner} from './kit';

const BLOCK=0xc7cbd1; // ds-allow-hex  grey terminal housing
const STOP=0x3b4048; // ds-allow-hex  end stop
const JUMPER=0xd23b32; // ds-allow-hex  red jumper bar
const SCALE=3; // blocks drawn 3x pitch for legibility; real pitch is 5.2 mm
const P=PITCH_MM*SCALE,BH=18*SCALE/2,BD=42;
const x=(i:number):number=>(i-(BLOCKS-1)/2)*P;

function buildRail(p:PartProps,g:Group):Inner{
 const len=BLOCKS*P+40;
 g.add(solid(new BoxGeometry(len,2,RAIL_MM.w),C.SILVER,{outline:true,pos:[0,1,0],finish:'metal'}));
 for(let i=0;i<BLOCKS;i++){
  g.add(solid(new BoxGeometry(P-1,BH,BD),BLOCK,{outline:true,pos:[x(i),BH/2+2,0]}));
  for(const sz of [-1,1]){
   g.add(solid(new CylinderGeometry(3,3,1.2,14),C.SILVER_DARK,{pos:[x(i),BH+2.6,sz*BD*0.28],cast:false,finish:'metal'}));
   g.add(solid(new BoxGeometry(P*0.5,4,2),C.HOLE,{pos:[x(i),BH*0.4+2,sz*(BD/2+0.2)],cast:false}));
  }
 }
 for(const sx of [-1,1])g.add(solid(new BoxGeometry(8,BH*0.9,BD*0.7),STOP,{outline:true,pos:[sx*(BLOCKS*P/2+6),BH*0.45+2,0]}));
 const bars:Mesh[]=[];
 for(let i=0;i<BLOCKS;i++){
  const bar=solid(new BoxGeometry(P,2,5),JUMPER,{pos:[x(i)+P/2,BH+3.4,0],cast:false,own:true});
  bar.visible=false;g.add(bar);bars.push(bar);
 }
 addShadow(g,len+10,RAIL_MM.w+10,0.28,4,0,0.03,0);
 return {apply(s){
  const st=extState<DinRailState>(s,'din-rail-terminals');
  if(!st)return;
  bars.forEach((b,i)=>{b.visible=i<st.bridgedBlocks-1;});
 }};
}

const pins:Record<string,ReturnType<typeof pin>>={};
TERMINAL_PINS.forEach((n,i)=>{const b=Math.floor(i/2),side=i%2===0?-1:1;pins[n]=pin([x(b),BH*0.4+2,side*(BD/2+1)],'power',n,n);});

export const dinRailTerminals=definePart({
 kind:'din-rail-terminals',name:c('DIN rail with 6 terminal blocks','Rel DIN dengan 6 terminal blok'),deskMm:[BLOCKS*P+50,60],
 pins,
 callouts:[
  callout('block',[x(0),BH+6,0],'Feed-through block: wire in on one side, out on the other (about 24 A)','Terminal tembus: kabel masuk satu sisi, keluar sisi lain (sekitar 24 A)'),
  callout('jumper',[x(1),BH+10,0],'A jumper bar links neighbouring blocks into one rail','Batang jumper menyambung blok bersebelahan menjadi satu rel'),
  callout('rail',[0,4,BD/2+10],'35 mm TS35 rail: clips in, no drilling per part','Rel TS35 35 mm: tinggal klip, tanpa bor per komponen'),
 ],
 make:buildRail,
});
