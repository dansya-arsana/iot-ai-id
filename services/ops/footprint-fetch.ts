/**
 * fetch_footprint: one .kicad_mod from the official KiCad footprints repo (gitlab.com/kicad/libraries/kicad-footprints), cached on disk by sha256.
 * library/name are validated by a strict regex before they touch a URL or a path (no traversal, no SSRF); the host is fixed.
 */
import {createHash} from 'node:crypto';
import {existsSync,mkdirSync,readFileSync,writeFileSync} from 'node:fs';
import {join} from 'node:path';
export type FootprintInput={library:string;name:string};
export type FootprintOutput={name:string;sha256:string;sexpr:string;license:'CC-BY-SA-4.0 WITH KiCad-libraries-exception';source:string};
const NAME_RE=/^[A-Za-z0-9_.+-]{1,120}$/,MAX=200_000,TIMEOUT_MS=8000;
const LICENSE='CC-BY-SA-4.0 WITH KiCad-libraries-exception' as const;
const ok=(s:string)=>NAME_RE.test(s)&&!/^\.+$/.test(s)&&!s.includes('..');
export async function fetchFootprint(input:FootprintInput,opts:{cacheDir:string;fetchImpl?:typeof fetch}):Promise<FootprintOutput>{
 if(!ok(input.library)||!ok(input.name))throw new Error('Invalid library or footprint name');
 const lib=input.library.endsWith('.pretty')?input.library:input.library+'.pretty';
 const url=`https://gitlab.com/kicad/libraries/kicad-footprints/-/raw/master/${encodeURIComponent(lib)}/${encodeURIComponent(input.name)}.kicad_mod`;
 const idx=join(opts.cacheDir,'index'),key=createHash('sha256').update(lib+'/'+input.name).digest('hex'),ip=join(idx,key);
 const out=(sexpr:string)=>({name:input.name,sha256:createHash('sha256').update(sexpr).digest('hex'),sexpr,license:LICENSE,source:url});
 // Cache: key -> sha256, content stored under its own hash; a tampered file fails the hash check and is refetched.
 if(existsSync(ip)){const h=readFileSync(ip,'utf8').trim(),p=join(opts.cacheDir,h+'.kicad_mod');
  if(/^[a-f0-9]{64}$/.test(h)&&existsSync(p)){const s=readFileSync(p,'utf8');if(createHash('sha256').update(s).digest('hex')===h)return out(s);}}
 const f=opts.fetchImpl??fetch,ac=new AbortController(),t=setTimeout(()=>ac.abort(),TIMEOUT_MS);
 let text:string;
 try{
  const r=await f(url,{signal:ac.signal,redirect:'error'});
  if(r.status===404)throw new Error('Footprint not found');
  if(!r.ok)throw new Error('KiCad library HTTP '+r.status);
  text=await r.text();
 }finally{clearTimeout(t);}
 if(text.length>MAX)throw new Error('Footprint too large');
 if(!/^\s*\(footprint\s/.test(text)&&!/^\s*\(module\s/.test(text))throw new Error('Not a KiCad footprint');
 const o=out(text);
 mkdirSync(idx,{recursive:true});writeFileSync(join(opts.cacheDir,o.sha256+'.kicad_mod'),text);writeFileSync(ip,o.sha256);
 return o;
}
