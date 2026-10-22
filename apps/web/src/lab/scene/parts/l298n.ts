/** L298N: red dual H-bridge module (about 43 x 43 x 27 mm) with a black heat sink, blue screw terminals and a six-way logic header. Pairs with sim/devices/l298n.ts. */
import {BoxGeometry,CylinderGeometry,Group,Mesh,MeshBasicMaterial,PlaneGeometry} from 'three';
import type {PartProps} from '../../contract';
import type {L298nState} from '../../sim/devices/l298n';
import {PITCH} from '../layout';
import {canvasTexture,ownToon,solid} from '../materials';
import * as C from '../palette';
import {HALF_PI,MONO,leg,definePart,extState,c,pin,callout,type Inner} from './kit';

const BOARD_RED=0xb8312f; // ds-allow-hex  (L298N module PCB)
const TERM=0x2f6fe0; // ds-allow-hex  (blue screw terminal)

function label(g:Group,text:string,w:number,h:number,x:number,y:number,z:number):void{
 const cv=document.createElement('canvas');cv.width=256;cv.height=Math.round(256*h/w);
 const k=cv.getContext('2d')!;
 k.fillStyle='#f7f4ea';k.textAlign='center';k.textBaseline='middle';k.font=`600 ${Math.round(cv.height*0.7)}px ${MONO}`;k.fillText(text,128,cv.height/2);
 const m=new Mesh(new PlaneGeometry(w,h),new MeshBasicMaterial({map:canvasTexture(cv),transparent:true,toneMapped:false,depthWrite:false}));
 m.material.userData.own=true;m.material.userData.ownMap=true;m.position.set(x,y,z);m.userData.noPick=true;m.userData.noInk=true;g.add(m);
}

/** Terminal anchors in mm (buildL298 places the screw blocks with the same numbers): left/right x, y of the board centre, z of the screw heads. */
const TL=3*PITCH-43/2+4.2,TR=3*PITCH+43/2-4.2,TY=5+43/2,TZ=11;

function buildL298(_p:PartProps,g:Group):Inner{
 const bw=43,bh=43,py=5,cx=3*PITCH,cy=py+bh/2;
 for(let i=0;i<7;i++)g.add(leg(i*PITCH,py+0.4));
 g.add(solid(new BoxGeometry(bw,bh,1.6),BOARD_RED,{outline:true,edges:true,pos:[cx,cy,0]}));
 // Multiwatt15 heat sink block: black, with vertical fins
 const hx=cx+2,hy=cy+10;
 g.add(solid(new BoxGeometry(14,14,12),0x25272c,{outline:true,pos:[hx,hy,7.2]})); // ds-allow-hex  (anodised heat sink)
 for(let i=0;i<5;i++)g.add(solid(new BoxGeometry(0.8,14,4),0x25272c,{pos:[hx-5.6+i*2.8,hy,15.2],cast:false})); // ds-allow-hex
 g.add(solid(new BoxGeometry(14,3,1.6),C.CHIP,{pos:[hx,cy+1.5,2.4],cast:false}));
 // two big capacitors and the 78M05 regulator
 for(const sx of [-1,1]){
  g.add(solid(new CylinderGeometry(3.4,3.4,9,20),0x1b2230,{outline:true,pos:[cx+sx*8,cy-12,5.6]})); // ds-allow-hex  (electrolytic sleeve)
  g.add(solid(new CylinderGeometry(3.2,3.2,0.4,20),C.SILVER,{pos:[cx+sx*8,cy-12,10.2],rot:[HALF_PI,0,0],finish:'metal',cast:false}));
 }
 g.add(solid(new BoxGeometry(6,8,3),C.CHIP,{pos:[cx+15,cy-6,2.4],cast:false}));
 // terminals: OUT1/2 on the left, OUT3/4 on the right, VS/GND/5V on the bottom right
 const term=(x:number,y:number,n:number):void=>{
  g.add(solid(new BoxGeometry(8,n*5.1,9),TERM,{outline:true,pos:[x,y,5.4]}));
  for(let i=0;i<n;i++){
   g.add(solid(new CylinderGeometry(1.7,1.7,0.9,14),C.SILVER,{rot:[HALF_PI,0,0],pos:[x,y+(i-(n-1)/2)*5.1,10.2],finish:'metal'}));
  }
 };
 term(cx-bw/2+4.2,cy+7,2);term(cx+bw/2-4.2,cy+7,2);term(cx+bw/2-4.2,cy-13,3);
 label(g,'OUT1  OUT2',12,2.4,cx-bw/2+7,cy+16,1);label(g,'OUT3  OUT4',12,2.4,cx+bw/2-7,cy+16,1);
 label(g,'ENA IN1 IN2 IN3 IN4 ENB',19,2.4,cx,py+3,0.9);
 label(g,'L298N',9,3,hx,cy-3,0.95);
 // output activity LEDs (not on the real board): glow green = forward, amber = reverse
 const mkLed=(x:number):{mat:ReturnType<typeof ownToon>;mesh:Mesh}=>{
  const mat=ownToon(0x2a3a30); // ds-allow-hex  (unlit indicator)
  const mesh=new Mesh(new BoxGeometry(5,1.6,1),mat);mesh.position.set(x,cy+19.5,1.4);g.add(mesh);
  return {mat,mesh};
 };
 const la=mkLed(cx-bw/2+7),lb=mkLed(cx+bw/2-7);
 const paint=(l:{mat:ReturnType<typeof ownToon>},v:number,mode:string):void=>{
  const mag=Math.min(1,Math.abs(v)/8);
  const col=mode==='brake'?C.RED_ALERT:v>=0?C.LIVE:C.PWM;
  l.mat.color.setHex(mag>0.02||mode==='brake'?col:0x2a3a30); // ds-allow-hex
  l.mat.emissive.setHex(col);l.mat.emissiveIntensity=mode==='brake'?0.9:mag>0.02?0.5+2*mag:0;
 };
 return {
  apply(s){
   const st=extState<L298nState>(s,'l298n');
   if(!st)return;
   paint(la,st.outAV,st.modeA);paint(lb,st.outBV,st.modeB);
  },
 };
}

export const l298n=definePart({
 kind:'l298n',name:c('L298N motor driver','Driver motor L298N'),
 pins:{
  ENA:pin([0,0,0],'input','ENA (enable A / PWM)','ENA (aktif A / PWM)'),IN1:pin([PITCH,0,0],'input','IN1','IN1'),IN2:pin([2*PITCH,0,0],'input','IN2','IN2'),
  IN3:pin([3*PITCH,0,0],'input','IN3','IN3'),IN4:pin([4*PITCH,0,0],'input','IN4','IN4'),ENB:pin([5*PITCH,0,0],'input','ENB (enable B / PWM)','ENB (aktif B / PWM)'),
  GND:pin([6*PITCH,0,0],'ground','Ground','Ground'),
  // screw terminals (the same positions buildL298 draws: left OUT1/OUT2, right OUT3/OUT4, bottom right VS and 5V)
  OUT1:pin([TL,TY+4.45,TZ],'output','OUT1 (motor A)','OUT1 (motor A)'),OUT2:pin([TL,TY+9.55,TZ],'output','OUT2 (motor A)','OUT2 (motor A)'),
  OUT3:pin([TR,TY+4.45,TZ],'output','OUT3 (motor B)','OUT3 (motor B)'),OUT4:pin([TR,TY+9.55,TZ],'output','OUT4 (motor B)','OUT4 (motor B)'),
  VS:pin([TR,TY-18.1,TZ],'power','VS (motor supply)','VS (catu motor)'),V5:pin([TR,TY-7.9,TZ],'power','5V (logic)','5V (logik)'),
 },
 callouts:[
  callout('sink',[3*PITCH,32,20],'Heat sink: the bridge wastes about 2 V','Heat sink: jembatan membuang sekitar 2 V'),
  callout('out',[-4,34,4],'OUT1/OUT2 to motor A; the bar glows with its power','OUT1/OUT2 ke motor A; batang menyala sesuai dayanya'),
 ],
 make:buildL298,
});
