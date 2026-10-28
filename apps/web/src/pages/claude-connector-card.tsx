/** Profile card "Claude connector" (plan claude-connector C1): the /mcp endpoint, personal access tokens (list, create shown once, revoke). Pro members and staff only. */
import {useEffect,useState,type FormEvent} from 'react';
import {useLang} from '../i18n';
import {Button,Card,Input} from '../ui';

type Token={id:string;name:string;createdAt:string;expiresAt:string;lastUsedAt:string|null};
const BASE='/ops/v1/member/pro/tokens';
async function call<T>(method:string,path='',body?:unknown):Promise<T>{
 const r=await fetch(BASE+path,{method,credentials:'same-origin',headers:{'Content-Type':'application/json','X-AIoT-Member':'1'},...(body===undefined?{}:{body:JSON.stringify(body)})});
 const data=await r.json().catch(()=>({}));
 if(!r.ok)throw new Error(String((data as {error?:string}).error??'HTTP '+r.status));
 return data as T;
}
const ago=(iso:string|null,tr:(en:string,id:string)=>string)=>{
 if(!iso)return tr('never used','belum dipakai');
 const m=Math.max(0,Math.round((Date.now()-Date.parse(iso))/60_000));
 return m<60?tr(`used ${m} min ago`,`dipakai ${m} mnt lalu`):m<2880?tr(`used ${Math.round(m/60)} h ago`,`dipakai ${Math.round(m/60)} jam lalu`):tr(`used ${Math.round(m/1440)} d ago`,`dipakai ${Math.round(m/1440)} hari lalu`);
};

export function ClaudeConnectorCard(){
 const{tr}=useLang();
 const endpoint=`${window.location.origin}/mcp`;
 const [tokens,setTokens]=useState<Token[]|null>(null);const [name,setName]=useState('');const [fresh,setFresh]=useState<string|null>(null);const [error,setError]=useState('');const [busy,setBusy]=useState(false);const [copied,setCopied]=useState('');
 const load=()=>call<{tokens:Token[]}>('GET').then(d=>setTokens(d.tokens)).catch(e=>setError(e.message));
 useEffect(()=>{void load();},[]);
 const copy=(v:string,k:string)=>{void navigator.clipboard?.writeText(v).then(()=>setCopied(k)).catch(()=>undefined);};
 async function create(e:FormEvent){e.preventDefault();setBusy(true);setError('');try{const r=await call<{value:string}>('POST','',{name:name.trim()||'claude'});setFresh(r.value);setName('');await load();}catch(x){setError((x as Error).message);}finally{setBusy(false);}}
 async function revoke(id:string){setBusy(true);setError('');try{await call('DELETE','/'+encodeURIComponent(id));await load();}catch(x){setError((x as Error).message);}finally{setBusy(false);}}
 const date=(iso:string)=>new Date(iso).toLocaleDateString(undefined,{day:'numeric',month:'short'});
 return <Card as="div" className="mp-card-area cc-card" data-testid="claude-connector-card">
  <h3>{tr('Claude connector','Konektor Claude')}</h3>
  <p>{tr('Let Claude design with AIoT\'s verified parts and checks.','Biarkan Claude merancang dengan part dan pemeriksaan AIoT yang terverifikasi.')}</p>
  <div className="cc-row"><span className="cc-label">{tr('Endpoint','Endpoint')}</span><code className="cc-code">{endpoint}</code><Button size="sm" variant="secondary" onClick={()=>copy(endpoint,'ep')}>{copied==='ep'?tr('Copied','Tersalin'):tr('Copy','Salin')}</Button></div>
  <span className="cc-label">{tr('Tokens','Token')}</span>
  {tokens===null?<p>{tr('Loading…','Memuat…')}</p>:tokens.length===0?<p>{tr('No tokens yet.','Belum ada token.')}</p>:
   <ul className="cc-list">{tokens.map(t=><li key={t.id} className="cc-row"><span><strong>{t.name}</strong> · {tr('created','dibuat')} {date(t.createdAt)} · {ago(t.lastUsedAt,tr)}</span><Button size="sm" variant="secondary" disabled={busy} onClick={()=>void revoke(t.id)}>{tr('Revoke','Cabut')}</Button></li>)}</ul>}
  {fresh&&<div className="cc-fresh" role="status"><p>{tr('Copy this token now. It is shown only once.','Salin token ini sekarang. Token hanya ditampilkan sekali.')}</p><div className="cc-row"><code className="cc-code">{fresh}</code><Button size="sm" onClick={()=>copy(fresh,'tok')}>{copied==='tok'?tr('Copied','Tersalin'):tr('Copy','Salin')}</Button></div>
   <code className="cc-code cc-cmd">{`claude mcp add --transport http aiot ${endpoint} --header "Authorization: Bearer ${fresh}"`}</code></div>}
  <form className="cc-row" onSubmit={e=>void create(e)}><Input id="cc-name" label={tr('Token name','Nama token')} hideLabel placeholder="laptop-claude" maxLength={40} value={name} onChange={e=>setName(e.target.value)}/><Button type="submit" size="sm" disabled={busy||(tokens?.length??0)>=5}>{tr('+ New token','+ Token baru')}</Button></form>
  <p className="cc-note">{tr('Shown once · expires in 90 days · at most 5.','Ditampilkan sekali · kedaluwarsa dalam 90 hari · maksimal 5.')}</p>
  {error&&<p className="cc-error" role="alert">{error}</p>}
  <p className="cc-note">{tr('Flashing a board always needs the desktop app and your OK.','Mem-flash board selalu memerlukan aplikasi desktop dan persetujuan Anda.')}</p>
 </Card>;
}
