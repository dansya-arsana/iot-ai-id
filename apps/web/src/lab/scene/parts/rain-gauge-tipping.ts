/**
 * RAIN-GAUGE-TIPPING: a tipping-bucket gauge (SparkFun SEN-15901 class): a cream UV-plastic funnel about 120 mm wide and about 90 mm tall, a mesh over the opening,
 * a translucent see-saw bucket (shown in a cutaway window on the front), a reed switch in the base, a 2-arm mounting bracket and a black cable.
 * Pairs with sim/devices/rain-gauge-tipping.ts. Source for the size: the SEN-15901 product pages (funnel about 110-130 mm; we use 120).
 */
import {BoxGeometry,CylinderGeometry,Group,Mesh,MeshBasicMaterial,TorusGeometry} from 'three';
import type {PartProps} from '../../contract';
import type {RainGaugeTippingState} from '../../sim/devices/rain-gauge-tipping';
import {solid} from '../materials';
import * as C from '../palette';
import {HALF_PI,definePart,extState,c,pin,callout,type Inner} from './kit';

const BUCKET=0xbfe3f2; // ds-allow-hex  (translucent bucket plastic)
export const DIMS={l:120,w:120,h:90,mm:true as const};
const LEAD_X=-70;
const pinAt=(sign:number):[number,number,number]=>[LEAD_X,4,sign*3];

function buildGauge(_p:PartProps,g:Group):Inner{
 // base housing with the reed switch, and the funnel above it
 g.add(solid(new CylinderGeometry(30,34,34,40),C.CREAM,{outline:true,pos:[0,17,0]}));
 g.add(solid(new CylinderGeometry(60,30,34,40),C.CREAM,{outline:true,pos:[0,51,0]}));
 g.add(solid(new CylinderGeometry(56,56,0.6,40),C.GROOVE,{pos:[0,67.8,0],cast:false}));   // the collecting surface seen down the funnel
 g.add(solid(new TorusGeometry(60,1.8,10,48),C.CREAM_DARK,{rot:[HALF_PI,0,0],pos:[0,68,0],cast:false}));
 // mesh over the funnel opening: a ring with a few crossing bars
 for(let i=0;i<4;i++)g.add(solid(new BoxGeometry(118,0.8,0.8),C.GROOVE,{rot:[0,i*Math.PI/4,0],pos:[0,68.4,0],cast:false}));
 // cutaway window on the +z face showing the see-saw bucket
 g.add(solid(new BoxGeometry(20,18,2),C.HOLE,{pos:[0,20,30.2],cast:false}));
 const bucket=new Group();bucket.position.set(0,20,31.4);
 for(const s of [-1,1]){
  const half=solid(new BoxGeometry(9,6,1.2),BUCKET,{edges:true,pos:[s*4.8,0,0],rot:[0,0,s*0.5],own:true});
  const m=half.material as unknown as {transparent:boolean;opacity:number};m.transparent=true;m.opacity=0.8;
  bucket.add(half);
 }
 g.add(bucket);
 // reed switch: a small glass capsule on the base, glows green while closed
 const reed=solid(new CylinderGeometry(1.6,1.6,14,12),C.SILVER,{rot:[0,0,HALF_PI],pos:[0,6,26],own:true,finish:'metal'});
 g.add(reed);
 // 2-arm mounting bracket
 for(const s of [-1,1])g.add(solid(new BoxGeometry(34,3,8),C.SILVER_DARK,{pos:[s*36,2,-4],finish:'metal'}));
 // black cable to the pin anchors
 for(const [sign,col] of [[1,C.RED_ALERT],[-1,C.CHIP]] as const){
  g.add(solid(new BoxGeometry(-LEAD_X-34,1.2,1.2),col,{pos:[(LEAD_X-34)/2,4,sign*3],cast:false}));
  g.add(solid(new BoxGeometry(2.6,0.9,0.9),C.SILVER,{pos:[LEAD_X+1.3,4,sign*3],cast:false,finish:'metal'}));
 }
 const ledMat=new MeshBasicMaterial({color:C.LIVE,transparent:true,opacity:0});ledMat.userData.own=true;
 const glow=new Mesh(new CylinderGeometry(2.4,2.4,16,12),ledMat);glow.rotation.z=HALF_PI;glow.position.set(0,6,26);glow.userData.noPick=true;glow.userData.noInk=true;g.add(glow);
 let tilt=0;
 return {
  apply(s,dt){
   const st=extState<RainGaugeTippingState>(s,'rain-gauge-tipping');
   if(!st)return;
   ledMat.opacity=st.closed?0.85:0;
   // the bucket rocks to the other side on every tip and settles back to a small tilt
   const want=st.tips%2===0?-0.18:0.18;
   tilt+=(want-tilt)*Math.min(1,dt/120);
   bucket.rotation.z=tilt;
  },
 };
}

export const rainGaugeTipping=definePart({
 kind:'rain-gauge-tipping',name:c('Tipping-bucket rain gauge','Penakar hujan tipping-bucket'),
 pins:{SIG:pin(pinAt(1),'output','Signal (reed lead 1)','Sinyal (kaki reed 1)'),GND:pin(pinAt(-1),'ground','Ground (reed lead 2)','Ground (kaki reed 2)')},
 deskMm:[130,130],
 callouts:[
  callout('funnel',[0,72,0],'Funnel: mount it level and keep leaves out','Corong: pasang rata dan jauhkan dari daun'),
  callout('bucket',[0,24,33],'The see-saw bucket tips every 0.2794 mm of rain','Bucket jungkat-jungkit terbalik setiap 0,2794 mm hujan'),
  callout('reed',[0,10,26],'Reed switch: it bounces, so debounce in the firmware','Saklar reed: memantul, jadi lakukan debounce di firmware'),
 ],
 make:buildGauge,
});
