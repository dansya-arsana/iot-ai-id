/** Derive `footprint` for each hand-sourced data/<kind>.json from the Lab procedural model pin anchors (read-only). `--check` exits 1 if any file is stale. Then run catalog-import.ts. */
import {readdirSync,readFileSync,writeFileSync} from 'node:fs';
import {registry} from '../apps/web/src/lab/scene/parts/index.js';
import {deriveFootprint,singleRowFootprint} from '../packages/catalog/footprints.js';
import {PartRecordSchema} from '../packages/catalog/schema.js';

const dir=new URL('../packages/catalog/data/',import.meta.url);
const check=process.argv.includes('--check');let stale=0;
for(const f of readdirSync(dir).filter(f=>f.endsWith('.json')&&f!=='catalog.json').sort()){
 const raw=JSON.parse(readFileSync(new URL(f,dir),'utf8'));
 const id:string=raw.identity.id,size=raw.mechanical.sizeMm.v as {w:number;h:number};
 const names:string[]=raw.pins.map((p:any)=>p.v.name);
 const mod=registry.get(id as never);
 const labNames=mod?Object.keys(mod.pins):[];
 const lab=mod&&labNames.length===names.length&&names.every(n=>labNames.includes(n));
 const at='2026-10-23';
 let v,source,conf:string;
 if(lab){
  v=deriveFootprint(names.map(n=>({name:n,x:mod!.pins[n]!.at[0],z:mod!.pins[n]!.at[2]})),size,id==='din-rail-terminals'?'terminal':names.length?'module-headers':'board-edge');
  source=`apps/web/src/lab/scene/parts/${id}.ts`;conf='medium';
 }else{
  v=singleRowFootprint(names,size);conf='low';
  source=`derived from record.pins + mechanical.sizeMm as one 2.54 mm header row (${mod?'lab model pin names differ':'no lab model'}); pin order is a placeholder until measured`;
 }
 if(v.rows.length>8){v=singleRowFootprint(names,size);conf='low';source=`derived from record.pins + mechanical.sizeMm as one 2.54 mm header row (lab pin layout exceeds 8 rows); placeholder until measured`;}
 raw.footprint={v,p:{source,verifiedBy:'import',at,confidence:conf}};
 PartRecordSchema.parse(raw);
 const next=JSON.stringify(raw,null,1)+'\n';
 if(next!==readFileSync(new URL(f,dir),'utf8')){stale++;if(!check)writeFileSync(new URL(f,dir),next);}
 console.log(id,lab?'lab':'fallback',v.rows.length+' rows',conf);
}
if(check&&stale){console.error('footprints stale: run `npx tsx scripts/catalog-footprints.ts`');process.exit(1);}
