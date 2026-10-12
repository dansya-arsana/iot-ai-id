# Hotspots review (foreign robotics BD lens)

# Hotspot review: verdicts, final list and default pins

I spot-checked three claims on the web: Jakarta's GRDP, Bekasi's GRDP and KEK Sorong's status. The other verdicts come from judging the sources listed in the input, without opening each one.

## Verdicts (per id)

```
jakarta — KEEP (default pin)
  best_fact: GRDP 2024 IDR 3,679.36 T at current prices, the largest of 38 provinces; growth +4.90%.
    Checked: BPS DKI release of 5 Feb 2025, also mirrored at disppkukm.jakarta.go.id. Confidence high.
  flags:
    - The 18.01% trade share comes from Kontan, which elsewhere quoted the constant-price total (2,151 T) as if it were current prices. Keep it at medium confidence or recompute it from the BPS table.
    - The temperature fact is weak. It cites CNBC Research and an unsourced line that BMKG "often" forecasts 78-85% humidity at night. Drop the humidity half.
    - Optional: BPS reports 2025 GRDP of IDR 3,926.15 T (via RRI), if you want a newer year.
  identity: "Indonesia's largest market and toughest urban test: megacity sidewalks, malls, hospitals and the Tanjung Priok gateway, all in heat, rain and flooding."

bekasi-karawang — KEEP
  best_fact: Manufacturing is about 70% of Karawang's GRDP (2023-2024).
    Or use: Kab. Bekasi had the largest GRDP in West Java in 2025, IDR 451.5 T.
  flags:
    - The 451.5 T figure appears only in press (GEBRAK, echoed by Goodstats). I could not find the BPS release itself. Label it "press citing BPS".
    - Kota Bandung leads West Java on GRDP per head (Databoks). Do not imply Bekasi is the "richest" overall.
    - The Jababeka figure of 1,650 tenants is from about 2019 and from a secondary source. Date it or drop it.
  identity: "Southeast Asia-scale factory belt: hundreds of car, electronics and FMCG plants in back-to-back estates, where one pilot can scale to many lines."

bandung — KEEP (default pin)
  best_fact: Elevation 768 m (range 675-1,050 m). Source: Pemkot Bandung. Confidence high.
  flags:
    - GRDP comes from the same GEBRAK article. Keep it at medium.
    - The "up to 45 sub-districts" warning is trivia. Drop it.
    - The Telkom weather-station page is thin evidence.
  conflict: Bandung's identity calls it "AIoT's lab city", and Yogyakarta's calls itself the "planned home of the AIoT lab". Pick one.
  identity: "Highland engineering city (ITB, Telkom University): build, localize and calibrate here, then test on hills and in afternoon storms."

cilegon — TRIM (non-default)
  best_fact: Real GRDP +5.78% in 2025, with manufacturing +7.09% (BPS Cilegon via Databoks).
  flags:
    - Remove the KEK Cilegon claim. It is low confidence and no regulation was found.
    - The Cigading port figure is from 2019. Mark it "c.2019".
  identity: "Java's steel and petrochemical port: salt air, dust and heat, for inspection robots and drones."

semarang-kendal — KEEP (default pin)
  best_fact: KEK Kendal: 136 companies, Rp15.69 T of new investment in 2025, set up under PP 85/2019.
  flags:
    - The subsidence claim needs a year and a single study. The 2-20 cm/yr range is wide and the UGM page is old.
  identity: "Central Java's export-factory gateway: KEK Kendal plants, a container terminal near 900k TEU, and a coast that floods at high tide."

yogyakarta — KEEP (default pin)
  best_fact: The UGM, Indosat and NVIDIA AI Technology Center launched on 13 Aug 2026 (ugm.ac.id). Confidence high.
  flags:
    - The student count comes from a thesis citing BPS. Keep it at medium and write "~".
    - The airport (YIA) fact is not relevant to robots. Drop it.
    - Resolve the lab-city conflict with Bandung (see above).
  identity: "Indonesia's student and AI-research city: UGM's new AI centre, thousands of engineering students, and rice fields 30 minutes from campus."

surabaya-perak — KEEP (default pin)
  best_fact: Terminal Petikemas Surabaya handled about 1.58 M TEU in 2024, its 25-year high.
    Also strong: Surabaya grew 5.76% in 2024, the fastest in East Java (BPS Surabaya).
  flags: none serious. The BPS URL is official, so the growth figure could be rated high.
  identity: "Indonesia's second city and eastern trade gateway: the busiest container terminal outside Jakarta, in hot, tidal coastal conditions."

gresik-jiipe — KEEP (non-default; it sits next to the Surabaya pin)
  best_fact: KEK Gresik (PP 71/2021, 2,167 ha): Rp113.4 T cumulative investment and 45,860 workers by Q1 2026.
  flags:
    - Make the Freeport smelter fact secondary. Freeport is next to the Grasberg topic the rules say to avoid, so do not lead with it.
    - The Sidoarjo 52% figure is secondary (a journal citing BPS).
  identity: "East Java's process-industry zone: a deep-water port, a copper smelter and new factories, for robots in heavy industry."

malang-singhasari — TRIM (non-default)
  best_fact: Malang city has 62 higher-education institutions.
    Do not lead with KEK Singhasari: Rp2.3 T and 895 jobs is small, and a skeptical buyer will notice.
  flags:
    - KEK Singhasari is too small to lead the card.
  identity: "Cool highland campus city with slope orchards: a contrast site for ag robots and low-temperature calibration."

medan — KEEP (default pin)
  best_fact: Kualanamu airport handled 7.3 M passengers and 58,915 flights in 2023.
    Or use: population about 2.47 M (BPS, via a thesis).
  flags:
    - The Belawan claim that crane productivity rose "from 20 to 60 boxes" is vaguely attributed. Verify it or drop it.
    - The population figure is secondary. Use a BPS Medan table if possible.
  identity: "Indonesia's largest city outside Java and Sumatra's main gateway on the Malacca Strait."

sei-mangkei-kuala-tanjung — TRIM (non-default)
  best_fact: Unilever's US$155 M oleochemical expansion (2026).
  flags:
    - The area of ~2,002.77 ha is not confirmed on kek.go.id. Other sources give a smaller original area, so check it.
    - The Kuala Tanjung terminal figure is a 2021 phase-1 plan, not actual throughput.

pekanbaru-riau-palm — KEEP (non-default)
  best_fact: Riau produces about 19% of Indonesia's palm oil (BPS 2023). Confidence high.
  flags:
    - The Dumai export figure is from 2019. Date it.
    - The haze episode is from 2015. Keep it framed as "a stressor", not as a hook.
  identity: "Heart of Indonesia's largest palm-oil province: plantation-scale ag robots on peat, in heat and seasonal haze."

palembang — TRIM (non-default)
  best_fact: South Sumatra coal output reached about 120 Mt in 2025 (Dinas ESDM Sumsel).
  flags:
    - The Pusri urea capacity comes from a company ESG PDF. That is fine to use.
    - The LRT fact is irrelevant. Drop it.

batam — KEEP (default pin); merge kek-nongsa into this card
  best_fact: Free Trade Zone and free port for 70 years (PP 46/2007).
  flags:
    - The shipyard count dates from 2015-2017. Mark it "~100+, c.2017".
    - Drop the defence-ministry vessel fact (Kemhan OPV). It is irrelevant and raises export-control questions for foreign buyers.
  identity: "Free-trade island one hour from Singapore: shipyards, electronics plants and data centres, the lowest-friction way into Indonesia."

kek-nongsa — MERGE into batam
  flags:
    - The year conflicts with its own claim: it says 2020 but cites PP 68/2021.
    - The Mongabay article is about data centres threatening water supply. Use it for the investment figure only, and do not lead with it.

lampung-agri — DROP, or optional
  reason: Overlaps with Pekanbaru as an agriculture card. The Lebaran ferry-traffic fact is trivia.

balikpapan-ikn — KEEP (non-default)
  best_fact: Balikpapan refinery expanded to 360k barrels/day (2026).
  flags:
    - A skeptical buyer will question how fast IKN is actually being built. Frame it as "a greenfield city under construction" and do not claim a pace.
    - The Kariangau container figures are from 2019. Date them.

makassar — KEEP (default pin)
  best_fact: Makassar New Port has 2.5 M TEU capacity and a -16 m draft.
  flags:
    - Disclose actual use honestly: about 258k TEU (Jan-Nov 2023) against that capacity.
  identity: "Eastern Indonesia's trade hub: a deep-water port and Sulawesi's rice belt next door."

morowali — DROP
  reason: The site is IMIP. The task rules say not to use IMIP or its labour controversies as hooks, and ESG risk would put off foreign robotics buyers.

denpasar-sanur — KEEP (non-default)
  best_fact: Bali had 6.33 M foreign tourist visits in 2024 (BPS Bali). Confidence high.
  flags:
    - Use the island-wide blackout of May 2025 as a stressor only, not as a selling point.

kupang — DROP
  reason: Weak buyer pull, and the facts are mostly climate.

ambon — DROP, or optional marine card
  reason: The National Fish Granary (LIN) is still a plan, and the PPID source is low confidence.

jayapura — DROP
  reason: Low commercial relevance. Its only value is as a weak-connectivity example.

sorong — DROP
  reason: In January 2023 the National KEK Council (Dewan Nasional KEK) put KEK Sorong among six zones that would lose status unless investment picked up. Ministers later pushed back, but I found no clear final status. Showing it is a credibility risk.
```

## Final list (16)

**Java (9):**
- jakarta
- bekasi-karawang
- bandung
- cilegon
- semarang-kendal
- yogyakarta
- surabaya-perak
- gresik-jiipe
- malang-singhasari

**Outside Java (7):**
- medan
- sei-mangkei-kuala-tanjung
- pekanbaru-riau-palm
- palembang
- batam (Nongsa merged in)
- balikpapan-ikn
- makassar

**Plus:** denpasar-sanur. That makes 17. Drop palembang or sei-mangkei if you need 16 or fewer.

**Optional:** ambon, as a marine card.

## Default-visible major-city pins (8)

1. jakarta
2. surabaya-perak
3. bandung
4. semarang-kendal
5. yogyakarta
6. medan
7. batam
8. makassar

Five of the eight are on Java, which matches the user's request. If you want a tourism pin, swap Makassar for Denpasar.

## Global notes

- Bandung and Yogyakarta both claim the AIoT lab. Choose one before publishing.
- Several numbers rest on one secondary article (GEBRAK for Bekasi and Bandung GRDP, theses for population and student counts). Show "press citing BPS" or "via thesis" in the UI.
- Put "c.YEAR" on stale facts: Jababeka 2019, Cigading 2019, Dumai 2019, Kariangau 2019, Batam shipyards 2015-2017.
- Remove plans presented as facts: KEK Cilegon, the National Fish Granary (LIN) target, and the Kuala Tanjung phase-1 capacity.
- Lead every card with a commercial fact (GRDP, manufacturing share, TEU, investment, tenants) and put stressors second. A VP wants to see who they could sell to before the test conditions.
- Port throughput is the most comparable metric across cities (Jakarta lacks a Priok TEU figure). Adding one would help.

**Sources (from my checks):**
- [BPS DKI Q4 2024 release (disppkukm mirror)](https://disppkukm.jakarta.go.id/storage/files/shares/693a6f2c0922d-pertumbuhan-ekonomi-provinsi-dki-jakarta-triwulan-iv-2024.pdf)
- [RRI on Jakarta 2025 GRDP](https://rri.co.id/jakarta/regional/2164216/privacy.html)
- [GEBRAK on Bekasi GRDP](https://www.gebrak.id/2026/05/bekasi-salip-bandung-jadi-daerah.html)
- [Goodstats on Bekasi GRDP](https://goodstats.id/article/bekasi-jadi-kota-kabupaten-terkaya-di-jawa-barat-GgVF8)
- [Bisnis: six KEKs at risk of revocation (2023)](https://ekonomi.bisnis.com/read/20230412/9/1646079/mandek-6-proyek-kek-terancam-dicabut-statusnya)
- [Antara Papua Barat on keeping KEK Sorong's status](https://papuabarat.antaranews.com/berita/32097/menteri-investasi-instruksikan-bangun-hilirisasi-pertahankan-status-kek-sorong)