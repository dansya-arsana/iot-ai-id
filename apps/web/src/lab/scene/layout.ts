// Pure placement maths (no WebGL). World unit = 1 mm, x right, y up, z toward the viewer.
import type {Circuit,PartKind,PartSpec} from '../contract';

export const PITCH=2.54;
export const BB_COLS=30;
export const BB_ROWS=10;
export const BB_CX=88;
export const BB_W=84;
export const BB_D=52;
export const BB_TOP=8.5;
export const UNO_W=68.6;
export const UNO_D=53.3;
export const PCB_T=1.6;
export const HEADER_H=8.5;
export const SENSOR_ROW=9;
export const LANES=[2,7] as const;

export interface Placement{x:number;z:number;rotY:number;onBoard:boolean;holes?:[number,number][]}

/** Column offsets (from the first hole) of each physical pin, in PART_PINS order. */
export const PIN_COLS:Partial<Record<PartKind,number[]>>={
 led:[0,1],resistor:[0,3],button:[0,2],potentiometer:[0,1,2],'rgb-led':[0,1,2,3],ldr:[0,2],
 hcsr04:[0,1,2,3],buzzer:[0,3],transistor:[0,1,2],diode:[0,3],
};
export const isOnBoardKind=(k:PartKind):boolean=>k in PIN_COLS;

export function holeX(col:number):number{return BB_CX-((BB_COLS-1)*PITCH)/2+col*PITCH;}
export function holeZ(row:number):number{return (row-4.5)*PITCH+(row>=5?PITCH:-PITCH);}
export const RAIL_Z={'5v-rail':-22.86,'gnd-rail':-20.32} as const;
export function railX(col:number):number{return holeX(col);}

/** Lamp: 5..150 cm maps to 25..160 mm. Obstacle: 3..250 cm maps to 20..200 mm. */
const lerp=(a:number,b:number,t:number):number=>a+(b-a)*t;
const clamp=(v:number,lo:number,hi:number):number=>Math.min(hi,Math.max(lo,v));
export function lampMm(cm:number):number{return lerp(25,160,(clamp(cm,5,150)-5)/145);}
export function lampCm(mm:number):number{return lerp(5,150,(clamp(mm,25,160)-25)/135);}
export function obstacleMm(cm:number):number{return lerp(20,200,(clamp(cm,3,250)-3)/247);}
export function obstacleCm(mm:number):number{return lerp(3,250,(clamp(mm,20,200)-20)/180);}

/** Four-band colour indices: digit, digit, multiplier exponent colour, gold tolerance (10). */
export function resistorBands(ohms:number):[number,number,number,number]{
 if(!(ohms>=1))return [0,0,0,10];
 const e=Math.floor(Math.log10(ohms+1e-9));
 let sig=Math.round(ohms/10**(e-1));
 let exp=e-1;
 if(sig>=100){sig=Math.round(sig/10);exp+=1;}
 if(exp<0)return [Math.floor(sig/10),sig%10,10,10];
 return [Math.floor(sig/10),sig%10,Math.min(exp,9),10];
}

export function pinHoleOffsets(kind:PartKind):number[]{return PIN_COLS[kind]??[];}

const WIDTH=(k:PartKind):number=>{const c=PIN_COLS[k];return c?Math.max(...c)+1:0;};

/** Off-board slots near the partner part. Deterministic. */
function offBoard(p:PartSpec,all:Record<string,Placement>):Placement{
 const target=typeof p.props.target==='string'?all[p.props.target]:undefined;
 switch(p.kind){
  case 'lamp':return {x:target?target.x:BB_CX,z:58,rotY:0,onBoard:false};
  case 'obstacle':return {x:target?target.x+1.5*PITCH:BB_CX,z:target?target.z+14:60,rotY:0,onBoard:false};
  case 'motor':return {x:BB_CX-10,z:62,rotY:0,onBoard:false};
  case 'servo':return {x:BB_CX,z:62,rotY:0,onBoard:false};
  default:return {x:BB_CX,z:62,rotY:0,onBoard:false};
 }
}

export function layoutCircuit(circuit:Circuit):Record<string,Placement>{
 const out:Record<string,Placement>={};
 const cursor:Record<number,number>={};
 for(const p of circuit.parts){
  if(!isOnBoardKind(p.kind))continue;
  const w=WIDTH(p.kind);
  const lanes:number[]=p.kind==='hcsr04'?[SENSOR_ROW]:[...LANES];
  let lane=lanes[lanes.length-1]!;
  let col=cursor[lane]??0;
  for(const l of lanes){const c=cursor[l]??0;if(c+w<=BB_COLS){lane=l;col=c;break;}}
  if(col+w>BB_COLS)col=Math.max(0,BB_COLS-w);
  cursor[lane]=col+w+1;
  out[p.id]={x:holeX(col),z:holeZ(lane),rotY:0,onBoard:true,holes:pinHoleOffsets(p.kind).map(d=>[col+d,lane] as [number,number])};
 }
 for(const p of circuit.parts){if(!isOnBoardKind(p.kind))out[p.id]=offBoard(p,out);}
 return out;
}

/** Arc between two points; apex height = 8 + 0.25 * distance mm above the chord. */
export function wireCurve(a:[number,number,number],b:[number,number,number]):[number,number,number][]{
 const n=32;
 const dist=Math.hypot(b[0]-a[0],b[1]-a[1],b[2]-a[2]);
 const h=8+0.25*dist;
 const pts:[number,number,number][]=[];
 for(let i=0;i<n;i++){
  const t=i/(n-1);
  pts.push([lerp(a[0],b[0],t),lerp(a[1],b[1],t)+4*t*(1-t)*h,lerp(a[2],b[2],t)]);
 }
 pts[0]=[a[0],a[1],a[2]];pts[n-1]=[b[0],b[1],b[2]];
 return pts;
}

/** Lesson camera presets. */
export const PRESETS:Record<string,{target:[number,number,number];zoom:number}>={
 board:{target:[0,4,0],zoom:1.7},
 blink:{target:[48,5,0],zoom:0.95},button:{target:[48,5,0],zoom:0.95},knob:{target:[48,5,0],zoom:0.95},
 rgb:{target:[48,5,0],zoom:0.95},sound:{target:[48,5,0],zoom:0.95},
 light:{target:[55,5,18],zoom:0.85},motor:{target:[55,5,18],zoom:0.85},servo:{target:[55,5,18],zoom:0.85},
 distance:{target:[62,0,70],zoom:0.55},parking:{target:[66,0,80],zoom:0.5},
};
