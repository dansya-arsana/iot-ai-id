import {BoxGeometry,CanvasTexture,Color,CylinderGeometry,ExtrudeGeometry,Group,InstancedMesh,Matrix4,Mesh,MeshBasicMaterial,MeshStandardMaterial,PlaneGeometry,Quaternion,Shape,Sprite,SpriteMaterial,Vector3,type Object3D} from 'three';
import {RoundedBoxGeometry} from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';
import type {BoardFeatureId,BoardPin,SimSnapshot,UnoPin} from '../contract';
import {PWM_PINS,UNO_PINS} from '../contract';
import {UNO_W,UNO_D,PCB_T,HEADER_H,PITCH} from './layout';
import {addOutline,canvasTexture,glowTexture,labelMaterial,ownToon,solid,toon,disposeObject} from './materials';
import {contactShadow} from './decals';
import * as C from './palette';

const HX=UNO_W/2,HZ=UNO_D/2;
const mil=(x:number)=>x*0.0254-HX;
const TOP_Z=-24.13,BOT_Z=24.13;
const MONO='"IBM Plex Mono", ui-monospace, monospace',SANS='"Archivo", system-ui, sans-serif';

type PinPos={x:number;z:number};
/** Pin positions on the headers (x from mils, z by edge). */
function pinTable():Record<string,PinPos>{
 const t:Record<string,PinPos>={};
 for(let i=0;i<=7;i++)t['D'+i]={x:mil(2000-i*100),z:TOP_Z};
 for(let i=0;i<=5;i++)t['D'+(8+i)]={x:mil(1140-i*100),z:TOP_Z};
 const power:[string,number][]=[['NC',1000],['IOREF',1100],['RESET',1200],['3V3',1300],['5V',1400],['GND',1500],['GND2',1600],['VIN',1700]];
 for(const [n,x] of power)t[n]={x:mil(x),z:BOT_Z};
 for(let i=0;i<=5;i++)t['A'+i]={x:mil(1900+i*100),z:BOT_Z};
 t.GND3={x:mil(640-100),z:TOP_Z};t.AREF={x:mil(440),z:TOP_Z};t.SDA={x:mil(340),z:TOP_Z};t.SCL={x:mil(240),z:TOP_Z};
 return t;
}

export interface UnoBuild{
 group:Group;features:Record<BoardFeatureId,Object3D>;
 pinAnchor(pin:BoardPin):Vector3;
 /** TX follows the UART. RX stays dark on purpose: no byte ever travels host to chip in this lab, so lighting it would be a lie. */
 setLeds(s:{l:number;tx:boolean;on:boolean}):void;
 /** Pins the lesson uses: they get a live socket indicator. */
 setUsedPins(pins:Iterable<string>):void;
 /** Per-frame live state from the emulator: socket indicators and the chip decal (redrawn at most 5 Hz). */
 setLive(snap:SimSnapshot,dtMs:number):void;
 dispose():void;
}

const hex=(n:number):string=>'#'+n.toString(16).padStart(6,'0');

function silkscreen(pins:Record<string,PinPos>):{tex:CanvasTexture;redraw():void}{
 const S=24,w=Math.round(UNO_W*S),h=Math.round(UNO_D*S);
 const cv=document.createElement('canvas');cv.width=w;cv.height=h;
 const g=cv.getContext('2d')!;
 const px=(x:number)=>(x+HX)*S,pz=(z:number)=>(z+HZ)*S;
 const redraw=():void=>{
  g.clearRect(0,0,w,h);
  g.textAlign='center';g.textBaseline='middle';
  // copper traces: 45 degree routing from the headers toward the MCU, vias at the bends
  g.strokeStyle=C.COPPER;g.lineWidth=0.34*S;g.lineJoin='round';g.lineCap='round';
  const dn=(n:string,i:number):void=>{
   const p=pins[n]!,sgn=p.z<0?1:-1,s=((i%5)-2)*1.7;
   const z0=p.z+sgn*2.2,z1=p.z+sgn*(6+(i%4)*1.2),z2=z1+sgn*Math.abs(s);
   g.beginPath();g.moveTo(px(p.x),pz(z0));g.lineTo(px(p.x),pz(z1));g.lineTo(px(p.x+s),pz(z2));g.lineTo(px(p.x+s),pz(z2+sgn*(2+i%3)));g.stroke();
   g.fillStyle=C.COPPER;g.beginPath();g.arc(px(p.x+s),pz(z2+sgn*(2+i%3)),0.55*S,0,Math.PI*2);g.fill();
  };
  for(let i=0;i<=13;i++)dn('D'+i,i);
  for(let i=0;i<=5;i++)dn('A'+i,i+3);
  for(const n of ['IOREF','RESET','3V3','5V','VIN'])dn(n,n.length);
  // header outlines + pin-1 dots
  g.strokeStyle=C.SILKSCREEN;g.fillStyle=C.SILKSCREEN;g.lineWidth=0.22*S;
  const outline=(x0:number,x1:number,z:number):void=>{g.beginPath();g.rect(px(x0-1.6),pz(z-1.7),(x1-x0+3.2)*S,3.4*S);g.stroke();};
  const span=(a:string,b:string)=>{const x=[pins[a]!.x,pins[b]!.x];return [Math.min(...x),Math.max(...x),pins[a]!.z] as const;};
  for(const [a,b] of [['D0','D7'],['D8','SCL'],['NC','VIN'],['A0','A5']] as const){const [x0,x1,z]=span(a,b);outline(x0,x1,z);}
  for(const n of ['D7','D13','NC','A0']){g.beginPath();g.arc(px(pins[n]!.x),pz(pins[n]!.z+(pins[n]!.z<0?-2.9:2.9)),0.28*S,0,Math.PI*2);g.fill();}
  // pin labels (2.4mm, 600) and section labels (3.2mm, 0.12em)
  g.fillStyle=C.SILKSCREEN;
    g.font=`600 ${3.2*S}px ${MONO}`;(g as unknown as {letterSpacing:string}).letterSpacing=`${0.12*3.2*S}px`;
  g.fillText('DIGITAL (PWM ~)',px(14.5),pz(-17.6));
  (g as unknown as {letterSpacing:string}).letterSpacing='0px';
  g.font=`600 ${1.9*S}px ${MONO}`;
  g.fillText('ON',px(30),pz(12.4));g.fillText('L',px(1.2),pz(-10.4));g.fillText('TX',px(-4.4),pz(17.8));g.fillText('RX',px(-1.4),pz(17.8));g.fillText('RESET',px(-12),pz(-18.2));
  // our mark: dot-mark + AIoT wordmark where a logo would go
  g.textAlign='left';
  for(let r=0;r<3;r++)for(let c=0;c<3;c++){g.beginPath();g.arc(px(-4+c*1.3),pz(8.2+r*1.3),0.42*S,0,Math.PI*2);g.fillStyle=r===2&&c===2?hex(C.LIVE):C.SILKSCREEN;g.fill();}
  g.fillStyle=C.SILKSCREEN;g.font=`600 ${4.2*S}px ${SANS}`;g.fillText('AIoT',px(-0.2),pz(9.7));
  g.font=`500 ${1.6*S}px ${MONO}`;g.fillText('UNO R3-compatible',px(-4.2),pz(13));
  // section labels, boxed outlines for the crystal / USB / jack, ICSP captions
  g.textAlign='center';g.font=`600 ${1.7*S}px ${MONO}`;
  g.fillText('POWER',px(6.5),pz(19.8));g.fillText('ANALOG IN',px(19.8),pz(19.8));
  g.font=`600 ${1.4*S}px ${MONO}`;g.fillText('ICSP',px(27),pz(11.2));g.fillText('ICSP',px(-12),pz(-9.6));
  g.fillText('16.000',px(-14),pz(10.2));g.fillText('USB',px(-22.5),pz(-3.2));
  g.lineWidth=0.18*S;g.strokeRect(px(-19.6),pz(2.9),11.2*S,6.2*S);
  g.strokeRect(px(-31.2),pz(-3.4),7.4*S,14.2*S);
 };
 redraw();
 const tex=canvasTexture(cv);
 return {tex,redraw};
}

function pcbShape():Shape{
 const w=UNO_W-0.5,d=UNO_D-0.5,r=1.5,x0=-w/2,x1=w/2,y0=-d/2,y1=d/2;
 const s=new Shape();
 s.moveTo(x0+r,y0);s.lineTo(x1-r,y0);s.quadraticCurveTo(x1,y0,x1,y0+r);
 s.lineTo(x1,-8);s.lineTo(x1-2.5,-6);s.lineTo(x1-2.5,3);s.lineTo(x1,5);
 s.lineTo(x1,y1-r);s.quadraticCurveTo(x1,y1,x1-r,y1);s.lineTo(x0+r,y1);s.quadraticCurveTo(x0,y1,x0,y1-r);
 s.lineTo(x0,y0+r);s.quadraticCurveTo(x0,y0,x0+r,y0);
 return s;
}

export function buildUno():UnoBuild{
 const group=new Group();group.name='uno';
 const pins=pinTable();
 // PCB: extruded outline with a small bevel (top/cap and edge groups)
 const geo=new ExtrudeGeometry(pcbShape(),{depth:PCB_T-0.5,bevelEnabled:true,bevelThickness:0.25,bevelSize:0.25,bevelSegments:1,curveSegments:6});
 geo.rotateX(-Math.PI/2);geo.translate(0,0.25,0);
 const pcb=new Mesh(geo,[toon(C.PCB,'pcb'),toon(C.PCB_DARK,'pcb')]);
 pcb.castShadow=true;pcb.receiveShadow=true;addOutline(pcb);group.add(pcb);
 const cs=contactShadow(UNO_W,UNO_D,0.35,6);cs.position.set(0,0.03,1.5);group.add(cs);

 const silk=silkscreen(pins);
 const sil=new Mesh(new PlaneGeometry(UNO_W,UNO_D),labelMaterial(silk.tex));
 let alive=true;
 if(typeof document!=='undefined'&&document.fonts)void Promise.all([`600 24px ${MONO}`,`600 24px ${SANS}`,`500 24px ${MONO}`].map(f=>document.fonts.load(f))).then(()=>{if(alive){silk.redraw();silk.tex.needsUpdate=true;}}).catch(()=>undefined);
 sil.rotation.x=-Math.PI/2;sil.position.y=PCB_T+0.03;sil.userData.noPick=true;sil.userData.noInk=true;sil.renderOrder=1;
 group.add(sil);
 // mounting holes
 const hole=new CylinderGeometry(1.6,1.6,0.2,16),ring=new CylinderGeometry(2.7,2.7,0.15,20);
 for(const [x,z] of [[14,26.67-2.5],[15.3,26.67-50.7],[66.1,26.67-7.6],[66.1,26.67-35.5]] as [number,number][]){
  group.add(solid(ring,C.GOLD,{pos:[x-HX,PCB_T+0.05,z],cast:false,finish:'gold'}));
  group.add(solid(hole,C.HOLE,{pos:[x-HX,PCB_T+0.12,z],cast:false}));
 }
 const f:Record<string,Object3D>={};
 const feat=(id:BoardFeatureId):Group=>{const g=new Group();g.name=id;g.userData.targetId=id;group.add(g);f[id]=g;return g;};

 // headers: dark body, lighter top cap, framed sockets
 const holeGeo=new BoxGeometry(1.25,0.2,1.25),frameGeo=new BoxGeometry(2.0,0.14,2.0);
 const fillHeader=(g:Group,names:string[]):void=>{
  const xs=names.map(n=>pins[n]!.x),z=pins[names[0]!]!.z;
  const x0=Math.min(...xs),x1=Math.max(...xs);
  const body=solid(new BoxGeometry(x1-x0+PITCH,HEADER_H,PITCH),C.HEADER_BLACK,{outline:true,edges:true,pos:[(x0+x1)/2,PCB_T+HEADER_H/2,z]});
  g.add(body);
  g.add(solid(new BoxGeometry(x1-x0+PITCH+0.2,0.5,PITCH+0.2),C.HEADER_TOP,{pos:[(x0+x1)/2,PCB_T+HEADER_H-0.15,z],cast:false}));
  const frames=new InstancedMesh(frameGeo,toon(C.HEADER_TOP),names.length),holes=new InstancedMesh(holeGeo,toon(C.HOLE),names.length);
  const m=new Matrix4();
  names.forEach((n,i)=>{
   m.setPosition(pins[n]!.x,PCB_T+HEADER_H+0.17,z);frames.setMatrixAt(i,m);
   m.setPosition(pins[n]!.x,PCB_T+HEADER_H+0.3,z);holes.setMatrixAt(i,m);
  });
  frames.userData.noPick=true;holes.userData.noPick=true;frames.receiveShadow=true;g.add(frames,holes);
  wallLabels(g,names,z);
 };
 const WALL=24,wallName=(n:string):string=>n==='GND2'||n==='GND3'?'GND':/^D\d+$/.test(n)&&(PWM_PINS as readonly string[]).includes(n)?'~'+n.slice(1):/^D\d+$/.test(n)?n.slice(1):n;
 /** Pin names printed vertically on the header walls (both +z and -z faces), so no part or other header can hide them. */
 const wallLabels=(g:Group,names:string[],z:number):void=>{
  const xs=names.map(n=>pins[n]!.x),x0=Math.min(...xs),x1=Math.max(...xs),len=x1-x0+PITCH,hh=HEADER_H-1.1;
  for(const back of [false,true]){
   const cv=document.createElement('canvas');cv.width=Math.round(len*WALL);cv.height=Math.round(hh*WALL);
   const c=cv.getContext('2d')!;c.fillStyle=C.SILKSCREEN;c.textAlign='center';c.textBaseline='middle';c.font=`600 ${1.9*WALL}px ${MONO}`;
   for(const n of names){
    const cx=((back?x1-pins[n]!.x:pins[n]!.x-x0)+PITCH/2)*WALL;
    c.save();c.translate(cx,cv.height/2);c.rotate(-Math.PI/2);c.fillText(wallName(n),0,0);c.restore();
   }
   const m=new Mesh(new PlaneGeometry(len,hh),labelMaterial(canvasTexture(cv)));
   m.position.set((x0+x1)/2,PCB_T+0.5+hh/2,z+(back?-1:1)*(PITCH/2+0.04));if(back)m.rotation.y=Math.PI;
   m.userData.noPick=true;m.userData.noInk=true;m.renderOrder=2;g.add(m);
  }
 };
 const dig=feat('uno.digital-header');
 fillHeader(dig,['D0','D1','D2','D3','D4','D5','D6','D7']);
 fillHeader(dig,['D8','D9','D10','D11','D12','D13','GND3','AREF','SDA','SCL']);
 fillHeader(feat('uno.power-header'),['NC','IOREF','RESET','3V3','5V','GND','GND2','VIN']);
 fillHeader(feat('uno.analog-header'),['A0','A1','A2','A3','A4','A5']);

 // USB-B (metal, dark opening, white tongue) and DC jack (collared)
 const usb=feat('uno.usb');
 usb.add(solid(new RoundedBoxGeometry(16,11,12,3,0.6),C.SILVER,{outline:true,pos:[-HX-2+8,PCB_T+5.5,-11.4],finish:'metal'}));
 usb.add(solid(new BoxGeometry(0.4,6.6,8.6),C.HOLE,{pos:[-HX-2.02,PCB_T+5.5,-11.4],cast:false}));
 usb.add(solid(new BoxGeometry(0.5,1.5,6.6),C.WHITE,{pos:[-HX-1.5,PCB_T+5.5,-11.4],cast:false}));
 const jack=feat('uno.power-jack');
 jack.add(solid(new RoundedBoxGeometry(14,11,9,3,0.8),C.HEADER_BLACK,{outline:true,pos:[-HX-2+7,PCB_T+5.5,19.2]}));
 jack.add(solid(new CylinderGeometry(3.6,3.6,1.4,24),C.HEADER_TOP,{rot:[0,0,Math.PI/2],pos:[-HX-2.2,PCB_T+5.5,19.2],cast:false}));
 jack.add(solid(new CylinderGeometry(2.6,2.6,1.5,20),C.HOLE,{rot:[0,0,Math.PI/2],pos:[-HX-2.3,PCB_T+5.5,19.2],cast:false}));
 jack.add(solid(new CylinderGeometry(0.7,0.7,1.2,10),C.SILVER,{rot:[0,0,Math.PI/2],pos:[-HX-2.0,PCB_T+5.5,19.2],cast:false,finish:'metal'}));

 // MCU DIP-28 (rounded body, notch, printed + live decal, L-shaped legs)
 const mcu=feat('uno.mcu');
 const CX=8,CZ=0.5,CY=PCB_T+3.4;
 mcu.add(solid(new RoundedBoxGeometry(35,3.6,7.4,3,0.4),C.CHIP,{outline:true,pos:[CX,CY,CZ]}));
 mcu.add(solid(new BoxGeometry(35.6,1.6,8.2),C.HEADER_BLACK,{pos:[CX,PCB_T+0.8,CZ],cast:false}));
 mcu.add(solid(new CylinderGeometry(1.1,1.1,0.12,20),C.SILVER_DARK,{pos:[CX-15.8,CY+1.82,CZ-1.8],cast:false,finish:'metal'}));
 const shoulder=new InstancedMesh(new BoxGeometry(0.5,0.35,1.5),toon(C.SILVER,'metal'),28),vert=new InstancedMesh(new BoxGeometry(0.5,2.1,0.4),toon(C.SILVER,'metal'),28);
 const lm=new Matrix4();
 for(let i=0;i<14;i++)for(const s of [-1,1]){
  const k=i*2+(s<0?0:1),x=CX-16.5+i*2.54;
  lm.setPosition(x,PCB_T+2.0,CZ+s*4.45);shoulder.setMatrixAt(k,lm);
  lm.setPosition(x,PCB_T+1.05,CZ+s*5.0);vert.setMatrixAt(k,lm);
 }
 shoulder.userData.noPick=true;vert.userData.noPick=true;shoulder.castShadow=true;vert.castShadow=true;mcu.add(shoulder,vert);
 const chipCv=document.createElement('canvas');chipCv.width=1280;chipCv.height=300;
 const cg=chipCv.getContext('2d')!;
 const chipTex=canvasTexture(chipCv);
 const chipDecal=new Mesh(new PlaneGeometry(30,7.03),labelMaterial(chipTex));
 chipDecal.rotation.x=-Math.PI/2;chipDecal.position.set(CX+1,CY+1.84,CZ);chipDecal.userData.noPick=true;chipDecal.userData.noInk=true;chipDecal.renderOrder=2;mcu.add(chipDecal);
 let chipLine='';
 const drawChip=(live:string[]|null):void=>{
  const key=live?live.join('|'):'';if(key===chipLine)return;chipLine=key;
  cg.clearRect(0,0,1280,300);cg.textBaseline='middle';cg.textAlign='left';
  cg.fillStyle=C.CHIP_PRINT;cg.font=`600 82px ${MONO}`;cg.fillText('ATmega328P-PU',40,62);
  cg.font=`500 66px ${MONO}`;
  if(live){cg.fillStyle=hex(C.LIVE);cg.fillText(live[0]!,40,160);cg.fillText(live[1]!,40,242);}
  else cg.fillText('16 MHz \u00b7 idle',40,170);
  chipTex.needsUpdate=true;
 };
 drawChip(null);

 // USB-serial chip (QFN) and crystal (standing HC-49)
 const chip=feat('uno.usb-chip');
 chip.add(solid(new RoundedBoxGeometry(6,1,6,2,0.2),C.CHIP,{outline:true,pos:[-20,PCB_T+0.5,-8]}));
 chip.add(solid(new CylinderGeometry(0.4,0.4,0.1,12),C.SILVER,{pos:[-21.8,PCB_T+1.02,-9.8],cast:false}));
 const xtal=feat('uno.crystal');
 const st=new Shape();const sw=11,sh=4.4,sr=sh/2;
 st.moveTo(-sw/2+sr,-sh/2);st.lineTo(sw/2-sr,-sh/2);st.absarc(sw/2-sr,0,sr,-Math.PI/2,Math.PI/2,false);st.lineTo(-sw/2+sr,sh/2);st.absarc(-sw/2+sr,0,sr,Math.PI/2,Math.PI*1.5,false);
 const xg=new ExtrudeGeometry(st,{depth:3.8,bevelEnabled:true,bevelSize:0.2,bevelThickness:0.2,bevelSegments:2,curveSegments:10});
 xg.rotateX(-Math.PI/2);
 xtal.add(solid(xg,C.SILVER,{outline:true,pos:[-14,PCB_T,6],finish:'metal'}));
 // electrolytic caps, regulator, fuse
 for(const [x,z] of [[-24.5,3],[-24.5,10]] as [number,number][]){
  group.add(solid(new CylinderGeometry(3.1,3.1,5.4,28),0x2b2f38,{outline:true,pos:[x,PCB_T+2.7,z]})); // ds-allow-hex
  group.add(solid(new CylinderGeometry(2.9,2.9,0.12,28),C.SILVER,{pos:[x,PCB_T+5.45,z],cast:false,finish:'metal'}));
  for(const r of [0,Math.PI/2])group.add(solid(new BoxGeometry(4.4,0.06,0.3),C.SILVER_DARK,{rot:[0,r,0],pos:[x,PCB_T+5.52,z],cast:false}));
 }
 group.add(solid(new BoxGeometry(6.5,1.6,3.5),C.CHIP,{outline:true,pos:[-17,PCB_T+0.8,14]}));
 group.add(solid(new BoxGeometry(3.2,0.5,3),C.SILVER,{pos:[-17,PCB_T+0.35,17.2],cast:false,finish:'metal'}));
 group.add(solid(new BoxGeometry(3.4,1.6,1.8),C.LDR_DISC,{pos:[-28,PCB_T+0.8,-3],cast:false}));
 // ~20 SMD passives
 const smdGeo=new BoxGeometry(1.6,0.6,0.9),smd=new InstancedMesh(smdGeo,toon(C.RESISTOR_BODY),20);
 // clustered like real decoupling parts: around the 16U2, the regulator, the MCU's right end and the reset corner, with varied rotation
 const spots:[number,number,number][]=[
  [-24.5,-9.6,0],[-23.2,-6,90],[-16.8,-11.4,0],[-18.4,-3.6,90],[-26.8,-12.4,90],
  [-12.2,12.6,0],[-12,15.6,90],[-21.4,16.4,0],[-21.6,12.2,90],[-9.6,17.8,0],
  [24.6,-5.4,90],[24.6,-3,90],[27.6,-4.4,0],[27.4,-8.4,90],
  [-8.4,-17.4,0],[-6.6,-16,90],[-4.8,-17.6,0],
  [30.8,-12.4,90],[30.6,-10.2,90],[-29.4,0.4,0],
 ];
 const sm=new Matrix4(),sq=new Quaternion(),sp=new Vector3(),one=new Vector3(1,1,1),up=new Vector3(0,1,0);
 spots.forEach(([x,z,r],i)=>{sm.compose(sp.set(x,PCB_T+0.3,z),sq.setFromAxisAngle(up,r*Math.PI/180),one);smd.setMatrixAt(i,sm);});
 smd.userData.noPick=true;smd.castShadow=true;group.add(smd);
 // reset switch: silver frame, dark body, red cap
 const reset=feat('uno.reset');
 reset.add(solid(new BoxGeometry(6,2.2,6),C.SILVER,{outline:true,pos:[-12,PCB_T+1.1,-14],finish:'metal'}));
 reset.add(solid(new BoxGeometry(5,1.4,5),C.HEADER_BLACK,{pos:[-12,PCB_T+2.8,-14]}));
 reset.add(solid(new CylinderGeometry(1.5,1.5,1.6,20),C.RED_ALERT,{pos:[-12,PCB_T+4.3,-14]}));
 // ICSP
 const icsp=feat('uno.icsp');
 icsp.add(solid(new BoxGeometry(2*PITCH+0.8,2.5,3*PITCH+0.4),C.HEADER_BLACK,{outline:true,edges:true,pos:[27,PCB_T+1.25,6]}));
 const pinGeo=new BoxGeometry(0.64,3.2,0.64);
 for(let i=0;i<3;i++)for(let j=0;j<2;j++)icsp.add(solid(pinGeo,C.GOLD,{pos:[27+(j-0.5)*PITCH,PCB_T+2.5+1.6,6+(i-1)*PITCH],cast:false,finish:'gold'}));

 const icsp2=new Group();icsp2.name='uno.icsp2';group.add(icsp2);
 icsp2.add(solid(new BoxGeometry(3*PITCH+0.4,2.5,2*PITCH+0.8),C.HEADER_BLACK,{outline:true,edges:true,pos:[-12,PCB_T+1.25,-6]}));
 for(let i=0;i<3;i++)for(let j=0;j<2;j++)icsp2.add(solid(pinGeo,C.GOLD,{pos:[-12+(i-1)*PITCH,PCB_T+2.5+1.6,-6+(j-0.5)*PITCH],cast:false,finish:'gold'}));
 // 16U2 gull legs: 8 per side on all four sides
 const qleg=new InstancedMesh(new BoxGeometry(0.35,0.3,0.9),toon(C.SILVER,'metal'),32);qleg.userData.noPick=true;
 {let k=0;const m=new Matrix4(),q=new Quaternion(),sc=new Vector3(1,1,1),ps=new Vector3();
  for(let i=0;i<8;i++)for(const [dx,dz,r] of [[0,-3.4,0],[0,3.4,0],[-3.4,0,90],[3.4,0,90]] as const){
   const o=(i-3.5)*0.7;
   ps.set(-20+(dz===0?dx:o),PCB_T+0.2,-8+(dz===0?o:dz));q.setFromAxisAngle(up,r*Math.PI/180);m.compose(ps,q,sc);qleg.setMatrixAt(k++,m);
  }}
 chip.add(qleg);
 // regulator: SOT-223 legs, M7 protection diode, 8 MHz SMD crystal
 group.add(solid(new BoxGeometry(0.5,0.3,1.2),C.SILVER,{pos:[-18.4,PCB_T+0.15,15.9],cast:false,finish:'metal'}));
 group.add(solid(new BoxGeometry(0.5,0.3,1.2),C.SILVER,{pos:[-17,PCB_T+0.15,15.9],cast:false,finish:'metal'}));
 group.add(solid(new BoxGeometry(0.5,0.3,1.2),C.SILVER,{pos:[-15.6,PCB_T+0.15,15.9],cast:false,finish:'metal'}));
 group.add(solid(new BoxGeometry(4.2,1.4,2.4),C.HEADER_BLACK,{outline:true,pos:[-24,PCB_T+0.7,19.4]}));
 group.add(solid(new BoxGeometry(0.7,1.45,2.45),C.SILVER,{pos:[-22.4,PCB_T+0.72,19.4],cast:false,finish:'metal'}));
 group.add(solid(new BoxGeometry(3.4,1,2.6),C.SILVER,{outline:true,pos:[-14,PCB_T+0.5,-10],finish:'metal'}));

 // status LEDs (SMD)
 const smdLed=new BoxGeometry(3,0.9,1.6);
 const halos:Sprite[]=[];
 const mk=(x:number,z:number):Mesh=>{
  const m=new Mesh(smdLed,ownToon(C.LED_SMD_OFF,'epoxy'));m.position.set(x,PCB_T+0.45,z);m.receiveShadow=true;group.add(m);
  const sp=new Sprite(new SpriteMaterial({map:glowTexture(),color:0xffffff,transparent:true,opacity:0,depthWrite:false}));sp.material.userData.own=true; // ds-allow-hex
  sp.scale.setScalar(7);sp.position.set(x,PCB_T+1.2,z);sp.userData.noPick=true;group.add(sp);halos.push(sp);
  return m;
 };
 const ledOn=mk(30,15),ledL=mk(1.2,-13),ledTx=mk(-4.4,15),ledRx=mk(-1.4,15);
 const fOn=feat('uno.led-on');fOn.add(ledOn);const fL=feat('uno.led-l');fL.add(ledL);const fTx=feat('uno.led-txrx');fTx.add(ledTx,ledRx);

 // live socket indicators on pins the lesson/sketch uses
 const sockGeo=new BoxGeometry(1.7,0.12,1.7);
 const sockMat=new MeshBasicMaterial({toneMapped:false});sockMat.userData.own=true;
 const socks=new InstancedMesh(sockGeo,sockMat,UNO_PINS.length);
 socks.userData.noPick=true;socks.userData.noInk=true;
 const sockIdx=new Map<string,number>();UNO_PINS.forEach((p,i)=>sockIdx.set(p,i));
 const zeroM=new Matrix4().makeScale(0,0,0);
 let used=new Set<string>();
 const placeSocks=():void=>{
  const m=new Matrix4();
  UNO_PINS.forEach((p,i)=>{
   if(used.has(p)){const q=pins[p]!;m.setPosition(q.x,PCB_T+HEADER_H+0.44,q.z);socks.setMatrixAt(i,m);socks.setColorAt(i,new Color(C.HOLE));}
   else socks.setMatrixAt(i,zeroM);
  });
  socks.instanceMatrix.needsUpdate=true;if(socks.instanceColor)socks.instanceColor.needsUpdate=true;
 };
 placeSocks();group.add(socks);

 const anchors=new Map<string,Vector3>();
 for(const [n,p] of Object.entries(pins))anchors.set(n,new Vector3(p.x,PCB_T+HEADER_H,p.z));
 const tmpOn=new Color();
 const setLed=(m:Mesh,halo:Sprite,k:number,on:number,off:number):void=>{
  const mat=m.material as MeshStandardMaterial;
  mat.color.setHex(off).lerp(tmpOn.setHex(on),k);mat.emissive.setHex(on);mat.emissiveIntensity=k*1.4;
  halo.material.color.setHex(on);halo.material.opacity=k*0.55;
 };
 const cDark=new Color(C.HOLE),cLive=new Color(C.LIVE),cPwm=new Color(C.PWM),cDim=new Color(0x2f4a38),col=new Color(); // ds-allow-hex
 let acc=1e9;
 return {
  group,features:f as Record<BoardFeatureId,Object3D>,
  pinAnchor(pin){const a=anchors.get(pin);return a?a.clone():new Vector3(0,PCB_T,0);},
  setLeds(s){
   setLed(ledOn,halos[0]!,s.on?1:0,C.LED_ON_GREEN,C.LED_SMD_OFF);
   setLed(ledL,halos[1]!,Math.max(0,Math.min(1,s.l**0.5)),C.LED_L_ORANGE,C.LED_SMD_OFF);
   setLed(ledTx,halos[2]!,s.tx?1:0,C.LED_TX_YELLOW,C.LED_SMD_OFF);setLed(ledRx,halos[3]!,0,C.LED_TX_YELLOW,C.LED_SMD_OFF);
  },
  setUsedPins(p){used=new Set(p);placeSocks();},
  setLive(snap,dt){
   const running=snap.status==='running';
   let dirty=false;
   for(const p of used){
    const i=sockIdx.get(p);if(i===undefined)continue;
    const s=snap.pins[p as UnoPin];
    if(!running||!s)col.copy(cDark);
    else if(s.mode==='input-pullup')col.copy(cDim);
    else if(s.mode==='output'&&s.duty>0.02&&s.duty<0.98&&(PWM_PINS as readonly string[]).includes(p))col.copy(cDark).lerp(cPwm,s.duty);
    else if(s.mode==='output'&&s.level===1)col.copy(cLive);
    else col.copy(cDark);
    socks.setColorAt(i,col);dirty=true;
   }
   if(dirty&&socks.instanceColor)socks.instanceColor.needsUpdate=true;
   acc+=dt;
   if(acc>=200){
    acc=0;
    if(!running)drawChip(null);
    else{
     let portB=0;for(let b=0;b<6;b++)if(snap.pins[('D'+(8+b)) as UnoPin].level===1)portB|=1<<b;
     const cyc=snap.simTimeMs*16000;
     drawChip([`16 MHz \u00b7 ${(cyc/1e6).toFixed(2)}M cyc`,`PORTB 0b${portB.toString(2).padStart(8,'0')}`]);
    }
   }
  },
  dispose(){alive=false;chipTex.dispose();disposeObject(group);},
 };
}
