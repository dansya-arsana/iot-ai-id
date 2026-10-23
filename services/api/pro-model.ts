/**
 * Pro model proxy (ADR 012 sec.1/6, plan M3-A). The only place that holds the Anthropic key for Pro.
 * ops runs the agent loop and calls POST /internal/pro/messages here; this streams Anthropic SSE back untouched.
 * Verified against platform.claude.com docs on 2026-10-23:
 *  - Claude 5.5 thinking is adaptive; thinking.type "enabled"+budget_tokens and "disabled" return HTTP 400. Depth is output_config.effort.
 *  - Interleaved thinking is automatic with adaptive thinking (no beta header). Thinking blocks must be echoed back unmodified.
 *  - thinking.display defaults to "omitted" on 5.5; "summarized" returns readable text. Max output 128K tokens.
 *  - Caching: cache_control {type:"ephemeral"} on system/tools/message blocks; changing effort between requests breaks the cache.
 * Token guard is the ADR 011 one (x-aiot-internal, no proxy headers). The key never leaves this process; ops never sees it.
 */
import {timingSafeEqual} from 'node:crypto';
import type {IncomingMessage,ServerResponse} from 'node:http';
import {z} from 'zod';
import {DEFAULT_KILL_SWITCH,type KillSwitch} from '../../packages/pro-contract/agent.js';
import {PRO_DEFAULT_MODEL,PRO_PRICING,type ProModel} from '../../packages/pro-contract/pricing.js';
import {PRO_DEFAULT_EFFORT,PRO_MODELS,type ProEffort,type BuilderPreferences,type AiPreferences} from '../../packages/ai-providers/index.js';

export const PRO_MESSAGES_PATH='/internal/pro/messages';
export const PRO_CONFIG_PATH='/internal/pro/config';
export const PRO_MAX_BODY_BYTES=2*1024*1024;
/** Hard cap on one model call's output (includes thinking). The model max is 128K; a loop step never needs that. */
export const PRO_MAX_TOKENS_CAP=32_000;
export const PRO_MAX_TOKENS_DEFAULT=16_000;
const FORWARD_HEADERS=['x-forwarded-for','x-real-ip','forwarded','x-forwarded-host','x-forwarded-proto'];
const ANTHROPIC_URL='https://api.anthropic.com/v1/messages';

const Cache=z.object({type:z.literal('ephemeral'),ttl:z.enum(['5m','1h']).optional()}).strict();
const TextBlock=z.object({type:z.literal('text'),text:z.string().max(400_000),cache_control:Cache.optional()}).strict();
const Tool=z.object({name:z.string().regex(/^[a-z][a-z0-9_]{0,63}$/),description:z.string().max(8000),input_schema:z.record(z.string(),z.unknown()),cache_control:Cache.optional()}).strict();
// Content blocks are passed through (thinking blocks with signatures must stay byte-identical); only the shape is checked.
const Message=z.object({role:z.enum(['user','assistant']),content:z.union([z.string(),z.array(z.looseObject({type:z.string()})).max(500)])}).strict();
/** Only these fields reach Anthropic. model, thinking, effort, stream and tool_choice are set here, never by the caller. */
export const ProMessagesRequestSchema=z.object({
 system:z.union([z.string().max(400_000),z.array(TextBlock).max(20)]).optional(),
 messages:z.array(Message).min(1).max(2000),
 tools:z.array(Tool).max(64).optional(),
 max_tokens:z.number().int().min(256).max(PRO_MAX_TOKENS_CAP).optional(),
}).strict();
export type ProMessagesRequest=z.infer<typeof ProMessagesRequestSchema>;

export interface ProModelConfig{model:ProModel;effort:ProEffort;display:'summarized'|'omitted';killSwitch:KillSwitch;/** Per-million-token USD, so ops can cost usage without a second source of truth. */pricing:typeof PRO_PRICING}
/** Reads the admin's global choice. Unknown or missing values fall back to defaults; Opus is allowed for everyone when selected. */
export function resolveProConfig(prefs:AiPreferences|undefined):ProModelConfig{
 const b:Partial<BuilderPreferences>=prefs?.builder??{};
 return{model:(PRO_MODELS as readonly string[]).includes(b.model??'')?b.model as ProModel:PRO_DEFAULT_MODEL,effort:b.effort??PRO_DEFAULT_EFFORT,display:b.thinkingDisplay??'summarized',killSwitch:b.killSwitch??DEFAULT_KILL_SWITCH,pricing:PRO_PRICING};
}
/** Vault wins; ANTHROPIC_API_KEY is only a fallback. Returns the key and where it came from (never logged). */
export function resolveAnthropicKey(vaultKey:string|undefined,env:NodeJS.ProcessEnv=process.env):{key:string;source:'vault'|'env'}|undefined{
 if(vaultKey)return{key:vaultKey,source:'vault'};
 const e=env.ANTHROPIC_API_KEY?.trim();
 return e?{key:e,source:'env'}:undefined;
}
/** The exact body sent upstream. Pure so tests can assert the allowlist, caps and thinking parameters. */
export function buildUpstreamBody(req:ProMessagesRequest,cfg:Pick<ProModelConfig,'model'|'effort'|'display'>){
 return{
  model:cfg.model,
  max_tokens:Math.min(req.max_tokens??PRO_MAX_TOKENS_DEFAULT,PRO_MAX_TOKENS_CAP),
  stream:true,
  thinking:{type:'adaptive',display:cfg.display},
  output_config:{effort:cfg.effort},
  ...(req.system!==undefined?{system:req.system}:{}),
  messages:req.messages,
  ...(req.tools?.length?{tools:req.tools}:{}),
 };
}
/** Anthropic stream events as parsed objects, for fixture replay (one response per call). */
export type ModelStreamEvent={type:string;[k:string]:unknown};
export interface ProModelDeps{
 /** vault.snapshot().anthropic */ vaultKey:()=>string|undefined;
 /** vault.preferences() */ preferences:()=>AiPreferences;
 token?:string;env?:NodeJS.ProcessEnv;request?:typeof fetch;
 /** Fixture mode: replay these events instead of calling Anthropic. The key is not needed. */
 fixture?:(req:ProMessagesRequest)=>ModelStreamEvent[];
}
const send=(res:ServerResponse,status:number,data:unknown)=>{if(!res.headersSent)res.writeHead(status,{'Content-Type':'application/json','Cache-Control':'no-store'});res.end(JSON.stringify(data));};
const sse=(e:ModelStreamEvent)=>`event: ${e.type}\ndata: ${JSON.stringify(e)}\n\n`;

function guard(req:IncomingMessage,res:ServerResponse,token:string,method:'POST'|'GET'):boolean{
 if(token.length<32){send(res,503,{error:'The internal Pro endpoint is disabled: OPS_API_INTERNAL_TOKEN is not set'});return false;}
 if(FORWARD_HEADERS.some(h=>req.headers[h]!==undefined)){send(res,403,{error:'Not available'});return false;}
 const given=Buffer.from(String(req.headers['x-aiot-internal']??'')),expected=Buffer.from(token);
 if(given.length!==expected.length||!timingSafeEqual(given,expected)){send(res,401,{error:'Unauthorized'});return false;}
 if(req.method!==method){send(res,405,{error:'Method not allowed'});return false;}
 return true;
}
async function readBody(req:IncomingMessage):Promise<Buffer|undefined>{
 const chunks:Buffer[]=[];let size=0;
 for await(const c of req){const b=Buffer.isBuffer(c)?c:Buffer.from(c);size+=b.length;if(size>PRO_MAX_BODY_BYTES)return undefined;chunks.push(b);}
 return Buffer.concat(chunks);
}
/** GET /internal/pro/config: model, effort, kill-switch and the pinned price table for ops. Never a key; `keySource` is a label only. */
export function handleProConfig(req:IncomingMessage,res:ServerResponse,deps:ProModelDeps):void{
 if(!guard(req,res,deps.token??process.env.OPS_API_INTERNAL_TOKEN??'','GET'))return;
 const key=resolveAnthropicKey(deps.vaultKey(),deps.env);
 send(res,200,{...resolveProConfig(deps.preferences()),keySource:deps.fixture?'fixture':key?.source??'none'});
}
/** POST /internal/pro/messages: validate, force the model/thinking settings, stream Anthropic SSE back. */
export async function handleProMessages(req:IncomingMessage,res:ServerResponse,deps:ProModelDeps):Promise<void>{
 if(!guard(req,res,deps.token??process.env.OPS_API_INTERNAL_TOKEN??'','POST'))return;
 const raw=await readBody(req);
 if(!raw){send(res,413,{error:'Request too large'});return;}
 let input:ProMessagesRequest;
 try{input=ProMessagesRequestSchema.parse(JSON.parse(raw.toString('utf8')));}catch{send(res,400,{error:'Invalid request'});return;}
 const cfg=resolveProConfig(deps.preferences());
 const head={'Content-Type':'text/event-stream; charset=utf-8','Cache-Control':'no-store, no-transform','X-Accel-Buffering':'no','X-Pro-Model':cfg.model};
 if(deps.fixture){
  res.writeHead(200,head);
  for(const e of deps.fixture(input))res.write(sse(e));
  res.end();return;
 }
 const found=resolveAnthropicKey(deps.vaultKey(),deps.env);
 if(!found){send(res,503,{error:'No Anthropic key is configured'});return;}
 const abort=new AbortController();
 res.on('close',()=>{if(!res.writableEnded)abort.abort();});
 let upstream:Response;
 try{
  upstream=await(deps.request??fetch)(ANTHROPIC_URL,{method:'POST',redirect:'error',signal:AbortSignal.any([abort.signal,AbortSignal.timeout(20*60_000)]),headers:{'x-api-key':found.key,'anthropic-version':'2023-06-01','content-type':'application/json',accept:'text/event-stream'},body:JSON.stringify(buildUpstreamBody(input,cfg))});
 }catch{send(res,502,{error:'The AI provider could not be reached'});return;}
 if(!upstream.ok||!upstream.body){
  // Provider error bodies and key details are never forwarded; only a coarse class the loop can act on.
  await upstream.body?.cancel().catch(()=>undefined);
  console.error('pro model upstream status',upstream.status);
  send(res,upstream.status===429?429:upstream.status===401||upstream.status===403?503:upstream.status===529||upstream.status>=500?503:502,{error:upstream.status===429?'rate_limited':upstream.status===401||upstream.status===403?'provider_auth':upstream.status>=500?'provider_overloaded':'provider_rejected'});
  return;
 }
 res.writeHead(200,head);
 try{for await(const chunk of upstream.body as unknown as AsyncIterable<Uint8Array>){if(!res.write(chunk))await new Promise<void>(r=>res.once('drain',()=>r()));}}
 catch{if(!res.writableEnded)res.write(sse({type:'error',error:{type:'stream_interrupted',message:'The model stream was interrupted'}}));}
 res.end();
}
