import {Link} from 'react-router-dom';
import {useLang} from '../../i18n';
import type {LessonId,PartState,SimSnapshot,UnoPin} from '../contract';
import {CIRCUITS,PWM_PINS,UNO_PINS} from '../contract';
import {deviceRegistry} from '../sim/devices';
import {LESSON_BY_ID} from '../lessons/index';
import {oledLitPixels} from '../goals';
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

/** Pins the record quotes: lessons/<id>.ts recordPins, else the board pins among keyPins. */
const recordPinsOf=(id:LessonId):UnoPin[]=>{const m=LESSON_BY_ID[id];return m?.recordPins??((m?.keyPins??[]).filter(p=>(UNO_PINS as readonly string[]).includes(p)) as UnoPin[]);};
const pwmRows=(s:SimSnapshot):RecordRow[]=>{
 const ch=(['D9','D10','D11'] as UnoPin[]).map(p=>`${p} ${Math.round(s.pins[p].duty*100)}%`);
 const hz=Math.max(...(['D9','D10','D11'] as UnoPin[]).map(p=>s.pins[p].freqHz));
 const rows:RecordRow[]=[{k:'PWM duty',v:ch.join(' · ')}];
 if(hz>0)rows.push({k:'carrier',v:`${Math.round(hz)} Hz`});
 return rows;
};
/** Bus protocols the record reports by their own numbers (a UART pin that "toggled 412x" says nothing). */
type Bus='uart'|'spi'|'i2c'|'ws2812';
const BUSES:readonly string[]=['uart','spi','i2c','ws2812'];
/** Which bus a board pin belongs to in this lesson: the protocol of the part wired to it, else the fixed pins of the chip (D0/D1 USART, A4/A5 TWI, D11-D13 SPI once it ran). */
function busOf(id:LessonId,pin:string,s:SimSnapshot):Bus|null{
 const c=CIRCUITS[id];
 const BUS_PIN:Record<string,Bus>={SDA:'i2c',SCL:'i2c',MOSI:'spi',MISO:'spi',SCK:'spi',CS:'spi',SS:'spi',TX:'uart',RX:'uart',TXD:'uart',RXD:'uart',DIN:'ws2812'};
 for(const w of (c?.wires??[]).filter(x=>x.boardPin===pin)){
  const k=c!.parts.find(p=>p.id===w.componentId)?.kind;
  const pr=k?deviceRegistry.get(k)?.protocol:undefined;
  const pn=w.pin.toUpperCase();
  const role=pr==='spi'&&/^(SDA|NSS|CE\d?|SS|CS)$/.test(pn)?'spi':BUS_PIN[pn];
  if(pr&&BUSES.includes(pr)&&role===pr)return pr as Bus;
 }
 if(pin==='D0'||pin==='D1'||pin==='TX')return 'uart';
 if(pin==='A4'||pin==='A5')return s.bus&&s.bus.i2c.transactions>0?'i2c':null;
 if(pin==='D11'||pin==='D12'||pin==='D13')return s.bus&&s.bus.spi.bytes>0?'spi':null;
 return null;
}
const STD_BAUD=[300,600,1200,2400,4800,9600,14400,19200,28800,38400,57600,76800,115200,230400,250000,500000,1000000];
/** UBRR gives 9615 for "9600": name the standard rate within 3 %, else the raw number. */
const niceBaud=(b:number):number=>{const n=STD_BAUD.reduce((a,c)=>Math.abs(c-b)<Math.abs(a-b)?c:a,STD_BAUD[0]!);return Math.abs(n-b)/n<0.03?n:b;};
const hex2=(n:number):string=>'0x'+n.toString(16).toUpperCase().padStart(2,'0');
/** One row for a whole bus, from the emulated peripherals (UART bytes, lines and baud; SPI transactions; I2C addresses; WS2812 frames and pixels). */
export function busRow(bus:Bus,s:SimSnapshot):RecordRow|null{
 const b=s.bus;
 if(bus==='uart'){
  if(!b)return null;
  const u=b.uart;
  return {k:'UART',v:u.bytes+u.rx>0?`TX ${u.bytes} B · RX ${u.rx} B · ${u.lines} line${u.lines===1?'':'s'} · ${u.baud?niceBaud(u.baud):'?'} baud`:'no bytes yet'};
 }
 if(bus==='spi'){
  if(!b)return null;
  const q=b.spi;
  return {k:'SPI',v:q.transactions>0?`${q.transactions} tx · ${q.bytes} B · ${q.clockHz>=1e6?`${(q.clockHz/1e6).toFixed(0)} MHz`:`${Math.round(q.clockHz/1000)} kHz`}`:'no transfers yet'};
 }
 if(bus==='i2c'){
  if(!b)return null;
  const q=b.i2c;
  return {k:'I2C',v:q.addresses.length?`${q.addresses.map(hex2).join(', ')} · ${q.transactions} transaction${q.transactions===1?'':'s'}${q.nacks?` · ${q.nacks} NACK`:''}`:'no device addressed yet'};
 }
 const ws=Object.values(s.parts).filter((p):p is Extract<PartState,{kind:'ext'}>=>p.kind==='ext'&&p.type==='ws2812-strip');
 if(!ws.length)return null;
 const frames=ws.reduce((n,p)=>n+Number(p.v.frames||0),0),px=ws.reduce((n,p)=>n+Number(p.v.count||0),0),err=ws.reduce((n,p)=>n+Number(p.v.timingErrors||0),0);
 return {k:'WS2812',v:`${frames} frame${frames===1?'':'s'} · ${px} pixels${err?` · ${err} timing errors`:' · 0 timing errors'}`};
}
const generic=(id:LessonId)=>(h:PinHistory,s:SimSnapshot):RecordRow[]=>{
 const seen=new Set<Bus>();
 const busRows:RecordRow[]=[],pinOut:RecordRow[]=[];
 if(id==='rgb')pinOut.push(...pwmRows(s));
 else for(const p of recordPinsOf(id)){
  const bus=busOf(id,p,s);
  if(!bus){
   // one row per plain pin; the one-wire DHT22 line is reported as a part below
   const dht=(CIRCUITS[id]?.wires??[]).some(w=>w.boardPin===p&&CIRCUITS[id]!.parts.find(q=>q.id===w.componentId)?.kind==='dht22');
   if(dht)continue;
   const r=pinRows(h,p,s);
   const lone=recordPinsOf(id).length===1&&!(CIRCUITS[id]?.parts??[]).some(q=>BUSES.includes(deviceRegistry.get(q.kind)?.protocol??''));
   if(lone){pinOut.push(...r);continue;}   // a single-pin lesson keeps its full cycle-exact timing
   pinOut.push(r.length>1&&r[0]!.k.endsWith('toggled')?{k:r[0]!.k,v:`${r[0]!.v}${r[1]&&r[1].k==='period'?` · ${r[1].v}`:''}`}:r[0]!);
   continue;
  }
  if(seen.has(bus))continue;
  seen.add(bus);
  const r=busRow(bus,s);
  if(r)busRows.push(r);else pinOut.push(...pinRows(h,p,s).slice(0,1));
 }
 // a bus the lesson's parts speak but no record pin names (the GPS lesson quotes the SPI display pin, yet its data arrives over UART) still gets its row
 if(id!=='rgb')for(const k of (CIRCUITS[id]?.parts??[]).map(p=>deviceRegistry.get(p.kind)?.protocol)){
  if(!k||!BUSES.includes(k)||seen.has(k as Bus))continue;
  seen.add(k as Bus);
  const r=busRow(k as Bus,s);if(r)busRows.push(r);
 }
 const rows:RecordRow[]=[...busRows];
 const b=part(s,'buzzer');if(b&&b.on)rows.push({k:'tone',v:`${Math.round(b.freqHz)} Hz`});
 const dh=Object.values(s.parts).find(p=>p.kind==='ext'&&p.type==='dht22');
 if(dh&&dh.kind==='ext'&&dh.v.readT!==null)rows.push({k:'DHT22',v:`${dh.v.reads} reads · ${dh.v.readT} °C ${dh.v.readH} %RH`});
 rows.push(...pinOut);
const h1=part(s,'hcsr04');if(h1&&h1.echoCm!==null)rows.push({k:'echo',v:`${Math.round(h1.echoCm)} cm`});
 const m=part(s,'motor');if(m)rows.push({k:'motor',v:`${Math.round(m.rpm)} rpm`});
 const sv=part(s,'servo');if(sv)rows.push({k:'servo',v:`${Math.round(sv.angleDeg)}° · ${Math.round(sv.pulseUs)} µs`});
 const atRow:RecordRow={k:'at',v:`t=${fmtTime(s.simTimeMs)} · ${fmtCycles(s.simTimeMs)} cyc`};
 return [...rows.filter(r=>r.k!=="at").slice(0,3),atRow];
};
type Rec=(h:PinHistory,s:SimSnapshot,m:Record<string,number>)=>RecordRow[];
const at=(s:SimSnapshot):RecordRow=>({k:'at',v:`t=${fmtTime(s.simTimeMs)} · ${fmtCycles(s.simTimeMs)} cyc`});
const distanceRec:Rec=(_h,s,m)=>{
 const e=part(s,'hcsr04');
 return [{k:'echo',v:m.first!==undefined&&m.lastEcho!==undefined?`${Math.round(m.first)} cm → ${Math.round(m.lastEcho)} cm`:`${Math.round(e?.echoCm??0)} cm`},at(s)];
};
const extOf=(s:SimSnapshot,t:string)=>{const p=Object.values(s.parts).find(q=>q.kind==='ext'&&q.type===t);return p&&p.kind==='ext'?p.v:null;};
const oledRec:Rec=(_h,s)=>{
 const o=extOf(s,'oled-ssd1306'),d=extOf(s,'dht22');
 return [{k:'oled',v:o?`${oledLitPixels(String(o.fb))} px lit over I2C 0x3C`:'no screen'},...(d&&d.readT!==null?[{k:'dht22',v:`${d.readT} °C · ${d.readH} %RH`}]:[]),at(s)];
};
const motionRec:Rec=(_h,s)=>{
 const r=extOf(s,'relay-module'),p=extOf(s,'pir-hc-sr501');
 return [{k:'relay',v:r?(r.energized===true?'COM → NO (closed)':'COM → NC (open)'):'none'},{k:'PIR OUT',v:p&&p.out===true?'HIGH (motion)':'LOW'},{k:'clicks',v:`${r?.clicks??0}`},at(s)];
};
const plantRec:Rec=(_h,s)=>{
 const l=extOf(s,'lcd1602-i2c'),so=extOf(s,'soil-moisture');
 return [{k:'lcd',v:l?`${String(l.line1).trim()} · ${String(l.line2).trim()}`:'no screen'},...(so?[{k:'soil',v:`${so.wetness} % wet · ${so.volts} V`}]:[]),at(s)];
};
const remoteRec:Rec=(_h,s)=>{
 const ir=extOf(s,'ir-receiver'),g=extOf(s,'seven-segment');
 return [{k:'NEC',v:ir&&Number(ir.frames)>0?`0x${Number(ir.command).toString(16).toUpperCase().padStart(2,'0')} · ${ir.frames} frames`:'waiting'},{k:'7-seg',v:g&&g.glyph!==''?`digit ${String(g.glyph)}`:'blank'},at(s)];
};
const parkingRec:Rec=(_h,s,m)=>[
 {k:'lights',v:m.rAt!==undefined&&m.gAt!==undefined?`red at ${Math.round(m.rAt)} cm · green at ${Math.round(m.gAt)} cm`:'red + green seen'},at(s)];
/** Lessons with a hand-written record; every other lesson uses the generic pin-and-part record. */
const CUSTOM_RECORDS:Record<string,Rec>={distance:distanceRec,parking:parkingRec,oled:oledRec,motion:motionRec,plant:plantRec,remote:remoteRec};
export const recordFor=(id:LessonId):Rec=>CUSTOM_RECORDS[id]??generic(id);
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
