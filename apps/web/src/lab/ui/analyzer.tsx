import {useEffect,useRef} from 'react';
import type {MutableRefObject} from 'react';
import {useLang} from '../../i18n';
import {PWM_PINS} from '../contract';
import type {LessonId,PinSample,UnoPin} from '../contract';
import {fmtCycles,fmtTime} from './chip-pill';
import type {StageApi} from './frame';
import {PortMap} from './port-map';
import {SerialHeader,SerialLog} from './serial-monitor';
import type {SerialSeg} from './serial-monitor';
import {TestRecord} from './test-record';
import type {TestRecordData} from './test-record';

export const WINDOW_MS=2000;
/** Key pin first, so the lane that matters for the lesson is always on top. */
const KEY:Record<LessonId,string[]>={
 board:['D13'],blink:['D8'],button:['D8','D2'],knob:['D9','A0'],rgb:['D9','D10','D11'],light:['A1','D8'],
 distance:['D7','D6'],sound:['D5'],motor:['D6'],servo:['D9'],parking:['D7','D6','D12','D10','D11','D5'],dht:['D2'],
};
const LABEL:Partial<Record<string,string>>={D7:'TRIG',D6:'ECHO'};
export function lanesFor(id:LessonId,livePins:string[],tx:boolean,max:number,ai=false):{lanes:string[];more:number}{
 const key=ai?[]:KEY[id];
 const all=[...new Set([...key,...livePins.filter(p=>p!=='D1'&&p!=='D0')])].filter(p=>(!ai&&id==='parking')||key.includes(p)||livePins.includes(p));
 const room=tx?max-1:max;
 const lanes=all.slice(0,room);
 if(tx)lanes.push('TX');
 return {lanes,more:Math.max(0,all.length-room)};
}

interface Colors{live:string;dim:string;pwm:string;grid:string;ink:string}
function readColors(el:HTMLElement):Colors{
 const cs=getComputedStyle(el),g=(n:string)=>cs.getPropertyValue(n).trim();
 return {live:g('--lab-live'),dim:g('--lab-on-scope-2'),pwm:g('--lab-pwm'),grid:g('--lab-scope-grid'),ink:g('--lab-on-scope')};
}

function Lane({pin,api,reduced,markerRef,txRef}:{pin:string;api:StageApi;reduced:boolean;markerRef:MutableRefObject<number|null>;txRef:MutableRefObject<{t:number;on:number}[]>}){
 const cv=useRef<HTMLCanvasElement>(null);
 useEffect(()=>{
  const c=cv.current;if(!c)return;
  const ctx=c.getContext('2d');if(!ctx)return;
  let col=readColors(c),w=0,h=0,last=0;
  const fit=()=>{
   const r=c.getBoundingClientRect(),k=c.offsetWidth?r.width/c.offsetWidth:1;
   const dpr=Math.min(2,(window.devicePixelRatio||1)*k);
   w=c.clientWidth;h=c.clientHeight;
   c.width=Math.max(1,Math.round(w*dpr));c.height=Math.max(1,Math.round(h*dpr));
   ctx.setTransform(dpr,0,0,dpr,0,0);col=readColors(c);last=0;
  };
  fit();
  const ro=new ResizeObserver(fit);ro.observe(c);
  const draw=()=>{
   const snap=api.snapshot();
   const now=snap?snap.simTimeMs:0;
   const x=(t:number)=>(t-(now-WINDOW_MS))/WINDOW_MS*w;
   ctx.clearRect(0,0,w,h);
   ctx.lineWidth=1;ctx.strokeStyle=col.grid;ctx.beginPath();
   for(let k=1;k<4;k++){const gx=Math.round(k*w/4)+.5;ctx.moveTo(gx,0);ctx.lineTo(gx,h);}
   ctx.stroke();
   const yH=4,yL=h-4;
   const segs:{a:number;b:number;v:number}[]=[];
   let kind:'dig'|'pwm'|'ana'|'tx'='dig';
   if(pin==='TX'){
    kind='tx';
    const a=txRef.current;
    for(let i=0;i<a.length;i++){const t0=a[i].t,t1=i+1<a.length?a[i+1].t:now;if(t1>=now-WINDOW_MS)segs.push({a:x(Math.max(t0,now-WINDOW_MS)),b:x(t1),v:a[i].on});}
   }else{
    const tr=api.history().trace(pin as UnoPin),n=tr.n,cap=tr.t.length;
    const ps:PinSample|undefined=snap?.pins[pin as UnoPin];
    if(ps&&ps.mode==='output'&&PWM_PINS.includes(pin as UnoPin)&&ps.duty>0.01&&ps.duty<0.99)kind='pwm';
    else if(pin.startsWith('A')&&ps&&ps.analog!==null)kind='ana';
    for(let i=0;i<n;i++){
     const j=(tr.head-n+i+cap)%cap,j2=(j+1)%cap;
     const t0=tr.t[j],t1=i+1<n?tr.t[j2]:now;
     const v=kind==='pwm'?tr.duty[j]:kind==='ana'?tr.analog[j]/1023:tr.level[j];
     segs.push({a:x(t0),b:x(t1),v});
    }
   }
   if(!segs.length){ctx.strokeStyle=col.dim;ctx.lineWidth=1.5;ctx.beginPath();ctx.moveTo(0,yL);ctx.lineTo(w,yL);ctx.stroke();}
   else if(kind==='dig'&&api.history().measure(pin as UnoPin).aliased){
    // pulses shorter than a frame: flat baseline plus a 2px tick at each emulator-measured pulse
    ctx.lineWidth=1.5;ctx.strokeStyle=col.dim;ctx.beginPath();ctx.moveTo(0,yL);ctx.lineTo(w,yL);ctx.stroke();
    ctx.fillStyle=col.live;
    for(const t of api.history().pulseTicks(pin as UnoPin)){if(t>=now-WINDOW_MS)ctx.fillRect(Math.round(x(t))-1,yH,2,yL-yH);}
   }
   else if(kind==='dig'||kind==='tx'){
    ctx.lineWidth=1.5;
    let prev:number|null=null;
    for(const s of segs){
     const y=s.v?yH:yL;
     if(s.v){ctx.globalAlpha=.14;ctx.fillStyle=col.live;ctx.fillRect(s.a,yH,Math.max(0,s.b-s.a),yL-yH);ctx.globalAlpha=1;}
     if(prev!==null&&prev!==s.v){ctx.strokeStyle=col.live;ctx.beginPath();ctx.moveTo(s.a,yH);ctx.lineTo(s.a,yL);ctx.stroke();}
     ctx.strokeStyle=s.v?col.live:col.dim;ctx.beginPath();ctx.moveTo(s.a,y);ctx.lineTo(s.b,y);ctx.stroke();
     prev=s.v;
    }
   }else{
    ctx.lineWidth=1.5;ctx.strokeStyle=col.pwm;
    ctx.beginPath();
    segs.forEach((s,i)=>{const y=yL-(yL-yH)*Math.max(0,Math.min(1,s.v));if(i===0)ctx.moveTo(s.a,y);else ctx.lineTo(s.a,y);ctx.lineTo(s.b,y);});
    ctx.stroke();
    if(kind==='pwm'){
     ctx.globalAlpha=.22;ctx.fillStyle=col.pwm;
     for(const s of segs)ctx.fillRect(s.a,yL-(yL-yH)*s.v,Math.max(0,s.b-s.a),(yL-yH)*s.v);
     ctx.globalAlpha=1;
    }
   }
   const m=markerRef.current;
   if(m!==null&&m>=now-WINDOW_MS){ctx.fillStyle=col.live;ctx.fillRect(Math.round(x(m)),0,1,h);}
  };
  draw();
  const off=api.subscribe(()=>{
   const t=performance.now();
   if(t-last<(reduced?500:15))return;
   last=t;draw();
  });
  return()=>{off();ro.disconnect();};
 },[api,pin,reduced,markerRef,txRef]);
 return <canvas ref={cv} className="lab-lane-cv" data-lane-canvas={pin}/>;
}

export interface AnalyzerProps{
 api:StageApi;lessonId:LessonId;ai?:boolean;lanePins:string[];tx:boolean;
 status:string;simTimeMs:number;speed:number;pins:Record<string,PinSample>|null;
 segs:SerialSeg[];onClear:()=>void;
 record:TestRecordData|null;showRecord:boolean;onShowSignals:()=>void;marker:number|null;
 receipt:string;compact:boolean;mobile:boolean;reduced:boolean;
}

export function Analyzer(p:AnalyzerProps){
 const {tr}=useLang();
 const running=p.status==='running';
 const markerRef=useRef<number|null>(null);
 useEffect(()=>{markerRef.current=p.marker;},[p.marker]);
 const txRef=useRef<{t:number;on:number}[]>([]);
 useEffect(()=>p.api.subscribe(()=>{
  const s=p.api.snapshot();if(!s||s.status!=='running')return;
  const a=txRef.current,on=s.txActive?1:0;
  if(!a.length||a[a.length-1].on!==on)a.push({t:s.simTimeMs,on});
  if(a.length>400)a.splice(0,200);
 }),[p.api]);
 useEffect(()=>{if(!running)return;txRef.current=[];},[running]);
 const h=p.api.history();
 const idleNow=!running&&!(p.record&&p.showRecord);
 const max=p.mobile?1:p.compact||idleNow?2:3;
 const {lanes,more}=lanesFor(p.lessonId,p.lanePins,p.tx&&!p.mobile,max,p.ai);
 const hasData=lanes.some(l=>l!=='TX'&&h.trace(l as UnoPin).n>1);
 const txBytes=p.segs.reduce((n,s)=>s.sys?n:n+new TextEncoder().encode(s.text).length,0);
 const lastLine=[...p.segs].reverse().find(s=>!s.sys&&s.text.trim());
 const valueOf=(pin:string):string=>{
  if(pin==='TX')return `${txBytes} B`;
  const ps=p.pins?.[pin],m=h.measure(pin as UnoPin);
  if(!ps)return '—';
  if(ps.mode==='output'&&PWM_PINS.includes(pin as UnoPin)&&ps.duty>0.01&&ps.duty<0.99)return `${(ps.duty*100).toFixed(1)}% · ${Math.round(ps.freqHz)} Hz`;
  if(pin.startsWith('A')&&ps.analog!==null)return String(Math.round(ps.analog));
  if(m.aliased&&m.pulses>0){const hi=m.highMs;return `≈${Math.round(m.pulses)} × ${hi===null?'':hi<1?`${Math.round(hi*1000)} µs`:`${hi.toFixed(1)} ms`}`;}
  if(m.highMs!==null&&m.toggles>0)return `hi ${m.highMs.toFixed(1)} ms`;
  return ps.level?'HIGH':'LOW';
 };
 const modeGlyph=(pin:string)=>{const m=p.pins?.[pin]?.mode;return pin==='TX'?'TX':m==='output'?'OUT':m==='input-pullup'?'PU':m==='input'?'IN':'';};
 return (
  <div className="lab-inst" data-running={running} data-idle={!running&&!hasData} data-testid="lab-analyzer">
   <div className="lab-inst-status">
    <span className="lab-inst-state" data-on={running}><i/>{running?tr('RUNNING','BERJALAN'):tr('STOPPED','BERHENTI')}</span>
    <span className="lab-inst-num">t={fmtTime(p.simTimeMs)}</span>
    <span className="lab-inst-num lab-inst-cyc" data-testid="lab-cycles">{fmtCycles(p.simTimeMs)} cyc</span>
    <span className="lab-inst-num">{running?`${p.speed.toFixed(2)}×`:'—'}</span>
    <span className="lab-grow"/>
    {!p.mobile&&<PortMap pins={p.pins}/>}
   </div>
   <div className="lab-inst-body">
    <div className="lab-signals" data-swap={p.showRecord&&p.record?'record':'signals'}>
     {p.showRecord&&p.record
      ?<TestRecord rec={p.record} onShowSignals={p.onShowSignals}/>
      :<>
       <div className="lab-lanes">
        {lanes.map(pin=>(
         <div key={pin} className="lab-lane" data-lane={pin}>
          <span className="lab-lane-label"><b>{pin}</b><em>{LABEL[pin]??modeGlyph(pin)}</em></span>
          <Lane pin={pin} api={p.api} reduced={p.reduced} markerRef={markerRef} txRef={txRef}/>
          <span className="lab-lane-val">[ {valueOf(pin)} ]</span>
         </div>
        ))}
        {more>0&&<span className="lab-lane-more">+{more}</span>}
        {!p.mobile&&running&&<div className="lab-ruler" aria-hidden="true"><span/><div>{[-2000,-1500,-1000,-500,0].map(t=><i key={t} style={{left:`${(t+WINDOW_MS)/WINDOW_MS*100}%`}}>{t===0?'0 ms':t}</i>)}</div><span/></div>}
       </div>
       {!hasData&&!running&&(
        <div className="lab-inst-idle"><p>{tr('Press Run. These traces come from the emulated chip.','Tekan Jalankan. Jejak ini berasal dari chip tiruan.')}</p><small>{p.receipt}</small></div>
       )}
      </>}
    </div>
    {p.mobile
     ?<div className="lab-inst-last" aria-hidden="true">{lastLine?lastLine.text.trim().split('\n').pop():'—'}</div>
     :<div className="lab-serialpane"><SerialHeader running={running} onClear={p.onClear}/><SerialLog segments={p.segs}/></div>}
   </div>
  </div>
 );
}
