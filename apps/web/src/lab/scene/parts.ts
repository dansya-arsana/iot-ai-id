import {AdditiveBlending,BackSide,Box3,BoxGeometry,BufferAttribute,BufferGeometry,CapsuleGeometry,Color,ConeGeometry,CylinderGeometry,DoubleSide,Group,LatheGeometry,Line,LineDashedMaterial,Mesh,MeshBasicMaterial,MeshStandardMaterial,PlaneGeometry,Sprite,SpriteMaterial,TorusGeometry,Vector2,Vector3,type CanvasTexture} from 'three';
import {RoundedBoxGeometry} from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';
import type {LedColor,PartKind,PartProps,PartSpec,PartState} from '../contract';
import {MOTOR_MAX_RPM,PART_PINS} from '../contract';
import {PITCH,PIN_COLS,isOnBoardKind,obstacleMm,lampMm,resistorBands} from './layout';
import {addOutline,canvasTexture,disposeObject,glowTexture,ownToon,ringTexture,solid} from './materials';
import {contactShadow} from './decals';
import {contentBox} from './bounds';
import * as C from './palette';

export type Interactive='press'|'rotate'|'slide-x'|'slide-z'|'toggle-slide';
export interface PartView{
 group:Group;
 pinAnchor(pin:string):Vector3;
 apply(state:PartState,dtMs:number):void;
 setProps(p:PartProps):void;
 interactive?:Interactive;
}
interface Inner{apply(s:PartState,dt:number):void;anchors?:Record<string,[number,number,number]>;interactive?:Interactive}
type Builder=(props:PartProps,g:Group)=>Inner;

const noop=():void=>undefined;
const clamp01=(v:number):number=>Math.min(1,Math.max(0,v));
const HALF_PI=Math.PI/2;
const hex=(n:number):string=>'#'+n.toString(16).padStart(6,'0');
const MONO='"IBM Plex Mono", ui-monospace, monospace';
const sprite=(map:CanvasTexture,color:number,size:number,y:number,x=0,additive=true):Sprite=>{
 const m=new SpriteMaterial({map,color,transparent:true,blending:additive?AdditiveBlending:1,depthWrite:false,opacity:0});
 m.userData.own=true;
 const s=new Sprite(m);s.scale.set(size,size,1);s.position.set(x,y,0);s.userData.noPick=true;s.renderOrder=3;
 return s;
};
/** 0.6mm metal lead, visible above the board. */
const leg=(x:number,h:number,z=0):Mesh=>solid(new BoxGeometry(0.6,h,0.6),C.SILVER,{pos:[x,h/2,z],cast:false,finish:'metal'});
const num=(v:unknown,d:number):number=>typeof v==='number'?v:d;
const pool=(color:number,x:number):Mesh=>{
 const m=new Mesh(new PlaneGeometry(40,40),new MeshBasicMaterial({map:glowTexture(),color,transparent:true,opacity:0,depthWrite:false,toneMapped:false}));
 m.material.userData.own=true;m.rotation.x=-HALF_PI;m.position.set(x,0.08,0);m.userData.noPick=true;m.userData.noInk=true;m.renderOrder=1;return m;
};

// ---------- LED family ----------
function domeGeo():LatheGeometry{
 const pts=[[0,2.6],[3.9,2.6],[3.9,3.4],[3.6,3.4],[3.6,9.6],[3.2,11.4],[2.2,12.5],[1.1,12.95],[0,13]].map(([r,y])=>new Vector2(r!,y!));
 return new LatheGeometry(pts,32);
}
const ledBright=(duty:number):number=>Math.sqrt(clamp01(duty));
function buildLed(props:PartProps,g:Group):Inner{
 const color=(typeof props.color==='string'&&props.color in C.LED_COLOR?props.color:'red') as LedColor;
 const full=new Color(C.LED_COLOR[color]),dim=new Color(C.LED_DIM[color]);
 const cx=PITCH/2;
 const mat=ownToon(C.LED_DIM[color],'epoxy');
 const dome=new Mesh(domeGeo(),mat);dome.position.x=cx;dome.castShadow=true;
 g.add(dome);addOutline(dome);
 const die=solid(new BoxGeometry(1.6,1.4,1.6),C.SILVER_DARK,{pos:[cx,5.2,0],cast:false,finish:'metal'});g.add(die);
 g.add(leg(0,3.2),leg(PITCH,2.6));
 const halo=sprite(glowTexture(),C.LED_COLOR[color],24,9,cx,false);
 const warn=sprite(glowTexture(),C.RED_ALERT,14,10,cx);
 const pl=pool(C.LED_COLOR[color],cx);
 g.add(halo,warn,pl);
 let t=0;
 return {
  anchors:{A:[0,0,0],C:[PITCH,0,0]},
  apply(s,dt){
   if(s.kind!=='led')return;
   t+=dt;
   const b=s.on?ledBright(s.brightness):0;
   mat.color.copy(dim).lerp(full,b);mat.emissive.copy(full);mat.emissiveIntensity=b>0.001?0.4+2.2*b:0;
   halo.material.opacity=b*0.7;halo.scale.setScalar(10+22*b);
   (pl.material as MeshBasicMaterial).opacity=0.45*b;
   warn.material.opacity=s.overCurrent?0.35+0.45*Math.sin(t*0.02):0;
  },
 };
}

function buildRgb(_p:PartProps,g:Group):Inner{
 const cx=1.5*PITCH;
 const mat=ownToon(C.LED_DIM.white,'epoxy');
 const dome=new Mesh(domeGeo(),mat);dome.position.x=cx;dome.castShadow=true;g.add(dome);addOutline(dome);
 for(let i=0;i<4;i++)g.add(leg(i*PITCH,[2.6,3.6,2.8,3.2][i]!));
 const halo=sprite(glowTexture(),C.WHITE,24,9,cx,false);g.add(halo);
 const pl=pool(C.WHITE,cx);g.add(pl);
 return {
  anchors:{R:[0,0,0],G:[PITCH,0,0],B:[2*PITCH,0,0],K:[3*PITCH,0,0]},
  apply(s){
   if(s.kind!=='rgb-led')return;
   const r=ledBright(s.r),gg=ledBright(s.g),b=ledBright(s.b),m=Math.max(r,gg,b);
   // hue-preserving mix: normalise by the brightest channel and push saturation so tone mapping keeps the colour (no white-out)
   const k=m>0.001?1/m:0,sr=(r*k)**1.7,sg=(gg*k)**1.7,sb=(b*k)**1.7;
   if(m>0.001)mat.color.setRGB(0.1+0.75*sr*m,0.1+0.75*sg*m,0.1+0.75*sb*m);else mat.color.set(C.LED_DIM.white);
   mat.emissive.setRGB(sr*0.5,sg*0.5,sb*0.5);mat.emissiveIntensity=m>0.001?0.4+2.2*m:0;
   halo.material.color.setRGB(sr,sg,sb);halo.material.opacity=m*0.6;halo.scale.setScalar(10+22*m);
   (pl.material as MeshBasicMaterial).color.setRGB(sr,sg,sb);(pl.material as MeshBasicMaterial).opacity=0.45*m;
  },
 };
}

// ---------- passives ----------
function bandTexture(bands:number[]):CanvasTexture{
 const cv=document.createElement('canvas');cv.width=32;cv.height=256;
 const g=cv.getContext('2d')!;
 g.fillStyle=hex(C.RESISTOR_BODY);g.fillRect(0,0,32,256);
 const at=[0.28,0.4,0.52,0.74];
 bands.forEach((b,i)=>{g.fillStyle=hex(C.BAND[b]!);g.fillRect(0,at[i]!*256-9,32,18);});
 return canvasTexture(cv);
}
function buildResistor(props:PartProps,g:Group):Inner{
 const ohms=num(props.ohms,220);
 const bands=resistorBands(ohms);
 const span=3*PITCH,cx=span/2,y=4.3;
 g.add(leg(0,y),leg(span,y));
 const mat=ownToon(C.RESISTOR_BODY);mat.map=bandTexture(bands);mat.userData.ownMap=true;
 const body=new Mesh(new CapsuleGeometry(2.3,span-1.2,8,28),mat);
 body.rotation.z=HALF_PI;body.position.set(cx,y,0);body.castShadow=true;body.receiveShadow=true;
 g.add(body);addOutline(body);
 return {anchors:{'1':[0,0,0],'2':[span,0,0]},apply:noop};
}
function buildDiode(_p:PartProps,g:Group):Inner{
 const span=3*PITCH,cx=span/2,y=3.8;
 g.add(leg(0,y),leg(span,y));
 g.add(solid(new CylinderGeometry(1.9,1.9,span-1.6,24),C.DIODE_BODY,{outline:true,rot:[0,0,HALF_PI],pos:[cx,y,0]}));
 g.add(solid(new CylinderGeometry(1.96,1.96,0.9,24),C.SILVER,{rot:[0,0,HALF_PI],pos:[span-1.6,y,0],cast:false,finish:'metal'}));
 return {anchors:{A:[0,0,0],K:[span,0,0]},apply:noop};
}
function buildButton(_p:PartProps,g:Group):Inner{
 const cx=PITCH;
 g.add(solid(new RoundedBoxGeometry(7,3.8,7,3,0.5),C.HEADER_BLACK,{outline:true,pos:[cx,0.9+1.9,0]}));
 for(const sx of [-1,1])for(const sz of [-1,1])g.add(leg(cx+sx*3.5,2.4,sz*2.4));
 g.add(leg(0,1.4),leg(2*PITCH,1.4));
 const cap=solid(new CylinderGeometry(2.6,2.6,2.4,28),C.BUTTON_CAP,{outline:true,pos:[cx,0.9+3.8+1.2,0]});
 g.add(cap);
 const y0=cap.position.y;let cur=0;
 return {
  interactive:'press',anchors:{'1':[0,0,0],'2':[2*PITCH,0,0]},
  apply(s,dt){
   if(s.kind!=='button')return;
   cur+=((s.pressed?1:0)-cur)*Math.min(1,dt/35);
   cap.position.y=y0-0.7*cur;
  },
 };
}
function buildPot(_p:PartProps,g:Group):Inner{
 const cx=PITCH;
 g.add(solid(new RoundedBoxGeometry(13,6,13,3,0.6),C.POT_BLUE,{outline:true,pos:[cx,3.6,0]}));
 g.add(leg(0,2),leg(PITCH,2),leg(2*PITCH,2));
 g.add(solid(new CylinderGeometry(5.6,5.6,1.2,32),C.HEADER_BLACK,{pos:[cx,6.8,0],cast:false}));
 const knob=new Group();knob.position.set(cx,7.4,0);g.add(knob);
 knob.add(solid(new CylinderGeometry(5,5,5.2,32),C.KNOB,{pos:[0,2.6,0]}));
 for(let i=0;i<24;i++){
  const a=(i/24)*Math.PI*2;
  knob.add(solid(new BoxGeometry(0.7,5.0,0.9),C.KNOB,{pos:[Math.sin(a)*5.0,2.6,Math.cos(a)*5.0],rot:[0,a,0],cast:false}));
 }
 knob.add(solid(new CylinderGeometry(4.4,4.4,0.3,32),C.CREAM_DARK,{pos:[0,5.3,0],cast:false}));
 knob.add(solid(new BoxGeometry(0.9,0.4,4.2),C.WHITE,{pos:[0,5.5,-1.9],cast:false}));
 addOutline(knob.children[0] as Mesh);
 return {
  interactive:'rotate',anchors:{VCC:[0,0,0],SIG:[PITCH,0,0],GND:[2*PITCH,0,0]},
  apply(s){
   if(s.kind!=='potentiometer')return;
   knob.rotation.y=-((clamp01(s.value/1023)*270-135)*Math.PI)/180;
  },
 };
}
let squiggle:CanvasTexture|null=null;
function squiggleTex():CanvasTexture{
 if(squiggle)return squiggle;
 const cv=document.createElement('canvas');cv.width=256;cv.height=256;
 const g=cv.getContext('2d')!;
 g.fillStyle=hex(C.LDR_DISC);g.fillRect(0,0,256,256);
 g.strokeStyle=hex(C.LDR_TRACK);g.lineWidth=14;g.lineJoin='round';
 g.beginPath();g.moveTo(44,48);
 for(let i=0;i<5;i++){g.lineTo(212,48+i*40+16);g.lineTo(44,48+i*40+36);}
 g.stroke();
 squiggle=canvasTexture(cv);
 return squiggle;
}
function buildLdr(_p:PartProps,g:Group):Inner{
 const cx=PITCH;
 g.add(leg(0,3),leg(2*PITCH,3));
 g.add(solid(new CylinderGeometry(3.3,3.3,1.8,32),C.LDR_DISC,{outline:true,pos:[cx,3.9,0]}));
 const top=new Mesh(new CylinderGeometry(2.9,2.9,0.05,32),new MeshBasicMaterial({map:squiggleTex(),toneMapped:false}));
 top.material.userData.own=true;
 top.position.set(cx,4.84,0);top.userData.noPick=true;g.add(top);
 return {anchors:{A:[0,0,0],B:[2*PITCH,0,0]},apply:noop};
}
function buildBuzzer(_p:PartProps,g:Group):Inner{
 const cx=1.5*PITCH;
 g.add(leg(0,2),leg(3*PITCH,2));
 g.add(solid(new CylinderGeometry(6.6,6.6,9,40),C.BUZZER_BLACK,{outline:true,pos:[cx,4.5+1,0]}));
 g.add(solid(new CylinderGeometry(1.2,1.2,0.2,16),C.HOLE,{pos:[cx,10.55,0],cast:false}));
 g.add(solid(new BoxGeometry(1.8,0.1,0.9),C.GOLD,{pos:[cx-4.3,10.55,0],cast:false,finish:'gold'}));
 const rings=[0,1].map(()=>sprite(ringTexture(),C.LIVE,10,11,cx,false));
 rings.forEach(r=>g.add(r));
 let t=0;
 return {
  anchors:{'+':[0,0,0],'-':[3*PITCH,0,0]},
  apply(s,dt){
   if(s.kind!=='buzzer')return;
   t+=dt;
   rings.forEach((r,i)=>{
    if(!s.on){r.material.opacity=0;return;}
    const ph=(t/650+i*0.5)%1;
    r.scale.setScalar(12+26*ph);r.material.opacity=(1-ph)*0.8;
   });
  },
 };
}
function buildTransistor(_p:PartProps,g:Group):Inner{
 const cx=PITCH;
 g.add(leg(0,8),leg(PITCH,8),leg(2*PITCH,8));
 g.add(solid(new BoxGeometry(10,9,4.4),C.CHIP,{outline:true,edges:true,pos:[cx,12.5,0]}));
 g.add(solid(new BoxGeometry(10,6.5,1.2),C.SILVER,{outline:true,pos:[cx,19.3,-1.6],finish:'metal'}));
 g.add(solid(new CylinderGeometry(1.7,1.7,1.4,16),C.HOLE,{rot:[HALF_PI,0,0],pos:[cx,20.5,-1.6],cast:false}));
 return {anchors:{B:[0,0,0],C:[PITCH,0,0],E:[2*PITCH,0,0]},apply:noop};
}

// ---------- sensors and props ----------
function grilleTex():CanvasTexture{
 const cv=document.createElement('canvas');cv.width=cv.height=256;
 const g=cv.getContext('2d')!;
 g.fillStyle=hex(C.CHIP);g.fillRect(0,0,256,256);
 g.strokeStyle='#3a3d44';g.lineWidth=2;
 for(let r=14;r<128;r+=12){g.beginPath();g.arc(128,128,r,0,Math.PI*2);g.stroke();}
 g.fillStyle=hex(C.SILVER);g.beginPath();g.arc(128,128,10,0,Math.PI*2);g.fill();
 return canvasTexture(cv);
}
function sonarPrint():CanvasTexture{
 const cv=document.createElement('canvas');cv.width=512;cv.height=256;
 const g=cv.getContext('2d')!;
 g.fillStyle='#ffffff';g.textAlign='center';g.textBaseline='middle';
 g.font=`600 60px ${MONO}`;g.fillText('HC-SR04',256,80);
 g.font=`500 40px ${MONO}`;
 ['VCC','TRIG','ECHO','GND'].forEach((t,i)=>g.fillText(t,64+i*128,210));
 return canvasTexture(cv);
}
function buildSonar(_p:PartProps,g:Group):Inner{
 const cx=1.5*PITCH,py=14.5;
 for(let i=0;i<4;i++)g.add(leg(i*PITCH,4.6));
 g.add(solid(new BoxGeometry(45,20,1.6),C.SONAR_PCB,{outline:true,edges:true,pos:[cx,py,0]}));
 const grille=grilleTex();
 for(const sx of [-1,1]){
  g.add(solid(new CylinderGeometry(8,8,12,40),C.SILVER,{outline:true,rot:[HALF_PI,0,0],pos:[cx+sx*12,py,6.8],finish:'metal'}));
  const face=new Mesh(new PlaneGeometry(12.4,12.4),new MeshBasicMaterial({map:grille,toneMapped:false}));
  face.material.userData.own=true;face.position.set(cx+sx*12,py,12.82);face.userData.noPick=true;face.userData.noInk=true;g.add(face);
 }
 const print=new Mesh(new PlaneGeometry(16,8),new MeshBasicMaterial({map:sonarPrint(),transparent:true,toneMapped:false,depthWrite:false}));
 print.material.userData.own=true;print.material.userData.ownMap=true;print.position.set(cx,py-2.6,0.83);print.userData.noPick=true;print.userData.noInk=true;g.add(print);
 g.add(solid(new BoxGeometry(6,4,2),C.SILVER_DARK,{pos:[cx,py+6.5,1.6],cast:false,finish:'metal'}));
 const rings=[0,1,2].map(()=>{
  const m=new Mesh(new TorusGeometry(9,0.55,6,32,Math.PI*1.1),new MeshBasicMaterial({color:C.LIVE,transparent:true,opacity:0,depthWrite:false}));
  m.material.userData.own=true;m.position.set(cx,py,13);m.rotation.z=Math.PI*0.45;m.userData.noPick=true;m.userData.noInk=true;m.visible=false;g.add(m);return m;
 });
 let t=0;
 return {
  anchors:{VCC:[0,0,0],TRIG:[PITCH,0,0],ECHO:[2*PITCH,0,0],GND:[3*PITCH,0,0]},
  apply(s,dt){
   if(s.kind!=='hcsr04')return;
   t+=dt;
   const reach=obstacleMm(s.echoCm??120);
   rings.forEach((r,i)=>{
    r.visible=s.pinging;
    if(!s.pinging)return;
    const ph=(t/900+i/3)%1;
    r.position.z=13+ph*reach;r.scale.setScalar(1+ph*1.1);r.material.opacity=0.85*(1-ph);
   });
  },
 };
}
function hatchTex():CanvasTexture{
 const cv=document.createElement('canvas');cv.width=256;cv.height=192;
 const g=cv.getContext('2d')!;
 g.clearRect(0,0,256,192);g.strokeStyle='rgba(10,10,10,0.28)';g.lineWidth=5;
 for(let i=-192;i<256;i+=22){g.beginPath();g.moveTo(i,192);g.lineTo(i+192,0);g.stroke();}
 g.strokeStyle='rgba(10,10,10,0.5)';g.lineWidth=6;g.strokeRect(8,8,240,176);
 return canvasTexture(cv);
}
function buildObstacle(props:PartProps,g:Group):Inner{
 const shape=props.shape==='car'?'car':'box';
 const inner=new Group();g.add(inner);
 if(shape==='box'){
  inner.add(solid(new RoundedBoxGeometry(46,30,14,3,2),C.OBSTACLE_BOX,{outline:true,pos:[0,15,7]}));
  const h=new Mesh(new PlaneGeometry(40,24),new MeshBasicMaterial({map:hatchTex(),transparent:true,toneMapped:false,depthWrite:false}));
  h.material.userData.own=true;h.material.userData.ownMap=true;h.position.set(0,15,-0.04);h.rotation.y=Math.PI;h.userData.noPick=true;h.userData.noInk=true;inner.add(h);
  addShadow(inner,46,14,0.35,6,0,0.03,7);
 }else{
  inner.add(solid(new RoundedBoxGeometry(24,9,46,3,3),C.CAR_BODY,{outline:true,pos:[0,9,23]}));
  inner.add(solid(new RoundedBoxGeometry(20,8,22,3,2.5),C.CAR_BODY,{outline:true,pos:[0,17,27]}));
  inner.add(solid(new BoxGeometry(18.6,5,0.4),C.CAR_GLASS,{pos:[0,17.4,16.0],cast:false,finish:'epoxy'}));
  for(const sx of [-1,1])inner.add(solid(new BoxGeometry(0.4,4.6,16),C.CAR_GLASS,{pos:[sx*10.1,17.4,27],cast:false,finish:'epoxy'}));
  for(const sx of [-1,1]){
   inner.add(solid(new BoxGeometry(3.4,2,0.4),C.LAMP_LIGHT,{pos:[sx*8,10,0.05],cast:false}));
   for(const sz of [10,36]){
    inner.add(solid(new CylinderGeometry(5,5,4,28),C.TIRE,{outline:true,rot:[0,0,HALF_PI],pos:[sx*12.5,5,sz]}));
    inner.add(solid(new CylinderGeometry(2.6,2.6,0.4,20),C.SILVER,{rot:[0,0,HALF_PI],pos:[sx*14.6,5,sz],cast:false,finish:'metal'}));
   }
  }
  addShadow(inner,24,46,0.35,6,0,0.03,23);
 }
 // dashed beam sensor -> obstacle
 const pos=new Float32Array([0,14.5,0,0,14.5,1]);
 const geo=new BufferGeometry();geo.setAttribute('position',new BufferAttribute(pos,3));
 const beam=new Line(geo,new LineDashedMaterial({color:C.LIVE,dashSize:3,gapSize:2.2}));
 beam.material.userData.own=true;beam.userData.noPick=true;beam.userData.noInk=true;g.add(beam);
 let last=-1;
 return {
  interactive:'slide-z',
  apply(s){
   if(s.kind!=='obstacle')return;
   const mm=obstacleMm(s.distanceCm);
   if(mm===last)return;
   last=mm;
   inner.position.z=mm;pos[5]=mm;
   geo.attributes.position!.needsUpdate=true;beam.computeLineDistances();
   geo.computeBoundingSphere();
  },
 };
}
function buildLamp(_p:PartProps,g:Group):Inner{
 const inner=new Group();g.add(inner);
 inner.add(solid(new CylinderGeometry(10,11,3,36),C.LAMP_BODY,{outline:true,pos:[0,1.5,0]}));
 inner.add(solid(new CylinderGeometry(1.6,1.6,34,12),C.SILVER,{outline:true,pos:[0,19,0],finish:'metal'}));
 const head=new Group();head.position.set(0,37,0);head.rotation.z=-0.55;inner.add(head);
 const shadeMat=ownToon(C.LAMP_BODY);shadeMat.side=DoubleSide;
 const shade=new Mesh(new ConeGeometry(11,12,36,1,true),shadeMat);shade.castShadow=true;head.add(shade);addOutline(shade);
 const lit=new MeshStandardMaterial({color:C.LAMP_LIGHT,emissive:C.LAMP_LIGHT,emissiveIntensity:0,side:BackSide,roughness:1});lit.userData.own=true;
 const inside=new Mesh(new ConeGeometry(10.5,11.5,36,1,true),lit);inside.userData.noPick=true;inside.userData.noInk=true;head.add(inside);
 const bulb=new Mesh(new CylinderGeometry(3,3,3,16),ownToon(C.LAMP_LIGHT));bulb.position.set(0,-4,0);head.add(bulb);
 const bulbMat=bulb.material as MeshStandardMaterial;
 const cone=new Mesh(new ConeGeometry(18,38,32,1,true),new MeshBasicMaterial({color:C.LAMP_LIGHT,transparent:true,opacity:0.2,depthWrite:false}));
 cone.material.userData.own=true;cone.position.set(0,-25,0);cone.userData.noPick=true;cone.userData.noInk=true;
 head.add(cone);
 const glow=sprite(glowTexture(),C.LAMP_LIGHT,34,-4,0,false);head.add(glow);
 addShadow(inner,24,24,0.35,6,0,0.03,0);
 const dim=new Color(C.SILVER_DARK),on=new Color(C.LAMP_LIGHT);
 return {
  interactive:'toggle-slide',
  apply(s){
   if(s.kind!=='lamp')return;
   inner.position.x=lampMm(s.distanceCm);
   cone.visible=s.on;glow.material.opacity=s.on?0.7:0;
   lit.emissiveIntensity=s.on?1.6:0;bulbMat.emissive.copy(on);bulbMat.emissiveIntensity=s.on?1.8:0;
   bulbMat.color.copy(s.on?on:dim);
  },
 };
}

function buildMotor(_p:PartProps,g:Group):Inner{
 const y=11.5;
 g.add(solid(new CylinderGeometry(11,11,24,40),C.MOTOR_CAN,{outline:true,rot:[0,0,HALF_PI],pos:[0,y,0],finish:'metal'}));
 g.add(solid(new CylinderGeometry(11.2,11.2,3,40),C.MOTOR_CAP,{rot:[0,0,HALF_PI],pos:[-12,y,0]}));
 g.add(solid(new CylinderGeometry(3.2,3.2,3,20),C.SILVER,{rot:[0,0,HALF_PI],pos:[13.5,y,0],finish:'metal'}));
 g.add(solid(new CylinderGeometry(1.1,1.1,12,12),C.SILVER,{rot:[0,0,HALF_PI],pos:[19,y,0],finish:'metal'}));
 for(const sz of [-1,1])g.add(solid(new BoxGeometry(3,0.4,1.6),C.GOLD,{pos:[-14.5,y,sz*3.2],cast:false,finish:'gold'}));
 const spin=new Group();spin.position.set(24,y,0);g.add(spin);
 for(let i=0;i<3;i++){
  const blade=solid(new BoxGeometry(0.9,9,3.2),C.FAN,{outline:true,pos:[0,4.5,0]});
  const holder=new Group();holder.rotation.x=(i*2*Math.PI)/3;holder.add(blade);spin.add(holder);
 }
 return {
  anchors:{'+':[-14.5,y,3.2],'-':[-14.5,y,-3.2]},
  apply(s,dt){
   if(s.kind!=='motor')return;
   spin.rotation.x+=clamp01(s.rpm/MOTOR_MAX_RPM)*4*2*Math.PI*dt/1000;
  },
 };
}
function buildServo(_p:PartProps,g:Group):Inner{
 g.add(solid(new RoundedBoxGeometry(23,22,12,3,0.8),C.SERVO_BLUE,{outline:true,pos:[0,11,0]}));
 g.add(solid(new BoxGeometry(33,2.2,12),C.SERVO_BLUE,{outline:true,edges:true,pos:[0,17,0]}));
 for(const sx of [-1,1])g.add(solid(new CylinderGeometry(1,1,2.4,10),C.HOLE,{pos:[sx*14,17,0],cast:false}));
 g.add(solid(new CylinderGeometry(3.4,3.4,3,24),C.SERVO_HORN,{pos:[5,23.5,0]}));
 const horn=new Group();horn.position.set(5,25.4,0);g.add(horn);
 horn.add(solid(new BoxGeometry(18,1.6,4.2),C.SERVO_HORN,{outline:true,pos:[8,0,0]}));
 horn.add(solid(new CylinderGeometry(2.6,2.6,1.6,20),C.SERVO_HORN,{outline:true,pos:[0,0,0]}));
 for(let i=0;i<3;i++)g.add(solid(new BoxGeometry(2.4,2.4,2.4),C.HEADER_BLACK,{pos:[-12.4,8,(i-1)*PITCH],cast:false}));
 return {
  anchors:{SIG:[-13.6,8,-PITCH],V:[-13.6,8,0],GND:[-13.6,8,PITCH]},
  apply(s){
   if(s.kind!=='servo')return;
   horn.rotation.y=(s.angleDeg*Math.PI)/180;
  },
 };
}

const BUILDERS:Record<PartKind,Builder>={
 led:buildLed,resistor:buildResistor,button:buildButton,potentiometer:buildPot,'rgb-led':buildRgb,ldr:buildLdr,lamp:buildLamp,
 hcsr04:buildSonar,obstacle:buildObstacle,buzzer:buildBuzzer,transistor:buildTransistor,diode:buildDiode,motor:buildMotor,servo:buildServo,
};

const fp=new Box3();
function addShadow(g:Group,w:number,d:number,a:number,pad:number,x:number,y:number,z:number):void{
 const m=contactShadow(w,d,a,pad);m.position.set(x,y,z);g.add(m);
}
function addBlob(group:Group,kind:PartKind):void{
 if(!isOnBoardKind(kind)&&kind!=='motor'&&kind!=='servo')return;
 contentBox([group],fp);if(fp.isEmpty())return;
 const w=fp.max.x-fp.min.x,d=fp.max.z-fp.min.z;
 const s=contactShadow(w,d,0.25,kind==='motor'||kind==='servo'?5:2.5);
 s.position.set((fp.min.x+fp.max.x)/2,0.03,(fp.min.z+fp.max.z)/2);s.userData.blob=true;
 group.add(s);
}

export function buildPart(spec:PartSpec):PartView{
 const group=new Group();group.name=spec.id;group.userData.targetId=spec.id;
 let props:PartProps={...spec.props};
 let inner=BUILDERS[spec.kind](props,group);
 addBlob(group,spec.kind);
 const view:PartView={
  group,
  interactive:inner.interactive,
  pinAnchor(pin){
   const a=inner.anchors?.[pin];
   if(a)return new Vector3(a[0],a[1],a[2]);
   const i=PART_PINS[spec.kind].indexOf(pin);
   const cols=PIN_COLS[spec.kind];
   return new Vector3(i>=0&&cols?cols[i]!*PITCH:0,0,0);
  },
  apply(s,dt){inner.apply(s,dt);},
  setProps(p){
   props={...props,...p};
   for(const c of [...group.children]){group.remove(c);disposeObject(c);}
   inner=BUILDERS[spec.kind](props,group);view.interactive=inner.interactive;addBlob(group,spec.kind);
  },
 };
 return view;
}

