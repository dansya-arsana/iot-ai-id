import {useProSpec} from '../api/spec-store';

export function StatusBar(){
 const {spec,revision,status,error}=useProSpec();
 if(!spec)return <footer className="pro-status"><span>{status==='loading'?'Loading…':status==='error'?error:'No design yet'}</span></footer>;
 const v=Object.values(spec.verification),ok=v.filter(x=>x.status==='verified').length,bad=v.filter(x=>x.status==='failed').length;
 const files=spec.code,compiled=files.filter(c=>c.verify.status==='compiled').length,linted=files.filter(c=>c.verify.status==='linted').length;
 const errors=spec.checks.filter(c=>c.severity==='error').length;
 return <footer className="pro-status"><span className={'pro-status-dot'+(errors?' is-error':'')}/>
  <span>SystemSpec v{spec.meta.version} · r{revision} · {errors?`${errors} errors`:'valid'}</span>
  <span>Checks {ok}/{v.length} verified{bad?` · ${bad} failed`:''}</span>
  <span>Code: {compiled} compiled · {linted} linted</span>
  <span className="pro-status-end">AI-generated design · review before you build</span>
 </footer>;
}
