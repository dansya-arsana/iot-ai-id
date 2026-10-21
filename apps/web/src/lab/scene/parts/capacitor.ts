/** Capacitor: radial electrolytic (6.3 x 11 mm can, 2.54 mm lead pitch) and ceramic disc (5 mm). Both are built, apply() shows the chosen one. */
import {BoxGeometry,CylinderGeometry,Group} from 'three';
import type {PartProps} from '../../contract';
import type {CapacitorState} from '../../sim/devices/capacitor';
import {PITCH} from '../layout';
import {solid} from '../materials';
import * as C from '../palette';
import {leg,definePart,extState,c,pin,callout,type Inner} from './kit';

const SLEEVE=0x1d3566; // ds-allow-hex  electrolytic sleeve, navy
const STRIPE=0xcfd6e4; // ds-allow-hex  minus stripe
const CERAMIC=0xd9a04e; // ds-allow-hex  dipped ceramic epoxy
const CERAMIC_DARK=0xb07a30; // ds-allow-hex  shading band of the dip

function buildCapacitor(p:PartProps,g:Group):Inner{
 const cx=PITCH/2;
 // electrolytic: 6.3 mm can, 11 mm tall, sits on a 1.2 mm rubber seat, raised so the leads show
 const el=new Group();g.add(el);
 const h=11,r=3.15,y0=3.7;
 el.add(solid(new CylinderGeometry(r,r,h,36),SLEEVE,{outline:true,pos:[cx,y0+h/2,0]}));
 el.add(solid(new CylinderGeometry(r*0.94,r*0.94,0.6,36),C.SILVER,{pos:[cx,y0+h+0.25,0],finish:'metal',cast:false}));
 for(const a of [0,Math.PI/2])el.add(solid(new BoxGeometry(r*1.5,0.12,0.18),C.SILVER_DARK,{pos:[cx,y0+h+0.58,0],rot:[0,a,0],cast:false}));
 el.add(solid(new CylinderGeometry(r*0.97,r*0.97,1.2,36),C.HEADER_BLACK,{pos:[cx,y0-0.6,0],cast:false}));
 // minus stripe on the side of the NEG lead (+x), with dashes
 el.add(solid(new BoxGeometry(0.15,h*0.86,r*0.95),STRIPE,{pos:[cx+r-0.04,y0+h/2,0],cast:false}));
 for(let i=0;i<4;i++)el.add(solid(new BoxGeometry(0.2,0.25,0.9),SLEEVE,{pos:[cx+r+0.03,y0+h*0.2+i*h*0.19,0],cast:false}));
 el.add(leg(0,3.7),leg(PITCH,3.7));
 // ceramic disc: 5 mm dia, 2.5 mm thick, on two straight leads, stands 3 mm above the board
 const ce=new Group();g.add(ce);
 const dr=2.7,cy=3.5+dr;
 ce.add(solid(new CylinderGeometry(dr,dr,2.4,32),CERAMIC,{outline:true,pos:[cx,cy,0],rot:[Math.PI/2,0,0]}));
 ce.add(solid(new CylinderGeometry(dr*0.98,dr*0.98,0.5,32),CERAMIC_DARK,{pos:[cx,cy,0.95],rot:[Math.PI/2,0,0],cast:false}));
 ce.add(solid(new BoxGeometry(2.4,0.18,0.1),C.HEADER_BLACK,{pos:[cx,cy+0.4,1.22],cast:false}));
 ce.add(leg(0,cy-1),leg(PITCH,cy-1));
 const show=(v:string)=>{el.visible=v!=='ceramic';ce.visible=v==='ceramic';};
 show(typeof p.variant==='string'?p.variant:'electrolytic');
 return {
  apply(s){
   const st=extState<CapacitorState>(s,'capacitor');
   if(st)show(st.variant);
  },
 };
}

export const capacitor=definePart({
 kind:'capacitor',name:c('Capacitor','Kapasitor'),
 pins:{POS:pin([0,0,0],'passive','Plus (long lead)','Plus (kaki panjang)'),NEG:pin([PITCH,0,0],'passive','Minus (stripe side)','Minus (sisi garis)')},
 callouts:[callout('body',[PITCH/2,15,0],'Stripe marks the minus lead','Garis menandai kaki minus')],
 make:buildCapacitor,
});
