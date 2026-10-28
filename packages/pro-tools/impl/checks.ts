/**
 * Spec-level design checks from the rules table (agri-domain §7). Per-node verifiers (compatibility, netlist, power, link) are run by the
 * save_revision gate through their own adapters; this module adds the cross-cutting domain rules, link results, BOM price gaps and the
 * code-pin cross-check. Policy: only grade A/B rules can be errors (data/rules.ts). Kominfo power and duty rules are INFO only.
 */
import type {z} from 'zod';
import type {CheckSchema,SystemSpec} from '../../pro-contract/system-spec.js';
import {kindOf,mkIssue,ruleIssue,type PartLookup,type ToolIssue} from './common.js';
import {isWrongBandId,coversBand} from '../data/radio.js';
import {AGRONOMIST_NOTE,cropProfile,needsAgronomistNote} from '../data/crops.js';
import {rule} from '../data/rules.js';
import {checkStoredLink} from './link.js';
import {buildBom} from './bom.js';

export type Check=z.infer<typeof CheckSchema>;
export type CheckSpec=Pick<SystemSpec,'site'|'fields'|'nodes'|'links'|'code'>;
type Scope=Check['scope'];
const IP_RANK:Record<string,number>={IP54:54,IP65:65,IP66:66,IP67:67};
const cut=(s:string,n=300)=>s.length>n?s.slice(0,n-1)+'…':s;
const code=(c:string)=>{const s=c.toLowerCase().replace(/[^a-z0-9.-]+/g,'-').replace(/^[^a-z]+/,'x');return (s.length<2?s+'x':s).slice(0,48);};

export function toCheck(i:ToolIssue,scope:Scope):Check{
 return {code:code(i.code),severity:i.severity,scope,en:cut(i.en),id:cut(i.id),...(i.ref?{ref:i.ref.slice(0,60)}:{})};
}

export function runChecks(spec:CheckSpec,lookup?:PartLookup):Check[]{
 const out:Check[]=[];
 const push=(i:ToolIssue,scope:Scope)=>out.push(toCheck(i,scope));
 const fields=new Map(spec.fields.map(f=>[f.id,f]));
 const gateway=spec.nodes.find(n=>n.role==='gateway');
 const has=(n:CheckSpec['nodes'][number],re:RegExp)=>n.parts.some(p=>re.test(p.kind));
 let loraSeen=false,agroNote=false;

 if((spec.site.peakSunHours??0)>4)push(ruleIssue('PWR-07'),{});
 for(const n of spec.nodes){
  const scope:Scope={nodeId:n.id,...(n.fieldId?{fieldId:n.fieldId}:{})};
  // RF module band
  for(const p of n.parts){
   const rec=lookup?.(p.kind);
   const lora=rec?rec.protocols.supported.v.includes('lora'):/lora/.test(p.kind);
   if(p.role==='radio'||lora){
    if(isWrongBandId(p.kind)||isWrongBandId(rec?kindOf(rec):'')||(rec&&lora&&rec.protocols.freqMHz&&!coversBand(rec.protocols.freqMHz.v)))
     push(ruleIssue('NET-05',p.id,{en:`${p.kind} cannot run in 920-923 MHz. Use RFM95W, Ra-01H or SX1262 915.`,id:`${p.kind} tidak bisa bekerja di 920-923 MHz. Gunakan RFM95W, Ra-01H atau SX1262 915.`}),scope);
   }
   if(/resistive|fc-?28|yl-?69/.test(p.kind))push(ruleIssue('SEN-01',p.id),scope);
   if(/hc-?sr04$|hcsr04/.test(p.kind)&&p.mount!=='enclosure')push(ruleIssue('SEN-10',p.id),scope);
   if(/ds18b20|dht22/.test(p.kind)&&(p.cableM??0)>20)push(ruleIssue('SEN-11',p.id),scope);
  }
  if((n.power.source==='battery'||n.power.source==='solar-battery')&&/devkit|nodemcu/.test(n.board))push(ruleIssue('PWR-02',n.id),scope);
  if(n.role!=='gateway'&&n.role!=='device'&&(IP_RANK[n.enclosure.ip]??0)<65)push(ruleIssue('ENC-01',n.id),scope);
  // crop rules
  const f=n.fieldId?fields.get(n.fieldId):undefined;
  if(f){
   const prof=cropProfile(f.crop);
   if(prof&&needsAgronomistNote(prof)&&!agroNote){agroNote=true;push(ruleIssue('CROP-15',f.id,{en:`${rule('CROP-15').en} (${prof.label.en}, grade ${prof.grade}). ${AGRONOMIST_NOTE.en}`,id:`${rule('CROP-15').idn} (${prof.label.id}, grade ${prof.grade}). ${AGRONOMIST_NOTE.id}`}),{fieldId:f.id});}
   if(f.crop==='melon'){
    if(!has(n,/dht|bme|sht|am2302|air-?t/))push(ruleIssue('CROP-03',n.id),scope);
    if(!has(n,/fan|vent/))push(ruleIssue('CROP-04',n.id),scope);
   }
   if(f.crop==='flowers'){
    if(!has(n,/relay|lamp/)||(!has(n,/rtc|ds3231/)&&n.power.source!=='mains'))push(ruleIssue('CROP-10',n.id),scope);
    if(!has(n,/leaf|dht|bme|sht/))push(ruleIssue('CROP-12',n.id),scope);
   }
  }
  // links: every field node needs a link to the gateway
  if(n.role==='field'&&gateway&&!spec.links.some(l=>(l.from===n.id&&l.to===gateway.id)||(l.to===n.id&&l.from===gateway.id)||l.from===n.id))
   push(mkIssue('link.missing','error',`Field node ${n.id} has no link to the gateway.`,`Node lahan ${n.id} belum punya link ke gateway.`,n.id,'B'),scope);
 }
 // gateway
 if(gateway){
  const gs:Scope={nodeId:gateway.id};
  if(!has(gateway,/arrester|spd|surge/)&&spec.links.some(l=>l.params.medium==='lora'))push(ruleIssue('ENC-04',gateway.id),gs);
  if(spec.site.internet==='none'&&!spec.links.some(l=>(l.params.medium==='cellular'||l.params.medium==='ethernet')&&(l.from===gateway.id||l.to===gateway.id)))
   push(mkIssue('net.gateway-uplink','warning','The gateway has no internet uplink (site has none and no cellular or Ethernet link).','Gateway tidak punya uplink internet (lokasi tidak punya dan tidak ada link seluler atau Ethernet).',gateway.id,'B'),gs);
 }
 // links
 for(const l of spec.links){
  const r=checkStoredLink(l,spec,lookup);
  for(const i of r.issues){
   if(i.code==='net-06'){if(loraSeen)continue;loraSeen=true;}
   push(i,{linkId:l.id});
  }
 }
 // code pin cross-check (parsed pins vs allocated pins)
 for(const c of spec.code){
  const node=spec.nodes.find(n=>n.id===c.nodeId);if(!node)continue;
  for(const ref of c.pinsReferenced){
   const row=node.pins.find(p=>p.symbol===ref.symbol);
   if(!row)push(mkIssue('code.pin-unknown','error',`${c.filename} uses ${ref.symbol}, which is not an allocated pin of ${node.id}.`,`${c.filename} memakai ${ref.symbol} yang bukan pin teralokasi ${node.id}.`,c.id,'B'),{nodeId:node.id,fileId:c.id});
   else if(row.boardPin!==ref.pin)push(mkIssue('code.pin-mismatch','error',`${c.filename}: ${ref.symbol} is ${ref.pin} in code but ${row.boardPin} in the pin table.`,`${c.filename}: ${ref.symbol} adalah ${ref.pin} di kode tetapi ${row.boardPin} di tabel pin.`,c.id,'B'),{nodeId:node.id,fileId:c.id});
  }
 }
 // BOM prices
 for(const i of buildBom({nodes:spec.nodes},lookup).issues)push(i,{});
 return out.slice(0,300);
}
