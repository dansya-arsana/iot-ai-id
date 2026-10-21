import {MOTOR_MAX_RPM} from './contract';
import type {LessonId,PartState,PinSample,SimSnapshot} from './contract';

export type GoalMemory=Record<string,number>;

type Kind=PartState['kind'];
type Of<K extends Kind>=Extract<PartState,{kind:K}>;
const entries=(s:SimSnapshot):[string,PartState][]=>Object.entries(s.parts);
function byKind<K extends Kind>(s:SimSnapshot,kind:K,id?:string):Of<K>|null{
 if(id){const p=s.parts[id];if(p&&p.kind===kind)return p as Of<K>;}
 for(const [,p] of entries(s))if(p.kind===kind)return p as Of<K>;
 return null;
}
function ledById(s:SimSnapshot,id:string):Of<'led'>|null{const p=s.parts[id];return p&&p.kind==='led'?p:null;}
/** Counts changes of a value under `key`; returns the running total. */
function changes(m:GoalMemory,key:string,v:number):number{
 const last=m[key+':last'];
 if(last!==undefined&&last!==v)m[key+':n']=(m[key+':n']??0)+1;
 m[key+':last']=v;
 return m[key+':n']??0;
}
function range(m:GoalMemory,key:string,v:number):number{
 m[key+':min']=Math.min(m[key+':min']??v,v);m[key+':max']=Math.max(m[key+':max']??v,v);
 return m[key+':max']-m[key+':min'];
}
const pin=(s:SimSnapshot,name:string):PinSample|undefined=>(s.pins as Record<string,PinSample>)[name];

export const GOALS:Record<LessonId,(s:SimSnapshot,m:GoalMemory)=>boolean>={
 board:(s,m)=>changes(m,'d13',pin(s,'D13')?.level??0)>=4,
 blink:(s,m)=>{const l=ledById(s,'led1')??byKind(s,'led');return !!l&&changes(m,'on',l.on?1:0)>=4;},
 button:(s,m)=>{
  const b=byKind(s,'button'),l=ledById(s,'led1')??byKind(s,'led');
  if(!b||!l)return false;
  if(b.pressed&&l.on)m.lit=1;
  if(m.lit&&!l.on)m.off=1;
  return !!m.lit&&!!m.off;
 },
 knob:(s,m)=>{
  const p=byKind(s,'potentiometer'),l=ledById(s,'led1')??byKind(s,'led');
  if(!p||!l)return false;
  const pr=range(m,'pot',p.value),br=range(m,'br',l.brightness);
  return pr>=300&&br>=0.5;
 },
 rgb:(s)=>{const r=byKind(s,'rgb-led');return !!r&&s.simTimeMs>=1000&&r.r+r.g+r.b>0.3;},
 light:(s,m)=>{const l=ledById(s,'led1')??byKind(s,'led');return !!l&&changes(m,'on',l.on?1:0)>=1;},
 distance:(s,m)=>{
  const h=byKind(s,'hcsr04');
  if(!h)return false;
  const was=m.ping??0;
  if(was&&!h.pinging&&h.echoCm!==null){
   m.seen=(m.seen??0)+1;m.lastEcho=h.echoCm;
   if(m.first===undefined)m.first=h.echoCm;else if(Math.abs(h.echoCm-m.first)>=1)m.distinct=1;
  }
  m.ping=h.pinging?1:0;
  return (m.seen??0)>=3&&!!m.distinct;
 },
 sound:(s,m)=>{
  const b=byKind(s,'buzzer');
  if(b&&b.on&&b.freqHz>0)m['f:'+Math.round(b.freqHz/10)*10]=1;
  return Object.keys(m).filter(k=>k.startsWith('f:')).length>=2;
 },
 motor:(s)=>{const mo=byKind(s,'motor');return !!mo&&mo.rpm>=0.5*MOTOR_MAX_RPM;},
 servo:(s,m)=>{const v=byKind(s,'servo');return !!v&&range(m,'ang',v.angleDeg)>=90;},
 parking:(s,m)=>{
  const r=ledById(s,'ledR'),g=ledById(s,'ledG'),h=byKind(s,'hcsr04');
  if(r?.on){m.r=1;if(h?.echoCm!=null&&m.rAt===undefined)m.rAt=h.echoCm;}
  if(g?.on){m.g=1;if(h?.echoCm!=null&&m.gAt===undefined)m.gAt=h.echoCm;}
  return !!m.r&&!!m.g;
 },
};

const pill=(target:string,text:string)=>({target,text});
function idOf(s:SimSnapshot,kind:Kind):string|null{for(const [id,p] of entries(s))if(p.kind===kind)return id;return null;}

export const READOUTS:Record<LessonId,(s:SimSnapshot)=>{target:string;text:string}[]>={
 board:()=>[],
 blink:()=>[],
 button:()=>[],
 knob:s=>{const p=byKind(s,'potentiometer'),id=idOf(s,'potentiometer');return p&&id?[pill(id,`A0 ${Math.round(p.value)} → PWM ${Math.round(p.value/4)} (${Math.round(p.value/1023*100)}%)`)]:[];},
 rgb:s=>{
  const r=byKind(s,'rgb-led'),id=idOf(s,'rgb-led');
  return r&&id?[pill(id,`R ${Math.round(r.r*255)} · G ${Math.round(r.g*255)} · B ${Math.round(r.b*255)}`)]:[];
 },
 light:s=>{const l=byKind(s,'ldr'),id=idOf(s,'ldr');return l&&id?[pill(id,`light ${Math.round(l.adc)}`)]:[];},
 distance:s=>{const h=byKind(s,'hcsr04'),id=idOf(s,'hcsr04');return h&&id&&h.echoCm!==null?[pill(id,`${Math.round(h.echoCm)} cm`)]:[];},
 sound:s=>{const b=byKind(s,'buzzer'),id=idOf(s,'buzzer');return b&&id&&b.on?[pill(id,`♪ ${Math.round(b.freqHz)} Hz`)]:[];},
 motor:s=>{
  const m=byKind(s,'motor'),id=idOf(s,'motor');
  return m&&id?[pill(id,`${Math.round(m.duty*100)}% · ${Math.round(m.rpm)} rpm`)]:[];
 },
 servo:s=>{const v=byKind(s,'servo'),id=idOf(s,'servo');return v&&id?[pill(id,`${Math.round(v.angleDeg)}°`)]:[];},
 parking:s=>{
  const h=byKind(s,'hcsr04'),hid=idOf(s,'hcsr04'),l=ledById(s,'ledR');
  const out:{target:string;text:string}[]=[];
  if(h&&hid&&h.echoCm!==null)out.push(pill(hid,`${Math.round(h.echoCm)} cm`));
  if(l?.on)out.push(pill('ledR',`${l.currentMa.toFixed(1)} mA`));
  return out;
 },
};
