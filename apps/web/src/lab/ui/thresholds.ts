import type {LessonId} from '../contract';
import type {Copy} from '../lessons';
import type {ControlSpec} from '../scene/parts/types';

const c=(en:string,id:string):Copy=>({en,id});
/** Lessons whose firmware has threshold constants, and the parts that stand for them. A click on such a part opens the threshold popover. */
export interface ThresholdSpec{
 title:Copy;desc:Copy;
 parts:Record<string,readonly string[]>;
 /** Param name -> the way it reads on the slider. */
 labels:Record<string,{label:Copy;unit:string}>;
}
export const THRESHOLDS:Partial<Record<LessonId,ThresholdSpec>>={
 parking:{
  title:c('Traffic light','Lampu lalu lintas'),
  desc:c('Green when the car is far, red when it is close. Move the limits and the lights follow.','Hijau saat mobil jauh, merah saat dekat. Geser batasnya dan lampu mengikuti.'),
  parts:{ledG:['nearCm','farCm'],ledY:['nearCm','farCm'],ledR:['nearCm','farCm']},
  labels:{nearCm:{label:c('Red within','Merah dalam'),unit:'cm'},farCm:{label:c('Green beyond','Hijau di luar'),unit:'cm'}},
 },
 light:{
  title:c('Night light','Lampu malam'),
  desc:c('The lamp turns on when the sensor reads darker than this limit.','Lampu menyala saat sensor membaca lebih gelap dari batas ini.'),
  parts:{led1:['threshold']},
  labels:{threshold:{label:c('Dark below','Gelap di bawah'),unit:'ADC'}},
 },
};

export interface ParamDef{name:string;min:number;max:number;step:number}
/** Slider controls for a threshold part, from the open variant's patchable params. Null when the part has none. */
export function thresholdControls(lesson:LessonId,partId:string,params:readonly ParamDef[]):{spec:ThresholdSpec;controls:ControlSpec[]}|null{
 const spec=THRESHOLDS[lesson];const names=spec?.parts[partId];
 if(!spec||!names)return null;
 const controls:ControlSpec[]=[];
 for(const n of names){
  const p=params.find(x=>x.name===n),l=spec.labels[n];
  if(p&&l)controls.push({type:'range',key:n,label:l.label,min:p.min,max:p.max,step:p.step,unit:l.unit});
 }
 return controls.length?{spec,controls}:null;
}
