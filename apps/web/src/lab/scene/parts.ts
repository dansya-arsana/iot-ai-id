import {AdditiveBlending,BoxGeometry,BufferAttribute,BufferGeometry,CapsuleGeometry,Color,ConeGeometry,CylinderGeometry,Group,LatheGeometry,Line,LineDashedMaterial,Mesh,MeshBasicMaterial,MeshToonMaterial,Sprite,SpriteMaterial,TorusGeometry,Vector2,Vector3,CanvasTexture,SRGBColorSpace} from 'three';
import type {LedColor,PartKind,PartProps,PartSpec,PartState} from '../contract';
import {MOTOR_MAX_RPM,PART_PINS} from '../contract';
import {PITCH,PIN_COLS,lampMm,obstacleMm,resistorBands} from './layout';
import {addOutline,disposeObject,glowTexture,ownToon,ringTexture,solid} from './materials';
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
const sprite=(map:CanvasTexture,color:number,size:number,y:number,x=0):Sprite=>{
 const m=new SpriteMaterial({map,color,transparent:true,blending:AdditiveBlending,depthWrite:false,opacity:0});
 m.userData.own=true;
 const s=new Sprite(m);s.scale.set(size,size,1);s.position.set(x,y,0);s.userData.noPick=true;s.renderOrder=3;
 return s;
};
const leg=(x:number,h:number,z=0,color:number=C.SILVER):Mesh=>solid(new BoxGeometry(0.55,h,0.55),color,{pos:[x,h/2,z],cast:false});
const num=(v:unknown,d:number):number=>typeof v==='number'?v:d;

// ---------- LED family ----------
function domeGeo():LatheGeometry{
 const pts=[[0,3],[3,3],[3,3.8],[2.5,3.8],[2.5,8],[2.2,9.2],[1.5,10.1],[0.7,10.6],[0,10.8]].map(([r,y])=>new Vector2(r!,y!));
 return new LatheGeometry(pts,24);
}
function buildLed(props:PartProps,g:Group):Inner{
 const color=(typeof props.color==='string'&&props.color in C.LED_COLOR?props.color:'red') as LedColor;
 const full=new Color(C.LED_COLOR[color]),dim=new Color(C.LED_DIM[color]);
 const cx=PITCH/2;
 const mat=ownToon(C.LED_DIM[color]);
 const dome=new Mesh(domeGeo(),mat);dome.position.x=cx;dome.castShadow=true;
 g.add(dome);
 addOutline(dome,0.35);
 g.add(leg(0,3.2),leg(PITCH,2.6));
 const glow=sprite(glowTexture(),C.LED_COLOR[color],24,8,cx);
 const pulse=sprite(glowTexture(),C.RED_ALERT,14,9,cx);
 g.add(glow,pulse);
 let t=0;
 return {
  anchors:{A:[0,0,0],C:[PITCH,0,0]},
  apply(s,dt){
   if(s.kind!=='led')return;
   t+=dt;
   const b=s.on?clamp01(s.brightness):0;
   mat.color.copy(dim).lerp(full,b);mat.emissive.copy(full).multiplyScalar(b*0.85);
   glow.material.opacity=b*0.9;glow.scale.setScalar(12+18*b);
   pulse.material.opacity=s.overCurrent?0.35+0.45*Math.sin(t*0.02):0;
  },
 };
}

function buildRgb(_p:PartProps,g:Group):Inner{
 const cx=1.5*PITCH;
 const mat=ownToon(C.LED_DIM.white);
 const dome=new Mesh(domeGeo(),mat);dome.position.x=cx;dome.castShadow=true;g.add(dome);addOutline(dome,0.35);
 for(let i=0;i<4;i++)g.add(leg(i*PITCH,i===3?3.4:2.6));
 const glow=sprite(glowTexture(),C.WHITE,24,8,cx);g.add(glow);
 return {
  anchors:{R:[0,0,0],G:[PITCH,0,0],B:[2*PITCH,0,0],K:[3*PITCH,0,0]},
  apply(s){
   if(s.kind!=='rgb-led')return;
   const r=clamp01(s.r),gg=clamp01(s.g),b=clamp01(s.b),m=Math.max(r,gg,b);
   mat.color.setRGB(0.28+0.72*r,0.28+0.72*gg,0.28+0.72*b);
   mat.emissive.setRGB(r*0.85,gg*0.85,b*0.85);
   glow.material.color.setRGB(r,gg,b);glow.material.opacity=m*0.9;glow.scale.setScalar(12+18*m);
  },
 };
}

// ---------- passives ----------
function buildResistor(props:PartProps,g:Group):Inner{
 const ohms=num(props.ohms,220);
 const bands=resistorBands(ohms);
 const span=3*PITCH,cx=span/2,y=4.3;
 g.add(leg(0,y),leg(span,y));
 g.add(solid(new CapsuleGeometry(1.8,span-3.6-0.4,4,16),C.RESISTOR_BODY,{outline:0.35,rot:[0,0,HALF_PI],pos:[cx,y,0]}));
 const xs=[-2.2,-0.9,0.4,2.4];
 bands.forEach((b,i)=>{
  g.add(solid(new CylinderGeometry(1.86,1.86,0.55,16),C.BAND[b]!,{rot:[0,0,HALF_PI],pos:[cx+xs[i]!,y,0],cast:false}));
 });
 return {anchors:{'1':[0,0,0],'2':[span,0,0]},apply:noop};
}
function buildDiode(_p:PartProps,g:Group):Inner{
 const span=3*PITCH,cx=span/2,y=3.8;
 g.add(leg(0,y),leg(span,y));
 g.add(solid(new CylinderGeometry(1.5,1.5,span-1.6,16),C.DIODE_BODY,{outline:0.35,rot:[0,0,HALF_PI],pos:[cx,y,0]}));
 g.add(solid(new CylinderGeometry(1.56,1.56,0.7,16),C.SILVER,{rot:[0,0,HALF_PI],pos:[span-1.6,y,0],cast:false}));
 return {anchors:{A:[0,0,0],K:[span,0,0]},apply:noop};
}
function buildButton(_p:PartProps,g:Group):Inner{
 const cx=PITCH;
 g.add(solid(new BoxGeometry(6,3.4,6),C.HEADER_BLACK,{outline:0.4,pos:[cx,0.9+1.7,0]}));
 for(const sx of [-1,1])for(const sz of [-1,1])g.add(leg(cx+sx*3.0,2.4,sz*2.2));
 g.add(leg(0,1.4),leg(2*PITCH,1.4));
 const cap=solid(new CylinderGeometry(1.9,1.9,2.2,20),C.BUTTON_CAP,{outline:0.35,pos:[cx,0.9+3.4+1.1,0]});
 g.add(cap);
 const y0=cap.position.y;let cur=0;
 return {
  interactive:'press',anchors:{'1':[0,0,0],'2':[2*PITCH,0,0]},
  apply(s,dt){
   if(s.kind!=='button')return;
   cur+=((s.pressed?1:0)-cur)*Math.min(1,dt/35);
   cap.position.y=y0-0.6*cur;
  },
 };
}
function buildPot(_p:PartProps,g:Group):Inner{
 const cx=PITCH;
 g.add(solid(new BoxGeometry(12,6,12),C.POT_BLUE,{outline:0.45,pos:[cx,3.6,0]}));
 g.add(leg(0,2),leg(PITCH,2),leg(2*PITCH,2));
 const knob=new Group();knob.position.set(cx,6.6,0);g.add(knob);
 knob.add(solid(new CylinderGeometry(4.6,4.6,5,28),C.KNOB,{outline:0.4,pos:[0,2.5,0]}));
 knob.add(solid(new BoxGeometry(1,0.5,4.2),C.TEAL,{pos:[0,5.1,-1.9],cast:false}));
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
 const cv=document.createElement('canvas');cv.width=128;cv.height=128;
 const g=cv.getContext('2d')!;
 g.fillStyle='#d8b078';g.fillRect(0,0,128,128); // ds-allow-hex
 g.strokeStyle='#7b5a2e';g.lineWidth=7;g.lineJoin='round'; // ds-allow-hex
 g.beginPath();g.moveTo(22,24);
 for(let i=0;i<5;i++){g.lineTo(106,24+i*20+8);g.lineTo(22,24+i*20+18);}
 g.stroke();
 squiggle=new CanvasTexture(cv);squiggle.colorSpace=SRGBColorSpace;
 return squiggle;
}
function buildLdr(_p:PartProps,g:Group):Inner{
 const cx=PITCH;
 g.add(leg(0,3),leg(2*PITCH,3));
 const disc=solid(new CylinderGeometry(2.7,2.7,1.8,28),C.LDR_DISC,{outline:0.35,pos:[cx,3.9,0]});
 g.add(disc);
 const top=new Mesh(new CylinderGeometry(2.3,2.3,0.05,28),new MeshBasicMaterial({map:squiggleTex(),transparent:false}));
 top.material.userData.own=true;
 top.position.set(cx,4.84,0);top.userData.noPick=true;g.add(top);
 return {anchors:{A:[0,0,0],B:[2*PITCH,0,0]},apply:noop};
}
function buildBuzzer(_p:PartProps,g:Group):Inner{
 const cx=1.5*PITCH;
 g.add(leg(0,2),leg(3*PITCH,2));
 g.add(solid(new CylinderGeometry(6,6,8.6,32),C.BUZZER_BLACK,{outline:0.45,pos:[cx,4.3+1,0]}));
 g.add(solid(new CylinderGeometry(1.1,1.1,0.2,12),C.HOLE,{pos:[cx,9.95,0],cast:false}));
 g.add(solid(new BoxGeometry(1.4,0.1,0.8),C.GOLD,{pos:[cx-4,9.95,0],cast:false}));
 const rings=[0,1].map(()=>sprite(ringTexture(),C.TEAL_LIGHT,10,10.5,cx));
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
 g.add(solid(new BoxGeometry(10,9,4.4),C.CHIP,{outline:0.4,pos:[cx,12.5,0]}));
 g.add(solid(new BoxGeometry(10,6.5,1.2),C.SILVER,{outline:0.35,pos:[cx,19.3,-1.6]}));
 g.add(solid(new CylinderGeometry(1.7,1.7,1.4,16),C.HOLE,{rot:[HALF_PI,0,0],pos:[cx,20.5,-1.6],cast:false}));
 return {anchors:{B:[0,0,0],C:[PITCH,0,0],E:[2*PITCH,0,0]},apply:noop};
}

// ---------- sensors and props ----------
function buildSonar(_p:PartProps,g:Group):Inner{
 const cx=1.5*PITCH,py=14.5;
 for(let i=0;i<4;i++)g.add(leg(i*PITCH,4.6));
 g.add(solid(new BoxGeometry(45,20,1.6),C.SONAR_PCB,{outline:0.45,pos:[cx,py,0]}));
 for(const sx of [-1,1]){
  g.add(solid(new CylinderGeometry(8,8,12,32),C.SILVER,{outline:0.45,rot:[HALF_PI,0,0],pos:[cx+sx*12,py,6.8]}));
  g.add(solid(new CylinderGeometry(6.4,6.4,0.4,32),C.CHIP,{rot:[HALF_PI,0,0],pos:[cx+sx*12,py,12.9],cast:false}));
 }
 g.add(solid(new BoxGeometry(6,4,2),C.SILVER_DARK,{pos:[cx,py-2,1.6],cast:false}));
 const rings=[0,1,2].map(()=>{
  const m=new Mesh(new TorusGeometry(9,0.55,6,32,Math.PI*1.1),new MeshBasicMaterial({color:C.TEAL,transparent:true,opacity:0,depthWrite:false}));
  m.material.userData.own=true;m.position.set(cx,py,13);m.rotation.z=Math.PI*0.45;m.userData.noPick=true;m.visible=false;g.add(m);return m;
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
function buildObstacle(props:PartProps,g:Group):Inner{
 const shape=props.shape==='car'?'car':'box';
 const inner=new Group();g.add(inner);
 if(shape==='box'){
  inner.add(solid(new BoxGeometry(46,30,14),C.OBSTACLE_BOX,{outline:0.5,pos:[0,15,7]}));
 }else{
  inner.add(solid(new BoxGeometry(24,9,46),C.CAR_BODY,{outline:0.5,pos:[0,9,23]}));
  inner.add(solid(new BoxGeometry(20,8,22),C.CAR_GLASS,{outline:0.45,pos:[0,17.5,26]}));
  for(const sx of [-1,1])for(const sz of [10,36])inner.add(solid(new CylinderGeometry(5,5,4,20),C.TIRE,{outline:0.35,rot:[0,0,HALF_PI],pos:[sx*12.5,5,sz]}));
 }
 // dashed beam sensor -> obstacle
 const pos=new Float32Array([0,14.5,0,0,14.5,1]);
 const geo=new BufferGeometry();geo.setAttribute('position',new BufferAttribute(pos,3));
 const beam=new Line(geo,new LineDashedMaterial({color:C.TEAL,dashSize:3,gapSize:2.2}));
 beam.material.userData.own=true;beam.userData.noPick=true;g.add(beam);
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
 inner.add(solid(new CylinderGeometry(10,11,3,28),C.LAMP_BODY,{outline:0.5,pos:[0,1.5,0]}));
 inner.add(solid(new CylinderGeometry(1.6,1.6,34,12),C.SILVER,{outline:0.35,pos:[0,19,0]}));
 const head=new Group();head.position.set(0,37,0);head.rotation.z=-0.55;inner.add(head);
 const shade=new Mesh(new ConeGeometry(11,12,28,1,true),ownToonDouble());shade.castShadow=true;head.add(shade);
 const bulb=new Mesh(new CylinderGeometry(3,3,3,16),ownToon(C.LAMP_LIGHT));bulb.position.set(0,-4,0);head.add(bulb);
 const bulbMat=bulb.material as MeshToonMaterial;
 const cone=new Mesh(new ConeGeometry(18,38,32,1,true),new MeshBasicMaterial({color:C.LAMP_LIGHT,transparent:true,opacity:0.2,depthWrite:false,blending:AdditiveBlending}));
 cone.material.userData.own=true;cone.position.set(0,-25,0);cone.userData.noPick=true;
 head.add(cone);
 const glow=sprite(glowTexture(),C.LAMP_LIGHT,34,-4);head.add(glow);
 const dim=new Color(C.SILVER_DARK),lit=new Color(C.LAMP_LIGHT);
 return {
  interactive:'toggle-slide',
  apply(s){
   if(s.kind!=='lamp')return;
   inner.position.x=lampMm(s.distanceCm);
   cone.visible=s.on;glow.material.opacity=s.on?0.8:0;
   bulbMat.color.copy(s.on?lit:dim);
  },
 };
}
function ownToonDouble():MeshToonMaterial{const m=ownToon(C.LAMP_BODY);m.side=2;return m;}

function buildMotor(_p:PartProps,g:Group):Inner{
 const y=11.5;
 g.add(solid(new CylinderGeometry(11,11,24,32),C.MOTOR_CAN,{outline:0.5,rot:[0,0,HALF_PI],pos:[0,y,0]}));
 g.add(solid(new CylinderGeometry(11.2,11.2,3,32),C.MOTOR_CAP,{rot:[0,0,HALF_PI],pos:[-12,y,0]}));
 g.add(solid(new CylinderGeometry(3.2,3.2,3,16),C.SILVER,{rot:[0,0,HALF_PI],pos:[13.5,y,0]}));
 g.add(solid(new CylinderGeometry(1.1,1.1,12,12),C.SILVER,{rot:[0,0,HALF_PI],pos:[19,y,0]}));
 for(const sz of [-1,1])g.add(solid(new BoxGeometry(3,0.4,1.6),C.GOLD,{pos:[-14.5,y,sz*3.2],cast:false}));
 const spin=new Group();spin.position.set(24,y,0);g.add(spin);
 for(let i=0;i<3;i++){
  const blade=solid(new BoxGeometry(0.9,9,3.2),C.FAN,{outline:0.3,pos:[0,4.5,0]});
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
 g.add(solid(new BoxGeometry(23,22,12),C.SERVO_BLUE,{outline:0.5,pos:[0,11,0]}));
 g.add(solid(new BoxGeometry(33,2.2,12),C.SERVO_BLUE,{outline:0.45,pos:[0,17,0]}));
 for(const sx of [-1,1])g.add(solid(new CylinderGeometry(1,1,2.4,10),C.HOLE,{pos:[sx*14,17,0],cast:false}));
 g.add(solid(new CylinderGeometry(3.4,3.4,3,20),C.SERVO_HORN,{pos:[5,23.5,0]}));
 const horn=new Group();horn.position.set(5,25.4,0);g.add(horn);
 horn.add(solid(new BoxGeometry(18,1.6,4.2),C.SERVO_HORN,{outline:0.35,pos:[8,0,0]}));
 horn.add(solid(new CylinderGeometry(2.6,2.6,1.6,16),C.SERVO_HORN,{outline:0.3,pos:[0,0,0]}));
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

export function buildPart(spec:PartSpec):PartView{
 const group=new Group();group.name=spec.id;group.userData.targetId=spec.id;
 let props:PartProps={...spec.props};
 let inner=BUILDERS[spec.kind](props,group);
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
   inner=BUILDERS[spec.kind](props,group);view.interactive=inner.interactive;
  },
 };
 return view;
}
