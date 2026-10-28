/**
 * Remote MCP (plan claude-connector C1): Streamable HTTP at /mcp, stateless, JSON responses, personal access token auth.
 * Registers the registry's mcp:true tools minus device_flash and every runsAt:'client' tool. Every call goes through the ops dispatcher
 * (callTool), so authz, input schema, rate limit, untrusted wrap and the save_revision gate are identical to the in-app agent.
 * OAuth 2.1 (C1b) is not here yet. Token values are never logged; the audit line carries the token id.
 */
import type {IncomingMessage,ServerResponse} from 'node:http';
import {McpServer} from '@modelcontextprotocol/sdk/server/mcp.js';
import {StreamableHTTPServerTransport} from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import type {z} from 'zod';
import {mcpTools} from '../../packages/pro-tools/registry.js';
import type {ToolDef} from '../../packages/pro-tools/types.js';
import type {Ops} from './ops.js';
import {installPro,callTool} from './pro-wiring.js';
import {patFor,subjectGranted} from './pat.js';

export const MCP_BODY_LIMIT=2_000_000;
export type McpAudit={tokenId:string;tool:string;ms:number;ok:boolean;code?:string};
export interface McpRemoteOptions{audit?:(a:McpAudit)=>void}

/** Tools exposed remotely: never device_flash, never client tools, never the desktop-only 'local' ones. */
export const remoteToolList=():ToolDef[]=>mcpTools({local:false}).filter(t=>t.name!=='device_flash'&&t.runsAt!=='client');
const shape=(t:ToolDef):Record<string,z.ZodType>=>(t.input as unknown as {shape?:Record<string,z.ZodType>}).shape??{};

/** Links for any result that names a project. */
export function projectLinks(input:Record<string,unknown>,output:unknown):Record<string,string>|undefined{
 const o=output&&typeof output==='object'?output as Record<string,unknown>:{};
 const pid=typeof input.projectId==='string'?input.projectId:typeof o.projectId==='string'?o.projectId:undefined;
 if(!pid)return undefined;
 const rev=typeof o.revision==='number'&&!o.draft?o.revision:typeof input.revision==='number'?input.revision:undefined;
 const e=encodeURIComponent(pid),o0=(process.env.PUBLIC_ORIGIN??'').replace(/\/+$/,'');
 return{workspace:`${o0}/pro/${e}`,...(rev?{buildSheet:`${o0}/pro/print/${e}/${rev}`}:{})};
}

function buildServer(ops:Ops,auth:{id:string;subject:string},o:McpRemoteOptions):McpServer{
 const server=new McpServer({name:'aiot',version:'1.0.0'});
 const pro=installPro(ops);
 const audit=o.audit??(a=>console.log(JSON.stringify({mcp:'call',...a})));
 for(const t of remoteToolList()){
  server.registerTool(t.name,{description:t.description,inputSchema:shape(t)},async(input:Record<string,unknown>)=>{
   const r=await callTool(pro,auth.subject,t.name,input);
   audit({tokenId:auth.id,tool:t.name,ms:r.ms,ok:r.ok,...(r.ok?{}:{code:r.error.code})});
   if(!r.ok)return{isError:true,content:[{type:'text' as const,text:JSON.stringify({error:r.error.code,message:r.error.message,...(r.error.details!==undefined?{details:r.error.details}:{})})}]};
   const links=projectLinks(input??{},r.output);
   return{content:[{type:'text' as const,text:JSON.stringify(links?{result:r.output,links}:r.output)}]};
  });
 }
 return server;
}

const json=(res:ServerResponse,status:number,data:unknown,headers:Record<string,string>={})=>{res.writeHead(status,{'Content-Type':'application/json','Cache-Control':'no-store','X-Content-Type-Options':'nosniff',...headers});res.end(JSON.stringify(data));};
const rpcError=(res:ServerResponse,status:number,message:string,headers:Record<string,string>={})=>json(res,status,{jsonrpc:'2.0',error:{code:-32001,message},id:null},headers);

/** Bearer token -> live token whose subject still holds Pro. */
export function authenticate(ops:Ops,header:string|undefined):{id:string;subject:string}|undefined{
 if(!header?.startsWith('Bearer '))return undefined;
 const t=patFor(ops).verify(header.slice(7).trim());
 return t&&subjectGranted(ops,t.subject)?t:undefined;
}

/** Handles one request to /mcp. Only POST (stateless: no SSE stream, no sessions). */
export async function handleMcp(ops:Ops,req:IncomingMessage,res:ServerResponse,o:McpRemoteOptions={}):Promise<void>{
 const auth=authenticate(ops,req.headers.authorization);
 if(!auth){rpcError(res,401,'A valid AIoT personal access token is required.',{'WWW-Authenticate':'Bearer realm="aiot"'});return;}
 if(req.method!=='POST'){rpcError(res,405,'Method not allowed.',{Allow:'POST'});return;}
 const chunks:Buffer[]=[];let total=0;
 for await(const chunk of req){const b=Buffer.isBuffer(chunk)?chunk:Buffer.from(chunk);total+=b.length;if(total>MCP_BODY_LIMIT){rpcError(res,413,'Request too large.');return;}chunks.push(b);}
 const text=Buffer.concat(chunks).toString('utf8');
 let body:unknown;try{body=JSON.parse(text);}catch{json(res,400,{jsonrpc:'2.0',error:{code:-32700,message:'Parse error'},id:null});return;}
 const server=buildServer(ops,auth,o);
 const transport=new StreamableHTTPServerTransport({sessionIdGenerator:undefined,enableJsonResponse:true});
 res.on('close',()=>{void transport.close();void server.close();});
 await server.connect(transport);
 await transport.handleRequest(req,res,body);
}
