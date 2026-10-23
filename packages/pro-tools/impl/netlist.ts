/**
 * validate_netlist: terminals are "ref.PIN" ("board.GPIO4" for the board). Nets that share a terminal are merged first, then each net is
 * checked (shorts, rail voltage, pin capability, strap/flash/input-only/ADC2 use, unpowered parts) and wires are derived (wiring.ts).
 */
import {boardProfile,findBoardPin,isGround,kindOf,mkIssue,pinDefs,railOf,supplyOf,hasError,type PartLookup,type ToolIssue} from './common.js';
import {primaryFunc} from './allocate.js';
import {deriveWires,type Connection,type SpecWire,type WiringPart} from './wiring.js';
import type {ProNode} from '../../pro-contract/system-spec.js';

export type NetlistInput={board:string;parts:{ref:string;partId:string;props?:Record<string,string|number|boolean>}[];nets:{name:string;terminals:string[]}[]};
export type NetlistWire={id:string;net:string;from:string;to:string;color:string;awg:number;lengthM:number;connector:string};
export type NetlistOutput={ok:boolean;issues:ToolIssue[];wires:NetlistWire[]};
export type NetlistFull=NetlistOutput&{specWires:SpecWire[];glands:number;terminals:Record<string,number>};

const SHARED_BUS=new Set(['i2c-sda','i2c-scl','spi-sck','spi-mosi','spi-miso','onewire']);
const POWER_SOURCE_RE=/battery|solar|psu|charger|supply/;
const split=(t:string):{part:string;pin:string}|undefined=>{const i=t.indexOf('.');return i>0&&i<t.length-1?{part:t.slice(0,i),pin:t.slice(i+1)}:undefined;};
const txt=(e:{part:string;pin:string})=>`${e.part}.${e.pin}`;

export function validateNetlistFull(input:NetlistInput,lookup:PartLookup):NetlistFull{
 const b=boardProfile(input.board),issues:ToolIssue[]=[];
 const parts=new Map(input.parts.map(p=>[p.ref,p]));
 const recs=new Map<string,NonNullable<ReturnType<PartLookup>>>();
 for(const p of input.parts){const r=lookup(p.partId);if(!r)issues.push(mkIssue('part.unknown','error',`Part ${p.partId} is not in the catalog.`,`Part ${p.partId} tidak ada di katalog.`,p.ref));else recs.set(p.ref,r);}
 const partPin=(ref:string,pin:string)=>recs.get(ref)&&pinDefs(recs.get(ref)!).find(d=>d.name.toUpperCase()===pin.toUpperCase());

 // 1. parse and resolve terminals
 type Term={part:string;pin:string;canon:string};
 const nets:{name:string;terms:Term[]}[]=[];
 for(const n of input.nets){
  const terms:Term[]=[];
  for(const raw of n.terminals){
   const e=split(raw);
   if(!e){issues.push(mkIssue('net.terminal-format','error',`Terminal "${raw}" must be "ref.PIN".`,`Terminal "${raw}" harus berformat "ref.PIN".`,n.name));continue;}
   if(e.part==='board'){
    const known=railOf(b,e.pin)!==undefined||isGround(b,e.pin)||findBoardPin(b,e.pin);
    if(!known){issues.push(mkIssue('net.board-pin-unknown','error',`${b.label} has no pin ${e.pin}.`,`${b.label} tidak punya pin ${e.pin}.`,n.name,'B'));continue;}
    const bp=findBoardPin(b,e.pin);terms.push({part:'board',pin:bp?bp.name:e.pin.toUpperCase(),canon:`board.${bp?bp.name:e.pin.toUpperCase()}`});continue;
   }
   if(!parts.has(e.part)){issues.push(mkIssue('net.ref-unknown','error',`Terminal ${raw} uses an unknown part ref.`,`Terminal ${raw} memakai ref part yang tidak dikenal.`,n.name));continue;}
   const d=partPin(e.part,e.pin);
   if(recs.has(e.part)&&!d){issues.push(mkIssue('net.pin-unknown','error',`Part ${e.part} has no pin ${e.pin}.`,`Part ${e.part} tidak punya pin ${e.pin}.`,e.part,'B'));continue;}
   terms.push({part:e.part,pin:d?d.name:e.pin,canon:`${e.part}.${d?d.name:e.pin}`});
  }
  nets.push({name:n.name,terms});
 }
 // 2. merge nets sharing a terminal
 const parent=nets.map((_,i)=>i);const find=(i:number):number=>parent[i]===i?i:(parent[i]=find(parent[i]!));
 const owner=new Map<string,number>();
 nets.forEach((n,i)=>n.terms.forEach(t=>{const o=owner.get(t.canon);if(o===undefined)owner.set(t.canon,i);else parent[find(i)]=find(o);}));
 const merged=new Map<number,{name:string;terms:Term[]}>();
 nets.forEach((n,i)=>{const r=find(i);const m=merged.get(r)??{name:n.name,terms:[]};for(const t of n.terms)if(!m.terms.some(x=>x.canon===t.canon))m.terms.push(t);merged.set(r,m);});

 const connected=new Set<string>();
 const connections:Connection[]=[];
 for(const net of merged.values()){
  const boards=net.terms.filter(t=>t.part==='board'),ps=net.terms.filter(t=>t.part!=='board');
  net.terms.forEach(t=>connected.add(t.canon));
  if(net.terms.length<2)issues.push(mkIssue('net.single','warning',`Net ${net.name} has fewer than two valid terminals.`,`Net ${net.name} punya kurang dari dua terminal valid.`,net.name));
  // shorts
  const rails=new Set(boards.filter(t=>railOf(b,t.pin)!==undefined).map(t=>t.pin));
  const hasGnd=boards.some(t=>isGround(b,t.pin))||ps.some(t=>partPin(t.part,t.pin)?.func.includes('ground'));
  const partPowerOnly=ps.filter(t=>partPin(t.part,t.pin)?.func.includes('power'));
  if(rails.size>1)issues.push(mkIssue('net.rail-short','error',`Net ${net.name} joins rails ${[...rails].join(' and ')}.`,`Net ${net.name} menghubungkan rail ${[...rails].join(' dan ')}.`,net.name,'A'));
  if((rails.size>0||partPowerOnly.length>0)&&hasGnd)issues.push(mkIssue('net.short','error',`Net ${net.name} joins a power pin and ground (short circuit).`,`Net ${net.name} menghubungkan pin daya dan ground (korsleting).`,net.name,'A'));
  // rail voltage against part supply
  for(const t of partPowerOnly){
   const rec=recs.get(t.part);if(!rec||POWER_SOURCE_RE.test(kindOf(rec)))continue;
   for(const r of rails){const v=railOf(b,r)!,s=supplyOf(rec);
    if(v<s.min-0.05||v>s.max+0.05)issues.push(mkIssue('net.rail-voltage','error',`${t.part}.${t.pin} needs ${s.min}-${s.max} V but is on ${r} (${v} V).`,`${t.part}.${t.pin} butuh ${s.min}-${s.max} V tetapi terhubung ke ${r} (${v} V).`,t.part,'B'));}
  }
  // signal terminals
  const sig=ps.map(t=>({t,f:primaryFunc(partPin(t.part,t.pin)?.func??[],recs.get(t.part)?kindOf(recs.get(t.part)!):'')})).filter(x=>x.f);
  for(const bt of boards){
   const bp=findBoardPin(b,bt.pin);if(!bp)continue;
   if(sig.length===0)continue;
   const funcs=new Set(sig.map(s=>s.f));
   const sameShared=funcs.size===1&&SHARED_BUS.has([...funcs][0]!);
   if(sig.length>1&&!sameShared)issues.push(mkIssue('net.pin-conflict','error',`Board pin ${bp.name} is shared by ${sig.map(s=>s.t.canon).join(', ')} (not a shared bus).`,`Pin board ${bp.name} dipakai bersama ${sig.map(s=>s.t.canon).join(', ')} (bukan bus bersama).`,bp.name,'A'));
   for(const f of funcs){
    if(f==='adc'&&!bp.adc)issues.push(mkIssue('net.adc-pin','error',`${bp.name} has no ADC; analog input needs an ADC pin.`,`${bp.name} tidak punya ADC; input analog perlu pin ADC.`,bp.name,'B'));
    if(f==='adc'&&bp.adc===2&&b.wifi)issues.push(mkIssue('net.adc2-wifi','warning',`${bp.name} is ADC2, which does not work while Wi-Fi is on.`,`${bp.name} adalah ADC2 yang tidak berfungsi saat Wi-Fi aktif.`,bp.name,'B'));
    if(f!=='adc'&&f!=='digital-in'&&f!=='irq'&&!bp.out)issues.push(mkIssue('net.input-only','error',`${bp.name} is input-only and cannot drive ${f}.`,`${bp.name} hanya input dan tidak bisa untuk ${f}.`,bp.name,'A'));
   }
   if(bp.flash)issues.push(mkIssue('net.flash-pin','error',`${bp.name} is connected to the flash chip; never use it.`,`${bp.name} terhubung ke chip flash; jangan dipakai.`,bp.name,'A'));
   else if(bp.strap)issues.push(mkIssue('net.strap-pin','warning',`${bp.name} is a boot strapping pin; the part may stop the board from booting.`,`${bp.name} adalah pin strapping boot; part bisa menghalangi board untuk boot.`,bp.name,'A'));
   else if(bp.reserved)issues.push(mkIssue('net.reserved-pin','warning',`${bp.name} is used by ${bp.reserved}.`,`${bp.name} dipakai oleh ${bp.reserved}.`,bp.name,'B'));
  }
  // connections for wiring
  const hub=boards[0];
  if(hub)for(const t of ps)connections.push({net:net.name,a:{part:t.part,pin:t.pin},b:{part:'board',pin:hub.pin}});
  else for(let i=1;i<ps.length;i++)connections.push({net:net.name,a:{part:ps[0]!.part,pin:ps[0]!.pin},b:{part:ps[i]!.part,pin:ps[i]!.pin}});
 }
 // part pin reuse across the original nets is already merged. Unpowered / unconnected pins:
 for(const [ref,rec] of recs){
  for(const d of pinDefs(rec)){
   if(connected.has(`${ref}.${d.name}`)||d.func.includes('nc'))continue;
   const pw=d.func.includes('power')||d.func.includes('ground');
   if(pw)issues.push(mkIssue('net.unpowered','error',`${ref}.${d.name} (${d.func[0]}) is not connected.`,`${ref}.${d.name} (${d.func[0]}) belum terhubung.`,ref,'B'));
   else if(primaryFunc(d.func,kindOf(rec)))issues.push(mkIssue('net.unconnected','warning',`${ref}.${d.name} is not connected.`,`${ref}.${d.name} belum terhubung.`,ref,'B'));
  }
 }
 const wp:WiringPart[]=input.parts.map(p=>({ref:p.ref,partId:p.partId,...(typeof p.props?.mount==='string'&&['enclosure','field','pole','pipe'].includes(p.props.mount)?{mount:p.props.mount as WiringPart['mount']}:{}),...(typeof p.props?.cableM==='number'?{cableM:p.props.cableM}:{})}));
 const w=deriveWires({board:input.board,parts:wp,connections},lookup);
 issues.push(...w.issues);
 const wires:NetlistWire[]=w.wires.map((x,i)=>({id:x.id,net:(w.nets[i]??'').slice(0,32),from:txt(x.from),to:txt(x.to),color:x.color,awg:x.awg,lengthM:x.lengthM,connector:`${x.connectors.from}>${x.connectors.to}`}));
 return {ok:!hasError(issues),issues:issues.slice(0,100),wires,specWires:w.wires,glands:w.glands,terminals:w.terminals};
}
/** The tool output (strict shape: no extra keys). */
export function validateNetlist(input:NetlistInput,lookup:PartLookup):NetlistOutput{
 const {ok,issues,wires}=validateNetlistFull(input,lookup);return {ok,issues,wires};
}
/** Gate adapter: check the stored wires of one node. Returns issues (the gate decides verified/failed). */
export function checkNodeNetlist(node:ProNode,lookup:PartLookup):ToolIssue[]{
 const nets=node.wires.map(w=>({name:w.id,terminals:[`${w.from.part}.${w.from.pin}`,`${w.to.part}.${w.to.pin}`]}));
 if(nets.length===0)return [mkIssue('net.empty','warning','Node has no wires.','Node belum punya kabel.',node.id)];
 return validateNetlistFull({board:node.board,parts:node.parts.map(p=>({ref:p.id,partId:p.kind})),nets},lookup).issues;
}
