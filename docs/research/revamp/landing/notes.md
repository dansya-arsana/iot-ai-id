# Landing mockup notes (R0, for founder approval)

The mockup is a static, high-fidelity version of concept.md §1 and §2, built on the dark token layer. Open `index.html`. The PNGs are in `png/`.

## Files
- `index.html` and `landing.css`: the mockup. Its tokens mirror concept §2.2: the existing `--ds-*` names, remapped under `[data-theme="dark"]`, with one accent `#c9f5c0`.
- `assets/fonts/`: Archivo 300–700 and IBM Plex Mono 400/500 (fontsource woff2).
- `assets/map.svg`: the dot map, generated from `apps/web/src/hero-map-data.ts`, which is the same grid as today's hero. Java is drawn brighter as the selected region.
- `parts/*.png|webp`: **real renders of our three.js lab part models**. They are made with `renderKindSheet` from `lab/scene/thumbnails.ts`, at an isometric 45°/30° view on a transparent background. The capture harness was a temporary file in `apps/web/src/pro/cad/dev/`, served by the running CAD vite on :9612; I deleted it afterwards and the repo is clean.
- `tools/`: `shot-parts.mjs` (renders the parts), `map.mjs` (makes the map), `render.mjs` (the Playwright screenshots).
- `png/landing-1440-full.png` and `png/landing-390-full.png`. Section crops: `hero`, `hero-viewport` (above the fold, with the Ask pill), `01-testing`, `02-builder`, `03-developers`, `04-builds`, `05-pricing`, `06-faq`, `close`, `footer`. Each crop exists at 1440 and at 390 (the 390 ones are @2x).

## Iteration log
1. **Round 1** set the structure of all 8 blocks.
   - Found: the evidence record picked up the pricing-card style because both used `.pc`, which made a huge black box.
   - Found: in the builder stage, the floating code and BOM cards covered the exploded parts and their callouts.
   - Found: the region card covered Sulawesi and Papua, and the Yogyakarta label sat on top of the Java dots.
2. **Round 2**
   - Builder stage rebuilt. It is now a cohesive exploded stack on one dashed axis, with layers L1 enclosure, L2 modules, L3 sensors and L4 power. Layer tags carry real pins from the fixture. A right-hand rail holds `main.ino`, BOM and Checks.
   - Hero: the trace now starts at the Bekasi pin and jogs out of the map into the spine, and section vias are placed from each section index by script. The overlay control moved into the caption row, the region card was cut to 2 sourced facts, and pin labels got dark plates.
   - The developers panel gained a 3-fact row, but a grid bug pushed that row under the tool list.
3. **Round 3**
   - Fixed the developers grid.
   - 390: the map is a cropped 4:3 poster centred on the Java pins, the tool grid became one mono line plus "All 21 tools", the "ways in" cards are compact, and the builds tabs are hidden.
   - Fixed a second class clash: the `.rail` in the builds filmstrip had been taking the builder rail's absolute position.
   - Tightened the section rhythm. Page height went from 9,620 to **8,707 px at 1440**, and from 12,734 to **11,724 px at 390**.

## Honesty decisions in the mockup
- Every number on the page comes from the repo:
  - **Tools:** 21 over MCP and 25 in total (`packages/pro-tools/registry.ts`). The 4 shown as desktop-only are `device_detect`, `serial_read` and `telemetry_read` (`mcp:'local'`) and `device_flash` (`mcp:false`).
  - **Catalog:** 147 parts (`packages/catalog/data/catalog.json`).
  - **Farm example** (`fixtures/farm-4-fields/spec.r1.json`): BOM IDR 1.14–2.13 jt summed from its 5 lines (prices checked 2026-10-14); LoRa AS923-2 at 921.4 MHz with a 26 dB margin at 400 m (estimate); pins GPIO34, 4, 5, 14 and 26.
  - **Java facts:** taken from `hero-map/regions.ts`, with sources (BMKG 2020, BNPB 2024).
  - **Lab Mitra pins:** Bekasi, Bandung and Yogyakarta, at their real coordinates and all marked PLANNED.
- **MCP endpoint:** the code builds it as `${origin}/mcp` (`claude-connector-card.tsx`), so the mockup shows `https://iot.ai.id/mcp`, not the `ops.iot.ai.id/mcp` in concept §1.5. The command text matches the profile card. The tool-call lines under it are labelled "illustrative".
- **HTTP tab:** the third tab is "HTTP" (MCP JSON-RPC `tools/call`), not "REST". The member Pro REST API (`/ops/v1/member/pro/*`) uses the cookie session and CSRF; I found no PAT auth on it. *Check before R2b.*
- **Builds carousel:** 2 real examples (the 4-field farm fixture, and the "Car speed logger" device example in `spec-schema.ts`). Greenhouse and pump/valve are shown hatched as `PROPOSED · NOT GENERATED`, pending founder decision 4. They are not mocked as real builds.
- **Trial:** decision 1 default. Every trial CTA reads "Request trial access", and the copy says "Invitation-only today". Pricing carries `PREVIEW PRICING`, the Builder price is a hatched `PLACEHOLDER` box, and the run allowance is marked `PLACEHOLDER`. The FAQ says there is no free trial yet.
- **Partner reply time:** decision 2 default, "We reply within 1 working day" (close block).
- **Testing step hints:** decision 3. Durations were removed; the hints are qualitative (Bench, Chamber, Planned sites, Signed record).
- **Evidence record:** a light paper object stamped `EXAMPLE RECORD · VALUES ARE ILLUSTRATIVE`, with the site renamed `BKS-01` and marked PLANNED.
- **Footer:** the entity line stays `PT [company name] · PLACEHOLDER`.

## Deviations from concept.md (flag to founder)
- **Hero layout.** The map is a full-width framed plate under the headline, not 8 columns bleeding behind the text. The dot grid is 246×89 (about 2.8:1), so at 8 columns it would be roughly 330 px tall and the pins would be unreadable. The headline still owns the first viewport; see `hero-viewport.png`.
- **The 3D is a composition of real per-part renders.** The exploded stack (builder) and the kit (builds) are individual lab part renders laid out in CSS. They are not the CadViewport explode of the whole node, and the captions say "rendered from our 3D part models". Production should capture the real `CadViewport` explode on a transparent background, through `scripts/landing-shots.ts` (R2b). The carrier PCB is not rendered, because no 3D model exists yet.
- **Soil sensor render.** The farm fixture uses `soil-moisture-capacitive`, which has no 3D model in Pro (it shows a "BOX · no 3D model" placeholder). The mockup uses the lab's `soil-capacitive-v2` model, which looks the same.
- **Builder stage frame.** The stage is shown frozen at step 06 (Board and enclosure), with code, BOM and checks visible together so one frame shows "the whole system". Steps 01–05 and 07 are not drawn as their own frames. At 390 the stage becomes swipe cards; 2 of 7 are mocked.
- **Page length.** 8,707 px against the concept's 6,500 px target. To cut further: merge the deliverables row into the stepper (about 160 px), drop the Checks card, and trim the FAQ to 4 rows.
- **Lab nav link.** Not shown; it is grant-gated.

## Known mockup-only shortcuts
- The overlay control shows "None" active. No humidity, heat or grid overlay is drawn, because no overlay data was rendered and inventing it would break the honesty rule.
- The Ask AIoT pill appears only in `hero-viewport.png`. It is hidden in the full-page captures, where a fixed element would land mid-page.
- The trace spine and vias are positioned by a small inline script at 1440. They are hidden under 900 px.
