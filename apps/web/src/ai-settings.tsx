import {useEffect,useState,useRef} from 'react';
import {api,post} from './api';
import {useLang} from './i18n';
import {Button,Eyebrow,Input,Notice,Spinner,Tag} from './ui';
type Provider='openai'|'typesafe';
type Settings={scope:string;providers:Record<Provider,{configured:boolean;fingerprint?:string;testStatus:string;testedAt?:string}>};
type Tone='info'|'ok'|'warn'|'error';
export function AiSettings(){
 const{tr,lang}=useLang();
 const section=useRef<HTMLElement>(null);
 useEffect(()=>{if(window.location.hash==='#bo-ai')section.current?.scrollIntoView();},[]);
 const [settings,setSettings]=useState<Settings>();const [keys,setKeys]=useState({openai:'',typesafe:''});const [busy,setBusy]=useState<Provider>();const [message,setMessage]=useState<{text:string;tone:Tone}>();
 useEffect(()=>{api<Settings>('/ai-settings').then(setSettings).catch(()=>setMessage({tone:'warn',text:tr('AI settings could not be loaded.','Pengaturan AI gagal dimuat.')}));},[]);// eslint-disable-line react-hooks/exhaustive-deps -- load once on mount
 async function action(provider:Provider,operation:'save'|'test'|'delete'){
  setBusy(provider);setMessage(undefined);const key=keys[provider];setKeys(values=>({...values,[provider]:''}));
  try{if(operation==='test'){const result=await post('/ai-settings/'+provider+'/test',{});setSettings(result.settings);setMessage({text:result.message,tone:result.settings?.providers?.[provider]?.testStatus==='connected'?'ok':'error'});}else{setSettings(await api<Settings>('/ai-settings/'+provider,{method:operation==='save'?'PUT':'DELETE',...(operation==='save'?{body:JSON.stringify({key})}:{})}));setMessage(operation==='save'?{tone:'ok',text:tr('Key saved encrypted. Run a connection test to check access.','Key tersimpan terenkripsi. Uji koneksi untuk memeriksa akses.')}:{tone:'info',text:tr('Saved key deleted. Runtime configuration may still apply.','Key tersimpan dihapus. Konfigurasi runtime dapat tetap berlaku.')});}}
  catch{setMessage({tone:'error',text:tr('AI settings failed. Check the key and try again.','Pengaturan AI gagal. Periksa key dan coba lagi.')});}finally{setBusy(undefined);}
 }
 const locale=lang==='id'?'id-ID':'en-GB';
 return <section ref={section} id="bo-ai" className="bo-ai-settings bo-panel" aria-label={tr('AI settings','Pengaturan AI')}>
  <div className="bo-panel-head"><div><Eyebrow>{tr('Owner only','Khusus pemilik')}</Eyebrow><h2>{tr('AI settings','Pengaturan AI')}</h2></div></div>
  <div className="bo-ai-intro">
   <p className="bo-muted">{tr('Workspace owner configuration. The cloud currently runs on one shared owner account; there is no separate per-user BYOK yet. Desktop uses local workspace storage.','Konfigurasi pemilik workspace. Cloud saat ini memakai satu akun owner bersama; belum ada BYOK terpisah per pengguna. Desktop memakai penyimpanan workspace lokal.')}</p>
   <p className="bo-muted">{tr('Use OpenAI and TypeSafe/Jev API keys. ChatGPT sign-in is not available yet. The OpenAI test checks API connectivity, not GPT-6.1 Sol inference access.','Gunakan API key OpenAI dan TypeSafe/Jev. Login ChatGPT belum tersedia. Uji OpenAI memeriksa koneksi API, belum akses inferensi GPT-6.1 Sol.')}</p>
   <Notice tone="info" title={tr('Keys are write-only','Key hanya bisa ditulis')}>{tr('Keys are stored encrypted and never shown again. Only a fingerprint and the last connection test are displayed; the field clears after each submit.','Key disimpan terenkripsi dan tidak ditampilkan kembali. Hanya fingerprint dan hasil uji koneksi terakhir yang terlihat; kolom dikosongkan setiap kali dikirim.')}</Notice>
  </div>
  <div className="bo-ai-forms">
   {(['openai','typesafe'] as const).map(provider=>{
    const p=settings?.providers[provider];
    const test=p?.testStatus==='connected'?<Tag tone="ok">{tr('Connected','Koneksi berhasil')}</Tag>:p?.testStatus==='failed'?<Tag tone="error">{tr('Connection failed','Koneksi gagal')}</Tag>:<Tag>{tr('Not tested','Belum diuji')}</Tag>;
    return <form key={provider} className="bo-ai-form" onSubmit={event=>{event.preventDefault();void action(provider,'save');}}>
     <div className="bo-ai-form-head"><h3>{provider==='openai'?'OpenAI':'TypeSafe / Jev'}</h3>{p?.configured?test:<Tag>{tr('No key','Belum ada key')}</Tag>}</div>
     {p?.configured
      ?<dl className="bo-ai-meta"><div><dt>{tr('Stored','Tersimpan')}</dt><dd>{tr('Encrypted','Terenkripsi')}</dd></div><div><dt>Fingerprint</dt><dd><code className="bo-mono">{p.fingerprint}</code></dd></div>{p.testedAt&&<div><dt>{tr('Last test','Uji terakhir')}</dt><dd>{new Date(p.testedAt).toLocaleString(locale)}</dd></div>}</dl>
      :<p className="bo-muted">{tr('No dashboard key yet. Runtime configuration may still apply.','Belum ada key dashboard. Konfigurasi runtime dapat tetap berlaku.')}</p>}
     <Input id={'bo-ai-key-'+provider} label={tr('New API key','API key baru')} hint={tr('Write-only. Replaces the stored key.','Hanya tulis. Menggantikan key tersimpan.')} type="password" autoComplete="off" spellCheck={false} value={keys[provider]} onChange={event=>setKeys(values=>({...values,[provider]:event.target.value}))} placeholder={tr('Enter API key','Masukkan API key')} disabled={!!busy}/>
     <div className="bo-ai-actions">
      <Button size="sm" disabled={!!busy||keys[provider].trim().length<8} type="submit">{tr('Save','Simpan')}</Button>
      <Button size="sm" variant="secondary" disabled={!!busy||!p?.configured} onClick={()=>void action(provider,'test')}>{tr('Test connection','Uji koneksi')}</Button>
      <Button size="sm" variant="ghost" disabled={!!busy||!p?.configured} onClick={()=>void action(provider,'delete')}>{tr('Delete key','Hapus key')}</Button>
     </div>
    </form>;})}
  </div>
  <div className="bo-ai-result" aria-live="polite">{busy?<span className="bo-ai-busy"><Spinner label={tr('Processing','Memproses')}/>{tr('Processing…','Memproses…')}</span>:message&&<Notice tone={message.tone}>{message.text}</Notice>}</div>
 </section>;
}
