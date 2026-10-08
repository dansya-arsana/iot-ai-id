import './build-progression-guide.css';

const stages = [
  {title: 'Kenali koneksi breadboard', tools: 'Breadboard, jumper, multimeter mode kontinuitas.', steps: ['Mulai tanpa catu daya. Kenali kelompok lubang terminal, celah tengah, dan rail daya.', 'Periksa kontinuitas rail: rail dapat terputus di tengah dan sisi berlawanan belum tentu terhubung.', 'Gambar koneksi berdasarkan pin dan net pada kontrak; warna kabel hanya membantu membaca.'], ready: 'Dapat menjelaskan lubang mana yang terhubung dan menunjukkan peta VCC, GND, SDA, dan SCL.'},
  {title: 'Bangun dan uji di breadboard', tools: 'Resep ESP32, modul yang sesuai, jumper, USB dan multimeter.', steps: ['Dengan daya mati, pasang modul dan jumper sesuai pin mapping. Gunakan tegangan rendah sesuai spesifikasi; resep room monitor memakai logika 3.3 V.', 'Periksa polaritas, common ground, dan koneksi daya sebelum menyalakan. Ikuti pemeriksaan fisik pada episode.', 'Catat bacaan, kondisi, kegagalan dan perbaikan. Matikan daya sebelum mengubah kabel.'], ready: 'Koneksi terdokumentasi dan hasil pemeriksaan fisik dapat diulang setelah perbaikan; hasil model saja belum cukup.'},
  {title: 'Pindah ke perfboard / papan solder', tools: 'Papan prototipe, solder, alat solder, multimeter dan pendamping terlatih.', steps: ['Latih penyolderan pada papan latihan bersama guru atau pendamping. Ikuti panduan alat, pelindung mata dan ventilasi.', 'Salin peta net dari rangkaian breadboard yang sudah diuji. Perfboard dengan pad terpisah perlu penghubung sendiri; Adafruit Perma-Proto memiliki pola koneksi mirip breadboard. Periksa papan yang digunakan.', 'Tanpa daya, periksa sambungan dan kontinuitas tiap net serta kemungkinan hubungan pendek antar net yang seharusnya terpisah. Setelah inspeksi, ulangi pemeriksaan fisik dengan daya yang sesuai.'], ready: 'Pendamping meninjau solder dan pemetaan; tidak ada koneksi tak sengaja yang ditemukan, dan pengujian fisik diulang pada rakitan baru.'},
  {title: 'Siapkan desain PCB berikutnya', tools: 'Skema, pinout resmi, BOM, catatan uji dan alat desain PCB eksternal.', steps: ['Bekukan skema dan daftar komponen berdasarkan rakitan yang sudah diuji; pastikan footprint sesuai varian komponen.', 'Bawa kebutuhan daya, konektor, dimensi dan titik ukur ke desain PCB. Minta review skema dan layout serta jalankan ERC/DRC di alat desain.', 'Rencanakan inspeksi dan pengujian ulang PCB pertama sebelum digunakan.'], ready: 'Paket skema, BOM, kebutuhan mekanik dan catatan uji siap untuk review. Generator PCB, ekspor skema, ERC/DRC dan validasi layout belum tersedia di V1.'},
];

export function BuildProgressionGuide() {
  return <section className="build-progression" aria-label="Jalur belajar perakitan">
    <span className="mono accent">JALUR BELAJAR / DARI PROTOTIPE KE RAKITAN</span>
    <h3>Mulai di breadboard. Naik tahap dengan bukti.</h3>
    <p>Untuk pelajar sekolah, breadboard membuat koneksi mudah dicoba dan diperbaiki tanpa solder. Buka tahap sesuai kebutuhan, lalu tinjau bukti bersama guru atau pendamping. Panduan ini tidak menyimpan progres atau menyatakan kelulusan. Canvas memeriksa koneksi antar pin; lubang dan kontinuitas rail breadboard masih perlu diperiksa langsung.</p>
    {stages.map((stage, index) => <details key={stage.title}>
      <summary><span className="mono">0{index + 1}</span> {stage.title}</summary>
      <div className="build-progression-body"><p><strong>Alat:</strong> {stage.tools}</p><ol>{stage.steps.map(step => <li key={step}>{step}</li>)}</ol><p><strong>Siap naik tahap bila:</strong> {stage.ready}</p></div>
    </details>)}
    <p className="build-progression-sources">Panduan produsen: <a href="https://learn.adafruit.com/breadboards-for-beginners" target="_blank" rel="noreferrer">Breadboard untuk pemula</a> · <a href="https://learn.adafruit.com/breadboards-for-beginners/perma-protos" target="_blank" rel="noreferrer">Perma-Proto</a> · <a href="https://learn.adafruit.com/adafruit-guide-excellent-soldering" target="_blank" rel="noreferrer">Teknik solder</a></p>
  </section>;
}
