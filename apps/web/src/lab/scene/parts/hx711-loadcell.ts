/**
 * HX711 load cell amplifier board (about 38 x 21 mm, SOP-16 chip, 4-pin header, four screw pads) wired to a strain-gauge bar
 * (about 80 x 12.7 x 12.7 mm aluminium, S-shaped cut-out, fixed at one end, loaded at the other). Pairs with sim/devices/hx711-loadcell.ts.
 */
import {BoxGeometry,CylinderGeometry,Group,Mesh,MeshBasicMaterial,PlaneGeometry,TubeGeometry,CatmullRomCurve3,Vector3} from 'three';
import type {PartProps} from '../../contract';
import type {Hx711LoadcellState} from '../../sim/devices/hx711-loadcell';
import {canvasTexture,ownToon,solid} from '../materials';
import * as C from '../palette';
import {HALF_PI,MONO,definePart,extState,c,pin,callout,type Inner} from './kit';

const BOARD_RED=0xb8312f; // ds-allow-hex  (amplifier module PCB)
const LED_OFF=0x5a1f1c; // ds-allow-hex  (unlit red LED)
const WEIGHT_IRON=0x3a3d45; // ds-allow-hex  (calibration mass)
const GAUGE=0xe8dcc0; // ds-allow-hex  (strain gauge patch)
const WIRES=[0xe5342f,0x2b2f3a,0x2fbf5b,0xf0f0f0] as const; // ds-allow-hex  (excitation + / -, signal - / +)

function label(g:Group,text:string,w:number,h:number,x:number,y:number,z:number,flat=true):void{
 const cv=document.createElement('canvas');cv.width=256;cv.height=Math.max(16,Math.round(256*h/w));
 const k=cv.getContext('2d')!;
 k.fillStyle='#f7f4ea';k.textAlign='center';k.textBaseline='middle';k.font=`600 ${Math.round(cv.height*0.7)}px ${MONO}`;k.fillText(text,128,cv.height/2);
 const m=new Mesh(new PlaneGeometry(w,h),new MeshBasicMaterial({map:canvasTexture(cv),transparent:true,toneMapped:false,depthWrite:false}));
 m.material.userData.own=true;m.material.userData.ownMap=true;m.position.set(x,y,z);if(flat)m.rotation.x=-HALF_PI;m.userData.noPick=true;m.userData.noInk=true;g.add(m);
}

const BX=0,BZ=10,BW=38,BD=21,BY=2;             // amplifier board centre (x,z), size, height of its underside
const HX=-BW/2+3;                              // header column
const BAR_Z=-14,BAR_L=80,BAR_T=12.7;           // bar centre z, length, square section

function buildHx(_p:PartProps,g:Group):Inner{
 // amplifier board
 g.add(solid(new BoxGeometry(BW,1.6,BD),BOARD_RED,{outline:true,edges:true,pos:[BX,BY,BZ]}));
 g.add(solid(new BoxGeometry(10.2,1.8,5),C.CHIP,{outline:true,pos:[BX+2,BY+1.7,BZ],cast:false}));   // SOP-16 body
 for(const sz of [-1,1])for(let i=0;i<8;i++)g.add(solid(new BoxGeometry(0.4,0.3,0.9),C.SILVER,{pos:[BX+2-4.4+i*1.27*1.0,BY+1,BZ+sz*3.1],cast:false,finish:'metal'}));
 label(g,'HX711',8,2.4,BX+2,BY+2.65,BZ);
 // header: GND DT SCK VCC along the left edge (anchors sit on top of the pins)
 for(let i=0;i<4;i++){
  g.add(solid(new BoxGeometry(2.54,2.5,2.54),C.HEADER_BLACK,{outline:true,pos:[HX,BY+2.4,BZ-7.5+i*2.54*1.3+1.2],cast:false}));
  g.add(solid(new BoxGeometry(0.64,6,0.64),C.GOLD,{pos:[HX,BY+4.5,BZ-7.5+i*2.54*1.3+1.2],cast:false,finish:'gold'}));
 }
 label(g,'GND DT SCK VCC',12,2,HX+3.4,BY+0.85,BZ+0.2,true);
 // four solder pads on the right edge, E+ E- A- A+, with the wires to the bar
 const padX=BX+BW/2-3,padZ=(i:number):number=>BZ-6.5+i*4.3;
 const wireFrom:Vector3[]=[];
 for(let i=0;i<4;i++){
  g.add(solid(new CylinderGeometry(1.4,1.4,0.5,16),C.GOLD,{pos:[padX,BY+1,padZ(i)],cast:false,finish:'gold'}));
  wireFrom.push(new Vector3(padX,BY+1.4,padZ(i)));
 }
 const ledMat=ownToon(LED_OFF);
 const led=new Mesh(new BoxGeometry(1.6,0.8,1),ledMat);led.position.set(BX+13,BY+1.2,BZ-8);g.add(led);
 // the bar: pivot at the fixed end so the free end can drop
 const pivot=new Group();pivot.position.set(-BAR_L/2,BAR_T/2+0.6,BAR_Z);g.add(pivot);
 const bar=new Group();bar.position.set(BAR_L/2,0,0);pivot.add(bar);
 bar.add(solid(new BoxGeometry(BAR_L,BAR_T,BAR_T),C.SILVER,{outline:true,edges:true,finish:'metal'}));
 // the two round relief holes through the bar (dark discs on both faces) and the slot between them
 for(const sx of [-11,11])for(const sz of [-1,1])bar.add(solid(new CylinderGeometry(3.3,3.3,0.3,24),C.HOLE,{rot:[HALF_PI,0,0],pos:[sx,0,sz*(BAR_T/2+0.05)],cast:false}));
 bar.add(solid(new BoxGeometry(22,2.6,0.3),C.HOLE,{pos:[0,0,BAR_T/2+0.05],cast:false}));
 bar.add(solid(new BoxGeometry(22,2.6,0.3),C.HOLE,{pos:[0,0,-BAR_T/2-0.05],cast:false}));
 // strain gauge patch on top of the thin web, and two screw holes at each end
 bar.add(solid(new BoxGeometry(8,0.3,7),GAUGE,{pos:[0,BAR_T/2+0.15,0],cast:false}));
 for(const sx of [-BAR_L/2+7,BAR_L/2-7])bar.add(solid(new CylinderGeometry(2.1,2.1,0.3,18),C.HOLE,{pos:[sx,BAR_T/2+0.05,0],cast:false}));
 // fixed-end block and the calibration mass at the free end
 g.add(solid(new BoxGeometry(14,0.6,BAR_T+4),C.CHIP,{outline:true,pos:[-BAR_L/2+5,0.3,BAR_Z],cast:false}));
 const mass=solid(new CylinderGeometry(1,1,1,28),WEIGHT_IRON,{outline:true,pos:[BAR_L/2-7,BAR_T/2+0.5,0],own:true});
 bar.add(mass);
 // four wires from the pads to the sensor end of the bar
 WIRES.forEach((col,i)=>{
  const a=wireFrom[i]!,b=new Vector3(-BAR_L/2+4,BAR_T+0.9,BAR_Z-3+i*2);
  const curve=new CatmullRomCurve3([a,new Vector3(a.x+3,2.6,a.z+2.5+i),new Vector3((a.x+b.x)/2,2.2,BAR_Z+BAR_T/2+5+i*0.8),new Vector3(b.x+3,b.y+3,b.z+BAR_T/2+2),b]);
  g.add(solid(new TubeGeometry(curve,24,0.36,6,false),col,{cast:false}));
 });
 return {
  apply(s){
   const st=extState<Hx711LoadcellState>(s,'hx711-loadcell');
   if(!st)return;
   ledMat.color.setHex(st.powered&&!st.poweredDown?C.RED_ALERT:LED_OFF);ledMat.emissive.setHex(C.RED_ALERT);ledMat.emissiveIntensity=st.powered&&!st.poweredDown?2:0;
   const load=Math.min(1.5,st.weight/(st.capacityKg*1000));
   pivot.rotation.z=-load*0.05;   // the real bar bends a fraction of a millimetre: drawn about 100 times larger
   const w=st.weight;
   mass.visible=w>0;
   if(w>0){const r=2.2+3.6*Math.cbrt(Math.min(1,w/10000)),h=1.2+3.4*Math.cbrt(Math.min(1,w/10000));mass.scale.set(r,h,r);mass.position.y=BAR_T/2+h/2;}
  },
 };
}

export const hx711Loadcell=definePart({
 kind:'hx711-loadcell',name:c('HX711 amplifier + load cell','Penguat HX711 + sel beban'),
 pins:{
  GND:pin([HX,9,BZ-7.5+1.2],'ground','Ground','Ground'),DT:pin([HX,9,BZ-7.5+2.54*1.3+1.2],'output','DT (data out)','DT (data keluar)'),
  SCK:pin([HX,9,BZ-7.5+2*2.54*1.3+1.2],'input','SCK (clock)','SCK (clock)'),VCC:pin([HX,9,BZ-7.5+3*2.54*1.3+1.2],'power','VCC (2.6-5.5 V)','VCC (2,6-5,5 V)'),
 },
 callouts:[
  callout('bar',[0,BAR_T+4,BAR_Z],'The bar bends a hair when loaded; a strain gauge feels it','Batang melengkung sedikit saat dibebani; strain gauge merasakannya'),
  callout('chip',[BX+2,BY+6,BZ],'HX711: 24-bit converter, DT low means a reading is ready','HX711: konverter 24-bit, DT rendah berarti bacaan siap'),
 ],
 deskMm:[82,44],
 make:buildHx,
});
