/**
 * CircuitSpec: the single circuit format shared by lessons, the AI builder and the future canvas (lab v3, ADR 011).
 * Pure: zod + contract + layout only (no three.js, no DOM), so the ops service, Node tests and the browser all import it.
 * The part registry (scene/parts/index.ts) is the source of truth for looks; tests keep it consistent with PART_PINS and PIN_COLS used here.
 */
import {z} from 'zod';
import type {Circuit,PartKind,PartLink,PartProps,PartSpec,Wire,WireColor,BoardPin} from './contract';
import {ANALOG_ONLY_PINS,PART_PINS,UNO_PINS} from './contract';
import {isAnalogOnly} from './boards';
import {BB_COLS,BB_ROWS,PIN_COLS} from './scene/layout';
// side effect: registers every sim/devices/<kind>.ts (pins, holes, copy) so plugin kinds validate with no edit here
import {deviceRegistry} from './sim/devices';
import type {PowerSpec,RegulatorDecl,SupplyDecl} from './sim/devices';
import {PowerNetwork,checkPower} from './sim/power';
import {partCopy} from './parts-copy';

export interface Bilingual{en:string;id:string}
const BilingualSchema=z.object({en:z.string().trim().min(1).max(300),id:z.string().trim().min(1).max(300)}).strict();

export const WIRE_COLORS=['red','black','orange','yellow','green','blue','purple','white'] as const;
export const POWER_BOARD_PINS=['5V','3V3','GND','VIN'] as const;
const ID_RE=/^[a-z][a-z0-9_-]{0,23}$/;

/** Endpoint: a board pin ('D13','A0','5V','GND'), a breadboard rail ('rail.5v','rail.gnd') or a part pin ('led1.A'). */
const EndpointSchema=z.string().trim().min(2).max(40).regex(/^[A-Za-z0-9][A-Za-z0-9_-]*(\.[A-Za-z0-9+\-_]+)?$/);

export const PlaceSchema=z.union([
 z.object({breadboard:z.object({col:z.number().int().min(0).max(BB_COLS-1),row:z.number().int().min(0).max(BB_ROWS-1)}).strict()}).strict(),
 z.object({free:z.object({x:z.number().min(-250).max(250),z:z.number().min(-250).max(250)}).strict()}).strict(),
]);
export const SpecPartSchema=z.object({
 id:z.string().regex(ID_RE),
 /** Any string here; the validator reports unknown kinds with a friendly message. */
 kind:z.string().min(1).max(24),
 props:z.record(z.string().max(32),z.union([z.string().max(64),z.number(),z.boolean()])).default({}),
 place:PlaceSchema,
}).strict();
export const SpecWireSchema=z.object({
 /** Optional stable id for steps to reference. Defaults to `w<index>`. */
 id:z.string().regex(ID_RE).optional(),
 from:EndpointSchema,to:EndpointSchema,
 color:z.enum(WIRE_COLORS).default('orange'),
}).strict();
export const SpecStepSchema=z.object({
 caption:BilingualSchema,
 add:z.object({parts:z.array(z.string()).max(30).optional(),wires:z.array(z.string()).max(30).optional()}).strict(),
}).strict();
export const CircuitSpecSchema=z.object({
 /** 'uno' or 'nano': both run the same emulated ATmega328P; the Nano adds A6/A7 (analog input only). */
 board:z.enum(['uno','nano']).default('uno'),
 parts:z.array(SpecPartSchema).max(40),
 wires:z.array(SpecWireSchema).max(120),
 sketch:z.object({source:z.string().min(1).max(20000),params:z.record(z.string().max(32),z.number()).optional()}).strict(),
 steps:z.array(SpecStepSchema).max(60).default([]),
 goal:BilingualSchema.optional(),
}).strict();

export type CircuitSpec=z.infer<typeof CircuitSpecSchema>;
export type SpecPart=z.infer<typeof SpecPartSchema>;
export type SpecWire=z.infer<typeof SpecWireSchema>;
export type SpecStep=z.infer<typeof SpecStepSchema>;
export type Place=z.infer<typeof PlaceSchema>;

export const wireId=(w:SpecWire,i:number):string=>w.id??`w${i}`;

// ---------- validation ----------
export type IssueSeverity='error'|'warning';
export interface SpecIssue{code:string;severity:IssueSeverity;en:string;id:string;/** part id, wire id or board pin the issue is about */ref?:string}
export interface ValidationResult{ok:boolean;issues:SpecIssue[]}
/** Minimal part catalog the validator needs. Defaults to PART_PINS + PIN_COLS (kept equal to the scene registry by a test). */
export interface PartCatalog{
 kinds:readonly string[];pins(kind:string):readonly string[];holes(kind:string):readonly number[];
 /** Supply rating of a kind (optional: catalogs without it skip the power checks). */
 power?(kind:string):PowerSpec|undefined;
 /** Sources and regulators a part provides for these props (battery, power module, LM7805). */
 supplies?(kind:string,props:PartProps):readonly SupplyDecl[];
 regulators?(kind:string,props:PartProps):readonly RegulatorDecl[];
}
export const DEFAULT_CATALOG:PartCatalog={
 /** Live: includes every registered plugin kind. */
 get kinds():readonly string[]{return Object.keys(PART_PINS);},
 pins:k=>(PART_PINS as Record<string,readonly string[]>)[k]??[],
 holes:k=>(PIN_COLS as Record<string,readonly number[]|undefined>)[k]??[],
 power:k=>deviceRegistry.get(k)?.power,
 supplies:(k,p)=>deviceRegistry.get(k)?.supplies?.({...deviceRegistry.get(k)?.defaults,...p})??[],
 regulators:(k,p)=>deviceRegistry.get(k)?.regulators?.({...deviceRegistry.get(k)?.defaults,...p})??[],
};

const iss=(code:string,severity:IssueSeverity,en:string,id:string,ref?:string):SpecIssue=>({code,severity,en,id,...(ref?{ref}:{})});
const BOARD_PINS=new Set<string>([...UNO_PINS,...ANALOG_ONLY_PINS,...POWER_BOARD_PINS]);
const isBoardPin=(s:string):boolean=>BOARD_PINS.has(s);
const RAILS:Record<string,string>={'rail.5v':'5V','rail.gnd':'GND'};
const half=(row:number):'t'|'b'=>row<5?'t':'b';

/** Union-find over named nodes. Node names: `B:D13` board pin, `P:led1.A` part pin, `S:12:t` breadboard strip. */
class Nets{
 private p=new Map<string,string>();
 find(a:string):string{
  if(!this.p.has(a))this.p.set(a,a);
  let r=a;while(this.p.get(r)!==r)r=this.p.get(r)!;
  let c=a;while(this.p.get(c)!==r){const n=this.p.get(c)!;this.p.set(c,r);c=n;}
  return r;
 }
 union(a:string,b:string):void{const ra=this.find(a),rb=this.find(b);if(ra!==rb)this.p.set(ra,rb);}
 groups():Map<string,string[]>{
  const m=new Map<string,string[]>();
  for(const k of [...this.p.keys()]){const r=this.find(k);const l=m.get(r);if(l)l.push(k);else m.set(r,[k]);}
  return m;
 }
}

/** Node name for an endpoint string, or null when it is not a board pin, rail or part pin. */
function nodeOf(ep:string):string|null{
 if(ep in RAILS)return 'B:'+RAILS[ep];
 if(isBoardPin(ep))return 'B:'+ep;
 const m=/^([a-z][a-z0-9_-]*)\.(.+)$/.exec(ep);
 return m?`P:${m[1]}.${m[2]}`:null;
}

/** Electrical nets of a spec: board pins, part pins and the breadboard strips (5 connected holes per column half) they sit in. */
export function buildNets(spec:CircuitSpec,cat:PartCatalog=DEFAULT_CATALOG):Nets{
 const nets=new Nets();
 for(const p of spec.parts){
  const pins=cat.pins(p.kind),holes=cat.holes(p.kind);
  pins.forEach(pin=>nets.find(`P:${p.id}.${pin}`));
  if('breadboard' in p.place){
   const {col,row}=p.place.breadboard;
   pins.forEach((pin,i)=>{const o=holes[i];if(o!==undefined)nets.union(`P:${p.id}.${pin}`,`S:${col+o}:${half(row)}`);});
  }
 }
 for(const w of spec.wires){const a=nodeOf(w.from),b=nodeOf(w.to);if(a&&b)nets.union(a,b);}
 return nets;
}

// ---------- sketch pin extraction ----------
export interface SketchPins{used:Set<string>;outputs:Set<string>;unresolved:string[];/** pins used by a digital function (pinMode, digitalRead/Write, tone, pulseIn, attach): A6/A7 cannot do these */digital:Set<string>}
const unoPin=(n:number,analog:boolean):string|null=>{
 if(analog&&n>=0&&n<=7)return 'A'+n;
 if(n>=0&&n<=13)return 'D'+n;
 if(n>=14&&n<=21)return 'A'+(n-14);   // 20 and 21 are A6 and A7 of the Nano core
 return null;
};
/** Pins a sketch touches, by regex over pinMode/digitalWrite/digitalRead/analogWrite/analogRead/tone/pulseIn/.attach and #define / const int constants. */
export function sketchPins(source:string):SketchPins{
 const src=source.replace(/\/\*[\s\S]*?\*\//g,'').replace(/\/\/[^\n]*/g,'');
 const consts=new Map<string,string>([['LED_BUILTIN','D13']]);
 const val=(v:string,analog:boolean):string|null=>/^A[0-7]$/.test(v)?v:/^\d+$/.test(v)?unoPin(Number(v),analog):null;
 for(const m of src.matchAll(/#define\s+(\w+)\s+(A[0-7]|\d+)\b/g)){const p=val(m[2]!,false);if(p)consts.set(m[1]!,p);}
 for(const m of src.matchAll(/\b(?:const\s+)?(?:int|byte|uint8_t|unsigned\s+char|short|char)\s+(\w+)\s*=\s*(A[0-7]|\d+)\s*;/g)){const p=val(m[2]!,false);if(p)consts.set(m[1]!,p);}
 const used=new Set<string>(),outputs=new Set<string>(),digital=new Set<string>(),unresolved:string[]=[];
 const resolve=(arg:string,analog:boolean):string|null=>{
  const p=/^\w+$/.test(arg)&&!/^(A[0-7]|\d+)$/.test(arg)?consts.get(arg)??null:val(arg,analog);
  if(!p)unresolved.push(arg);
  return p;
 };
 for(const m of src.matchAll(/\b(pinMode|digitalWrite|digitalRead|analogWrite|analogRead|tone|noTone|pulseIn)\s*\(\s*([A-Za-z_]\w*|\d+)/g)){
  const fn=m[1]!,p=resolve(m[2]!,fn==='analogRead');
  if(!p)continue;
  used.add(p);
  if(fn!=='analogRead'&&fn!=='analogWrite')digital.add(p);
  if(fn==='digitalWrite'||fn==='analogWrite'||fn==='tone'||fn==='noTone')outputs.add(p);
  if(fn==='pinMode'){const rest=src.slice((m.index??0)+m[0].length,(m.index??0)+m[0].length+40);if(/^\s*,\s*OUTPUT\b/.test(rest))outputs.add(p);}
 }
  // the SPI peripheral owns D11 (MOSI), D12 (MISO) and D13 (SCK): using SPI.* uses those pins even though no pin number appears
 if(/\bSPI\s*\.\s*(begin|transfer|beginTransaction)\b/.test(src))for(const p of ['D11','D12','D13'])used.add(p);
 for(const m of src.matchAll(/\.attach\s*\(\s*([A-Za-z_]\w*|\d+)/g)){const p=resolve(m[1]!,false);if(p){used.add(p);outputs.add(p);digital.add(p);}}
 return {used,outputs,unresolved,digital};
}

// ---------- the validator ----------
export function validateCircuitSpec(spec:CircuitSpec,cat:PartCatalog=DEFAULT_CATALOG):ValidationResult{
 const out:SpecIssue[]=[];
 const kindOf=new Map<string,string>();
 const seen=new Set<string>();
 // 1. ids and kinds
 for(const p of spec.parts){
  if(seen.has(p.id))out.push(iss('duplicate-id','error',`Two parts are called "${p.id}". Give each part its own name.`,`Dua komponen bernama "${p.id}". Beri setiap komponen nama sendiri.`,p.id));
  seen.add(p.id);kindOf.set(p.id,p.kind);
  if(!cat.kinds.includes(p.kind))out.push(iss('unknown-kind','error',`"${p.kind}" is not a part this lab has. Pick one of: ${cat.kinds.join(', ')}.`,`"${p.kind}" bukan komponen yang ada di lab ini. Pilih salah satu: ${cat.kinds.join(', ')}.`,p.id));
 }
 // 2. placement: holes in range, free of overlaps, off-board props not on the breadboard
 const holeOwner=new Map<string,string>();
 for(const p of spec.parts){
  if(!cat.kinds.includes(p.kind)||!('breadboard' in p.place))continue;
  const offs=cat.holes(p.kind);
  if(offs.length===0){out.push(iss('not-on-breadboard','error',`The ${p.kind} (${p.id}) stands on the desk, not on the breadboard. Place it with free x/z.`,`${p.kind} (${p.id}) berdiri di meja, bukan di breadboard. Tempatkan dengan x/z bebas.`,p.id));continue;}
  const {col,row}=p.place.breadboard;
  if(col+Math.max(...offs)>=BB_COLS)out.push(iss('off-board','error',`${p.id} runs past the end of the breadboard. Move it left (column ${BB_COLS-1-Math.max(...offs)} or lower).`,`${p.id} melewati ujung breadboard. Geser ke kiri (kolom ${BB_COLS-1-Math.max(...offs)} atau kurang).`,p.id));
  for(const o of offs){
   const k=`${col+o}:${row}`,owner=holeOwner.get(k);
   if(owner&&owner!==p.id)out.push(iss('hole-conflict','error',`${p.id} and ${owner} are plugged into the same hole (column ${col+o}, row ${row}). Move one of them.`,`${p.id} dan ${owner} ditancapkan di lubang yang sama (kolom ${col+o}, baris ${row}). Pindahkan salah satunya.`,p.id));
   else holeOwner.set(k,p.id);
  }
 }
 // 3. wire endpoints exist
 const wireIds=new Set<string>();
 spec.wires.forEach((w,i)=>{
  const wid=wireId(w,i);
  if(wireIds.has(wid))out.push(iss('duplicate-id','error',`Two wires are called "${wid}".`,`Dua kabel bernama "${wid}".`,wid));
  wireIds.add(wid);
  for(const ep of [w.from,w.to]){
   if(ep in RAILS||isBoardPin(ep))continue;
   const m=/^([a-z][a-z0-9_-]*)\.(.+)$/.exec(ep);
   if(!m){out.push(iss('bad-endpoint','error',`Wire ${wid}: "${ep}" is not a board pin (like D13 or A0), a rail (rail.5v, rail.gnd) or a part pin (like led1.A).`,`Kabel ${wid}: "${ep}" bukan pin papan (seperti D13 atau A0), rel (rail.5v, rail.gnd), atau pin komponen (seperti led1.A).`,wid));continue;}
   const kind=kindOf.get(m[1]!);
   if(!kind){out.push(iss('unknown-part','error',`Wire ${wid} goes to "${m[1]}", but there is no part with that name.`,`Kabel ${wid} menuju "${m[1]}", tetapi tidak ada komponen dengan nama itu.`,wid));continue;}
   if(cat.kinds.includes(kind)&&!cat.pins(kind).includes(m[2]!))out.push(iss('unknown-pin','error',`The ${kind} "${m[1]}" has no pin "${m[2]}". Its pins are: ${cat.pins(kind).join(', ')||'none (it is not wired)'}.`,`${kind} "${m[1]}" tidak punya pin "${m[2]}". Pinnya: ${cat.pins(kind).join(', ')||'tidak ada (tidak dikabel)'}.`,wid));
  }
  if(w.from===w.to)out.push(iss('loop-wire','error',`Wire ${wid} starts and ends at the same place.`,`Kabel ${wid} mulai dan berakhir di tempat yang sama.`,wid));
 });
 // 4. nets: shorts and series resistors
 const nets=buildNets(spec,cat);
 const groups=[...nets.groups().values()];
 const boardIn=(g:string[]):string[]=>g.filter(n=>n.startsWith('B:')).map(n=>n.slice(2));
 for(const g of groups){
  const b=boardIn(g);
  const pw=b.filter(x=>(POWER_BOARD_PINS as readonly string[]).includes(x));
  if(new Set(pw).size>1)out.push(iss('rail-short','error',`${[...new Set(pw)].join(' and ')} end up connected together. That is a short circuit. Check the wires that touch these pins.`,`${[...new Set(pw).values()].join(' dan ')} saling tersambung. Itu korsleting. Periksa kabel yang menyentuh pin ini.`,pw[0]));
  const dig=b.filter(x=>!(POWER_BOARD_PINS as readonly string[]).includes(x));
  if(new Set(dig).size>1)out.push(iss('pin-short','error',`Pins ${[...new Set(dig)].join(' and ')} are wired together. Use separate wires for separate pins.`,`Pin ${[...new Set(dig)].join(' dan ')} tersambung. Pakai kabel terpisah untuk pin yang berbeda.`,dig[0]));
  if(pw.length&&dig.length)out.push(iss('pin-to-rail','warning',`Pin ${dig[0]} is wired straight to ${pw[0]}. That only works if the sketch never drives it as an output.`,`Pin ${dig[0]} dikabel langsung ke ${pw[0]}. Ini hanya aman jika sketsa tidak pernah menjadikannya output.`,dig[0]));
  // two legs of one part in the same net
  const byPart=new Map<string,string[]>();
  for(const n of g){const m=/^P:([^.]+)\.(.+)$/.exec(n);if(m)byPart.set(m[1]!,[...(byPart.get(m[1]!)??[]),m[2]!]);}
  for(const [pid,pinsIn] of byPart)if(pinsIn.length>1&&kindOf.get(pid)!=='lamp')out.push(iss('legs-touching','error',`Two legs of ${pid} (${pinsIn.join(' and ')}) are connected to each other. Move them to different columns.`,`Dua kaki ${pid} (${pinsIn.join(' dan ')}) saling tersambung. Pindahkan ke kolom yang berbeda.`,pid));
 }
 const netOfPin=(part:string,pin:string):string[]|undefined=>groups.find(g=>g.includes(`P:${part}.${pin}`));
 const partPinsOf=(g:string[]):{part:string;pin:string}[]=>g.flatMap(n=>{const m=/^P:([^.]+)\.(.+)$/.exec(n);return m?[{part:m[1]!,pin:m[2]!}]:[];});
 /** True when the net holds exactly this LED pin and a resistor leg: nothing else drives or sinks it. */
 const seriesResistor=(part:string,pin:string):boolean=>{
  const g=netOfPin(part,pin);if(!g)return false;
  if(boardIn(g).length)return false;
  const pp=partPinsOf(g);
  return pp.some(x=>{
   if(x.part===part||kindOf.get(x.part)!=='resistor')return false;
   const other=cat.pins('resistor').find(rp=>rp!==x.pin);
   const og=other?netOfPin(x.part,other):undefined;
   // the far leg must reach a board pin or another part, otherwise the resistor dangles
   return !!og&&(boardIn(og).length>0||partPinsOf(og).some(y=>y.part!==x.part));
  });
 };
 for(const p of spec.parts){
  if(p.kind==='led'&&!(seriesResistor(p.id,'A')||seriesResistor(p.id,'C')))
   out.push(iss('led-no-resistor','error',`LED ${p.id} has no series resistor. Without one it draws too much current and burns out. Put a 220 ohm resistor in the same strip as one leg and wire its other end to the pin or GND.`,`LED ${p.id} tidak punya resistor seri. Tanpa itu arusnya terlalu besar dan LED rusak. Pasang resistor 220 ohm di strip yang sama dengan salah satu kaki, lalu kabelkan ujung lainnya ke pin atau GND.`,p.id));
  if(p.kind==='rgb-led'){
   const ok=['R','G','B'].every(c=>seriesResistor(p.id,c))||seriesResistor(p.id,'K');
   if(!ok)out.push(iss('led-no-resistor','error',`RGB LED ${p.id} needs a resistor on each colour leg (R, G, B) or one on the common leg.`,`LED RGB ${p.id} butuh resistor di setiap kaki warna (R, G, B) atau satu di kaki bersama.`,p.id));
  }
 }
 // 5. sketch vs wiring
 const sp=sketchPins(spec.sketch.source);
 // A6 and A7 exist on the Nano only, and they can only be read as analog values
 if(spec.board!=='nano'){
  const onUno=new Set<string>([...sp.used,...spec.wires.flatMap(w=>[w.from,w.to])].filter(isAnalogOnly));
  for(const pn of onUno)out.push(iss('pin-not-on-board','error',`Pin ${pn} exists on the Nano only. This circuit uses the Uno, which has A0 to A5. Use another analog pin or switch the board to the Nano.`,`Pin ${pn} hanya ada di Nano. Rangkaian ini memakai Uno yang punya A0 sampai A5. Pakai pin analog lain atau ganti papan ke Nano.`,pn));
 }
 for(const pn of sp.digital)if(isAnalogOnly(pn))out.push(iss('analog-only-pin','error',`Pin ${pn} is analog input only: use analogRead(${pn}). pinMode, digitalRead, digitalWrite and tone cannot use it.`,`Pin ${pn} hanya input analog: pakai analogRead(${pn}). pinMode, digitalRead, digitalWrite dan tone tidak bisa memakainya.`,pn));
 const wired=new Set<string>();
 for(const g of groups){if(!partPinsOf(g).length)continue;for(const b of boardIn(g))if(!(POWER_BOARD_PINS as readonly string[]).includes(b))wired.add(b);}
 for(const pn of sp.used){
  if(pn==='D13'||pn==='D0'||pn==='D1')continue;
  if(!wired.has(pn))out.push(iss('sketch-pin-unwired','error',`The code uses pin ${pn}, but nothing is wired to it. Add a wire from ${pn} to a part, or change the pin number in the code.`,`Kode memakai pin ${pn}, tetapi tidak ada yang terkabel ke sana. Tambahkan kabel dari ${pn} ke komponen, atau ganti nomor pin di kode.`,pn));
 }
 for(const pn of wired){
  if(!sp.used.has(pn))out.push(iss('wire-pin-unused','warning',`Pin ${pn} is wired but the code never uses it.`,`Pin ${pn} terkabel tetapi kode tidak pernah memakainya.`,pn));
 }
 for(const pn of sp.outputs){
  const g=groups.find(x=>x.includes('B:'+pn));
  if(g&&boardIn(g).some(x=>(POWER_BOARD_PINS as readonly string[]).includes(x)))out.push(iss('output-short','error',`The code drives pin ${pn} as an output, but it is wired straight to ${boardIn(g).find(x=>(POWER_BOARD_PINS as readonly string[]).includes(x))}. That can damage the board.`,`Kode menjadikan pin ${pn} sebagai output, tetapi dikabel langsung ke ${boardIn(g).find(x=>(POWER_BOARD_PINS as readonly string[]).includes(x))}. Ini bisa merusak papan.`,pn));
 }
 // 5b. supply voltages: a 3.3 V part on 5 V, a motor on a board pin, two sources shorted
 if(cat.power){
  const groupsForPower=groups;
  const pnet=new PowerNetwork({
   groups:groupsForPower,
   parts:spec.parts.map(p=>({id:p.id,kind:p.kind,props:p.props as PartProps,supplies:cat.supplies?.(p.kind,p.props as PartProps)??[],regulators:cat.regulators?.(p.kind,p.props as PartProps)??[],drives:[],switches:[]})),
   vinIdle:4.7,
  });
  const notes=checkPower(pnet,spec.parts.filter(p=>cat.kinds.includes(p.kind)).map(p=>{const c=partCopy(p.kind).name;const pw=cat.power!(p.kind);return {id:p.id,kind:p.kind,label:{en:`${c.en} (${p.id})`,id:`${c.id} (${p.id})`},...(pw?{power:pw}:{})};}));
  for(const n of notes)out.push(iss('power-'+n.code,'warning',n.en,n.id,n.part||undefined));
 }
 // 6. steps
 if(spec.steps.length){
  const introP=new Map<string,number>(),introW=new Map<string,number>();
  spec.steps.forEach((s,i)=>{
   for(const id of s.add.parts??[]){
    if(!kindOf.has(id))out.push(iss('step-unknown','error',`Step ${i+1} adds "${id}", which is not a part.`,`Langkah ${i+1} menambah "${id}", yang bukan komponen.`,id));
    introP.set(id,(introP.get(id)??0)+1);
   }
   for(const id of s.add.wires??[]){
    if(!wireIds.has(id))out.push(iss('step-unknown','error',`Step ${i+1} adds wire "${id}", which does not exist.`,`Langkah ${i+1} menambah kabel "${id}", yang tidak ada.`,id));
    introW.set(id,(introW.get(id)??0)+1);
   }
  });
  for(const p of spec.parts)if((introP.get(p.id)??0)!==1)out.push(iss('step-coverage','error',`Part ${p.id} must appear in exactly one build step.`,`Komponen ${p.id} harus muncul di tepat satu langkah perakitan.`,p.id));
  spec.wires.forEach((w,i)=>{const id=wireId(w,i);if((introW.get(id)??0)!==1)out.push(iss('step-coverage','error',`Wire ${id} must appear in exactly one build step.`,`Kabel ${id} harus muncul di tepat satu langkah perakitan.`,id));});
 }
 return {ok:!out.some(i=>i.severity==='error'),issues:out};
}

export type ParseResult={ok:true;spec:CircuitSpec;issues:SpecIssue[]}|{ok:false;issues:SpecIssue[]};
/** Schema + validator in one call, for the server (LLM output) and the client (fixtures). Schema errors become friendly {en,id} too. */
export function parseCircuitSpec(input:unknown,cat:PartCatalog=DEFAULT_CATALOG):ParseResult{
 const r=CircuitSpecSchema.safeParse(input);
 if(!r.success){
  return {ok:false,issues:r.error.issues.slice(0,8).map(i=>{const at=i.path.join('.')||'(root)';return iss('schema','error',`The circuit description is malformed at ${at}: ${i.message}.`,`Deskripsi rangkaian tidak benar di ${at}: ${i.message}.`,at);})};
 }
 const v=validateCircuitSpec(r.data,cat);
 return v.ok?{ok:true,spec:r.data,issues:v.issues}:{ok:false,issues:v.issues};
}

// ---------- helpers for the scene and the simulator ----------
/** Steps to play when a spec has none: board, then every part, then every wire. */
export function defaultSteps(spec:CircuitSpec):SpecStep[]{
 const steps:SpecStep[]=[];
 for(const p of spec.parts)steps.push({caption:{en:`Place the ${p.kind} (${p.id}).`,id:`Pasang ${p.kind} (${p.id}).`},add:{parts:[p.id]}});
 spec.wires.forEach((w,i)=>steps.push({caption:{en:`Wire ${w.from} to ${w.to}.`,id:`Kabelkan ${w.from} ke ${w.to}.`},add:{wires:[wireId(w,i)]}}));
 return steps;
}
export const stepsOf=(spec:CircuitSpec):SpecStep[]=>spec.steps.length?spec.steps:defaultSteps(spec);

/**
 * Convert to the simulator/scene Circuit (contract.ts). Each part pin is tied to the board pin it reaches through its net,
 * or through one series resistor. lamp/obstacle targets and resistor roles are inferred when the spec omits them.
 */
export function specToCircuit(spec:CircuitSpec,cat:PartCatalog=DEFAULT_CATALOG):Circuit{
 const nets=buildNets(spec,cat);
 const groups=[...nets.groups().values()];
 const boardPins=(g:string[]):string[]=>g.filter(n=>n.startsWith('B:')).map(n=>n.slice(2));
 const gOf=(n:string):string[]|undefined=>groups.find(g=>g.includes(n));
 const kinds=new Map(spec.parts.map(p=>[p.id,p.kind]));
 const resistors=spec.parts.filter(p=>p.kind==='resistor');
 const reach=(part:string,pin:string):BoardPin|undefined=>{
  const g=gOf(`P:${part}.${pin}`);if(!g)return undefined;
  const direct=boardPins(g);if(direct.length)return direct[0] as BoardPin;
  for(const r of resistors){
   const pins=cat.pins('resistor');
   const mine=pins.find(rp=>g.includes(`P:${r.id}.${rp}`));
   if(!mine)continue;
   const other=pins.find(rp=>rp!==mine)!;
   const og=gOf(`P:${r.id}.${other}`);
   const ob=og?boardPins(og):[];
   if(ob.length)return ob[0] as BoardPin;
  }
  return undefined;
 };
 const firstOf=(k:string):string|undefined=>spec.parts.find(p=>p.kind===k)?.id;
 const parts:PartSpec[]=spec.parts.map(p=>{
  const net:Partial<Record<string,BoardPin>>={};
  for(const pin of cat.pins(p.kind)){const b=reach(p.id,pin);if(b)net[pin]=b;}
  const props:PartProps={...p.props};
  if(p.kind==='lamp'&&typeof props.target!=='string'){const t=firstOf('ldr');if(t)props.target=t;}
  if(p.kind==='obstacle'&&typeof props.target!=='string'){const t=firstOf('hcsr04');if(t)props.target=t;}
  if(p.kind==='resistor'){
   const g1=gOf(`P:${p.id}.1`),g2=gOf(`P:${p.id}.2`);
   const near=(g:string[]|undefined):string|undefined=>g?partPinsOf2(g).find(x=>x!==p.id&&(kinds.get(x)==='led'||kinds.get(x)==='rgb-led')):undefined;
   const led=near(g1)??near(g2);
   if(led&&typeof props.seriesWith!=='string'){props.seriesWith=led;props.role??='series';}
   else if(typeof props.role!=='string'){const gnd=[g1,g2].some(g=>g&&boardPins(g).includes('GND'));props.role=gnd?'pull-down':'series';}
   if(typeof props.ohms!=='number')props.ohms=220;
  }
  return {id:p.id,kind:p.kind as PartKind,net,props};
 });
 const wires:Wire[]=[];
 const links:PartLink[]=[];
 spec.wires.forEach(w=>{
  const color=w.color as WireColor;
  const ends=[w.from,w.to];
  const bp=ends.find(e=>isBoardPin(e)||e in RAILS);
  const pp=ends.find(e=>e!==bp);
  if(!bp){
   // part pin to part pin: a link (L298N OUT1 to a motor, a relay contact to a lamp)
   const a=/^([^.]+)\.(.+)$/.exec(w.from),b=/^([^.]+)\.(.+)$/.exec(w.to);
   if(a&&b)links.push({a:{part:a[1]!,pin:a[2]!},b:{part:b[1]!,pin:b[2]!},color});
   return;
  }
  const board=(bp in RAILS?RAILS[bp]:bp) as BoardPin;
  if(!pp||pp in RAILS||isBoardPin(pp)){if(pp&&pp in RAILS)wires.push({componentId:'bb',pin:pp==='rail.5v'?'5v-rail':'gnd-rail',boardPin:board,color});return;}
  const m=/^([^.]+)\.(.+)$/.exec(pp);
  if(m)wires.push({componentId:m[1]!,pin:m[2]!,boardPin:board,color});
 });
 return {parts,wires,...(links.length?{links}:{}),board:spec.board};
 function partPinsOf2(g:string[]):string[]{return g.flatMap(n=>{const m=/^P:([^.]+)\./.exec(n);return m?[m[1]!]:[];});}
}
