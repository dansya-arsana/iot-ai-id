import type {ReactNode} from 'react';
import {useParams} from 'react-router-dom';
import {ArrowUpRightIcon, ArrowRightIcon} from '@phosphor-icons/react';
import {BoardDrawing} from '../../../../packages/ui-hardware/index';
import {LearnContent, EpisodeContent, Steps} from '../experience';
import {PageShell} from '../site-shell';
import {useLang} from '../i18n';
import {Card, CardLink, CodeBlock, EmptyState, Eyebrow, LinkButton, Notice, SectionHeader, SpecList, Tag} from '../ui';
import './content-pages.css';

const pad = (n: number) => String(n).padStart(2, '0');

export function Bench() {
  const {tr} = useLang();
  const dimensions: [string, string, string, string][] = [
    ['Planning correctness', 'Ketepatan perencanaan', 'Does the plan meet the requested goal and supported component capabilities?', 'Apakah rencana memenuhi tujuan yang diminta dan kemampuan komponen yang didukung?'],
    ['Electrical correctness', 'Ketepatan kelistrikan', 'Does the contract pass pin, voltage, protocol and power rules?', 'Apakah kontrak lolos aturan pin, tegangan, protokol, dan daya?'],
    ['Build / flash success', 'Keberhasilan build / flash', 'Did the real toolchain and bootloader complete their named checks?', 'Apakah toolchain dan bootloader nyata menyelesaikan pemeriksaan yang ditentukan?'],
    ['Peripheral success', 'Keberhasilan periferal', 'Did the expected peripheral respond and produce valid data?', 'Apakah periferal yang diharapkan merespons dan menghasilkan data yang valid?'],
    ['Diagnosis', 'Diagnosis', 'Did the diagnosis separate observed mismatch from suspected cause?', 'Apakah diagnosis memisahkan ketidaksesuaian yang teramati dari dugaan penyebabnya?'],
    ['Repair', 'Perbaikan', 'Did a physical correction produce a new evidence-backed recovery?', 'Apakah koreksi fisik menghasilkan pemulihan baru yang didukung bukti?'],
    ['Reliability', 'Keandalan', 'Does the build keep passing across repeated controlled trials?', 'Apakah rakitan tetap lolos dalam uji terkendali yang diulang?'],
    ['Efficiency', 'Efisiensi', 'How much time, compute and intervention did the result require?', 'Berapa banyak waktu, komputasi, dan intervensi yang dibutuhkan hasil tersebut?'],
  ];
  return <PageShell eyebrow={tr('PhysicalBench / methodology preview', 'PhysicalBench / pratinjau metodologi')} title={tr('Evidence earns the score.', 'Bukti yang menentukan skor.')} lead={tr('A benchmark for agents that must deal with real hardware.', 'Benchmark untuk agen yang harus berhadapan dengan perangkat keras nyata.')}>
    <div className="cp-stack">
      <Notice tone="warn" title={tr('Preview', 'Pratinjau')}>{tr('No published scores or agent rankings. Real hardware milestones remain unverified.', 'Belum ada skor atau peringkat agen yang dipublikasikan. Capaian perangkat keras nyata masih belum terverifikasi.')}</Notice>
      <section className="cp-section" aria-labelledby="cp-bench-dimensions">
        <SectionHeader eyebrow={tr('Scored dimensions', 'Dimensi penilaian')} title={<span id="cp-bench-dimensions">{tr('Eight questions, answered with evidence.', 'Delapan pertanyaan, dijawab dengan bukti.')}</span>}/>
        <ul className="cp-grid cp-grid--4">{dimensions.map(([en, id, enText, idText], i) => <Card as="li" key={en} className="cp-method"><span className="cp-index">{pad(i + 1)}</span><h3>{tr(en, id)}</h3><p>{tr(enText, idText)}</p></Card>)}</ul>
      </section>
      <section className="cp-section cp-split" aria-labelledby="cp-bench-protocol">
        <SectionHeader eyebrow={tr('Protocol', 'Protokol')} title={<span id="cp-bench-protocol">{tr('Reproducible protocol', 'Protokol yang dapat diulang')}</span>}/>
        <div className="cp-flow">
          <Steps items={[
            {body: tr('Freeze contract, firmware hash, board and component variants.', 'Bekukan kontrak, hash firmware, serta varian papan dan komponen.')},
            {body: tr('Capture a baseline on physical hardware.', 'Rekam baseline pada perangkat keras fisik.')},
            {body: tr('Introduce a documented fault with power off.', 'Munculkan gangguan yang terdokumentasi dengan daya mati.')},
            {body: tr('Record diagnosis and user repair; retest without changing the goal.', 'Catat diagnosis dan perbaikan oleh pengguna; uji ulang tanpa mengubah tujuan.')},
            {body: tr('Publish immutable evidence, conditions, repetitions and exclusions.', 'Publikasikan bukti yang tidak dapat diubah, kondisi, pengulangan, dan pengecualian.')},
          ]}/>
          <div><LinkButton to="/arena/room-monitor" variant="primary">{tr('Inspect the first challenge', 'Lihat tantangan pertama')} <ArrowUpRightIcon aria-hidden="true"/></LinkButton></div>
        </div>
      </section>
    </div>
  </PageShell>;
}

export function Arena() {
  const {tr} = useLang();
  return <PageShell eyebrow={tr('Hardware Arena / challenge preview', 'Hardware Arena / pratinjau tantangan')} title={tr('The same hardware. The same proof.', 'Perangkat sama. Bukti sama.')} lead={tr('Humans and agents solve a reproducible physical task.', 'Manusia dan agen menyelesaikan tugas fisik yang dapat diulang.')}>
    <div className="cp-stack">
      <Notice tone="warn" title={tr('Draft / no active labs', 'Draf / belum ada lab aktif')}>{tr('No leaderboard, enrollment or nationwide operations in v1.', 'Tidak ada papan peringkat, pendaftaran, atau operasi nasional di v1.')}</Notice>
      <CardLink to="/arena/room-monitor" brackets className="cp-challenge">
        <div className="cp-challenge-top"><Eyebrow as="span">{tr('Challenge 001 / draft', 'Tantangan 001 / draf')}</Eyebrow><ArrowUpRightIcon size={28} aria-hidden="true"/></div>
        <h2>{tr('Build. Break. Recover.', 'Rakit. Rusak. Pulihkan.')}</h2>
        <p>{tr('ESP32 + BME280 + SSD1306. Detect a deliberate SDA failure and prove recovery.', 'ESP32 + BME280 + SSD1306. Deteksi kegagalan SDA yang disengaja dan buktikan pemulihannya.')}</p>
        <ul className="cp-tags"><li><Tag>3.3V</Tag></li><li><Tag>I2C</Tag></li><li><Tag>{tr('Physical evidence', 'Bukti fisik')}</Tag></li></ul>
      </CardLink>
      <p className="cp-fine">{tr('Jakarta/Jabodetabek is the planned first lab region. No lab is marked active.', 'Jakarta/Jabodetabek adalah wilayah lab pertama yang direncanakan. Belum ada lab yang berstatus aktif.')}</p>
    </div>
  </PageShell>;
}

export function ArenaDetail() {
  const {tr} = useLang();
  const {id: challenge} = useParams();
  const found = challenge === 'room-monitor';
  return <PageShell eyebrow={tr('Arena / challenge 001', 'Arena / tantangan 001')} title={found ? tr('Room monitor recovery.', 'Pemulihan monitor ruangan.') : tr('Challenge not found.', 'Tantangan tidak ditemukan.')} lead={tr('Draft procedure; completion requires real board evidence.', 'Prosedur draf; penyelesaian memerlukan bukti dari papan nyata.')}>
    {found ? <div className="cp-detail">
      <div className="cp-detail-main">
        <Card className="cp-board"><Eyebrow as="span">{tr('Reference wiring', 'Rangkaian acuan')}</Eyebrow><BoardDrawing/></Card>
        <section className="cp-block" aria-labelledby="cp-goal">
          <h2 id="cp-goal">{tr('Goal & constraints', 'Tujuan & batasan')}</h2>
          <p>{tr('Measure temperature and humidity, show them on an OLED, then diagnose and recover from a disconnected shared SDA line.', 'Ukur suhu dan kelembapan, tampilkan di OLED, lalu diagnosis dan pulihkan jalur SDA bersama yang terputus.')}</p>
          <SpecList rows={[
            [tr('Board', 'Papan'), 'Classic ESP32 DevKit'],
            [tr('Sensor', 'Sensor'), 'BME280 0x76'],
            [tr('Display', 'Layar'), 'OLED 0x3C'],
            [tr('Wiring', 'Rangkaian'), tr('3.3V rails, GPIO21/SDA, GPIO22/SCL and common ground', 'Rail 3.3V, GPIO21/SDA, GPIO22/SCL, dan ground bersama')],
          ]}/>
        </section>
        <section className="cp-block" aria-labelledby="cp-evidence">
          <h2 id="cp-evidence">{tr('Evidence required', 'Bukti yang diperlukan')}</h2>
          <p>{tr('Board handshake, compiler and flash logs, expected addresses, bounded sensor values, OLED initialization/ACK, deliberate failure and fresh recovery evidence.', 'Handshake papan, log compiler dan flash, alamat yang diharapkan, nilai sensor dalam batas wajar, inisialisasi/ACK OLED, kegagalan yang disengaja, dan bukti pemulihan yang baru.')}</p>
          <div><LinkButton to="/build" variant="primary">{tr('Build the challenge', 'Rakit tantangannya')} <ArrowUpRightIcon aria-hidden="true"/></LinkButton></div>
        </section>
      </div>
      <section className="cp-block cp-detail-side" aria-labelledby="cp-procedure">
        <h2 id="cp-procedure">{tr('Verification procedure', 'Prosedur verifikasi')}</h2>
        <Steps items={[
          {body: tr('Wire with power off; inspect exact breakout labels.', 'Rangkai dengan daya mati; periksa label breakout dengan teliti.')},
          {body: tr('Authorize a USB node, compile, flash, capture serial checks.', 'Izinkan node USB, compile, flash, lalu rekam pemeriksaan serial.')},
          {body: tr('Power off; disconnect shared SDA; rerun.', 'Matikan daya; lepas SDA bersama; jalankan ulang.')},
          {body: tr('Inspect the mismatch and diagnosis.', 'Periksa ketidaksesuaian dan diagnosisnya.')},
          {body: tr('Power off; restore SDA; confirm repair and retest.', 'Matikan daya; pasang kembali SDA; konfirmasi perbaikan dan uji ulang.')},
        ]}/>
        <Notice>{tr('OLED ACK does not prove pixels are visible. Record a human observation separately.', 'ACK OLED tidak membuktikan piksel terlihat. Catat pengamatan manusia secara terpisah.')}</Notice>
      </section>
    </div> : <EmptyState eyebrow="404" title={tr('No challenge with this identifier.', 'Tidak ada tantangan dengan pengenal ini.')} action={<LinkButton to="/arena" variant="secondary">{tr('Back to Arena', 'Kembali ke Arena')} <ArrowRightIcon aria-hidden="true"/></LinkButton>}/>}
  </PageShell>;
}

export function Builders() {
  const {tr} = useLang();
  const principles: [string, string, string, string][] = [
    ['Named builders', 'Builder bernama', 'Public profiles require participation and consent.', 'Profil publik memerlukan partisipasi dan persetujuan.'],
    ['Verifiable skills', 'Keahlian yang dapat diverifikasi', 'Evidence links the builder to work performed.', 'Bukti menghubungkan builder dengan pekerjaan yang dilakukan.'],
    ['Engineering ownership', 'Kepemilikan rekayasa', 'Students are future engineers, not anonymous labor.', 'Pelajar adalah calon insinyur, bukan tenaga kerja anonim.'],
  ];
  return <PageShell eyebrow={tr('Hardware Fellows / program preview', 'Hardware Fellows / pratinjau program')} title={tr('Builders are the heroes.', 'Builder adalah pahlawannya.')} lead={tr('Vocational students, makers and engineers deserve named engineering credit.', 'Siswa vokasi, maker, dan insinyur layak mendapat pengakuan rekayasa atas nama mereka.')}>
    <div className="cp-stack">
      <EmptyState eyebrow={tr('No fellow profiles published', 'Belum ada profil fellow yang dipublikasikan')} title={tr('Earned through experiments. Never invented for a page.', 'Diraih lewat eksperimen. Tidak pernah dikarang untuk halaman.')}>{tr('Future profiles will connect skills, Arena participation and verified experiments. The founder and legal attribution remain transparent.', 'Profil mendatang akan menghubungkan keahlian, partisipasi Arena, dan eksperimen terverifikasi. Pendiri dan atribusi hukum tetap transparan.')}</EmptyState>
      <ul className="cp-grid cp-grid--3">{principles.map(([en, id, enText, idText], i) => <Card as="li" key={en} className="cp-method"><span className="cp-index">{pad(i + 1)}</span><h3>{tr(en, id)}</h3><p>{tr(enText, idText)}</p></Card>)}</ul>
    </div>
  </PageShell>;
}

export function Research() {
  const {tr} = useLang();
  const items: {to: string; index: string; title: string; text: string}[] = [
    {to: '/bench', index: tr('Method / 001', 'Metode / 001'), title: tr('PhysicalBench protocol', 'Protokol PhysicalBench'), text: tr('Evidence-backed correctness, diagnosis, repair and reliability.', 'Ketepatan, diagnosis, perbaikan, dan keandalan yang didukung bukti.')},
    {to: '/docs', index: tr('Spec / 001', 'Spesifikasi / 001'), title: tr('Hardware Contract & evidence', 'Hardware Contract & bukti'), text: tr('Machine-readable expected state, immutable experiment artifacts.', 'Kondisi yang diharapkan dalam format mesin, artefak eksperimen yang tidak dapat diubah.')},
    {to: '/arena/room-monitor', index: tr('Experiment / 001', 'Eksperimen / 001'), title: tr('Room monitor recovery', 'Pemulihan monitor ruangan'), text: tr('A proposed physical procedure. Simulator available; no physical results published.', 'Usulan prosedur fisik. Simulator tersedia; belum ada hasil fisik yang dipublikasikan.')},
  ];
  return <PageShell eyebrow={tr('Research / open engineering', 'Riset / rekayasa terbuka')} title={tr('Teach agents reality.', 'Ajarkan realitas kepada agen.')} lead={tr('The contract, evidence protocol and first experiment are the starting point.', 'Kontrak, protokol bukti, dan eksperimen pertama adalah titik awalnya.')}>
    <div className="cp-stack">
      <ul className="cp-list">{items.map(item => <li key={item.to}><CardLink to={item.to} className="cp-list-item"><span className="cp-index">{item.index}</span><span className="cp-list-text"><strong>{item.title}</strong><span>{item.text}</span></span><ArrowUpRightIcon size={22} aria-hidden="true"/></CardLink></li>)}</ul>
      <Notice>{tr('Source lives in the local project. No public GitHub repository or partner affiliation is claimed. Open-source dependency notices are documented in the README.', 'Kode sumber berada di proyek lokal. Tidak ada klaim repositori GitHub publik atau afiliasi mitra. Pemberitahuan dependensi open-source didokumentasikan di README.')}</Notice>
    </div>
  </PageShell>;
}

type DocSection = {id: string; title: string; body: ReactNode};

export function Docs({apiOverview = false}: {apiOverview?: boolean}) {
  const {tr} = useLang();
  const sections: DocSection[] = [
    {id: 'start', title: tr('Start the workspace', 'Jalankan workspace'), body: <>
      <CodeBlock label={tr('Terminal', 'Terminal')}>npm install{'\n'}npm run dev</CodeBlock>
      <SpecList rows={[['Web', <code key="w">http://127.0.0.1:5173</code>], ['API', <code key="a">http://127.0.0.1:8787</code>]]}/>
    </>},
    {id: 'hardware', title: tr('Connect physical hardware', 'Hubungkan perangkat fisik'), body: <Steps items={[
      {body: tr('Install Arduino CLI. HardwareMCP handles detection, compilation, upload and serial capture.', 'Pasang Arduino CLI. HardwareMCP menangani deteksi, kompilasi, upload, dan perekaman serial.')},
      {body: <>{tr('Run', 'Jalankan')} <code>bash runtime/local-bridge/setup.sh</code> {tr('for pinned ESP32 core and Adafruit libraries.', 'untuk core ESP32 dan library Adafruit dengan versi terkunci.')}</>},
      {body: tr('With power off, wire BME280 and OLED to 3.3V, GND, GPIO21/SDA and GPIO22/SCL.', 'Dengan daya mati, hubungkan BME280 dan OLED ke 3.3V, GND, GPIO21/SDA, dan GPIO22/SCL.')},
      {body: tr('Connect USB, select Local board and authorize the detected node.', 'Hubungkan USB, pilih Local board, dan izinkan node yang terdeteksi.')},
      {body: tr('Compile, flash and verify. Check the OLED visually as an extra human observation.', 'Compile, flash, dan verifikasi. Periksa OLED secara visual sebagai pengamatan manusia tambahan.')},
    ]}/>},
    {id: 'evidence', title: tr('Evidence levels', 'Tingkat bukti'), body: <ul className="cp-grid cp-grid--3">
      <Card as="li" className="cp-method"><Tag>Simulated verified</Tag><p>{tr('Proves the software scenario.', 'Membuktikan skenario perangkat lunak.')}</p></Card>
      <Card as="li" className="cp-method"><Tag tone="ok">Verified</Tag><p>{tr('Requires every named physical check and a matched firmware/contract identity.', 'Memerlukan setiap pemeriksaan fisik yang ditentukan serta identitas firmware/kontrak yang cocok.')}</p></Card>
      <Card as="li" className="cp-method"><Tag tone="warn">{tr('Not in v1', 'Belum di v1')}</Tag><p>{tr('No camera or electrical probe measurement exists in v1.', 'Belum ada pengukuran kamera atau probe listrik di v1.')}</p></Card>
    </ul>},
    {id: 'trust', title: tr('Runtime trust', 'Kepercayaan runtime'), body: <SpecList rows={[
      [tr('Network', 'Jaringan'), tr('The API binds to loopback and rejects other origins.', 'API hanya terikat ke loopback dan menolak origin lain.')],
      [tr('Session', 'Sesi'), tr('Requires a local session header.', 'Memerlukan header sesi lokal.')],
      [tr('Flashing', 'Flashing'), tr('Authorization is scoped to a detected port for 20 minutes.', 'Otorisasi dibatasi pada port yang terdeteksi selama 20 menit.')],
      [tr('Prompts', 'Prompt'), tr('Prompts never become shell commands.', 'Prompt tidak pernah menjadi perintah shell.')],
    ]}/>},
    {id: 'api', title: tr('Local API', 'API lokal'), body: <>
      <CodeBlock label="HTTP">GET /api{'\n'}GET /api/session{'\n'}GET /api/hardware{'\n'}GET /api/challenges{'\n'}GET /api/projects{'\n'}POST /api/projects {`{goal, challengeId?, challengeVersion?}`}{'\n'}GET /api/projects/:id{'\n'}GET /api/projects/:id/events?after=0{'\n'}POST /api/projects/:id/chat{'\n'}POST /api/projects/:id/run{'\n'}POST /api/projects/:id/retry{'\n'}GET /api/remote-jobs{'\n'}POST /api/runtime/trust</CodeBlock>
      <p>{tr('Include', 'Sertakan')} <code>X-IOT-Session</code> {tr('from the local session endpoint. Events are replayable using ordered sequence numbers.', 'dari endpoint sesi lokal. Event dapat diputar ulang menggunakan nomor urut.')}</p>
    </>},
    {id: 'inputs', title: tr('Run & repair input', 'Input run & perbaikan'), body: <div className="cp-code-pair">
      <CodeBlock label={tr('Run input', 'Input run')}>{JSON.stringify({mode: 'simulation', fault: 'none'}, null, 2)}</CodeBlock>
      <CodeBlock label={tr('Repair input', 'Input perbaikan')}>{JSON.stringify({mode: 'simulation', parentId: 'failed-experiment-id', repairConfirmed: true}, null, 2)}</CodeBlock>
    </div>},
    {id: 'episodes', title: tr('Experience episodes', 'Episode pengalaman'), body: <>
      <p>{tr('Build with AI and Learn & Verify share the same episode. Record actions and manual measurements locally; they never replace runtime checks. Local JSON export is available separately from permission-gated research reuse.', 'Build with AI dan Learn & Verify berbagi episode yang sama. Catat tindakan dan pengukuran manual secara lokal; keduanya tidak pernah menggantikan pemeriksaan runtime. Ekspor JSON lokal tersedia terpisah dari penggunaan ulang riset yang memerlukan izin.')}</p>
      <CodeBlock label="HTTP">GET /api/projects/:id/episode?purpose=local{'\n'}POST /api/projects/:id/actions{'\n'}POST /api/projects/:id/environment{'\n'}POST /api/projects/:id/rights</CodeBlock>
    </>},
    {id: 'agents', title: tr('AgentProvider & context', 'AgentProvider & konteks'), body: <>
      <p>{tr('The default JevProvider routes bounded decisions, then GPT-6.1 Sol low proposes a plan or diagnosis. OpenViking retrieves specifications and stores contract, failure and repair notes. Deterministic manifests remain electrical authority.', 'JevProvider bawaan merutekan keputusan terbatas, lalu GPT-6.1 Sol low mengusulkan rencana atau diagnosis. OpenViking mengambil spesifikasi dan menyimpan catatan kontrak, kegagalan, dan perbaikan. Manifes deterministik tetap menjadi otoritas kelistrikan.')}</p>
      <p>{tr('See README for authentic provider setup, optional OpenAI Responses integration and OpenViking local embeddings. Missing services are recorded as unavailable; no silent mock provider.', 'Lihat README untuk penyiapan provider asli, integrasi OpenAI Responses opsional, dan embedding lokal OpenViking. Layanan yang tidak ada dicatat sebagai tidak tersedia; tidak ada provider tiruan diam-diam.')}</p>
    </>},
    {id: 'mcp', title: tr('MCP boundary', 'Batas MCP'), body: <>
      <CodeBlock label={tr('Terminal', 'Terminal')}>npm run api:mcp{'\n'}npm run coordinator:mcp</CodeBlock>
      <SpecList rows={[
        [<code key="a">api:mcp</code>, tr('Exposes this API as a local MCP stdio server (challenges, projects, chat, simulation runs; physical runs stay human-gated).', 'Membuka API ini sebagai server MCP stdio lokal (tantangan, proyek, chat, run simulasi; run fisik tetap memerlukan persetujuan manusia).')],
        [<code key="c">coordinator:mcp</code>, tr('Exposes owner coordination tools.', 'Membuka alat koordinasi pemilik.')],
        [tr('Hardware bridge', 'Jembatan perangkat'), tr('Uses the pinned Arduino MCP server over local stdio.', 'Menggunakan server Arduino MCP dengan versi terkunci melalui stdio lokal.')],
      ]}/>
    </>},
  ];
  const apiFirst = ['api', 'inputs', 'episodes', 'trust', 'mcp', 'agents', 'start', 'hardware', 'evidence'];
  const ordered = apiOverview ? apiFirst.map(id => sections.find(s => s.id === id)!) : sections;
  const prefix = apiOverview ? 'api-' : 'docs-';
  return <PageShell eyebrow={apiOverview ? tr('API / local v1', 'API / lokal v1') : tr('Docs / local runtime', 'Dokumentasi / runtime lokal')} title={apiOverview ? tr('A contract with reality.', 'Kontrak dengan realitas.') : tr('Bring your own board.', 'Bawa papan Anda sendiri.')} lead={tr('Run locally. Preserve evidence. Know what has actually been tested.', 'Jalankan secara lokal. Simpan bukti. Ketahui apa yang benar-benar sudah diuji.')}>
    <div className="cp-docs">
      <nav className="cp-toc" aria-label={tr('On this page', 'Di halaman ini')}>
        <Eyebrow>{tr('On this page', 'Di halaman ini')}</Eyebrow>
        <ol>{ordered.map((section, i) => <li key={section.id}><a href={'#' + prefix + section.id}><span className="cp-index">{pad(i + 1)}</span>{section.title}</a></li>)}</ol>
      </nav>
      <div className="cp-docs-body">{ordered.map((section, i) => <section key={section.id} id={prefix + section.id} className="cp-doc-section" aria-labelledby={prefix + section.id + '-title'}>
        <h2 id={prefix + section.id + '-title'}><span className="cp-index">{pad(i + 1)}</span>{section.title}</h2>
        {section.body}
      </section>)}</div>
    </div>
  </PageShell>;
}

export function Learn() {
  const {tr} = useLang();
  return <PageShell eyebrow={tr('Learn & Verify / academy local pilot', 'Belajar & Verifikasi / pilot akademi lokal')} title={tr('Learn by proving.', 'Belajar dengan membuktikan.')} lead={tr('Build real hardware. Record the reasoning. Keep the evidence.', 'Rakit perangkat nyata. Catat penalarannya. Simpan buktinya.')}><LearnContent/></PageShell>;
}

export function EpisodePage() {
  const {tr} = useLang();
  return <PageShell eyebrow={tr('Physical agent experience / episode', 'Pengalaman agen fisik / episode')} title={tr('Every attempt matters.', 'Setiap percobaan berarti.')} lead={tr('An ordered trace of plans, actions, tests, failures and repairs.', 'Jejak berurutan dari rencana, tindakan, pengujian, kegagalan, dan perbaikan.')}><EpisodeContent/></PageShell>;
}

export function NotFound() {
  const {tr} = useLang();
  return <PageShell width="narrow" eyebrow={tr('404 / route not found', '404 / rute tidak ditemukan')} title={tr('Off the map.', 'Di luar peta.')} lead={tr('This route does not exist.', 'Rute ini tidak ada.')} actions={<>
    <LinkButton to="/" variant="primary">{tr('Back to home', 'Kembali ke beranda')} <ArrowRightIcon aria-hidden="true"/></LinkButton>
    <LinkButton to="/hardware" variant="secondary">{tr('Browse hardware', 'Jelajahi perangkat')}</LinkButton>
  </>}>{null}</PageShell>;
}
