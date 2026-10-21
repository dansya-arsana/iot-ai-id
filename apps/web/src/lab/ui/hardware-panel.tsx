import './hardware-panel.css';
import {useEffect,useMemo,useRef,useState} from 'react';
import {Link} from 'react-router-dom';
import {useLang} from '../../i18n';
import type {FirmwareVariant,ParamValues,PinSample} from '../contract';
import {HwError,compareSerial,hw,isLocalHost,simFlashBase64} from '../hw/client';
import type {HwBoard,HwErrorCode,HwLine} from '../hw/client';
import {fmtTime} from './chip-pill';
import {toLines} from './serial-monitor';
import type {SerialSeg} from './serial-monitor';

interface Props{variant:FirmwareVariant;params:ParamValues;segs:SerialSeg[];pins:Record<string,PinSample>|null}
type Phase='idle'|'uploading'|'live';

/** First digital pin (not the UART) that the sim is toggling: the best guess for "check wiring on D8". */
function activePin(pins:Record<string,PinSample>|null):string|undefined{
 if(!pins)return undefined;
 const out=Object.keys(pins).filter(p=>p!=='D0'&&p!=='D1'&&pins[p].mode==='output');
 return out.find(p=>pins[p].freqHz>0)??out[0];
}

export function HardwarePanel(props:Props){
 return isLocalHost()?<LocalPanel {...props}/>:<PublicNote/>;
}

function PublicNote(){
 const {tr}=useLang();
 return (
  <aside className="hw" data-testid="hw-public">
   <p className="hw-note">{tr('Plug in a real UNO? Use the desktop app.','Punya UNO asli? Pakai aplikasi desktop.')} <Link to="/partner">{tr('Get the desktop app','Dapatkan aplikasi desktop')}</Link></p>
  </aside>
 );
}

function LocalPanel({variant,params,segs,pins}:Props){
 const {tr}=useLang();
 const [boards,setBoards]=useState<HwBoard[]|null>(null);
 const [toolchain,setToolchain]=useState(true);
 const [trusted,setTrusted]=useState<Record<string,string>>({});
 const [phase,setPhase]=useState<Phase>('idle');
 const [err,setErr]=useState<HwErrorCode|null>(null);
 const [real,setReal]=useState<HwLine[]>([]);
 const [uploaded,setUploaded]=useState<{port:string;bytes:number}|null>(null);
 const since=useRef(0);
 const board=boards?.[0]??null;
 const isTrusted=!!board&&!!trusted[board.port];

 const live=useRef<{phase:Phase;port:string|null}>({phase:'idle',port:null});
 useEffect(()=>{live.current={phase,port:uploaded?.port??null};},[phase,uploaded]);
 useEffect(()=>{
  let gone=false;
  const tick=()=>{
   if(live.current.phase==='uploading')return;
   hw.detect().then(d=>{
    if(gone)return;
    setBoards(d.boards);setToolchain(d.toolchain);setTrusted(d.trusted);
    // The board disappearing while live is a disconnect, not a silent stall.
    if(live.current.phase==='live'&&!d.boards.some(b=>b.port===live.current.port)){setErr('disconnected');setPhase('idle');void hw.serialStop().catch(()=>undefined);}
   }).catch(()=>{if(!gone)setBoards(b=>b??[]);});
  };
  tick();
  const id=setInterval(tick,4000);
  return()=>{gone=true;clearInterval(id);};
 },[]);

 useEffect(()=>{
  if(phase!=='live')return;
  const id=setInterval(async()=>{
   try{
    const s=await hw.serial(since.current);
    if(s.lines.length){since.current=s.lines[s.lines.length-1].n;setReal(prev=>[...prev,...s.lines].slice(-200));}
    if(!s.open&&s.end){setErr(s.end.code==='busy'?'busy':s.end.code==='toolchain'?'toolchain':'disconnected');setPhase('idle');}
   }catch{/* next tick retries */}
  },700);
  return()=>clearInterval(id);
 },[phase]);
 useEffect(()=>()=>{void hw.serialStop().catch(()=>undefined);},[]);

 const fail=(e:unknown,fallback:HwErrorCode)=>{setErr(e instanceof HwError&&e.code!=='unknown'?e.code:fallback);};
 const authorize=async()=>{if(!board)return;setErr(null);try{const r=await hw.trust(board.port);setTrusted(t=>({...t,[board.port]:r.expiresAt}));}catch(e){fail(e,'no_board');}};
 const upload=async()=>{
  if(!board||!isTrusted)return;
  setErr(null);setPhase('uploading');setReal([]);since.current=0;
  try{
   const flash=simFlashBase64(variant,params);
   const r=await hw.upload(board.port,flash);
   setUploaded({port:board.port,bytes:r.bytes});
   await hw.serialStart(board.port);
   setPhase('live');
  }catch(e){fail(e,'upload_failed');setPhase('idle');}
 };

 const simLines=useMemo(()=>toLines(segs).filter(l=>!l.sys).map(l=>({t:l.t,text:l.text.replace(/\n$/,'')})),[segs]);
 const pin=activePin(pins);
 const match=useMemo(()=>compareSerial(simLines,real.map(l=>({t:l.t,text:l.text})),pin),[simLines,real,pin]);

 const message=(c:HwErrorCode)=>({
  toolchain:tr('Arduino toolchain not found. Install arduino-cli with the AVR core, then try again.','Toolchain Arduino tidak ditemukan. Pasang arduino-cli dengan core AVR, lalu coba lagi.'),
  busy:tr('The port is busy. Close the Arduino IDE or any serial monitor, then try again.','Port sedang dipakai. Tutup Arduino IDE atau serial monitor lain, lalu coba lagi.'),
  disconnected:tr('The board was unplugged. Plug it back in and detect again.','Papan terlepas. Colok lagi lalu deteksi ulang.'),
  upload_failed:tr('Upload failed. Check the cable and press reset, then try again.','Upload gagal. Periksa kabel dan tekan reset, lalu coba lagi.'),
  no_board:tr('No UNO found on that port.','Tidak ada UNO di port itu.'),
  consent_required:tr('Approve the upload in the AIoT desktop dialog. In a browser this needs the desktop app (or AIOT_LAB_DEV_CONSENT=1 for development).','Setujui upload di dialog aplikasi desktop AIoT. Di browser ini butuh aplikasi desktop (atau AIOT_LAB_DEV_CONSENT=1 untuk development).'),
  consent_denied:tr('Upload not approved. Click Allow in the dialog to continue.','Upload tidak disetujui. Klik Izinkan di dialog untuk lanjut.'),
  not_trusted:tr('Authorize this port first.','Otorisasi port ini dulu.'),
  bad_firmware:tr('This firmware does not fit the UNO.','Firmware ini tidak muat di UNO.'),
  unknown:tr('Something went wrong with the board.','Ada masalah dengan papan.'),
 }[c]);
 const matchText=match.state==='waiting'
  ?tr('Waiting for enough serial lines on both sides.','Menunggu cukup baris serial di kedua sisi.')
  :match.state==='same'?`${tr('Behaves the same','Berperilaku sama')}${match.detail.replace('behaves the same','')}`
  :match.detail.replace(/^differs: /,tr('Differs: ','Berbeda: ')).replace('check wiring',tr('check wiring','periksa kabel')).replace('the board prints different lines',tr('the board prints different lines','papan mencetak baris berbeda'));

 return (
  <section className="hw" data-testid="hw-panel">
   <div className="hw-head">{tr('Real board','Papan asli')}</div>
   {boards===null&&<p className="hw-note">{tr('Looking for a board…','Mencari papan…')}</p>}
   {boards!==null&&!toolchain&&err!=="toolchain"&&<p className="hw-err" data-testid="hw-error">{message('toolchain')}</p>}
   {boards!==null&&toolchain&&!board&&<p className="hw-note" data-testid="hw-none">{tr('No UNO detected. Plug one in with a USB cable.','UNO belum terdeteksi. Colok dengan kabel USB.')}</p>}
   {board&&<p className="hw-ok" data-testid="hw-detected">{tr('UNO on','UNO di')} {board.port} {tr('detected','terdeteksi')}{board.clone?` (${tr('clone','klon')})`:''}</p>}
   {board&&(
    <div className="hw-row">
     {!isTrusted&&<button type="button" className="hw-btn" data-testid="hw-authorize" onClick={authorize}>{tr('Authorize this port for 20 minutes','Otorisasi port ini selama 20 menit')}</button>}
     {isTrusted&&<span className="hw-note" data-testid="hw-trusted">{tr('Port authorized','Port diotorisasi')}</span>}
     <button type="button" className="hw-btn hw-btn--go" data-testid="hw-upload" disabled={!isTrusted||phase==='uploading'} onClick={upload}>{phase==='uploading'?tr('Uploading…','Mengunggah…'):tr('Upload this firmware to the board','Unggah firmware ini ke papan')}</button>
    </div>
   )}
   {err&&(toolchain||err==="toolchain")&&<p className="hw-err" role="alert" data-testid="hw-error">{message(err)}</p>}
   {uploaded&&phase==='live'&&<p className="hw-ok" data-testid="hw-uploaded">{tr('Uploaded','Terunggah')} {uploaded.bytes} {tr('bytes: the same bytes the simulator runs.','byte: sama persis dengan yang dijalankan simulator.')}</p>}
   {(phase==='live'||real.length>0)&&(
    <>
     <div className="hw-cols">
      <div className="hw-col"><h4>{tr('Simulator · 9600','Simulator · 9600')}</h4><div className="hw-log" data-testid="hw-sim-log">{simLines.slice(-30).map((l,i)=><div key={i}><time>{fmtTime(l.t)}</time>{l.text}</div>)}</div></div>
      <div className="hw-col"><h4>{tr('Board · 9600','Papan · 9600')}</h4><div className="hw-log" data-testid="hw-real-log">{real.slice(-30).map(l=><div key={l.n}><time>{fmtTime(l.t)}</time>{l.text}</div>)}</div></div>
     </div>
     <p className="hw-match" data-testid="hw-match" data-state={match.state}>{matchText}</p>
    </>
   )}
  </section>
 );
}
