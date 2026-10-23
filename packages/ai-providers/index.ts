/** AI provider registry shared by API and web. Pure data and validation; no secrets, no I/O. */
import {z} from 'zod';
import {KillSwitchSchema} from '../pro-contract/agent.js';
import {PRO_MODELS,PRO_DEFAULT_MODEL} from '../pro-contract/pricing.js';
export {PRO_MODELS,PRO_DEFAULT_MODEL};
/** Effort steers adaptive thinking. Claude 5.5 rejects thinking.budget_tokens with HTTP 400 (docs: build-with-claude/thinking), so there is no token budget setting. */
export const PRO_EFFORTS=['low','medium','high','xhigh','max'] as const;
export type ProEffort=typeof PRO_EFFORTS[number];
export const PRO_DEFAULT_EFFORT:ProEffort='high';
export const BuilderPreferencesSchema=z.object({model:z.enum(PRO_MODELS).default(PRO_DEFAULT_MODEL),effort:z.enum(PRO_EFFORTS).default(PRO_DEFAULT_EFFORT),thinkingDisplay:z.enum(['summarized','omitted']).default('summarized'),killSwitch:KillSwitchSchema.optional()}).strict();
export type BuilderPreferences=z.infer<typeof BuilderPreferencesSchema>;
export type DeploymentMode='cloud'|'local';
export type Protocol='openai-responses'|'anthropic'|'openai-chat'|'cli';
export type FrontierId='openai'|'anthropic'|'minimax'|'zai'|'custom'|'codex-cli'|'claude-cli';
export type ProviderInfo={id:FrontierId;label:string;protocol:Protocol;baseUrl?:string;models:string[];keyUrl?:string;scope:'any'|'local'};
export const AI_PROVIDERS:ProviderInfo[]=[
 {id:'openai',label:'OpenAI',protocol:'openai-responses',baseUrl:'https://api.openai.com/v1',models:['gpt-6.1-sol'],keyUrl:'https://platform.openai.com/api-keys',scope:'any'},
 {id:'anthropic',label:'Anthropic Claude',protocol:'anthropic',baseUrl:'https://api.anthropic.com',models:['claude-opus-5-5','claude-sonnet-5-5','claude-haiku-5-5'],keyUrl:'https://console.anthropic.com/settings/keys',scope:'any'},
 {id:'minimax',label:'MiniMax',protocol:'anthropic',baseUrl:'https://api.minimax.io/anthropic',models:['MiniMax-M3','MiniMax-M3.1-Flash-Preview'],keyUrl:'https://platform.minimax.io',scope:'any'},
 {id:'zai',label:'Z.ai GLM',protocol:'anthropic',baseUrl:'https://api.z.ai/api/anthropic',models:['glm-5.3','glm-5.3-flash'],keyUrl:'https://z.ai/manage-apikey/apikey-list',scope:'any'},
 {id:'custom',label:'OpenAI-compatible',protocol:'openai-chat',models:[],scope:'local'},
 {id:'codex-cli',label:'Codex CLI',protocol:'cli',models:['gpt-6.1-sol'],scope:'local'},
 {id:'claude-cli',label:'Claude Code CLI',protocol:'cli',models:[],scope:'local'},
];
export const FRONTIER_IDS=AI_PROVIDERS.map(p=>p.id) as [FrontierId,...FrontierId[]];
export const providerInfo=(id:FrontierId)=>AI_PROVIDERS.find(p=>p.id===id)!;
export const allowedProviders=(mode:DeploymentMode):ProviderInfo[]=>AI_PROVIDERS.filter(p=>mode==='local'||p.scope==='any');
/** Returns the normalized URL (no trailing slash) or throws. https only; http for loopback. */
export function validateBaseUrl(value:string):string{
 let url:URL;try{url=new URL(value.trim());}catch{throw new Error('Base URL invalid');}
 const loopback=['localhost','127.0.0.1','[::1]'].includes(url.hostname);
 if(url.protocol!=='https:'&&!(url.protocol==='http:'&&loopback))throw new Error('Base URL must use https (http only for localhost)');
 if(url.username||url.password)throw new Error('Base URL must not contain credentials');
 if(url.search||url.hash||value.includes('?')||value.includes('#'))throw new Error('Base URL must not contain a query string or fragment');
 return url.href.replace(/\/+$/,'');
}
export const AiPreferencesSchema=z.object({active:z.enum(FRONTIER_IDS).optional(),models:z.partialRecord(z.enum(FRONTIER_IDS),z.string().min(1).max(120).regex(/^[\w.:/-]+$/)).default({}),customBaseUrl:z.string().max(300).refine(v=>{try{validateBaseUrl(v);return true;}catch{return false;}},'Base URL invalid').optional(),builder:BuilderPreferencesSchema.optional()}).strict();
export type AiPreferences=z.infer<typeof AiPreferencesSchema>;
