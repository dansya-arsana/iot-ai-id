import {useEffect,useState,useRef} from 'react';
import {api,post} from './api';
import {useLang} from './i18n';
import {Button,Eyebrow,Input,Notice,Select,Spinner,Tag} from './ui';
type Status={configured:boolean;fingerprint?:string;testStatus:string;testedAt?:string};
type Prefs={active?:string;models:Record<string,string>;customBaseUrl?:string};
type Entry={id:string;label:string;protocol:string;models:string[];keyUrl?:string;scope:string;available?:boolean};
type Settings={scope:string;deployment:'cloud'|'local';preferences:Prefs;registry:Entry[];providers:Record<string,Status>};
type Tone='info'|'ok'|'warn'|'error';
export function AiSettings(){
 const{tr,lang}=useLang();
 const section=useRef<HTMLElement>(null);
 useEffect(()=>{if(window.location.hash==='#bo-ai')section.current?.scrollIntoView();},[]);
 const [settings,setSettings]=useState<Settings>();const [keys,setKeys]=useState<Record<string,string>>({});const [busy,setBusy]=useState<string>();const [message,setMessage]=useState<{text:string;tone:Tone}>();const [custom,setCustom]=useState<{url?:string;model?:string}>({});
 useEffect(()=>{api<Settings>('/ai-settings').then(setSettings).catch(()=>setMessage({tone:'warn',text:tr('AI settings could not be loaded.','Pengaturan AI gagal dimuat.')}));},[]);// eslint-disable-line react-hooks/exhaustive-deps -- load once on mount
 async function action(provider:string,operation:'save'|'test'|'delete'){
  setBusy(provider);setMessage(undefined);const key=keys[provider]??'';setKeys(values=>({...values,[provider]:''}));
  try{if(operation==='test'){const result=await post('/ai-settings/'+provider+'/test',{});setSettings(result.settings);setMessage({text:result.message,tone:result.settings?.providers?.[provider]?.testStatus==='connected'?'ok':'error'});}else{const result=await api<Settings>('/ai-settings/'+provider,{method:operation==='save'?'PUT':'DELETE',...(operation==='save'?{body:JSON.stringify({key})}:{})});setSettings(current=>({...current!,providers:result.providers}));setMessage(operation==='save'?{tone:'ok',text:tr('Key saved encrypted. Run a connection test to check access.','Key tersimpan terenkripsi. Uji koneksi untuk memeriksa akses.')}:{tone:'info',text:tr('Saved key deleted. Runtime configuration may still apply.','Key tersimpan dihapus. Konfigurasi runtime dapat tetap berlaku.')});}}
  catch{setMessage({tone:'error',text:tr('AI settings failed. Check the key and try again.','Pengaturan AI gagal. Periksa key dan coba lagi.')});}finally{setBusy(undefined);}
 }
 async function savePrefs(next:Prefs){
  setBusy('preferences');setMessage(undefined);
  try{const result=await api<Settings>('/ai-settings/preferences',{method:'PUT',body:JSON.stringify(next)});setSettings(current=>({...current!,preferences:result.preferences}));setMessage({tone:'ok',text:tr('AI preferences saved.','Preferensi AI tersimpan.')});}
  catch{setMessage({tone:'error',text:tr('AI settings failed. Check the key and try again.','Pengaturan AI gagal. Periksa key dan coba lagi.')});}finally{setBusy(undefined);}
 }
 const locale=lang==='id'?'id-ID':'en-GB';
 const prefs:Prefs=settings?.preferences??{models:{}};
 const local=settings?.deployment==='local';
 const entries=(settings?.registry??[]).filter(entry=>entry.protocol!=='cli');
 const cliEntries=(settings?.registry??[]).filter(entry=>entry.protocol==='cli');
 const cards=[...entries.map(entry=>({id:entry.id,label:entry.label,entry})),{id:'typesafe',label:'TypeSafe / Jev',entry:undefined}];
 const activeRadio=(id:string,label:string,disabled:boolean)=><label className="bo-ai-radio"><input type="radio" name="bo-ai-active" checked={prefs.active===id} disabled={disabled||!!busy} onChange={()=>void savePrefs({...prefs,active:id})}/>{label}</label>;
 return <section ref={section} id="bo-ai" className="bo-ai-settings bo-panel" aria-label={tr('AI settings','Pengaturan AI')}>
  <div className="bo-panel-head"><div><Eyebrow>{tr('Owner only','Khusus pemilik')}</Eyebrow><h2>{tr('AI settings','Pengaturan AI')}</h2></div></div>
  <div className="bo-ai-intro">
   {settings&&<p className="bo-muted">{local?tr('Keys stay on this computer, encrypted. AIoT never receives them.','Key tetap di komputer ini, terenkripsi. AIoT tidak pernah menerimanya.'):tr("Cloud runs on AIoT's own keys, managed here by the owner. Bring-your-own-key is only in the desktop app, where keys stay on your computer.",'Cloud berjalan dengan key milik AIoT sendiri, dikelola di sini oleh pemilik. Bring-your-own-key hanya ada di aplikasi desktop, tempat key tetap di komputer Anda.')}</p>}
   <p className="bo-muted">{tr('Pick one provider for AI work. TypeSafe/Jev routing is optional. The connection test checks API access, not model entitlement.','Pilih satu provider untuk pekerjaan AI. Routing TypeSafe/Jev bersifat opsional. Uji koneksi memeriksa akses API, bukan hak akses model.')}</p>
   <Notice tone="info" title={tr('Keys are write-only','Key hanya bisa ditulis')}>{tr('Keys are stored encrypted and never shown again. Only a fingerprint and the last connection test are displayed; the field clears after each submit.','Key disimpan terenkripsi dan tidak ditampilkan kembali. Hanya fingerprint dan hasil uji koneksi terakhir yang terlihat; kolom dikosongkan setiap kali dikirim.')}</Notice>
  </div>
  <div className="bo-ai-forms">
   {settings&&cards.map(({id,label,entry})=>{
    const p=settings.providers[id];
    const test=p?.testStatus==='connected'?<Tag tone="ok">{tr('Connected','Koneksi berhasil')}</Tag>:p?.testStatus==='failed'?<Tag tone="error">{tr('Connection failed','Koneksi gagal')}</Tag>:<Tag>{tr('Not tested','Belum diuji')}</Tag>;
    const isCustom=id==='custom';
    return <form key={id} className="bo-ai-form" onSubmit={event=>{event.preventDefault();void action(id,'save');}}>
     <div className="bo-ai-form-head"><h3>{label}</h3>{prefs.active===id&&<Tag tone="inverse">{tr('Active','Aktif')}</Tag>}{p?.configured?test:<Tag>{tr('No key','Belum ada key')}</Tag>}</div>
     {p?.configured
      ?<dl className="bo-ai-meta"><div><dt>{tr('Stored','Tersimpan')}</dt><dd>{tr('Encrypted','Terenkripsi')}</dd></div><div><dt>Fingerprint</dt><dd><code className="bo-mono">{p.fingerprint}</code></dd></div>{p.testedAt&&<div><dt>{tr('Last test','Uji terakhir')}</dt><dd>{new Date(p.testedAt).toLocaleString(locale)}</dd></div>}</dl>
      :<p className="bo-muted">{tr('No dashboard key yet. Runtime configuration may still apply.','Belum ada key dashboard. Konfigurasi runtime dapat tetap berlaku.')}</p>}
     {isCustom&&<><Input id="bo-ai-url" label={tr('Base URL','Base URL')} hint={tr('https only; http for localhost. Local install only.','Hanya https; http untuk localhost. Hanya instalasi lokal.')} value={custom.url??prefs.customBaseUrl??''} onChange={event=>setCustom(values=>({...values,url:event.target.value}))} placeholder="https://api.example.com/v1" disabled={!!busy}/><Input id="bo-ai-custom-model" label={tr('Model','Model')} value={custom.model??prefs.models.custom??''} onChange={event=>setCustom(values=>({...values,model:event.target.value}))} placeholder="model-name" disabled={!!busy}/><div className="bo-ai-actions"><Button size="sm" variant="secondary" disabled={!!busy||!(custom.url??prefs.customBaseUrl)} onClick={()=>{const url=(custom.url??prefs.customBaseUrl??'').trim(),model=(custom.model??prefs.models.custom??'').trim();void savePrefs({...prefs,customBaseUrl:url,models:{...prefs.models,...(model?{custom:model}:{})}});}}>{tr('Save URL and model','Simpan URL dan model')}</Button></div></>}
     {entry&&entry.models.length>0&&<Select id={'bo-ai-model-'+id} label={tr('Model','Model')} value={prefs.models[id]??entry.models[0]} disabled={!!busy} onChange={event=>void savePrefs({...prefs,models:{...prefs.models,[id]:event.target.value}})}>{entry.models.map(model=><option key={model} value={model}>{model}</option>)}</Select>}
     {entry&&activeRadio(id,tr('Use for AI','Pakai untuk AI'),!p?.configured)}
     <Input id={'bo-ai-key-'+id} label={tr('New API key','API key baru')} hint={tr('Write-only. Replaces the stored key.','Hanya tulis. Menggantikan key tersimpan.')} type="password" autoComplete="off" spellCheck={false} value={keys[id]??''} onChange={event=>setKeys(values=>({...values,[id]:event.target.value}))} placeholder={tr('Enter API key','Masukkan API key')} disabled={!!busy}/>
     <div className="bo-ai-actions">
      <Button size="sm" disabled={!!busy||(keys[id]??'').trim().length<8} type="submit">{tr('Save','Simpan')}</Button>
      <Button size="sm" variant="secondary" disabled={!!busy||!p?.configured} onClick={()=>void action(id,'test')}>{tr('Test connection','Uji koneksi')}</Button>
      <Button size="sm" variant="ghost" disabled={!!busy||!p?.configured} onClick={()=>void action(id,'delete')}>{tr('Delete key','Hapus key')}</Button>
     </div>
    </form>;})}
  </div>
  {local&&cliEntries.length>0&&<fieldset className="bo-ai-cli"><legend>{tr('Signed in on this computer','Login di komputer ini')}</legend>{cliEntries.map(entry=><div key={entry.id}>{activeRadio(entry.id,tr(`Use ${entry.id==='codex-cli'?'Codex':'Claude Code'} signed in on this computer`,`Pakai ${entry.id==='codex-cli'?'Codex':'Claude Code'} yang login di komputer ini`),!entry.available)}{!entry.available&&<Tag>{tr('Not found','Tidak ditemukan')}</Tag>}</div>)}</fieldset>}
  <div className="bo-ai-result" aria-live="polite">{busy?<span className="bo-ai-busy"><Spinner label={tr('Processing','Memproses')}/>{tr('Processing…','Memproses…')}</span>:message&&<Notice tone={message.tone}>{message.text}</Notice>}</div>
 </section>;
}
