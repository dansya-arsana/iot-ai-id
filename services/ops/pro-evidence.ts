/** M7-D: evidence rows, deterministic tick rules and anomaly detectors. Pure core plus a thin db layer over pro_evidence and pro_ticks.
 *  Ticks from evidence are written here, never by a model tool. Physical actions are NOT decided here: consent lives in desktop/consent.cjs. */
export type EvidenceEvent=
 |{kind:'flash';nodeId:string;ok:boolean;sha:string;at:string}
 |{kind:'boot';nodeId:string;banner?:string;at:string}
 |{kind:'reading';nodeId:string;partId:string;value:number;at:string}
 |{kind:'telemetry';linkId:string;nodeId?:string;at:string;marginDb?:number}
 |{kind:'battery';nodeId:string;volts:number;at:string}
 |{kind:'heartbeat';nodeId:string;at:string};
export interface Range{min:number;max:number}
export interface EvidenceCtx{
 /** sha of the revision artifact per node */
 shaOf(nodeId:string):string|undefined;
 /** expected banner per node (AIOT_BOOT_BANNER); any non-empty banner counts when undefined */
 bannerOf?(nodeId:string):string|undefined;
 rangeOf(partId:string):Range|undefined;
}
export interface Tick{itemId:string;state:'ticked';by:'evidence';evidenceRef:string}
export interface Anomaly{nodeId:string;code:string;en:string;id:string;severity:'info'|'warn'|'error'}

const ref=(e:EvidenceEvent)=>`${e.kind}@${e.at}`;
/** Deterministic tick rules. Returns at most one tick per event. */
export function tickFor(e:EvidenceEvent,c:EvidenceCtx):Tick|undefined{
 const t=(itemId:string):Tick=>({itemId,state:'ticked',by:'evidence',evidenceRef:ref(e)});
 switch(e.kind){
  case 'flash':{const want=c.shaOf(e.nodeId);return e.ok&&want&&want===e.sha?t(`flash:${e.nodeId}`):undefined;}
  case 'boot':{
   if(!e.banner?.trim())return undefined;
   const want=c.bannerOf?.(e.nodeId);
   return !want||e.banner.includes(want)?t(`power-up:${e.nodeId}:boot`):undefined;}
  case 'reading':{
   const r=c.rangeOf(e.partId);
   return r&&Number.isFinite(e.value)&&e.value>=r.min&&e.value<=r.max?t(`power-up:${e.nodeId}:${e.partId}`):undefined;}
  case 'telemetry':return t(`commission:${e.linkId}`);
  default:return undefined;
 }
}

export interface DetectOpts{
 stuckN?:number;bootLoopN?:number;bootLoopWindowMs?:number;
 batteryFloor?(nodeId:string):number|undefined;
 linkMarginMinDb?:number;heartbeatIntervalMs?:(nodeId:string)=>number|undefined;nowMs?:number;
}
const an=(nodeId:string,code:string,en:string,id:string,severity:Anomaly['severity']):Anomaly=>({nodeId,code,en,id,severity});
/** First three detectors (plan cut-first): stuck value, out of range, boot loop. Events must be in time order. */
export function detect(events:EvidenceEvent[],c:EvidenceCtx,o:DetectOpts={}):Anomaly[]{
 const out:Anomaly[]=[];const stuckN=o.stuckN??6,bl=o.bootLoopN??3,win=o.bootLoopWindowMs??120_000;
 const seen=new Set<string>();const push=(a:Anomaly)=>{const k=`${a.nodeId}|${a.code}`;if(!seen.has(k)){seen.add(k);out.push(a);}};
 const series=new Map<string,number[]>();const boots=new Map<string,number[]>();
 for(const e of events){
  if(e.kind==='reading'){
   const k=`${e.nodeId}:${e.partId}`;const s=series.get(k)??[];s.push(e.value);series.set(k,s);
   const r=c.rangeOf(e.partId);
   if(r&&(e.value<r.min||e.value>r.max))push(an(e.nodeId,'out_of_range',`${e.partId} reads ${e.value}, outside ${r.min}..${r.max}. Check wiring, units and power.`,`${e.partId} membaca ${e.value}, di luar ${r.min}..${r.max}. Periksa kabel, satuan dan daya.`,'warn'));
   if(s.length>=stuckN&&s.slice(-stuckN).every(v=>v===s[s.length-1]))push(an(e.nodeId,'stuck_value',`${e.partId} returned ${s[s.length-1]} ${stuckN} times in a row. The sensor may be disconnected or hung.`,`${e.partId} mengembalikan ${s[s.length-1]} ${stuckN} kali berturut-turut. Sensor mungkin terlepas atau hang.`,'warn'));
  }else if(e.kind==='boot'){
   const t=Date.parse(e.at);const b=boots.get(e.nodeId)??[];b.push(t);boots.set(e.nodeId,b);
   const recent=b.filter(x=>t-x<=win);
   if(recent.length>=bl)push(an(e.nodeId,'boot_loop',`${recent.length} boots within ${Math.round(win/1000)} s. Likely brownout or a crash in setup.`,`${recent.length} boot dalam ${Math.round(win/1000)} dtk. Kemungkinan brownout atau crash di setup.`,'error'));
  }
 }
 return out;
}

// ----- P5 evidence loop: proven nodes raise catalog confidence (as proposals only) -----
export const PROVEN_DAYS=7;
export interface TickRow{itemId:string;state:string;by:string;at:string}
/** A node is field-proven when every checklist item is ticked by evidence (not human) and the newest of those ticks is at least `days` old. Error anomalies block it. */
export function nodeProven(itemIds:string[],ticks:TickRow[],nowMs:number,days=PROVEN_DAYS,anomalies:Anomaly[]=[]):{proven:boolean;since?:string;missing:string[]}{
 const by=new Map(ticks.map(t=>[t.itemId,t]));
 const missing=itemIds.filter(i=>{const t=by.get(i);return !t||t.state!=='ticked'||t.by!=='evidence';});
 if(!itemIds.length||missing.length)return{proven:false,missing};
 const since=itemIds.map(i=>by.get(i)!.at).reduce((a,b)=>Date.parse(a)>=Date.parse(b)?a:b);
 const old=nowMs-Date.parse(since)>=days*86_400_000;
 return{proven:old&&!anomalies.some(a=>a.severity==='error'),since,missing:[]};
}
export interface PartLeaf{path:string;v:unknown;p:{source:string;verifiedBy:string;at:string;confidence:string}}
export interface ProposalSink{submitProposal(subject:string,i:{partId:string;ops:{op:'replace';path:string;value:unknown}[];reason:string;source:string}):{ok:true;id:string}|{ok:false;error:string}}
/** Builds one confidence-raise proposal per part from its non-high leaves. Never writes the catalog: staff approve, and staff alone set labTested. */
export function proposeConfidenceRaise(sink:ProposalSink,subject:string,partIds:string[],leavesOf:(partId:string)=>PartLeaf[],o:{projectId:string;nodeId:string;since:string;today:string}):{proposed:{partId:string;proposalId:string}[];skipped:string[]}{
 const proposed:{partId:string;proposalId:string}[]=[],skipped:string[]=[];
 for(const partId of [...new Set(partIds)]){
  const ops=leavesOf(partId).filter(l=>l.p.confidence!=='high').slice(0,20).map(l=>({op:'replace' as const,path:l.path,value:{v:l.v,p:{...l.p,confidence:'high',verifiedBy:'import',at:o.today}}}));
  if(!ops.length){skipped.push(partId);continue;}
  const r=sink.submitProposal(subject,{partId,ops,reason:`Field-proven: node ${o.nodeId} passed all evidence checks since ${o.since.slice(0,10)} (project ${o.projectId}). Staff: confirm, then set labTested with the Lab Mitra task id.`.slice(0,600),source:`pro-evidence:${o.projectId}:${o.nodeId}`});
  if(r.ok)proposed.push({partId,proposalId:r.id});else skipped.push(partId);
 }
 return{proposed,skipped};
}

// ----- db layer -----
interface Db{prepare(sql:string):{run(...a:unknown[]):unknown;all(...a:unknown[]):unknown[];get(...a:unknown[]):unknown}}
export class ProEvidence{
 constructor(private db:Db,private now:()=>Date=()=>new Date()){}
 events(projectId:string):EvidenceEvent[]{
  return (this.db.prepare('SELECT payload FROM pro_evidence WHERE project_id=? ORDER BY id').all(projectId) as {payload:string}[]).flatMap(r=>{try{return[JSON.parse(r.payload) as EvidenceEvent];}catch{return[];}});
 }
 /** Stores the row and applies the tick rule. A human-set item (by='human') is never overwritten. Returns the tick if one was written. */
 ingest(projectId:string,e:EvidenceEvent,c:EvidenceCtx):Tick|undefined{
  const nodeId='nodeId' in e?e.nodeId??null:null;
  this.db.prepare('INSERT INTO pro_evidence(project_id,node_id,kind,payload,at) VALUES(?,?,?,?,?)').run(projectId,nodeId,e.kind,JSON.stringify(e),this.now().toISOString());
  const t=tickFor(e,c);if(!t)return undefined;
  const cur=this.db.prepare('SELECT by,state FROM pro_ticks WHERE project_id=? AND item_id=?').get(projectId,t.itemId) as {by:string;state:string}|undefined;
  if(cur&&cur.by==='human')return undefined;
  this.db.prepare('INSERT INTO pro_ticks(project_id,item_id,state,by,evidence_ref,at) VALUES(?,?,?,?,?,?) ON CONFLICT(project_id,item_id) DO UPDATE SET state=excluded.state,by=excluded.by,evidence_ref=excluded.evidence_ref,at=excluded.at').run(projectId,t.itemId,t.state,t.by,t.evidenceRef,this.now().toISOString());
  return t;
 }
 ticks(projectId:string):TickRow[]{return (this.db.prepare('SELECT item_id,state,by,at FROM pro_ticks WHERE project_id=?').all(projectId) as {item_id:string;state:string;by:string;at:string}[]).map(r=>({itemId:r.item_id,state:r.state,by:r.by,at:r.at}));}
 /** Is this node's checklist fully evidenced for N days? */
 nodeProven(projectId:string,itemIds:string[],c:EvidenceCtx,days=PROVEN_DAYS):ReturnType<typeof nodeProven>{return nodeProven(itemIds,this.ticks(projectId),this.now().getTime(),days,detect(this.events(projectId),c));}
 /** Shape for the evidence_status tool. */
 status(projectId:string,c:EvidenceCtx,o?:DetectOpts){
  const items=(this.db.prepare('SELECT item_id,state,by,evidence_ref FROM pro_ticks WHERE project_id=?').all(projectId) as {item_id:string;state:string;by:string;evidence_ref:string|null}[])
   .map(r=>({itemId:r.item_id,state:r.state,by:r.by==='evidence'?'evidence':'human',evidenceRef:r.evidence_ref??undefined}));
  return{items,anomalies:detect(this.events(projectId),c,o)};
 }
}
