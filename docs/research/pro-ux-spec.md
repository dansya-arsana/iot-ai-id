# Pro workspace: M1 spec (UX)

Status: for founder approval. Reference case: the 4-field farm (Kebun Sumber Rejeki, Probolinggo).
Plan: `docs/plans/level-ladder-execution.md` rev 2, milestone M1.

> Note (2026-10-23, ADR 012): Pro has no fixed pipeline stages. The generating state (§5, mockup 07) shows the live agent timeline: tool calls, saved revisions and their verification results.
Design language: v2 "Bench Record" (`--lab-*` tokens in `apps/web/src/design/tokens.css`). Archivo for UI, IBM Plex Mono for IDs and values, warm-grey bench, 1 px lines, one live-green accent, one inverse surface.

## 1. Mockups

All at 1440 × 900 unless noted. The PNGs are in `docs/research/pro-mockups/`. The HTML generators were throwaway and are not kept; plan M8 regenerates the screens from the fixture (D1).

| File | Shows |
|---|---|
| `pro-mockups/01-workspace.png` | The default workspace: feature tree, 3D exploded node N2 with balloons and a measurement, view cube, properties of part U2, and the BOM tab |
| `pro-mockups/02-site-plan.png` | The site-plan view: 4 fields, 4 nodes, the gateway, links with distance and margin, link L3 selected with its budget, and the Checks tab |
| `pro-mockups/03-wiring.png` | The Wiring tab maximised (tree collapsed to a rail): diagram, pin table, cable list, wire W1 selected |
| `pro-mockups/04-code.png` | The Code tab maximised: files per board, the compile badge, the copy buttons, pin hover and the pin cross-check |
| `pro-mockups/05-checklist.png` | The Checklist tab maximised: progress per stage, a field × stage matrix and N2's open tasks, with the calibration task selected |
| `pro-mockups/05-checklist-mobile-390.png` | The checklist on a phone (390 × 844 @2x), for use in the field |
| `pro-mockups/06-buildsheet-p1..p3.png` | The Build Sheet, 3 A4 sheets: site and system; N2 detail; BOM, power, checks, checklist and tests |
| `pro-mockups/07-generating.png` | The generating state: agent progress (tool calls), live validation and model and limit info |

## 2. Layout

```
┌ top bar 52 ─ wordmark · Pro · project switcher · PROMPT BAR (inverse) · validity · Build Sheet · avatar ┐
├ tree 272 ┬ main (flex) ─────────────────────────────────┬ properties 316 ┤
│          │ viewport: 3D assembly | site plan (⌃1 / ⌃2)   │                 │
│          ├─ dock: Wiring · Code · Checklist · BOM · Power · Checks ─┤                 │
└ status bar 26: spec validity · pin cross-check · code verification · "AI-generated design" · units ┘
```

- The **dock** has three heights: 262 px (default), maximised (the viewport collapses to a 34 px bar with Restore ⌃1), and closed. The height is remembered per project.
- When a tab needs width (Wiring, Code), the **tree collapses to a 48 px rail**. Toggle it with ⌘\\. The properties panel stays, because it explains the selection.
- **Breakpoints:**
  - At 1280 px and wider, the layout above applies.
  - From 1024 to 1279 px, properties become a slide-over drawer (⌘I).
  - Below 1024 px, the workspace is read-only and the app shows the checklist and the Build Sheet download.
  - At 390 px, there is a dedicated checklist (05-mobile) with 44 px targets and a sticky "Next · Tick" bar.
- **The inverse surface** (scope black) is used only for the prompt bar. In the Build Sheet it marks the gateway box. Live green means only "done, valid or selected-in-3D". Amber means warnings. Red is reserved for errors and the +V wire colour.

## 3. Components

### 3.1 Top bar
- **Project switcher.** It shows the project name and revision (`r3`). The dropdown lists recent projects with their revision, the date and how far the checklist is, and has "New project".
- **Prompt bar** (inverse).
  - It shows the original brief. Clicking it expands a multi-line editor.
  - The model chip shows `claude-sonnet-5-5`, read-only. Staff see a link to Admin › AI settings.
  - `Regenerate ⌘↵` creates a new revision. It never overwrites the old one, and while it runs the label reads `Generating…`.
- **Validity pill:** `Valid · 2 ⚠`, `Not validated yet`, `Invalid · 3 errors` or `Stale · edited since compile`. Clicking it opens the Checks tab.
- **Build Sheet** exports the PDF. The menu offers EN/ID, "Current node only" and "Include code appendix".

### 3.2 Feature tree (Site → Fields → Nodes → Parts)
- **Row anatomy:** twisty · type icon · name · mono ID · badges · right-aligned metric (area, link and distance, count) · toggles.
- **Toggles** appear on hover, selection, or when a row is hidden or isolated. **Isolate** (target icon, ⌥-click the row) and **Show/Hide** (eye). Hidden rows dim to 40% and keep the eye-off icon. The footer shows "Isolated: N2 · 2 hidden · Show all · Exit (Esc)".
- **Node children:** Parts (n), Wires (n), Code (files), Checklist (done/total). A Links group sits at site level.
- **Badges:**
  - `BOX` means the part has no 3D model yet and is drawn as a labelled box. It replaces the lab's "model-only" chip.
  - An amber number (for example `14 dB`) is a warning on that row.
  - `✓` on a code file means it compiled or linted.
- **Filter** (`/`) matches parts, wires, pins and nets. For example, "GPIO4" finds U1 pin, W1 and PIN_ONEWIRE.

### 3.3 3D viewport (reuses `apps/web/src/lab/scene`)
- **Toolbar:**
  - Select (S), Measure (M), Section (X) | Isolate (I), Hide (H) | Fit (F).
  - The **Explode** slider runs from 0 to 100% and uses the `playAssembly` offsets in reverse.
  - The **context chip** reads "Isolated · N2".
- **View cube** (top right): click a face or edge to snap the view. Home resets to iso. The label shows the projection (Iso · persp. or Ortho, toggled with 5).
- **Balloons:** item numbers with leaders, the same numbers as the tree, the parts list and the BOM. The selected part gets an inverse balloon and a green edge highlight.
- **Measure:** edge to edge, or point to point, snapped to vertices. It shows dimension lines in 3D, an ink label, and a readout chip at the bottom left.
- **Section:** a plane along X, Y or Z with a drag handle. Cut faces are hatched.
- **Model-only parts** render as labelled boxes at their datasheet size. The chip at the bottom right says how many.
- **The site context** (pole, PV panel) is in the tree and hidden by default.

### 3.4 Site plan
- **Fields** are polygons with a hatch per crop (tree dots, rows, cross-hatch, beds) and a label with the field letter, crop and area.
- **Nodes** are ring markers with an ID. The centre is green, or amber when the node has a warning. The **gateway** is drawn as the pump house.
- **Links:** a dashed line is LoRa and a dotted line is Wi-Fi. The pill reads `L3 · 496 m · +14 dB`. A margin under 18 dB turns the line and pill amber. The selected link becomes an inverse pill.
- **Layers:** Links, Coverage (the Wi-Fi AP reach as an estimate) and Satellite (off by default, and only with an imagery licence).
- **Provenance is always visible:** "Sketched from your prompt · not surveyed" and "distances ±10%". Distances are computed from the plan, so they never disagree with the text.

### 3.5 Properties panel, by selection type
- **Part:** ID, type tags (registry ✓, 3D model or BOX, band), placement, electrical data, connections (wire list), and the link if it is a radio. Actions: Swap part…, Show wiring, Datasheet.
- **Link:** distance, channel, airtime, interval, antenna heights. The link budget is a table that ends in a margin labelled *estimate*, with a warning callout. Below it are **Fixes**, each with its predicted effect, and each fix makes a new revision.
- **Wire:** ID, net, colour, route as a stepper (pin → terminal → gland → part), cable type and cut length, pull-up, the `In code` reference, and its checklist item with Show in 3D and Assembly step.
- **File:** board, FQBN, toolchain, core, result, flash and RAM, library versions, and a pin cross-check table. Callout: "Compiled is not tested".
- **Task:** steps, a record form for the expected range, and its source. If the task writes back, it says so: "Saving makes r4: constants change, file recompiles".
- **Site, field and node** (not mocked): area, crop needs, climate from the hero-map region, power summary, enclosure.

### 3.6 Dock tabs
- **Wiring** (per node, segmented N1–N4 and GW):
  - The diagram is auto-laid out from the netlist. The enclosure boundary is dashed and the glands are marked G1–G7. Terminal blocks are TB1–TB4.
  - Every wire carries a pill `W1 · GPIO4 → DATA` coloured by the wire code. Power and ground use net flags, not long runs.
  - Filters: All wires, Signal, Power. Zoom, fit and SVG export. "▶ Assembly steps" plays `playAssembly` in 3D.
  - Below it are the **Pin table** (GPIO, net, to, wire, note) and the **Cable list** (wire, from → to, via, length, gauge, plus a total of wires, glands and metres).
- **Code:**
  - Files are grouped by board. The selected file has a header with a **compile badge** (`✓ compiled · esp32 3.0.7`), a dashed **`not run on hardware`** tag and **Copy file**. The tab bar has Copy all, `.zip` and Re-verify.
  - `PIN_*` identifiers are underlined in green. Hovering one shows GPIO → part · wire.
  - A compile log line sits at the bottom. On failure it expands with the first error and the line is highlighted.
- **Checklist:**
  - A summary (118 of 204 · 58%), 7 stage cards (Procure, Flash, Wire, Power-up, Install, Calibrate, Commission) and a field × stage matrix.
  - The task list for the selected node is grouped by stage. Each task shows its source ("from wiring", "updates code", "check") and who ticked it and when.
  - Filters: All, Open, Done. Print.
- **BOM:** per node or for the farm. Columns: ref, part, quantity, unit and line in IDR ranges, and a 3D status column. The footer has the node total. A side panel has the farm total, the price-source note and "Add all to procurement checklist". CSV export.
- **Power** (not mocked; in the Build Sheet): Wh per day in and out per node, storage, days without sun, and status. A node on mains with no battery is flagged.
- **Checks:** pass, warn and fail counts with a rule table, warnings first. "Show" jumps to the object.

### 3.7 Status bar
`SystemSpec v1 · r3 · valid` · `Pins 13/13 cross-checked` · `Code: 4 compiled · 1 linted · 0 run on hardware` · `AI-generated design · review before you build` · `mm · IDR · EN`. It is always visible and never hidden by a mode.

## 4. Interactions

- **One selection model.** Selecting anything in the tree, 3D, the site plan, the wiring diagram, the pin table, the cable list or a code `PIN_*` selects the same object everywhere and fills the properties panel. Hover cross-highlights it without selecting. Esc clears the selection, then the isolation.
- **Revisions.**
  - Generate makes r1. Regenerate, an accepted fix, or a recorded calibration makes r+1.
  - The switcher keeps the history, with a diff of parts, wires and pins.
  - Ticks carry over by stable task ID. A task whose source changed is reopened and marked "changed in r4".
- **Copy:** Copy file copies exactly what was compiled. Copy all gives a `.zip` with `README.txt` (board settings, libraries, flashing steps). A toast says "Copied node-melon.ino (64 lines) · compiled, not run on hardware".
- **Calibration loop:** the CAL-2 record → constants → recompile → the task is ticked. That is the only place field data writes back into code.
- **Checklist persistence:** ticks and readings are saved per project in the ops DB (M7) and are visible to collaborators. Offline ticks on mobile queue up and sync, and "saved · synced" turns into "3 waiting to sync".
- **Shortcuts:**

| Keys | Action |
|---|---|
| ⌃1 / ⌃2 | 3D or site plan |
| S M X I H F | 3D tools |
| / | Filter the tree |
| ⌘\\ | Collapse the tree |
| ⌘I | Properties |
| ⌘J | Toggle the dock |
| ⌘⇧M | Maximise the dock |
| ⌘↵ | Regenerate |
| ⌘P | Build Sheet |
| Space | Tick the focused task |

## 5. States

| State | Behaviour |
|---|---|
| Empty (no project) | A centred prompt with three examples: farm, greenhouse, cold room. Below it: "Pro designs; it does not emulate". |
| Generating (07) | Pipeline card with 7 steps, times, and a live "validated so far" list. The plan draws in as the spec arrives. Cancel is allowed. Nothing is saved until the spec validates. Progress is announced through `aria-live`. |
| Validation failed | The spec is repaired once automatically. If it still fails, the app shows the zod errors grouped by object, with "Edit prompt" and "Report". No partial project is saved. |
| Compile failed | The file gets a red `✗ failed` badge and the log opens on the first error. Copy is still allowed, with the label "does not compile". The Build Sheet stamp says so. |
| Partially verified | For example "3 of 4 compiled". The status bar and the Build Sheet stamp show the exact counts. |
| Stale | Something was edited after the last compile: an amber `Stale` pill and a Re-verify button. Copy is allowed and labelled "not re-verified". |
| No AI key / limit reached | Members see "AI is not set up for this workspace" or "20 of 20 runs today, resets 00:00 WIB". Staff get a link to Admin › AI settings. The key is never shown. |
| Model-only parts | `BOX` in the tree and BOM, a labelled box in 3D, "box" in the parts list. |
| Warnings | Amber row flag, amber link, Checks count, and an "Open warning" note on Build Sheet sheet 1. |
| Saving / offline | "saved 14:02", "saving…" or "offline · 3 changes queued" next to the revision. |

## 6. Honesty rules (hard)

1. **Never** say tested, works, verified on device, simulated or live for Pro output. The only allowed verbs are **compiled**, **linted**, **cross-checked** and **estimated**.
2. Every code view and export carries **`compiled ✓ · not run on hardware`** (or `linted ✓`). The status bar counts `0 run on hardware`.
3. Every derived number from the design is labelled **est.**, with its basis, and is shown as a range where it is uncertain: link margins, power autonomy, prices and distances. Prices are "ranges, not quotes", with the source month.
4. **Provenance:** the site plan is "sketched from your prompt, not surveyed". Distances are computed from the plan, so they always match the text.
5. **AI attribution:** "AI-generated design · review before you build" in the status bar. In the Build Sheet, "Drawn by AI · claude-sonnet-5-5", blank Checked and Approved fields, and Status `DESIGN · NOT BUILT · NOT TESTED`.
6. **No fake readings.** The Pro workspace never shows sensor values. Only checklist records entered by a person appear, with the name and time.
7. **Regulatory caution.** The band is chosen as AS923-2 (920–923 MHz). The UI never claims certification or compliance.
8. **Verification scope is stated.** "Pin cross-check" means names in code match the wiring nets. It does not mean electrical correctness under load.
9. Parts without a 3D model are never drawn as if they were real models.

## 7. Accessibility

- **Roles:** tree (`role=tree/treeitem`, `aria-expanded`, `aria-selected`); dock (`tablist/tab`); viewport tools (`toolbar`); explode (`slider` with a value); checklist items (native checkboxes, 24 px on desktop and 44 px on mobile).
- **The 3D view has a text equivalent.** The tree and the parts list hold the same information. The canvas has an `aria-label` that points to them, and every 3D action also exists as a tree or menu action.
- **Colour is never the only carrier.**
  - Wires show their ID and their from → to on the pill and in the tables. The legend names each colour.
  - Warnings use `!` and text as well as amber.
  - Link types use the dash pattern and the text as well as colour.
- **Contrast:** body text uses ink and ink-2 on paper or card (AA). ink-3 is only for secondary labels of 11 px and up. Amber text uses `--lab-pwm-ink`.
- **Keyboard:**
  - Everything is reachable. Focus rings use the lab `:focus-visible` style (2 px ink, 2 px offset).
  - Arrow keys walk the tree and the tables. Enter selects. Space ticks.
- **Motion:** explode and camera moves respect `prefers-reduced-motion` (they jump instead of animating).
- **Generation progress** is announced politely, one line per step.
- **The PDF** is tagged, with real text (not images) and a reading order of header, sections, title block. It is built in EN or ID.

## 8. Build Sheet (A4, EN/ID)

- **Every sheet** has a drawing frame with zone marks A–F and 1–4, a header with a verification stamp, and a title block. The title block holds: project and drawing, doc and revision, date, scale, sheet "n of N", drawn by (the AI model), checked and approved (blank for signatures), and status.
- **Sheet 1, site and system:**
  - the brief quoted from the prompt, and a locator built from the hero-map grid;
  - the site plan;
  - the node schedule;
  - the site context from the hero-map region (climate and stress) with the design response, and open warnings;
  - the system architecture.
- **Sheet 2, node detail** (one per node and the gateway; the mockup shows N2):
  - an exploded 3D render with balloons and the parts list;
  - the wiring diagram;
  - the pin table and the cable list;
  - `pins_n2.h`, and a code stamp. The full listings go in appendix A.
- **Sheet 3:**
  - the consolidated BOM with IDR ranges;
  - the power budget with in/out bars;
  - the design checks;
  - a printable checklist matrix with tick boxes and a sign column;
  - the test plan T-01 to T-06 with pass criteria and result fields;
  - field installation per node;
  - sign-off (built, tested, accepted);
  - revisions.
- **For the farm:** sheet 1, then 5 sheets of type 2, then sheet 3, then appendix A (code) is about 12 pages.

## 9. What the UI needs from SystemSpec (input for M2)

Stable IDs for everything: `F*`, `N*`, `GW`, part refs, `W*`, `TB*-n`, `G*`, `L*`, task IDs. The spec also needs:

- **Per node:** field, board FQBN, parts with registry IDs and 3D status, nets, wires (colour class, from, to, terminal, gland, length, gauge), and power sources and loads.
- **Per link:** endpoints, type, channel or SF, and antenna heights. Distance and budget are computed, not trusted from the model.
- **Per code file:** board, pins map (to cross-check), libraries pinned to versions, and the constants that are calibration targets (they map to tasks).
- **Checklist:** generated from all of the above by rules, not by the LLM, so the counts are deterministic.

## 10. Reuse map

| Need | Reuse |
|---|---|
| 3D node assembly, explode, balloons | `lab/scene` (assembly.ts, parts/*, layout, picking, selection) plus `playAssembly` |
| Parts, pins, validation | The `lab` part registry (80 parts, plus M3 additions), CircuitSpec and its validator |
| Power numbers | The lab power solver, extended with Wh/day and autonomy |
| Compile badge | `services/ops/lab-compile.ts` sandbox (add the ESP32 core in M2), plus a Python lint step |
| Model and key | `services/api/credentials.ts` vault, and the `lab-spec.ts` internal LLM path |
| Locator and climate | `hero-map-data.ts` grid and `hero-map/regions.ts` facts |
| Tokens | `--lab-*`, plus the 9 wire-colour tokens (`--w-pwr` … `--w-load`) |

## 11. Open questions for the founder

1. When the dock is maximised, should the tree collapse automatically (as mocked) or stay?
2. Should the Build Sheet be EN-only for M7, with ID in a later milestone?
3. Prices: are marketplace ranges enough, or does a partner supplier list come first?
4. Should Satellite imagery in the site plan wait until there is a licensed source? (Assumed: yes, off by default.)
