# Brief → Field: the full plan (Board layer, on-demand parts, build and evidence)

Status: draft for founder review, 2026-10-28. Nothing is built until P1-B0 is approved. Replaces the earlier draft `board-layer-plan.md`, which is now phase P1 here. Follows `level-ladder-execution.md`, `pro-build-plan.md` §0 (ground rules, time boxes, one review and one fix round, leftovers to `docs/plans/backlog.md`) and ADR 012 ("the model thinks, we provide verified hands").

## 1. Goal in one sentence

**From an idea to an IoT device that is proven to work in the field, with AI help and a local lab.**

gopcb.ai (studied 2026-10-28) covers one piece we are missing: turning a design into a board you can order. It stops there: one board, no system, no field, manufacturing in China. AIoT already covers the system, the code, the build guide and real flashing. This plan adds the board, closes the loop through a Lab Mitra build and field evidence, and keeps everything on data we are allowed to hold.

## 2. North-star acceptance (the reference case)

A farmer types: "monitor soil moisture + automatic watering, 4 melon beds in Bogor, solar power". The plan is done when every box below is ticked for this case.

- [x] 1. **System design:** nodes, sensors, LoRa or Wi-Fi, solar and battery sizing, IDR prices. *(exists: Pro M2–M6)*
- [x] 2. **Code compiled and checked** in the compile sidecar. *(exists)*
- [x] 3. **Build guide:** 3D, wiring diagram, BOM, checklist, Build Sheet PDF. *(exists: M4–M8)*
- [x] 4. **Real ESP32 flash** from the desktop app, with native consent. *(exists: M7)*
- [ ] 5. **Carrier board:** the jumper wiring becomes one KiCad project that opens cleanly in KiCad 9, with ERC and DRC run. *(P1)*
- [ ] 6. **Parts not in the catalog** are found live, proposed with datasheet provenance and reviewed by staff, without storing distributor data. *(P2)*
- [ ] 7. **Board ordered and assembled:** Gerber + BOM/CPL in JLC format, or "assemble and test at a Lab Mitra" in one click. *(P4)*
- [ ] 8. **Field evidence:** telemetry proves the node works; its parts gain `labTested` or a higher confidence; the build appears as a Proven Build. *(P5)*
- [ ] 9. **Clear cost:** the user sees the estimated agent cost before each turn; checks, exports and downloads are free. *(P3 + founder pricing decision)*

## 3. Principles (binding)

- **The model thinks; tools are the hands.** New capabilities arrive as tools the agent may call, never as fixed pipeline steps.
- **One design object, many views.** `SystemSpec` stays the single source. Board is one more view of it, not a new store.
- **AI is paid; deterministic work is free.** Checks, exports, downloads and the Build Sheet never cost tokens.
- **Geometry from code.** No photos. Footprints and 3D come from the procedural lab parts (`pin(at, …)`, 2.54 mm `PITCH`) or from package dimensions.
- **We only store what we may store.** Our own facts (with provenance) and per-item KiCad footprints. No datasheet PDFs (links only), no Mouser or DigiKey data, no EasyEDA or LCSC scraping. Distributor stock and price are live only.
- **Proven beats plentiful.** A few thousand verified, field-proven parts are worth more than 700k unverified ones.

## 4. Data tiers (decided by the terms study, 2026-10-28)

| Tier | Content | Stored | Source |
|---|---|---|---|
| 1. Ours (hot) | verified parts, footprints, procedural 3D | yes, permanent | our catalog with provenance |
| 2. On demand (warm) | footprint and 3D per package | yes, per used item, cached by sha | official KiCad repo, fetched one at a time and never mirrored; or generated from package dimensions |
| 3. Live (cold) | stock, price, candidate parts | no | JLC/LCSC API (primary); Mouser/DigiKey for display only, with attribution |

Terms summary: Mouser forbids any cache or own database; DigiKey forbids its own database and bulk download (1,000 calls/day); EasyEDA forbids automated access and redistribution; KiCad libraries are CC-BY-SA 4.0 with the design exception, so they are free in designs but must not be redistributed as a collection; JLC and LCSC APIs need approval, and their storage rules must be asked for in writing.

## 5. Phases and checklists

Effort is agent time. Each slice ends with one review and one fix round.

### P0. Admin, starts now (owner, no code)

- [ ] Apply for the JLCPCB Open API (Parts + PCB API). In the application, ask in writing what may be cached.
- [ ] Apply for the LCSC API (Products module), and ask the same question.
- [ ] Place a first real PCB order with JLC, because approval depends on order history.
- [ ] Founder answers the questions in §7.

### P1. Board layer (about 2.5 d)

**P1-B0 Spec + mockup (0.5 d)**
- [ ] Board tab mockup for the farm field node: top view, module outlines, headers, ratsnest, issue list, "Download KiCad" button.
- [ ] The shape of the `footprint` field and the zip file list are written down.
- [ ] Founder approves.

**P1-B1 Footprint data (0.5 d)**
- [ ] Optional `footprint` on PartRecord: `{kind:'module-headers'|'terminal'|'board-edge', outlineMm, rows:[{origin, pitch, pins[]}], holes[]}`. The schema is frozen, so the field is optional.
- [ ] Footprints for all 22 catalog parts are derived from the lab model pins.
- [ ] Contract test: footprint pins = catalog pins = lab model pin positions (±0.1 mm), green for all 22.
- [ ] `confidence: medium` until a person measures the real module.

**P1-B2 KiCad writer + tool (1 d)**
- [ ] Pure writer `packages/pro-tools/impl/kicad.ts`: node → `.kicad_pro`, `.kicad_sch` (one connector symbol per module, nets as labels), `.kicad_pcb` (outline, footprints placed from `plan.ts`, nets unrouted).
- [ ] Tool #22 `export_kicad` (pure, MCP yes) returns a zip plus issues (overlap, off-board, unknown footprint).
- [ ] Board tab in `/pro`: 2D preview and download. The download is free.
- [ ] The farm field node zip opens in KiCad 9 with every net present and no overlapping footprints.

**P1-B3 ERC/DRC (0.5 d, cut-first)**
- [ ] `kicad-cli sch erc` and `kicad-cli pcb drc` run in a separate sidecar image (the owner deploys it).
- [ ] Results feed the `export_kicad` issues and the Build Sheet.
- [ ] Farm node: ERC clean; DRC lists only the unrouted connections, shown as information.

### P2. Parts on demand (about 1.5–2 d; D2 waits for an API key)

**P2-D1 Propose new parts (0.5 d)**
- [ ] `catalog_propose` accepts `newPart` (today it only edits one leaf of an existing part; ADR 012 lists this gap).
- [ ] A new part lands as a draft with `confidence: low` and its datasheet URL as `source`.
- [ ] A staff review queue promotes it to tier 1.

**P2-D2 Live lookup (0.5–1 d, after the JLC or LCSC key)**
- [ ] Tool `live_part_lookup`: queries JLC/LCSC live and returns candidates marked unverified under `untrusted`.
- [ ] Nothing from the distributor is stored. Attribution and a link are shown.
- [ ] When the API is down, the agent continues on tier 1 and shows "price unavailable".

**P2-D3 Footprints per package (0.5 d)**
- [ ] `fetch_footprint` takes one package from the official KiCad repo and caches it by sha. It never mirrors the library.
- [ ] A procedural 3D generator builds a model from package dimensions (box, pins), so no 3D files are needed.

### P3. UX ideas from gopcb (0.5–1 d, can run in parallel with P1)

- [ ] Estimated agent cost shown before each turn (the per-turn USD cap already exists).
- [ ] The agent first lists its "approach + open questions" before it writes the spec.
- [ ] Stage strip: Brief → Parts → Wiring → Code → Board → Build Sheet → Field.
- [ ] Checks grouped by stage; the Build Sheet stays held until they pass (the verify gate already exists).

### P4. Order and build (about 2 d, separate approval after P1)

- [ ] Autorouting with Freerouting as its own process (GPL-3, never linked into our code).
- [ ] Gerber + BOM/CPL in JLC format; downloads are free.
- [ ] Order through the JLC PCB API (once approved), or a deep link to upload by hand.
- [ ] "Assemble and test at a Lab Mitra": one click prefills `/partner` with the revision, BOM and Build Sheet (ADR 010 commissions apply).

### P5. Evidence loop and Proven Builds (about 1.5–2 d)

- [ ] Field telemetry and `evidence_status` tick checklist items for a deployed node (the tools exist; this connects them to the board revision).
- [ ] A node with passing field evidence raises the confidence of its parts; staff set `labTested` with the Lab Mitra task id.
- [ ] Proven Builds: a deployed, evidenced system can be published, built on the existing public `/products` catalog (published, evidence, test summary).
- [ ] The agent's `catalog_search` ranks field-proven parts first.

### P6. Pricing decision (founder, no code)

- [ ] IDR model for Pro: agent turns paid; checks, exports, downloads and the Build Sheet free.
- [ ] Lab Mitra Build priced in IDR, with commissions (ADR 010).

## 6. Out of scope

- Chip-level PCB with a large parts library. If it comes later, it uses 2–5k curated IoT parts, not 700k.
- Storing distributor data, photos or datasheets.
- Enclosure MCAD beyond the existing IP65 enclosure part.
- Hand-over to overseas factories.

## 7. Risks

- **KiCad format changes between versions.** Target KiCad 9 only, with fixtures that KiCad itself opened.
- **Footprint accuracy** (devkit variants such as DevKitC 30-pin vs 38-pin). Keep `medium` until a person measures it, and show that in the UI.
- **Sidecar size.** KiCad adds about 1 GB, so it goes in its own sidecar.
- **API quotas** are shared by all users. Tier 1 is the primary source; live data is only for missing parts.
- **Licences:** Freerouting runs only as a separate process; the KiCad libraries are never copied as a collection.
- **JLC approval** depends on order history (see P0).

## 8. Founder questions (max 4)

1. Carrier style: female headers (modules plug in and can be swapped), or modules soldered straight onto the board?
2. Who measures footprints for `verified`: staff, or a Lab Mitra task?
3. Order of work after P1: P2 (parts on demand) or P4 (order and build) first?
4. Pricing: is "AI paid, deterministic free" in IDR the model for Pro?

## 9. Order and total

P0 now → P1 (2.5 d) → P2 or P4 (about 2 d each) → P5 (about 2 d). P3 runs alongside P1. In total about 8–9 days of agent work, approved one phase at a time.
