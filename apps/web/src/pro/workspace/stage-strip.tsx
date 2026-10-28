/** Stage strip: Brief > Parts > Wiring > Code > Board > Build Sheet > Field. deriveStages is pure; state comes from the stored spec. */
import type {SystemSpec} from '../../../../../packages/pro-contract/system-spec';
export type StageState='done'|'active'|'blocked'|'todo';
export interface Stage{id:'brief'|'parts'|'wiring'|'code'|'board'|'sheet'|'field';label:{en:string;id:string};state:StageState}
/** board and fieldEvidence are not in the spec; pass them when a hook exposes them (otherwise those stages stay todo). */
export interface StageExtra{board?:boolean;fieldEvidence?:boolean;draft?:boolean}
const L:[Stage['id'],string,string][]=[['brief','Brief','Brief'],['parts','Parts','Komponen'],['wiring','Wiring','Pengkabelan'],['code','Code','Kode'],['board','Board','Board'],['sheet','Build Sheet','Build Sheet'],['field','Field','Lapangan']];
export function deriveStages(spec:SystemSpec|null,x:StageExtra={}):Stage[]{
 const st:Record<Stage['id'],StageState>={brief:'active',parts:'todo',wiring:'todo',code:'todo',board:'todo',sheet:'todo',field:'todo'};
 if(spec){
  const vs=Object.values(spec.verification),errors=spec.checks.some(c=>c.severity==='error'),failed=vs.some(v=>v.status==='failed');
  const parts=spec.nodes.length>0&&spec.nodes.every(n=>n.parts.length>0)&&spec.bom.lines.length>0;
  const wires=spec.nodes.some(n=>n.wires.length>0);
  const cs=spec.code.map(c=>c.verify.status),codeBad=cs.includes('failed'),codeOk=cs.length>0&&cs.every(s=>s==='compiled'||s==='linted');
  st.brief='done';st.parts=parts?'done':'active';
  st.wiring=!parts?'todo':!wires?'active':errors?'blocked':'done';
  st.code=!wires?'todo':codeBad?'blocked':codeOk?'done':'active';
  st.board=x.board?'done':'todo';
  st.sheet=x.draft||errors||failed||codeBad?'blocked':codeOk&&vs.length>0&&vs.every(v=>v.status==='verified')?'done':'todo';
  st.field=x.fieldEvidence?'done':'todo';
 }
 return L.map(([id,en,idn])=>({id,label:{en,id:idn},state:st[id]}));
}
const MARK:Record<StageState,string>={done:'✓',active:'●',blocked:'!',todo:'○'};
const COLOR:Record<StageState,string>={done:'var(--ds-ok)',active:'var(--ds-ink)',blocked:'var(--ds-error)',todo:'var(--ds-ink-2)'};
export function StageStrip(p:{spec:SystemSpec|null;lang?:'en'|'id';extra?:StageExtra}){
 const lang=p.lang??'en';
 return <ol className="pro-stages" aria-label={lang==='id'?'Tahapan':'Stages'} style={{display:'flex',gap:8,margin:0,padding:0,listStyle:'none'}}>
  {deriveStages(p.spec,p.extra).map((s,i)=><li key={s.id} data-state={s.state} aria-current={s.state==='active'?'step':undefined} style={{color:COLOR[s.state],fontWeight:s.state==='active'?600:400}}>{i>0&&<span aria-hidden="true" style={{marginRight:8}}>{'›'}</span>}<span aria-hidden="true">{MARK[s.state]} </span>{s.label[lang]}</li>)}
 </ol>;
}
