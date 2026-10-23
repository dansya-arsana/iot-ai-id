import {z} from 'zod';
import {mcpTools} from '../../packages/pro-tools/registry.js';
import type {ToolDef} from '../../packages/pro-tools/types.js';
import {loadSkill} from '../../packages/pro-skills/index.js';

/** Registers the pro-tools registry on an MCP server (D14). Pure tools run in-process, service tools go to ops over loopback. device_flash and client-only tools are never registered. */
export type PureImpl=(input:any)=>unknown|Promise<unknown>;
export interface ProMcpDeps{
 /** Pure tool implementations by name (D1/D2). A pure tool without one answers `not_implemented`. */
 pure?:Record<string,PureImpl>;
 /** Loopback ops call for service tools. */
 ops:(name:string,input:unknown)=>Promise<unknown>;
}
export const loadSkillImpl:PureImpl=({name})=>{const s=loadSkill(name);if(!s)throw new Error('unknown skill: '+name);return {name:s.name,version:s.version,sha256:s.sha256,body:s.body};};

/** Tools exposed here: mcp===true only (no 'local' desktop tools on this bridge), never device_flash. */
export const proMcpToolList=():ToolDef[]=>mcpTools({local:false}).filter(t=>t.name!=='device_flash'&&t.runsAt!=='client');

const shape=(t:ToolDef):Record<string,z.ZodType>=>{
 const s:z.ZodType=t.input;
 // refine() wraps ZodObject in v4 as the same object with checks; shape stays readable.
 const sh=(s as unknown as {shape?:Record<string,z.ZodType>}).shape;
 return sh??{};
};
export async function runProTool(t:ToolDef,input:unknown,deps:ProMcpDeps):Promise<unknown>{
 const parsed=t.input.parse(input);
 if(t.runsAt==='pure'){
  const impl=t.name==='load_skill'?loadSkillImpl:deps.pure?.[t.name];
  if(impl)return impl(parsed);
  // The parts catalog and its overlay live in ops, so pure tools without a local implementation run there (same dispatcher, same checks).
  return deps.ops(t.name,parsed);
 }
 return deps.ops(t.name,parsed);
}
export function registerProTools(server:{registerTool:(name:string,cfg:any,cb:(input:any)=>Promise<any>)=>unknown},deps:ProMcpDeps):string[]{
 const names:string[]=[];
 for(const t of proMcpToolList()){
  server.registerTool(t.name,{description:t.description,inputSchema:shape(t)},async(input:unknown)=>{
   try{
    const out=await runProTool(t,input,deps);
    return {content:[{type:'text' as const,text:JSON.stringify(out)}]};
   }catch(e){
    return {isError:true,content:[{type:'text' as const,text:JSON.stringify({error:e instanceof Error?e.message:String(e)})}]};
   }
  });
  names.push(t.name);
 }
 return names;
}
/** Loopback ops caller. Only http on a loopback host. */
/** Calls the owner-token tool loopback: POST /ops/v1/admin/pro/tools/:name. `user` must have a role in ops (OPS_ROLES), `subject` is whose projects the call may touch. */
export function opsCaller(base:string,token:string|undefined,fetcher:typeof fetch=fetch,user=process.env.IOT_OPS_USER||'owner',subject=process.env.IOT_PRO_SUBJECT){
 const u=new URL(base);
 if(u.protocol!=='http:'||!['127.0.0.1','localhost','[::1]'].includes(u.hostname))throw new Error('IOT_OPS_URL must be a loopback http URL');
 return async(name:string,input:unknown):Promise<unknown>=>{
  const r=await fetcher(new URL('/ops/v1/admin/pro/tools/'+encodeURIComponent(name),u),{method:'POST',redirect:'error',headers:{'Content-Type':'application/json','X-Ops-User':user,...(token?{Authorization:'Bearer '+token}:{})},body:JSON.stringify({input,...(subject?{subject}:{})}),signal:AbortSignal.timeout(120000)});
  const data=await r.json().catch(()=>({}));
  if(!r.ok)throw new Error(String((data as any).error??'ops HTTP '+r.status));
  return data;
 };
}
