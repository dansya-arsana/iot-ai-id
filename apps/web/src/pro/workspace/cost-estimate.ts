/**
 * Pre-turn agent cost estimate (pure). Upper bound = the per-turn USD cap; typical = median of recent turns when known.
 * Checks, exports and downloads are deterministic and always free. The number is an estimate, never a quote.
 */
export interface CostEstimate{capUsd:number;typicalUsd:number|null;label:{en:string;id:string};free:{en:string;id:string}}
export const DEFAULT_TURN_CAP_USD=3;
const median=(xs:number[])=>{const s=[...xs].sort((a,b)=>a-b),m=s.length>>1;return s.length%2?s[m]:(s[m-1]+s[m])/2;};
const usd=(n:number)=>n<0.01?'<0.01':n.toFixed(2);
export function estimateTurnCost(capUsd:number|null|undefined,recentTurnUsd:(number|null|undefined)[]=[]):CostEstimate{
 const cap=capUsd&&capUsd>0?capUsd:DEFAULT_TURN_CAP_USD;
 const known=recentTurnUsd.filter((x):x is number=>typeof x==='number'&&Number.isFinite(x)&&x>=0).slice(-10);
 const typical=known.length?Math.min(cap,median(known)):null;
 return{capUsd:cap,typicalUsd:typical,
  label:typical===null
   ?{en:`Estimate: up to USD ${usd(cap)} per turn (cap)`,id:`Perkiraan: maks. USD ${usd(cap)} per giliran (batas)`}
   :{en:`Estimate: about USD ${usd(typical)} per turn, never above USD ${usd(cap)}`,id:`Perkiraan: sekitar USD ${usd(typical)} per giliran, tidak lebih dari USD ${usd(cap)}`},
  free:{en:'Checks, exports and downloads are free',id:'Pemeriksaan, ekspor, dan unduhan gratis'}};
}
