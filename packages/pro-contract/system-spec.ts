/**
 * SystemSpec v1: the stored revision artifact of a Pro project (ADR 012 §3, plan M2.0). Frozen in M2.0.
 * Pure zod + string helpers: no I/O, no DOM, no three.js. ops, api and web import it.
 * The model never writes this document whole: it sends SpecPatch ops through `save_revision` (patch.ts).
 * The server derives wire ids (W#), checklist ids (ckId), BOM totals and `verification`.
 */
import {z} from 'zod';

export const SYSTEM_SPEC_VERSION=1 as const;

// ---------- limits (shared with the security review) ----------
export const PRO_LIMITS={
 promptChars:2000,fields:12,nodes:16,partsPerNode:24,rulesPerNode:12,wiresPerNode:96,links:32,
 filesPerNode:3,fileBytes:40_000,diagnostics:20,bomLines:200,checklistItems:1500,checks:300,testCases:300,
 specBytes:524_288,
} as const;

// ---------- primitives ----------
export const SLUG_RE=/^[a-z][a-z0-9-]{0,31}$/;
export const Slug=z.string().regex(SLUG_RE);
// eslint-disable-next-line no-control-regex
const CTRL=/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/;
const txt=(max:number)=>z.string().trim().min(1).max(max).refine(s=>!CTRL.test(s),'control characters are not allowed');
export const BiSchema=z.object({en:txt(400),id:txt(400)}).strict();
export const BiShortSchema=z.object({en:txt(120),id:txt(120)}).strict();
export type Bi=z.infer<typeof BiSchema>;
const IdrRangeSchema=z.object({min:z.number().int().nonnegative(),max:z.number().int().nonnegative()}).strict().refine(r=>r.max>=r.min,'max < min');
const PartRefSchema=Slug;                                   // node-local part id, e.g. 'ds18b20-1'
const SYMBOL_RE=/^[A-Z][A-Z0-9_]{0,31}$/;                   // CONFIG symbol, e.g. PIN_SOIL_1
export const FILENAME_RE=/^[a-z][a-z0-9_-]{0,40}\.(ino|py|h)$/;

/** Lowercase slug from any label (deterministic). Dedupe with suffix -2, -3 in the caller. */
export const slug=(s:string):string=>{
 const out=s.normalize('NFKD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-+|-+$/g,'').slice(0,32);
 return /^[a-z]/.test(out)?out:('x-'+out).slice(0,32);
};

// ---------- enums ----------
export const CROPS=['mango','melon','banana','flowers','chili','tomato','rice','corn','coffee','cocoa','oil-palm','vegetables','orchard-other','other'] as const;
/** Same vocabulary as hero-map Region.stress (contract test keeps them aligned). */
export const STRESS=['heat','flood','power','salt','haze','connectivity'] as const;
/** Pro board profiles . Only esp32-devkitc and rpi-4b are needed for the farm slice. */
export const PRO_BOARDS=['esp32-devkitc','esp32-s3-devkitc','pico-w','rpi-4b','rpi-5','uno','nano'] as const;
export const NODE_ROLES=['field','gateway','repeater','device'] as const;
/** 'site': fields + gateway + links (default). 'device': one self-contained product (vehicle, robot, bench tool), C2. */
export const SITE_KINDS=['site','device'] as const;
export const PART_ROLES=['sensor','actuator','radio','power','display','interface','protection'] as const;
export const POWER_SOURCES=['solar-battery','mains','battery','usb','vehicle-12v'] as const;
export const IP_RATINGS=['IP54','IP65','IP66','IP67'] as const;
export const MOUNTS=['pole','wall','stake','din'] as const;
export const MEDIA=['lora','wifi','rs485','ethernet','cellular'] as const;
export const METRICS=['soil-moisture-pct','soil-temp-c','air-temp-c','air-humidity-pct','light-lux','rain-mm','water-level-pct','battery-v'] as const;
export const LANGUAGES=['arduino-cpp','micropython','python'] as const;
export const WIRE_COLORS=['red','black','yellow','blue','green','orange','purple','white','brown','grey'] as const;
export const PIN_FUNCS=['power','ground','digital-in','digital-out','pwm','adc','onewire','i2c-sda','i2c-scl','spi-sck','spi-mosi','spi-miso','spi-cs','uart-tx','uart-rx','irq','reset','rs485-de'] as const;
export const CABLES=['dupont','jst-xh','2-core','3-core-shielded','4-core-shielded','cat5e-stp','power-2x0.75'] as const;
export const CONNECTORS=['header','screw-terminal','jst-xh','wago','gland','solder','plug'] as const;
export const CHECKLIST_PHASES=['procure','flash','wire','power-up','install','calibrate','commission'] as const;
export const TEST_PHASES=['bench','link','field','acceptance'] as const;
export type ChecklistPhase=typeof CHECKLIST_PHASES[number];

export const RuleSchema=z.object({
 id:Slug,                                          // 'rule-1'.. by order
 when:z.object({part:Slug,metric:z.enum(METRICS),op:z.enum(['<','<=','>','>=']),value:z.number().finite().min(-50).max(200_000)}).strict(),
 then:z.object({part:Slug,action:z.enum(['on','off','pulse']),durationS:z.number().int().min(1).max(3600).optional()}).strict(),
 hysteresis:z.number().nonnegative().max(1000).optional(),
 window:z.object({from:z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/),to:z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/)}).strict().optional(),
 reason:BiShortSchema,
}).strict();

// =====================================================================================
// STORED SYSTEMSPEC (deterministic ids and stamps, model-authored content)
// =====================================================================================
export const SiteSchema=z.object({
 kind:z.enum(SITE_KINDS).optional(),               // absent = 'site'
 name:txt(80),regionId:Slug.optional(),
 location:z.object({lat:z.number().min(-11).max(7),lon:z.number().min(94).max(142)}).strict().optional(), // rounded to 0.01
 // Site climate and plan: required for kind 'site' (checked in SystemSpecSchema), optional for a single device.
 gridPower:z.enum(['none','unreliable','reliable']).optional(),internet:z.enum(['none','cellular','wifi','fiber']).optional(),
 stress:z.array(z.enum(STRESS)).max(6).optional(),
 peakSunHours:z.number().min(1).max(8).optional(),           // plan D3: 3.5 default (wet-season, ESDM)
 plan:z.object({widthM:z.number().positive(),heightM:z.number().positive()}).strict().optional(), // gateway at (0,0), centre of plan
}).strict();
/** Site keys a 'site' spec must carry; a device may omit them. */
export const SITE_REQUIRED=['gridPower','internet','stress','peakSunHours','plan'] as const;

export const FieldSchema=z.object({
 id:Slug,name:txt(60),crop:z.enum(CROPS),areaM2:z.number().positive(),
 plan:z.object({x:z.number(),y:z.number(),w:z.number().positive(),h:z.number().positive()}).strict(), // metres
 distanceToGatewayM:z.number().nonnegative(),
 distanceSource:z.enum(['user','layout-estimate']),
}).strict();

export const NodePartSchema=z.object({
 id:PartRefSchema,                                 // `${kind}-${n}`
 kind:Slug,role:z.enum(PART_ROLES),qty:z.number().int().min(1).max(8),
 purpose:BiShortSchema,
 mount:z.enum(['enclosure','field','pole','pipe']),
 cableM:z.number().min(0).max(200).optional(),
}).strict();

export const PinRowSchema=z.object({
 boardPin:z.string().min(1).max(12),               // 'GPIO4', 'BCM17', 'D7', '3V3', 'GND'
 gpio:z.number().int().min(0).max(63).nullable(),
 func:z.enum(PIN_FUNCS),
 part:PartRefSchema,partPin:z.string().min(1).max(12),
 symbol:z.string().regex(SYMBOL_RE).optional(),    // CONFIG symbol for signal pins
 note:BiShortSchema.optional(),
}).strict();

const EndSchema=z.object({part:z.union([z.literal('board'),PartRefSchema]),pin:z.string().min(1).max(12)}).strict();
export const WireSchema=z.object({
 id:z.string().regex(/^W\d{1,3}$/),
 from:EndSchema,to:EndSchema,
 func:z.enum(['power','ground','signal','bus']),
 color:z.enum(WIRE_COLORS),
 label:txt(80),                                    // 'W1 · GPIO4 → DQ (DS18B20)'
 lengthM:z.number().min(0.05).max(200),
 awg:z.number().int().min(14).max(28),
 cable:z.enum(CABLES),
 connectors:z.object({from:z.enum(CONNECTORS),to:z.enum(CONNECTORS)}).strict(),
 viaGland:z.boolean(),
}).strict();

export const PowerSchema=z.object({
 source:z.enum(POWER_SOURCES),supplyV:z.number().positive().max(48),
 budget:z.object({avgMa:z.number().nonnegative(),peakMa:z.number().nonnegative(),dailyWh:z.number().nonnegative()}).strict(),
 battery:z.object({chemistry:z.enum(['li-ion-18650','lifepo4','sla']),series:z.number().int().min(1).max(16),parallel:z.number().int().min(1).max(16),capacityWh:z.number().positive(),autonomyDays:z.number().positive()}).strict().optional(),
 solar:z.object({panelW:z.number().positive(),controller:z.enum(['pwm','mppt'])}).strict().optional(),
 ok:z.boolean(),
}).strict();

export const EnclosureSchema=z.object({
 ip:z.enum(IP_RATINGS),mount:z.enum(MOUNTS),
 sizeMm:z.object({w:z.number().positive(),h:z.number().positive(),d:z.number().positive()}).strict(),
 glands:z.number().int().min(0).max(16),
}).strict();


export const NodeSchema=z.object({
 id:Slug,                                          // 'node-<fieldId>' | 'gateway' | 'repeater-<n>'
 role:z.enum(NODE_ROLES),fieldId:Slug.optional(),board:z.enum(PRO_BOARDS),
 parts:z.array(NodePartSchema).max(PRO_LIMITS.partsPerNode),
 pins:z.array(PinRowSchema).max(80),
 wires:z.array(WireSchema).max(PRO_LIMITS.wiresPerNode),
 power:PowerSchema,enclosure:EnclosureSchema,
 rules:z.array(RuleSchema).max(PRO_LIMITS.rulesPerNode),
 sampleEveryS:z.number().int().min(10).max(86_400),
 rationale:BiSchema,
 /** AVR boards only (uno/nano): derived CircuitSpec for playAssembly; validated with parseCircuitSpec, not here. */
 circuit:z.object({format:z.literal('circuit-spec@1'),sha256:z.string().regex(/^[0-9a-f]{64}$/),spec:z.unknown()}).strict().optional(),
}).strict();

const LoraParams=z.object({medium:z.literal('lora'),band:z.literal('AS923-2'),freqMHz:z.number().min(920).max(923),sf:z.number().int().min(7).max(12),bwKHz:z.union([z.literal(125),z.literal(250),z.literal(500)]),txPowerDbm:z.number().int().min(2).max(20),codingRate:z.enum(['4/5','4/6','4/7','4/8'])}).strict();
const WifiParams=z.object({medium:z.literal('wifi'),band:z.literal('2.4GHz'),ssidPlaceholder:z.literal('YOUR_WIFI_SSID')}).strict();
const Rs485Params=z.object({medium:z.literal('rs485'),baud:z.union([z.literal(9600),z.literal(19200),z.literal(38400),z.literal(115200)]),cable:z.enum(['cat5e-stp','2-pair-shielded']),termination120:z.boolean(),bias:z.boolean(),protocol:z.enum(['modbus-rtu','line-json'])}).strict();
const EthParams=z.object({medium:z.literal('ethernet')}).strict();
const CellParams=z.object({medium:z.literal('cellular'),tech:z.enum(['4g','lte-m','nb-iot'])}).strict();
export const LinkSchema=z.object({
 id:z.string().regex(/^link-[a-z0-9-]{1,70}$/),    // 'link-<from>-<to>'
 from:Slug,to:Slug,distanceM:z.number().nonnegative().max(15_000),
 params:z.discriminatedUnion('medium',[LoraParams,WifiParams,Rs485Params,EthParams,CellParams]),
 estimate:z.object({rssiDbm:z.number().optional(),marginDb:z.number().optional(),ok:z.boolean(),basis:BiShortSchema}).strict(),
}).strict();

export const DiagnosticSchema=z.object({line:z.number().int().min(0),message:txt(400),severity:z.enum(['error','warning'])}).strict();
export const CodeFileSchema=z.object({
 id:z.string().regex(/^code-[a-z0-9-]{1,80}$/),    // `code-${nodeId}-${slug(filename)}`
 nodeId:Slug,board:z.enum(PRO_BOARDS),language:z.enum(LANGUAGES),
 filename:z.string().regex(FILENAME_RE),
 content:z.string().min(1).max(PRO_LIMITS.fileBytes),
 configSha256:z.string().regex(/^[0-9a-f]{64}$/),  // hash of the injected CONFIG block
 pinsReferenced:z.array(z.object({symbol:z.string().regex(SYMBOL_RE),pin:z.string().max(12),lines:z.array(z.number().int().positive()).max(50)}).strict()).max(80), // parsed, never LLM
 libraries:z.array(z.object({name:txt(60),version:txt(20)}).strict()).max(16),             // pinned from the image manifest
 verify:z.object({
  status:z.enum(['compiled','linted','failed','pending']),
  toolchain:txt(160),at:z.string().datetime(),sha256:z.string().regex(/^[0-9a-f]{64}$/),
  bytes:z.number().int().positive().optional(),
  diagnostics:z.array(DiagnosticSchema).max(PRO_LIMITS.diagnostics),
 }).strict(),
}).strict();

export const BomLineSchema=z.object({
 key:z.string().regex(/^[a-z][a-z0-9.-]{0,47}$/),  // kind, or 'cable-3-core-shielded'
 kind:Slug,name:BiShortSchema,unit:z.enum(['pcs','m','set']),
 qty:z.number().positive(),
 perNode:z.array(z.object({nodeId:Slug,qty:z.number().positive()}).strict()).max(PRO_LIMITS.nodes),
 priceIdr:z.object({unit:IdrRangeSchema,total:IdrRangeSchema}).strict(),
 priceSource:z.object({table:txt(40),checkedAt:z.string().regex(/^\d{4}-\d{2}-\d{2}$/)}).strict(),
 optional:z.boolean(),
}).strict();

export const CHECKLIST_ID_RE=/^(procure|flash|wire|power-up|install|calibrate|commission):[a-z0-9][a-z0-9:._>-]{0,150}$/;
export const ChecklistItemSchema=z.object({
 id:z.string().regex(CHECKLIST_ID_RE),
 phase:z.enum(CHECKLIST_PHASES),
 fieldId:Slug.optional(),nodeId:Slug.optional(),
 order:z.number().int().nonnegative(),
 title:BiShortSchema,detail:BiSchema.optional(),
 ref:z.object({bomKey:z.string().optional(),fileId:z.string().optional(),wireId:z.string().optional(),partId:z.string().optional(),testId:z.string().optional(),linkId:z.string().optional()}).strict().optional(),
}).strict();

export const CheckSchema=z.object({                 // same shape idea as SpecIssue
 code:z.string().regex(/^[a-z][a-z0-9.-]{1,47}$/),
 severity:z.enum(['error','warning','info']),
 scope:z.object({nodeId:Slug.optional(),fieldId:Slug.optional(),linkId:z.string().optional(),fileId:z.string().optional()}).strict(),
 en:txt(300),id:txt(300),ref:z.string().max(60).optional(),
}).strict();

export const TestCaseSchema=z.object({
 id:z.string().regex(/^test:[a-z0-9][a-z0-9:._-]{0,120}$/),
 phase:z.enum(TEST_PHASES),
 nodeId:Slug.optional(),linkId:z.string().optional(),
 title:BiShortSchema,steps:z.array(BiShortSchema).min(1).max(8),expect:BiShortSchema,
 measure:z.object({quantity:txt(40),unit:txt(12),min:z.number().optional(),max:z.number().optional()}).strict().optional(),
}).strict();

/** Per-item stamp written by the save_revision gate (D15). The model never sets it. */
export const ItemVerificationSchema=z.object({
 status:z.enum(['verified','unverified','failed']),
 by:txt(60),                                       // verifier id, e.g. 'validate_netlist', 'compile_code', 'solve_power'
 at:z.string().datetime(),
 inputsSha:z.string().regex(/^[0-9a-f]{64}$/),     // sha256 of the verifier inputs; stale when inputs change
 note:txt(300).optional(),                         // reason when not verified; "verified against low-confidence data" when confidence is low
}).strict();
export type ItemVerification=z.infer<typeof ItemVerificationSchema>;
/** Keyed by JSON pointer into the spec, e.g. '/nodes/0/wires/2', '/code/0', '/links/1', '/power/node-melon'. */
export const VerificationMapSchema=z.record(z.string().regex(/^\/[A-Za-z0-9_./-]{0,200}$/),ItemVerificationSchema);

export const MetaSchema=z.object({
 version:z.literal(SYSTEM_SPEC_VERSION),
 generatedAt:z.string().datetime(),
 lang:z.enum(['en','id']),
 provider:txt(40),model:txt(80),                   // last model that saved the revision
 catalogVersion:txt(40),
 promptSha256:z.string().regex(/^[0-9a-f]{64}$/).optional(),
 usage:z.object({inputTokens:z.number().int().nonnegative(),outputTokens:z.number().int().nonnegative(),cacheReadTokens:z.number().int().nonnegative(),cacheWriteTokens:z.number().int().nonnegative(),usdMicros:z.number().int().nonnegative().nullable()}).strict().optional(),
}).strict();

export const SystemSpecSchema=z.object({
 site:SiteSchema,
 fields:z.array(FieldSchema).max(PRO_LIMITS.fields),
 nodes:z.array(NodeSchema).min(1).max(PRO_LIMITS.nodes),
 links:z.array(LinkSchema).max(PRO_LIMITS.links),
 code:z.array(CodeFileSchema).max(PRO_LIMITS.nodes*PRO_LIMITS.filesPerNode),
 bom:z.object({lines:z.array(BomLineSchema).max(PRO_LIMITS.bomLines),totalIdr:IdrRangeSchema}).strict(),
 checks:z.array(CheckSchema).max(PRO_LIMITS.checks),
 checklist:z.array(ChecklistItemSchema).max(PRO_LIMITS.checklistItems),
 tests:z.array(TestCaseSchema).max(PRO_LIMITS.testCases),
 summary:BiSchema,
 verification:VerificationMapSchema,
 meta:MetaSchema,
}).strict().superRefine((s,ctx)=>{
 const bad=(path:(string|number)[],message:string)=>ctx.addIssue({code:'custom',path,message});
 const uniq=(ids:string[],path:string)=>{const seen=new Set<string>();ids.forEach((id,i)=>{if(seen.has(id))bad([path,i],`duplicate id ${id}`);seen.add(id);});};
 uniq(s.fields.map(f=>f.id),'fields');uniq(s.nodes.map(n=>n.id),'nodes');uniq(s.links.map(l=>l.id),'links');
 uniq(s.code.map(c=>c.id),'code');uniq(s.checklist.map(c=>c.id),'checklist');uniq(s.tests.map(t=>t.id),'tests');uniq(s.bom.lines.map(b=>b.key),'bom');
 const fields=new Set(s.fields.map(f=>f.id)),nodes=new Map(s.nodes.map(n=>[n.id,n]));
 if(!isDevice(s))for(const k of SITE_REQUIRED)if(s.site[k]===undefined)bad(['site',k],`site.${k} is required for a site (only a device may omit it)`);
 if(isDevice(s)){
  if(s.nodes.length!==1)bad(['nodes'],'a device spec has exactly one node');
  if(s.nodes.some(n=>n.role!=='device'))bad(['nodes'],'a device spec node has role device');
 }else{
  if(s.fields.length<1)bad(['fields'],'at least one field is required (or set site.kind to device)');
  if(s.nodes.length<2)bad(['nodes'],'at least two nodes are required (or set site.kind to device)');
  if(s.nodes.filter(n=>n.role==='gateway').length!==1)bad(['nodes'],'exactly one gateway is required');
  s.nodes.forEach((n,i)=>{if(n.role==='device')bad(['nodes',i,'role'],'role device needs site.kind device');});
 }
 s.nodes.forEach((n,i)=>{
  if(n.role==='field'&&(!n.fieldId||!fields.has(n.fieldId)))bad(['nodes',i,'fieldId'],`node ${n.id} needs a known fieldId`);
  const parts=new Set(n.parts.map(p=>p.id));uniq(n.parts.map(p=>p.id),`nodes.${i}.parts`);uniq(n.wires.map(w=>w.id),`nodes.${i}.wires`);
  n.wires.forEach((w,j)=>{for(const e of [w.from,w.to])if(e.part!=='board'&&!parts.has(e.part))bad(['nodes',i,'wires',j],`wire ${w.id} references unknown part ${e.part}`);});
  n.pins.forEach((p,j)=>{if(!parts.has(p.part))bad(['nodes',i,'pins',j],`pin row references unknown part ${p.part}`);});
  n.rules.forEach((r,j)=>{if(!parts.has(r.when.part)||!parts.has(r.then.part))bad(['nodes',i,'rules',j],'rule references an unknown part');});
 });
 s.fields.forEach((f,i)=>{if(!s.nodes.some(n=>n.fieldId===f.id))bad(['fields',i],`field ${f.id} has no node`);});
 s.links.forEach((l,i)=>{if(!nodes.has(l.from)||!nodes.has(l.to))bad(['links',i],`link ${l.id} has an unknown end`);});
 s.code.forEach((c,i)=>{const n=nodes.get(c.nodeId);if(!n)bad(['code',i],`code ${c.id} has an unknown node`);else if(n.board!==c.board)bad(['code',i],'code board differs from node board');});
 s.checklist.forEach((c,i)=>{if(!c.id.startsWith(c.phase+':'))bad(['checklist',i],'checklist id must start with its phase');if(c.nodeId&&!nodes.has(c.nodeId))bad(['checklist',i],'unknown nodeId');});
});
export type SystemSpec=z.infer<typeof SystemSpecSchema>;
/** True for single-device mode (site.kind 'device'). */
export function isDevice(s:{site:{kind?:string}}):boolean{return s.site.kind==='device';}
export type ProNode=z.infer<typeof NodeSchema>;
export type ChecklistItem=z.infer<typeof ChecklistItemSchema>;

// ---------- stable ids ----------
const idPart=(p:string)=>p.toLowerCase().replace(/[^a-z0-9._>-]+/g,'-').replace(/^-+|-+$/g,'');
/**
 * Stable checklist id from the physical action only (never W-numbers or quantities), so ticks survive regeneration:
 *  ckId('procure','ds18b20') · ckId('flash','node-melon') · ckId('wire','node-melon','ds18b20-1.DQ>GPIO4')
 *  ckId('power-up','node-melon','3v3-rail') · ckId('install','melon','node-melon') · ckId('calibrate','node-melon','soil-moisture-1','dry-wet')
 *  ckId('commission','link-node-melon-gateway')
 */
export const ckId=(phase:ChecklistPhase,...parts:string[]):string=>`${phase}:${parts.map(idPart).filter(Boolean).join(':')}`.slice(0,160);
/** Wire checklist key: `<part>.<partPin>><boardPin>` (or `<partA>.<pin>><partB>.<pin>` for part-to-part). */
export const wireKey=(w:{from:{part:string;pin:string};to:{part:string;pin:string}}):string=>{
 const e=(x:{part:string;pin:string})=>x.part==='board'?x.pin:`${x.part}.${x.pin}`;
 const [a,b]=w.from.part==='board'?[w.to,w.from]:[w.from,w.to];
 return `${e(a)}>${e(b)}`;
};
/** Stored with each tick so the UI can say "changed since you ticked" without clearing it (hash computed by ops with sha256). */
export const tickHashInput=(i:ChecklistItem):string=>JSON.stringify([i.title,i.detail??null]);
