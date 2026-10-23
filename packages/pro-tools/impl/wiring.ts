/**
 * Wire derivation (arch §3.5): W1..n ordered power, ground, then signals in board-pin order. Colours, gauge, length, cable,
 * connectors, gland and terminal-block counts are all derived here; the model never sets them.
 */
import type {z} from 'zod';
import {WireSchema,PRO_LIMITS} from '../../pro-contract/system-spec.js';
import {boardProfile,findBoardPin,isGround,kindFromRef,kindOf,currentOf,mkIssue,railOf,type PartLookup,type ToolIssue} from './common.js';
import {primaryFunc} from './allocate.js';

export type SpecWire=z.infer<typeof WireSchema>;
export type End={part:string;pin:string};          // part is a part ref or 'board'
export type Connection={net:string;a:End;b:End};
export type WiringPart={ref:string;partId:string;mount?:'enclosure'|'field'|'pole'|'pipe';cableM?:number};
export type WiringResult={wires:SpecWire[];nets:string[];glands:number;terminals:Record<string,number>;issues:ToolIssue[]};

export const INSIDE_LENGTH_M=0.15;
/** Default cable run (m) of field-mounted parts by kind (arch §3.5). */
const FIELD_DEFAULT_M:[RegExp,number][]=[[/soil|moisture|probe/,3],[/ds18b20/,3],[/valve/,2],[/rain/,5],[/float|level|jsn|leaf|ph|ec-/,3]];
const FIELD_RE=/soil|moisture|probe|ds18b20|valve|rain|float|level|jsn|leaf|ph-|ec-/;
const isFieldPart=(p:WiringPart)=>p.mount?p.mount!=='enclosure':FIELD_RE.test(kindFromRef(p.ref));
const fieldLengthM=(p:WiringPart)=>p.cableM??FIELD_DEFAULT_M.find(([re])=>re.test(kindFromRef(p.ref)))?.[1]??3;

const colorFor=(func:string,kind:'power'|'ground'|'other'):SpecWire['color']=>{
 if(kind==='power')return 'red';if(kind==='ground')return 'black';
 if(func==='i2c-sda')return 'blue';if(func==='i2c-scl')return 'green';
 if(func.startsWith('spi-'))return 'orange';if(func.startsWith('uart-')||func==='rs485-de')return 'purple';
 return 'yellow';
};
const BUS_FUNCS=/^(i2c|spi|uart)-|^rs485/;

export function deriveWires(input:{board:string;parts:WiringPart[];connections:Connection[]},lookup:PartLookup):WiringResult{
 const b=boardProfile(input.board);
 const byRef=new Map(input.parts.map(p=>[p.ref,p]));
 const issues:ToolIssue[]=[];
 type Row={c:Connection;kind:'power'|'ground'|'other';func:string;sortKey:[number,number,string];partEnd:End;otherEnd:End;fieldPart?:WiringPart;peakMa:number};
 const rows:Row[]=[];
 for(const c of input.connections){
  const boardEnd=c.a.part==='board'?c.a:c.b.part==='board'?c.b:undefined;
  const partEnd=c.a.part==='board'?c.b:c.a,otherEnd=partEnd===c.a?c.b:c.a;
  const rec=byRef.get(partEnd.part)?lookup(byRef.get(partEnd.part)!.partId):undefined;
  const def=rec?.pins.map(p=>p.v).find(p=>p.name.toUpperCase()===partEnd.pin.toUpperCase());
  let kind:Row['kind']='other',func='digital-in';
  const bn=boardEnd?.pin;
  if((bn&&railOf(b,bn)!==undefined)||def?.func.includes('power'))kind='power';
  else if((bn&&isGround(b,bn))||def?.func.includes('ground'))kind='ground';
  else if(def)func=primaryFunc(def.func,rec?kindOf(rec):'')??'digital-in';
  const bp=bn?findBoardPin(b,bn):undefined;
  const rank=kind==='power'?0:kind==='ground'?1:2;
  rows.push({c,kind,func,sortKey:[rank,bp?.gpio??999,`${c.net}:${partEnd.part}:${partEnd.pin}`],partEnd,otherEnd,peakMa:rec?currentOf(rec).peak:0,
   ...(byRef.get(partEnd.part)&&isFieldPart(byRef.get(partEnd.part)!)?{fieldPart:byRef.get(partEnd.part)}:{})});
 }
 rows.sort((x,y)=>x.sortKey[0]-y.sortKey[0]||x.sortKey[1]-y.sortKey[1]||(x.sortKey[2]<y.sortKey[2]?-1:x.sortKey[2]>y.sortKey[2]?1:0));
 if(rows.length>PRO_LIMITS.wiresPerNode)issues.push(mkIssue('wire.too-many','error',`More than ${PRO_LIMITS.wiresPerNode} wires on one node.`,`Lebih dari ${PRO_LIMITS.wiresPerNode} kabel pada satu node.`));
 const terminals:Record<string,number>={};const glandParts=new Set<string>();
 const wires:SpecWire[]=rows.slice(0,PRO_LIMITS.wiresPerNode).map((r,i)=>{
  const id=`W${i+1}`;
  const fp=r.fieldPart;
  if(fp){glandParts.add(fp.ref);if(!(fp.ref in terminals))terminals[fp.ref]=Object.keys(terminals).length+1;}
  const lengthM=fp?fieldLengthM(fp):INSIDE_LENGTH_M;
  const heavy=r.kind!=='other'&&r.peakMa>=1000;
  const cable:SpecWire['cable']=!fp?'dupont':r.kind==='other'?'3-core-shielded':heavy?'power-2x0.75':'2-core';
  const awg=!fp?24:r.kind==='other'?24:heavy?18:22;
  const partShort=kindFromRef(r.partEnd.part).toUpperCase().slice(0,24);
  const boardEnd=r.c.a.part==='board'?r.c.a:r.c.b.part==='board'?r.c.b:undefined;
  const from=boardEnd?r.partEnd:r.c.a,to=boardEnd?boardEnd:r.c.b;
  const label=boardEnd?`${id} · ${boardEnd.pin} → ${r.partEnd.pin} (${partShort})`:`${id} · ${r.c.a.part}.${r.c.a.pin} → ${r.c.b.part}.${r.c.b.pin}`;
  return {
   id,from:{part:from.part,pin:from.pin.slice(0,12)},to:{part:to.part,pin:to.pin.slice(0,12)},
   func:r.kind==='power'?'power':r.kind==='ground'?'ground':BUS_FUNCS.test(r.func)?'bus':'signal',
   color:colorFor(r.func,r.kind),label:label.slice(0,80),lengthM,awg,cable,
   connectors:{from:fp?'screw-terminal':'header',to:'header'},viaGland:!!fp,
  };
 });
 return {wires,nets:rows.map(r=>r.c.net),glands:glandParts.size,terminals,issues};
}
