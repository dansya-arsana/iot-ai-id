/**
 * PartRecord with per-leaf provenance (plan §5 M2.0, ADR 012 §4). Pure zod, no I/O, no DOM.
 * Every fact is an F<T> leaf: {v, p:{source, verifiedBy, at, confidence}}. Free text that came from outside
 * (datasheet excerpts, pitfalls, summaries) lives under `untrusted` so tools can hand it to the model as data.
 * Frozen in M2.0: add optional fields only.
 */
import {z} from 'zod';

export const CATALOG_SCHEMA_VERSION=1 as const;
// eslint-disable-next-line no-control-regex
const CTRL=/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/;
const txt=(max:number)=>z.string().trim().min(1).max(max).refine(s=>!CTRL.test(s),'control characters are not allowed');
export const PartSlug=z.string().regex(/^[a-z][a-z0-9-]{0,31}$/);

export const CONFIDENCE=['high','medium','low'] as const;
export type Confidence=typeof CONFIDENCE[number];
/** 'import' | 'staff:<id>' | 'lab:<schoolId>' */
export const VERIFIED_BY_RE=/^(import|staff:[A-Za-z0-9_.-]{1,64}|lab:[A-Za-z0-9_.-]{1,64})$/;
export const ProvenanceSchema=z.object({
 source:txt(300),                                   // URL, file path (`packages/hardware-library`) or free label
 verifiedBy:z.string().regex(VERIFIED_BY_RE),
 at:z.string().regex(/^\d{4}-\d{2}-\d{2}/),         // ISO date or datetime
 confidence:z.enum(CONFIDENCE),
}).strict();
export type Provenance=z.infer<typeof ProvenanceSchema>;
/** F<T> leaf schema factory. */
export const F=<T extends z.ZodType>(t:T)=>z.object({v:t,p:ProvenanceSchema}).strict();
export type F<T>={v:T;p:Provenance};

/** ADR 012 §4 / plan D5: grade A/B -> high, C/D -> medium, anything else -> low. */
export const confidenceFromGrade=(grade:string):Confidence=>{const g=grade.trim().toUpperCase();return g==='A'||g==='B'?'high':g==='C'||g==='D'?'medium':'low';};

export const BOARD_FAMILIES=['esp32','esp32s3','avr','rp2040','rpi'] as const;
export const PART_PROTOCOLS=['i2c','spi','uart','onewire','analog','digital','pwm','lora','wifi','ble','rs485'] as const;
export const PART_PIN_FUNCS=['power','ground','digital-in','digital-out','pwm','adc','onewire','i2c-sda','i2c-scl','spi-sck','spi-mosi','spi-miso','spi-cs','uart-tx','uart-rx','irq','reset','rs485-de','nc'] as const;
const BiShort=z.object({en:txt(300),id:txt(300)}).strict();

export const PinDefSchema=z.object({name:txt(16),func:z.array(z.enum(PART_PIN_FUNCS)).min(1).max(6),note:txt(120).optional()}).strict();
export const DriverSchema=z.object({
 boardFamily:z.enum(BOARD_FAMILIES),lib:txt(80),snippet:z.string().max(4000),
 verify:z.enum(['compiled','linted','untested']),
}).strict();

/** Carrier-board footprint (mm, origin = top-left of the module outline; pins named as in `pins`). Geometry only, no vendor data. */
export const FootprintSchema=z.object({
 kind:z.enum(['module-headers','terminal','board-edge']),
 outlineMm:z.object({w:z.number().positive(),h:z.number().positive()}).strict(),
 rows:z.array(z.object({origin:z.object({x:z.number(),y:z.number()}).strict(),pitch:z.number().positive(),pins:z.array(z.string().min(1).max(16)).min(1).max(80)}).strict()).max(8),
 holes:z.array(z.object({x:z.number(),y:z.number(),d:z.number().positive()}).strict()).max(16),
}).strict();
export const PartRecordSchema=z.object({
 schemaVersion:z.literal(CATALOG_SCHEMA_VERSION),
 identity:z.object({id:PartSlug,name:F(txt(80)),kind:F(PartSlug),manufacturer:F(txt(60)).optional(),mpn:F(txt(60)).optional()}).strict(),
 electrical:z.object({
  supplyV:F(z.object({min:z.number().nonnegative(),max:z.number().positive()}).strict()),
  logicLevelV:F(z.number().nonnegative().max(48)).optional(),
  currentMa:F(z.object({typ:z.number().nonnegative(),peak:z.number().nonnegative(),sleepUa:z.number().nonnegative().optional()}).strict()),
 }).strict(),
 pins:z.array(F(PinDefSchema)).max(80),
 protocols:z.object({supported:F(z.array(z.enum(PART_PROTOCOLS)).max(8)),i2cAddresses:F(z.array(z.number().int().min(0).max(127)).max(8)).optional(),freqMHz:F(z.object({min:z.number().positive(),max:z.number().positive()}).strict()).optional()}).strict(),
 mechanical:z.object({sizeMm:F(z.object({w:z.number().positive(),h:z.number().positive(),d:z.number().positive()}).strict()),massG:F(z.number().positive()).optional()}).strict(),
 environment:z.object({outdoor:F(z.boolean()),ipRating:F(z.enum(['IP20','IP54','IP65','IP66','IP67'])).optional(),tempC:F(z.object({min:z.number(),max:z.number()}).strict())}).strict(),
 drivers:z.array(F(DriverSchema)).max(8),
 compatibleWith:F(z.array(PartSlug).max(60)),
 price:F(z.object({minIdr:z.number().int().nonnegative(),maxIdr:z.number().int().nonnegative(),checkedAt:z.string().regex(/^\d{4}-\d{2}-\d{2}$/)}).strict()).optional(),
 footprint:F(FootprintSchema).optional(),
 model3d:z.object({kind:F(z.enum(['procedural','glb','none'])),status:F(z.enum(['none','draft','verified']))}).strict(),
 /** Set only by staff, citing a verified Lab Mitra task id (ADR 010). */
 labTested:z.object({schoolId:txt(64),taskId:txt(64),at:z.string().regex(/^\d{4}-\d{2}-\d{2}/),by:txt(64)}).strict().optional(),
 /** Outside text. Tools return it as data; verifiers never read it. */
 untrusted:z.object({summary:F(BiShort),pitfalls:z.array(F(BiShort)).max(20)}).strict(),
}).strict();
export type PartRecord=z.infer<typeof PartRecordSchema>;

/** Share of leaves with confidence 'high' (for catalog_search badges). */
export const verifiedShare=(rec:unknown):number=>{
 let n=0,hi=0;
 const walk=(x:unknown)=>{
  if(!x||typeof x!=='object')return;
  const o=x as Record<string,unknown>;
  if('v' in o&&'p' in o&&o.p&&typeof o.p==='object'){n++;if((o.p as Provenance).confidence==='high')hi++;return;}
  for(const v of Object.values(o))walk(v);
 };
 walk(rec);
 return n?hi/n:0;
};
