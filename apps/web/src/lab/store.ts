import type {LessonId,ParamValues,PartInput,PartProps} from './contract';

export interface LessonValues{variant:string;params:ParamValues;props:Record<string,PartProps>;inputs:Record<string,PartInput>}
export interface LabSettings{labels:boolean;grid:boolean;sound:boolean;volume:number;reducedMotion:boolean;autoRotate:boolean}

const K={done:'iot-lab:done',values:'iot-lab:values',settings:'iot-lab:settings',last:'iot-lab:last',serial:'iot-lab:serial-h'};

function read<T>(key:string,fallback:T):T{
 try{const raw=localStorage.getItem(key);return raw===null?fallback:JSON.parse(raw) as T;}catch{return fallback;}
}
function write(key:string,v:unknown){try{localStorage.setItem(key,JSON.stringify(v));}catch{/* storage unavailable */}}

export function loadDone():LessonId[]{const d=read<unknown>(K.done,[]);return Array.isArray(d)?d as LessonId[]:[];}
export function markDone(id:LessonId):LessonId[]{const d=loadDone();if(!d.includes(id))d.push(id);write(K.done,d);return d;}
export function resetProgress(){try{localStorage.removeItem(K.done);localStorage.removeItem(K.values);}catch{/* ignore */}}

export function loadLessonValues(id:LessonId):LessonValues|null{
 const all=read<Partial<Record<LessonId,LessonValues>>>(K.values,{});
 return all[id]??null;
}
export function saveLessonValues(id:LessonId,v:LessonValues){
 const all=read<Partial<Record<LessonId,LessonValues>>>(K.values,{});
 all[id]=v;write(K.values,all);
}

export function defaultSettings():LabSettings{
 let rm=false;
 try{rm=typeof matchMedia==='function'&&matchMedia('(prefers-reduced-motion: reduce)').matches;}catch{/* ignore */}
 return {labels:true,grid:true,sound:true,volume:.5,reducedMotion:rm,autoRotate:false};
}
export function loadSettings():LabSettings{
 const d=defaultSettings();
 const s=read<Partial<LabSettings>>(K.settings,{});
 return {...d,...(s&&typeof s==='object'?s:{})};
}
export function saveSettings(s:LabSettings){write(K.settings,s);}

export function lastLesson():LessonId|null{const v=read<string|null>(K.last,null);return typeof v==='string'?v as LessonId:null;}
export function setLastLesson(id:LessonId){write(K.last,id);}

export function loadSerialHeight():number{const v=read<number>(K.serial,160);return typeof v==='number'&&v>=80?v:160;}
export function saveSerialHeight(h:number){write(K.serial,h);}
