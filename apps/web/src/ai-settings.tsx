import {useEffect,useState,useRef} from 'react';
import {api,post} from './api';
import {useLang} from './i18n';
import {Button,Eyebrow,Input,Notice,Select,Spinner,Tag} from './ui';
import {PRO_DEFAULT_EFFORT,PRO_DEFAULT_MODEL,PRO_EFFORTS,PRO_MODELS} from '../../../packages/ai-providers/index';
import {DEFAULT_KILL_SWITCH} from '../../../packages/pro-contract/agent';
type Status={configured:boolean;fingerprint?:string;testStatus:string;testedAt?:string};
type Builder={model:string;effort:string;thinkingDisplay:string;killSwitch?:{enabled:boolean;monthlyUsd:number}};
type Prefs={active?:string;models:Record<string,string>;customBaseUrl?:string;builder?:Builder};
type Entry={id:string;label:string;protocol:string;models:string[];keyUrl?:string;scope:string;available?:boolean};
type Settings={envFallback?:{anthropic?:boolean};scope:string;deployment:'cloud'|'local';preferences:Prefs;registry:Entry[];providers:Record<string,Status>};
type Tone='info'|'ok'|'warn'|'error';
export function AiSettings(){
 const{tr,lang}=useLang();
 const section=useRef<HTMLElement>(null);
 useEffect(()=>{if(window.location.hash==='#bo-ai')section.current?.scrollIntoView();},[]);
 const [settings,setSettings]=useState<Settings>();const [keys,setKeys]=useState<Record<string,string>>({});const [busy,setBusy]=useState<string>();const [message,setMessage]=useState<{text:string;tone:Tone}>();const [custom,setCustom]=useState<{url?:string;model?:string}>({});const [cap,setCap]=useState<string>();
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
 const builder:Builder={model:PRO_DEFAULT_MODEL,effort:PRO_DEFAULT_EFFORT,thinkingDisplay:'summarized',...prefs.builder};
 const kill=builder.killSwitch??DEFAULT_KILL_SWITCH;
 const saveBuilder=(patch:Partial<Builder>)=>void savePrefs({...prefs,builder:{...builder,...patch}});
 const capValue=cap??String(kill.monthlyUsd);const capNumber=Number(capValue);const capValid=Number.isFinite(capNumber)&&capNumber>0&&capNumber<=1_000_000;
 const anthropicKey=settings?.providers?.anthropic;
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
  {settings&&<fieldset className="bo-ai-pro" aria-label={tr('Pro architect model','Model arsitek Pro')}>
   <legend>{tr('Pro architect (agent)','Arsitek Pro (agen)')}</legend>
   <p className="bo-muted">{tr('One global choice for every member. Thinking is adaptive and always streamed; Claude 5.5 does not accept a token budget, so depth is set by effort. No per-member quota yet: usage is recorded per member and project.','Satu pilihan global untuk semua anggota. Thinking bersifat adaptif dan selalu di-stream; Claude 5.5 tidak menerima budget token, jadi kedalaman diatur lewat effort. Belum ada kuota per anggota: pemakaian dicatat per anggota dan proyek.')}</p>
   <p>{anthropicKey?.configured?<Tag tone="ok">{tr('Anthropic key: vault (wins)','Key Anthropic: vault (diutamakan)')}</Tag>:settings.envFallback?.anthropic?<Tag tone="warn">{tr('Anthropic key: server environment fallback','Key Anthropic: fallback environment server')}</Tag>:<Tag tone="error">{tr('No Anthropic key. Pro cannot run.','Belum ada key Anthropic. Pro tidak bisa berjalan.')}</Tag>}</p>
   <Select id="bo-pro-model" label={tr('Model','Model')} value={builder.model} disabled={!!busy} onChange={event=>saveBuilder({model:event.target.value})}>{PRO_MODELS.map(model=><option key={model} value={model}>{model}</option>)}</Select>
   <Select id="bo-pro-effort" label={tr('Thinking effort','Effort thinking')} hint={tr('Higher thinks more and costs more. Changing it mid-project resets the prompt cache.','Lebih tinggi berpikir lebih banyak dan lebih mahal. Mengubahnya di tengah proyek mereset cache prompt.')} value={builder.effort} disabled={!!busy} onChange={event=>saveBuilder({effort:event.target.value})}>{PRO_EFFORTS.map(effort=><option key={effort} value={effort}>{effort}</option>)}</Select>
   <Select id="bo-pro-display" label={tr('Thinking text','Teks thinking')} value={builder.thinkingDisplay} disabled={!!busy} onChange={event=>saveBuilder({thinkingDisplay:event.target.value})}><option value="summarized">{tr('Summarized (shown, collapsible)','Ringkasan (ditampilkan, bisa dilipat)')}</option><option value="omitted">{tr('Hidden','Disembunyikan')}</option></Select>
   <label className="bo-ai-radio"><input type="checkbox" checked={kill.enabled} disabled={!!busy} onChange={event=>saveBuilder({killSwitch:{enabled:event.target.checked,monthlyUsd:capValid?capNumber:kill.monthlyUsd}})}/>{tr('Global monthly USD kill-switch','Kill-switch USD bulanan global')}</label>
   <Input id="bo-pro-cap" label={tr('Monthly cap (USD, all members)','Batas bulanan (USD, semua anggota)')} hint={tr('Safety stop, not a quota. Turns end when month-to-date spend reaches it.','Pengaman, bukan kuota. Giliran berhenti saat pengeluaran bulan berjalan mencapainya.')} type="number" min={1} max={1000000} value={capValue} disabled={!!busy||!kill.enabled} onChange={event=>setCap(event.target.value)}/>
   <div className="bo-ai-actions"><Button size="sm" variant="secondary" disabled={!!busy||!capValid||capNumber===kill.monthlyUsd} onClick={()=>{saveBuilder({killSwitch:{enabled:kill.enabled,monthlyUsd:capNumber}});setCap(undefined);}}>{tr('Save cap','Simpan batas')}</Button></div>
  </fieldset>}
  <div className="bo-ai-result" aria-live="polite">{busy?<span className="bo-ai-busy"><Spinner label={tr('Processing','Memproses')}/>{tr('Processing…','Memproses…')}</span>:message&&<Notice tone={message.tone}>{message.text}</Notice>}</div>
 </section>;
}
