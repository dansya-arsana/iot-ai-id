/**
 * Folds the live catalog overlay into packages/catalog/data/*.json so it can be reviewed and committed.
 * Usage: tsx scripts/catalog-export.ts [--db .data/ops.sqlite] [--dry] [--clear]
 * --clear deletes the folded overlay rows afterwards (only when not --dry). The files keep their shape (array or {parts}).
 */
import {existsSync,readdirSync,readFileSync,writeFileSync} from 'node:fs';
import {DatabaseSync} from 'node:sqlite';
import {PartRecordSchema} from '../packages/catalog/schema.js';
import {applySpecPatch,type SpecPatch} from '../packages/pro-contract/patch.js';
import {CATALOG_DATA_DIR} from '../services/ops/catalog.js';

export type FoldResult={folded:string[];skipped:{id:string;reason:string}[]};
/** Pure: returns the new file text per file name for the parts that changed. */
export function foldOverlay(files:Record<string,string>,rows:{part_id:string;ops:string}[]):{files:Record<string,string>;result:FoldResult}{
 const result:FoldResult={folded:[],skipped:[]},out:Record<string,string>={};
 const byPart=new Map<string,SpecPatch[]>();
 for(const r of rows)(byPart.get(r.part_id)??byPart.set(r.part_id,[]).get(r.part_id)!).push(JSON.parse(r.ops));
 const seen=new Set<string>();
 for(const [name,text] of Object.entries(files)){
  const j=JSON.parse(text);const isArr=Array.isArray(j);const parts:unknown[]=isArr?j:j.parts;let changed=false;
  const next=parts.map(p=>{
   const id=(p as {identity?:{id?:string}})?.identity?.id;const ops=id?byPart.get(id):undefined;if(!id||!ops)return p;
   seen.add(id);let cur:unknown=p;
   for(const o of ops){try{const n=PartRecordSchema.safeParse(applySpecPatch(cur,o,{allowServerOwned:true}));if(n.success)cur=n.data;else result.skipped.push({id,reason:'invalid after edit'});}catch(e){result.skipped.push({id,reason:(e as Error).message});}}
   if(cur!==p){changed=true;result.folded.push(id);}
   return cur;
  });
  if(changed)out[name]=JSON.stringify(isArr?next:{...j,parts:next},null,1)+'\n';
 }
 for(const id of byPart.keys())if(!seen.has(id))result.skipped.push({id,reason:'part not in data files'});
 return{files:out,result};
}

if(process.argv[1]?.endsWith('catalog-export.ts')){
 const a=process.argv.slice(2),dbPath=a.includes('--db')?a[a.indexOf('--db')+1]:process.env.OPS_DB??'.data/ops.sqlite';
 if(!existsSync(dbPath)){console.error('No ops database at '+dbPath);process.exit(1);}
 const db=new DatabaseSync(dbPath);
 const has=db.prepare("SELECT 1 FROM sqlite_master WHERE name='catalog_overlay'").get();
 const rows=(has?db.prepare('SELECT part_id,ops FROM catalog_overlay ORDER BY id').all():[])as {part_id:string;ops:string}[];
 const files:Record<string,string>={};
 for(const n of existsSync(CATALOG_DATA_DIR)?readdirSync(CATALOG_DATA_DIR).filter(f=>f.endsWith('.json')):[])files[n]=readFileSync(CATALOG_DATA_DIR+n,'utf8');
 const {files:out,result}=foldOverlay(files,rows);
 if(!a.includes('--dry'))for(const [n,t] of Object.entries(out))writeFileSync(CATALOG_DATA_DIR+n,t);
 if(!a.includes('--dry')&&a.includes('--clear')&&has&&!result.skipped.length)db.exec('DELETE FROM catalog_overlay');
 console.log(JSON.stringify(result,null,1));
}
