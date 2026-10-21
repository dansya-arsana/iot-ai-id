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

/** Lamp: 5..150 cm maps to 25..160 mm. Obstacle: 3..250 cm maps to 58..150 mm (58 keeps the box clear of the sensor and breadboard). */
const lerp=(a:number,b:number,t:number):number=>a+(b-a)*t;
const clamp=(v:number,lo:number,hi:number):number=>Math.min(hi,Math.max(lo,v));
export function lampMm(cm:number):number{return lerp(25,160,(clamp(cm,5,150)-5)/145);}
export function lampCm(mm:number):number{return lerp(5,150,(clamp(mm,25,160)-25)/135);}
/** Nearest the obstacle's facing side may sit (mm from the sensor group): its near face stops about 30 mm in front of the transducers, clear of the breadboard edge. The sim may still report 2-3 cm. */
export const OBS_NEAR_MM=58;
export const OBS_FAR_MM=150;
/** 3..250 cm maps to 58..150 mm on a gentle curve so near distances still read as different. */
export function obstacleMm(cm:number):number{return lerp(OBS_NEAR_MM,OBS_FAR_MM,Math.pow((clamp(cm,3,250)-3)/247,0.6));}
export function obstacleCm(mm:number):number{return lerp(3,250,Math.pow((clamp(mm,OBS_NEAR_MM,OBS_FAR_MM)-OBS_NEAR_MM)/(OBS_FAR_MM-OBS_NEAR_MM),1/0.6));}

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

/** First free column per lane: parts sit mid-board (cols 8+), the sonar at the far end, never near the Uno. */
export const LANE_START:Record<number,number>={2:8,7:8,9:21};
/** With a sonar on the board: it takes the front-right end, everything else stays at lower columns so its tall body never hides an LED or the buzzer. */
const SONAR_START:Record<number,number>={2:5,7:5,9:26};
/** X extent (mm, relative to the first pin) of the physical part body, for the clearance check. */
export const BODY_X:Partial<Record<PartKind,[number,number]>>={hcsr04:[-19,27]};
export const UNO_CLEARANCE=10;
/** Ids of on-board parts whose body comes within UNO_CLEARANCE mm of the Uno bbox (must be empty for every lesson). */
export function unoOverlaps(place:Record<string,Placement>,circuit:Circuit):string[]{
 const limit=UNO_W/2+UNO_CLEARANCE;
 return circuit.parts.filter(p=>{
  const pl=place[p.id];if(!pl||!pl.onBoard)return false;
  const [a]=BODY_X[p.kind]??[-1,WIDTH(p.kind)*PITCH];
  return pl.x+a<limit;
 }).map(p=>p.id);
}

export function layoutCircuit(circuit:Circuit):Record<string,Placement>{
 const out:Record<string,Placement>={};
 const cursor:Record<number,number>={};
 const sonar=circuit.parts.some(p=>p.kind==='hcsr04');
 const start=sonar?SONAR_START:LANE_START;
 // LEDs and the buzzer sit in the front lane (lane 7) so the camera sees them; resistors and the rest go behind
 const order=(k:PartKind):number[]=>sonar&&(k==='led'||k==='buzzer'||k==='rgb-led')?[LANES[1],LANES[0]]:[...LANES];
 for(const p of circuit.parts){
  if(!isOnBoardKind(p.kind))continue;
  const w=WIDTH(p.kind);
  const lanes:number[]=p.kind==='hcsr04'?[SENSOR_ROW]:order(p.kind);
  let lane=lanes[lanes.length-1]!;
  let col=cursor[lane]??start[lane]??0;
  for(const l of lanes){const c=cursor[l]??start[l]??0;if(c+w<=BB_COLS&&(!sonar||p.kind==='hcsr04'||c+w<=18||l===lanes[lanes.length-1])){lane=l;col=c;break;}}
  if(col+w>BB_COLS)col=Math.max(0,BB_COLS-w);
  cursor[lane]=col+w+1;
  out[p.id]={x:holeX(col),z:holeZ(lane),rotY:0,onBoard:true,holes:pinHoleOffsets(p.kind).map(d=>[col+d,lane] as [number,number])};
 }
 for(const p of circuit.parts){if(!isOnBoardKind(p.kind))out[p.id]=offBoard(p,out);}
 return out;
}

/** Cubic Bezier through vertical lead-outs; apex h = 10 + 0.3 * distance. `fan`/`lift` spread wires that share a header. */
export function wireCurve(a:[number,number,number],b:[number,number,number],fan=0,lift=0):[number,number,number][]{
 const n=96;
 const dist=Math.hypot(b[0]-a[0],b[1]-a[1],b[2]-a[2]);
 const h=10+0.3*dist+lift;
 const p0=a,p3=b;
 const p1:[number,number,number]=[a[0],a[1]+h,a[2]+fan],p2:[number,number,number]=[b[0],b[1]+h,b[2]+fan];
 const pts:[number,number,number][]=[];
 for(let i=0;i<n;i++){
  const t=i/(n-1),m=1-t;
  const k0=m*m*m,k1=3*m*m*t,k2=3*m*t*t,k3=t*t*t;
  pts.push([k0*p0[0]+k1*p1[0]+k2*p2[0]+k3*p3[0],k0*p0[1]+k1*p1[1]+k2*p2[1]+k3*p3[1],k0*p0[2]+k1*p1[2]+k2*p2[2]+k3*p3[2]]);
 }
 return pts;
}

/** Nearest free hole in the same 5-hole strip as the part leg at (x,z): same column, other row. */
export function freeHoleNear(x:number,z:number):{x:number;z:number}{
 const col=Math.round((x-holeX(0))/PITCH);
 let row=0,best=1e9;
 for(let r=0;r<BB_ROWS;r++){const d=Math.abs(holeZ(r)-z);if(d<best){best=d;row=r;}}
 const top=row<5;
 const cand=(top?[0,1,3,4]:[5,6,8,9]).filter(r=>r!==row);
 const pick=cand[0]!;
 return {x:holeX(Math.max(0,Math.min(BB_COLS-1,col))),z:holeZ(pick)};
}

/** Per-lesson camera angles (degrees) and whether the breadboard is part of the framing. */
export const LESSON_VIEW:Record<string,{az:number;elev:number;board:boolean}>={
 board:{az:40,elev:38,board:false},
 blink:{az:32,elev:34,board:true},button:{az:32,elev:34,board:true},knob:{az:32,elev:34,board:true},rgb:{az:32,elev:34,board:true},light:{az:32,elev:34,board:true},
 distance:{az:40,elev:38,board:true},parking:{az:40,elev:38,board:true},
 sound:{az:32,elev:34,board:true},motor:{az:34,elev:34,board:true},servo:{az:34,elev:34,board:true},
};
