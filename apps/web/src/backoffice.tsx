import {AiSettings} from './ai-settings';
import {BusinessOps,opsSections} from './backoffice-ops';
import {useEffect, useState, useCallback, useRef, type ReactNode} from 'react';
import {Link} from 'react-router-dom';
import {ArrowClockwiseIcon, ArrowUpRightIcon, PlusIcon} from '@phosphor-icons/react';
import {api} from './api';
import {isAdminHost,PUBLIC_SITE} from './host';
import {useLang} from './i18n';
import {Brand} from './site-shell';
import {Button, EmptyState, Eyebrow, Input, LangToggle, LinkButton, Notice, Segmented, Select, SpecList, Spinner, Stat, StatGrid, Tag, TextLink} from './ui';
import './backoffice.css';

type Pair = [en: string, id: string];
const projectStatus: Record<string, Pair> = {planning:['Planning','Merencanakan'], ready:['Ready','Siap'], running:['Running','Berjalan'], clarification:['Needs clarification','Perlu klarifikasi'], invalid:['Invalid contract','Kontrak tidak valid'], error:['Error','Galat'], VERIFIED:['Physically verified','Terverifikasi fisik'], SIMULATED_VERIFIED:['Model run passed','Latihan lolos'], FAILED:['Failed','Gagal'], ERROR:['Error','Galat']};
const experimentStatus: Record<string, Pair> = {running:['Running','Berjalan'], VERIFIED:['Physically verified','Fisik terverifikasi'], SIMULATED_VERIFIED:['Model run passed','Latihan lolos'], FAILED:['Failed','Gagal'], ERROR:['Error','Galat']};
const monthNames: Record<'en' | 'id', string[]> = {en:['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'], id:['Jan','Feb','Mar','Apr','Mei','Jun','Jul','Agu','Sep','Okt','Nov','Des']};
const dayNames: Record<'en' | 'id', string[]> = {en:['Sun','Mon','Tue','Wed','Thu','Fri','Sat'], id:['Min','Sen','Sel','Rab','Kam','Jum','Sab']};
const ALL_STATUSES = 'Semua status';
const sections: {hash: string; en: string; id: string}[] = [
  {hash:'#bo-ringkasan', en:'Overview', id:'Ringkasan'},
  ...opsSections,
  {hash:'#bo-eksperimen', en:'Experiments', id:'Eksperimen'},
  {hash:'#bo-proyek', en:'Projects', id:'Proyek'},
  {hash:'#bo-runtime', en:'Runtime', id:'Runtime'},
  {hash:'#bo-ai', en:'AI keys', id:'AI keys'},
];

function shortGoal(goal: string) {return goal.length > 46 ? goal.slice(0, 46) + '…' : goal;}
function statusTone(status: string): 'ok' | 'warn' | 'error' | 'neutral' {
  if (status === 'VERIFIED' || status === 'SIMULATED_VERIFIED') return 'ok';
  if (status === 'error' || status === 'FAILED' || status === 'ERROR') return 'error';
  if (status === 'clarification' || status === 'invalid') return 'warn';
  return 'neutral';
}

function experimentBuckets(experiments: any[], span: 'week' | 'year' | 'quarter', lang: 'en' | 'id') {
  const now = new Date();
  const months = monthNames[lang];
  const buckets: {label: string; from: Date; to: Date}[] = [];
  if (span === 'week') {for (let i = 6; i >= 0; i--) {const day = new Date(now); day.setUTCHours(0,0,0,0); day.setUTCDate(day.getUTCDate() - i);const to = new Date(day); to.setUTCDate(to.getUTCDate() + 1);buckets.push({label: dayNames[lang][day.getUTCDay()], from: day, to});}}
  else if (span === 'quarter') {for (let i = 11; i >= 0; i--) {const to = new Date(now); to.setUTCHours(0,0,0,0); to.setUTCDate(to.getUTCDate() + 1 - i * 7);const from = new Date(to); from.setUTCDate(from.getUTCDate() - 7);buckets.push({label: i === 0 ? (lang === 'id' ? 'Minggu ini' : 'This week') : `${from.getUTCDate()} ${months[from.getUTCMonth()]}`, from, to});}}
  else {for (let i = 11; i >= 0; i--) {const month = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - i, 1));const to = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - i + 1, 1));buckets.push({label: months[month.getUTCMonth()], from: month, to});}}
  const counts = buckets.map(bucket => experiments.filter(e => {const t = new Date(e.date + 'T00:00:00Z'); return t >= bucket.from && t < bucket.to;}).reduce((sum, e) => sum + e.count, 0));
  return {buckets, counts, max: Math.max(1, ...counts)};
}

function Panel({id, className, eyebrow, title, aside, children}: {id?: string; className?: string; eyebrow?: ReactNode; title: ReactNode; aside?: ReactNode; children: ReactNode}) {
  return <section id={id} className={'bo-panel' + (className ? ' ' + className : '')}>
    <div className="bo-panel-head"><div>{eyebrow && <Eyebrow>{eyebrow}</Eyebrow>}<h2>{title}</h2></div>{aside && <div className="bo-panel-aside">{aside}</div>}</div>
    {children}
  </section>;
}

export function Backoffice() {
  const {tr, lang} = useLang();
  const locale = lang === 'id' ? 'id-ID' : 'en-GB';
  const [hash,setHash]=useState(()=>window.location.hash);
  useEffect(()=>{const sync=()=>setHash(window.location.hash);window.addEventListener('hashchange',sync);window.addEventListener('popstate',sync);return()=>{window.removeEventListener('hashchange',sync);window.removeEventListener('popstate',sync);};},[]);
  const activeSection=['#bo-ringkasan','#bo-eksperimen','#bo-proyek','#bo-runtime','#bo-ai'].includes(hash)?hash:'#bo-ringkasan';
  const [data, setData] = useState<any>();
  const [status, setStatus] = useState<any>();
  const [comparisons, setComparisons] = useState<any>();
  const [error, setError] = useState('');
  const [span, setSpan] = useState<'week' | 'quarter' | 'year'>('week');
  const [statusFilter, setStatusFilter] = useState(ALL_STATUSES);
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

  const label = (map: Record<string, Pair>, key: string) => map[key] ? tr(map[key][0], map[key][1]) : key;
  const topbar = (actions?: ReactNode) => <header className="bo-topbar">
    <div className="bo-topbar-brand"><Brand/><Eyebrow as="span" className="bo-topbar-label">{tr('Backoffice','Backoffice')}</Eyebrow></div>
    <div className="bo-topbar-actions"><LangToggle/>{actions}</div>
  </header>;

  if (!data) return <div className="bo-app">
    {topbar()}
    <main className="bo-empty">
      {error
        ? <EmptyState eyebrow={tr('Backoffice unavailable','Backoffice tidak tersedia')} title={tr('Could not load the dashboard','Dashboard gagal dimuat')} action={<><Button onClick={() => void load()}>{tr('Retry','Coba lagi')}</Button><LinkButton to="/" variant="secondary">{tr('Back to home','Kembali ke beranda')}</LinkButton></>}>
            {tr('The local runtime did not respond or this session is not the workspace owner.','Runtime lokal tidak merespons atau sesi ini bukan pemilik workspace.')} <code className="bo-mono">{error}</code>
          </EmptyState>
        : <div className="bo-loading"><Spinner label={tr('Loading','Memuat')}/><p>{tr('Loading local runtime data…','Memuat data runtime lokal…')}</p>{isAdminHost()?<a className="ds-text-link" href={PUBLIC_SITE}>{tr('Back to home','Kembali ke beranda')}</a>:<TextLink to="/">{tr('Back to home','Kembali ke beranda')}</TextLink>}</div>}
    </main>
  </div>;

  const counts = data.counts;
  const recent = data.recentExperiments;
  const {buckets, counts: bucketCounts, max} = experimentBuckets(data.experimentDaily ?? [], span, lang);
  const learnCount = data.projects.filter((p: any) => p.entryPoint === 'learn').length;
  const visibleProjects = data.projects.filter((p: any) => (statusFilter === ALL_STATUSES || p.status === statusFilter) && [p.goal,p.title,p.id].some(value => String(value ?? '').toLowerCase().includes(query.toLowerCase())));
  const attentionProjects = data.projects.filter((p: any) => ['clarification','invalid','error','FAILED','ERROR'].includes(p.status));
  const awaitingJobs = (data.activeJobs ?? []).filter((j: any) => j.status === 'awaiting_approval');
  const devices = status?.runtime.devices.filter((d: any) => d.candidate) ?? [];
  const coordinator = data.coordinator;
  const retry = <Button size="sm" variant="secondary" onClick={() => void load()}>{tr('Retry','Coba lagi')}</Button>;
  const wokwi = !status ? '…' : !status.simulators?.[1]?.available ? tr('Not available','Tidak tersedia') : status.simulators?.[1]?.supported ? tr('Recipe supported','Resep didukung') : tr('Recipe not supported','Resep tidak didukung');
  const coordinatorLabel = coordinator.status === 'online' ? 'Online' : coordinator.status === 'unconfigured' ? tr('Not configured','Belum dikonfigurasi') : tr('Unreachable','Tak terjangkau');
  const runtimeRows: [ReactNode, ReactNode][] = [
    [tr('Arduino toolchain','Toolchain Arduino'), status ? status.runtime.toolchain ? <Tag tone="ok">{tr('Ready','Siap')}</Tag> : <Tag tone="warn">{tr('Not ready','Belum siap')}</Tag> : '…'],
    [tr('Candidate USB devices','Perangkat USB kandidat'), status ? devices.length : '…'],
    [tr('Template simulator','Simulator template'), status?.simulators?.[0]?.available ? tr('Available','Tersedia') : tr('No','Tidak')],
    ['Wokwi CLI', <>{wokwi}{status?.simulators?.[1]?.reason && <small className="bo-cell-note">{status.simulators[1].reason}</small>}</>],
    [tr('OpenViking endpoint','Endpoint OpenViking'), <code className="bo-mono">{data.knowledge.url}</code>],
    [tr('Coordinator','Koordinator'), <Tag tone={coordinator.status === 'online' ? 'ok' : coordinator.status === 'unconfigured' ? 'neutral' : 'error'}>{coordinatorLabel}</Tag>],
    ...(coordinator.status === 'online' ? [[tr('Synced projects','Proyek tersinkron'), coordinator.projects.length], [tr('Queued jobs','Job dalam antrean'), coordinator.jobs.length]] as [ReactNode, ReactNode][] : []),
  ];

  return <div className="bo-app">
    {topbar(<>
      <span className="bo-topbar-note" title={data.generatedAt}>{tr(`${counts.projects} projects · local data`,`${counts.projects} proyek · data lokal`)}</span>
      <Button size="sm" variant="secondary" onClick={() => void load()}><ArrowClockwiseIcon size={14} weight="bold" aria-hidden="true"/>{tr('Refresh data','Perbarui data')}</Button>
      <LinkButton size="sm" to="/build"><PlusIcon size={14} weight="bold" aria-hidden="true"/>{tr('New project','Proyek baru')}</LinkButton>
    </>)}
    <div className="bo-layout">
      <aside className="bo-sidebar">
        <Eyebrow className="bo-sidebar-label">{tr('Workspace','Ruang kerja')}</Eyebrow>
        <nav aria-label={tr('Backoffice navigation','Navigasi backoffice')}>
          {sections.map(s => <a key={s.hash} href={s.hash} aria-current={activeSection === s.hash ? 'location' : undefined}>{tr(s.en, s.id)}</a>)}
        </nav>
        <Eyebrow className="bo-sidebar-label">{tr('Site','Situs')}</Eyebrow>
        <nav aria-label={tr('Site links','Tautan situs')} className="bo-sidebar-secondary">
          <Link to="/build">{tr('Workspace','Workspace')}</Link>
          {isAdminHost()?<a href={PUBLIC_SITE}>{tr('Public site','Situs publik')}</a>:<Link to="/">{tr('Home','Beranda')}</Link>}
        </nav>
      </aside>
      <main className="bo-main">
        <header className="bo-title" id="bo-ringkasan">
          <Eyebrow as="span">{tr('Operator workspace','Ruang kerja operator')} · {new Date().toLocaleDateString(locale,{day:'numeric',month:'long',year:'numeric'})}</Eyebrow>
          <h1>{tr('Dashboard','Dashboard')}</h1>
          <p>{tr(`Real numbers from the local SQLite runtime. No made-up metrics. Updated ${new Date(data.generatedAt).toLocaleTimeString(locale)}.`,`Angka nyata dari SQLite runtime lokal. Tidak ada metrik rekaan. Diperbarui ${new Date(data.generatedAt).toLocaleTimeString(locale)}.`)}</p>
        </header>
        {error && <Notice tone="error" title={tr('Dashboard refresh failed','Pembaruan dashboard gagal')} action={retry}>{tr(`${error}. The last loaded data is still shown.`,`${error}. Data terakhir tetap ditampilkan.`)}</Notice>}
        <section className="bo-kpis" aria-label={tr('Operational overview','Ringkasan operasional')}>
          <StatGrid>
            <Stat className="bo-kpi bo-kpi-projects" label={<>{tr('Total projects','Total proyek')}<small>{tr(`${learnCount} learn · ${counts.projects - learnCount} build`,`${learnCount} jalur belajar · ${counts.projects - learnCount} jalur bangun`)}</small></>} value={counts.projects}/>
            <Stat className="bo-kpi bo-kpi-experiments" label={<>{tr('Total experiments','Total eksperimen')}<small>{recent.length ? tr(`Latest: ${new Date(recent[0].createdAt).toLocaleDateString(locale)}`,`Terbaru: ${new Date(recent[0].createdAt).toLocaleDateString(locale)}`) : tr('No experiments yet','Belum ada eksperimen')}</small></>} value={counts.experiments}/>
            <Stat className="bo-kpi bo-kpi-physical" label={<>{tr('Physical verification','Verifikasi fisik')}<small>{tr(`Model runs passed: ${counts.simulatedVerified} (not physical proof)`,`Latihan model lolos: ${counts.simulatedVerified} (bukan bukti fisik)`)}</small></>} value={counts.physicalVerified}/>
            <Stat className="bo-kpi bo-kpi-jobs" label={<>{tr('Active remote jobs','Remote job aktif')}<small>{tr(`${counts.awaitingApproval} awaiting local approval`,`${counts.awaitingApproval} menunggu izin lokal`)}</small></>} value={counts.activeRemoteJobs}/>
          </StatGrid>
        </section>

        <div className="bo-grid">
          <Panel className="bo-activity" eyebrow={tr('Follow-up','Tindak lanjut')} title={tr('Needs attention','Perlu perhatian')}>
            <ul className="bo-rows">
              {attentionProjects.slice(0, 5).map((p: any) => <li key={p.id}><Link to={'/project/' + p.id}>{shortGoal(p.title || p.goal)}</Link><Tag tone={statusTone(p.status)}>{label(projectStatus, p.status)}</Tag></li>)}
              {awaitingJobs.map((j: any) => <li key={j.id}><Link to={'/project/' + j.input.projectId}>Job <span className="bo-mono">{j.id.slice(0,8)}</span></Link><Tag tone="warn">{tr('Awaiting approval','Menunggu izin')}</Tag></li>)}
            </ul>
            {!attentionProjects.length && !awaitingJobs.length && <p className="bo-muted">{tr('No projects need attention.','Tidak ada proyek yang membutuhkan perhatian.')}</p>}
            <p className="bo-muted">{tr(`${counts.awaitingApproval} jobs awaiting local approval. USB approval happens in the workspace.`,`${counts.awaitingApproval} job menunggu izin lokal. Persetujuan USB dilakukan di workspace.`)}</p>
            <TextLink to="/build">{tr('Open workspace','Buka workspace')} <ArrowUpRightIcon size={13} aria-hidden="true"/></TextLink>
          </Panel>

          <Panel id="bo-eksperimen" className="bo-chart" eyebrow={tr('Activity','Aktivitas')} title={tr('Experiments','Eksperimen')} aside={<Segmented<'week' | 'quarter' | 'year'> size="sm" label={tr('Time range','Rentang waktu')} value={span} onChange={setSpan} options={[{value:'week',label:tr('Weekly','Mingguan')},{value:'quarter',label:tr('12 weeks','12 minggu')},{value:'year',label:tr('Yearly','Tahunan')}]}/>}>
            <div className="bo-bars" role="img" aria-label={tr(`Experiments per ${span === 'week' ? 'day' : span === 'quarter' ? 'week' : 'month'}`,`Eksperimen per ${span === 'week' ? 'hari' : span === 'quarter' ? 'minggu' : 'bulan'}`)}>
              {buckets.map((b, i) => <div className="bo-bar-col" key={b.label + i}><span className="bo-bar-count">{bucketCounts[i]}</span><div className="bo-bar-track"><div className="bo-bar" style={{height: `${bucketCounts[i] / max * 100}%`}}/></div><span className="bo-bar-label">{b.label}</span></div>)}
            </div>
            <p className="bo-muted">{tr('Counted from the full experiment history. UTC calendar; model and physical runs count the same.','Dihitung dari seluruh riwayat eksperimen. Kalender UTC; latihan model dan fisik dihitung sama.')}</p>
          </Panel>

          <Panel className="bo-assistant" eyebrow={tr('Assistant','Asisten')} title={tr('Continue with AI','Lanjutkan bersama AI')}>
            <p className="bo-muted">{tr('Pick a project to open its design and debugging conversation in the workspace.','Pilih proyek untuk membuka percakapan desain dan debugging di workspace.')}</p>
            <Select id="bo-chat-project" label={tr('Project','Proyek')} value={chatProject} onChange={e => setChatProject(e.target.value)}><option value="">{tr('Choose a project','Pilih proyek')}</option>{data.projects.map((p: any) => <option key={p.id} value={p.id}>{p.title || p.goal}</option>)}</Select>
            <div className="bo-assistant-actions">
              {chatProject ? <LinkButton to={'/project/' + chatProject}>{tr('Open conversation','Buka percakapan')} <ArrowUpRightIcon size={14} aria-hidden="true"/></LinkButton> : <span className="bo-muted">{tr('Choose a project to continue','Pilih proyek untuk melanjutkan')}</span>}
              <TextLink to="/build">{tr('Create a new project','Buat proyek baru')}</TextLink>
            </div>
          </Panel>

          <Panel className="bo-recent" eyebrow={tr('Latest','Terbaru')} title={tr('Recent activity','Aktivitas terkini')}>
            <ul className="bo-rows">
              {recent.slice(0, 5).map((e: any) => <li key={e.id}><Link to={'/project/' + e.projectId}>{shortGoal(e.title)}</Link><span className="bo-row-meta">{e.mode === 'physical' ? tr('Physical','Fisik') : tr('Model','Model')}</span><Tag tone={statusTone(e.status)}>{label(experimentStatus, e.status)}</Tag></li>)}
            </ul>
            {!recent.length && <p className="bo-muted">{tr('No experiments yet.','Belum ada eksperimen.')}</p>}
          </Panel>

          <Panel id="bo-proyek" className="bo-projects bo-wide" eyebrow={tr('Inventory','Inventaris')} title={tr('Projects','Proyek')} aside={<div className="bo-filters">
            <Input id="bo-search" hideLabel label={tr('Search projects','Cari proyek')} placeholder={tr('Search project, goal, ID…','Cari proyek, tujuan, ID…')} value={query} onChange={e => setQuery(e.target.value)}/>
            <Select id="bo-status-filter" hideLabel label="Filter status" value={statusFilter} onChange={e => setStatusFilter(e.target.value)}><option value={ALL_STATUSES}>{tr('All statuses','Semua status')}</option>{Object.keys(projectStatus).map(key => <option key={key} value={key}>{label(projectStatus, key)} ({key})</option>)}</Select>
          </div>}>
            <div className="bo-table bo-table-projects" role="table">
              <div className="bo-tr bo-th" role="row"><span role="columnheader">{tr('Goal','Tujuan')}</span><span role="columnheader">ID</span><span role="columnheader">{tr('Entry','Masuk')}</span><span role="columnheader">{tr('Contracts','Kontrak')}</span><span role="columnheader">{tr('Experiments','Eksperimen')}</span><span role="columnheader">Chat</span><span role="columnheader">Status</span></div>
              {visibleProjects.map((p: any) => <div className="bo-tr" role="row" key={p.id}><span role="cell" className="bo-cell-main"><Link to={'/project/' + p.id}>{shortGoal(p.goal)}</Link></span><span role="cell" className="bo-mono" data-label="ID">{p.id.slice(0, 8)}</span><span role="cell" data-label={tr('Entry','Masuk')}>{p.entryPoint === 'learn' ? tr('Learn','Belajar') : tr('Build','Bangun')}</span><span role="cell" data-label={tr('Contracts','Kontrak')}>{p.contractVersions}</span><span role="cell" data-label={tr('Experiments','Eksperimen')}>{p.experimentCount}</span><span role="cell" data-label="Chat">{p.chatCount}</span><span role="cell" data-label="Status"><Tag tone={statusTone(p.status)}>{label(projectStatus, p.status)}</Tag></span></div>)}
              {!visibleProjects.length && <div className="bo-tr bo-tr-empty" role="row"><span role="cell">{tr('No projects match the search and status','Tidak ada proyek yang cocok dengan pencarian dan status')}</span><span role="cell">—</span><span role="cell">—</span><span role="cell">—</span><span role="cell">—</span><span role="cell">—</span><span role="cell">—</span></div>}
            </div>
          </Panel>

          <Panel id="bo-compare" className="bo-compare bo-wide" eyebrow={tr('Challenge attempts per actor','Percobaan challenge per aktor')} title={tr('Agent vs human','Agen vs Manusia')}>
            <div className="bo-table bo-table-compare" role="table">
              <div className="bo-tr bo-th" role="row"><span role="columnheader">Challenge</span><span role="columnheader">{tr('Actor','Aktor')}</span><span role="columnheader">{tr('Experiment','Eksperimen')}</span><span role="columnheader">{tr('Verification','Verifikasi')}</span><span role="columnheader">{tr('Scenarios','Skenario')}</span></div>
              {comparisons?.comparisons?.length ? comparisons.comparisons.flatMap((c: any) => c.attempts.slice(0, 4).map((a: any, i: number) =>
                <div className="bo-tr" role="row" key={c.challenge + a.projectId}>
                  <span role="cell" className="bo-cell-main">{i === 0 ? `${c.challenge} v${c.version}` : ''}</span>
                  <span role="cell" data-label={tr('Actor','Aktor')}><Tag tone={a.actor === 'agent' ? 'inverse' : 'neutral'}>{a.actor === 'agent' ? tr('Agent','Agen') : tr('Human','Manusia')}</Tag></span>
                  <span role="cell" className="bo-mono" data-label={tr('Experiment','Eksperimen')}>{a.latestExperiment ?? '—'}</span>
                  <span role="cell" data-label={tr('Verification','Verifikasi')}>{a.verification ?? '—'}</span>
                  <span role="cell" data-label={tr('Scenarios','Skenario')}>{tr(`${a.scenarios.filter((v: any) => v.status === 'pass').length}/${a.scenarios.length} passed`,`${a.scenarios.filter((v: any) => v.status === 'pass').length}/${a.scenarios.length} lolos`)}</span>
                </div>)) : <div className="bo-tr bo-tr-empty" role="row"><span role="cell">{tr('No challenge attempts yet','Belum ada percobaan challenge')}</span><span role="cell">—</span><span role="cell">—</span><span role="cell">—</span><span role="cell">—</span></div>}
            </div>
            <p className="bo-muted">{tr('Different actors, same judge: every scenario is scored from stored evidence, not claims.','Aktornya berbeda, judge-nya sama: setiap skenario dinilai dari bukti tersimpan, bukan klaim.')}</p>
          </Panel>

          <Panel id="bo-runtime" className="bo-health bo-wide" eyebrow={tr('Local machine','Mesin lokal')} title={tr('Local runtime','Runtime lokal')}>
            {runtimeError && <Notice tone="error" title={tr('Runtime refresh failed','Pembaruan runtime gagal')} action={retry}>{runtimeError}</Notice>}
            <SpecList className="bo-spec" rows={runtimeRows}/>
            {coordinator.status === 'unreachable' && <Notice tone="error" title={tr('Coordinator is not responding','Koordinator tidak merespons')}>{coordinator.error}</Notice>}
          </Panel>
        </div>
        <BusinessOps/>
        <AiSettings/>
        <p className="bo-foot">{tr('Local operator backoffice. Numbers come from the same SQLite artefacts as the workspace; physical verification counts physical evidence only.','Backoffice operator lokal. Angka dihitung dari artefak SQLite yang sama dengan workspace; verifikasi fisik hanya dihitung dari bukti fisik.')}</p>
      </main>
    </div>
  </div>;
}
