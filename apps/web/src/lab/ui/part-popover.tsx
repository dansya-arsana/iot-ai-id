import {useEffect,useId,useRef} from 'react';
import type {CSSProperties} from 'react';
import {useLang} from '../../i18n';
import type {ControlSpec,PartModule} from '../scene/parts/types';
import {PARTS_COPY} from '../parts-copy';
import './part-popover.css';

export type PopoverValue=string|number|boolean;
export interface PartPopoverProps{
 partId:string;
 module:PartModule;
 /** Replace the module's controls (threshold popovers: sliders mapped to firmware params). */
 controls?:readonly ControlSpec[];
 title?:string;
 desc?:string;
 /** Current values by control key (props merged with live sim inputs). */
 values:Readonly<Record<string,PopoverValue|undefined>>;
 /** Anchor in CSS px, relative to `bounds` (the canvas). */
 at:{x:number;y:number};
 bounds:{width:number;height:number};
 onChange(key:string,value:PopoverValue):void;
 /** "Zoom to it": the host calls scene.focusPart(partId). */
 onFocusPart():void;
 onClose():void;
}

const MARGIN=12;

function Range({c,value,onChange,label}:{c:Extract<ControlSpec,{type:'range'}>;value:number;onChange:(v:number)=>void;label:string}){
 const id=useId();
 const fill=((value-c.min)/(c.max-c.min))*100;
 return (
  <div className="lab-pop-field">
   <label htmlFor={id}><span>{label}</span><output htmlFor={id}>{Math.round(value)}{c.unit?` ${c.unit}`:''}</output></label>
   <input id={id} type="range" min={c.min} max={c.max} step={c.step} value={value} style={{'--fill':`${fill}%`} as CSSProperties}
    onChange={e=>onChange(Number(e.target.value))}/>
  </div>
 );
}

/** Generic part popover: renders a PartModule's interact.controls (choice chips, range sliders, toggles, actions). */
export function PartPopover({partId,module,controls:override,title,desc,values,bounds,onChange,onFocusPart,onClose}:PartPopoverProps){
 const {tr,lang}=useLang();
 const ref=useRef<HTMLDivElement>(null);
 const controls=override??module.interact?.controls??[];
 const titleId=useId();
 const line=desc??(()=>{const d=PARTS_COPY[module.kind]?.desc[lang]??'';const m=/^.*?[.!?](\s|$)/.exec(d);return (m?m[0]:d).trim();})();
 const draggable=!!module.interact?.drag&&module.interact.drag.handle!=='press';

 useEffect(()=>{
  const el=ref.current;
  const prev=document.activeElement as HTMLElement|null;
  el?.querySelector<HTMLElement>('input,button')?.focus({preventScroll:true});
  // pointer-down outside closes it, except on the 3D stage: dragging the part must keep the popover open and live
  const onDoc=(e:PointerEvent):void=>{const t=e.target as HTMLElement|null;if(el&&!el.contains(t)&&!t?.closest('canvas.lab-canvas,[data-testid=lab-run],.lab-rail-run,.lab-code-card,.lab-dock,.lab-viewbar,.lab-minimap'))onClose();};
  document.addEventListener('pointerdown',onDoc,true);
  return ()=>{document.removeEventListener('pointerdown',onDoc,true);if(prev&&prev.isConnected)prev.focus({preventScroll:true});};
 },[partId]); // eslint-disable-line react-hooks/exhaustive-deps

 const onKey=(e:React.KeyboardEvent):void=>{
  if(e.key==='Escape'){e.stopPropagation();onClose();return;}
  if(e.key!=='Tab')return;
  const f=[...(ref.current?.querySelectorAll<HTMLElement>('input,button')??[])];
  if(!f.length)return;
  const first=f[0]!,last=f[f.length-1]!;
  if(e.shiftKey&&document.activeElement===first){e.preventDefault();last.focus();}
  else if(!e.shiftKey&&document.activeElement===last){e.preventDefault();first.focus();}
 };

 return (
  <div ref={ref} className="lab-pop" role="dialog" aria-labelledby={titleId} data-testid={`lab-popover-${partId}`} 
   data-dock="top-left" style={{left:MARGIN,top:MARGIN,maxHeight:Math.max(160,bounds.height-MARGIN*2)}} onKeyDown={onKey}>
   <header className="lab-pop-head">
    <div><h2 id={titleId}>{title??module.name[lang]}</h2>{line&&<p className="lab-pop-desc">{line}</p>}</div>
    <button type="button" className="lab-x" aria-label={tr('Close','Tutup')} onClick={onClose}>
     <svg width="14" height="14" viewBox="0 0 14 14" aria-hidden="true"><path d="M2 2l10 10M12 2L2 12" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" fill="none"/></svg>
    </button>
   </header>
   <div className="lab-pop-body">
    {controls.map((c,i)=>{
     const label=c.label[lang];
     if(c.type==='choice'){
      const cur=String(values[c.key]??c.options[0]?.value);
      return (
       <div key={i} className="lab-pop-field" role="group" aria-label={label}>
        <span className="lab-pop-label">{label}</span>
        <div className="lab-pop-chips">
         {c.options.map(o=><button key={o.value} type="button" className="lab-pop-chip" aria-pressed={cur===o.value} data-testid={`lab-pop-${c.key}-${o.value}`} onClick={()=>onChange(c.key,o.value)}>{o.label[lang]}</button>)}
        </div>
       </div>
      );
     }
     if(c.type==='range')return <Range key={i} c={c} label={label} value={Number(values[c.key]??c.min)} onChange={v=>onChange(c.key,v)}/>;
     if(c.type==='toggle'){
      const on=values[c.key]===true;
      return (
       <label key={i} className="lab-pop-toggle"><span>{label}</span>
        <input className="lab-sw" type="checkbox" role="switch" checked={on} data-testid={`lab-pop-${c.key}`} onChange={e=>onChange(c.key,e.target.checked)}/>
       </label>
      );
     }
     return <button key={i} type="button" className="lab-btn-ghost lab-pop-action" data-testid="lab-pop-focus" onClick={onFocusPart}>{label}</button>;
    })}
    {draggable&&<p className="lab-pop-hint">{tr('or drag it in the scene','atau seret di adegan')}</p>}
   </div>
  </div>
 );
}
