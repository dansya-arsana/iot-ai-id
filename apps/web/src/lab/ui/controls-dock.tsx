import {useLang} from '../../i18n';
import {INPUT_RANGES} from '../contract';
import type {Circuit,PartInput} from '../contract';
import {Icon} from './icons';

export type Inputs=Record<string,PartInput>;

export function ControlsDock({circuit,inputs,onInput}:{circuit:Circuit;inputs:Inputs;onInput:(id:string,i:PartInput)=>void}){
 const {tr}=useLang();
 const items=circuit.parts.filter(p=>p.kind==='button'||p.kind==='potentiometer'||p.kind==='lamp'||p.kind==='obstacle');
 if(!items.length)return null;
 return (
  <div className="lab-dock">
   {items.map(p=>{
    const cur=inputs[p.id];
    if(p.kind==='button'){
     const pressed=cur?.kind==='button'&&cur.pressed;
     const set=(v:boolean)=>onInput(p.id,{kind:'button',pressed:v});
     return (
      <button key={p.id} type="button" className="lab-hold" data-testid={`lab-control-${p.id}`} data-pressed={pressed} aria-pressed={pressed} aria-label={tr('Hold button','Tahan tombol')}
       onPointerDown={e=>{e.currentTarget.setPointerCapture?.(e.pointerId);set(true);}} onPointerUp={()=>set(false)} onPointerCancel={()=>set(false)} onLostPointerCapture={()=>set(false)}
       onKeyDown={e=>{if((e.key===' '||e.key==='Enter')&&!e.repeat){e.preventDefault();set(true);}}} onKeyUp={e=>{if(e.key===' '||e.key==='Enter'){e.preventDefault();set(false);}}} onBlur={()=>{if(pressed)set(false);}}>
       <Icon name="button" size={18}/>{tr('Hold','Tahan')}
      </button>
     );
    }
    if(p.kind==='potentiometer'){
     const r=INPUT_RANGES.potentiometer,v=cur?.kind==='potentiometer'?cur.value:Number(p.props.value??512);
     return <label key={p.id} className="lab-slider" data-testid={`lab-control-${p.id}`}><span>{tr('Knob','Kenop')}</span>
      <input type="range" min={r.min} max={r.max} step={1} value={v} aria-label={tr('Knob','Kenop')} onChange={e=>onInput(p.id,{kind:'potentiometer',value:Number(e.target.value)})}/><output>{Math.round(v)}</output></label>;
    }
    if(p.kind==='lamp'){
     const r=INPUT_RANGES.lamp,c=cur?.kind==='lamp'?cur:null;
     const d=c?.distanceCm??Number(p.props.distanceCm??40),on=c?.on??Boolean(p.props.on??true);
     return (
      <div key={p.id} className="lab-slider" data-testid={`lab-control-${p.id}`}>
       <span>{tr('Lamp distance','Jarak lampu')}</span>
       <input type="range" min={r.min} max={r.max} step={1} value={d} aria-label={tr('Lamp distance','Jarak lampu')} onChange={e=>onInput(p.id,{kind:'lamp',distanceCm:Number(e.target.value),on})}/><output>{Math.round(d)} cm</output>
       <label className="lab-switch"><input type="checkbox" role="switch" checked={on} aria-label={tr('Lamp','Lampu')} onChange={e=>onInput(p.id,{kind:'lamp',distanceCm:d,on:e.target.checked})}/><span>{tr('Lamp','Lampu')}</span></label>
      </div>
     );
    }
    const r=INPUT_RANGES.obstacle,v=cur?.kind==='obstacle'?cur.distanceCm:Number(p.props.distanceCm??40);
    return <label key={p.id} className="lab-slider" data-testid={`lab-control-${p.id}`}><span>{tr('Obstacle distance','Jarak halangan')}</span>
     <input type="range" min={r.min} max={r.max} step={1} value={v} aria-label={tr('Obstacle distance','Jarak halangan')} onChange={e=>onInput(p.id,{kind:'obstacle',distanceCm:Number(e.target.value)})}/><output>{Math.round(v)} cm</output></label>;
   })}
  </div>
 );
}
