/** LED-BAR-10: 10-segment bar graph, about 25.4 x 10 x 5 mm housing with ten 2 x 4.5 mm windows at 2.54 mm pitch. Pairs with sim/devices/led-bar-10.ts. */
import {BoxGeometry,Color,Group,Object3D,MeshStandardMaterial} from 'three';
import type {PartProps} from '../../contract';
import type {LedBar10State} from '../../sim/devices/led-bar-10';
import {PITCH} from '../layout';
import {ownToon,solid} from '../materials';
import * as C from '../palette';
import {labelRow} from './input-labels';
import {leg,definePart,extState,c,pin,callout,type Inner} from './kit';

const LIT:Record<string,number>={red:0xff3b30,green:0x3fcf6e,yellow:0xf2c230,blue:0x3b8cff}; // ds-allow-hex  (lit bar colours)
const DIM:Record<string,number>={red:0x4a2326,green:0x23422f,yellow:0x4a4023,blue:0x232f4a}; // ds-allow-hex  (unlit window, tinted die)

function buildBar(p:PartProps,g:Group):Inner{
 const color=typeof p.color==='string'&&p.color in LIT?p.color:'green';
 const full=new Color(LIT[color]),dim=new Color(DIM[color]);
 const n=10,H=5,y0=2.6;
 for(let i=0;i<=n;i++)g.add(leg(i*PITCH,y0+0.4));
 // smoky grey housing; the bar runs along x with one window per anode
 g.add(solid(new BoxGeometry(28.2,H,10),0x2f3238,{outline:true,edges:true,pos:[5*PITCH,y0+H/2,0]})); // ds-allow-hex  (smoked housing)
 // the bar module carries a 10 x 220 ohm resistor array (one resistor per segment) behind the housing: bare LEDs never go on a pin
 g.add(solid(new BoxGeometry(26.4,3.2,2.4),C.RESISTOR_BODY,{outline:true,pos:[5*PITCH,y0+1.6,7.2]}));
 for(let i=0;i<n;i++)g.add(solid(new BoxGeometry(0.5,0.5,5),C.SILVER,{cast:false,pos:[i*PITCH,y0+0.4,4.4],finish:'metal'}));
 const rl=labelRow(['220','220','220','220','220','220','220','220','220','220'],5*PITCH,28,2.2,40);rl.rotation.x=0;rl.position.set(5*PITCH,y0+1.6,8.45);g.add(rl);
 const mats:MeshStandardMaterial[]=[];
 for(let i=0;i<n;i++){
  const m=ownToon(DIM[color],'epoxy');mats.push(m);
  const w=solid(new BoxGeometry(2,0.5,4.5),0,{cast:false,pos:[i*PITCH,y0+H+0.12,0]});
  w.material=m;w.userData.noInk=true;g.add(w);
 }
 const hs=new Object3D();hs.name='hotspot';hs.userData.noPick=true;hs.position.set(9*PITCH,y0+H,-2);g.add(hs);
 return {
  apply(s){
   const st=extState<LedBar10State>(s,'led-bar-10');
   if(!st)return;
   for(let i=0;i<n;i++){
    const b=Math.sqrt(Math.min(1,st[('s'+(i+1)) as keyof LedBar10State] as number));
    mats[i]!.color.copy(dim).lerp(full,b);mats[i]!.emissive.copy(full);mats[i]!.emissiveIntensity=b>0.01?0.3+0.9*b:0;
   }
  },
 };
}

const y0pack=():number=>4.4;
const names=Array.from({length:10},(_,i)=>'A'+(i+1));
export const ledBar10=definePart({
 kind:'led-bar-10',name:c('LED bar graph (10 segments)','Bar graph LED (10 segmen)'),
 pins:{...Object.fromEntries(names.map((nme,i)=>[nme,pin([i*PITCH,0,0],'input',`Segment ${i+1} anode`,`Anoda segmen ${i+1}`)])),K:pin([10*PITCH,0,0],'ground','K (all cathodes)','K (semua katoda)')},
 callouts:[
  callout('bar',[4.5*PITCH,9,0],'Ten LEDs, one per pin: light A1..A10 in order for a level meter','Sepuluh LED, satu per pin: nyalakan A1..A10 berurutan untuk pengukur level'),
  callout('rpack',[5*PITCH,y0pack(),8.4],'A 10 x 220 ohm resistor array: every segment has its own resistor','Array 10 x 220 ohm: tiap segmen punya resistornya sendiri'),
  callout('k',[10*PITCH,4,0],'K joins all cathodes: wire it to ground','K menyatukan semua katoda: sambungkan ke ground'),
 ],
 make:buildBar,
});
