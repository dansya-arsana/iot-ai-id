import {Link} from 'react-router-dom';
import {useLang} from '../../i18n';
import type {LessonId,PartState,SimSnapshot,UnoPin} from '../contract';
import {PWM_PINS} from '../contract';
import {fmtCycles,fmtTime} from './chip-pill';
import type {PinHistory} from './pin-history';

export interface RecordRow{k:string;v:string}
export interface TestRecordData{lesson:LessonId;n:number;tMs:number;rows:RecordRow[];firmware:string}

const ms1=(n:number)=>`${n.toFixed(1)} ms`;
/** What one pin did, using only emulator measurements. */
function pinRows(h:PinHistory,pin:UnoPin,s:SimSnapshot):RecordRow[]{
 const ps=s.pins[pin],m=h.measure(pin);
 if(ps.analog!==null&&pin.startsWith('A'))return [{k:pin,v:`ADC ${Math.round(ps.analog)} / 1023`}];
 if(PWM_PINS.includes(pin)&&ps.mode==='output'&&ps.duty>0.01&&ps.duty<0.99)return [{k:`${pin} PWM`,v:`${(ps.duty*100).toFixed(1)}% · ${Math.round(ps.freqHz)} Hz`}];
 const rows:RecordRow[]=[{k:`${pin} toggled`,v:`${m.toggles}×`}];
 if(m.highMs!==null)rows.push({k:'high',v:`${ms1(m.highMs)} ✓ cycle-exact`});
 if(m.periodMs!==null)rows.push({k:'period',v:`≈${Math.round(m.periodMs)} ms`});
 return rows;
}
const part=<K extends PartState['kind']>(s:SimSnapshot,kind:K)=>Object.values(s.parts).find(p=>p.kind===kind) as Extract<PartState,{kind:K}>|undefined;

const KEY:Record<LessonId,UnoPin[]>={
 board:['D13'],blink:['D8'],button:['D8'],knob:['D9'],rgb:['D9','D10','D11'],light:['A1'],distance:['D7'],sound:['D5'],motor:['D6'],servo:['D9'],parking:['D7','D12'],dht:['D2'],
};
const pwmRows=(s:SimSnapshot):RecordRow[]=>{
 const ch=(['D9','D10','D11'] as UnoPin[]).map(p=>`${p} ${Math.round(s.pins[p].duty*100)}%`);
 const hz=Math.max(...(['D9','D10','D11'] as UnoPin[]).map(p=>s.pins[p].freqHz));
 const rows:RecordRow[]=[{k:'PWM duty',v:ch.join(' · ')}];
 if(hz>0)rows.push({k:'carrier',v:`${Math.round(hz)} Hz`});
 return rows;
};
const generic=(id:LessonId)=>(h:PinHistory,s:SimSnapshot):RecordRow[]=>{
 const rows=id==='rgb'?pwmRows(s):KEY[id].flatMap(p=>pinRows(h,p,s));
 const h1=part(s,'hcsr04');if(h1&&h1.echoCm!==null)rows.push({k:'echo',v:`${Math.round(h1.echoCm)} cm`});
 const b=part(s,'buzzer');if(b&&b.on)rows.push({k:'tone',v:`${Math.round(b.freqHz)} Hz`});
 const m=part(s,'motor');if(m)rows.push({k:'motor',v:`${Math.round(m.rpm)} rpm`});
 const sv=part(s,'servo');if(sv)rows.push({k:'servo',v:`${Math.round(sv.angleDeg)}° · ${Math.round(sv.pulseUs)} µs`});
 const dh=Object.values(s.parts).find(p=>p.kind==='ext'&&p.type==='dht22');
 if(dh&&dh.kind==='ext'&&dh.v.readT!==null)rows.push({k:'dht22',v:`${dh.v.readT} °C · ${dh.v.readH} %RH`});
 rows.push({k:'at',v:`t=${fmtTime(s.simTimeMs)} · ${fmtCycles(s.simTimeMs)} cyc`});
 return rows.slice(0,5);
};
type Rec=(h:PinHistory,s:SimSnapshot,m:Record<string,number>)=>RecordRow[];
const at=(s:SimSnapshot):RecordRow=>({k:'at',v:`t=${fmtTime(s.simTimeMs)} · ${fmtCycles(s.simTimeMs)} cyc`});
const distanceRec:Rec=(_h,s,m)=>{
 const e=part(s,'hcsr04');
 return [{k:'echo',v:m.first!==undefined&&m.lastEcho!==undefined?`${Math.round(m.first)} cm → ${Math.round(m.lastEcho)} cm`:`${Math.round(e?.echoCm??0)} cm`},at(s)];
};
const parkingRec:Rec=(_h,s,m)=>[
 {k:'lights',v:m.rAt!==undefined&&m.gAt!==undefined?`red at ${Math.round(m.rAt)} cm · green at ${Math.round(m.gAt)} cm`:'red + green seen'},at(s)];
export const RECORDS:Record<LessonId,Rec>={
 board:generic('board'),blink:generic('blink'),button:generic('button'),knob:generic('knob'),rgb:generic('rgb'),light:generic('light'),
 distance:distanceRec,sound:generic('sound'),motor:generic('motor'),servo:generic('servo'),parking:parkingRec,dht:generic('dht'),
};
/** The sentence the Goal row quotes on a pass. */
export const quoteOf=(rows:RecordRow[])=>rows.filter(r=>r.k!=='at').slice(0,2).map(r=>`${r.k} ${r.v}`).join(' · ');

export function TestRecord({rec,onShowSignals}:{rec:TestRecordData;onShowSignals:()=>void}){
 const {tr}=useLang();
 return (
  <div className="lab-record" data-testid="lab-test-record" role="status">
   <p className="lab-record-line"><span className="lab-pass"><i/>PASS</span><span>{quoteOf(rec.rows).replace(' ✓ cycle-exact','')}</span></p>
   <div className="lab-record-main">
    <header><span className="lab-eyebrow lab-eyebrow--scope">TEST RECORD · LESSON {String(rec.n).padStart(2,'0')}</span><span className="lab-pass"><i/>PASS</span></header>
    <dl>{rec.rows.map((r,i)=><div key={i}><dt>{r.k}</dt><dd>{r.v}</dd></div>)}</dl>
    <p className="lab-record-fw">{rec.firmware}</p>
   </div>
   <div className="lab-record-actions">
    <Link className="lab-record-cta" to="/mitra">{tr('Try it on a real Uno →','Coba di Uno asli →')}</Link>
    <button type="button" className="lab-record-ghost" onClick={onShowSignals}>{tr('Show signals','Lihat sinyal')}</button>
   </div>
  </div>
 );
}
