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
/** Desk footprint (x width, z depth in mm) per kind, filled by definePart so the layout needs no scene import. */
export const DESK_MM:Partial<Record<string,readonly [number,number]>>={};
/** Where a seated 28BYJ-48 sits relative to its ULN2003 (plug face in the white socket: socket x offset, plug length 76 + 2.5 mm seat). */
export const STEPPER_SEAT={x:24,z:78.5} as const;
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

/** A load lamp hangs this far (mm) left of its relay, clear of the relay board's body. */
const LOAD_LAMP_DX=40;
/** Off-board slots near the partner part. Deterministic. */
function offBoard(p:PartSpec,all:Record<string,Placement>):Placement{
 const target=typeof p.props.target==='string'?all[p.props.target]:undefined;
 switch(p.kind){
  case 'lamp':return {x:target?target.x:BB_CX,z:58,rotY:0,onBoard:false};
  case 'load-lamp':return {x:target?target.x-LOAD_LAMP_DX:BB_CX-LOAD_LAMP_DX,z:(target?target.z:62)+8,rotY:0,onBoard:false};
  case 'obstacle':return {x:target?target.x+1.5*PITCH:BB_CX,z:target?target.z+14:60,rotY:0,onBoard:false};
  case 'motor':return {x:BB_CX-10,z:62,rotY:0,onBoard:false};
  // a motor plug seated in its driver's socket: the stepper sits in front of the driver, turned to face it
  case 'stepper-28byj48':return target?{x:target.x+STEPPER_SEAT.x,z:target.z+STEPPER_SEAT.z,rotY:Math.PI,onBoard:false}:{x:BB_CX,z:62,rotY:0,onBoard:false};
  case 'servo':return {x:BB_CX,z:62,rotY:0,onBoard:false};
  default:return {x:BB_CX,z:62,rotY:0,onBoard:false};
 }
}

/** First free column per lane: parts sit mid-board (cols 8+), the sonar at the far end, never near the Uno. */
export const LANE_START:Record<number,number>={2:8,7:8,9:21};
/** With a sonar on the board: it takes the front-right end, everything else stays at lower columns so its tall body never hides an LED or the buzzer. */
const SONAR_START:Record<number,number>={2:5,7:5,9:26};
/** X extent (mm, relative to the first pin) of the physical part body, for the clearance check. */
export const BODY_X:Partial<Record<PartKind,[number,number]>>={hcsr04:[-19,27],potentiometer:[-4,10]};
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
 /** Right edge (mm) of the last body placed in each lane: the next part starts at least BODY_GAP clear of it, whatever the column maths says. */
 const edge:Record<number,number>={};
 const BODY_GAP=0.5;
 const sonar=circuit.parts.some(p=>p.kind==='hcsr04');
 const start=sonar?SONAR_START:LANE_START;
 // LEDs and the buzzer sit in the front lane (lane 7) so the camera sees them; resistors and the rest go behind
 const order=(k:PartKind,front=false):number[]=>front?[LANES[1],LANES[0]]:sonar&&(k==='led'||k==='buzzer'||k==='rgb-led')?[LANES[1],LANES[0]]:[...LANES];
 for(const p of circuit.parts){
  if(!isOnBoardKind(p.kind))continue;
  const w=WIDTH(p.kind);
  // A module much wider than its legs (PIR, relay, LCD...) reserves columns for its body so neighbours do not hide it.
  // Small overhangs (the DHT22) and the sonar keep the old tight spacing, so existing lessons lay out exactly as before.
  const bx=p.kind==='hcsr04'?undefined:BODY_X[p.kind];
  const lead=bx&&-bx[0]>5?Math.ceil(-bx[0]/PITCH):0;
  const span=bx&&bx[1]-(w-1)*PITCH>6?Math.ceil(bx[1]/PITCH)+1:w;
  const lanes:number[]=p.kind==='hcsr04'?[SENSOR_ROW]:order(p.kind,p.props.lane==='front');
  let lane=lanes[lanes.length-1]!;
  const left=bx?bx[0]:0;
  // the column the legacy spacing gives, or further right when the previous body in that lane (measured, BODY_GAP clear) would still be in the way
  const free=(l:number):number=>{
   const legacy=(cursor[l]??start[l]??0)+lead;
   return edge[l]===undefined?legacy:Math.max(legacy,Math.ceil((edge[l]!+BODY_GAP-holeX(0)-left)/PITCH));
  };
  let col=free(lane);
  let fit=false;
  for(const l of lanes){const c=free(l);if(c+w<=BB_COLS&&c+span<=BB_COLS+2&&(!sonar||p.kind==='hcsr04'||c+w<=18||l===lanes[lanes.length-1])){lane=l;col=c;fit=true;break;}}
  // a body wider than the free lanes (the 80 mm LCD) goes to the back lane, centred on the board, so the front lane stays free for small parts
  if(!fit&&span>w){
   lane=lanes[0]!;
   // centre it on the board; but when something already stands in that lane, keep clear of it and let this body hang over the end of the board (legs stay in the strip)
   const f=free(lane);
   col=edge[lane]!==undefined&&f+w<=BB_COLS?f:Math.max(lead,Math.min(col,BB_COLS+2-span));
  }
  if(col+w>BB_COLS)col=Math.max(0,BB_COLS-w);
  cursor[lane]=col+Math.max(w,span)+1;
  edge[lane]=holeX(col)+Math.max((w-1)*PITCH+1,BODY_X[p.kind]?.[1]??0);
  out[p.id]={x:holeX(col),z:holeZ(lane),rotY:0,onBoard:true,holes:pinHoleOffsets(p.kind).map(d=>[col+d,lane] as [number,number])};
 }
 // Desk props (batteries, regulators, drivers, motors...) get their own slot: a prop that would land on an earlier one steps sideways in 10 mm steps until its footprint is clear.
 // Props anchored to a partner (lamp, obstacle, load-lamp with a target) keep their anchor, and a lone prop keeps the old fixed slot, so existing lessons lay out as before.
 const desk:Placement[]=[];const deskRects:[number,number,number,number][][]=[];
 const rects=(kind:PartKind,id:string,x:number,z:number):[number,number,number,number][]=>{
  const [w,d]=DESK_MM[kind]??[46,30];
  const r:[number,number,number,number][]=[[x,z,w,d]];
  for(const q of circuit.parts)if(q.props.target===id&&q.kind==='load-lamp'){const [lw,ld]=DESK_MM[q.kind]??[22,22];r.push([x-LOAD_LAMP_DX,z+8,lw,ld]);}
  for(const q of circuit.parts)if(q.props.target===id&&q.kind==='stepper-28byj48')r.push([x+STEPPER_SEAT.x,z+47.5,42,90]);
  return r;
 };
 const clash=(A:[number,number,number,number][],B:[number,number,number,number][]):boolean=>A.some(a=>B.some(b=>Math.abs(a[0]-b[0])<(a[2]+b[2])/2+4&&Math.abs(a[1]-b[1])<(a[3]+b[3])/2+4));
 for(const p of circuit.parts){
  if(isOnBoardKind(p.kind))continue;
  const pl=offBoard(p,out);
  // a lesson can ask for a tall prop (battery, relay board) to stand clear of the Uno: deskX is its centre in mm
  if(typeof p.props.target!=='string'&&typeof p.props.deskX==='number')pl.x=p.props.deskX;
  if(typeof p.props.target!=='string'){
   // clearance uses each part's own footprint (deskMm); the Uno's outline and any bulb hung off this part (load-lamp, 32 mm to its left) count too
   const unoBox:[number,number,number,number][]=[[0,0,UNO_W,UNO_D]];
   const hits=(x:number):boolean=>{const mine=rects(p.kind,p.id,x,pl.z);return clash(mine,unoBox)||deskRects.some(q=>clash(mine,q));};
   const x0=pl.x;
   for(let k=1;k<=40&&hits(pl.x);k++)pl.x=x0+10*(k%2===1?(k+1)>>1:-(k>>1));
  }
  desk.push(pl);deskRects.push(rects(p.kind,p.id,pl.x,pl.z));out[p.id]=pl;
 }
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
 distance:{az:52,elev:36,board:true},parking:{az:52,elev:36,board:true},
 sound:{az:32,elev:34,board:true},motor:{az:34,elev:34,board:true},servo:{az:34,elev:34,board:true},
};
