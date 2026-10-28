/** KiCad ERC/DRC client for the sidecar (scripts/kicad-sidecar). No KICAD_SIDECAR_URL => pending. Unrouted items are info. */
import {mkIssue,type ToolIssue} from '../../packages/pro-tools/impl/common.js';

export type KicadCheck={status:'pending';reason:string}|{status:'error';reason:string}|{status:'done';issues:ToolIssue[];routed?:boolean;gerberZipBase64?:string};
type Viol={type?:string;severity?:string;description?:string};
type Report={violations?:Viol[];unconnected_items?:Viol[]};
const sev=(s?:string):ToolIssue['severity']=>s==='error'?'error':s==='warning'?'warning':'info';
const conv=(kind:'erc'|'drc',r:Report|undefined):ToolIssue[]=>{
 const out:ToolIssue[]=[];
 for(const v of (r?.violations??[]).slice(0,100)){const d=String(v.description??v.type??kind).slice(0,200);out.push(mkIssue(`${kind}_${String(v.type??'violation').slice(0,40)}`,sev(v.severity),`${kind.toUpperCase()}: ${d}`,`${kind.toUpperCase()}: ${d}`));}
 const n=(r?.unconnected_items??[]).length;
 if(n)out.push(mkIssue('drc_unrouted','info',`${n} connection(s) not routed yet (information).`,`${n} koneksi belum di-route (informasi).`));
 return out;
};
export async function kicadCheck(zip:Buffer,opts:{env?:Record<string,string|undefined>;fetchImpl?:typeof fetch;gerber?:boolean;route?:boolean}={}):Promise<KicadCheck>{
 const env=opts.env??process.env;const base=env.KICAD_SIDECAR_URL;
 if(!base)return{status:'pending',reason:'KICAD_SIDECAR_URL is not set; ERC/DRC not run.'};
 const q=new URLSearchParams();if(opts.gerber)q.set('gerber','1');if(opts.route)q.set('route','1');
 const headers:Record<string,string>={'content-type':'application/zip'};if(env.KICAD_SIDECAR_TOKEN)headers['x-sidecar-token']=env.KICAD_SIDECAR_TOKEN;
 try{
  const res=await (opts.fetchImpl??fetch)(`${base.replace(/\/$/,'')}/check?${q}`,{method:'POST',headers,body:new Uint8Array(zip),signal:AbortSignal.timeout(130_000)});
  if(!res.ok)return{status:'error',reason:`sidecar HTTP ${res.status}`};
  const j=await res.json() as {erc?:Report;drc?:Report;routed?:boolean;gerberZipBase64?:string};
  return{status:'done',issues:[...conv('erc',j.erc),...conv('drc',j.drc)],...(j.routed!==undefined?{routed:j.routed}:{}),...(j.gerberZipBase64?{gerberZipBase64:j.gerberZipBase64}:{})};
 }catch(e){return{status:'error',reason:String((e as Error).message).slice(0,200)};}
}
