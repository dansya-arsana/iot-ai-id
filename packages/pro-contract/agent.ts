/**
 * Agent turn protocol (ADR 012 §1, plan §5): turn request, SSE events, technical limits, usage records.
 * Founder decision: no billing budgets or per-member quotas. Only TECHNICAL safety:
 *  - per-turn limits (<=40 tool calls, <=15 min);
 *  - one global monthly USD kill-switch, admin-configurable, default high, can be disabled;
 *  - usage recorded per member and per project so billing can attach later.
 * Pure zod; no I/O.
 */
import {z} from 'zod';
import {PRO_MODELS} from './pricing.js';

export const PRO_PROMPT_CHARS=2000;

// ---------- technical limits ----------
export const TURN_LIMITS={maxToolCalls:40,maxTurnMs:15*60_000,maxParallelServerTools:4,clientToolTimeoutMs:120_000} as const;
export const KILL_SWITCH_DEFAULT_USD=1000;
/** Per-turn hard USD cap (admin-configurable, default USD 3). Each model call reserves its estimated cost first; the turn stops with 'budget' instead of overrunning. Saved revisions are kept. */
export const TURN_USD_CAP_DEFAULT=3;
export const TurnCapSchema=z.number().min(0.1).max(1000);
/** Admin-configurable, global, monthly. enabled:false turns the switch off. Not a quota: it is a safety stop. */
export const KillSwitchSchema=z.object({enabled:z.boolean(),monthlyUsd:z.number().positive().max(1_000_000)}).strict();
export type KillSwitch=z.infer<typeof KillSwitchSchema>;
export const DEFAULT_KILL_SWITCH:KillSwitch={enabled:true,monthlyUsd:KILL_SWITCH_DEFAULT_USD};
/** True when the turn must stop (month-to-date micro-USD of all usage reached the cap). */
export const killSwitchTripped=(k:KillSwitch,monthUsdMicros:number):boolean=>k.enabled&&monthUsdMicros>=k.monthlyUsd*1_000_000;

// ---------- usage record (per member and per project; billing attaches later) ----------
export const UsageRecordSchema=z.object({
 subject:z.string().min(1).max(80),                // member id
 projectId:z.string().min(1).max(80),
 turnId:z.string().min(1).max(80),
 model:z.string().min(1).max(80),
 inputTokens:z.number().int().nonnegative(),outputTokens:z.number().int().nonnegative(),
 cacheReadTokens:z.number().int().nonnegative(),cacheWriteTokens:z.number().int().nonnegative(),
 usdMicros:z.number().int().nonnegative().nullable(),   // null when the model has no pinned price
 toolCalls:z.number().int().nonnegative(),
 at:z.string().datetime(),
}).strict();
export type UsageRecord=z.infer<typeof UsageRecordSchema>;

// ---------- turn request ----------
export const CLIENT_TOOL_NAMES=['device_detect','device_flash','serial_read','telemetry_read'] as const;
export const TurnRequestSchema=z.object({
 message:z.string().trim().min(1).max(PRO_PROMPT_CHARS),
 lang:z.enum(['en','id']).default('en'),
 /** Client tools this browser can run (desktop local host only). Anything else is refused by ops. */
 clientTools:z.array(z.enum(CLIENT_TOOL_NAMES)).max(4).default([]),
 /** Optional hint; the head revision is authoritative. */
 baseRevision:z.number().int().nonnegative().optional(),
}).strict();
export type TurnRequest=z.infer<typeof TurnRequestSchema>;
export const TurnAcceptedSchema=z.object({turnId:z.string().min(1).max(80)}).strict();

/** Model used for a turn is the admin's global choice, never a request field. */
export const ProModelSchema=z.enum(PRO_MODELS);

// ---------- SSE events ----------
export const STOP_REASONS=['end_turn','tool_limit','time_limit','kill_switch','budget','max_tokens','cancelled','error'] as const;
export type StopReason=typeof STOP_REASONS[number];
const base={seq:z.number().int().nonnegative()};
const callId=z.string().min(1).max(80);
export const AgentEventSchema=z.discriminatedUnion('type',[
 z.object({...base,type:z.literal('text_delta'),text:z.string().max(20_000)}).strict(),
 z.object({...base,type:z.literal('thinking_delta'),text:z.string().max(20_000)}).strict(),
 z.object({...base,type:z.literal('tool_call'),callId,name:z.string().min(1).max(60),input:z.unknown()}).strict(),
 z.object({...base,type:z.literal('tool_result'),callId,name:z.string().min(1).max(60),ok:z.boolean(),output:z.unknown(),ms:z.number().int().nonnegative().optional()}).strict(),
 z.object({...base,type:z.literal('client_tool_request'),callId,name:z.enum(CLIENT_TOOL_NAMES),input:z.unknown(),timeoutMs:z.number().int().positive().max(TURN_LIMITS.clientToolTimeoutMs)}).strict(),
 z.object({...base,type:z.literal('revision_saved'),revision:z.number().int().positive(),specSha:z.string().regex(/^[0-9a-f]{64}$/),verified:z.number().int().nonnegative(),unverified:z.number().int().nonnegative(),failed:z.number().int().nonnegative(),/** A draft is never verified and never reaches the Build Sheet. */draft:z.boolean().optional()}).strict(),
 z.object({...base,type:z.literal('usage'),model:z.string().min(1).max(80),inputTokens:z.number().int().nonnegative(),outputTokens:z.number().int().nonnegative(),cacheReadTokens:z.number().int().nonnegative(),cacheWriteTokens:z.number().int().nonnegative(),usdMicros:z.number().int().nonnegative().nullable()}).strict(),
 z.object({...base,type:z.literal('done'),stopReason:z.enum(STOP_REASONS)}).strict(),
 z.object({...base,type:z.literal('error'),code:z.string().min(1).max(40),message:z.string().max(400)}).strict(),
]);
export type AgentEvent=z.infer<typeof AgentEventSchema>;
export const AGENT_EVENT_TYPES=['text_delta','thinking_delta','tool_call','tool_result','client_tool_request','revision_saved','usage','done','error'] as const;

/** Result of a client tool, POSTed by the browser to `.../turns/:turnId/tool-results`. */
export const ClientToolResultSchema=z.object({callId,ok:z.boolean(),output:z.unknown()}).strict();
export type ClientToolResult=z.infer<typeof ClientToolResultSchema>;

/** SSE wire format: `event: <type>\ndata: <json>\n\n`. */
export const sseFrame=(e:AgentEvent):string=>`event: ${e.type}\ndata: ${JSON.stringify(e)}\n\n`;
/** Parse a fixtures/agent/*.jsonl transcript (one AgentEvent per line, blank lines ignored). Throws on a bad line. */
export function parseEventsJsonl(text:string):AgentEvent[]{
 return text.split('\n').map((l,i)=>({l:l.trim(),i})).filter(x=>x.l).map(({l,i})=>{
  const r=AgentEventSchema.safeParse(JSON.parse(l));
  if(!r.success)throw new Error(`event line ${i+1}: ${r.error.issues[0]?.message}`);
  return r.data;
 });
}
