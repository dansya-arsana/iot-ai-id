import {useEffect, useState, type FormEvent, type ReactNode} from 'react';
import {useNavigate, useParams} from 'react-router-dom';
import {ArrowUpRightIcon, ArrowLeftIcon, DownloadSimpleIcon} from '@phosphor-icons/react';
import {api, post} from './api';
import {BuildProgressionGuide} from './build-progression-guide';
import {useLang} from './i18n';
import {Button, Card, CodeBlock, Eyebrow, Input, Notice, SectionHeader, Select, SpecList, Tag, Textarea, TextLink} from './ui';
import type {assembleEpisode} from '../../../packages/episodes/index';
import type {SimulatorCapabilities} from '../../../packages/simulator-client/index';

type Episode = ReturnType<typeof assembleEpisode>;
const lessonGoal = 'Build an ESP32 room monitor with temperature/humidity and an OLED.';
const actions = ['accepted_plan', 'inspected_wiring', 'reported_edit', 'performed_repair', 'observed_display', 'note'];
const quantities = ['temperature', 'humidity', 'supply_voltage', 'reboot_cycles', 'other'];
const readable = (value: string) => value.replaceAll('_', ' ').replaceAll('.', ' / ');
const pad = (n: number) => String(n).padStart(2, '0');

/** Numbered procedure: mono index, optional title, body, hairline separators. */
export function Steps({items, className}: {items: {title?: ReactNode; body: ReactNode}[]; className?: string}) {
  return <ol className={'xp-steps' + (className ? ' ' + className : '')}>
    {items.map((item, i) => <li key={i}><span className="xp-steps-index" aria-hidden="true">{pad(i + 1)}</span><div>{item.title && <h3>{item.title}</h3>}<p>{item.body}</p></div></li>)}
  </ol>;
}

export function LearnContent() {
  const {tr} = useLang();
  const navigate = useNavigate();
  const [acknowledged, setAcknowledged] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  async function start() {
    setBusy(true); setError('');
    try {
      const project = await post('/projects', {goal: lessonGoal, entryPoint: 'learn', challengeId: 'room-monitor', challengeVersion: 1});
      navigate('/project/' + project.id);
    } catch (e) {setError((e as Error).message); setBusy(false);}
  }
  return <div className="xp-learn">
    <div className="xp-intro">
      <p>{tr('For makers, SMK learners and Hardware Fellows. Work through one real challenge, keep the attempts, and let evidence decide the result.', 'Untuk maker, siswa SMK dan Hardware Fellows. Kerjakan satu tantangan nyata, simpan setiap percobaan, dan biarkan bukti yang menentukan hasilnya.')}</p>
      <Tag>{tr('Local pilot / no school enrollment', 'Pilot lokal / tanpa pendaftaran sekolah')}</Tag>
    </div>
    <div className="xp-lesson">
      <Card brackets className="xp-lesson-card">
        <Eyebrow>{tr('Lesson 001 / Rev 1', 'Pelajaran 001 / Rev 1')}</Eyebrow>
        <h2>{tr('Build. Break. Recover.', 'Rakit. Rusak. Pulihkan.')}</h2>
        <p className="xp-lesson-lead">{tr('ESP32 + BME280 + SSD1306. Build a room monitor, diagnose a missing I2C bus, then prove a fresh recovery.', 'ESP32 + BME280 + SSD1306. Rakit monitor ruangan, diagnosis bus I2C yang hilang, lalu buktikan pemulihan yang baru.')}</p>
        <SpecList rows={[
          [tr('Hardware', 'Perangkat'), 'Classic ESP32 · 3.3V · GPIO21/22'],
          [tr('Target', 'Target'), 'BME280 0x76 · OLED 0x3C'],
          [tr('Proof', 'Bukti'), tr('Six named runtime checks', 'Enam pemeriksaan runtime bernama')],
        ]}/>
        <label className="xp-check"><input type="checkbox" checked={acknowledged} onChange={e => setAcknowledged(e.target.checked)}/><span>{tr('I understand that AI assistance processes the build goal and machine evidence. I will keep personal and school information out of prompts.', 'Saya memahami bahwa bantuan AI memproses tujuan perakitan dan bukti mesin. Saya tidak akan memasukkan informasi pribadi atau sekolah ke dalam prompt.')}</span></label>
        <div className="xp-lesson-actions">
          <Button variant="primary" disabled={!acknowledged || busy} onClick={start}>{busy ? tr('Opening challenge…', 'Membuka tantangan…') : tr('Start learning episode', 'Mulai episode belajar')} <ArrowUpRightIcon aria-hidden="true"/></Button>
        </div>
        {error && <Notice tone="error">{error}</Notice>}
        <p className="xp-fine">{tr('This notice does not authorize research reuse. Human notes and manual measurements stay local. School and minor participation require a separate reviewed permission process.', 'Pemberitahuan ini tidak mengizinkan penggunaan ulang untuk riset. Catatan manusia dan pengukuran manual tetap lokal. Partisipasi sekolah dan anak di bawah umur memerlukan proses izin terpisah yang ditinjau.')}</p>
      </Card>
      <div className="xp-lesson-steps">
        <Eyebrow rule>{tr('How the lesson runs', 'Alur pelajaran')}</Eyebrow>
        <Steps items={[
          {title: tr('Inspect the plan.', 'Periksa rencananya.'), body: tr('Read the contract, component specifications, pin mapping and generated firmware. Record what you accept or question.', 'Baca kontrak, spesifikasi komponen, pemetaan pin, dan firmware yang dihasilkan. Catat apa yang Anda terima atau pertanyakan.')},
          {title: tr('Practice the loop.', 'Latih alurnya.'), body: tr('Run the template model. Introduce its SDA fault, inspect diagnosis and test recovery. This teaches the workflow; it does not execute firmware.', 'Jalankan model templat. Munculkan gangguan SDA, periksa diagnosis, dan uji pemulihan. Ini melatih alur kerja; firmware tidak dijalankan.')},
          {title: tr('Meet real hardware.', 'Hadapi perangkat nyata.'), body: tr('With power off, wire the actual modules. Connect and authorize USB, flash, then capture physical checks. A deliberate fault and repair need your hands.', 'Dengan daya mati, rangkai modul yang sebenarnya. Hubungkan dan izinkan USB, flash, lalu rekam pemeriksaan fisik. Gangguan yang disengaja dan perbaikannya butuh tangan Anda.')},
          {title: tr('Keep the episode.', 'Simpan episodenya.'), body: tr('Record actions and conditions. Download the trajectory with artifact references. A model pass and a physical pass remain different evidence.', 'Catat tindakan dan kondisi. Unduh lintasan beserta referensi artefak. Lulus di model dan lulus secara fisik tetap merupakan bukti yang berbeda.')},
        ]}/>
      </div>
    </div>
    <BuildProgressionGuide/>
    <section className="xp-thesis">
      <SectionHeader eyebrow={tr('One shared experience engine', 'Satu mesin pengalaman bersama')} title={tr('The attempt is part of the result.', 'Percobaan adalah bagian dari hasil.')} lead={tr('Tools can change. Intent, contracts, predictions, actions, observations, failures and repairs remain inspectable. Simulation evidence never becomes physical evidence by relabeling it.', 'Alat bisa berganti. Niat, kontrak, prediksi, tindakan, pengamatan, kegagalan, dan perbaikan tetap dapat diperiksa. Bukti simulasi tidak pernah menjadi bukti fisik hanya karena diberi label baru.')}/>
      <ol className="xp-chain">
        {[tr('Challenge', 'Tantangan'), tr('AI + learner', 'AI + pelajar'), tr('Test + repair', 'Uji + perbaiki'), tr('Episode', 'Episode')].map((label, i) => <li key={i}><span className="xp-mono">{pad(i + 1)}</span>{label}</li>)}
      </ol>
      <Notice>{tr('Wokwi CLI/scenarios are an optional future execution adapter for a matching recipe. No embedded Wokwi editor is required. Cloud simulation is not enabled here; the golden BME280 recipe has no supported Wokwi mapping.', 'Wokwi CLI/skenario adalah adaptor eksekusi opsional di masa depan untuk resep yang cocok. Editor Wokwi tersemat tidak diperlukan. Simulasi cloud tidak diaktifkan di sini; resep acuan BME280 belum memiliki pemetaan Wokwi yang didukung.')}</Notice>
    </section>
  </div>;
}

function downloadJson(data: unknown, filename: string) {
  const url = URL.createObjectURL(new Blob([JSON.stringify(data, null, 2) + '\n'], {type: 'application/json'}));
  const anchor = document.createElement('a'); anchor.href = url; anchor.download = filename; anchor.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/** Status colour derived only from recorded fields; never upgrades evidence. */
function statusTone(status: unknown): 'ok' | 'error' | 'neutral' {
  const value = String(status ?? '');
  if (value === 'failed' || value === 'blocked') return 'error';
  if (value.endsWith('verified') && value !== 'unverified') return 'ok';
  return 'neutral';
}
function eventTone(event: any): 'ok' | 'error' | 'neutral' {
  const p = event.payload ?? {};
  if (p.passed === true) return 'ok';
  if (p.passed === false || String(event.type).includes('failed')) return 'error';
  return statusTone(p.status);
}

export function EpisodeContent() {
  const {tr} = useLang();
  const {id} = useParams();
  const [episode, setEpisode] = useState<Episode>();
  const [simulators, setSimulators] = useState<SimulatorCapabilities[]>([]);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [busy, setBusy] = useState(false);
  const [actionType, setActionType] = useState('note');
  const [description, setDescription] = useState('');
  const [experimentId, setExperimentId] = useState('');
  const [provenance, setProvenance] = useState('human_reported');
  const [quantity, setQuantity] = useState('temperature');
  const [value, setValue] = useState('');
  const [unit, setUnit] = useState('°C');
  const [method, setMethod] = useState('');
  const [rights, setRights] = useState({purpose: 'research', participant: 'unknown', participantConsent: false, schoolConsent: false, guardianConsent: false, reviewed: false, authorizationReference: '', withdrawn: false});
  const path = '/projects/' + id;
  useEffect(() => {
    let live = true;
    const refresh = () => api<Episode>(path + '/episode').then(data => {if (live) setEpisode(data);}).catch(e => {if (live) setError(e.message);});
    refresh(); const timer = setInterval(refresh, 3000);
    api('/status').then(data => {if (live) setSimulators(data.simulators ?? []);}).catch(() => {});
    return () => {live = false; clearInterval(timer);};
  }, [path]);
  async function save(endpoint: string, data: unknown, message: string) {
    setBusy(true); setError(''); setNotice('');
    try {
      await post(path + endpoint, data);
      setEpisode(await api<Episode>(path + '/episode'));
      setNotice(message);
      return true;
    } catch (e) {setError((e as Error).message); return false;}
    finally {setBusy(false);}
  }
  async function exportEpisode(purpose: 'local' | 'research' | 'model_improvement') {
    setBusy(true); setError('');
    try {downloadJson(await api(path + '/episode?purpose=' + purpose), `iot-episode-${id}-${purpose}.json`); setNotice(tr('Episode downloaded. Export permissions do not certify physical results.', 'Episode diunduh. Izin ekspor tidak mensertifikasi hasil fisik.'));}
    catch (e) {setError((e as Error).message);}
    finally {setBusy(false);}
  }
  async function recordAction(event: FormEvent) {
    event.preventDefault();
    if (await save('/actions', {actionType, description, provenance, ...(experimentId ? {experimentId} : {})}, tr('Action recorded locally. Runtime evidence is unchanged.', 'Tindakan dicatat secara lokal. Bukti runtime tidak berubah.'))) setDescription('');
  }
  async function recordEnvironment(event: FormEvent) {
    event.preventDefault();
    if (await save('/environment', {quantity, value: Number(value), unit, method, provenance, ...(experimentId ? {experimentId} : {})}, tr('Measurement report recorded. It does not satisfy runtime checks.', 'Laporan pengukuran dicatat. Laporan ini tidak memenuhi pemeriksaan runtime.'))) {setValue(''); setMethod('');}
  }
  if (!episode) return error ? <Notice tone="error">{error}</Notice> : <p className="xp-loading" role="status">{tr('Loading the recorded experience…', 'Memuat pengalaman yang tercatat…')}</p>;
  const physicalRuns = episode.experiments.filter((run: any) => run.mode === 'physical');
  const simulatedRuns = episode.experiments.filter((run: any) => run.mode === 'simulation');
  const actionById = new Map(episode.humanActions.map((record: any) => [record.id, record]));
  const environmentById = new Map(episode.environmentRecords.map((record: any) => [record.id, record]));
  function eventDescription(event: any) {
    const action: any = actionById.get(event.payload.actionId);
    if (action) return action.description;
    const measurement: any = environmentById.get(event.payload.environmentId);
    if (measurement) return `${measurement.quantity}: ${measurement.value} ${measurement.unit} — ${measurement.method}`;
    if (event.type === 'verification.completed') return `${readable(event.payload.status)} / ${event.payload.mode}`;
    if (event.type === 'check.observed') return `${readable(event.payload.check)} / ${event.payload.passed ? 'PASS' : 'FAIL'} / ${event.payload.source}`;
    if (event.type === 'experiment.started') return `${event.payload.mode} / ${event.payload.backend ?? 'legacy backend'}${event.payload.parentId ? ' / retest of ' + event.payload.parentId.slice(0, 8) : ''}`;
    return event.payload.experimentId ? tr('Experiment ', 'Eksperimen ') + event.payload.experimentId.slice(0, 8) : tr('Recorded in this episode', 'Tercatat dalam episode ini');
  }
  const eligibility = episode.rights.eligibilityByPurpose;
  const unitFor = (item: string) => ({temperature: '°C', humidity: '%', supply_voltage: 'V', reboot_cycles: 'cycles', other: ''} as Record<string, string>)[item];
  return <div className="xp-episode">
    <div className="xp-topline">
      <TextLink to={'/project/' + id}><ArrowLeftIcon aria-hidden="true"/> {tr('Back to workbench', 'Kembali ke workbench')}</TextLink>
      <Eyebrow as="span">{episode.task.entryPoint === 'learn' ? tr('Learning episode', 'Episode belajar') : tr('Build episode', 'Episode rakit')} / {id?.slice(0, 8)}</Eyebrow>
    </div>
    <div className="xp-episode-head">
      <h2>{episode.task.title}</h2>
      <p>{episode.task.goal}</p>
    </div>
    {error && <Notice tone="error">{error}</Notice>}
    {notice && <Notice tone="ok">{notice}</Notice>}
    <dl className="xp-metrics">
      <div><dt>{tr('Model / simulation', 'Model / simulasi')}</dt><dd>{simulatedRuns.length}</dd><p>{tr('Recorded runs; no physical proof', 'Run tercatat; bukan bukti fisik')}</p></div>
      <div><dt>{tr('Physical', 'Fisik')}</dt><dd>{physicalRuns.length}</dd><p>{episode.verifications.filter((v: any) => v.physical && v.passed).length} {tr('runtime verifications', 'verifikasi runtime')}</p></div>
      <div><dt>{tr('Actions + conditions', 'Tindakan + kondisi')}</dt><dd>{episode.humanActions.length + episode.environmentRecords.length}</dd><p>{tr('Manual reports and labeled fixtures', 'Laporan manual dan fixture berlabel')}</p></div>
    </dl>
    <div className="xp-episode-layout">
      <section className="xp-trajectory" aria-labelledby="xp-trajectory-title">
        <div className="xp-section-row"><h2 id="xp-trajectory-title">{tr('Experience trajectory', 'Lintasan pengalaman')}</h2><Eyebrow as="span">{episode.trajectory.length} {tr('events', 'peristiwa')}</Eyebrow></div>
        <ol className="xp-timeline">{episode.trajectory.map((event: any) => <li key={event.seq} className={'xp-event xp-actor-' + event.actorType}>
          <span className="xp-event-index">#{pad(event.seq)}</span>
          <div className="xp-event-body">
            <div className="xp-event-meta"><Tag tone={eventTone(event)}>{readable(event.type)}</Tag><Tag tone={event.actorType === 'human' ? 'inverse' : 'neutral'}>{event.actorType}</Tag><time dateTime={event.createdAt}>{new Date(event.createdAt).toLocaleString('en-GB')}</time></div>
            <p>{eventDescription(event)}</p>
          </div>
        </li>)}</ol>
        <details className="xp-details"><summary>{tr('AI plans and diagnoses', 'Rencana dan diagnosis AI')} <span className="xp-mono">{episode.agentRuns.length}</span></summary>{episode.agentRuns.map((run: any) => <CodeBlock key={run.id} label={`${run.kind} / ${run.provider}`}>{JSON.stringify(run.plan ?? run.diagnosis, null, 2)}</CodeBlock>)}</details>
        <details className="xp-details"><summary>{tr('Run identities and parent-linked retests', 'Identitas run dan uji ulang tertaut')} <span className="xp-mono">{episode.experiments.length}</span></summary>{episode.experiments.map((run: any) => <div key={run.id} className="xp-run"><Tag tone={statusTone(run.status)}>{run.mode} / {readable(run.status)}</Tag><CodeBlock>{JSON.stringify({id: run.id, backend: run.backend, parentId: run.parentId, identity: run.identity}, null, 2)}</CodeBlock></div>)}</details>
      </section>
      <aside className="xp-editor" aria-labelledby="xp-editor-title">
        <Card>
          <h2 id="xp-editor-title">{tr('Record your part.', 'Catat bagian Anda.')}</h2>
          <p className="xp-muted">{tr('No names, contact details, school identifiers or precise locations. Reports stay local and never upgrade a runtime verification.', 'Jangan cantumkan nama, kontak, identitas sekolah, atau lokasi persis. Laporan tetap lokal dan tidak pernah menaikkan status verifikasi runtime.')}</p>
          <div className="xp-fields">
            <Select id="record-provenance" label={tr('Record provenance', 'Asal catatan')} value={provenance} onChange={e => setProvenance(e.target.value)}><option value="human_reported">{tr('Human-reported', 'Dilaporkan manusia')}</option><option value="test_fixture">{tr('Test fixture / not research data', 'Fixture uji / bukan data riset')}</option></Select>
            <Select id="record-experiment" label={tr('Attach to a run', 'Tautkan ke run')} value={experimentId} onChange={e => setExperimentId(e.target.value)}><option value="">{tr('Whole episode', 'Seluruh episode')}</option>{episode.experiments.map((run: any) => <option key={run.id} value={run.id}>{run.id.slice(0, 8)} / {run.mode} / {readable(run.status)}</option>)}</Select>
          </div>
          <form onSubmit={recordAction} className="xp-form">
            <h3>{tr('Action or observation', 'Tindakan atau pengamatan')}</h3>
            <Select id="action-type" label={tr('Action type', 'Jenis tindakan')} value={actionType} onChange={e => setActionType(e.target.value)}>{actions.map(action => <option key={action} value={action}>{readable(action)}</option>)}</Select>
            <Textarea id="action-description" label={tr('What did you do?', 'Apa yang Anda lakukan?')} value={description} onChange={e => setDescription(e.target.value)} maxLength={1000} required rows={3} placeholder={tr('Describe the decision, edit, inspection or repair.', 'Jelaskan keputusan, perubahan, pemeriksaan, atau perbaikan.')}/>
            <Button type="submit" variant="secondary" disabled={busy}>{tr('Record action', 'Catat tindakan')} <ArrowUpRightIcon aria-hidden="true"/></Button>
          </form>
          <form onSubmit={recordEnvironment} className="xp-form">
            <h3>{tr('Conditions and measurements', 'Kondisi dan pengukuran')}</h3>
            <Select id="measurement-quantity" label={tr('Quantity', 'Besaran')} value={quantity} onChange={e => {setQuantity(e.target.value); setUnit(unitFor(e.target.value));}}>{quantities.map(item => <option key={item} value={item}>{readable(item)}</option>)}</Select>
            <div className="xp-pair">
              <Input id="measurement-value" label={tr('Value', 'Nilai')} type="number" step="any" value={value} onChange={e => setValue(e.target.value)} required/>
              <Input id="measurement-unit" label={tr('Unit', 'Satuan')} value={unit} onChange={e => setUnit(e.target.value)} maxLength={30} required/>
            </div>
            <Input id="measurement-method" label={tr('How was it measured?', 'Bagaimana cara mengukurnya?')} value={method} onChange={e => setMethod(e.target.value)} maxLength={300} required placeholder={tr('Instrument/method, or explicitly a test fixture', 'Alat/metode, atau nyatakan sebagai fixture uji')}/>
            <Button type="submit" variant="secondary" disabled={busy}>{tr('Record measurement', 'Catat pengukuran')} <ArrowUpRightIcon aria-hidden="true"/></Button>
            <p className="xp-fine">{tr('A manual report is not calibrated instrument evidence. Reboot counts are reported, not an automated reliability test.', 'Laporan manual bukan bukti instrumen terkalibrasi. Jumlah reboot hanya dilaporkan, bukan uji keandalan otomatis.')}</p>
          </form>
        </Card>
      </aside>
    </div>
    <section className="xp-export" aria-labelledby="xp-export-title">
      <div className="xp-export-main">
        <Eyebrow>{tr('Portable experience / JSON v1', 'Pengalaman portabel / JSON v1')}</Eyebrow>
        <h2 id="xp-export-title">{tr('Keep the trace. Control its reuse.', 'Simpan jejaknya. Kendalikan penggunaannya.')}</h2>
        <p className="xp-muted">{tr('The local export includes contracts, firmware, AI decisions, human reports and experiment references. Raw serial, USB paths, private knowledge and tool logs are omitted. Hashes identify content; they do not certify authenticity or legal rights.', 'Ekspor lokal mencakup kontrak, firmware, keputusan AI, laporan manusia, dan referensi eksperimen. Serial mentah, path USB, pengetahuan privat, dan log alat tidak disertakan. Hash mengidentifikasi konten; hash tidak mensertifikasi keaslian atau hak hukum.')}</p>
        <Button variant="primary" disabled={busy} onClick={() => exportEpisode('local')}>{tr('Download local episode', 'Unduh episode lokal')} <DownloadSimpleIcon aria-hidden="true"/></Button>
        <CodeBlock label={tr('Export payload SHA256', 'SHA256 payload ekspor')} className="xp-hash">{episode.integrity.exportedPayloadHash}</CodeBlock>
      </div>
      <div className="xp-reuse">
        {(['research', 'model_improvement'] as const).map(purpose => <Card key={purpose} tone="plain">
          <div className="xp-reuse-head"><Eyebrow as="span">{readable(purpose)}</Eyebrow><Tag tone={eligibility[purpose].eligible ? 'ok' : 'neutral'}>{eligibility[purpose].eligible ? tr('Eligible', 'Memenuhi syarat') : tr('Excluded', 'Dikecualikan')}</Tag></div>
          <strong>{eligibility[purpose].eligible ? tr('Eligible by recorded attestations', 'Memenuhi syarat berdasarkan pernyataan tercatat') : tr('Reuse excluded', 'Penggunaan ulang dikecualikan')}</strong>
          {eligibility[purpose].reasons.map(reason => <p key={reason} className="xp-muted">{reason}</p>)}
          <Button variant="secondary" size="sm" disabled={busy || !eligibility[purpose].eligible} onClick={() => exportEpisode(purpose)}>{tr('Export for', 'Ekspor untuk')} {readable(purpose)} <DownloadSimpleIcon aria-hidden="true"/></Button>
        </Card>)}
        <p className="xp-fine">{tr('Pseudonymous, not certified anonymous. Unknown permissions and test fixtures cannot enter research exports.', 'Pseudonim, bukan anonim tersertifikasi. Izin yang tidak diketahui dan fixture uji tidak dapat masuk ke ekspor riset.')}</p>
      </div>
    </section>
    <details className="xp-details xp-permissions"><summary>{tr('Permission declarations', 'Deklarasi izin')} <span className="xp-mono">{episode.rights.records.length} {tr('records', 'catatan')}</span></summary>
      <p className="xp-muted">{tr("For the operator's single-participant local episode. Record only permissions you can substantiate. This application does not verify your authority, authenticate consent documents, or approve a school rollout. Reuse is optional and purpose-specific.", 'Untuk episode lokal operator dengan satu peserta. Catat hanya izin yang dapat Anda buktikan. Aplikasi ini tidak memverifikasi kewenangan Anda, tidak mengautentikasi dokumen persetujuan, dan tidak menyetujui penerapan di sekolah. Penggunaan ulang bersifat opsional dan khusus per tujuan.')}</p>
      <form onSubmit={event => {event.preventDefault(); void save('/rights', rights, tr('Permission declaration recorded. No independent rights clearance is claimed.', 'Deklarasi izin dicatat. Tidak ada klaim pemeriksaan hak secara independen.'));}}>
        <div className="xp-permission-grid">
          <div className="xp-fields">
            <Select id="rights-purpose" label={tr('Reuse purpose', 'Tujuan penggunaan ulang')} value={rights.purpose} onChange={e => setRights({...rights, purpose: e.target.value})}><option value="research">{tr('Research', 'Riset')}</option><option value="model_improvement">{tr('Model improvement', 'Peningkatan model')}</option></Select>
            <Select id="rights-participant" label={tr('Participant age category', 'Kategori usia peserta')} value={rights.participant} onChange={e => setRights({...rights, participant: e.target.value})}><option value="unknown">{tr('Unknown / reuse excluded', 'Tidak diketahui / dikecualikan')}</option><option value="adult">{tr('Adult', 'Dewasa')}</option><option value="minor">{tr('Minor / school + guardian required', 'Di bawah umur / perlu sekolah + wali')}</option></Select>
            <Input id="rights-reference" label={tr('Authorization reference', 'Referensi otorisasi')} value={rights.authorizationReference} onChange={e => setRights({...rights, authorizationReference: e.target.value})} maxLength={200} placeholder={tr('Reference only; do not paste consent documents', 'Hanya referensi; jangan tempel dokumen persetujuan')}/>
          </div>
          <fieldset className="xp-checks"><legend>{tr('Documented permissions', 'Izin terdokumentasi')}</legend>{([
            ['participantConsent', tr('Participant permission documented', 'Izin peserta terdokumentasi')], ['schoolConsent', tr('School permission documented', 'Izin sekolah terdokumentasi')], ['guardianConsent', tr('Guardian permission documented', 'Izin wali terdokumentasi')], ['reviewed', tr('Content reviewed for identifiers and reuse', 'Konten ditinjau untuk identitas dan penggunaan ulang')], ['withdrawn', tr('Withdraw permission for this purpose', 'Tarik izin untuk tujuan ini')],
          ] as const).map(([key, label]) => <label key={key} className="xp-check"><input type="checkbox" checked={rights[key]} onChange={e => setRights({...rights, [key]: e.target.checked})}/><span>{label}</span></label>)}</fieldset>
        </div>
        <Button type="submit" variant="secondary" disabled={busy}>{tr('Record declaration', 'Catat deklarasi')} <ArrowUpRightIcon aria-hidden="true"/></Button>
      </form>
      {episode.rights.records.length > 0 && <ul className="xp-history">{episode.rights.records.map((record: any) => <li key={record.id}><span className="xp-mono">{new Date(record.createdAt).toLocaleString('en-GB')}</span><span>{readable(record.purpose)} / {record.withdrawn ? tr('withdrawn', 'ditarik') : record.participant + tr(' · operator attestation', ' · pernyataan operator')}</span></li>)}</ul>}
    </details>
    <section className="xp-simulators" aria-labelledby="xp-simulators-title">
      <SectionHeader eyebrow={tr('Simulators', 'Simulator')} title={<span id="xp-simulators-title">{tr('Replaceable tools. Persistent evidence.', 'Alat bisa diganti. Bukti tetap.')}</span>}/>
      {simulators.length > 0 && <ul className="xp-sim-list">{simulators.map(simulator => <li key={simulator.backend}><span className="xp-mono">{simulator.backend}</span><Tag tone={simulator.available && simulator.supported ? 'ok' : 'warn'}>{simulator.available && simulator.supported ? tr('Available', 'Tersedia') : tr('Unavailable', 'Tidak tersedia')}</Tag><p>{simulator.reason}</p></li>)}</ul>}
      <p className="xp-fine">{tr('Wokwi Elements renders component visuals. Wokwi CLI is a separate simulator service; no editor iframe or white-label embed is assumed.', 'Wokwi Elements menampilkan visual komponen. Wokwi CLI adalah layanan simulator terpisah; tidak ada iframe editor atau embed white-label yang diasumsikan.')}</p>
    </section>
  </div>;
}
