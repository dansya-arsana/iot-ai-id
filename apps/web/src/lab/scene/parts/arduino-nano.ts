/** Nano V3 form factor, generic (no logo): 43.2 x 18 mm PCB, two 15-pin rows 15.24 mm apart. Visual only, see the device note. */
import {BoxGeometry,CylinderGeometry,Group,Mesh,PlaneGeometry} from 'three';
import type {BoardFeatureId,PartProps} from '../../contract';
import type {ArduinoNanoState} from '../../sim/devices/arduino-nano';
import {canvasTexture,labelMaterial,ownToon,solid} from '../materials';
import * as C from '../palette';
import {addShadow,definePart,extState,hex,MONO,c,callout,type Inner} from './kit';

const NANO_PCB=0x1a5a7a; // ds-allow-hex  teal-blue solder mask

function silk(w:number,d:number,draw:(g:CanvasRenderingContext2D,pxPerMm:number)=>void):Mesh{
 const k=16,cv=document.createElement('canvas');cv.width=Math.round(w*k);cv.height=Math.round(d*k);
 draw(cv.getContext('2d')!,k);
 const m=new Mesh(new PlaneGeometry(w,d),labelMaterial(canvasTexture(cv)));
 m.rotation.x=-Math.PI/2;m.userData.noPick=true;m.userData.noInk=true;m.renderOrder=2;return m;
}

export const NANO={L:43.2,W:18,T:1.6,y0:5.1,pitch:2.54,rowZ:7.62};
/** Header order, one row per side as printed on the silkscreen (z -7.62 first row, z +7.62 second row). */
export const NANO_ROW_TOP=['D1','D0','RST','GND','D2','D3','D4','D5','D6','D7','D8','D9','D10','D11','D12'] as const;
export const NANO_ROW_BOTTOM=['D13','3V3','AREF','A0','A1','A2','A3','A4','A5','A6','A7','5V','RST','GND','VIN'] as const;
export interface NanoBody{power:Mesh;l:Mesh;tx:Mesh;top:number}
/**
 * The Nano body. `feat` hands out the group a clickable feature goes in (the board scene passes its feature groups, the
 * desk part leaves everything in the root group).
 */
export function buildNanoBody(g:Group,feat:(id:BoardFeatureId)=>Group=()=>g):NanoBody{
 const {L,W,T,y0}=NANO; // pcb underside sits on 2.54 mm header housings
 g.add(solid(new BoxGeometry(L,T,W),NANO_PCB,{outline:true,pos:[0,y0+T/2,0]}));
 const top=y0+T;
 // pin headers: 15 per side at 2.54 mm, under the board; black housing, pin tips below
 for(const sz of [-1,1]){
  const z=sz*7.62,row=feat(sz<0?'uno.digital-header':'uno.analog-header');
  row.add(solid(new BoxGeometry(15*2.54,2.5,2.54),C.HEADER_BLACK,{outline:true,pos:[0,y0-1.25,z]}));
  for(let i=0;i<15;i++){
   const x=(i-7)*2.54;
   row.add(solid(new BoxGeometry(0.64,y0+T,0.64),C.GOLD,{pos:[x,(y0+T)/2,z],finish:'gold',cast:false}));
   row.add(solid(new CylinderGeometry(0.6,0.6,0.1,10),C.GOLD,{pos:[x,top+0.06,z],finish:'gold',cast:false}));
  }
 }
 // mini-USB-B receptacle at -x end, overhanging 1 mm
 feat('uno.usb').add(solid(new BoxGeometry(7.6,3.9,7.7),C.SILVER,{outline:true,pos:[-L/2+2.8,top+1.95,0],finish:'metal'}));
 feat('uno.usb').add(solid(new BoxGeometry(1,2.0,5.2),C.HOLE,{pos:[-L/2-1.1,top+1.95,0],cast:false}));
 // ATmega328P in TQFP-32 (7 x 7 mm body, 1.0 mm tall) rotated 45 deg, as on the Nano
 const mcu=solid(new BoxGeometry(7,1,7),C.CHIP,{outline:true,edges:true,pos:[3.5,top+0.5,0],rot:[0,Math.PI/4,0]});feat('uno.mcu').add(mcu);
 feat('uno.mcu').add(solid(new CylinderGeometry(0.5,0.5,0.1,12),C.SILVER_DARK,{pos:[1.4,top+1.02,-1.4],cast:false}));
 // USB-serial chip SOIC-16 (10 x 4 mm)
 feat('uno.usb-chip').add(solid(new BoxGeometry(10,1.5,4),C.CHIP,{outline:true,edges:true,pos:[-9,top+0.75,3.2]}));
 // 16 MHz crystal HC-49 SMD and reset button
 feat('uno.crystal').add(solid(new BoxGeometry(5,1.8,3.2),C.SILVER,{outline:true,pos:[-8,top+0.9,-4],finish:'metal'}));
 feat('uno.reset').add(solid(new BoxGeometry(3.6,1.4,3.6),C.SILVER_DARK,{outline:true,pos:[-0.5,top+0.7,-6.2],finish:'metal'}));
 feat('uno.reset').add(solid(new CylinderGeometry(1,1,0.9,16),C.HEADER_BLACK,{pos:[-0.5,top+1.8,-6.2],cast:false}));
 // ICSP 2x3 header at +x end
 feat('uno.icsp').add(solid(new BoxGeometry(5.08,2.5,7.62),C.HEADER_BLACK,{outline:true,pos:[L/2-3.6,top+1.25,0]}));
 for(let i=0;i<3;i++)for(const sz of [-1,1])feat('uno.icsp').add(solid(new BoxGeometry(0.64,3.2,0.64),C.GOLD,{pos:[L/2-3.6+sz*1.27,top+1.6,(i-1)*2.54],finish:'gold',cast:false}));
 // SMD leds and caps
 const pwr=solid(new BoxGeometry(1.6,0.6,0.8),C.LED_ON_GREEN,{own:true,pos:[10,top+0.3,7],cast:false});feat('uno.led-on').add(pwr);
 const tx=solid(new BoxGeometry(1.6,0.6,0.8),C.LED_TX_YELLOW,{own:true,pos:[12,top+0.3,7],cast:false});feat('uno.led-txrx').add(tx);
 const lLed=solid(new BoxGeometry(1.6,0.6,0.8),C.LED_L_ORANGE,{own:true,pos:[14,top+0.3,7],cast:false});feat('uno.led-l').add(lLed);
 for(const [x,z] of [[-4,-2],[-4,0.5],[8.5,-5],[8.5,-3.4],[12,-5.5],[15,-5.5]] as const)g.add(solid(new BoxGeometry(1.2,0.5,0.7),C.CREAM_DARK,{pos:[x,top+0.25,z],cast:false}));
 g.add(solid(new BoxGeometry(3,1.2,2.4),C.CHIP,{outline:true,pos:[12.5,top+0.6,3.2]}));
 // silkscreen: generic NANO V3 text and pin numbers on both rows
 const s=silk(L,W,(c2,k)=>{
  c2.fillStyle=hex(0xf7f4ea);c2.font=`bold ${1.9*k}px ${MONO}`;c2.textAlign='center';
  c2.fillText('NANO V3',L*k*0.5+2*k,W*k*0.52);
  c2.font=`${1.0*k}px ${MONO}`;
  const top1=['TX1','RX0','RST','GND','D2','D3','D4','D5','D6','D7','D8','D9','D10','D11','D12'];
  const bot=['D13','3V3','REF','A0','A1','A2','A3','A4','A5','A6','A7','5V','RST','GND','VIN'];
  top1.forEach((t,i)=>c2.fillText(t,(i-7)*2.54*k+L*k/2,2.4*k));
  bot.forEach((t,i)=>c2.fillText(t,(i-7)*2.54*k+L*k/2,W*k-1.4*k));
 });
 s.position.set(0,top+0.03,0);g.add(s);
 addShadow(g,L+6,W+6,0.3,3,0,0.03,0);
 return {power:pwr,l:lLed,tx,top};
}

function buildNano(_p:PartProps,g:Group):Inner{
 const body=buildNanoBody(g);
 const m=body.power.material as ReturnType<typeof ownToon>;
 return {
  apply(st){
   const v=extState<ArduinoNanoState>(st,'arduino-nano');
   if(!v)return;
   m.emissive.set(C.LED_ON_GREEN);m.emissiveIntensity=v.usbPower?1.4:0;
  },
 };
}

export const arduinoNano=definePart({
 kind:'arduino-nano',name:c('Nano-style board','Papan gaya Nano'),
 pins:{},deskMm:[44,18],
 callouts:[callout('usb',[-17,9,0],'Mini-USB end: power and upload','Ujung mini-USB: daya dan unggah'),callout('mcu',[3.5,7,0],'ATmega328P, same chip as the Uno','ATmega328P, chip yang sama dengan Uno')],
 make:buildNano,
});
