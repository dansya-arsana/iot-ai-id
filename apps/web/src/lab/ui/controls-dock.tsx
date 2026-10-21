import type {CSSProperties} from 'react';
import {useLang} from '../../i18n';
import {INPUT_RANGES} from '../contract';
import type {Circuit,PartInput} from '../contract';
import {Icon} from './icons';

export type Inputs=Record<string,PartInput>;

export function ControlsDock({circuit,inputs,onInput,hideId,visibleIds,fold,mobile,onOpen}:{circuit:Circuit;inputs:Inputs;onInput:(id:string,i:PartInput)=>void;hideId?:string|null;visibleIds?:ReadonlySet<string>|null;fold?:boolean;mobile?:boolean;onOpen?:(id:string)=>void}){
 const {tr}=useLang();
 const items=circuit.parts.filter(p=>p.kind==='button'||p.kind==='potentiometer'||p.kind==='lamp'||p.kind==='obstacle');
 // one source of truth: while the part popover is open, its slider replaces the dock's (kept in the DOM, visually collapsed)
 const folded=(p:{id:string;kind:string})=>!!fold||p.id===hideId||(!!visibleIds&&!visibleIds.has(p.id));
 if(!items.length)return null;
 return (
  <div className="lab-dock" data-folded={items.every(folded)}>
   {items.map(p=>{
    const cur=inputs[p.id];
    if(p.kind==='button'){
     const pressed=cur?.kind==='button'&&cur.pressed;
     const set=(v:boolean)=>onInput(p.id,{kind:'button',pressed:v});
     return (
      <button key={p.id} type="button" className="lab-hold" data-testid={`lab-control-${p.id}`} data-pressed={pressed} aria-pressed={pressed} aria-label={tr('Hold button','Tahan tombol')}
       onPointerDown={e=>{e.currentTarget.setPointerCapture?.(e.pointerId);set(true);}} onPointerUp={()=>set(false)} onPointerCancel={()=>set(false)} onLostPointerCapture={()=>set(false)}
       onKeyDown={e=>{if((e.key===' '||e.key==='Enter')&&!e.repeat){e.preventDefault();set(true);}}} onKeyUp={e=>{if(e.key===' '||e.key==='Enter'){e.preventDefault();set(false);}}} onBlur={()=>{if(pressed)set(false);}}>
       <Icon name="button" size={18}/>{tr('Hold to press','Tahan untuk menekan')}
      </button>
     );
    }
    // phones: a slider strip would bury the stage, so every analog control is a 32px chip that opens the part's popover sheet
    if(mobile&&onOpen){
     const val=p.kind==='potentiometer'?`A0 ${Math.round(cur?.kind==='potentiometer'?cur.value:Number(p.props.value??512))}`
      :p.kind==='lamp'?`${Math.round(cur?.kind==='lamp'&&cur.distanceCm!==undefined?cur.distanceCm:Number(p.props.distanceCm??40))} cm`
      :`${Math.round(cur?.kind==='obstacle'?cur.distanceCm:Number(p.props.distanceCm??40))} cm`;
     const name=p.kind==='potentiometer'?tr('Knob','Kenop'):p.kind==='lamp'?tr('Lamp','Lampu'):tr('Obstacle','Halangan');
     return <button key={p.id} type="button" className="lab-dockchip" data-folded={folded(p)} data-testid={`lab-control-${p.id}`} aria-label={`${name} ${val}`} onClick={()=>onOpen(p.id)}><Icon name={p.kind==='potentiometer'?'pot':p.kind==='lamp'?'sun':'sonar'} size={16}/><span>{name}</span><output>{val}</output></button>;
    }
    if(p.kind==='potentiometer'){
     const r=INPUT_RANGES.potentiometer,v=cur?.kind==='potentiometer'?cur.value:Number(p.props.value??512);
     return <label key={p.id} className="lab-slider" data-testid={`lab-control-${p.id}`}><span>{tr('Knob','Kenop')}</span><output>A0 {Math.round(v)}</output>
      <input className="lab-range" data-analog type="range" min={r.min} max={r.max} step={1} value={v} aria-label={tr('Knob','Kenop')} style={{'--fill':`${(v-r.min)/(r.max-r.min)*100}%`} as CSSProperties} onChange={e=>onInput(p.id,{kind:'potentiometer',value:Number(e.target.value)})}/></label>;
    }
    if(p.kind==='lamp'){
     const r=INPUT_RANGES.lamp,c=cur?.kind==='lamp'?cur:null;
     const d=c?.distanceCm??Number(p.props.distanceCm??40),on=c?.on??Boolean(p.props.on??true);
     return (
      <div key={p.id} className="lab-slider" data-testid={`lab-control-${p.id}`}>
       <span>{tr('Lamp distance','Jarak lampu')}</span><output>{Math.round(d)} cm</output>
       <input className="lab-range" data-analog type="range" min={r.min} max={r.max} step={1} value={d} aria-label={tr('Lamp distance','Jarak lampu')} style={{'--fill':`${(d-r.min)/(r.max-r.min)*100}%`} as CSSProperties} onChange={e=>onInput(p.id,{kind:'lamp',distanceCm:Number(e.target.value),on})}/>
       <label className="lab-switch"><input className="lab-sw" type="checkbox" role="switch" checked={on} aria-label={tr('Lamp','Lampu')} onChange={e=>onInput(p.id,{kind:'lamp',distanceCm:d,on:e.target.checked})}/><span>{tr('Lamp','Lampu')}</span></label>
      </div>
     );
    }
    const r=INPUT_RANGES.obstacle,v=cur?.kind==='obstacle'?cur.distanceCm:Number(p.props.distanceCm??40);
    return <label key={p.id} className="lab-slider" data-folded={folded(p)} data-testid={`lab-control-${p.id}`}><span>{tr('Obstacle distance','Jarak halangan')}</span><output>{Math.round(v)} cm</output>
     <input className="lab-range" data-analog type="range" min={r.min} max={r.max} step={1} value={v} aria-label={tr('Obstacle distance','Jarak halangan')} style={{'--fill':`${(v-r.min)/(r.max-r.min)*100}%`} as CSSProperties} onChange={e=>onInput(p.id,{kind:'obstacle',distanceCm:Number(e.target.value)})}/></label>;
   })}
  </div>
 );
}
