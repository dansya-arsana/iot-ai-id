import {useLang} from '../../i18n';
import type {Circuit,PartKind} from '../contract';
import {PARTS_COPY} from '../parts-copy';
import {Icon} from './icons';

const KIND_ICON:Record<PartKind,string>={led:'led',resistor:'resistor',button:'button',potentiometer:'pot',ldr:'sun','rgb-led':'rgb',lamp:'sun',hcsr04:'sonar',obstacle:'parking',buzzer:'note',transistor:'chip',diode:'chip',motor:'motor',servo:'horn'};
const FEATURE_ICON=(k:string):string=>k.includes('mcu')||k.includes('chip')||k.includes('crystal')?'chip':k.includes('led')?'led':k.includes('usb')||k.includes('jack')||k.includes('icsp')?'port':k.includes('reset')?'reset':k.includes('power')?'bolt':'wave';
const firstSentence=(s:string):string=>{const m=/^.*?[.!?](\s|$)/.exec(s);return (m?m[0]:s).trim();};

const BOARD_ROWS=['uno.mcu','uno.usb','uno.power-jack','uno.reset','uno.led-l','uno.digital-header','uno.analog-header','uno.power-header'] as const;
export interface ComponentRow{id:string;icon:string;name:string;line:string}
export function componentRows(circuit:Circuit,lang:'en'|'id'):ComponentRow[]{
 const rows:ComponentRow[]=[];
 for(const p of circuit.parts){
  const copy=PARTS_COPY[p.kind];if(!copy)continue;
  const tag=typeof p.props.color==='string'?` · ${p.props.color}`:typeof p.props.ohms==='number'?` · ${p.props.ohms} Ω`:'';
  rows.push({id:p.id,icon:KIND_ICON[p.kind]??'chip',name:copy.name[lang]+tag,line:firstSentence(copy.desc[lang])});
 }
 for(const k of BOARD_ROWS){
  const copy=PARTS_COPY[k];if(!copy)continue;
  rows.push({id:k,icon:FEATURE_ICON(k),name:copy.name[lang],line:firstSentence(copy.desc[lang])});
 }
 return rows;
}

/** "COMPONENTS · N in view": every part in the open lesson plus the board's own features. A row focuses its part. */
export function ComponentsPanel({circuit,active,onFocus}:{circuit:Circuit;active:string|null;onFocus:(id:string)=>void}){
 const {tr,lang}=useLang();
 const rows=componentRows(circuit,lang);
 const nParts=circuit.parts.length;
 return (
  <div className="lab-comp" data-testid="lab-components">
   <div className="lab-comp-head"><h2>{tr('Components','Komponen')}</h2><span data-testid="lab-components-count">{tr(`${rows.length} in view`,`${rows.length} terlihat`)}</span></div>
   <ul className="lab-comp-list">
    {rows.map((r,i)=>(
     <li key={r.id}>
      {i===nParts&&nParts>0&&<div className="lab-comp-sep">{tr('On the board','Di papan')}</div>}
      <button type="button" className="lab-comp-row" aria-current={active===r.id} data-testid={`lab-comp-${r.id}`} onClick={()=>onFocus(r.id)}>
       <span className="lab-comp-tile"><Icon name={r.icon} size={20}/></span>
       <span className="lab-comp-text"><strong>{r.name}</strong><span>{r.line}</span></span>
      </button>
     </li>
    ))}
   </ul>
  </div>
 );
}
