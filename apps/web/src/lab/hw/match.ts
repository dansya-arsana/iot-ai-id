export interface TLine{t:number;text:string}
export type Match={state:'waiting'}|{state:'same';detail:string}|{state:'differs';detail:string};
const MIN=3,N=8;
const shape=(s:string)=>s.replace(/-?\d+(\.\d+)?/g,'#').trim().toLowerCase();
const median=(v:number[])=>{const s=[...v].sort((a,b)=>a-b);return s[Math.floor(s.length/2)];};
const close=(a:number,b:number,tol:number,floor:number)=>Math.abs(a-b)<=Math.max(Math.abs(a)*tol,floor);
/**
 * Honest comparison of the last N serial lines of sim and board: same line shapes, then same
 * period (median gap between lines, +-10%) and same first number (+-10%). Anything else is reported as a difference.
 */
export function compareSerial(sim:TLine[],real:TLine[],pin?:string):Match{
 const a=sim.slice(-N),b=real.slice(-N);
 if(a.length<MIN||b.length<MIN)return{state:'waiting'};
 const where=pin?` on ${pin}`:'';
 const sa=new Set(a.map(l=>shape(l.text))),sb=new Set(b.map(l=>shape(l.text)));
 const sameShapes=sa.size===sb.size&&[...sa].every(x=>sb.has(x));
 if(!sameShapes)return{state:'differs',detail:`differs: the board prints different lines, check wiring${where}`};
 const gaps=(l:TLine[])=>l.slice(1).map((x,i)=>x.t-l[i].t);
 const pa=median(gaps(a)),pb=median(gaps(b));
 const num=(l:TLine[])=>l.map(x=>/-?\d+(\.\d+)?/.exec(x.text)).filter(Boolean).map(m=>Number(m![0]));
 const na=num(a),nb=num(b);
 // Numeric streams (sensor values) are compared by value; text toggles by period.
 if(na.length>=MIN&&nb.length>=MIN&&sa.size===1){
  const va=median(na),vb=median(nb);
  return close(va,vb,0.1,1)?{state:'same',detail:`behaves the same: value about ${Math.round(vb)} on both`}:{state:'differs',detail:`differs: sim ${Math.round(va)} vs board ${Math.round(vb)}, check wiring${where}`};
 }
 if(!(pa>0)||!(pb>0))return{state:'differs',detail:`differs: no steady rhythm on one side, check wiring${where}`};
 return close(pa,pb,0.1,15)?{state:'same',detail:`behaves the same: period about ${Math.round(pb)} ms (sim ${Math.round(pa)} ms)`}:{state:'differs',detail:`differs: period sim ${Math.round(pa)} ms vs board ${Math.round(pb)} ms, check wiring${where}`};
}
