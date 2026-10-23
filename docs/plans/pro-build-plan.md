# Pro / Architect: build plan M2–M8 (rev 3, agentic)

Status: rev 3, 2026-10-23. Follows `level-ladder-execution.md` (the "model thinks, we provide verified hands" principle) and ADR 012. Supersedes rev 1 (the fixed two-stage pipeline). For Pro, it also supersedes the level-ladder "Structured output" bullet and its M2–M7 rows.

Inputs, all in the repo:
- `docs/research/pro-ux-spec.md` and `pro-mockups/`;
- `docs/research/agri-domain.md`, as one sample domain pack. The farm is only a sample;
- `docs/research/pro-parts-briefs.md`;
- `docs/research/systemspec.draft.ts`;
- `docs/research/pro-arch-draft.md`;
- the CI files `.github/workflows/ci.yml` and `scripts/ci/smoke-image.sh`.

Step 0 (done in this change): the inputs above were copied from session-local temp files. Nothing depends on it.

---

## 0. Ground rules for every milestone

- **One integrator** per milestone. Only the integrator touches the shared files below. Agents own disjoint files and never stash, rebase or leave half-done work.
- **Shared files** (integrator only):
  - `package.json`, `tsconfig*.json`, `vite.config.*`, `playwright.config.ts`, `CHANGELOG.md`;
  - `apps/web/src/main.tsx` (routes), and `apps/web/src/backoffice.tsx` or whichever file mounts backoffice pages;
  - `packages/ops-contract/index.ts` and `apps/web/src/backoffice-ops.tsx`. Adding `'pro'` to `MEMBER_GRANTS` also needs a `GRANT_LABELS.pro` entry, or typecheck fails. Both files are dirty from the lab gate;
  - `services/ops/ops.ts` and `services/api/server.ts` (single owner M3-A; others ask through the integrator);
  - `docs/adr/*` and `docs/plans/backlog.md`.
- **Owner only:** `deploy/*` (including `deploy/nginx.conf`) and `.claude/`.
- **The lab gate is open.** Nothing under `apps/web/src/lab/**` or in `apps/web/src/preview.tsx` is edited until the lab-gate commit lands. After that, Pro still only *imports* lab code; it never edits it. M4 adds new part files there.
- **Ports.** Never 5173 or 8787. e2e uses the existing webServer port (8891) with a `mktemp` DB.
- **Tests:**
  - every agent runs `npm test` (unit and contract) on its own files;
  - each milestone runs e2e for the areas it touched;
  - the full e2e suite and `npm run check` run once per milestone, by the integrator, before the deploy.
- **Time box.** If a milestone runs over its time box, cut the items marked *cut-first*; do not extend it. There is one review round and one fix round, and anything left goes to `docs/plans/backlog.md`.
- **Deploy.** The user runs `deploy/deploy-web.sh` or `deploy/deploy-ops.sh` after `npm run check` and e2e are green. Agents never run deploy scripts.
- **Small deploys:** one per milestone. Staff-only until M8.
- New web code goes only in `apps/web/src/pro/**` and `apps/web/src/catalog/**`.

## 1. Direction in one paragraph

The model (Sonnet 5.5 by default, Opus 5.5 selectable in admin) runs an agentic tool-use loop, with streaming, extended thinking, project history persisted per project and skills loaded on demand. It decides what to call and in what order. Platform tools, MCP, skills and history give it verified hands and never cap its reasoning. Verification is a gate, not a cage: only tool-verified items show as "verified" in the Build Sheet, and everything else is labelled "unverified".

## 2. Decisions (binding unless the founder overrides)

| # | Decision |
|---|---|
| D1 | `allocate_pins` implements the ARCH allocator (I²C 21/22, LoRa RST 14 and DIO0 26, UART2 16/17; never strap or flash pins). The model may propose other pins; `validate_netlist` decides. The mockup pins are regenerated from the fixture in M8. |
| D2 | **Stable ids.** UX shows `F1/N2/GW/L3/W1/TB1/G1`. ARCH stores slugs (`node-melon`, `gateway`, `link-node-melon-gateway`). Slugs are stored. Display refs come from a pure `displayRefs(spec)` in `packages/pro-contract/refs.ts` (written in M2.0). It numbers fields, nodes and links in spec order, uses `GW` for the gateway, and gives terminal blocks and glands numbers from `wiring.ts`. Refs are never stored and never used as keys. |
| D3 | **Peak sun hours.** ARCH uses 4.0; DOMAIN says 3.5 (wet-season months, ESDM). **3.5** for `site.peakSunHours`, with a 0.7 derate as in DOMAIN PWR-01. |
| D4 | **LoRa margin.** ARCH requires a 10 dB margin; UX warns under 18 dB, and its demo L3 at +14 dB is a warning. `ok` at 18 dB or more; *warning* from 10 to 18 dB; *error* under 10 dB. Every value is labelled "est.". The farm demo keeps L3 as a warning. |
| D5 | **Rule severities.** DOMAIN has `block/warn/info` with source grades A–M; ARCH has `error/warning/info`. `block` maps to `error` **only if the rule's grade is A or B**. Otherwise it is downgraded to `warning`, and the check text names the grade. `packages/pro-tools/data/rules.ts` imports agri-domain §7 as data. |
| D6 | **Battery.** PARTS defaults to LiFePO4 4S because a PWM controller overcharges Li-ion. DOMAIN example A uses one 18650 for a sensor-only node. Sensor-only nodes use a 1S Li-ion 18650 with a solar Li-ion charger. Valve and pump nodes use 12.8 V LiFePO4 4S with a PWM or MPPT controller. Check PWR-03 (controller chemistry must match the battery) is an error. The `battery-18650-pack` kind gets a `chemistry` prop. |
| D7 | **LoRa module.** The PARTS group C kind `lora-ra02` is 433 MHz; DOMAIN NET-05 and ARCH §8 block it in Indonesia. M4 group C builds **`lora-rfm95w`** (SX1276, 868/915 class, used at 920–923 MHz) as the Pro default. `lora-ra02` becomes optional for the Learn lab only, and Pro's check gives an error for it. Whether the Ra-01H fits the same footprint is noted as unconfirmed in its docs page. Founder confirmation is Q1. |
| D8 | `save_revision` writes r+1 with `baseRevision` (409 if stale) and never overwrites. Human edits, accepted fixes and calibrations go through it too. |
| D9 | The UI reads `GET pro/quota` (turns, USD and compiles) and never hard-codes a limit. |
| D10 | Calibration writeback moves to M7, from live readings, and is *cut-first*. |
| D11 | **Deferred from UX:** collaborators, offline tick queue, satellite layer, the revision diff UI, the `.zip` with README. Backlog, except the `.zip`, which is *cut-first* in M6. Offline ticks: the mobile view only shows "offline" and disables ticking. |
| D12 | The merged catalog is M2 (early), not backlog. `packages/catalog` holds the data and provenance; `packages/pro-tools` holds the logic. There is no `pro-catalog` package. |
| D13 | Agentic loop, not a pipeline. The loop runs in ops (`services/ops/pro-agent.ts`). The api is a key-holding model proxy (`POST /internal/pro/messages`, streamed). There are no fixed stages and no forced tool_choice. |
| D14 | One registry, two surfaces. `packages/pro-tools/registry.ts` (zod → JSON Schema) feeds the Anthropic `tools` and `services/api/mcp.ts`. Pure tools run in-process in both. Service tools go through ops. |
| D15 | SystemSpec is a revision artifact built through `save_revision` patches (a JSON Patch subset, at most 200 ops). The server derives W-numbers, checklist ids (`ckId`), BOM totals and per-item `verification`. The model never sets them. |
| D16 | Hardware tools are client-executed: they run only inside the desktop app, against its local API. Every `device_flash` needs a native dialog, and the token is bound to the port and the file sha256. MCP never flashes. |
| D17 | Models: `PRO_MODELS=['claude-sonnet-5-5','claude-opus-5-5']`, Sonnet by default, chosen globally in admin. Extended (interleaved) thinking is on, with an admin budget. Streaming is always on. The registry order is untouched. |
| D18 | Untrusted channels (user text, catalog free text, datasheet excerpts, serial, telemetry) come back from tools inside `untrusted` fields. There is no web-fetch tool. The 'Tested in AIoT lab' badge is set only by staff, citing a verified Lab Mitra task id (ADR 010). |

## 3. Tool set

The full table is in ADR 012 §2. Columns: # | name | input (sketch) | output (sketch) | det. | side effect | consent | runs at | MCP.

| # | Name | Input | Output | Det. | Side effect | Consent | Runs at | MCP |
|---|---|---|---|---|---|---|---|---|
| 1 | `catalog_search` | q, kind?, protocol?, boardFamily?, outdoor?, testedInLab?, limit≤20 | items {id, name, kind, summary, badges{testedInLab, verifiedShare}}, catalogVersion | yes | none | none | server (pure) | yes |
| 2 | `catalog_get_part` | id, fields? | PartRecord, every leaf `{v, p{source, verifiedBy, at, confidence}}`; free text under `untrusted` | yes | none | none | pure | yes |
| 3 | `check_compatibility` | board, parts[{partId, qty?, props?}], supplyV? | ok, issues[{code, severity, en, id, ref, grade}]: voltage, logic level, bus, I²C address, current | yes | none | none | pure | yes |
| 4 | `allocate_pins` | board, parts[{ref, partId}] | pins: PinRow[], issues | yes | none | none | pure | yes |
| 5 | `validate_netlist` | board, parts[{ref, partId, props?}], nets[{name, terminals["ref.PIN"]}] | ok, issues, wires[] (W#, colour, gauge, length, connector) | yes | none | none | pure | yes |
| 6 | `solve_power` | loads[{partId, dutyCycle?}], source solar/battery/mains, chemistry?, site{peakSunHours?, autonomyDays?} | avgMa, peakMa, whPerDay, batteryWh, panelW, controller, issues (D3, D6) | yes | none | none | pure | yes |
| 7 | `estimate_link` | medium lora/wifi/rs485, distanceM, terrain, sf?, txDbm?, moduleId? | marginDb, status ok/warning/error (D4), estimate:true, issues | yes | none | none | pure | yes |
| 8 | `site_climate` | regionId, or lat/lon (rounded to 0.01°) | peakSunHours, rainMmByMonth[12], tempC{min,max}, rhPct, source, confidence | yes | none | none | pure | yes |
| 9 | `compile_code` | target esp32/esp32s3/uno/nano/python/micropython, file{name, content≤40KB} | status compiled/linted/failed/pending, diagnostics≤20, pinsReferenced, sha256, toolchain, artifactSha? | yes (pinned toolchain, cached by sha) | compute (sandbox, `--network none`, quota) | none | ops | yes |
| 10 | `price_bom` | lines[{partId, qty}] | lines with minIdr/maxIdr/checkedAt/source, totals, missing[] | yes | none | none | pure | yes |
| 11 | `save_revision` | projectId, baseRevision, ops (SpecPatch ≤200), reason≤200 | revision, specSha, verification{verified, unverified[{path, reason}]}, checks[] | the gate is | write (pro_revisions r+1) | none | ops | yes |
| 12 | `get_revision` | projectId, revision?, path? | revision, spec or subtree | yes | none | none | ops | yes |
| 13 | `render` | projectId, revision, view 3d/wiring/checklist/build_sheet, nodeId? | ok, viewUrl (app-relative), layoutIssues[] (overlap, A4 fit) | yes | ui (opens a pane) | none | ops plus browser | yes (returns layoutIssues only) |
| 14 | `load_skill` | name (an installed skill) | name, version, sha256, body | yes | none | none | pure | yes |
| 15 | `catalog_propose` | partId or newPart, field, value, sourceUrl, note | proposalId, status:pending | no | write (proposal only) | none | ops | yes |
| 16 | `device_detect` | {} | boards[{port, label, vid, pid, family?}], toolchain | no | none | none | client (desktop) | yes (local only) |
| 17 | `device_flash` | port, projectId, revision, nodeId, fileSha | ok, bytes, ms, or consent_required/consent_denied | no | **physical** | **native, per flash** | client (desktop) | **no** |
| 18 | `serial_read` | port, sinceLine?, maxLines≤200, baud? | lines[{n, t, text}] (untrusted), open | no | none | port trust (20 min window) | client | yes (local only) |
| 19 | `telemetry_read` | projectId, nodeId?, sinceMs, max≤500 | messages[{topic, at, payload≤4KB}] (untrusted) | no | none | none | client | yes (local only) |
| 20 | `evidence_status` | projectId, revision? | items[{itemId, state open/suggested/ticked, by human/evidence, evidenceRef}], anomalies[{nodeId, code, en, id, severity}] | yes | none | none | ops | yes |

- Ticks from evidence are written by the evidence pipeline (M7), never by a model tool.
- Actuator commands over MQTT (for example, opening a valve) are NOT a tool. They are backlog and need their own consent design.

## 4. Milestones

| # | Milestone | Track | Time box | Depends on | Done when |
|---|---|---|---|---|---|
| Step 0 | Inputs copied to `docs/research/`; ADR 012 | — | done | — | no temp-file paths |
| M2.0 | Contract freeze: PartRecord and provenance, SystemSpec as a revision artifact plus SpecPatch plus `verification`, the 20-tool registry (schemas only), agent event protocol, farm fixtures | all | ≤2 h | — | contract tests green |
| M2 | **Verified catalog:** merge the 4 sources, provenance on every field, overlay plus proposals, import/verify workflow, staff provenance UI, "Tested in AIoT lab" badge | A | 1 d | M2.0 | no-drift test green; staff page shows provenance |
| M3 | **Agent loop and tools:** api model proxy (stream, thinking, vault/env key, Sonnet/Opus); ops loop (history, budgets, SSE, client tools); pure tools; sandbox `compile_code`; `save_revision` gate; MCP; skills | B | 1 d, plus a 0.5 d live smoke on day 2 | M2.0 (catalog fixture until M2 merges) | the fixture farm conversation yields a gated r1 offline; one staff live smoke run |
| M4 | Board and field parts (the old M3, D7), each with a catalog record | A | 0.5–1 d | M2, lab gate | lab contract test and catalog contract test green |
| M5 | `/pro` workspace: chat with a streaming agent timeline, tree, 3D CAD, site plan | C | 1 d | M2.0 events, lab gate | `/pro/dev` renders the farm; the fixture turn streams |
| M6 | Panels: wiring, pin table, code, checklist, BOM, power, checks; provenance popovers; verified/unverified labels | C | 1 d | M5 hooks | readable A4 wiring; ticks persist |
| M7 | **Real-time:** ESP32 detect and consented flash, serial, MQTT telemetry, evidence ticks, anomaly hints | D | 1 d | M3 client-tool protocol, M3 artifacts | a real ESP32 is flashed after native consent and items auto-tick; fake-bridge tests green |
| M8 | Build Sheet, `/pro` gate, member rollout | C | 1 d | M6 (M7 optional) | a member with `pro` runs prompt → conversation → verified revision → print |

```
Day 1  M2.0 (≤2 h) → M2 ∥ M3
Day 2  M3 live smoke ∥ M4 ∥ M5
Day 3  M6 ∥ M7
Day 4  M8
```

Hard dependencies:
- M2.0 comes before everything.
- The lab gate comes before the `pro` grant, M4, and any new web route.
- M5's hooks are frozen by mid-day 2.

## 5. M2.0: contract freeze (one agent, ≤2 h)

- **Ownership:**
  - `packages/catalog/schema.ts`: `F<T>={v:T,p:{source,verifiedBy:'import'|'staff:<id>'|'lab:<schoolId>',at,confidence:'high'|'medium'|'low'}}` and the PartRecord groups from level-ladder §1: identity, electrical, pins, protocols, mechanical, environment, drivers[{boardFamily, lib, snippet, verify}], pitfalls (untrusted), compatibleWith, price, model3d{kind, status}, labTested?{schoolId, taskId, at, by}.
  - `packages/catalog/fixtures/farm-parts.json`.
  - `packages/pro-contract/{system-spec.ts (from the draft; drop the Draft schemas; add ItemVerification{status: verified/unverified/failed, by, at, inputsSha, note?}), patch.ts, agent.ts (turn request; SSE events: text_delta, thinking_delta, tool_call, tool_result, client_tool_request, revision_saved, usage, done{stopReason}, error), refs.ts, pricing.ts (null entries)}`.
  - `packages/pro-tools/{registry.ts, types.ts}` (`defineTool({name, description, input, output, deterministic, effect, consent, runsAt, access, mcp})`).
  - `packages/pro-contract/fixtures/{farm-4-fields/spec.r1.json, agent/farm-turn.jsonl}`.
  - Tests `tests/pro-contract.test.ts` and `tests/pro-tools-registry.test.ts`.
- **Interfaces:** every tool input converts with `z.toJSONSchema` without transforms; names are unique snake_case.
- **Acceptance:** contract tests green; `device_flash` has `consent:'native'` and `mcp:false`.
- **Cut-first:** none (it is the blocker).

## 6. M2: verified catalog (track A, 1 d)

- **Ownership:**
  - **A1** `packages/catalog/{index,search,merge}.ts`, `import/{hardware-library,component-catalog,hardware-contract,lab-registry}.ts`, `data/*.json`, `scripts/catalog-import.ts`, plus tests `catalog-import` (the no-drift contract against the old packages) and `catalog-search`. The importers read `sim/devices` (pins, power) and list `scene/parts` by file name only, never importing three.js. Escalate if a device file imports DOM code.
  - **A2** `services/ops/catalog.ts` (tables `catalog_overlay` and `catalog_proposals`; routes `/ops/v1/catalog/*` for staff and `/ops/v1/member/catalog/{search,get}`), `scripts/catalog-export.ts` (folds the approved overlay into `data/*.json` for a commit), `tests/ops-catalog.test.ts`.
  - **A3** `apps/web/src/backoffice-catalog.tsx` and `apps/web/src/catalog/{Provenance,PartCard,LabTestedBadge}.tsx`. Filters: low confidence, stale over 12 months, unverified. The proposal queue has approve and reject. The badge form requires a verified Lab Mitra task id. Also `tests/e2e/44-catalog-provenance.spec.ts`.
  - The integrator adds the ops route line and the staff route.
- **Interfaces:** `catalog_search`, `catalog_get_part` and `catalog_propose` read and write through A2.
- **Acceptance:** the no-drift test is green; the staff page shows provenance.
- **Cut-first:** moving the old consumers onto `packages/catalog` (backlog; the old packages stay and the no-drift test guards them).

## 7. M3: agent loop and tools (track B, 1 d plus a 0.5 d smoke)

- **Ownership:**
  - **A** `services/api/pro-model.ts` (model allowlist, max_tokens and thinking caps, vault key with `ANTHROPIC_API_KEY` env fallback, SSE passthrough, fixture replay), `services/api/server.ts` (the route, plus `envFallback.anthropic` as a boolean in `GET /api/ai-settings`), `packages/ai-providers/index.ts` (`PRO_MODELS`, `PRO_DEFAULT_MODEL`, `AiPreferencesSchema.builder{model, thinkingBudget?}`), `apps/web/src/ai-settings.tsx` (model select, thinking budget, env-fallback indicator), `tests/pro-model-proxy.test.ts`. Use fetch with no new dependency. Verify the thinking and streaming parameters and the Sonnet and Opus 5.5 prices against the official Anthropic docs or the claude-api skill.
  - **B** `services/ops/pro.ts` (tables pro_projects, pro_revisions, pro_messages, pro_turns, pro_usage, pro_ticks, pro_evidence, pro_artifacts; routes) and `services/ops/pro-agent.ts` (loop; SSE `GET .../turns/:id/events`; `POST .../turns/:id/tool-results` for client tools with a 120 s timeout; history assembly that elides old tool_result bodies oldest-first; budgets). Tests `pro-agent` (the fixture transcript drives the full loop offline) and `pro-ops`.
  - **C** `services/ops/pro-tools.ts` (dispatch, authz, per-tool rate limits, untrusted wrapping) and `packages/pro-tools/verify-spec.ts` (the gate). Tests `pro-tools-dispatch` and `pro-verify-gate`.
  - **D1** `packages/pro-tools/impl/{compatibility,allocate,netlist,wiring,code-lint,config-block}.ts` and their tests. The CONFIG block emits `AIOT_BOOT_BANNER`, and the lint requires it to be printed in setup (M7 evidence).
  - **D2** `packages/pro-tools/impl/{power,link,bom,climate,checks,checklist,testplan}.ts` and `packages/pro-tools/data/{rules,crops,prices,radio}.ts` (from agri-domain §1.5, §3.1, §6 and §7), plus tests.
  - **E** `scripts/pro-sandbox/{Dockerfile.esp32,Dockerfile.py,lint.py,README.md}`, `services/ops/pro-compile.ts` (ProCompiler, with the artifact bin of at most 4 MB stored by sha) and `tests/pro-compile.test.ts`. Run the measurement spike (pro-arch-draft §3.6).
  - **F** `services/api/mcp.ts` (register the registry; pure tools in-process; service tools through loopback `IOT_OPS_URL`; no `device_flash`), `packages/pro-skills/{index.ts,agri-id.md,lora-as923-id.md,power-solar-tropics.md}`, and tests `mcp-pro-tools` and `pro-skills`.
- **Interfaces:** the model proxy `POST /internal/pro/messages` (ADR 011 token); the turn routes and SSE events from M2.0; the registry from M2.0.
- **Acceptance:**
  - The fixture farm turn calls at least 8 distinct tools and saves r1.
  - Unverified items are listed.
  - The vault key beats the env key.
  - No key reaches ops or the browser.
  - Budget stop gives `stopReason:'budget'`.
  - Lab tests are unchanged.
  - One staff live smoke run records usage and USD in ADR 012.
- **Cut-first:** the skills beyond agri-id, and history elision tuning.

## 8. M4: board and field parts (track A, 0.5–1 d)

The old M3 ownership table, with D7 applied (the `lora-rfm95w` kind replaces `lora-ra02`). Each agent owns only its kinds' scaffolded files: the device `sim/devices/<kind>.ts`, the part `scene/parts/<kind>.ts`, its test, and `docs/lab-parts/<kind>.md`. Each kind also gets one catalog record in `packages/catalog/data/<kind>.json` with provenance from the brief's sources (`docs/research/pro-parts-briefs.md`). The integrator regenerates `docs/lab-parts/README.md` once.

| Agent | Kinds |
|---|---|
| M4-A gateway | `rpi-4b`, `rpi-5`, `rpi-lora-hat` (model-only) |
| M4-B MCU | `esp32-s3-devkitc`, `rpi-pico` (model-only) |
| M4-C radio and bus | **`lora-rfm95w`** (replaces `lora-ra02`), `max485`, `soil-npk-rs485` (model-only) |
| M4-D sensors | `bh1750`, `rain-gauge-tipping`, `soil-capacitive-v2` (*cut-first*) |
| M4-E actuators | `solenoid-valve-12v`, `pump-12v-r385` |
| M4-F power and enclosure | `solar-panel`, `solar-charge-pwm`, `battery-18650-pack` (with the D6 `chemistry` prop), `enclosure-ip65` |

- **Acceptance:** the lab contract test and the catalog contract test are green; `/lab/parts` shows every new kind with a correct `emulated` or `model-only` badge; each `[U]` value is recorded under "Sources disagree" in that part's docs page.

## 9. M5: `/pro` workspace (track C, 1 d)

The old M4 ownership table (shell and state, 3D, site plan), with lab code imported and never edited. If the lab scene lacks a hook, M5 wraps it in `apps/web/src/pro/cad/`, or falls back to `BOX`.

- **M5-A shell and state** (freezes its interfaces by mid-day 2): `apps/web/src/pro/state/{spec-store,selection}.ts`, `pro/workspace/{Workspace,FeatureTree,PropertiesPanel,StatusBar,Dock}.tsx`, `pro/pro.css`, `pro/dev-fixture.ts`, and one staff-gated dev route `/pro/dev` through the integrator. Hooks: `useProSpec`, `useSelection`, `useVisibility`, `registerDockTab`.
- **M5-B 3D:** `pro/cad/{node-assembly,explode,isolate,measure,section,view-cube,balloons}.ts(x)`, a Pro-netlist to lab-scene adapter, `tests/pro-node-assembly.test.ts`.
- **M5-C site plan:** `pro/siteplan/{layout,SitePlan,LinkPill}.tsx`, `tests/pro-siteplan-layout.test.ts`.
- **M5-D chat:** `pro/chat/{ChatPanel,Timeline,ToolCallCard,ThinkingToggle,ClientToolRunner}.tsx`. ClientToolRunner exists only when `isLocalHost`, and it posts tool-results. All model text renders as React text. The e2e test `40-pro-cad` gets a chat-stream case.
- **Acceptance:** `/pro/dev` renders the farm fixture; the fixture turn streams in the timeline; tree and 3D selection stay in sync; `git diff --stat` shows no file under `apps/web/src/lab/**` changed.
- **Cut-first:** measure and section tools.

## 10. M6: panels (track C, 1 d)

The old M5 and M6 ownership tables merged: wiring diagram (`pro/wiring/*`, pure `layoutNode`), pin table and cable list, code tab (`pro/code/*`, no `dangerouslySetInnerHTML`), checklist (`pro/checklist/*`, `pro/state/ticks.ts`), BOM, power and checks tabs. The UI never recomputes `spec.bom`, `node.power` or `spec.checks`.

- **Interfaces:** badges come only from `verification.status` and `verify.status`. Every unverified item shows the label "unverified · <reason>". Provenance popovers on part properties use `catalog/Provenance.tsx`.
- **Acceptance:** each farm node diagram fits A4 landscape with no label overlap and at least 7 pt text; ticks persist across reload; the BOM total equals the sum of its lines; e2e specs 41 and 42 are green (desktop plus 390 px).
- **Cut-first:** the `.zip` export.

## 11. M7: real-time (track D, 1 d)

- **Ownership:**
  - **A** `services/api/lab-hardware.ts` extension, or a new `services/api/pro-hardware.ts` (preferred, so the UNO path stays untouched). ESP32 detection by VID/PID (CP210x 10c4:ea60, CH340 1a86:7523, S3 native 303a:1001). Flash of an ops artifact by sha with esptool or arduino-cli. Serial uses the existing session pattern.
  - **B** `apps/desktop/consent.cjs`, extended with a token bound to port plus fileSha. The dialog shows the node, file, sha prefix and port. Plus `tests/desktop-consent.test.ts`.
  - **C** `services/api/pro-telemetry.ts`: a read-only MQTT subscription to `aiot/<projectId>/#` on the user's broker. The settings stay local. The new `mqtt` dependency goes through the integrator.
  - **D** `services/ops/pro-evidence.ts`. Rules:
    - flash ok with a sha that matches the revision gives `flash:<node>`;
    - a boot banner gives `power-up:<node>:boot`;
    - a reading in the catalog range gives `power-up:<node>:<part>`;
    - gateway telemetry gives `commission:<link>`.
    
    Anomaly detectors: stuck value, out of range, battery under the chemistry floor, link margin under D4, heartbeat missing for more than 3 intervals, boot loop. Plus `tests/pro-evidence.test.ts`.
- **Interfaces:** the client-tool protocol from M3 (`client_tool_request` and tool-results); `evidence_status`.
- **Acceptance:**
  - With a fake bridge in CI, flash without a token gives 403 `consent_required`, and a token for another sha is refused.
  - Evidence ticks are marked "auto · evidence" and a human can untick them.
  - Manual: one real ESP32 end to end (documented in `docs/lab-hardware.md` by the integrator).
- **Cut-first:** D10 calibration, and the anomaly detectors beyond the first three.

## 12. M8: Build Sheet, gate and rollout (track C, 1 d)

The old M7 ownership table (print route, workspace top bar and prompt, handoff to Lab, integrator routes `/pro`, `/pro/:id`, `/pro/print/:id` gated on grant `pro` or staff), with the honesty rules extended: "verified" appears only on gated items, and the title block shows the model plus `DESIGN · NOT BUILT` (or `FLASHED n/N` when evidence exists). The Build Sheet lists unverified items in a separate section. The integrator removes `/pro/dev`, writes the nginx SSE snippet in ADR 012 for the owner, and regenerates the mockups from the fixture (D1).

- **Acceptance:** a member with `pro` runs prompt → conversation → verified revision → print; a member without it sees "By invitation"; the print route gives the farm Build Sheet with no overflow; `npm run check`, the full e2e suite and the CI image smoke test are green; the user deploys.

## 13. CI and test speed (carried over from M0)

- `ci.yml` and `smoke-image.sh` exist but have not run on GitHub. The **M2.0/M2 integrator** pushes them and fixes only what fails.
- **e2e sharding** (the CI proposal: a 3-shard matrix, `retries: 1` and `workers: 2` in CI) is applied by the **M2.0/M2 integrator**, because `playwright.config.ts` is a shared file. Raise workers only after confirming the lab specs and `lab-access.ts` share no state.
- New Pro e2e specs use the numbers 40–49 and their own fixture project, so shards stay independent.

## 14. Founder questions (max 4)

1. **LoRa default and legal limits:** RFM95W or Ra-01H at 920–923 MHz with RA-02 as an error (D7). The 2018 Kominfo draft values would be *warnings* until the final regulation is confirmed. OK?
2. **Agentic budgets.** Proposed defaults:
   - per member per day: 10 turns and USD 3;
   - per turn: at most 40 tool calls, 15 min and USD 1.50;
   - global: USD 50 a month;
   - compiles: 60 per member per day.

   Is Opus 5.5 for staff only, or can members use it when admin selects it? Prices get pinned from the official page before members get access.
3. **Telemetry path for M7:** LAN only (the desktop app subscribes to the user's own broker, such as the gateway's Mosquitto), or a hosted iot.ai.id MQTT broker? The hosted option means a new service, auth and retention.
4. **Build Sheet scope:** EN only first, ID later? Is a browser "Save as PDF" print route enough? Are IDR ranges labelled "range, not a quote" enough without a supplier list?
