import {useEffect,useRef} from 'react';
import {useLang} from '../../i18n';
import {FIRMWARE_SPEC} from '../contract';
import type {Circuit,LessonId,ParamValues,PartInput,PartProps,PartSpec} from '../contract';
import type {Lesson} from '../lessons';
import {partCopy} from '../parts-copy';
import type {StageApi} from './frame';
import {Icon} from './icons';

export type InspectTarget={type:'part';id:string}|{type:'param';name:string}|{type:'board';id:string};
const COLORS=['red','yellow','green','blue','white'] as const;
const SWATCH:Record<string,string>={red:'crimson',yellow:'gold',green:'limegreen',blue:'royalblue',white:'white'};
const OHMS=[47,100,220,330,1000,10000];
const ohmLabel=(o:number)=>o>=1000?`${o/1000}k`:String(o);
const W=300;

export function Inspector({target,lesson,lessonId,circuit,variantId,params,overCurrent,api,onClose,onParam,onVariant,onProps,onInput,onFocus}:{
 target:InspectTarget;lesson:Lesson;lessonId:LessonId;circuit:Circuit;variantId:string;params:ParamValues;overCurrent:boolean;api:StageApi;
 onClose:()=>void;onParam:(n:string,v:number)=>void;onVariant:(v:string)=>void;onProps:(id:string,p:PartProps)=>void;onInput:(id:string,i:PartInput)=>void;onFocus:(id:string)=>void;
}){
 const {tr,lang}=useLang();
 const card=useRef<HTMLDivElement>(null);
 const line=useRef<SVGLineElement>(null);
 const targetId=target.type==='param'?null:target.type==='part'?target.id:target.id;
 useEffect(()=>api.subscribe(()=>{
  const el=card.current,stage=api.stage(),scene=api.getScene();
  if(!el||!stage)return;
  const SW=stage.clientWidth,SH=stage.clientHeight,h=el.offsetHeight;
  const p=targetId&&scene?scene.project(targetId):null;
  let x=SW-W-16,y=16;
  if(p&&p.visible){x=Math.min(SW-W-12,Math.max(12,p.x+44));y=Math.min(SH-h-12,Math.max(12,p.y-h/2));}
  el.style.transform=`translate(${x.toFixed(1)}px,${y.toFixed(1)}px)`;
  const ln=line.current;
  if(ln){
   if(p&&p.visible){
    const ax=Math.min(Math.max(p.x,x),x+W),ay=Math.min(Math.max(p.y,y),y+h);
    ln.setAttribute('x1',ax.toFixed(1));ln.setAttribute('y1',ay.toFixed(1));ln.setAttribute('x2',p.x.toFixed(1));ln.setAttribute('y2',p.y.toFixed(1));ln.style.opacity='1';
   }else ln.style.opacity='0';
  }
 }),[api,targetId]);
 const part:PartSpec|undefined=target.type==='part'?circuit.parts.find(p=>p.id===target.id):undefined;
 const key=target.type==='board'?target.id:part?part.kind:'';
 const copy=partCopy(key);
 const spec=FIRMWARE_SPEC[lessonId].variants.find(v=>v.id===variantId)??FIRMWARE_SPEC[lessonId].variants[0];
 const paramNames=target.type==='param'?[target.name]:[];
 const showVariant=!!lesson.variants&&(target.type==='param'||part?.kind==='button'||part?.kind==='buzzer');
 const hasControls=paramNames.length>0||showVariant||(part&&['led','resistor','lamp'].includes(part.kind));
 const title=target.type==='param'?(lesson.params[target.name]?.label[lang]??target.name):copy.name[lang];
 const desc=target.type==='param'?(lesson.params[target.name]?.hint[lang]??''):copy.desc[lang];
 return (
  <>
   <svg className="lab-leaders lab-leaders-insp" aria-hidden="true"><line ref={line} className="lab-leader" opacity="0"/></svg>
   <div ref={card} className="lab-inspector" role="dialog" aria-label={title} data-testid="lab-inspector" data-target={targetId??`param:${target.type==='param'?target.name:''}`} style={{width:W}}>
    <header><span className="lab-tile lab-tile--lg"><Icon name={target.type==='param'?'code':({led:'led',resistor:'resistor',potentiometer:'pot',hcsr04:'sonar',servo:'horn',buzzer:'note',button:'button',ldr:'sun',lamp:'sun','rgb-led':'rgb',motor:'motor'} as Record<string,string>)[part?.kind??'']??'chip'} size={18}/></span><strong>{title}</strong><button type="button" className="lab-x" aria-label={tr('Close','Tutup')} onClick={onClose}><Icon name="close" size={14}/></button></header>
    <p>{desc}</p>
    {paramNames.map(n=>{
     const ps=spec.params.find(p=>p.name===n);if(!ps)return null;
     const v=params[n]??ps.defaultValue;
     return (
      <label key={n} className="lab-field">
       <span>{lesson.params[n]?.label[lang]??n} <small>{lesson.params[n]?.unit}</small></span>
       <span className="lab-field-row"><input type="range" data-testid={`lab-param-${n}`} min={ps.min} max={ps.max} step={ps.step} value={v} aria-label={lesson.params[n]?.label[lang]??n} onChange={e=>onParam(n,Number(e.target.value))}/><output>{v}</output></span>
      </label>
     );
    })}
    {showVariant&&lesson.variants&&<div className="lab-seg" role="radiogroup" aria-label={tr('Mode','Mode')}>
     {Object.entries(lesson.variants).map(([id,c])=><button key={id} type="button" role="radio" aria-checked={id===variantId} data-active={id===variantId} onClick={()=>onVariant(id)}>{c[lang]}</button>)}
    </div>}
    {part?.kind==='led'&&<div className="lab-field"><span>{tr('Colour','Warna')}</span><div className="lab-swatches">
     {COLORS.map(c=><button key={c} type="button" className={`lab-swatch lab-swatch--${c}`} style={{background:SWATCH[c]}} aria-label={c} aria-pressed={part.props.color===c} onClick={()=>onProps(part.id,{...part.props,color:c})}/>)}
    </div></div>}
    {part?.kind==='resistor'&&<div className="lab-field"><span>{tr('Resistance (ohms)','Hambatan (ohm)')}</span><div className="lab-seg">
     {OHMS.map(o=><button key={o} type="button" data-active={Number(part.props.ohms)===o} onClick={()=>onProps(part.id,{...part.props,ohms:o})}>{ohmLabel(o)}</button>)}
    </div>{overCurrent&&<small className="lab-warn" role="alert">{tr('Too much current: this LED can burn out.','Arus terlalu besar: LED ini bisa terbakar.')}</small>}</div>}
    {part?.kind==='lamp'&&<label className="lab-switch"><input type="checkbox" role="switch" checked={Boolean(part.props.on??true)} onChange={e=>{onProps(part.id,{...part.props,on:e.target.checked});onInput(part.id,{kind:'lamp',on:e.target.checked});}}/><span>{tr('Lamp on','Lampu menyala')}</span></label>}
    {(part&&['led','resistor','lamp'].includes(part.kind))&&<small className="lab-hw">{tr('This is hardware, not code','Ini perangkat keras, bukan kode')}</small>}
    {!hasControls&&copy.note&&<small className="lab-hw">{copy.note[lang]}</small>}
    <footer>
     {targetId&&<button type="button" className="lab-btn-ghost" onClick={()=>onFocus(targetId)}>{tr('Zoom to it','Dekati')}</button>}
     <span>{tr('Esc to close','Esc untuk menutup')}</span>
    </footer>
   </div>
  </>
 );
}
