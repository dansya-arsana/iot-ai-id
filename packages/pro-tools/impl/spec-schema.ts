/**
 * get_spec_schema (pure, deterministic) and the helpers behind save_revision ergonomics:
 *  - getSpecSchema(): the model-writable part of SystemSpec as a compact JSON Schema, one complete valid example,
 *    server-owned paths, id patterns, enum values and length limits;
 *  - prefillServerFields(): wire ids and the compile-derived code fields are filled by the server when the model omits them;
 *  - describeIssues(): every schema issue at once, each with path, message, expected and a short example value.
 * "Don't cage the model, give it verified hands": the model is told the shape instead of guessing it.
 */
import {createHash} from 'node:crypto';
import {z} from 'zod';
import {
 BiSchema,CodeFileSchema,NodeSchema,SiteSchema,FieldSchema,LinkSchema,WireSchema,PRO_LIMITS,SLUG_RE,FILENAME_RE,CHECKLIST_ID_RE,
 CROPS,STRESS,PRO_BOARDS,NODE_ROLES,PART_ROLES,POWER_SOURCES,IP_RATINGS,MOUNTS,MEDIA,METRICS,LANGUAGES,WIRE_COLORS,PIN_FUNCS,CABLES,CONNECTORS,
} from '../../pro-contract/system-spec.js';
import {SERVER_OWNED_PATHS} from '../../pro-contract/patch.js';

// ---------- the writable shape ----------
const WritableWire=WireSchema.partial({id:true});
const WritableNode=NodeSchema.extend({wires:z.array(WritableWire).max(PRO_LIMITS.wiresPerNode)});
const WritableCode=CodeFileSchema.omit({verify:true,configSha256:true,pinsReferenced:true}).extend({libraries:CodeFileSchema.shape.libraries.optional()});
export const WritableSpecSchema=z.object({
 site:SiteSchema,
 fields:z.array(FieldSchema).min(1).max(PRO_LIMITS.fields),
 nodes:z.array(WritableNode).min(2).max(PRO_LIMITS.nodes),
 links:z.array(LinkSchema).max(PRO_LIMITS.links),
 code:z.array(WritableCode).max(PRO_LIMITS.nodes*PRO_LIMITS.filesPerNode),
 summary:BiSchema,
}).strict();

/** Drops validation noise a model does not need: closed-object flags and the draft marker. */
const compact=(n:unknown):unknown=>{
 if(Array.isArray(n))return n.map(compact);
 if(!n||typeof n!=='object')return n;
 const o:Record<string,unknown>={};
 for(const [k,v] of Object.entries(n as Record<string,unknown>)){
  if(k==='additionalProperties'||k==='$schema')continue;
  o[k]=compact(v);
 }
 return o;
};

// ---------- a minimal, complete, VALID example (the model-writable part) ----------
const bi=(en:string,id:string)=>({en,id});
export const SPEC_EXAMPLE={
 site:{name:'Melon greenhouse',regionId:'jabar',location:{lat:-6.6,lon:106.8},gridPower:'unreliable',internet:'wifi',stress:['heat','power'],peakSunHours:3.5,plan:{widthM:60,heightM:40}},
 fields:[{id:'melon',name:'Melon',crop:'melon',areaM2:1200,plan:{x:-15,y:-5,w:30,h:30},distanceToGatewayM:35,distanceSource:'user'}],
 nodes:[
  {id:'node-melon',role:'field',fieldId:'melon',board:'esp32-devkitc',
   parts:[
    {id:'soil-moisture-capacitive-1',kind:'soil-moisture-capacitive',role:'sensor',qty:1,purpose:bi('Soil moisture','Kelembapan tanah'),mount:'field',cableM:3},
    {id:'lora-rfm95w-1',kind:'lora-rfm95w',role:'radio',qty:1,purpose:bi('Uplink to gateway','Uplink ke gateway'),mount:'enclosure'},
   ],
   pins:[
    {boardPin:'GPIO34',gpio:34,func:'adc',part:'soil-moisture-capacitive-1',partPin:'AOUT',symbol:'PIN_SOIL_1'},
    {boardPin:'GPIO5',gpio:5,func:'spi-cs',part:'lora-rfm95w-1',partPin:'NSS',symbol:'PIN_LORA_CS'},
    {boardPin:'GPIO14',gpio:14,func:'reset',part:'lora-rfm95w-1',partPin:'RST',symbol:'PIN_LORA_RST'},
   ],
   wires:[
    {id:'W1',from:{part:'soil-moisture-capacitive-1',pin:'AOUT'},to:{part:'board',pin:'GPIO34'},func:'signal',color:'yellow',label:'W1 · GPIO34 → AOUT (soil)',lengthM:3,awg:22,cable:'3-core-shielded',connectors:{from:'screw-terminal',to:'header'},viaGland:true},
    {id:'W2',from:{part:'lora-rfm95w-1',pin:'NSS'},to:{part:'board',pin:'GPIO5'},func:'signal',color:'blue',label:'W2 · GPIO5 → NSS (LoRa)',lengthM:0.1,awg:26,cable:'dupont',connectors:{from:'header',to:'header'},viaGland:false},
    {id:'W3',from:{part:'lora-rfm95w-1',pin:'RST'},to:{part:'board',pin:'GPIO14'},func:'signal',color:'green',label:'W3 · GPIO14 → RST (LoRa)',lengthM:0.1,awg:26,cable:'dupont',connectors:{from:'header',to:'header'},viaGland:false},
   ],
   power:{source:'usb',supplyV:5,budget:{avgMa:60,peakMa:140,dailyWh:7.2},ok:true},
   enclosure:{ip:'IP65',mount:'pole',sizeMm:{w:120,h:80,d:55},glands:2},
   rules:[{id:'rule-1',when:{part:'soil-moisture-capacitive-1',metric:'soil-moisture-pct',op:'<',value:30},then:{part:'lora-rfm95w-1',action:'pulse',durationS:5},reason:bi('Send a reading when soil is dry','Kirim bacaan saat tanah kering')}],
   sampleEveryS:300,rationale:bi('Monitor the Melon field.','Pantau lahan Melon.')},
  {id:'gateway',role:'gateway',board:'esp32-devkitc',
   parts:[{id:'lora-rfm95w-1',kind:'lora-rfm95w',role:'radio',qty:1,purpose:bi('LoRa receiver','Penerima LoRa'),mount:'enclosure'}],
   pins:[{boardPin:'GPIO5',gpio:5,func:'spi-cs',part:'lora-rfm95w-1',partPin:'NSS',symbol:'PIN_LORA_CS'}],
   wires:[{id:'W4',from:{part:'lora-rfm95w-1',pin:'NSS'},to:{part:'board',pin:'GPIO5'},func:'signal',color:'blue',label:'W4 · GPIO5 → NSS (LoRa)',lengthM:0.1,awg:26,cable:'dupont',connectors:{from:'header',to:'header'},viaGland:false}],
   power:{source:'mains',supplyV:5,budget:{avgMa:130,peakMa:260,dailyWh:15.6},ok:true},
   enclosure:{ip:'IP54',mount:'wall',sizeMm:{w:150,h:100,d:60},glands:2},
   rules:[],sampleEveryS:60,rationale:bi('Receives LoRa uplinks and forwards them.','Menerima uplink LoRa dan meneruskannya.')},
 ],
 links:[{id:'link-node-melon-gateway',from:'node-melon',to:'gateway',distanceM:35,params:{medium:'lora',band:'AS923-2',freqMHz:921.4,sf:8,bwKHz:125,txPowerDbm:14,codingRate:'4/5'},estimate:{marginDb:30,ok:true,basis:bi('Estimate (free-space plus rural margin)','Estimasi (ruang bebas plus margin pedesaan)')}}],
 code:[{id:'code-node-melon-main-ino',nodeId:'node-melon',board:'esp32-devkitc',language:'arduino-cpp',filename:'main.ino',content:'void setup(){Serial.begin(115200);}\nvoid loop(){}\n'}],
 summary:bi('One melon field with a LoRa gateway.','Satu lahan melon dengan gateway LoRa.'),
};

export interface SpecGuide{
 jsonSchema:Record<string,unknown>;
 example:unknown;
 serverOwned:{patchPathsIgnored:readonly string[];rebuiltByServer:string[];serverFillsWhenOmitted:string[]};
 patterns:Record<string,string>;
 enums:Record<string,readonly string[]>;
 limits:Record<string,number>;
 notes:string[];
}

export function getSpecSchema():SpecGuide{
 return{
  jsonSchema:compact(z.toJSONSchema(WritableSpecSchema,{io:'input',unrepresentable:'any'})) as Record<string,unknown>,
  example:SPEC_EXAMPLE,
  serverOwned:{
   patchPathsIgnored:SERVER_OWNED_PATHS,
   rebuiltByServer:['/verification','/meta','/checks','/checklist','/tests','/bom (lines and totalIdr, from nodes[].parts)'],
   serverFillsWhenOmitted:['nodes[].wires[].id (W1, W2, ... assigned in order)','code[].verify, code[].configSha256, code[].pinsReferenced, code[].libraries'],
  },
  patterns:{
   slug:SLUG_RE.source,wireId:'^W\\d{1,3}$',linkId:'^link-[a-z0-9-]{1,70}$',codeId:'^code-[a-z0-9-]{1,80}$',filename:FILENAME_RE.source,
   configSymbol:'^[A-Z][A-Z0-9_]{0,31}$',time:'^([01]\\d|2[0-3]):[0-5]\\d$',checklistId:CHECKLIST_ID_RE.source,
  },
  enums:{crop:CROPS,siteStress:STRESS,gridPower:['none','unreliable','reliable'],internet:['none','cellular','wifi','fiber'],board:PRO_BOARDS,nodeRole:NODE_ROLES,partRole:PART_ROLES,partMount:['enclosure','field','pole','pipe'],
   powerSource:POWER_SOURCES,ip:IP_RATINGS,enclosureMount:MOUNTS,linkMedium:MEDIA,metric:METRICS,language:LANGUAGES,wireColor:WIRE_COLORS,pinFunc:PIN_FUNCS,wireFunc:['power','ground','signal','bus'],
   cable:CABLES,connector:CONNECTORS,ruleOp:['<','<=','>','>='],ruleAction:['on','off','pulse'],distanceSource:['user','layout-estimate'],loraCodingRate:['4/5','4/6','4/7','4/8']},
  limits:{...PRO_LIMITS,bilingualShortChars:120,bilingualLongChars:400,siteNameChars:80,fieldNameChars:60,wireLabelChars:80,ruleHysteresisMax:1000},
  notes:[
   'Send one SpecPatch with a complete design when you can; use draft:true to save progress and fix issues step by step.',
   'Every bilingual text is {en,id}; short ones (purpose, reason, basis, title) are at most 120 characters.',
   'ids: fields and nodes use slugs (lowercase, digits, hyphen); a field node is node-<fieldId>; part ids are <kind>-<n>; rules are rule-1, rule-2, ...',
   'Set power as one whole object (replace /nodes/<i>/power); /power/budget and /power/ok alone are server-owned paths and are ignored. Fill budget from solve_power.',
   'Use catalog kinds that catalog_search returned; check pins with allocate_pins and validate_netlist before saving.',
   'Exactly one node has role gateway. Every field needs a node with that fieldId. Wire and pin rows may reference only part ids of the same node (or "board").',
  ],
 };
}

// ---------- server-side fill of fields the model cannot know ----------
const sha=(s:string)=>createHash('sha256').update(s).digest('hex');
const isObj=(v:unknown):v is Record<string,unknown>=>!!v&&typeof v==='object'&&!Array.isArray(v);
/** Mutates a patched copy: wire ids, and the compile-derived fields of code files, when omitted. The gate replaces `verify` and `pinsReferenced` when it can compile. */
export function prefillServerFields(doc:Record<string,unknown>,nowIso:string):void{
 if(Array.isArray(doc.nodes)){
  let max=0;
  for(const n of doc.nodes)if(isObj(n)&&Array.isArray(n.wires))for(const w of n.wires){const m=isObj(w)&&typeof w.id==='string'?/^W(\d{1,3})$/.exec(w.id):null;if(m)max=Math.max(max,Number(m[1]));}
  for(const n of doc.nodes)if(isObj(n)&&Array.isArray(n.wires))for(const w of n.wires)if(isObj(w)&&w.id===undefined&&max<999)w.id=`W${++max}`;
 }
 if(Array.isArray(doc.code)){
  for(const c of doc.code){
   if(!isObj(c)||typeof c.content!=='string')continue;
   if(c.configSha256===undefined)c.configSha256=sha(c.content);
   if(c.pinsReferenced===undefined)c.pinsReferenced=[];
   if(c.libraries===undefined)c.libraries=[];
   if(c.verify===undefined)c.verify={status:'pending',toolchain:'pending',at:nowIso,sha256:sha(c.content),diagnostics:[]};
  }
 }
}

// ---------- every issue at once ----------
export interface SpecIssueOut{path:string;message:string;expected?:string;example?:unknown}
type ZIssue={code:string;path:PropertyKey[];message:string;[k:string]:unknown};
const lookupExample=(path:PropertyKey[]):unknown=>{
 let cur:unknown=SPEC_EXAMPLE;
 for(const k of path){
  // any array index maps to the example's first element
  if(Array.isArray(cur))cur=cur[0];
  else if(isObj(cur))cur=cur[String(k)];
  else return undefined;
  if(cur===undefined)return undefined;
 }
 return cur;
};
const short=(v:unknown):unknown=>{if(v===undefined)return undefined;const s=JSON.stringify(v);return s.length<=120?v:s.slice(0,117)+'...';};
export function describeIssues(issues:ZIssue[],max=200):SpecIssueOut[]{
 return issues.slice(0,max).map(i=>{
  const path='/'+i.path.map(String).join('/');
  const out:SpecIssueOut={path,message:i.message};
  const ex=short(lookupExample(i.path));
  if(i.code==='invalid_value'&&Array.isArray(i.values)){out.expected='one of '+i.values.map(v=>JSON.stringify(v)).join(' | ');out.example=ex??i.values[0];}
  else if(i.code==='invalid_union'&&Array.isArray(i.options)){out.expected='one of '+i.options.map(v=>JSON.stringify(v)).join(' | ');out.example=ex??i.options[0];}
  else if(i.code==='invalid_format'&&typeof i.pattern==='string'){out.expected='string matching '+i.pattern;if(ex!==undefined)out.example=ex;}
  else if(i.code==='invalid_type'){
   const missing=/received undefined/.test(i.message);
   out.expected=(missing?'required ':'')+String(i.expected);
   if(missing)out.message=`${i.path.length?String(i.path[i.path.length-1]):'value'} is required`;
   if(ex!==undefined)out.example=ex;
  }
  else if(i.code==='too_big'){out.expected=`${String(i.origin??'value')} at most ${String(i.maximum)}${i.origin==='string'?' characters':''}`;if(ex!==undefined)out.example=ex;}
  else if(i.code==='too_small'){out.expected=`${String(i.origin??'value')} at least ${String(i.minimum)}${i.origin==='string'?' characters':''}`;if(ex!==undefined)out.example=ex;}
  else if(i.code==='unrecognized_keys'&&Array.isArray(i.keys)){out.expected='no keys other than the schema ones';out.message=`unknown key(s): ${i.keys.map(String).join(', ')}. Remove them.`;}
  else if(ex!==undefined)out.example=ex;
  return out;
 });
}
