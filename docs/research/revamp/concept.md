# AIoT revamp concept: "Test bench + Builder" (2026-10-28)

One concept, decided. Inputs: `refs.md` (47 takeaways), `audit.md` (59 screenshots), founder feedback (refs 3–6), repo state at `ca69cf4`.
Status: **for founder approval** (working rule 1). Anything marked `[FOUNDER]` is a decision only the founder can make; the concept gives a default so the build is not blocked.

---

## 0. The idea in one paragraph

AIoT is two things, in this order: **(1) we are the hardware testers in Indonesia**: robots, sensors and IoT tested on the bench, in the climate and in the field, with Lab Mitra school labs as distributed test sites, and every test leaves an evidence record. **(2) We also have a Hardware Builder**: describe a device, an AI architect working over a verified parts catalog generates the system, wiring, compile-checked code, BOM, carrier board and Build Sheet; it runs in the browser, from Claude (MCP) or over the API; then you build it and we test it. The page has one visual spine that joins the two: a **circuit trace** that starts at a test-site pin on the Indonesia map and ends at the builder prompt. *Tested where it breaks → designed to survive it.*

Design direction: **dark, engineered, documentary.** It takes the crafted dark stage, the trace, the "Fig. N" captions and the brief-to-order scroll from gopcb, the component density and MCP chips from affectUI, and the inset shell, timeline and late/blocked lists from the dashboard reference. It is built on our own tokens (Archivo + IBM Plex Mono, monochrome + one accent). No logos, testimonials or invented numbers.

---

## 1. Global landing: narrative and IA

### 1.0 Global rules for the page
- **8 blocks, numbered 01–06 plus hero and close.** Each block makes one claim with one visual. The target length is about 6,500 px at 1440 (today it is 9,295) and about 7,500 px at 390 (today 11,231).
- **Section header pattern** (refs #4): a mono index `01 ──` on the left, a mixed-weight H2 across 6 columns, a 2–3 line explainer right-aligned across 5 columns, and a hairline underneath.
- **Mixed-weight headlines** (refs #3): Archivo 300 for connective words and 700 for the claim words. In the copy below, **bold** = 700 and the rest = 300.
- **Fig captions** (refs #6): every visual carries `Fig. N · …` in mono 11px. Captions describe only real artefacts, or they say `Example`.
- **Honesty chips**: `EXAMPLE BUILD`, `PLANNED SITE`, `PLACEHOLDER`, `PREVIEW PRICING`. They are mono and uppercase, with a 1px outline, and are never hidden on mobile.
- **Numbers are computed, never typed.** Counts (parts, lessons, tools, MCP tools) come from a build-time `site-facts.json` generated from `packages/pro-tools/registry.ts` (today 25 tools, 21 exposed over MCP), `packages/catalog/data` and the lab lesson registry. If a fact can't be computed, it doesn't appear.
- **The circuit trace** runs as an SVG in the left margin (desktop only; hidden under 900px). It draws in with scroll and jogs at each section with a "via" node. It ends at the final prompt.
- **The loader goes.** At most a 300 ms logo mark, and none with reduced motion.

### 1.1 Nav (site-shell)
`AIoT` · **Testing** · **Builder** · Lab* · Pricing · Docs (API · MCP) | Sign in | `[Start building]` (accent button).
`*` Lab only shows with the `lab` grant (existing `can('/lab')`). `Scenarios` is removed and the header and footer links (`site-shell.tsx:18`, `:88`) are repointed to `/#testing`. In the footer, `Builder` gets Pro, MCP, API and the Build Sheet sample.

### 1.2 HERO: Indonesia test bench (dark)
**Decision: keep the map and redesign it.** The map is the only visual we own that says "Indonesia" without a stock photo, and it ties directly to "where it breaks". What's wrong today is the noise around it, not the map. The redesign:
- **Dark map**, land in `--ds-raised` with a 1px `--ds-line` coastline. No choropleth by default. Up to 3 climate overlays (Humidity · Heat · Grid) sit behind a single quiet segmented control at the bottom-right of the map, and they replace the 5 lens chips. Month, Access and SMK reach move to the region drawer.
- **Pins:** Lab Mitra sites (Bekasi, Bandung, Yogyakarta) as hollow pins with the `PLANNED SITE` chip on hover/tap. The trace starts from the first pin. A pin turns solid only once a site has produced a verified evidence record.
- **The region card loses its placeholder lines** ("[X] business days", "[price band]"). It shows a region name, 3 climate facts with a BMKG source link, and "Test here →".
- **Layout 1440:** text in the left 5 columns over the map, which bleeds right across about 8 columns. **Layout 390:** text first, then the map as a 4:3 poster (not a 120px strip) with pins and no overlay control. Tapping it opens the full map.

Copy:
- Eyebrow chip: `FIELD-TESTED · INDONESIA`
- H1: "We **test hardware** where it **breaks**: **Indonesia**."
- Sub: "Robots, sensors and IoT, tested on the bench, in tropical heat and humidity, and in the field at school labs across Java. Every test ends in an evidence record you can show."
- Condition row (mono, small; replaces "The gap"): `70–90% RH` · `25–35 °C` · `17,000+ islands` · *typical conditions, not test results* (keep the existing source link).
- CTA primary: `[Book a field test]` → `/partner?type=test`
- CTA secondary (ghost): `[Try the Hardware Builder →]` → `#builder`
- Fig: `Fig. 1 · Indonesia, relative humidity overlay, BMKG normals · pins are planned Lab Mitra sites`

### 1.3 01 TESTING: what a test gives you (dark, with a light "paper" record)
One section replaces "Every test leaves evidence", "A distributed lab" and the partner band.

- Index `01 ── Testing`
- H2: "Every test ends in **evidence**, not an opinion."
- Explainer: "We run your device through a written protocol and hand back a signed record: what was tested, under which conditions, what failed and what that means for the next revision."

**Left: the process**, a 4-step vertical stepper (mono step hints on the right):
1. **Bench**: power, interfaces, firmware boot and recovery. *hint: `day 1–2`* `[FOUNDER: real durations or remove hints]`
2. **Climate**: heat, humidity and condensation cycles; enclosure and connectors. *hint: `chamber`*
3. **Field**: deployed at a Lab Mitra site in real tropical conditions, logged by trained SMK teams. *hint: `PLANNED SITES`*
4. **Report**: evidence record, anomalies, recommended fixes. *hint: `signed record`*

**Right: the deliverable.** An evidence record rendered as a light paper document on the dark ground (the one deliberately light object on the page, a "printed artefact"). The fields are from the existing typed record; `SC-02` is renamed to `SITE BKS-01 · greenhouse bench`, and the record carries an `EXAMPLE RECORD` stamp.
- Fig: `Fig. 2 · Example evidence record. Fields match the real record format; values are illustrative.`

**Deliverables row** (bold noun + light explanation; refs #14):
**Test protocol**, agreed before we start · **Evidence record**, signed with photos, logs and sensor traces · **Anomaly list**, each with a likely cause · **Retest**, after your fix, same protocol.

**Lab Mitra strip** (one line plus 3 pins, replacing the heavy ledger): "Our field sites are **school labs**. SMK teams are trained and paid per verified task, so your device meets real users, real power and real weather." The `Bekasi · Bandung · Yogyakarta` chips are each marked `PLANNED`. Link: `How Lab Mitra works →` `/id`.

CTA row: `[Book a field test]` · `[Download the testing brief]` (the existing PDF).
*EntryPath (type approval, importer ID, SNI, PDP) leaves the landing* and becomes a "Bringing hardware into Indonesia" block on `/partner`, with a single text link from here: `Need type approval or SNI? We help with that too →`.

### 1.4 02 HARDWARE BUILDER: describe → generate → verify → build/test (dark stage)
This is the gopcb-style showpiece.

- Index `02 ── Builder` · route chip `BRIEF → BUILD → TEST`
- H2: "Describe a device. **Get the whole system.**"
- Explainer: "An AI hardware architect works over our verified parts catalog. It picks parts, allocates pins, wires them, writes firmware that compiles, prices the BOM and draws a carrier board. Then we can build it and test it."

**The prompt comes first** (it is also the CTA; refs #2). The existing GenerateEntry moves here: a large field with placeholder "Soil moisture logger, LoRa, solar, IP65, 4 fields" and `[Generate]` flush to it. Example chips: `Farm soil monitor` · `Cold-chain tracker` · `Line-follower robot`. A quiet line under it reads: "Free trial · you see the cost before every run." `[FOUNDER: see trial decision 1.10]`

**Sticky scroll stage** (refs #7). It has a left step list and a right visual stage that scrubs with scroll. On 390 it becomes a horizontal swipe of 7 cards with no pinning.

| Step | Mono hint | Stage visual (all from our real renderers) |
|---|---|---|
| **Describe** | `one sentence is enough` | spec-fill card: `Spec 4/7 filled`, Environment pre-filled `Tropical outdoor · 25–40 °C · 90% RH` (ties back to testing) |
| **Parts** | `verified catalog` | part tray from the catalog, each part with a provenance chip (`verified` / `datasheet` / `community`) |
| **Wiring** | `pins checked` | crop of the Pro auto-laid-out wiring SVG for the farm node |
| **Code** | `compiles · not run on hardware` | code panel with a `compile ✓ ESP32` chip. The honesty line stays. |
| **BOM** | `IDR ranges · estimate` | BOM table with an IDR range column |
| **Board** | `KiCad 9 carrier` | the Board tab 2D top view, then an **exploded layer stack** (enclosure / carrier PCB / modules / battery) from the existing 3D assembly with explode |
| **Build & test** | `flash · field test` | Build Sheet title block `DESIGN · NOT BUILT` → `FLASHED 1/4` → "Send to a Lab Mitra for build/test" |

- Fig: `Fig. 3 · The 4-field farm reference, from brief to field. Rendered by AIoT Pro.` with an `EXAMPLE BUILD` chip.

**Three ways in** (a row of 3 cards under the stage):
- **Browser**: "Work in the Pro workspace: 3D, wiring, code, BOM, Build Sheet." → `/pro`
- **Claude (MCP)**: "Use the same tools from Claude Code or Claude Desktop." → `#developers`
- **API**: "Call it from your own pipeline." → `/api`

### 1.5 03 DEVELOPERS: MCP and API (dark code panel)
- Index `03 ── Developers`
- H2: "The same architect, **inside your tools**."
- Explainer: "Every Builder tool is exposed over MCP and the API: {mcpToolCount} tools, one permission model, one audit log. Personal access tokens, shown once, revocable."

**Code panel** with 3 tabs (segmented control) and a `Copy` action plus an `MCP` chip (refs #22):
- `Claude Code`:
  ```
  $ claude mcp add --transport http aiot https://ops.iot.ai.id/mcp \
      --header "Authorization: Bearer aiot_pat_••••••••"
  ```
- `Claude Desktop`: the JSON header config (same endpoint).
- `REST`: one `curl` to create a project and one to read a revision (taken from `/api` docs, no invented endpoints; the integrator copies the real paths).

**Tool grid**: compact mono chips generated from the registry (only `mcp:true`), grouped as Catalog · Design · Verify · Board · Project. Example chips: `catalog_search` `allocate_pins` `validate_netlist` `compile_code` `price_bom` `export_kicad` `save_revision`. Hardware-only tools (`device_flash`, serial and telemetry) appear greyed with "desktop app only".
- Small print: "Tokens need Builder access. OAuth for claude.ai custom connectors is coming." (true today, per CHANGELOG)
- CTA: `[Get a token]` → `/profile` (members) / `[Request access]` → trial flow.

### 1.6 04 BUILDS: end-to-end examples (carousel; replaces the SC glass domes)
- Index `04 ── Builds`
- H2: "Built **end to end**, from **our** parts."
- Explainer: "Each example is generated by the Builder from the verified catalog: the 3D assembly, wiring, code and BOM shown are the real outputs. None of them is a customer product."

**Carousel** (refs #8): a filmstrip of 4 thumbnails joined by the trace, prev/next and pause controls, and blur-crossfade. Each item has:
- A render from **our own** 3D assembly and exploded view (screenshot pipeline, no AI imagery)
- The chip `EXAMPLE BUILD · generated in AIoT Pro`; a build only adds `FIELD-TESTED` once real evidence exists
- H3, one sentence, 2 spec chips computed from the spec (node count, power source)
- `Pull it apart` → the exploded view; `Specifications ▾` → parts count, MCU, radio, power, BOM IDR range (estimate)

Items, only from the fixtures and the spec examples we already have:
1. **4-field farm monitor** (the Pro reference case: 4 nodes plus a gateway, LoRa, solar)
2. **Single-device vehicle unit** (single-device mode, `vehicle-12v`)
3. **Greenhouse climate node** (BH1750, soil v2, DS18B20)
4. **Pump and valve controller** (relay, solenoid, RS-485)
`[FOUNDER: approve the list; any build not renderable from fixtures is dropped, not mocked]`

### 1.7 05 PRICING / TRIAL (placeholder, marked)
- Index `05 ── Pricing`
- H2: "Start **free**. Pay when it **works for you**."
- Chip next to the H2: `PREVIEW PRICING`
- 3 equal cards, with the middle one carrying a `RECOMMENDED` pill and the only accent button:
  - **Trial**: "For trying the Builder on one real device." Price: `Free`. Bullets: Builder in browser · Build Sheet PDF · a limited number of agent runs `[FOUNDER: allowance]`. CTA `[Start free]`.
  - **Builder** (recommended): "For makers and teams shipping devices." Price `[PLACEHOLDER]`. Bullets: MCP and API tokens · KiCad carrier export · unlimited projects. CTA `[Talk to us]`.
  - **Field test**: "For hardware that must survive Indonesia." Price: `Per protocol, quoted`. Bullets: protocol · evidence record · retest. CTA `[Book a field test]`.
- One honest sentence (refs #10): "Agent runs cost model tokens; the workspace shows the estimate before every run. Checks, exports and downloads are free."
- The monthly/annual toggle is not shipped until real prices exist.

### 1.8 06 FAQ (2-column table, no accordions)
- H2: "Questions people **ask**."
- Rows (honest answers):
  - *Do you manufacture?* No. We design with you, test, and hand off to a board house or an assembler. A Lab Mitra can assemble and test prototypes.
  - *Is the code run on real hardware?* Generated code is compile-checked, not run, until it is flashed and logged. The Build Sheet says which.
  - *Where do you test?* On our bench, in a climate setup, and at Lab Mitra school sites in Java (planned; marked on the map).
  - *Can I use it from Claude?* Yes, over MCP with a personal token. Claude Code and Claude Desktop work today.
  - *What can the Builder design today?* ESP32/AVR/RP-class sensor nodes, LoRa links, solar and 12 V power, and carrier boards for module headers. Not custom RF or high-voltage designs.
  - *Is the trial free?* Yes, with a limited number of agent runs `[FOUNDER]`.
- `What we don't know yet` → `/research#sources`. The FAQ footer links to it: "Our sources and open questions →".

### 1.9 CLOSE: dual CTA, then the title-block footer
- H2: "What should your hardware **survive**?"
- The prompt is repeated (refs #2): "Describe your first device. One sentence is enough." with `[Generate]`.
- Under it: `[Book a field test]` (ghost) · `[Start building free]` (accent).
- **Footer as an engineering title block** (refs #16). Title block fields: `PROJECT AIoT · iot.ai.id` · `LOCATION Indonesia` · `CATALOG {partCount} parts` · `LICENCE …` · `© 2026 PT [company name] PLACEHOLDER` (the existing marked placeholder stays until legal fills it). The link columns are Testing · Builder · Learn · Company. The trace terminates in the title block.
- Persistent `Ask AIoT` pill (bottom right, ≥900px): it opens the builder prompt focused. It is not a chatbot.

### 1.10 Founder decisions (with defaults)
1. **Free trial vs invitation-only** (contradiction found in the audit). *Default:* ship the trial as a real gate: a new grant `pro-trial` given automatically on sign-up, with a per-member USD cap (ADR 012 §7's original design, kept for this). Until that gate ships, every "Free trial" string renders as `Request trial access` → `/partner?type=builder`, and the pricing card carries `PLACEHOLDER`.
2. **Partner reply time**: pick one. *Default:* "We reply within 1 working day", and remove the `[X]` placeholder on `/partner`.
3. **Testing step durations**: real numbers or no hints.
4. **Carousel build list** (1.6).

### 1.11 What moves off the landing
| Removed | Goes to |
|---|---|
| SC-01..06 glass-dome scenario cards | Deleted (assets removed from the bundle). Replaced by 04 Builds. Nav and footer links repointed. |
| "What we don't know yet" (`hero-map/index.tsx:353`) | `/research#sources` (the hero drawer keeps its source links) |
| "The gap" story | Deleted. Its 3 numbers become the hero condition row. |
| EntryPath (type approval, SNI, PDP…) | `/partner`, "Bringing hardware into Indonesia" block |
| Stats band 56 / 6 / 4 / 3 | Deleted. Computed facts appear inline (03 explainer, footer title block). |
| Robotic-hand render (partner band) | Deleted |
| Loader "FROM THE FIELD. INTO EVIDENCE." | Reduced to a 300 ms mark |
| `/id` (SMK landing) | Unchanged in content; it picks up the new tokens only |

---

## 2. Design-system evolution (one system: site, lab, pro, backoffice)

### 2.1 Principle
We keep `--ds-*` names and add a **dark layer that remaps them**. Components never ask "am I dark?"; they read tokens. Themes are scoped by attribute:
- `[data-theme="dark"]`: the landing (whole page), the builder stage, the backoffice (default), and Pro code and terminal panels
- `[data-theme="light"]`: `/lab` (bench theme, unchanged), `/id`, `/partner` forms, the Build Sheet print, and the paper evidence record
- The backoffice gets a light/dark toggle (stored per staff in localStorage). Pro stays light in this revamp (dense CAD); its dark mode comes later through the same tokens.

### 2.2 Token deltas (`apps/web/src/design/tokens.css`)
```css
:root{
 /* NEW: one accent, rationed (primary CTA, trace, "today", active/selected) */
 --ds-accent:#c9f5c0;            /* = existing --ds-signal; signal becomes an alias */
 --ds-on-accent:#0a0a0a;
 --ds-accent-line:#c9f5c066;
 /* NEW status set (dot + text, never colour alone) */
 --ds-info:#2f5fd0; --ds-info-soft:#e2e9f8;      /* in progress */
 --ds-hold:#9a7b00; --ds-hold-soft:#f4eed2;      /* hold / proposed */
 /* ok / warn(=late, blocked) / error exist; "coming" = hatch utility */
 --ds-hatch:repeating-linear-gradient(135deg,var(--ds-line) 0 2px,transparent 2px 6px);
 /* NEW type */
 --ds-weight-light:300;          /* load Archivo 300 */
 --ds-text-ui:.8125rem;          /* 13px, backoffice and app chrome */
 --ds-text-caption:.6875rem;     /* 11px mono, Fig captions and labels */
 --ds-track-label:.12em;         /* was .1em */
 /* NEW shape aliases (values already exist) */
 --ds-radius-control:var(--ds-radius-1);  /* site buttons and inputs: 4px */
 --ds-radius-card:var(--ds-radius-2);     /* 12px */
 --ds-radius-panel:var(--ds-radius-3);    /* 20px, backoffice inset panels */
 /* NEW motion */
 --ds-ease-out:cubic-bezier(.16,1,.3,1);
 --ds-scrub:linear;              /* scroll-linked only */
}
[data-theme="dark"]{
 --ds-ground:#0b0b0c; --ds-surface:#141416; --ds-surface-raised:#1c1c1f; --ds-sunken:#08080a;
 --ds-ink:#f2f1ee; --ds-ink-2:#b5b4b0; --ds-ink-3:#8a8984;
 --ds-line:rgb(255 255 255/.08); --ds-line-strong:rgb(255 255 255/.14);
 --ds-inverse:#f2f1ee; --ds-on-inverse:#0b0b0c;
 --ds-ok:#5fcf87; --ds-ok-soft:#5fcf871f; --ds-warn:#f0a43a; --ds-warn-soft:#f0a43a1f;
 --ds-error:#f26b5b; --ds-error-soft:#f26b5b1f; --ds-info:#6f9bff; --ds-info-soft:#6f9bff1f;
 --ds-hold:#e8cf55; --ds-hold-soft:#e8cf551f;
 --ds-shadow-1:none; --ds-shadow-2:0 0 0 1px var(--ds-line);  /* depth by tone, not shadow */
 color-scheme:dark;
}
```
- **Accent decision:** we keep our green (`--ds-signal` #C9F5C0) as the one accent rather than adopting gopcb's cyan. It is already the brand's "live" colour in /lab (`--lab-live-soft` is the same value), it reads with high contrast on #0B0B0C, and it keeps us from looking like a gopcb clone. It is used **only** for the primary CTA, the trace, the "today" marker and active nav or tab. Body links stay ink with an underline.
- Raw colours stay only in tokens.css (existing rule). The `--lab-*` theme is untouched.
- Contrast: every ink/ground pair is AA or better. `--ds-ink-3` on `--ds-surface-raised` is the floor (≈5.3:1). This is checked by a unit test that parses tokens.css.

### 2.3 Type scale
| Role | Site (landing) | App (backoffice, pro chrome) |
|---|---|---|
| Display / H1 | Archivo 300+700 mix, `clamp(2.6rem,5.4vw,4.5rem)` (cap 72px), -0.035em | 32px / 300, -0.02em (page title, as in the dashboard ref) |
| H2 | 300+700 mix, `clamp(1.75rem,3vw,3rem)`, -0.025em | 20px / 400 (card title) |
| H3 | 18–26px / 600 | 14px / 500 |
| Body | 16–18px / 400, ink-2 | 13px / 400 (`--ds-text-ui`) |
| Label / caption | Plex Mono 11px, uppercase, +0.12em | Plex Mono 11px (table headers, chips, dates) |
| Numerals | Plex Mono tabular | Plex Mono tabular, 24–32px for KPIs |

### 2.4 Component specs (new or changed; all in `apps/web/src/ui/`)
- **Button**: site: 4px radius, 40px tall (44 on touch), 14/20 padding. Variants are `accent` (accent bg, on-accent text), `ghost` (1px line-strong) and `quiet` (text plus arrow). App: pill radius, 32px tall. Focus: 2px accent ring, offset 2px.
- **Chip / honesty chip**: mono 11px uppercase, 1px outline in line-strong, 2/8 padding, 4px radius on site and pill in app. Honesty chips use only `ink-2` text: they should be read, not decorate.
- **Status chip**: a 6px dot plus text with a soft background. 5 states: `done`=ok, `in progress`=info, `late/blocked`=warn, `hold/proposed`=hold, `coming`=hatch plus ink-3. Never colour alone.
- **Segmented control / pill tabs**: a sunken capsule with the active item on `--ds-inverse` (white pill, dark text, as in the dashboard ref). Counts sit in mono ink-3. Keyboard: arrows move, plus `role=tablist`.
- **Underline tabs with counts** (affectUI): for list headers, "Inquiries 12 · Organizations 30".
- **Card**: surface-raised, 1px line, `--ds-radius-card` (site) or `--ds-radius-panel` (app inset). No shadow on dark. The header is the title, a mono ink-3 count, and a circular ↗ open button (refs #37).
- **Table**: 36px rows, 13px text, mono dates and IDs, sticky header in mono 11px, row hover in sunken, a checkbox column only where bulk actions exist. Mobile: rows collapse to 2-line cards (title + status, then meta).
- **Fig caption**: mono 11px ink-3, `Fig. N ·` prefix, 8px above it.
- **Trace spine**: one SVG path (`stroke: --ds-accent-line`, 1px), with vias as 6px rings. `stroke-dashoffset` is driven by scroll progress.
- **Spec-fill card**: key/value rows; unfilled rows show `e.g.` in ink-3; a header counter `4/7`.
- **Scroll-step stage**: a sticky container, with the left list driving a `data-step` attribute; visuals crossfade at 250ms. Reduced motion: the steps render as static stacked figures.
- **Code panel**: always dark (sunken), tabs, copy button with toast, an `MCP` chip.
- **Backoffice-only components:** segmented tick progress bar · day grid · timeline (rows, pill bars, Today marker, gates row) · late-and-blocked row (with a required `reason` prop) · next-7-days row · workspace switcher · approval card (gate) · usage meter (stacked bar against the cap) · drawer (right, 480px) for create and detail forms · ⌘K command menu.

### 2.5 Motion
- One curve (`--ds-ease`) for UI and `--ds-ease-out` for entrances. Durations are 150 (hover), 250 (state) and 600 (section reveal).
- Allowed: trace draw-in on scroll, step-stage scrub, carousel blur-crossfade, number ticker **only** for computed facts, and a parts lift of 4px on hover.
- Not allowed: parallax, bounce or springs on the site (the lab keeps its spring), auto-playing video, and anything over 600ms.
- `prefers-reduced-motion`: the trace shows fully drawn, the stage is static, the carousel stops autoplay and the ticker shows the final value.

### 2.6 Where each surface lands
| Surface | Theme | Radius | Density | Notes |
|---|---|---|---|---|
| Landing `/` | dark | 4px controls, 12px cards | site | the full concept above |
| `/partner`, `/research`, `/docs`, `/api` | light (tokens) | 4/12 | site | inherit buttons, chips, captions; `/api` gets the code panel |
| `/id` | light | 4/12 | site | tokens only, no content change |
| `/lab` | lab bench (light) | lab | lab | untouched; shares font, accent and focus ring |
| `/pro` | light chrome, dark code/terminal | 4–12 | app 13px | adopts the status chips, tool-call rows and usage meter |
| Backoffice | dark default, light toggle | 20px panels, pills | app 13px | section 3 |

---

## 3. Backoffice redesign (admin.iot.ai.id)

### 3.1 Shell (dashboard ref #30–32)
An inset layout: the ground is `--ds-ground`. The **sidebar** is a 248px rounded panel (collapsible to a 64px icon rail), and **main** is a rounded panel with a 16px gap. Under 900px the sidebar becomes a bottom sheet behind a top-left menu button.

**Sidebar, top to bottom:**
1. AIoT mark plus a collapse icon
2. **Workspace switcher card**: `AIoT HQ · All regions` ▾ (later: per Lab Mitra region; v1 shows a single workspace, and the switcher is the region filter)
3. ⌘K search
4. **WORKSPACE**, routes with live counts (the active one is an inverted pill):
   - Today
   - Pipeline `{new inquiries}`
   - Testing `{tasks awaiting verification}`
   - Builder `{runs today}`
   - Catalog `{pending proposals}`
5. **IN FLIGHT** (up to 5 rows): active test tasks and Pro projects with a status dot plus right-aligned `Day N`
6. Pinned card at the bottom: **Next gate**, e.g. "Payout run · Fri 31 Oct" or "Kill-switch at 82%", whichever comes soonest
7. System · Team · Sign out

### 3.2 Routes (real routes, not anchors)
`/backoffice/today` (default) · `/pipeline` (`/inquiries`, `/organizations`) · `/testing` (`/tasks`, `/sites`, `/payouts`) · `/builder` (`/projects`, `/members`, `/tokens`, `/usage`) · `/catalog` (`/parts`, `/proposals`, `/products`) · `/system` (`/ai`, `/runtime`, `/team`). On admin.iot.ai.id the same paths sit under `/`. Each page has the same header: breadcrumb, a 32px/300 title, an optional white pill (`Day 12 of 30` for a campaign), pill tabs for sub-pages, and right-aligned actions (`+ New …` opens a drawer).

### 3.3 Today (home)
Order follows "what needs me first":
1. **KPI strip** (one style, real numbers only, each linking to its list): New inquiries · Tasks awaiting verification · Payouts due (IDR) · Builder spend this month vs kill-switch (usage meter) · Pending catalog proposals. Deltas appear only if history exists.
2. **Late and blocked** `{n}` (left, 7 columns). Rows: severity tile, bold title, warn chip ("3 days late" or "Blocked 2 days"), category, and **a reason line that is required**. If the reason is missing, the row shows `no reason recorded` in warn, which is itself a signal. Owner, `Reschedule`, `Open`. Sources:
   - inquiries with no reply past the promised reply time (decision 1.10-2)
   - lab tasks past `dueAt` in any state before verified
   - submitted evidence not verified within 2 working days
   - payouts approved but unpaid past their run date
   - catalog proposals older than 7 days
   - Pro turns that ended in `kill_switch` or a failed save gate in the last 24h
3. **Next 7 days** `{n}` (right, 5 columns): payout runs, task due dates, scheduled field deployments, token expiries (90-day PATs), trial expiries (once the trial ships). Each row is title · `date · context` · status pill.
4. **Campaign timeline** (full width; dashboard ref #33). Rows are **active test engagements** (one row per organization or device under test). Bars follow the existing task flow, rendered as **gates**: `Spec → Assigned → Evidence → Verified → Paid`. Bar colours use the 5-state status set. A **Today marker** in accent runs through all rows, and there is a GATES row of dot chips. A segmented toggle switches Timeline/List. Footer: `12 of 31 steps done · 2 late · 1 blocked`.
5. **Gates awaiting approval** (approval cards): catalog proposals, payout runs, member grant requests, USB/remote jobs. Each card has one primary action and shows the evidence needed to approve.
6. **Day grid** (only when a campaign is selected): a 30-cell grid, today in accent, gate days dotted, plus a tick progress tile.
Legacy dev-runtime telemetry (experiments, agent vs human, Wokwi, coordinator) **leaves Today** and goes to System → Runtime.

### 3.4 How each existing area fits
| Today's panel | New home | Change |
|---|---|---|
| Inquiries | Pipeline → Inquiries | CRM table (status chips, owner, age, source); saved views as pill tabs (New · Replied · Qualified · Won · Lost); detail drawer with the reply log; inquiry type gains `Builder / API access` |
| Organizations | Pipeline → Organizations | table plus drawer; the create form moves behind `+ New` |
| Lab tasks | Testing → Tasks | Board (columns = gates) / Timeline / List toggle; task drawer shows the protocol, evidence, verify action (approval card) |
| Lab Mitra sites | Testing → Sites | new: the site list from the existing schools data with `PLANNED / ACTIVE` status; the same pins as the landing map |
| Commissions and payouts | Testing → Payouts | ledger table plus a payout-run approval card; IDR in mono |
| Members (plus grants) | Builder → Members | table with grant chips (`pro`, `pro-trial`, `lab`); grant change through an approval card; the create form goes to a drawer |
| (missing) Pro projects and runs | Builder → Projects | new: project table (owner, revisions, last turn, stop reason, cost), with a turn detail showing tool-call rows (refs #26) |
| (missing) MCP/API tokens | Builder → Tokens | new: token list (member, id prefix, created, expires, last used) plus revoke. Values never shown (existing hash-only rule). |
| (missing) Spend | Builder → Usage | per member/project usage meter against the kill-switch; Opus vs Sonnet split |
| Products | Catalog → Products | table plus drawer |
| Catalog (provenance plus proposals) | Catalog → Parts / Proposals | affectUI-style data table with provenance chips; proposals as approval cards; on localhost it uses the ops local bypass, or shows a clear `Staff sign-in required` state instead of a dead Retry |
| AI settings (6 cards, 2,330 px) | System → AI | compact provider table (provider · status · model · key set ✓ · actions). Pro architect model, effort, thinking and kill-switch move to **Builder → Usage → Settings**. Keys stay write-only. |
| Team | System → Team | table with role chips; invite in a drawer |
| Experiments, projects (legacy /build), runtime | System → Runtime | kept, collapsed, unchanged logic |

### 3.5 Data the redesign needs (small backend deltas)
- Lab tasks: `dueAt` and `blockedReason` (nullable) if missing; a migration in ops. *Assumption to verify in R3b.*
- Inquiries: `repliedAt` (it may be derivable from the existing reply log).
- One read-only aggregate endpoint `GET /ops/v1/admin/today` returning `{kpis, lateBlocked[], next7[], campaigns[], gates[]}`, built from existing tables (staff-only, same auth as the current ops panels).
- Builder admin reads: `GET /ops/v1/admin/pro/projects`, `/pro/usage`, `/tokens` (list metadata only), `POST /tokens/:id/revoke`. They reuse the usage records and PAT store from C1.

---

## 4. Milestones (follows docs/plans working rules)

Rules applied: approve before building (R0) · one vertical slice first (the hero plus the builder stage on the farm example, and Today on real data) · ≤1 agent-day per milestone, cut scope rather than extend · one review plus one fix round, then the rest goes to `docs/plans/backlog.md` · tiered tests · **disjoint files per agent, one integrator** · deploy and show after every milestone.

| # | Milestone | Owner files (exclusive) | Time box | Depends | Done when |
|---|---|---|---|---|---|
| **R0** | **Spec + mockups for approval.** Static HTML mockups of hero, 02 Builder stage, 03 Developers, and backoffice Today, at 1440 and 390, in dark. Founder answers 1.10 (1–4). | `docs/plans/revamp-plan.md`, mockups in scratchpad | 0.5 d | none | Founder approves; decisions recorded in the plan |
| **R1** | **Tokens + primitives.** Dark layer, accent, status set, Archivo 300, and the components in 2.4 (button, chips, status chip, segmented and pill tabs, card header, table, Fig caption, code panel, drawer); `/design` page updated; contrast unit test; `site-facts.json` generator. | `design/tokens.css`, `ui/*` (new files), `design-page.*`, `scripts/site-facts.ts` | 1 d | R0 | `/design` shows every component in both themes; contrast test green; facts JSON matches the registry and catalog |
| **R2a** | **Landing: hero + 01 Testing.** Map dark re-skin, overlay control, planned pins, 390 poster, region card cleanup, testing stepper, paper evidence record, Lab Mitra strip. "What we don't know" moved. | `hero-map/*`, `landing/testing.tsx`+css (new), `pages/content-pages.tsx` (research#sources only) | 1 d | R1 | e2e landing hero and testing green at 1440 and 390; no `[placeholder]` in the hero |
| **R2b** | **Landing: 02 Builder + 03 Developers.** Prompt moved from `landing-generate.tsx`, scroll stage with real crops (farm fixture screenshots generated by a script), 3 ways in, code panel tabs, tool grid from the registry. | `landing-generate.tsx` → `landing/builder.tsx`, `landing/developers.tsx`, `scripts/landing-shots.ts` | 1 d | R1 | the stage scrubs 7 steps, the reduced-motion static version works, the tool grid equals `mcp:true` in the registry |
| **R2c** | **Landing: 04 Builds, 05 Pricing, 06 FAQ, close, nav, footer, trace.** Carousel from fixtures, pricing with marked placeholders, FAQ table, dual CTA, title-block footer, trace spine, nav repoint. SC assets deleted. EntryPath moved to `/partner`. | `landing/showcase.tsx`, `landing/pricing.tsx`, `landing/faq.tsx`, `landing/trace.tsx`, `site-shell.*`, `partner-page.*` | 1 d | R1 | no `/#scenarios` links left; `/partner` shows one reply time; carousel items all carry chips |
| **R2-int** | **Landing integration** (integrator only): compose in `landing-new.tsx`, section numbering, delete dead CSS, `landing-motion.ts` trace and stage hooks, Lighthouse pass. | `landing-new.tsx`, `landing-new.css`, `landing-motion.ts` | 0.5 d | R2a–c | page ≤ 7,000 px at 1440; LCP image ≤ 200 KB; e2e for landing green; **deploy-web + show** |
| **R3a** | **Backoffice shell + routing + Today.** Inset shell, sidebar with counts and in-flight, router, ⌘K, Today page (KPI strip, late and blocked, next 7 days, gates) on `/admin/today`. | `backoffice.tsx` (shell only), `backoffice/shell.tsx`, `backoffice/today.tsx`, `backoffice/timeline.tsx` (new), `backoffice.css` | 1 d | R1 | sidebar items are routes with correct active state; Today renders from the endpoint; empty states are honest |
| **R3b** | **Pipeline + Testing pages** (split from `backoffice-ops.tsx`): CRM tables and drawers, task board/timeline/list, sites, payouts with approval card. Ops endpoint `/admin/today` plus `dueAt`/`blockedReason` migration. | `backoffice/pipeline.tsx`, `backoffice/testing.tsx`, `backoffice-ops.tsx` (delete when done), `services/ops/**/admin-today*`, ops migration | 1 d | R1 (R3a for the shell mount) | create forms only in drawers; timeline shows gates and the Today marker; contract tests for `/admin/today` |
| **R3c** | **Builder + Catalog + System pages.** Pro projects and runs, members and grants, tokens (list and revoke), usage meter plus architect settings; catalog data table with provenance and proposals; compact AI provider table; runtime moved. Ops admin read endpoints. | `backoffice/builder.tsx`, `backoffice/catalog.tsx` (from `backoffice-catalog.tsx`), `backoffice/system.tsx`, `ai-settings.tsx`, `services/ops/**/admin-pro*` | 1 d | R1 | token values never present in any response (contract test); AI page ≤ 1 viewport at 1440; localhost catalog no longer dead-ends |
| **R3-int** | **Backoffice integration**: mount the routes, theme toggle, 390 layout, full e2e. | `backoffice.tsx` (routes), `admin-gate.tsx` | 0.5 d | R3a–c | full e2e green; **deploy-web + deploy-ops + show** |
| **R4** | **Builder trial gate** (only if founder decision 1 = trial): `pro-trial` grant on sign-up, per-member USD cap (reserve and settle per ADR 012 §7), trial expiry, trial strings switch from "Request" to "Start free" through one flag. | `services/ops/**/pro-budget*`, `packages/pro-contract/*` (trial types), `pages/member-pages.tsx` (trial banner), a flag in `site-facts` | 1 d | R0 (independent of R1–R3) | a cap hit ends the turn with `stopReason:'budget'` and keeps revisions; landing copy flips with the flag |

**Parallel lanes:** after R1 we run R2a ‖ R2b ‖ R2c ‖ R3a, then R3b ‖ R3c, then the integrators. R4 runs alongside the whole thing on server files only. No two lanes touch the same file; only the integrators edit `landing-new.tsx` and `backoffice.tsx` routes (R3a owns only the shell part, and it is merged before R3-int).
**Vertical slice first:** R2a plus R2b (hero → builder on the farm example) is deployed and shown before R2c starts, if the founder wants to steer early.
**Tests per lane:** unit and contract tests on every change; e2e for the touched area (`tests/e2e/*landing*`, `*backoffice*`); full e2e once before each deploy; the image smoke test in CI.
**Not in this revamp:** Pro dark mode, OAuth for claude.ai connectors, real pricing and checkout, a per-region workspace switcher beyond the filter, new 3D renders or AI imagery, and any partner logos or testimonials.
