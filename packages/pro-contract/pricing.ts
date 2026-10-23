/**
 * Model ids and pricing (plan §5, ADR 012 §7). Founder decision: NO billing budgets or per-member quotas.
 * Prices are recorded so usage can be costed and billing can attach later.
 * Prices pinned in M3-A from https://platform.claude.com/docs/en/about-claude/pricing (fetched 2026-10-23), USD per MTok.
 * Re-verify before billing attaches. A null entry would mean usd is unknown (usdMicros:null); it never blocks a turn.
 */
export const PRO_MODELS=['claude-sonnet-5-5','claude-opus-5-5'] as const;
export type ProModel=typeof PRO_MODELS[number];
export const PRO_DEFAULT_MODEL:ProModel='claude-sonnet-5-5';
export const isProModel=(m:string):m is ProModel=>(PRO_MODELS as readonly string[]).includes(m);

export interface ProPrice{inputPerMTok:number;outputPerMTok:number;cacheWrite5mPerMTok:number;cacheReadPerMTok:number;source:string;verifiedAt:string}
const PRICING_SOURCE='https://platform.claude.com/docs/en/about-claude/pricing';
export const PRO_PRICING:Record<ProModel,ProPrice|null>={
 'claude-sonnet-5-5':{inputPerMTok:2,outputPerMTok:10,cacheWrite5mPerMTok:2.5,cacheReadPerMTok:0.1,source:PRICING_SOURCE,verifiedAt:'2026-10-23'},
 'claude-opus-5-5':{inputPerMTok:4,outputPerMTok:20,cacheWrite5mPerMTok:5,cacheReadPerMTok:0.2,source:PRICING_SOURCE,verifiedAt:'2026-10-23'},
};

export interface TokenUsage{inputTokens:number;outputTokens:number;cacheReadTokens:number;cacheWriteTokens:number}
/** usd = (in*inP + cw*cwP + cr*crP + out*outP) / 1e6, as integer micro-USD; null when the model has no pinned price. */
export function costMicros(model:string,u:TokenUsage,table:Record<string,ProPrice|null>=PRO_PRICING):number|null{
 const p=table[model];
 if(!p)return null;
 // price is USD per MTok, so tokens*price = micro-USD
 return Math.round(u.inputTokens*p.inputPerMTok+u.cacheWriteTokens*p.cacheWrite5mPerMTok+u.cacheReadTokens*p.cacheReadPerMTok+u.outputTokens*p.outputPerMTok);
}
