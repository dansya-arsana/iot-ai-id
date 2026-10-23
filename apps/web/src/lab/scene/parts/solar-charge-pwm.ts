/** SOLAR-CHARGE-PWM: 119 x 75 x 27.5 mm matte case, three screw-terminal pairs, status LEDs, mode button. No brand. Own work. */
import {BoxGeometry,Color,CylinderGeometry,Group,MeshStandardMaterial} from 'three';
import type {PartProps} from '../../contract';
import {DIMS,type SolarChargeState} from '../../sim/devices/solar-charge-pwm';
import {solid} from '../materials';
import * as C from '../palette';
import {addShadow,definePart,extState,c,pin,callout,type Inner} from './kit';

const CASE=0x2a2d33; // ds-allow-hex  matte dark-grey plastic
const TERM_X=[-36,-4,28]; // PV, BAT, LOAD blocks along x
const NAMES=[['PV+','PV-'],['BAT+','BAT-'],['LOAD+','LOAD-']] as const;

function buildController(_p:PartProps,g:Group):Inner{
 const {l,w,h}=DIMS;
 g.add(solid(new BoxGeometry(l,h,w),CASE,{outline:true,pos:[0,h/2,0]}));
 // heatsink fins on the top face
 for(let i=0;i<7;i++)g.add(solid(new BoxGeometry(2,2,w-34),C.HEADER_TOP,{pos:[-45+i*5,h+1,-8],cast:false}));
 // three terminal pairs on the front (z+) edge strip, with screws
 for(let b=0;b<3;b++)for(let r=0;r<2;r++){
  const x=TERM_X[b]!+r*13;
  g.add(solid(new BoxGeometry(11,9,11),C.SILVER_DARK,{outline:true,pos:[x,h-4.5+4.5,w/2-5],finish:'metal'}));
  g.add(solid(new CylinderGeometry(2.6,2.6,1.2,14),C.SILVER,{pos:[x,h+5.2,w/2-5],cast:false,finish:'metal'}));
 }
 const leds:MeshStandardMaterial[]=[];
 const off=new Color(C.LED_SMD_OFF);
 for(let i=0;i<3;i++){
  const m=solid(new BoxGeometry(3,1,3),C.LED_SMD_OFF,{pos:[34+i*7,h+0.5,-w/2+9],cast:false,own:true});
  g.add(m);leds.push(m.material as MeshStandardMaterial);
 }
 g.add(solid(new CylinderGeometry(3.4,3.4,2.4,16),C.BUTTON_CAP,{pos:[-30,h+1.2,-w/2+10],cast:false}));
 addShadow(g,l+10,w+10,0.3,3,0,0.03,0);
 const lit=[new Color(C.LED_ON_GREEN),new Color(C.LED_L_ORANGE),new Color(C.LED_ON_GREEN)];
 return {apply(s){
  const st=extState<SolarChargeState>(s,'solar-charge-pwm');
  if(!st)return;
  leds[0]!.color.copy(st.chargeA>0?lit[0]!:off);          // charging
  leds[1]!.color.copy(st.issue||st.pvOverV?lit[1]!:off);   // warning
  leds[2]!.color.copy(st.loadConnected?lit[2]!:off);       // load on
 }};
}

const pins:Record<string,ReturnType<typeof pin>>={};
NAMES.forEach((pair,b)=>pair.forEach((n,r)=>{pins[n]=pin([TERM_X[b]!+r*13,DIMS.h+9,DIMS.w/2-5],n.endsWith('+')?'power':'ground',n,n);}));

export const solarChargePwm=definePart({
 kind:'solar-charge-pwm',name:c('PWM solar charge controller','Pengontrol pengisi surya PWM'),deskMm:[125,80],
 pins,
 callouts:[
  callout('order',[0,DIMS.h+14,DIMS.w/2],'Connect the battery first, then the panel, then the load','Sambungkan baterai dulu, lalu panel, lalu beban'),
  callout('pvmax',[-30,DIMS.h+10,DIMS.w/2],'PV input maximum is 50 V','Masukan PV maksimum 50 V'),
  callout('lfp',[-30,DIMS.h+4,-DIMS.w/2+10],'LFP mode is set by hand with this button','Mode LFP diatur manual dengan tombol ini'),
  callout('lvd',[41,DIMS.h+6,-DIMS.w/2+9],'Load LED: the load output stops at the low-voltage disconnect','LED beban: keluaran beban berhenti di batas tegangan rendah'),
 ],
 make:buildController,
});
