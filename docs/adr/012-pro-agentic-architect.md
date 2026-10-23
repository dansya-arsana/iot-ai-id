# ADR 012: Pro agentic architect (the model thinks, we provide verified hands)

Status: proposed, 2026-10-23. Builds on ADR 011 (internal token, api holds keys), ADR 010 (Lab Mitra tasks), ADR 002/007 (MCP, local bridge) and ADR 008. Inputs: `docs/research/pro-arch-draft.md` and `docs/research/systemspec.draft.ts`.

## Context

Pro use cases vary without limit, and the 4-field farm is only a sample. A fixed pipeline would cap what the model can do. What we can make correct is the data and the tools. API keys must never leave the api, and physical actions need a human.

## Decision

### 1. Agentic loop

- ops runs the loop. Each model call goes to the api `POST /internal/pro/messages` (ADR 011 token guard, at most 2 MB, model in the allowlist, max_tokens and thinking caps), which streams Anthropic SSE back.
- The loop runs until `end_turn` or a limit (40 tool calls, 15 min or the USD cap).
- Parallel tool_use blocks run concurrently (at most 4 server tools at a time).
- Extended interleaved thinking is on. Thinking blocks are persisted unmodified, as the API requires while tool use continues; the UI collapses them.
- Browser: `POST /ops/v1/member/pro/projects/:id/turns` returns 202 `{turnId}`; then `GET .../turns/:turnId/events` (SSE) and `POST .../turns/:turnId/tool-results`.
- nginx owner step: `proxy_buffering off` on that SSE location.
- Fixture mode replays `fixtures/agent/*.jsonl`.

### 2. Tools and MCP

The 20-tool table (same as plan §3):

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

- The `defineTool` flags: deterministic, effect none/compute/write/ui/physical, consent none/port-trust/native, runsAt server/client, access, mcp.
- Pure tools live in `packages/pro-tools/impl`, and ops and MCP import them alike. Service tools live in ops.
- MCP stays stdio and loopback-only and excludes `device_flash`. Remote MCP over HTTP with OAuth is backlog.

### 3. SystemSpec as a revision artifact and the verification gate

- `save_revision` applies SpecPatch to the head under `baseRevision`, re-runs the verifiers (netlist, compile cache, power, link, BOM, checks) and stamps `ItemVerification` on each item.
- The Build Sheet shows "verified" only for stamped items. Others are labelled with their reason.
- Data with low catalog confidence gives "verified against low-confidence data".
- The model writes the design content; the server derives ids, W-numbers, totals and stamps.

### 4. Catalog with provenance

- PartRecord with `F<T>` provenance on every leaf.
- The base is committed in `packages/catalog/data` (reviewable, `CATALOG_VERSION` = data sha), with an ops overlay for staff-verified changes and proposals, and an export script back to git.
- Confidence maps to the D5 grades (A/B high, C/D medium, E and below low).
- "Tested in AIoT lab" requires a verified Lab Mitra task id.
- Datasheets are never downloaded into the repo. Staff enter values with a source URL.

### 5. Skills and history

- Skills are `packages/pro-skills/*.md`, staff-authored and versioned by sha256. The system prompt lists only names and one-line summaries, and `load_skill` loads a body on demand.
- History lives in `pro_messages` per project. Assembly drops old tool_result bodies first, never the user's messages.
- The system prompt, tools and catalog digest are prompt-cached.
- None of this limits the model's choices.

### 6. Keys

- Admin sets the key in AI settings. It is write-only and stored in the vault (AES-256-GCM, master key outside the repo).
- The `ANTHROPIC_API_KEY` env fallback lives only in the api's provider.env, never in ops.env. The vault wins.
- `envFallback` is reported as a boolean only.
- No key reaches ops, the browser, logs or MCP. The audit log records fingerprints only.

### 7. Budgets and quotas

- USD is reserved before each model call (input estimate plus max_tokens at the pinned price) and settled to actual usage.
- Per-turn, per-member-day and global-month caps (the defaults are founder Q2), plus compile quotas and concurrency (1 ESP32 compile, 2 Python; 1 turn per subject, 2 globally).
- A model with no pinned price gives members 503.
- Hitting a cap ends the turn with `stopReason:'budget'` and keeps the saved revisions.

### 8. Security model

- **(a) Prompt injection.** It can arrive through user text, catalog free text, datasheet excerpts, serial and telemetry. Mitigations:
  - untrusted text is returned in `untrusted` fields, and the system rule treats it as data;
  - verifiers use only structured fields;
  - staff review flags instruction-like text in proposals;
  - there is no URL-fetch tool and no SSRF;
  - every tool input and output is zod-validated.
- **(b) Tool authorization.**
  - ops injects the subject, never the model;
  - the project owner is checked on every projectId, and a write must target the turn's own project;
  - client tools run only when the turn declared them and the browser is the desktop local host;
  - each tool has its own rate limit.
- **(c) Physical-action consent.**
  - Every flash needs a native dialog. It mints a one-time HMAC token bound to port plus fileSha with a 60 s TTL, consumed once.
  - Only `compiled` files of a saved revision can be flashed.
  - Neither the model nor the browser can mint a token, and MCP cannot flash.
  - Opening a serial port needs port trust.
  - There are no actuator commands.
- **(d) Code handling.** Generated code is never executed on the server. The sandbox runs with `--network none`, read-only, cap-drop ALL. Lint enforces the include and import allowlists, no literal hosts and placeholder secrets.
- **(e) Rendering.** Output renders as React text only, with the filename regex and no control characters.

### 9. Real-time

- The desktop bridge supports ESP32 detection, flashing and serial; telemetry is a read-only MQTT subscription. The CONFIG block carries a boot banner.
- `pro_evidence` rows feed deterministic tick rules and anomaly detectors.
- The model reads them through `evidence_status` and explains them. Any fix goes through `save_revision`, and the human can always untick.

## Rejected alternatives

- The fixed two-stage pipeline with forced tool_choice: it caps reasoning and cannot cover unbounded use cases.
- Running the loop in the api: the api would need the ops DB.
- Browser-direct model calls: the key would be exposed.
- One forced SystemSpec JSON blob: large, cannot be verified piecewise, overwrites.
- The model setting verification flags.
- A DB-only catalog (no review) or a git-only catalog (staff cannot verify without a deploy).
- Flashing from MCP.
- A web-fetch tool.
- The Anthropic SDK: a new dependency, and the fetch pattern already exists.

## Consequences

- Cost is higher and more variable, hence the budgets.
- Testing relies on fixture transcripts.
- The old packages stay until migrated (the no-drift test guards them).
- The nginx SSE setting and the MQTT dependency are owner and integrator steps.

## Open items

- Founder questions: see plan §14, Q1–Q4.
- Record the measured image sizes, compile times and live-smoke USD here in M3.
