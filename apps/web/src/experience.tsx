import {useEffect, useState, type FormEvent} from 'react';
import {Link, useNavigate, useParams} from 'react-router-dom';
import {ArrowUpRightIcon, ArrowLeftIcon, DownloadSimpleIcon} from '@phosphor-icons/react';
import {api, post} from './api';
import {BuildProgressionGuide} from './build-progression-guide';
import type {assembleEpisode} from '../../../packages/episodes/index';
import type {SimulatorCapabilities} from '../../../packages/simulator-client/index';

type Episode = ReturnType<typeof assembleEpisode>;
const lessonGoal = 'Build an ESP32 room monitor with temperature/humidity and an OLED.';
const actions = ['accepted_plan', 'inspected_wiring', 'reported_edit', 'performed_repair', 'observed_display', 'note'];
const quantities = ['temperature', 'humidity', 'supply_voltage', 'reboot_cycles', 'other'];
const readable = (value: string) => value.replaceAll('_', ' ').replaceAll('.', ' / ');

export function LearnContent() {
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
  return <>
    <div className="learning-intro">
      <p>For makers, SMK learners and Hardware Fellows. Work through one real challenge, keep the attempts, and let evidence decide the result.</p>
      <span className="badge">LOCAL PILOT / NO SCHOOL ENROLLMENT</span>
    </div>
    <div className="lesson-grid">
      <article className="lesson-main">
        <span className="mono accent">LESSON 001 / REV 1</span>
        <h2>Build.<br/>Break.<br/><span className="accent">Recover.</span></h2>
        <p>ESP32 + BME280 + SSD1306. Build a room monitor, diagnose a missing I2C bus, then prove a fresh recovery.</p>
        <dl className="lesson-facts"><div><dt>Hardware</dt><dd>Classic ESP32 · 3.3V · GPIO21/22</dd></div><div><dt>Target</dt><dd>BME280 0x76 · OLED 0x3C</dd></div><div><dt>Proof</dt><dd>Six named runtime checks</dd></div></dl>
        <label className="consent-line"><input type="checkbox" checked={acknowledged} onChange={e => setAcknowledged(e.target.checked)}/><span>I understand that AI assistance processes the build goal and machine evidence. I will keep personal and school information out of prompts.</span></label>
        <button className="button red" disabled={!acknowledged || busy} onClick={start}>{busy ? 'Opening challenge…' : 'Start learning episode'} <ArrowUpRightIcon/></button>
        {error && <p className="error" role="alert">{error}</p>}
        <p className="panel-note">This notice does not authorize research reuse. Human notes and manual measurements stay local. School and minor participation require a separate reviewed permission process.</p>
      </article>
      <aside className="lesson-steps">
        {[
          ['01', 'Inspect the plan.', 'Read the contract, component specifications, pin mapping and generated firmware. Record what you accept or question.'],
          ['02', 'Practice the loop.', 'Run the template model. Introduce its SDA fault, inspect diagnosis and test recovery. This teaches the workflow; it does not execute firmware.'],
          ['03', 'Meet real hardware.', 'With power off, wire the actual modules. Connect and authorize USB, flash, then capture physical checks. A deliberate fault and repair need your hands.'],
          ['04', 'Keep the episode.', 'Record actions and conditions. Download the trajectory with artifact references. A model pass and a physical pass remain different evidence.'],
        ].map(([number, title, text]) => <div key={number}><span className="mono accent">{number}</span><h3>{title}</h3><p>{text}</p></div>)}
      </aside>
    </div>
    <BuildProgressionGuide/>
    <section className="experience-thesis"><span className="mono">ONE SHARED EXPERIENCE ENGINE</span><h2>The attempt is<br/>part of the result.</h2><p>Tools can change. Intent, contracts, predictions, actions, observations, failures and repairs remain inspectable. Simulation evidence never becomes physical evidence by relabeling it.</p><div className="experience-chain"><span>Challenge</span><span>AI + learner</span><span>Test + repair</span><span>Episode</span></div><p className="panel-note">Wokwi CLI/scenarios are an optional future execution adapter for a matching recipe. No embedded Wokwi editor is required. Cloud simulation is not enabled here; the golden BME280 recipe has no supported Wokwi mapping.</p></section>
  </>;
}

function downloadJson(data: unknown, filename: string) {
  const url = URL.createObjectURL(new Blob([JSON.stringify(data, null, 2) + '\n'], {type: 'application/json'}));
  const anchor = document.createElement('a'); anchor.href = url; anchor.download = filename; anchor.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export function EpisodeContent() {
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
    try {downloadJson(await api(path + '/episode?purpose=' + purpose), `iot-episode-${id}-${purpose}.json`); setNotice('Episode downloaded. Export permissions do not certify physical results.');}
    catch (e) {setError((e as Error).message);}
    finally {setBusy(false);}
  }
  async function recordAction(event: FormEvent) {
    event.preventDefault();
    if (await save('/actions', {actionType, description, provenance, ...(experimentId ? {experimentId} : {})}, 'Action recorded locally. Runtime evidence is unchanged.')) setDescription('');
  }
  async function recordEnvironment(event: FormEvent) {
    event.preventDefault();
    if (await save('/environment', {quantity, value: Number(value), unit, method, provenance, ...(experimentId ? {experimentId} : {})}, 'Measurement report recorded. It does not satisfy runtime checks.')) {setValue(''); setMethod('');}
  }
  if (!episode) return <p className={error ? 'error' : 'empty-state'} role={error ? 'alert' : undefined}>{error || 'Loading the recorded experience…'}</p>;
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
    return event.payload.experimentId ? 'Experiment ' + event.payload.experimentId.slice(0, 8) : 'Recorded in this episode';
  }
  const eligibility = episode.rights.eligibilityByPurpose;
  return <>
    <div className="episode-topline"><Link className="text-button" to={'/project/' + id}><ArrowLeftIcon/> Back to workbench</Link><span className="mono">{episode.task.entryPoint === 'learn' ? 'LEARNING' : 'BUILD'} EPISODE / {id?.slice(0, 8)}</span></div>
    <h2 className="episode-title">{episode.task.title}</h2><p className="episode-goal">{episode.task.goal}</p>
    {error && <p className="error-banner" role="alert">{error}</p>}{notice && <p className="episode-notice" role="status">{notice}</p>}
    <div className="episode-metrics"><div><span className="mono">MODEL / SIMULATION</span><strong>{simulatedRuns.length}</strong><p>Recorded runs; no physical proof</p></div><div><span className="mono">PHYSICAL</span><strong>{physicalRuns.length}</strong><p>{episode.verifications.filter((v: any) => v.physical && v.passed).length} runtime verifications</p></div><div><span className="mono">ACTIONS + CONDITIONS</span><strong>{episode.humanActions.length + episode.environmentRecords.length}</strong><p>Manual reports and labeled fixtures</p></div></div>
    <div className="episode-layout">
      <section className="trajectory-section"><div className="section-heading"><h2>Experience<br/>trajectory.</h2><span className="mono">{episode.trajectory.length} EVENTS</span></div>
        <div className="trajectory-list">{episode.trajectory.map((event: any) => <article key={event.seq} className={'trajectory-row actor-' + event.actorType}><div><span className="mono">#{event.seq}</span><time>{new Date(event.createdAt).toLocaleString('en-GB')}</time><span className="badge">{event.actorType}</span></div><div><h3>{readable(event.type)}</h3><p>{eventDescription(event)}</p></div></article>)}</div>
        <details className="episode-details"><summary>AI plans and diagnoses / {episode.agentRuns.length}</summary>{episode.agentRuns.map((run: any) => <article key={run.id}><span className="mono">{run.kind} / {run.provider}</span><pre>{JSON.stringify(run.plan ?? run.diagnosis, null, 2)}</pre></article>)}</details>
        <details className="episode-details"><summary>Run identities and parent-linked retests / {episode.experiments.length}</summary>{episode.experiments.map((run: any) => <article key={run.id}><span className="badge">{run.mode} / {readable(run.status)}</span><pre>{JSON.stringify({id: run.id, backend: run.backend, parentId: run.parentId, identity: run.identity}, null, 2)}</pre></article>)}</details>
      </section>
      <aside className="episode-editor"><h2>Record your part.</h2><p>No names, contact details, school identifiers or precise locations. Reports stay local and never upgrade a runtime verification.</p>
        <label htmlFor="record-provenance">Record provenance</label><select id="record-provenance" value={provenance} onChange={e => setProvenance(e.target.value)}><option value="human_reported">Human-reported</option><option value="test_fixture">Test fixture / not research data</option></select>
        <label htmlFor="record-experiment">Attach to a run</label><select id="record-experiment" value={experimentId} onChange={e => setExperimentId(e.target.value)}><option value="">Whole episode</option>{episode.experiments.map((run: any) => <option key={run.id} value={run.id}>{run.id.slice(0, 8)} / {run.mode} / {readable(run.status)}</option>)}</select>
        <form onSubmit={recordAction}><h3>Action or observation</h3><label htmlFor="action-type">Action type</label><select id="action-type" value={actionType} onChange={e => setActionType(e.target.value)}>{actions.map(action => <option key={action} value={action}>{readable(action)}</option>)}</select><label htmlFor="action-description">What did you do?</label><textarea id="action-description" value={description} onChange={e => setDescription(e.target.value)} maxLength={1000} required rows={3} placeholder="Describe the decision, edit, inspection or repair."/><button className="button dark" disabled={busy}>Record action <ArrowUpRightIcon/></button></form>
        <form onSubmit={recordEnvironment}><h3>Conditions and measurements</h3><label htmlFor="measurement-quantity">Quantity</label><select id="measurement-quantity" value={quantity} onChange={e => {setQuantity(e.target.value); setUnit(({temperature: '°C', humidity: '%', supply_voltage: 'V', reboot_cycles: 'cycles', other: ''} as Record<string, string>)[e.target.value]);}}>{quantities.map(item => <option key={item} value={item}>{readable(item)}</option>)}</select><div className="measurement-pair"><div><label htmlFor="measurement-value">Value</label><input id="measurement-value" type="number" step="any" value={value} onChange={e => setValue(e.target.value)} required/></div><div><label htmlFor="measurement-unit">Unit</label><input id="measurement-unit" value={unit} onChange={e => setUnit(e.target.value)} maxLength={30} required/></div></div><label htmlFor="measurement-method">How was it measured?</label><input id="measurement-method" value={method} onChange={e => setMethod(e.target.value)} maxLength={300} required placeholder="Instrument/method, or explicitly a test fixture"/><button className="button dark" disabled={busy}>Record measurement <ArrowUpRightIcon/></button><p className="panel-note">A manual report is not calibrated instrument evidence. Reboot counts are reported, not an automated reliability test.</p></form>
      </aside>
    </div>
    <section className="episode-export"><div><span className="mono">PORTABLE EXPERIENCE / JSON V1</span><h2>Keep the trace.<br/>Control its reuse.</h2><p>The local export includes contracts, firmware, AI decisions, human reports and experiment references. Raw serial, USB paths, private knowledge and tool logs are omitted. Hashes identify content; they do not certify authenticity or legal rights.</p><button className="button red" disabled={busy} onClick={() => exportEpisode('local')}>Download local episode <DownloadSimpleIcon/></button><div className="export-hash mono">EXPORT PAYLOAD SHA256 / {episode.integrity.exportedPayloadHash}</div></div><div className="reuse-status">{(['research', 'model_improvement'] as const).map(purpose => <article key={purpose}><span className="mono">{readable(purpose)}</span><strong>{eligibility[purpose].eligible ? 'Eligible by recorded attestations' : 'Reuse excluded'}</strong>{eligibility[purpose].reasons.map(reason => <p key={reason}>{reason}</p>)}<button className="button outline" disabled={busy || !eligibility[purpose].eligible} onClick={() => exportEpisode(purpose)}>Export for {readable(purpose)} <DownloadSimpleIcon/></button></article>)}<p className="panel-note">Pseudonymous, not certified anonymous. Unknown permissions and test fixtures cannot enter research exports.</p></div></section>
    <details className="permissions-editor"><summary>Permission declarations / {episode.rights.records.length} records</summary><p>For the operator's single-participant local episode. Record only permissions you can substantiate. This application does not verify your authority, authenticate consent documents, or approve a school rollout. Reuse is optional and purpose-specific.</p><form onSubmit={event => {event.preventDefault(); void save('/rights', rights, 'Permission declaration recorded. No independent rights clearance is claimed.');}}><div className="permission-fields"><div><label htmlFor="rights-purpose">Reuse purpose</label><select id="rights-purpose" value={rights.purpose} onChange={e => setRights({...rights, purpose: e.target.value})}><option value="research">Research</option><option value="model_improvement">Model improvement</option></select><label htmlFor="rights-participant">Participant age category</label><select id="rights-participant" value={rights.participant} onChange={e => setRights({...rights, participant: e.target.value})}><option value="unknown">Unknown / reuse excluded</option><option value="adult">Adult</option><option value="minor">Minor / school + guardian required</option></select><label htmlFor="rights-reference">Authorization reference</label><input id="rights-reference" value={rights.authorizationReference} onChange={e => setRights({...rights, authorizationReference: e.target.value})} maxLength={200} placeholder="Reference only; do not paste consent documents"/></div><div className="permission-checks">{([
          ['participantConsent', 'Participant permission documented'], ['schoolConsent', 'School permission documented'], ['guardianConsent', 'Guardian permission documented'], ['reviewed', 'Content reviewed for identifiers and reuse'], ['withdrawn', 'Withdraw permission for this purpose'],
        ] as const).map(([key, label]) => <label key={key}><input type="checkbox" checked={rights[key]} onChange={e => setRights({...rights, [key]: e.target.checked})}/>{label}</label>)}</div></div><button className="button dark" disabled={busy}>Record declaration <ArrowUpRightIcon/></button></form><div className="permission-history">{episode.rights.records.map((record: any) => <p key={record.id}><span className="mono">{new Date(record.createdAt).toLocaleString('en-GB')}</span> / {readable(record.purpose)} / {record.withdrawn ? 'withdrawn' : record.participant + ' · operator attestation'}</p>)}</div></details>
    <section className="simulator-status"><h2>Replaceable tools.<br/>Persistent evidence.</h2>{simulators.map(simulator => <div key={simulator.backend}><span className="mono">{simulator.backend}</span><span className="badge">{simulator.available && simulator.supported ? 'AVAILABLE' : 'UNAVAILABLE'}</span><p>{simulator.reason}</p></div>)}<p className="panel-note">Wokwi Elements renders component visuals. Wokwi CLI is a separate simulator service; no editor iframe or white-label embed is assumed.</p></section>
  </>;
}
