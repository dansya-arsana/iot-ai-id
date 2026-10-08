import {useEffect, useState, useCallback, useRef} from 'react';
import {Link} from 'react-router-dom';
import {CircuitryIcon, FlaskIcon, SealCheckIcon, WifiHighIcon, ArrowUpRightIcon} from '@phosphor-icons/react';
import {api} from './api';
import './backoffice.css';

const projectStatus: Record<string, string> = {planning:'Merencanakan', ready:'Siap', running:'Berjalan', clarification:'Perlu klarifikasi', invalid:'Kontrak tidak valid', error:'Galat', VERIFIED:'Terverifikasi fisik', SIMULATED_VERIFIED:'Latihan lolos', FAILED:'Gagal', ERROR:'Galat'};
const experimentStatus: Record<string, string> = {running:'Berjalan', VERIFIED:'Fisik terverifikasi', SIMULATED_VERIFIED:'Latihan lolos', FAILED:'Gagal', ERROR:'Galat'};
const monthNames = ['Jan','Feb','Mar','Apr','Mei','Jun','Jul','Agu','Sep','Okt','Nov','Des'];
const dayNames = ['Min','Sen','Sel','Rab','Kam','Jum','Sab'];

function shortGoal(goal: string) {return goal.length > 46 ? goal.slice(0, 46) + '…' : goal;}

function experimentBuckets(experiments: any[], span: 'week' | 'year' | 'quarter') {
  const now = new Date();
  const buckets: {label: string; from: Date; to: Date}[] = [];
  if (span === 'week') {for (let i = 6; i >= 0; i--) {const day = new Date(now); day.setUTCHours(0,0,0,0); day.setUTCDate(day.getUTCDate() - i);const to = new Date(day); to.setUTCDate(to.getUTCDate() + 1);buckets.push({label: dayNames[day.getUTCDay()], from: day, to});}}
  else if (span === 'quarter') {for (let i = 11; i >= 0; i--) {const to = new Date(now); to.setUTCHours(0,0,0,0); to.setUTCDate(to.getUTCDate() + 1 - i * 7);const from = new Date(to); from.setUTCDate(from.getUTCDate() - 7);buckets.push({label: i === 0 ? 'Minggu ini' : `${from.getUTCDate()} ${monthNames[from.getUTCMonth()]}`, from, to});}}
  else {for (let i = 11; i >= 0; i--) {const month = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - i, 1));const to = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - i + 1, 1));buckets.push({label: monthNames[month.getUTCMonth()], from: month, to});}}
  const counts = buckets.map(bucket => experiments.filter(e => {const t = new Date(e.date + 'T00:00:00Z'); return t >= bucket.from && t < bucket.to;}).reduce((sum, e) => sum + e.count, 0));
  return {buckets, counts, max: Math.max(1, ...counts)};
}

export function Backoffice() {
  const [hash,setHash]=useState(()=>window.location.hash);
  useEffect(()=>{const sync=()=>setHash(window.location.hash);window.addEventListener('hashchange',sync);window.addEventListener('popstate',sync);return()=>{window.removeEventListener('hashchange',sync);window.removeEventListener('popstate',sync);};},[]);
  const activeSection=['#bo-ringkasan','#bo-eksperimen','#bo-proyek','#bo-runtime'].includes(hash)?hash:'#bo-ringkasan';
  const [data, setData] = useState<any>();
  const [status, setStatus] = useState<any>();
  const [comparisons, setComparisons] = useState<any>();
  const [error, setError] = useState('');
  const [span, setSpan] = useState<'week' | 'quarter' | 'year'>('week');
  const [statusFilter, setStatusFilter] = useState('Semua status');
  const [query, setQuery] = useState('');
  const [chatProject, setChatProject] = useState('');
  const [runtimeError, setRuntimeError] = useState('');
  const requestGeneration = useRef({dashboard: 0, runtime: 0});
  const pending = useRef({dashboard: false, runtime: false});
  const load = useCallback((force = true) => {
    const refreshDashboard = force || !pending.current.dashboard;
    const refreshRuntime = force || !pending.current.runtime;
    const dashboardGeneration = refreshDashboard ? ++requestGeneration.current.dashboard : requestGeneration.current.dashboard;
    const runtimeGeneration = refreshRuntime ? ++requestGeneration.current.runtime : requestGeneration.current.runtime;
    if (refreshDashboard) pending.current.dashboard = true;
    if (refreshRuntime) pending.current.runtime = true;
    return Promise.allSettled([
      api('/comparisons').then(c => {if (c) setComparisons(c);}).catch(() => {}),
      refreshDashboard && api('/backoffice').then(b => {
        if (dashboardGeneration !== requestGeneration.current.dashboard) return;
        setData(b); setError('');
      }).catch(e => {
        if (dashboardGeneration === requestGeneration.current.dashboard) setError(e.message);
      }).finally(() => {
        if (dashboardGeneration === requestGeneration.current.dashboard) pending.current.dashboard = false;
      }),
      refreshRuntime && api('/status').then(s => {
        if (runtimeGeneration !== requestGeneration.current.runtime) return;
        setStatus(s); setRuntimeError('');
      }).catch(e => {
        if (runtimeGeneration === requestGeneration.current.runtime) setRuntimeError(e.message);
      }).finally(() => {
        if (runtimeGeneration === requestGeneration.current.runtime) pending.current.runtime = false;
      })
    ]);
  }, []);
  useEffect(() => {
    const generation = requestGeneration.current;
    void load();
    const timer = setInterval(() => void load(false), 5000);
    return () => {
      clearInterval(timer);
      ++generation.dashboard;
      ++generation.runtime;
    };
  }, [load]);
  if (!data) return <div className="backoffice"><main className="bo-empty">{error ? `Gagal memuat: ${error}` : 'Memuat data runtime lokal…'}{error && <button onClick={() => void load()}>Coba lagi</button>}<Link to="/">Kembali ke beranda</Link></main></div>;
  const counts = data.counts;
  const recent = data.recentExperiments;
  const {buckets, counts: bucketCounts, max} = experimentBuckets(data.experimentDaily ?? [], span);
  const learnCount = data.projects.filter((p: any) => p.entryPoint === 'learn').length;
  const visibleProjects = data.projects.filter((p: any) => (statusFilter === 'Semua status' || p.status === statusFilter) && [p.goal,p.title,p.id].some(value => String(value ?? '').toLowerCase().includes(query.toLowerCase())));
  const attentionProjects = data.projects.filter((p: any) => ['clarification','invalid','error','FAILED','ERROR'].includes(p.status));
  const devices = status?.runtime.devices.filter((d: any) => d.candidate) ?? [];
  const coordinator = data.coordinator;
  return <div className="backoffice">
    <header className="bo-header">
      <Link to="/" className="bo-brand">iot<span>.</span>ai<span>.</span>id <em>backoffice</em></Link>
      <nav aria-label="Navigasi backoffice">
        <a href="#bo-ringkasan" aria-current={activeSection === '#bo-ringkasan' ? 'location' : undefined}>Ringkasan</a>
        <a href="#bo-eksperimen" aria-current={activeSection === '#bo-eksperimen' ? 'location' : undefined}>Eksperimen</a>
        <a href="#bo-proyek" aria-current={activeSection === '#bo-proyek' ? 'location' : undefined}>Proyek</a>
        <a href="#bo-runtime" aria-current={activeSection === '#bo-runtime' ? 'location' : undefined}>Runtime</a>
      </nav>
      <label className="bo-search"><span className="sr-only">Cari proyek</span><input placeholder="Cari proyek, tujuan, ID…" value={query} onChange={e => setQuery(e.target.value)}/></label><span className="bo-header-note" title={data.generatedAt}>{counts.projects} proyek · data lokal</span>
    </header>
    <main>
      <div className="bo-title" id="bo-ringkasan"><span className="bo-eyebrow">Selamat datang di ruang kerja operator · {new Date().toLocaleDateString('id-ID',{day:'numeric',month:'long',year:'numeric'})}</span><h1>Dashboard</h1><p>Angka nyata dari SQLite runtime lokal. Tidak ada metrik rekaan. Diperbarui {new Date(data.generatedAt).toLocaleTimeString('id-ID')}.</p><button className="bo-refresh" onClick={() => void load()}>Perbarui data</button><Link className="bo-new-project" to="/build">+ Proyek baru</Link></div>
      {error && <div className="bo-warn" role="alert">Pembaruan dashboard gagal: {error}. Data terakhir tetap ditampilkan. <button onClick={() => void load()}>Coba lagi</button></div>}
      <section className="bo-grid" aria-label="Ringkasan operasional">
        <article className="bo-kpi bo-kpi-yellow"><span className="bo-kpi-icon"><CircuitryIcon size={20} weight="bold"/></span><h2>Total Proyek</h2><strong>{counts.projects}</strong><small>{learnCount} jalur belajar · {counts.projects - learnCount} jalur bangun</small></article>
        <article className="bo-kpi bo-kpi-dark"><span className="bo-kpi-icon"><FlaskIcon size={20} weight="bold"/></span><h2>Total Eksperimen</h2><strong>{counts.experiments}</strong><small>{recent.length ? `Terbaru: ${new Date(recent[0].createdAt).toLocaleDateString('id-ID')}` : 'Belum ada eksperimen'}</small></article>
        <article className="bo-kpi bo-kpi-dark"><span className="bo-kpi-icon"><SealCheckIcon size={20} weight="bold"/></span><h2>Verifikasi Fisik</h2><strong>{counts.physicalVerified}</strong><small>Latihan model lolos: {counts.simulatedVerified} (bukan bukti fisik)</small></article>
        <article className="bo-kpi bo-kpi-dark"><span className="bo-kpi-icon"><WifiHighIcon size={20} weight="bold"/></span><h2>Remote Jobs Aktif</h2><strong>{counts.activeRemoteJobs}</strong><small>{counts.awaitingApproval} menunggu izin lokal</small></article>
        <article className="bo-panel bo-activity">
          <h2>Perlu perhatian</h2>
          <p className="bo-panel-sub">Proyek yang membutuhkan tindak lanjut</p>
          {attentionProjects.slice(0, 5).map((p: any) => <div className="bo-activity-row" key={p.id}><Link to={'/project/' + p.id}>{shortGoal(p.title || p.goal)}</Link><b className="bo-badge warn">{projectStatus[p.status] ?? p.status}</b></div>)}
          {!attentionProjects.length && <p className="bo-attention-empty">Tidak ada proyek yang membutuhkan perhatian.</p>}
          {(data.activeJobs ?? []).filter((j: any) => j.status === 'awaiting_approval').map((j: any) => <div className="bo-activity-row" key={j.id}><Link to={'/project/' + j.input.projectId}>Job {j.id.slice(0,8)}</Link><b className="bo-badge warn">Menunggu izin</b></div>)}
          <p className="bo-panel-sub">{counts.awaitingApproval} job menunggu izin lokal. Persetujuan USB dilakukan di workspace.</p>
          <Link className="bo-panel-more" to="/build">Buka workspace <ArrowUpRightIcon size={13}/></Link>
        </article>
        <article className="bo-panel bo-chart" id="bo-eksperimen">
          <div className="bo-panel-head"><h2>Eksperimen</h2><div className="bo-toggle" role="group" aria-label="Rentang waktu"><button className={span === 'week' ? 'on' : ''} onClick={() => setSpan('week')}>Mingguan</button><button className={span === 'quarter' ? 'on' : ''} onClick={() => setSpan('quarter')}>12 minggu</button><button className={span === 'year' ? 'on' : ''} onClick={() => setSpan('year')}>Tahunan</button></div></div>
          <div className="bo-bars" role="img" aria-label={`Eksperimen per ${span === 'week' ? 'hari' : span === 'quarter' ? 'minggu' : 'bulan'}`}>
            {buckets.map((b, i) => <div className="bo-bar-col" key={b.label + i}><span className="bo-bar-count">{bucketCounts[i]}</span><div className="bo-bar" style={{height: `${bucketCounts[i] / max * 100}%`}}/><span className="bo-bar-label">{b.label}</span></div>)}
          </div>
          <p className="bo-panel-sub">Dihitung dari seluruh riwayat eksperimen. Kalender UTC; latihan model dan fisik dihitung sama.</p>
        </article>
        <article className="bo-panel bo-assistant">
          <span className="bo-assistant-mark">✳</span><h2>Lanjutkan bersama AI</h2>
          <p>Pilih proyek untuk membuka percakapan desain dan debugging di workspace.</p>
          <label htmlFor="bo-chat-project">Proyek</label><select id="bo-chat-project" value={chatProject} onChange={e => setChatProject(e.target.value)}><option value="">Pilih proyek</option>{data.projects.map((p: any) => <option key={p.id} value={p.id}>{p.title || p.goal}</option>)}</select>
          {chatProject ? <Link className="bo-chat-open" to={'/project/' + chatProject}>Buka percakapan <ArrowUpRightIcon size={16}/></Link> : <span className="bo-chat-disabled">Pilih proyek untuk melanjutkan</span>}
          <Link className="bo-panel-more" to="/build">Buat proyek baru <ArrowUpRightIcon size={13}/></Link>
        </article>
        <article className="bo-panel bo-recent"><h2>Aktivitas terkini</h2>{recent.slice(0, 5).map((e: any) => <div className="bo-activity-row" key={e.id}><Link to={'/project/' + e.projectId}>{shortGoal(e.title)}</Link><span>{e.mode === 'physical' ? 'Fisik' : 'Model'}</span><b className="bo-badge">{experimentStatus[e.status] ?? e.status}</b></div>)}{!recent.length && <p>Belum ada eksperimen.</p>}</article>
        <article className="bo-panel bo-projects" id="bo-proyek">
          <div className="bo-panel-head"><h2>Proyek</h2><label className="bo-filter"><span className="sr-only">Filter status</span><select value={statusFilter} onChange={e => setStatusFilter(e.target.value)}><option>Semua status</option>{Object.entries(projectStatus).map(([key, label]) => <option key={key} value={key}>{label} ({key})</option>)}</select></label></div>
          <div className="bo-table" role="table">
            <div className="bo-tr bo-th" role="row"><span role="columnheader">Tujuan</span><span role="columnheader">ID</span><span role="columnheader">Masuk</span><span role="columnheader">Kontrak</span><span role="columnheader">Eksperimen</span><span role="columnheader">Chat</span><span role="columnheader">Status</span></div>
            {visibleProjects.map((p: any) => <div className="bo-tr" role="row" key={p.id}><span role="cell"><Link to={'/project/' + p.id}>{shortGoal(p.goal)}</Link></span><span role="cell" className="bo-mono">{p.id.slice(0, 8)}</span><span role="cell">{p.entryPoint === 'learn' ? 'Belajar' : 'Bangun'}</span><span role="cell">{p.contractVersions}</span><span role="cell">{p.experimentCount}</span><span role="cell">{p.chatCount}</span><span role="cell"><b className={'bo-badge ' + (p.status === 'VERIFIED' || p.status === 'SIMULATED_VERIFIED' ? 'ok' : p.status === 'error' || p.status === 'FAILED' || p.status === 'ERROR' ? 'warn' : '')}>{projectStatus[p.status] ?? p.status}</b></span></div>)}
            {!visibleProjects.length && <div className="bo-tr" role="row"><span role="cell">Tidak ada proyek yang cocok dengan pencarian dan status</span><span role="cell">—</span><span role="cell">—</span><span role="cell">—</span><span role="cell">—</span><span role="cell">—</span><span role="cell">—</span></div>}
          </div>
        </article>
        <article className="bo-panel bo-compare" id="bo-compare">
          <div className="bo-panel-head"><h2>Agen vs Manusia</h2><span className="bo-panel-sub">Percobaan challenge per aktor</span></div>
          <div className="bo-table" role="table">
            <div className="bo-tr bo-th" role="row"><span role="columnheader">Challenge</span><span role="columnheader">Aktor</span><span role="columnheader">Eksperimen</span><span role="columnheader">Verifikasi</span><span role="columnheader">Skenario</span></div>
            {comparisons?.comparisons?.length ? comparisons.comparisons.flatMap((c: any) => c.attempts.slice(0, 4).map((a: any, i: number) =>
              <div className="bo-tr" role="row" key={c.challenge + a.projectId}>
                <span role="cell">{i === 0 ? `${c.challenge} v${c.version}` : ''}</span>
                <span role="cell"><b className={'bo-badge ' + (a.actor === 'agent' ? 'warn' : '')}>{a.actor === 'agent' ? 'Agen' : 'Manusia'}</b></span>
                <span role="cell">{a.latestExperiment ?? '—'}</span>
                <span role="cell">{a.verification ?? '—'}</span>
                <span role="cell">{a.scenarios.filter((v: any) => v.status === 'pass').length}/{a.scenarios.length} lolos</span>
              </div>)) : <div className="bo-tr" role="row"><span role="cell">Belum ada percobaan challenge</span><span role="cell">—</span><span role="cell">—</span><span role="cell">—</span><span role="cell">—</span></div>}
          </div>
          <p className="bo-panel-sub">Aktornya berbeda, judge-nya sama: setiap skenario dinilai dari bukti tersimpan, bukan klaim.</p>
        </article>
        <article className="bo-panel bo-health" id="bo-runtime">
          <h2>Runtime lokal</h2>{runtimeError && <p className="bo-warn" role="alert">Pembaruan runtime gagal: {runtimeError}. <button onClick={() => void load()}>Coba lagi</button></p>}
          <div className="bo-stat"><span>Toolchain Arduino</span><strong>{status ? status.runtime.toolchain ? 'Siap' : 'Belum siap' : '…'}</strong></div>
          <div className="bo-stat"><span>Perangkat USB kandidat</span><strong>{status ? devices.length : '…'}</strong></div>
          <div className="bo-stat"><span>Simulator template</span><strong>{status?.simulators?.[0]?.available ? 'Tersedia' : 'Tidak'}</strong></div>
          <div className="bo-stat"><span>Wokwi CLI</span><strong>{!status ? '…' : !status.simulators?.[1]?.available ? 'Tidak tersedia' : status.simulators?.[1]?.supported ? 'Resep didukung' : 'Resep tidak didukung'}</strong></div>
          {status?.simulators?.[1]?.reason && <p className="bo-panel-sub">{status.simulators[1].reason}</p>}<div className="bo-stat"><span>Endpoint OpenViking</span><strong className="bo-mono bo-small">{data.knowledge.url}</strong></div>
          <div className="bo-stat"><span>Koordinator</span><strong>{coordinator.status === 'online' ? 'Online' : coordinator.status === 'unconfigured' ? 'Belum dikonfigurasi' : 'Tak terjangkau'}</strong></div>
          {coordinator.status === 'online' && <><div className="bo-stat"><span>Proyek tersinkron</span><strong>{coordinator.projects.length}</strong></div><div className="bo-stat"><span>Job dalam antrean</span><strong>{coordinator.jobs.length}</strong></div></>}
          {coordinator.status === 'unreachable' && <p className="bo-warn" role="alert">Koordinator tidak merespons: {coordinator.error}</p>}
        </article>
      </section>
      <p className="bo-foot">Backoffice operator lokal. Angka dihitung dari artefak SQLite yang sama dengan workspace; verifikasi fisik hanya dihitung dari bukti fisik.</p>
    </main>
  </div>;
}
