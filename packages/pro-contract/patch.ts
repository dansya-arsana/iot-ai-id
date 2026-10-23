/**
 * SpecPatch: the JSON Patch subset a model sends through `save_revision` (D15, ADR 012 §3).
 * Ops: add | replace | remove, RFC 6901 pointers, at most 200 ops. No move/copy/test.
 * Pure and deterministic. The gate validates the patched document against SystemSpecSchema afterwards.
 */
import {z} from 'zod';

export const PATCH_MAX_OPS=200;
const Pointer=z.string().max(240).regex(/^(\/([^/~]|~[01])*)+$/,'JSON pointer must start with /');
export const PatchOpSchema=z.discriminatedUnion('op',[
 z.object({op:z.literal('add'),path:Pointer,value:z.unknown()}).strict(),
 z.object({op:z.literal('replace'),path:Pointer,value:z.unknown()}).strict(),
 z.object({op:z.literal('remove'),path:Pointer}).strict(),
]);
export type PatchOp=z.infer<typeof PatchOpSchema>;
export const SpecPatchSchema=z.array(PatchOpSchema).min(1).max(PATCH_MAX_OPS);
export type SpecPatch=z.infer<typeof SpecPatchSchema>;

/** Paths the server derives. Strict `applySpecPatch` rejects a patch touching them; `splitServerOwned` drops those ops with a warning (the model never sets them). */
const SERVER_OWNED:RegExp[]=[
 /^\/verification(\/|$)/,/^\/meta(\/|$)/,/^\/checklist(\/|$)/,/^\/bom\/totalIdr(\/|$)/,/^\/bom\/lines\/\d+\/(priceIdr|priceSource)(\/|$)/,
 /^\/nodes\/\d+\/wires\/\d+\/id$/,/^\/code\/\d+\/(verify|configSha256|pinsReferenced)(\/|$)/,/^\/links\/\d+\/estimate(\/|$)/,/^\/nodes\/\d+\/power\/(budget|ok)(\/|$)/,
];
export const isServerOwnedPath=(path:string):boolean=>SERVER_OWNED.some(r=>r.test(path));
/** Human-readable form of the list above (shown by get_spec_schema). `*` is an array index. */
export const SERVER_OWNED_PATHS:readonly string[]=[
 '/verification','/meta','/checklist','/bom/totalIdr','/bom/lines/*/priceIdr','/bom/lines/*/priceSource',
 '/nodes/*/wires/*/id','/code/*/verify','/code/*/configSha256','/code/*/pinsReferenced','/links/*/estimate','/nodes/*/power/budget','/nodes/*/power/ok',
];
export type IgnoredOp={opIndex:number;path:string;message:string};
/** Lenient mode: ops on server-owned paths are dropped and reported, the rest is kept in order. */
export function splitServerOwned(ops:SpecPatch):{ops:SpecPatch;ignored:IgnoredOp[]}{
 const ignored:IgnoredOp[]=[],kept:PatchOp[]=[];
 ops.forEach((op,i)=>{
  if(isServerOwnedPath(op.path))ignored.push({opIndex:i,path:op.path,message:`${op.path} is derived by the server; this op was ignored. Send the parent object whole, or leave it out.`});
  else kept.push(op);
 });
 return {ops:kept as SpecPatch,ignored};
}

export class PatchError extends Error{constructor(readonly code:'bad_path'|'server_owned'|'bad_index'|'missing'|'too_many_ops'|'whole_document',message:string,readonly opIndex?:number){super(message);this.name='PatchError';}}

const unesc=(s:string)=>s.replace(/~1/g,'/').replace(/~0/g,'~');
const FORBID=new Set(['__proto__','constructor','prototype']);
/** Empty document a project starts from (revision 0). Not schema-valid; the gate checks after patching. */
export const EMPTY_SPEC_DOC=():Record<string,unknown>=>({fields:[],nodes:[],links:[],code:[],bom:{lines:[]},checks:[],checklist:[],tests:[],verification:{}});

/** Apply a patch to a deep copy of `doc`. Atomic: throws PatchError and returns nothing on the first bad op. */
export function applySpecPatch(doc:unknown,ops:SpecPatch,opts:{allowServerOwned?:boolean}={}):unknown{
 if(ops.length>PATCH_MAX_OPS)throw new PatchError('too_many_ops',`at most ${PATCH_MAX_OPS} ops`);
 const root:any=structuredClone(doc);
 ops.forEach((op,i)=>{
  if(!opts.allowServerOwned&&isServerOwnedPath(op.path))throw new PatchError('server_owned',`${op.path} is derived by the server`,i);
  const keys=op.path.split('/').slice(1).map(unesc);
  if(keys.some(k=>FORBID.has(k)))throw new PatchError('bad_path',`forbidden key in ${op.path}`,i);
  const last=keys.pop() as string;
  let parent:any=root;
  for(const k of keys){
   if(parent===null||typeof parent!=='object')throw new PatchError('missing',`${op.path}: parent missing`,i);
   if(Array.isArray(parent)){if(!/^(0|[1-9]\d*)$/.test(k)||Number(k)>=parent.length)throw new PatchError('bad_index',`${op.path}: bad index ${k}`,i);parent=parent[Number(k)];}
   else{if(!Object.prototype.hasOwnProperty.call(parent,k))throw new PatchError('missing',`${op.path}: ${k} not found`,i);parent=parent[k];}
  }
  if(parent===null||typeof parent!=='object')throw new PatchError('missing',`${op.path}: parent missing`,i);
  if(Array.isArray(parent)){
   if(op.op==='add'&&last==='-'){parent.push(structuredClone(op.value));return;}
   if(!/^(0|[1-9]\d*)$/.test(last))throw new PatchError('bad_index',`${op.path}: bad index`,i);
   const n=Number(last);
   if(op.op==='add'){if(n>parent.length)throw new PatchError('bad_index',`${op.path}: index out of range`,i);parent.splice(n,0,structuredClone(op.value));}
   else{if(n>=parent.length)throw new PatchError('bad_index',`${op.path}: index out of range`,i);if(op.op==='replace')parent[n]=structuredClone(op.value);else parent.splice(n,1);}
  }else{
   if(op.op==='add')parent[last]=structuredClone(op.value);
   else{
    if(!Object.prototype.hasOwnProperty.call(parent,last))throw new PatchError('missing',`${op.path}: not found`,i);
    if(op.op==='replace')parent[last]=structuredClone(op.value);else delete parent[last];
   }
  }
 });
 return root;
}
