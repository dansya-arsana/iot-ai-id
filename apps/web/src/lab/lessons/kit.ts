/**
 * Lesson module kit. One lesson = one file `lessons/<id>.ts` exporting `lesson=defineLesson({...})`; the registry (lessons/index.ts)
 * discovers it, orders it by `order` and publishes CIRCUITS, FIRMWARE_SPEC, GOALS, READOUTS, LESSONS and the per-lesson UI tables.
 * Pure: type-only imports from the contract and one plain constants file, so a lesson file never creates an import cycle.
 */
import {MOTOR_MAX_RPM} from '../constants';
import type {Circuit,LedColor,ParamCType,ParamSpec,PartSpec,PartState,PinSample,SimSnapshot,UnoPin,VariantSpec,Wire,WireColor} from '../contract';

export {MOTOR_MAX_RPM};

// ---------- lesson text ----------
export type Copy={en:string;id:string};
export type Side='left'|'right'|'top'|'bottom';
export interface Lesson{
 id:string;n:number;
 title:Copy;tagline:Copy;
 overview:{body:Copy;bullets:{icon:string;text:Copy}[]};
 pinout:{pin:string;to:Copy;does:Copy}[];
 walkthrough:Copy[];
 specs:{k:Copy;v:Copy}[];
 callouts:{target:string;pin?:string;title:Copy;body:Copy;side:Side}[];
 params:Record<string,{label:Copy;unit:string;hint:Copy}>;
 variants?:Record<string,Copy>;
 goal:{text:Copy;hint:Copy};
 seo:{title:string;description:string};
}
export const c=(en:string,id:string):Copy=>({en,id});
export const co=(target:string,side:Side,te:string,ti:string,be:string,bi:string,pin?:string)=>({target,side,title:c(te,ti),body:c(be,bi),...(pin?{pin}:{})});
export const pinRow=(p:string,te:string,ti:string,de:string,di:string)=>({pin:p,to:c(te,ti),does:c(de,di)});
export const sp=(ke:string,ki:string,v:string,vi:string=v)=>({k:c(ke,ki),v:c(v,vi)});
export const b=(icon:string,en:string,id:string)=>({icon,text:c(en,id)});

// ---------- circuit helpers ----------
export const w=(componentId:string,pin:string,boardPin:Wire['boardPin'],color:WireColor):Wire=>({componentId,pin,boardPin,color});
export const GND_RAIL=w('bb','gnd-rail','GND','black');
export const RAILS:Wire[]=[w('bb','5v-rail','5V','red'),GND_RAIL];
/** An LED on `pin` with its series resistor `rId` (220 ohm). */
export const ledOn=(id:string,pin:UnoPin,color:LedColor,rId:string):PartSpec[]=>[{id,kind:'led',net:{A:pin,C:'GND'},props:{color}},{id:rId,kind:'resistor',net:{'1':pin},props:{ohms:220,seriesWith:id,role:'series'}}];
export const sonar=(distanceCm:number,shape:'box'|'car'|'ball'|'wall'):PartSpec[]=>[{id:'us1',kind:'hcsr04',net:{VCC:'5V',TRIG:'D7',ECHO:'D6',GND:'GND'},props:{}},{id:'obs1',kind:'obstacle',net:{},props:{target:'us1',distanceCm,shape}}];
export const SONAR_WIRES:Wire[]=[w('us1','VCC','5V','red'),w('us1','TRIG','D7','yellow'),w('us1','ECHO','D6','green'),w('us1','GND','GND','black')];
export const SEG_PINS:UnoPin[]=['D3','D4','D5','D6','D7','D8','D9'];
/** Firmware parameter: name, C type, default, min, max, step. The default must be a non-zero global in the sketch. */
export const P=(name:string,ctype:ParamCType,defaultValue:number,min:number,max:number,step:number):ParamSpec=>({name,ctype,defaultValue,min,max,step});

// ---------- goal helpers ----------
export type GoalMemory=Record<string,number>;
export type GoalFn=(s:SimSnapshot,m:GoalMemory)=>boolean;
export type ReadoutFn=(s:SimSnapshot)=>{target:string;text:string}[];
type Kind=PartState['kind'];
type Of<K extends Kind>=Extract<PartState,{kind:K}>;
export const entries=(s:SimSnapshot):[string,PartState][]=>Object.entries(s.parts);
export function byKind<K extends Kind>(s:SimSnapshot,kind:K,id?:string):Of<K>|null{
 if(id){const p=s.parts[id];if(p&&p.kind===kind)return p as Of<K>;}
 for(const [,p] of entries(s))if(p.kind===kind)return p as Of<K>;
 return null;
}
export function ledById(s:SimSnapshot,id:string):Of<'led'>|null{const p=s.parts[id];return p&&p.kind==='led'?p:null;}
/** Counts changes of a value under `key`; returns the running total. */
export function changes(m:GoalMemory,key:string,v:number):number{
 const last=m[key+':last'];
 if(last!==undefined&&last!==v)m[key+':n']=(m[key+':n']??0)+1;
 m[key+':last']=v;
 return m[key+':n']??0;
}
/** Spread (max-min) of the values seen so far under `key`. */
export function range(m:GoalMemory,key:string,v:number):number{
 m[key+':min']=Math.min(m[key+':min']??v,v);m[key+':max']=Math.max(m[key+':max']??v,v);
 return m[key+':max']-m[key+':min'];
}
export const pinOf=(s:SimSnapshot,name:string):PinSample|undefined=>(s.pins as Record<string,PinSample>)[name];
export type ExtV=Record<string,number|boolean|string|null>;
/** The typed state of the plugin device of a given kind, if the circuit has one. */
export function extOf(s:SimSnapshot,type:string):ExtV|null{
 for(const [,p] of entries(s))if(p.kind==='ext'&&p.type===type)return p.v;
 return null;
}
export function extId(s:SimSnapshot,type:string):string|null{
 for(const [id,p] of entries(s))if(p.kind==='ext'&&p.type===type)return id;
 return null;
}
/** The typed state of the DHT22 plugin device, if the circuit has one. */
export function dhtOf(s:SimSnapshot):{tempC:number;humidity:number;readT:number|null;readH:number|null}|null{
 for(const [,p] of entries(s))if(p.kind==='ext'&&p.type==='dht22')return p.v as unknown as {tempC:number;humidity:number;readT:number|null;readH:number|null};
 return null;
}
/** Number of lit pixels in the OLED frame (hex string of the 128x64 page buffer). */
export function oledLitPixels(fb:string):number{
 let n=0;
 for(let i=0;i<fb.length;i++){let v=parseInt(fb[i]!,16);while(v){n+=v&1;v>>=1;}}
 return n;
}
export const pill=(target:string,text:string)=>({target,text});
export function idOf(s:SimSnapshot,kind:Kind):string|null{for(const [id,p] of entries(s))if(p.kind===kind)return id;return null;}
export const LIT_LED:PartState={kind:'led',brightness:1,on:true,currentMa:12,overCurrent:false};

// ---------- the module ----------
/** One item of the card thumbnail tableau: a part kind placed `x` mm (and `z`) from the origin, optionally in a given state. */
export interface ThumbItem{kind:string;props?:Record<string,string|number|boolean>;x:number;z?:number;state?:PartState}
export interface LessonModule extends Omit<Lesson,'n'>{
 /** Sort key. Lessons are numbered 1..N by ascending `order`; leave gaps (10, 20, 30...) so lessons can be inserted. */
 order:number;
 circuit:Circuit;
 /** Sketch folders are `<id>-<variant.id>`; the first variant is the default. */
 firmware:{variants:VariantSpec[]};
 /** True once the learner has done what the lesson asks. `m` is memory that persists across frames of one run. */
 check:GoalFn;
 /** Value pills drawn next to parts while running (default none). */
 readouts?:ReadoutFn;
 /** Short chip shown on the lesson card, e.g. 'ONE-WIRE'. */
 concept:string;
 /** Board pins shown as logic-analyzer lanes, the most important first. */
 keyPins:string[];
 /** Pins the test record quotes (default: the first of keyPins that are board pins). */
 recordPins?:UnoPin[];
 /** SVG path data for the card icon, in a 32x32 box. Without it the card uses the built-in icon of the same id, else a chip. */
 icon?:string[];
 /** Card thumbnail tableau (default: the first two non-passive parts of the circuit), or 'uno' for the bare board. */
 thumbnail?:ThumbItem[]|'uno';
 /** Camera angle (degrees) and whether the breadboard is framed; default is the 'blink' view. */
 view?:{az:number;elev:number;board:boolean};
}
export const defineLesson=(m:LessonModule):LessonModule=>m;
