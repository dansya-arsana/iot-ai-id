/** Shared by the part and device registries: collect modules that export a given name, in Vite (import.meta.glob) and in Node/tsx (readdir + require). */
export type Mods=Record<string,Record<string,unknown>>;

/** Node fallback for tests, scripts and the ops server: load every .ts file of `dir` (a file URL) except `skip` synchronously. */
export function nodeLoad(dirUrl:string,skip:readonly string[]):Mods{
 const proc=(globalThis as {process?:{getBuiltinModule?:(n:string)=>unknown}}).process;
 const get=proc?.getBuiltinModule;
 if(!get)return {};
 const {createRequire}=get('node:module') as typeof import('node:module');
 const fs=get('node:fs') as typeof import('node:fs');
 const url=get('node:url') as typeof import('node:url');
 const dir=url.fileURLToPath(dirUrl);
 const req=createRequire(dirUrl);
 const out:Mods={};
 for(const f of fs.readdirSync(dir).sort()){
  if(!f.endsWith('.ts')||f.endsWith('.d.ts')||skip.includes(f))continue;
  out['./'+f]=req(dir+f) as Record<string,unknown>;
 }
 return out;
}

/** Pull the `name` export out of each module; modules without it (helpers) are ignored. */
export function pick<T>(mods:Mods,name:string):T[]{
 return Object.keys(mods).sort().map(k=>mods[k]![name]).filter((v):v is T=>!!v&&typeof v==='object');
}
