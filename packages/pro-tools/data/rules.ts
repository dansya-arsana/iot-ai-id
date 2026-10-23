/**
 * Design rules (agri-domain §7) as data. Policy (agri-domain §0): a rule may be an `error` only when its grade is A or B;
 * grades C and M can at most warn. `effectiveSeverity` applies that clamp.
 * Founder overrides: Kominfo power/duty rules (NET-02, NET-03, NET-04, NET-06) are `info` only (the company holds an official licence);
 * NET-05 (433/868 MHz module) is an `error` in Pro.
 */
export type RuleSeverity='error'|'warning'|'info';
export type RuleGrade='A'|'B'|'C'|'M';
export type Rule={id:string;area:'NET'|'PWR'|'SEN'|'CROP'|'ACT'|'ENC';severity:RuleSeverity;grade:RuleGrade;en:string;idn:string};
const R=(id:string,severity:RuleSeverity,grade:RuleGrade,en:string,idn:string):Rule=>({id,area:id.split('-')[0] as Rule['area'],severity,grade,en,idn});
export const RULES:Record<string,Rule>=Object.fromEntries([
 R('NET-01','error','A','Indonesia LPWA band is 920-923 MHz. Use AS923-2 or 920.2-922.8 MHz.','Pita LPWA Indonesia 920-923 MHz. Gunakan AS923-2 atau 920,2-922,8 MHz.'),
 R('NET-02','info','A','End-node EIRP above 100 mW (20 dBm). Information only: the company holds an official licence.','EIRP node di atas 100 mW (20 dBm). Hanya informasi: perusahaan memegang izin resmi.'),
 R('NET-03','info','A','Gateway power above the Kominfo class-licence figure (200 mW conducted, 400 mW EIRP). Information only.','Daya gateway di atas angka izin kelas Kominfo (200 mW konduksi, 400 mW EIRP). Hanya informasi.'),
 R('NET-04','info','A','Estimated airtime exceeds the 1% uplink duty figure. Information only.','Perkiraan airtime melebihi angka duty 1% uplink. Hanya informasi.'),
 R('NET-05','error','A','A 433 or 868 MHz LoRa module (for example RA-02) cannot run in the 920-923 MHz band. Use RFM95W, Ra-01H or SX1262 915.','Modul LoRa 433 atau 868 MHz (misalnya RA-02) tidak bisa bekerja di pita 920-923 MHz. Gunakan RFM95W, Ra-01H atau SX1262 915.'),
 R('NET-06','info','A','LoRa equipment: confirm Komdigi/SDPPI device certification before commercial deployment. TKDN unverified.','Perangkat LoRa: pastikan sertifikasi Komdigi/SDPPI sebelum penggunaan komersial. TKDN belum diverifikasi.'),
 R('NET-07','warning','M','Long LoRa link. Raise the gateway antenna (6-10 m mast) or add a relay, then survey RSSI (target above -115 dBm, SNR above -7 dB at SF10).','Link LoRa panjang. Naikkan antena gateway (tiang 6-10 m) atau tambah relay, lalu survei RSSI (target di atas -115 dBm, SNR di atas -7 dB pada SF10).'),
 R('NET-08','warning','M','Wi-Fi node far from the access point or in an open field. Use LoRa or an outdoor CPE.','Node Wi-Fi jauh dari access point atau di lahan terbuka. Gunakan LoRa atau CPE outdoor.'),
 R('NET-09','error','A','RS-485 bus over 1200 m at 9600 bps, over 32 units, or not a daisy chain.','Bus RS-485 lebih dari 1200 m pada 9600 bps, lebih dari 32 unit, atau bukan daisy chain.'),
 R('NET-10','warning','M','RS-485 run over 30 m or leaving a building: fit surge protection or isolation at both ends.','Jalur RS-485 lebih dari 30 m atau keluar gedung: pasang proteksi surja atau isolasi di kedua ujung.'),
 R('PWR-01','error','M','Battery or panel is smaller than the sizing method needs. Resize it.','Baterai atau panel lebih kecil dari kebutuhan metode sizing. Ubah ukurannya.'),
 R('PWR-02','warning','M','DevKit sleep current is 5-15 mA. Use a bare module or a low-Iq LDO, or budget 10 mA.','Arus sleep DevKit 5-15 mA. Pakai modul polos atau LDO low-Iq, atau anggarkan 10 mA.'),
 R('PWR-03','error','M','Charge controller must match the battery chemistry, cut off on temperature, and carry at least 1.25 x Isc.','Charge controller harus cocok dengan kimia baterai, cut-off suhu, dan minimal 1,25 x Isc.'),
 R('PWR-04','warning','M','AC load above 100 W on a solar node. Feed it from PLN or a genset.','Beban AC di atas 100 W pada node surya. Suplai dari PLN atau genset.'),
 R('PWR-06','warning','M','Autonomy is below 3 days (5 days for highland or rainy-season sites).','Otonomi di bawah 3 hari (5 hari untuk dataran tinggi atau musim hujan).'),
 R('PWR-07','warning','A','Solar design uses the annual average of about 4.8 peak sun hours. Design for 3.5 (wet-season month).','Desain surya memakai rata-rata tahunan sekitar 4,8 jam puncak. Rancang untuk 3,5 (bulan musim hujan).'),
 R('SEN-01','error','M','A resistive soil sensor (FC-28/YL-69) corrodes in weeks outdoors. Use capacitive v1.2 or RS-485.','Sensor tanah resistif (FC-28/YL-69) berkarat dalam hitungan minggu di luar ruangan. Pakai kapasitif v1.2 atau RS-485.'),
 R('SEN-10','warning','M','HC-SR04 is not waterproof. Use JSN-SR04T or a pressure transmitter.','HC-SR04 tidak tahan air. Pakai JSN-SR04T atau transmiter tekanan.'),
 R('SEN-11','warning','M','DS18B20 or DHT22 cable over 20 m: expect signal problems.','Kabel DS18B20 atau DHT22 lebih dari 20 m: sinyal rawan bermasalah.'),
 R('CROP-03','error','C','Melon is grown under cover and needs an air temperature and humidity sensor.','Melon ditanam di bawah atap dan perlu sensor suhu dan kelembapan udara.'),
 R('CROP-04','error','C','Melon needs a ventilation actuator (fan or vent): on above 30 C, alarm above 35 C.','Melon perlu aktuator ventilasi (kipas atau vent): nyala di atas 30 C, alarm di atas 35 C.'),
 R('CROP-10','error','A','Chrysanthemum night-break lamp needs a relay on an RTC schedule (22:00-02:00, vegetative phase only).','Lampu night-break krisan perlu relay dengan jadwal RTC (22:00-02:00, hanya fase vegetatif).'),
 R('CROP-12','warning','M','Chrysanthemum needs a leaf-wetness or humidity sensor for disease-risk warnings.','Krisan perlu sensor kebasahan daun atau kelembapan untuk peringatan risiko penyakit.'),
 R('CROP-15','info','C','Crop thresholds with grade C or M: adjust to local agronomist advice.','Ambang tanaman dengan grade C atau M: sesuaikan dengan saran agronom setempat.'),
 R('ENC-01','error','M','Outdoor enclosure needs IP65 or better (IP66 where exposed to spray or driving rain).','Enclosure outdoor minimal IP65 (IP66 bila terkena semprotan atau hujan deras).'),
 R('ENC-04','error','C','Gateway mast needs an earth electrode (5 ohm target) and an N-type coax arrester at the entry point.','Tiang gateway perlu elektroda grounding (target 5 ohm) dan arrester koaks tipe N di titik masuk.'),
].map(x=>[x.id,x]));
export const effectiveSeverity=(r:Rule):RuleSeverity=>r.severity==='error'&&(r.grade==='C'||r.grade==='M')?'warning':r.severity;
export const rule=(id:string):Rule=>{const x=RULES[id];if(!x)throw new Error(`unknown rule ${id}`);return x;};
