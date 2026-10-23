/** Run the four importers and merge. Pure given the old packages; scripts/catalog-import.ts writes the result to data/catalog.json. */
import {importHardwareLibrary} from './import/hardware-library.js';
import {importComponentCatalog} from './import/component-catalog.js';
import {importHardwareContract} from './import/hardware-contract.js';
import {importLabRegistry} from './import/lab-registry.js';
import {readdirSync,readFileSync} from 'node:fs';
import {mergeFragments} from './merge.js';
import {CATALOG_SCHEMA_VERSION,PartRecordSchema} from './schema.js';
import type {PartRecord} from './schema.js';
import type {CatalogFile} from './index.js';
export const CATALOG_VERSION='import-2026-10-23';
export function buildCatalog():CatalogFile{
 const m=mergeFragments([...importHardwareLibrary(),...importComponentCatalog(),...importHardwareContract(),...importLabRegistry()]);
 // Hand-sourced per-kind records (data/<kind>.json) win over the imported record with the same id, and add new parts.
 const dir=new URL('./data/',import.meta.url);
 const over=readdirSync(dir).filter(f=>f.endsWith('.json')&&f!=='catalog.json').sort().map(f=>PartRecordSchema.parse(JSON.parse(readFileSync(new URL(f,dir),'utf8'))) as PartRecord);
 const ids=new Set(over.map(p=>p.identity.id));
 const parts=[...m.parts.filter(p=>!ids.has(p.identity.id)),...over].sort((a,b)=>a.identity.id<b.identity.id?-1:1);
 return{catalogVersion:CATALOG_VERSION,schemaVersion:CATALOG_SCHEMA_VERSION,...m,parts};
}
export const serializeCatalog=(c:CatalogFile):string=>JSON.stringify(c,null,1)+'\n';
