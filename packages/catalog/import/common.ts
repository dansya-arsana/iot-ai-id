/** Shared bits of the four importers: fragments are partial, per-field tagged facts that merge.ts folds into PartRecords. */
import type {Confidence,PartRecord,Provenance} from '../schema.js';

/** Fixed import date so the committed data file is reproducible. Bump it when the sources are re-read on purpose. */
export const IMPORT_DATE='2026-10-23';
export const prov=(source:string,confidence:Confidence):Provenance=>({source:source.slice(0,300),verifiedBy:'import',at:IMPORT_DATE,confidence});
export interface Tagged<T>{v:T;p:Provenance}
export const tag=<T>(v:T,source:string,confidence:Confidence):Tagged<T>=>({v,p:prov(source,confidence)});

export type PinV=PartRecord['pins'][number]['v'];
export type Bi={en:string;id:string};
/** One importer's view of one part. Every field optional; the merge picks per field by source priority. */
export interface Fragment{
 id:string;source:ImportSource;
 name?:Tagged<string>;kind?:Tagged<string>;aliases?:string[];
 supplyV?:Tagged<{min:number;max:number}>;logicLevelV?:Tagged<number>;currentMa?:Tagged<{typ:number;peak:number;sleepUa?:number}>;
 pins?:Tagged<PinV>[];
 protocols?:Tagged<PartRecord['protocols']['supported']['v']>;i2cAddresses?:Tagged<number[]>;
 drivers?:Tagged<PartRecord['drivers'][number]['v']>[];
 summary?:Tagged<Bi>;pitfalls?:Tagged<Bi>[];
 model3d?:{kind:Tagged<'procedural'|'glb'|'none'>;status:Tagged<'none'|'draft'|'verified'>};
}
export const IMPORT_SOURCES=['hardware-library','component-catalog','hardware-contract','lab-registry'] as const;
export type ImportSource=typeof IMPORT_SOURCES[number];

/** Short slug-safe pin name. */
export const pinName=(s:string):string=>s.trim().slice(0,16)||'PIN';
