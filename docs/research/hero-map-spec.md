# AIoT global hero spec: Indonesia test map (`/` EN)

## 0. Scope and where it goes in the code

- **Change only the global English homepage.** Route `/` renders `Landing` in `apps/web/src/landing-new.tsx`. The new hero replaces `<section className="rl-hero">` (line 107). The Indonesian page at `/id` (`LandingID`, `apps/web/src/pages/landing-id.tsx`) stays untouched. Before and after the change, run the existing e2e on `/id` so we know it still works.
- **`/` with `lang==='id'`.** `landing-new.tsx` also holds `copy.id`. Keep the current capsule hero for `lang==='id'` and show the map hero only when `lang==='en'`. This avoids shipping English-only data panels into an Indonesian view.
- **Section 2 is already `#gap`.** Both the scroll button and the first scroll go there.
- **The `#network` section already uses `HalftoneMap`** (`indonesia-dots.ts`, Natural Earth 1:50m admin-0, 0.42° grid). The hero reuses the same dot-matrix visual language, so the page has one map style. Two changes are needed:
  - Generate a finer, region-tagged dot set at about 0.2° so Batam and Bali resolve. Use Natural Earth admin-1 provinces mapped to the region groups.
  - Change `#network` to a list or strip of the planned labs, so the page does not show two near-identical maps.

## 1. Debate summary and rulings

**What all three agreed on**

1. A map that shows only geography is a "geography lesson". It scored 5, 6 and 6 out of 10. The hero has to lead with failure modes and tests, not land area.
2. Ask "what do you build?" first, then re-colour the map for that answer.
3. Every number shows its source and year. Low-confidence numbers stay off the hero.
4. Cut trivia: Toba, Kerinci, the glacier, Weber Deep, island land areas, volcano counts, GDP shares.
5. No disaster tolls as hooks: no Palu deaths, no Grasberg fatalities. Nothing promotional about Merauke, Morowali or Weda Bay labour, or Flores geothermal.
6. Batam and Kepri get their own hotspot.
7. Maluku's reversed rain season is the most useful seasonal fact in the dossier.
8. "Test here" is too vague. Use a context-filled "test plan" CTA that prefills the form.
9. No scroll-jacking and no heavy WebGL. Tap and keyboard must work as well as hover.
10. Proof is missing. Show what is real and label what is planned.

**Where they disagreed, and the ruling on each**

| Disagreement | Ruling | Why |
|---|---|---|
| Lead lens: crop (Dutch CTO) vs industry (Kenji) vs failure mode (data buyer) | The default lens is **"I build…"** (robot type). The second lens is **Stressor**. Crop and industry move into the region panel. | Robot type is the only question every visitor can answer in one click. The other lenses follow from it. |
| Default view: Java lit first (Kenji) vs equal regions | No region is pre-selected. With "I build" unset, the map shows a neutral stressor heat view. Once a robot type is picked, the strongest regions brighten. | A Java-first default loses the agri and marine visitors. |
| Seas & coasts: ninth region (Ingrid) vs a lens (Dutch CTO) | The sea surface is clickable as **"Maritime Indonesia"**, and the "Marine" robot type lights up the coasts. | It honours Ingrid's point without duplicating land regions. |
| Show low-confidence data with a badge (Kenji) vs hide it | Hide it from hover panels. The "Sources & confidence" drawer lists every fact, including low-confidence ones, with a badge. | The hero stays clean and sceptics can still audit. |
| Papua: show or omit | Show Papua as **off-grid and connectivity extremes only**. No Merauke, no Grasberg, no mining. | It is a real stress environment with ESG-safe facts available. |
| Month slider vs four-lens cap | The month control **is one of the four lenses** and uses coarse BMKG regimes only. | Every persona called it the most memorable feature. The data supports a qualitative version. |
| Comparison with Thailand, Vietnam and Malaysia (Kenji) | Not in the hero. Possible later section. | We have no sourced comparison data, and an invented one breaks the honesty rule. |
| Price, reply time, sample report or dataset | Not shown until the founder confirms each one (see section 7). | We cannot promise what does not exist. |

## 2. Headline and subline (EN)

1. **"Prove your robot where it actually breaks."** Subline: "Indonesia puts tropical heat, humidity above 80%, haze, monsoon floods, salt air and unstable power in one country. Pick what you build, and see where to test it."
2. "One country, every field condition your lab can't fake." Subline: "Heat, haze, floods, salt and weak power across 17,380 islands. AIoT scopes the field test, the certification path and the local partners."
3. "Real-world testing for robots, sensors and AI in Indonesia." Subline: "Hover a region to see what breaks hardware there, and which tests fit."

**Pick: option 1.** Under the headline, add one proof line with two facts:
- "National mean air temperature 27.5 °C in 2024 (BMKG) · relative humidity 70–100% (BMKG)"
- Link: "Sources" (opens the drawer).

Keep the existing eyebrow "The real-world gateway for AI robotics in Indonesia".

## 3. Regions

**Panel template.** Each panel has:
- an identity line
- up to 3 facts, each with a superscript source
- test scenarios
- a CTA labelled `Get a test plan · {Region} →`, which goes to `/partner?region=…&build=…&month=…`

Below, H = high confidence, M = medium. Medium facts are shown with the source visible.

### Java: the dense, hot, industrial baseline
- Industrial estates: 106 of 179 are on Java. Source: Kemenperin, via detik, 2026. https://finance.detik.com/industri/d-8551973/kawasan-industri-ri-makin-ramai-investasi-tembus-rp-6-744-triliun (M)
- Dry-season maximum 32–36 °C, humidity above 80%. Source: BMKG press release, 2020. https://www.bmkg.go.id/siaran-pers/udara-terasa-panas-dan-gerah-fenomena-biasa-musim-kemarau-bmkg-himbau-masyarakat-ikuti-tips-dari-bmkg (H)
- Floods were 1,088 of the 2,107 national disaster events. Central, East and West Java are all in the top six provinces by events. Source: BNPB Kaleidoskop, 2024. https://investortrust.id/national/52352/bnpb-jumlah-bencana-di-indonesia-tahun-2024-sebanyak-2107-kali (H for the official figure; the link is secondary)
- KEK Kendal lists electronics, automotive and food and beverage. Source: kek.go.id, PP 85/2019. https://kek.go.id/id/investment/distribution/kek-kendal (H)
- **Tests:** AMR or cobot pilot in a non-air-conditioned plant or warehouse (thermal derating, battery life in heat, recovery from power sags); delivery or field robots in monsoon rain (ingress); drone spraying and seeding in paddy; a baseline run before going remote.
- **CTA:** Get a test plan · Java →

### Batam & Riau Islands: the landing pad next to Singapore
This is a sub-hotspot drawn on top of Sumatra.
- Batam, Bintan and Karimun are free trade and free port zones (FTZ). Source: Republika, secondary. https://ekonomi.republika.co.id/berita/ppe15i383/kek-batam-tawarkan-banyak-insentif-dibandingkan-ftz (M)
- KEK Nongsa: a 166.45 ha digital-technology zone (PP 68/2021). Source: kek.go.id. https://kek.go.id/id/investment/distribution/kek-nongsa (H)
- KEK Tanjung Sauh: electronic components and assembly, designated by PP 24/2024, operations targeted for 2027. Source: Kemenko Perekonomian, 2023. https://ekon.go.id/publikasi/detail/5519/dorong-pertumbuhan-ekonomi-inklusif-dewan-nasional-kek-setujui-pembentukan-tiga-kek-baru (H)
- **Tests:** shipyard and electronics-plant automation, a marine-grade enclosure soak test on the coast, a staging point for hardware coming from Singapore.
- **CTA:** Get a test plan · Batam →

### Sumatra: the estate-crop belt on peat, with a haze season
- Riau produces 19.06% of national crude palm oil; North Sumatra, South Sumatra and Jambi are also in the top seven. Source: Kementan Pusdatin, Outlook Kelapa Sawit 2024 (2020–24 average). https://satudata.pertanian.go.id/assets/docs/publikasi/OUTLOOK_KELAPA_SAWIT_2024_FINAL.pdf (H)
- Fire and haze risk peaks August–September. Riau, Jambi and South Sumatra are BMKG priority provinces. Source: BMKG, 2026. https://www.bmkg.go.id/berita/utama/bmkg-perkuat-antisipasi-dampak-el-nino-2026-fokus-jaga-ketersediaan-air-dan-cegah-karhutla (H)
- Rubber is 88.6% smallholder nationally. South Sumatra is the top producer at 28.7% (2020–24 average). Source: Kementan, Outlook Karet 2025. https://satudata.pertanian.go.id/assets/docs/publikasi/OUTLOOK_KARET_2025_sign.pdf (H)
- **Tests:** palm fruit-bunch harvest aids and loose-fruit collection on soft or peat ground; drone and optical sensing in haze; data buffering and ride-through during a regional grid outage.
- **CTA:** Get a test plan · Sumatra →

### Kalimantan: large estates, coal, haze, and split grids
- PM10 peaked at 356.93 µg/m³ and visibility fell below 100 m, at BMKG Mempawah, August 2018. Source: BMKG. https://www.bmkg.go.id/siaran-pers/musim-kemarau-meluas-bmkg-waspada-potensi-karhutla (H)
- Kalimantan produced about 688 Mt of coal, around 82% of national output. Source: ESDM Minerba, via press, 2024. https://investortrust.id/business/72085/esdm-selama-dunia-butuh-terang-industri-batu-bara-tak-boleh-padam (M)
- West Kalimantan's grid is still a separate system that PLN is working to connect. Source: ESDM, 2025. https://esdm.go.id/id/media-center/arsip-berita/percepat-keandalan-jelang-lebaran-wamen-esdm-dorong-interkoneksi-listrik-kalimantan (H)
- **Tests:** LiDAR, camera and filter degradation in haze; fleet autonomy and telemetry on large estates and in mines, including off-grid charging and LoRa or satellite links; conveyor and barge-loading inspection.
- **CTA:** Get a test plan · Kalimantan →
- **Ruling:** do **not** rank provinces by burned area or hotspots. The metrics conflict between sources.

### Sulawesi: nickel processing, seaweed, cocoa, seismic activity
- Indonesia is the world's #1 mined nickel producer, about 2.6 Mt in 2025 (estimate). ESDM says reserves are concentrated in Sulawesi and Maluku. Source: USGS Mineral Commodity Summaries 2026. https://pubs.usgs.gov/periodicals/mcs2026/mcs2026-nickel.pdf (H)
- South Sulawesi produced 3.80 Mt of the national 9.28 Mt of seaweed in 2022. Source: KKP. https://kkp.go.id/storage/Materi/profil-pasar-rumput-laut66753a465fe09/materi-66753a4696928.pdf (H)
- Cocoa: Central, Southeast, South and West Sulawesi are the top four provinces. Yield fell from 798 to about 719 kg/ha (2016–2025). Source: Kementan, Outlook Kakao 2025. https://satudata.pertanian.go.id/assets/docs/publikasi/OUTLOOK_KAKAO_2025_sign_rev.pdf (H)
- **Tests:** high-temperature, dust and corrosion endurance and inspection in processing environments (only with a named host); offline-first autonomy; vibration and structural IoT; seaweed-farm monitoring.
- **CTA:** Get a test plan · Sulawesi →
- **Leave out:** death tolls, "safety incidents justify automation", and IMIP figures.

### Bali & Nusa Tenggara: dry, sunny, island grids
- A run of 179 days without rain near Kupang, NTT, in 2021. Source: BMKG, via Kompas TV. https://www.kompas.tv/article/219589/hari-tanpa-hujan-paling-panjang-bmkg-ingatkan-ancaman-kekeringan-di-sejumlah-daerah-ini (M)
- NTT household electrification was 96.35% in Q4 2024. Source: Dinas ESDM NTT, provincial data portal. https://sasando.nttprov.go.id/dataset-sektoral/cf3f8495-a465-40d6-9245-a28f5bed71c4/v1/download/pdf (H)
- KEK Sanur: Indonesia's first health KEK, 41.26 ha. Source: kek.go.id, PP 41/2022. https://kek.go.id/id/investment/distribution/kek-sanur (H)
- **Tests:** solar-autonomous sensors with dust and UV endurance; water and irrigation IoT; low-bandwidth telemetry; hospital and hospitality service-robot demos in Bali.
- **CTA:** Get a test plan · Bali & Nusa Tenggara →

### Maluku: the off-season and intermittent power
- In 7 of Maluku's 40 seasonal zones the rain season runs opposite to the rest of the country (BMKG's "local" type, wet around June–August). Source: BMKG, Prakiraan Musim Hujan 2022/23. https://iklim.bmkg.go.id/publikasi-klimat/ftp/buletin/2022/Buku%20PMH%202022_2023_versi_cetak.pdf (M); regime definition: https://bbmkg3.bmkg.go.id/daftar-istilah-musim (H)
- 305 villages had power 6 hours a day and 200+ villages 12 hours a day. Source: Minister of ESDM, Dec 2024. https://investortrust.id/business/50984/bahlil-jamin-keandalan-listrik-di-indonesia-timur-periode-nataru (M)
- 92.4% of the province is water. Source: Pemprov Maluku, LPPD 2022. https://malukuprov.go.id/storage/2025/03/LPPD-LKIP-Provinsi-Maluku-Tahun-2022-.pdf (M)
- **Tests:** wet-season trials in June–August, when western Indonesia is dry; sleep and wake power management; store-and-forward over satellite; fisheries and marine sensors.
- **CTA:** Get a test plan · Maluku (Jun–Aug wet window) →

### Papua: the off-grid and connectivity extreme
- At the end of 2023, all 140 villages officially without electricity were in the Papua provinces. Source: ESDM, released Jan 2024. https://www.esdm.go.id/id/media-center/arsip-berita/kementerian-esdm-tuntaskan-program-elektrifikasi-di-tahun-2024 (H)
- Papua Pegunungan: 15.40% of people used the internet in 2025. Source: BPS, via GoodStats. https://data.goodstats.id/statistic/10-provinsi-dengan-akses-internet-terendah-pada-2025-60JTn (M)
- Sentani sometimes exceeds 36 °C. Source: BMKG, 2020. https://www.bmkg.go.id/siaran-pers/udara-terasa-panas-dan-gerah-fenomena-biasa-musim-kemarau-bmkg-himbau-masyarakat-ikuti-tips-dari-bmkg (H)
- **Tests:** fully off-grid, satellite-linked sensors and autonomy; long-endurance and high-terrain drones. Panel note: "Only with a local host and community engagement."
- **CTA:** Get a test plan · Papua →

### Maritime Indonesia (the clickable sea surface)
- 17,380 named, coordinate-verified islands (2024). Source: BIG. https://www.big.go.id/uploads/downloads/Dokumen/Rilis_Jumlah_Pulau.pdf (H)
- About 108,000 km of coastline, per the 2018 national reference data, labelled as such. Source: KKP Renstra 2025–2029. https://ppid.kkp.go.id/media/uploads/document_information_public/Renstra_PDSPKP_2025-2029_20260226084715_1_compressed_1.pdf (M)
- Seaweed production 10.81 Mt in 2024. Source: KKP DJPB. https://kkp.go.id/storage/Materi/profil-pasar-rumput-laut66753a465fe09/materi-66753a4696928.pdf (H)
- **Tests:** salt-fog and IP endurance over months; USV and AUV work; aquaculture water-quality IoT; port automation.
- **CTA:** Get a test plan · Coastal & marine →
- **Salt corrosion:** describe it in words only. No source gives a number.

## 4. Map lenses (at most 4)

1. **I build…** (the default chip row): Ground / ag robot · Drone · Industrial AMR / cobot · Marine · Sensors & IoT · Humanoid / manipulation.
   - It brightens the regions whose test scenarios list that robot type.
   - Data: a hand-authored `fit: RobotType[]` per region, taken from the scenarios above. This is editorial, and it says so in the drawer.
2. **Stressor:** Heat & humidity · Haze & dust · Flood & rain · Salt & corrosion · Unstable power · Weak connectivity.
   - It highlights the regions tagged with that stressor in their facts.
   - Data: the facts above. Weak connectivity is driven by the BPS and APJII internet figures. Unstable power is driven by the ESDM and electrification figures.
3. **Month** (12-step control): each region shows wet, dry or haze-risk.
   - Data: BMKG regimes. Monsoonal is wet about Nov–Apr. Haze risk is Jul–Oct, peaking Aug–Sep, for Sumatra and Kalimantan. Maluku's local regime is wet about Jun–Aug.
   - It is labelled "typical pattern, BMKG; varies by zone and year". Wet/dry is coarse and qualitative only.
4. **Access:** pins for the planned AIoT labs (Bekasi, Bandung, Yogyakarta, labelled **PLANNED**), the Batam FTZ, and KEK zones relevant to hardware (Nongsa, Tanjung Sauh, Kendal, Gresik, Singhasari, Sanur).
   - Data: kek.go.id profiles and the existing `sites` copy.

Turning lenses on together combines them (AND). There is always a "Clear" action.

## 5. Interaction, mobile, accessibility, performance, scroll

**Map**
- Inline SVG dot-matrix. Each dot carries a `data-region` attribute, drawn from a regenerated 0.2° grid with an admin-1 lookup into region groups.
- Malaysia (Sabah/Sarawak), Brunei, PNG, Timor-Leste and Singapore appear as faint, **non-interactive, labelled** outlines.
- Each region group is a `<g role="button" tabindex="0" aria-label="Sumatra: test conditions">`.

**Desktop**
- Hover previews a region: the dots light up and a tooltip shows the identity line.
- Click or Enter pins the panel. The panel is a right-side card holding at most 3 facts, the scenarios, the CTA, and a "Sources" link.
- Esc closes it.

**Touch**
- Hover is not used. A tap selects a region and opens a bottom sheet.
- Lens chips scroll horizontally.
- The map is never zoomed or panned by a gesture, so it cannot trap scrolling.

**Accessibility**
- Below the map, add a visually hidden `<ul>` of region links, so screen-reader and keyboard users get the same content without the map.
- Focus is visible.
- Colour is never the only signal: active regions also get a label and a pattern or weight change.
- Contrast meets AA in both themes.
- Under `prefers-reduced-motion`, the dot shimmer is off and the scroll jump is instant.

**Performance**
- No WebGL and no map library.
- Budget: hero SVG plus data at or below about 120 KB gzipped, built at build time.
- The headline is server-rendered text and is the LCP element.
- Region data is a typed constant inside the page bundle.
- Lazy-hydrate the lens logic after first paint, and reserve the map's box to avoid layout shift.
- Target LCP under 2.5 s on throttled 4G.

**Scroll to section 2**
- The hero is `min-height: 100svh`.
- The button in `rl-hero-bottom` is an `<a href="#gap">` that calls `#gap.scrollIntoView({behavior: reduced ? 'auto' : 'smooth'})`. It uses `history.replaceState` so it adds no history entry and Back keeps working.
- One-shot assist:
  - **Wheel:** fires only when `scrollY < 8` and the hero is fully in view. The first downward wheel jumps to `#gap`, through a passive listener, and then removes itself. It never calls `preventDefault` and never runs again on that page view.
  - **Touch:** a downward swipe of 40 px or more at the top does the same.
  - **Keyboard:** Space, PageDown and arrow keys use native behaviour.
  - The assist does not fire when the gesture starts inside an open panel or bottom sheet.
- Scrolling up from `#gap` is native, with no snap back.

## 6. Trust: what we can show honestly today, and what not to claim

**Can show**
- A superscript with source and year on every number, plus a "Sources & confidence" drawer that lists every fact, its URL, its year and a high/medium/low badge.
- A "What we don't know yet" note:
  - no official per-region climate normals
  - electrification and internet figures conflict between ESDM, BPS and APJII
  - the coastline figure depends on the method
- The planned labs at Bekasi, Bandung and Yogyakarta, labelled PLANNED.
- Named regulations in an "Entry path" strip below the hero, linking to peraturan.go.id:
  - Komdigi (formerly Kominfo/SDPPI) type approval, Permenkominfo 3/2024
  - importer ID (API-U/API-P) under Permendag 16/2025 and 21/2025
  - SNI checked per HS code
  - PDP Law, UU 27/2022
  - phrased as "the steps we help you through", with **no week counts**
- The legal entity (PT name, NIB, address) in the footer, **once the founder confirms**.

**Do not claim**
- Completed tests, case studies, clients, partner or host logos, or named test sites.
- "Certified", "accredited lab", KAN, or ISO/IEC 17025.
- "Certified in X weeks", price ranges, or a reply-time SLA, unless the founder confirms them.
- A sample report or sample dataset that does not exist.
- "All of Indonesia" coverage.
- The pioneer tax holiday, the Rp10bn PMA minimum, a TKDN rule for IoT, the 4G/5G TKDN status, or a BRIN permit requirement as fact.
- Indonesia's robot density.
- Merauke, Grasberg, IMIP or IWIP labour, or Flores geothermal as opportunities.
- Disaster tolls, or the 2026 hotspot counts as if they were normal.
- Stock humanoids in rice fields.

## 7. Re-verify before publishing, and questions for the founder

**Re-verify**
- **Kemenperin "106 of 179" industrial estates:** we only have it from press. Find the official release.
- **BNPB 2024 counts:** check against the Kaleidoskop PDF.
- **BPS internet use (Kepri, Papua Pegunungan):** check against the Statistik Telekomunikasi PDF. bps.go.id blocked automated fetches.
- **Maluku's "7 of 40" seasonal zones:** check against the current BMKG Prakiraan Musim Hujan 2026/27 book.
- **The 305-village power figure:** it is from Dec 2024 and may be out of date.
- **Kalimantan 688 Mt coal:** check against ESDM MODI or the Minerba performance report (LAKIN).
- **Coastline (108,000 vs 99,093 km):** keep the "2018 reference" label.
- **KEK Tanjung Sauh status, and whether the stalled KEKs are still active:** only matters if they get pinned.
- **The Palu M6.7 earthquake (16 Jun 2026):** BMKG and Mongabay attribute it to different faults. It is not used in the panel. Keep it out unless we resolve which fault.
- **All 2026 seasonal content:** refresh after the BMKG 2026/27 updates.
- **The Batam FTZ source:** it is secondary. Replace it with a BP Batam or regulation link.

**Questions for the founder**
1. What is the PT name, NIB and address we can publish?
2. What reply time can we actually commit to for a test plan? Do we show a price band at all?
3. Do we have **any** host site, even under NDA, that we can describe as "scouting" or "in discussion"? Which regions can we realistically serve in the next 6 months? We will dim the others or mark them "on request".
4. Is there a data-rights and PDP one-pager, or a sample report? If not, should we build one before launch?
5. Partner form fields: can we add `region`, `build`, `month` and `stressor` prefill? A maximum of 4 visible fields was requested. Should we add WeChat or WhatsApp as contact channels?
6. Should `/` in `lang=id` keep the current hero, or get a translated map later? `/id` stays as it is either way.
7. Can we replace the `#network` halftone map with a labs strip, so the page does not have two maps?

## 8. Implementation notes (deviations)

- **Inquiry storage:** the ops tables hold JSON payloads, so there is no column to add. The new optional fields (`region`, `build`, `month`, `stressor`, `site`) are stored inside the payload, and old rows simply lack them (tested). No `ALTER TABLE` was needed.
- **Entry path** sits after section 2 (`#gap`), not between the hero and `#gap`, so the scroll button and the wheel assist still land on section 2. Its links go to the peraturan.go.id home page; deep links still need to be checked.
- **Panel placement:** a right-side column on desktop, as specified, but it reserves its own column (no overlay over Papua) and shows an idle card with the generic "Partner with us" CTA when nothing is selected.
- **Month lens:** only regimes the spec states are shown (monsoon Java, Sumatra, Kalimantan, Nusa Tenggara; haze Jul to Oct for Sumatra and Kalimantan; Maluku wet Jun to Aug). Sulawesi, Papua, Kepri and the sea show no state rather than an invented one.
- **Hotspots, Schools lens and the 17 hotspot cards** were added later by the founder (see CHANGELOG). Hotspot labels show only on hover/focus when a region has more than three visible pins, so Java stays legible without zoom.
- **Mobile:** the map is small at 390 px (no zoom or pan by design); a region chip row and the bottom sheet are the practical tap targets.
- **`landing-motion.ts`:** the loader no longer waits for the capsule image when the page has none (the map hero).
- **`tests/e2e/13-landing-id.spec.ts`:** only the assertion about the EN home headline after the "Global site (EN)" link changed; the `/id` page checks are untouched.
