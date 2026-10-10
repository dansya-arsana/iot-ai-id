import {ArrowUpRightIcon, CheckCircleIcon, PlusIcon} from '@phosphor-icons/react';
import {useLang} from './i18n';
import {Eyebrow} from './ui';
import './build-progression-guide.css';

type Copy = {en: string; id: string};
type Stage = {title: Copy; tools: Copy; steps: Copy[]; ready: Copy};

const stages: Stage[] = [
  {
    title: {en: 'Learn how a breadboard connects', id: 'Kenali koneksi breadboard'},
    tools: {en: 'Breadboard, jumper wires, multimeter in continuity mode.', id: 'Breadboard, jumper, multimeter mode kontinuitas.'},
    steps: [
      {en: 'Start without power. Identify the terminal strips, the centre gap and the power rails.', id: 'Mulai tanpa catu daya. Kenali kelompok lubang terminal, celah tengah, dan rail daya.'},
      {en: 'Check rail continuity: a rail can be split in the middle, and the rails on opposite sides are not necessarily connected.', id: 'Periksa kontinuitas rail: rail dapat terputus di tengah dan sisi berlawanan belum tentu terhubung.'},
      {en: 'Draw connections from the pins and nets in the contract; wire colours only help you read the board.', id: 'Gambar koneksi berdasarkan pin dan net pada kontrak; warna kabel hanya membantu membaca.'},
    ],
    ready: {en: 'You can explain which holes are connected and point out the VCC, GND, SDA and SCL map.', id: 'Dapat menjelaskan lubang mana yang terhubung dan menunjukkan peta VCC, GND, SDA, dan SCL.'},
  },
  {
    title: {en: 'Build and test on the breadboard', id: 'Bangun dan uji di breadboard'},
    tools: {en: 'ESP32 recipe, matching modules, jumper wires, USB and a multimeter.', id: 'Resep ESP32, modul yang sesuai, jumper, USB dan multimeter.'},
    steps: [
      {en: 'With power off, place the modules and jumpers according to the pin mapping. Use low voltage within the specification; the room monitor recipe uses 3.3 V logic.', id: 'Dengan daya mati, pasang modul dan jumper sesuai pin mapping. Gunakan tegangan rendah sesuai spesifikasi; resep room monitor memakai logika 3.3 V.'},
      {en: 'Check polarity, common ground and power connections before switching on. Follow the physical checks in the episode.', id: 'Periksa polaritas, common ground, dan koneksi daya sebelum menyalakan. Ikuti pemeriksaan fisik pada episode.'},
      {en: 'Record readings, conditions, failures and repairs. Switch power off before changing any wiring.', id: 'Catat bacaan, kondisi, kegagalan dan perbaikan. Matikan daya sebelum mengubah kabel.'},
    ],
    ready: {en: 'Connections are documented and the physical check can be repeated after repairs; model output alone is not enough.', id: 'Koneksi terdokumentasi dan hasil pemeriksaan fisik dapat diulang setelah perbaikan; hasil model saja belum cukup.'},
  },
  {
    title: {en: 'Move to perfboard / a soldered board', id: 'Pindah ke perfboard / papan solder'},
    tools: {en: 'Prototyping board, solder, soldering iron, multimeter and a trained supervisor.', id: 'Papan prototipe, solder, alat solder, multimeter dan pendamping terlatih.'},
    steps: [
      {en: 'Practise soldering on a scrap board with a teacher or supervisor. Follow the tool guidance, wear eye protection and keep the room ventilated.', id: 'Latih penyolderan pada papan latihan bersama guru atau pendamping. Ikuti panduan alat, pelindung mata dan ventilasi.'},
      {en: 'Copy the net map from the tested breadboard circuit. Perfboard with separate pads needs its own connections; the Adafruit Perma-Proto has a breadboard-like connection pattern. Check the board you are using.', id: 'Salin peta net dari rangkaian breadboard yang sudah diuji. Perfboard dengan pad terpisah perlu penghubung sendiri; Adafruit Perma-Proto memiliki pola koneksi mirip breadboard. Periksa papan yang digunakan.'},
      {en: 'Without power, check every joint and the continuity of each net, and look for shorts between nets that should stay separate. After inspection, repeat the physical check with suitable power.', id: 'Tanpa daya, periksa sambungan dan kontinuitas tiap net serta kemungkinan hubungan pendek antar net yang seharusnya terpisah. Setelah inspeksi, ulangi pemeriksaan fisik dengan daya yang sesuai.'},
    ],
    ready: {en: 'A supervisor has reviewed the soldering and mapping, no accidental connections were found, and physical testing was repeated on the new assembly.', id: 'Pendamping meninjau solder dan pemetaan; tidak ada koneksi tak sengaja yang ditemukan, dan pengujian fisik diulang pada rakitan baru.'},
  },
  {
    title: {en: 'Prepare the next PCB design', id: 'Siapkan desain PCB berikutnya'},
    tools: {en: 'Schematic, official pinouts, BOM, test notes and an external PCB design tool.', id: 'Skema, pinout resmi, BOM, catatan uji dan alat desain PCB eksternal.'},
    steps: [
      {en: 'Freeze the schematic and parts list from the tested assembly; make sure footprints match the component variants.', id: 'Bekukan skema dan daftar komponen berdasarkan rakitan yang sudah diuji; pastikan footprint sesuai varian komponen.'},
      {en: 'Carry power needs, connectors, dimensions and test points into the PCB design. Ask for a schematic and layout review and run ERC/DRC in the design tool.', id: 'Bawa kebutuhan daya, konektor, dimensi dan titik ukur ke desain PCB. Minta review skema dan layout serta jalankan ERC/DRC di alat desain.'},
      {en: 'Plan inspection and re-testing of the first PCB before it is used.', id: 'Rencanakan inspeksi dan pengujian ulang PCB pertama sebelum digunakan.'},
    ],
    ready: {en: 'The schematic, BOM, mechanical requirements and test notes are ready for review. PCB generation, schematic export, ERC/DRC and layout validation are not available in V1.', id: 'Paket skema, BOM, kebutuhan mekanik dan catatan uji siap untuk review. Generator PCB, ekspor skema, ERC/DRC dan validasi layout belum tersedia di V1.'},
  },
];

const sources: {href: string; title: Copy}[] = [
  {href: 'https://learn.adafruit.com/breadboards-for-beginners', title: {en: 'Breadboards for beginners', id: 'Breadboard untuk pemula'}},
  {href: 'https://learn.adafruit.com/breadboards-for-beginners/perma-protos', title: {en: 'Perma-Proto', id: 'Perma-Proto'}},
  {href: 'https://learn.adafruit.com/adafruit-guide-excellent-soldering', title: {en: 'Soldering technique', id: 'Teknik solder'}},
];

const pad = (n: number) => String(n).padStart(2, '0');

export function BuildProgressionGuide() {
  const {tr} = useLang();
  const t = (copy: Copy) => tr(copy.en, copy.id);
  return <section className="build-progression bpg" aria-label={tr('Assembly learning path', 'Jalur belajar perakitan')}>
    <header className="bpg-header">
      <Eyebrow rule>{tr('LEARNING PATH / FROM PROTOTYPE TO ASSEMBLY', 'JALUR BELAJAR / DARI PROTOTIPE KE RAKITAN')}</Eyebrow>
      <h2>{tr('Start on a breadboard. Move up with evidence.', 'Mulai di breadboard. Naik tahap dengan bukti.')}</h2>
      <p className="bpg-lead">{tr(
        'For school learners, a breadboard makes connections easy to try and fix without soldering. Open the stage you need, then review the evidence with a teacher or supervisor. This guide does not save progress or declare anyone passed. The canvas checks pin-to-pin connections; breadboard holes and rail continuity still need to be checked by hand.',
        'Untuk pelajar sekolah, breadboard membuat koneksi mudah dicoba dan diperbaiki tanpa solder. Buka tahap sesuai kebutuhan, lalu tinjau bukti bersama guru atau pendamping. Panduan ini tidak menyimpan progres atau menyatakan kelulusan. Canvas memeriksa koneksi antar pin; lubang dan kontinuitas rail breadboard masih perlu diperiksa langsung.',
      )}</p>
    </header>
    <div className="bpg-stages">
      {stages.map((stage, index) => <details key={stage.title.en} className="bpg-stage">
        <summary>
          <span className="bpg-index" aria-hidden="true">{pad(index + 1)}</span>
          <span className="bpg-title"><span className="ds-sr-only">{tr('Stage', 'Tahap')} {index + 1}: </span>{t(stage.title)}</span>
          <PlusIcon className="bpg-toggle" aria-hidden="true"/>
        </summary>
        <div className="build-progression-body bpg-body">
          <div className="bpg-tools">
            <span className="bpg-label">{tr('Tools', 'Alat')}</span>
            <p>{t(stage.tools)}</p>
          </div>
          <ol className="bpg-steps">
            {stage.steps.map((step, stepIndex) => <li key={step.en}>
              <span className="bpg-step-index" aria-hidden="true">{pad(index + 1)}.{stepIndex + 1}</span>
              <p>{t(step)}</p>
            </li>)}
          </ol>
          <div className="bpg-ready">
            <CheckCircleIcon size={18} weight="bold" aria-hidden="true"/>
            <div>
              <span className="bpg-label">{tr('Ready for the next stage when', 'Siap naik tahap bila')}</span>
              <p>{t(stage.ready)}</p>
            </div>
          </div>
        </div>
      </details>)}
    </div>
    <div className="build-progression-sources bpg-sources">
      <span className="bpg-label">{tr('Manufacturer guides', 'Panduan produsen')}</span>
      <ul>
        {sources.map(source => <li key={source.href}>
          <a className="ds-text-link" href={source.href} target="_blank" rel="noopener noreferrer">
            {t(source.title)}<ArrowUpRightIcon aria-hidden="true"/><span className="ds-sr-only"> {tr('(opens in a new tab)', '(membuka tab baru)')}</span>
          </a>
        </li>)}
      </ul>
    </div>
  </section>;
}
