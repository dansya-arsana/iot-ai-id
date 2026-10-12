import type {Region} from './model';
import {SEASONS} from './model';
const BMKG20='https://www.bmkg.go.id/siaran-pers/udara-terasa-panas-dan-gerah-fenomena-biasa-musim-kemarau-bmkg-himbau-masyarakat-ikuti-tips-dari-bmkg';
const KKP='https://kkp.go.id/storage/Materi/profil-pasar-rumput-laut66753a465fe09/materi-66753a4696928.pdf';
const ESDM24='https://www.esdm.go.id/id/media-center/arsip-berita/kementerian-esdm-tuntaskan-program-elektrifikasi-di-tahun-2024';
export const REGIONS:Region[]=[
 {id:'java',name:'Java',code:'J',at:[110.2,-7.7],identity:'The dense, hot, industrial baseline.',cta:'Java',season:SEASONS.monsoon,fit:['amr','ground','drone'],stress:['heat','flood','power'],
  facts:[
   {t:'106 of 179 industrial estates are on Java.',src:'Kemenperin via detik',year:'2026',url:'https://finance.detik.com/industri/d-8551973/kawasan-industri-ri-makin-ramai-investasi-tembus-rp-6-744-triliun',conf:'M',hero:true},
   {t:'Dry-season maximum 32–36 °C, humidity above 80%.',src:'BMKG',year:'2020',url:BMKG20,conf:'H',hero:true},
   {t:'Floods were 1,088 of the 2,107 national disaster events; Central, East and West Java are all in the top six provinces by events.',src:'BNPB Kaleidoskop',year:'2024',url:'https://investortrust.id/national/52352/bnpb-jumlah-bencana-di-indonesia-tahun-2024-sebanyak-2107-kali',conf:'H',hero:true},
   {t:'KEK Kendal lists electronics, automotive and food and beverage.',src:'kek.go.id, PP 85/2019',year:'2019',url:'https://kek.go.id/id/investment/distribution/kek-kendal',conf:'H'},
   {t:'Farm labour is ageing: a secondary analysis of the 2023 Agricultural Census puts the share of older operators on Java above 70%.',src:'Kementan (secondary analysis of ST2023)',year:'2023–2025',url:'https://www.pertanian.go.id/wbs/index.php?show=news&act=view&id=7725',conf:'L'},
  ],tests:['AMR or cobot pilot in a non-air-conditioned plant or warehouse (thermal derating, battery life in heat, recovery from power sags)','Delivery or field robots in monsoon rain (ingress)','Drone spraying and seeding in paddy','A baseline run before going remote']},
 {id:'batam',name:'Batam & Riau Islands',code:'B',at:[104.2,1.8],identity:'The landing pad next to Singapore.',cta:'Batam',season:SEASONS.none,fit:['amr','marine','sensors'],stress:['salt'],
  note:'Drawn on top of Sumatra as a sub-hotspot. No coarse seasonal regime is in our sources for Kepri.',
  facts:[
   {t:'Batam, Bintan and Karimun are free trade and free port zones (FTZ).',src:'Republika (secondary)',year:'n/d',url:'https://ekonomi.republika.co.id/berita/ppe15i383/kek-batam-tawarkan-banyak-insentif-dibandingkan-ftz',conf:'M',hero:true},
   {t:'KEK Nongsa: a 166.45 ha digital-technology zone (PP 68/2021).',src:'kek.go.id',year:'2021',url:'https://kek.go.id/id/investment/distribution/kek-nongsa',conf:'H',hero:true},
   {t:'KEK Tanjung Sauh: electronic components and assembly, designated by PP 24/2024, operations targeted for 2027.',src:'Kemenko Perekonomian',year:'2023',url:'https://ekon.go.id/publikasi/detail/5519/dorong-pertumbuhan-ekonomi-inklusif-dewan-nasional-kek-setujui-pembentukan-tiga-kek-baru',conf:'H',hero:true},
  ],tests:['Shipyard and electronics-plant automation','A marine-grade enclosure soak test on the coast','A staging point for hardware coming from Singapore']},
 {id:'sumatra',name:'Sumatra',code:'S',at:[101.6,-1.2],identity:'The estate-crop belt on peat, with a haze season.',cta:'Sumatra',season:SEASONS.hazeBelt,fit:['ground','drone','sensors'],stress:['haze','power'],
  facts:[
   {t:'Riau produces 19.06% of national crude palm oil; North Sumatra, South Sumatra and Jambi are also in the top seven.',src:'Kementan Pusdatin, Outlook Kelapa Sawit 2024 (2020–24 avg)',year:'2024',url:'https://satudata.pertanian.go.id/assets/docs/publikasi/OUTLOOK_KELAPA_SAWIT_2024_FINAL.pdf',conf:'H',hero:true},
   {t:'Fire and haze risk peaks August–September; Riau, Jambi and South Sumatra are BMKG priority provinces.',src:'BMKG',year:'2026',url:'https://www.bmkg.go.id/berita/utama/bmkg-perkuat-antisipasi-dampak-el-nino-2026-fokus-jaga-ketersediaan-air-dan-cegah-karhutla',conf:'H',hero:true},
   {t:'Rubber is 88.6% smallholder nationally; South Sumatra is the top producer at 28.7% (2020–24 average).',src:'Kementan, Outlook Karet 2025',year:'2025',url:'https://satudata.pertanian.go.id/assets/docs/publikasi/OUTLOOK_KARET_2025_sign.pdf',conf:'H',hero:true},
   {t:'Lampung is a long-standing shrimp aquaculture centre (Dipasena ponds about 6,800 ha); no official province ranking was found.',src:'KKP journal (undated secondary)',year:'n/d',url:'https://ejournal-balitbang.kkp.go.id/index.php/ma/article/view/3289',conf:'L'},
  ],tests:['Palm fruit-bunch harvest aids and loose-fruit collection on soft or peat ground','Drone and optical sensing in haze','Data buffering and ride-through during a regional grid outage']},
 {id:'kalimantan',name:'Kalimantan',code:'K',at:[114,-0.5],identity:'Large estates, coal, haze, and split grids.',cta:'Kalimantan',season:SEASONS.hazeBelt,fit:['ground','drone','sensors'],stress:['haze','power','connectivity'],
  note:'We do not rank provinces by burned area or hotspots: the metrics conflict between sources.',
  facts:[
   {t:'PM10 peaked at 356.93 µg/m³ and visibility fell below 100 m at BMKG Mempawah, August 2018.',src:'BMKG',year:'2018',url:'https://www.bmkg.go.id/siaran-pers/musim-kemarau-meluas-bmkg-waspada-potensi-karhutla',conf:'H',hero:true},
   {t:'Kalimantan produced about 688 Mt of coal, around 82% of national output.',src:'ESDM Minerba via press',year:'2024',url:'https://investortrust.id/business/72085/esdm-selama-dunia-butuh-terang-industri-batu-bara-tak-boleh-padam',conf:'M',hero:true},
   {t:"West Kalimantan's grid is still a separate system that PLN is working to connect.",src:'ESDM',year:'2025',url:'https://esdm.go.id/id/media-center/arsip-berita/percepat-keandalan-jelang-lebaran-wamen-esdm-dorong-interkoneksi-listrik-kalimantan',conf:'H',hero:true},
  ],tests:['LiDAR, camera and filter degradation in haze','Fleet autonomy and telemetry on large estates and in mines, including off-grid charging and LoRa or satellite links','Conveyor and barge-loading inspection']},
 {id:'sulawesi',name:'Sulawesi',code:'L',at:[121.3,-2.2],identity:'Nickel processing, seaweed, cocoa, seismic activity.',cta:'Sulawesi',season:SEASONS.none,fit:['ground','sensors','marine'],stress:['heat','salt','connectivity'],
  note:'Only with a named host in processing environments.',
  facts:[
   {t:"Indonesia is the world's #1 mined nickel producer, about 2.6 Mt in 2025 (estimate); ESDM says reserves are concentrated in Sulawesi and Maluku.",src:'USGS Mineral Commodity Summaries 2026',year:'2026',url:'https://pubs.usgs.gov/periodicals/mcs2026/mcs2026-nickel.pdf',conf:'H',hero:true},
   {t:'South Sulawesi produced 3.80 Mt of the national 9.28 Mt of seaweed in 2022.',src:'KKP',year:'2022',url:KKP,conf:'H',hero:true},
   {t:'Cocoa: Central, Southeast, South and West Sulawesi are the top four provinces; yield fell from 798 to about 719 kg/ha (2016–2025).',src:'Kementan, Outlook Kakao 2025',year:'2025',url:'https://satudata.pertanian.go.id/assets/docs/publikasi/OUTLOOK_KAKAO_2025_sign_rev.pdf',conf:'H',hero:true},
  ],tests:['High-temperature, dust and corrosion endurance and inspection in processing environments (only with a named host)','Offline-first autonomy','Vibration and structural IoT','Seaweed-farm monitoring']},
 {id:'nusa-tenggara',name:'Bali & Nusa Tenggara',code:'N',at:[118.5,-9.6],identity:'Dry, sunny, island grids.',cta:'Bali & Nusa Tenggara',season:SEASONS.monsoon,fit:['sensors','humanoid'],stress:['heat','power','connectivity'],
  facts:[
   {t:'A run of 179 days without rain near Kupang, NTT, in 2021.',src:'BMKG via Kompas TV',year:'2021',url:'https://www.kompas.tv/article/219589/hari-tanpa-hujan-paling-panjang-bmkg-ingatkan-ancaman-kekeringan-di-sejumlah-daerah-ini',conf:'M',hero:true},
   {t:'NTT household electrification was 96.35% in Q4 2024.',src:'Dinas ESDM NTT, provincial data portal',year:'2024',url:'https://sasando.nttprov.go.id/dataset-sektoral/cf3f8495-a465-40d6-9245-a28f5bed71c4/v1/download/pdf',conf:'H',hero:true},
   {t:"KEK Sanur: Indonesia's first health KEK, 41.26 ha.",src:'kek.go.id, PP 41/2022',year:'2022',url:'https://kek.go.id/id/investment/distribution/kek-sanur',conf:'H',hero:true},
   {t:'NTB (especially Sumbawa) is an established vannamei shrimp centre; reported sizes of a planned KKP shrimp estate in East Sumba conflict between sources.',src:'Kontan (secondary)',year:'2024',url:'https://industri.kontan.co.id/news/kkp-bakal-buka-tambak-udang-seluas-1800-hektare-di-ntt',conf:'L'},
  ],tests:['Solar-autonomous sensors with dust and UV endurance','Water and irrigation IoT','Low-bandwidth telemetry','Hospital and hospitality service-robot demos in Bali']},
 {id:'maluku',name:'Maluku',code:'M',at:[128.2,-3.4],identity:'The off-season and intermittent power.',cta:'Maluku (Jun–Aug wet window)',season:SEASONS.maluku,fit:['sensors','marine'],stress:['flood','power','connectivity'],
  facts:[
   {t:"In 7 of Maluku's 40 seasonal zones the rain season runs opposite to the rest of the country (BMKG's \"local\" type, wet around June–August).",src:'BMKG, Prakiraan Musim Hujan 2022/23',year:'2022',url:'https://iklim.bmkg.go.id/publikasi-klimat/ftp/buletin/2022/Buku%20PMH%202022_2023_versi_cetak.pdf',conf:'M',hero:true},
   {t:'305 villages had power 6 hours a day and 200+ villages 12 hours a day.',src:'Minister of ESDM via press',year:'2024',url:'https://investortrust.id/business/50984/bahlil-jamin-keandalan-listrik-di-indonesia-timur-periode-nataru',conf:'M',hero:true},
   {t:'92.4% of the province is water.',src:'Pemprov Maluku, LPPD',year:'2022',url:'https://malukuprov.go.id/storage/2025/03/LPPD-LKIP-Provinsi-Maluku-Tahun-2022-.pdf',conf:'M',hero:true},
   {t:'Regime definition of the "local" rain type.',src:'BBMKG III, seasonal glossary',year:'n/d',url:'https://bbmkg3.bmkg.go.id/daftar-istilah-musim',conf:'H'},
  ],tests:['Wet-season trials in June–August, when western Indonesia is dry','Sleep and wake power management','Store-and-forward over satellite','Fisheries and marine sensors']},
 {id:'papua',name:'Papua',code:'P',at:[137,-4.7],identity:'The off-grid and connectivity extreme.',cta:'Papua',season:SEASONS.none,fit:['sensors','drone'],stress:['power','connectivity','heat'],
  note:'Only with a local host and community engagement.',
  facts:[
   {t:'At the end of 2023, all 140 villages officially without electricity were in the Papua provinces.',src:'ESDM',year:'2024',url:ESDM24,conf:'H',hero:true},
   {t:'Papua Pegunungan: 15.40% of people used the internet in 2025.',src:'BPS via GoodStats',year:'2025',url:'https://data.goodstats.id/statistic/10-provinsi-dengan-akses-internet-terendah-pada-2025-60JTn',conf:'M',hero:true},
   {t:'Sentani sometimes exceeds 36 °C.',src:'BMKG',year:'2020',url:BMKG20,conf:'H',hero:true},
   {t:'Papua has the largest natural sago stands, estimated at about 1.2 M ha; other estimates range from 0.77 to 4.6 M ha and are contested.',src:'Mongabay Indonesia',year:'2018',url:'https://mongabay.co.id/2018/06/30/menjaga-sagu-harapan-menuju-kedaulatan-pangan-papua/',conf:'L'},
  ],tests:['Fully off-grid, satellite-linked sensors and autonomy','Long-endurance and high-terrain drones']},
 {id:'maritime',name:'Maritime Indonesia',code:'',at:[120,-11],identity:'The sea between the islands.',cta:'Coastal & marine',season:SEASONS.none,fit:['marine','sensors','amr'],stress:['salt'],
  note:'Salt corrosion is described in words only: no source gives a number.',
  facts:[
   {t:'17,380 named, coordinate-verified islands.',src:'BIG',year:'2024',url:'https://www.big.go.id/uploads/downloads/Dokumen/Rilis_Jumlah_Pulau.pdf',conf:'H',hero:true},
   {t:'About 108,000 km of coastline, per the 2018 national reference data.',src:'KKP Renstra 2025–2029',year:'2018',url:'https://ppid.kkp.go.id/media/uploads/document_information_public/Renstra_PDSPKP_2025-2029_20260226084715_1_compressed_1.pdf',conf:'M',hero:true},
   {t:'Seaweed production 10.81 Mt in 2024.',src:'KKP DJPB',year:'2024',url:KKP,conf:'H',hero:true},
  ],tests:['Salt-fog and IP endurance over months','USV and AUV work','Aquaculture water-quality IoT','Port automation']},
];
export const REGION=Object.fromEntries(REGIONS.map(r=>[r.id,r])) as Record<string,typeof REGIONS[number]>;
/** What we do not know yet (shown under the hero and in the drawer). */
export const UNKNOWNS=['There are no official per-region climate normals in our sources, so the Month lens is a coarse BMKG regime pattern only.','Electrification and internet figures conflict between ESDM, BPS and APJII.','The coastline figure depends on the measurement method (about 108,000 km on the 2018 reference, 99,093 km elsewhere).'];
