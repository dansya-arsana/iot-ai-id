import {useEffect,useState,useRef} from 'react';
import {api,post} from './api';
type Provider='openai'|'typesafe';
type Settings={scope:string;providers:Record<Provider,{configured:boolean;fingerprint?:string;testStatus:string;testedAt?:string}>};
export function AiSettings(){
 const section=useRef<HTMLElement>(null);
 useEffect(()=>{if(window.location.hash==='#bo-ai')section.current?.scrollIntoView();},[]);
 const [settings,setSettings]=useState<Settings>();const [keys,setKeys]=useState({openai:'',typesafe:''});const [busy,setBusy]=useState<Provider>();const [message,setMessage]=useState('');
 useEffect(()=>{api<Settings>('/ai-settings').then(setSettings).catch(()=>setMessage('Pengaturan AI gagal dimuat.'));},[]);
 async function action(provider:Provider,operation:'save'|'test'|'delete'){
  setBusy(provider);setMessage('');const key=keys[provider];setKeys(values=>({...values,[provider]:''}));
  try{if(operation==='test'){const result=await post('/ai-settings/'+provider+'/test',{});setSettings(result.settings);setMessage(result.message);}else{setSettings(await api<Settings>('/ai-settings/'+provider,{method:operation==='save'?'PUT':'DELETE',...(operation==='save'?{body:JSON.stringify({key})}:{})}));setMessage(operation==='save'?'Key tersimpan terenkripsi. Uji koneksi untuk memeriksa akses.':'Key tersimpan dihapus. Konfigurasi runtime dapat tetap berlaku.');}}
  catch{setMessage('Pengaturan AI gagal. Periksa key dan coba lagi.');}finally{setBusy(undefined);}
 }
 return <section ref={section} id="bo-ai" className="bo-ai-settings bo-panel" aria-label="Pengaturan AI"><h2>Pengaturan AI</h2><p>Konfigurasi pemilik workspace. Cloud saat ini memakai satu akun owner bersama; belum ada BYOK terpisah per pengguna. Desktop memakai penyimpanan workspace lokal.</p><p>Gunakan API key OpenAI dan TypeSafe/Jev. Login ChatGPT belum tersedia. Uji OpenAI memeriksa koneksi API, belum akses inferensi GPT-6.1 Sol. Key tidak ditampilkan kembali.</p>
  {(['openai','typesafe'] as const).map(provider=><form key={provider} onSubmit={event=>{event.preventDefault();void action(provider,'save');}}><h3>{provider==='openai'?'OpenAI':'TypeSafe / Jev'}</h3><p>{settings?.providers[provider].configured?`Tersimpan · fingerprint ${settings.providers[provider].fingerprint} · ${settings.providers[provider].testStatus==='connected'?'koneksi berhasil':settings.providers[provider].testStatus==='failed'?'koneksi gagal':'belum diuji'}`:'Belum ada key dashboard. Konfigurasi runtime dapat tetap berlaku.'}</p><label>API key baru<input type="password" autoComplete="off" spellCheck={false} value={keys[provider]} onChange={event=>setKeys(values=>({...values,[provider]:event.target.value}))} placeholder="Masukkan API key" disabled={!!busy}/></label><div><button disabled={!!busy||keys[provider].trim().length<8} type="submit">Simpan</button><button disabled={!!busy||!settings?.providers[provider].configured} type="button" onClick={()=>void action(provider,'test')}>Uji koneksi</button><button disabled={!!busy||!settings?.providers[provider].configured} type="button" onClick={()=>void action(provider,'delete')}>Hapus key</button></div></form>)}
  <p role="status">{busy?'Memproses…':message}</p></section>;
}
