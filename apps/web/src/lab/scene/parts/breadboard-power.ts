/** BREADBOARD-POWER: MB102 style module, about 53 x 34 mm board, barrel jack, slide switch, two regulators, two rail jumpers and a power LED. Pairs with sim/devices/breadboard-power.ts. */
import {BoxGeometry,CylinderGeometry,Group,Mesh} from 'three';
import type {PartProps} from '../../contract';
import type {BreadboardPowerState} from '../../sim/devices/breadboard-power';
import {ownToon,solid} from '../materials';
import * as C from '../palette';
import {HALF_PI,definePart,extState,c,pin,callout,type Inner} from './kit';

const GREEN_PCB=0x1d6b4a; // ds-allow-hex  (green module PCB)
const OFF_LED=0x5a1f1c; // ds-allow-hex  (unlit red LED)

function buildBbPower(props:PartProps,g:Group):Inner{
 const w=53,d=34,y=2;
 g.add(solid(new BoxGeometry(w,1.6,d),GREEN_PCB,{outline:true,edges:true,pos:[0,y,0]}));
 // DC barrel jack on the left edge (5.5/2.1 mm), with its black housing
 g.add(solid(new BoxGeometry(14,10.5,9),C.HEADER_BLACK,{outline:true,pos:[-w/2+4,y+6.4,0]}));
 g.add(solid(new CylinderGeometry(2.7,2.7,10,18),C.CHIP,{rot:[0,0,HALF_PI],pos:[-w/2-2.5,y+6.4,0],cast:false}));
 // slide switch and the two rail-voltage jumper blocks
 g.add(solid(new BoxGeometry(8,3.4,4.4),C.SILVER_DARK,{outline:true,pos:[-w/2+10,y+2.5,-9],finish:'metal'}));
 g.add(solid(new BoxGeometry(3,2.4,2.4),C.CREAM,{pos:[-w/2+10,y+5.2,-9],cast:false}));
 const jumpers:Mesh[]=[];
 for(const sz of [-1,1]){
  g.add(solid(new BoxGeometry(8,2.4,2.6),C.HEADER_BLACK,{outline:true,pos:[w/2-14,y+2,sz*9]}));
  const cap=solid(new BoxGeometry(5,3,2.6),C.CREAM_DARK,{outline:true,pos:[w/2-14+(sz<0?(props.left==='3.3'?1.5:-1.5):(props.right==='3.3'?1.5:-1.5)),y+4,sz*9]});
  jumpers.push(cap);g.add(cap);
 }
 // two SOT-223 regulators, two electrolytic capacitors, the power LED
 for(const sz of [-1,1])g.add(solid(new BoxGeometry(6.5,1.7,3.5),C.CHIP,{pos:[w/2-30,y+2.6,sz*8],cast:false}));
 for(const sx of [-4,4])g.add(solid(new CylinderGeometry(3,3,7,18),0x1b2230,{outline:true,pos:[sx,y+4.3,3]})); // ds-allow-hex  (electrolytic sleeve)
 const ledMat=ownToon(OFF_LED);
 const led=new Mesh(new BoxGeometry(2.6,1.2,1.4),ledMat);led.position.set(-4,y+1.4,-11);g.add(led);
 // wire terminals along the front edge: VIN, GND, LEFT rail, RIGHT rail
 for(let i=0;i<4;i++)g.add(solid(new BoxGeometry(2.4,6,2.4),C.HEADER_BLACK,{pos:[-18+i*12,y+4.4,d/2-2],cast:false}));
 return {
  apply(s){
   const st=extState<BreadboardPowerState>(s,'breadboard-power');
   if(!st)return;
   const live=st.on&&st.vin!==null&&st.vin>=6.5;
   ledMat.color.setHex(live?C.RED_ALERT:OFF_LED);ledMat.emissive.setHex(C.RED_ALERT);ledMat.emissiveIntensity=live?2.2:0;
  },
 };
}

export const breadboardPower=definePart({
 kind:'breadboard-power',name:c('Rail power board (battery jack)','Papan daya jalur (jack baterai)'),
 pins:{VIN:pin([-18,8,15],'power','VIN (6.5-12 V)','VIN (6,5-12 V)'),GND:pin([-6,8,15],'ground','Ground','Ground'),LEFT:pin([6,8,15],'output','Left rail','Jalur kiri'),RIGHT:pin([18,8,15],'output','Right rail','Jalur kanan')},
 callouts:[callout('jumper',[53/2-14,10,9],'Jumper: 5 V or 3.3 V for this rail','Jumper: 5 V atau 3,3 V untuk jalur ini'),callout('jack',[-26,12,0],'Barrel jack: 6.5-12 V in','Jack baterai: masuk 6,5-12 V')],
 deskMm:[53,34],
 make:buildBbPower,
});
