# IOT AI ID

An AI hardware workspace for learning, designing and testing real IoT builds. Describe what you want to make, inspect the generated wiring on a draggable canvas, revise the design through chat, and connect supported ESP32 hardware to compile, flash and collect evidence.

**Integrate first. Invent only what is missing.** The project combines existing hardware tools with its own Hardware Contract, deterministic validation, evidence verification and AI diagnosis loop. It is an early local prototype for embedded developers, makers and technical students.

## What this project does

- A React Flow workspace with component nodes, pin connections, wire inspection, pan/zoom and a minimap.
- AI-assisted planning and corrections through Jev and a frontier model; optional OpenViking knowledge retrieval.
- Structured contracts checked for supported pins, voltage, bus compatibility and conflicts before execution.
- Local Arduino MCP integration for board discovery, compile, upload and serial capture, with explicit USB authorization.
- Identity-bound evidence, deliberate failure, grounded diagnosis and recovery history. Simulation and physical verification remain distinct.
- A hardware reference catalog covering ESP32, Arduino, Raspberry Pi and common sensors. Catalog availability does not imply executable firmware support.
- A local macOS desktop shell and an optional coordinator for scoped jobs executed on user/lab machines.

## Prototype status

Two executable classic ESP32 recipes exist: **BME280 + SSD1306 room monitor** and **button + resistor-protected LED**. Other designs remain planning references until their firmware and verification recipes exist. The teaching simulator executes a deterministic model, not arbitrary firmware. Wokwi Elements provides visuals, not simulation.

The current macOS build is unsigned and intended for local testing. Real physical verification still requires a connected supported board, correct wiring, explicit authorization and fresh serial evidence. Passing software tests or compiling firmware is not proof that hardware works.

## macOS desktop

```bash
npm ci
npm run desktop:package
```

Open the generated app under `dist/desktop/`. The bundle includes Electron, Node and Arduino CLI; Jev/model access and Arduino board cores/libraries remain host requirements. Packaging currently pins Node 24.13.1 and Arduino CLI 1.5.1. See [desktop setup](docs/desktop.md) for requirements and data locations.

## Source and licensing

This public repository contains a clean source snapshot. Local databases, logs, credentials, generated builds and internal agent handoffs are excluded. Third-party integrations retain their own licenses; see [third-party notices](THIRD_PARTY_NOTICES.md). No project-wide license is granted by this repository at present.

## Run locally

Node 22.13+ (Node 24 tested), npm, Arduino CLI for physical work, and Python 3.10 for the separate OpenViking service.

```bash
npm ci
npm run dev
```

Open http://127.0.0.1:5173. API binds to 127.0.0.1:8787. Choose the room monitor example. A real Jev route and GPT-6.1 Sol low request produce the plan. The generated contract is validated before firmware exists. Use Simulator to test persistence and recovery without a board. No simulated experiment receives physical VERIFIED.

Jev must be installed at `~/.local/bin/jev-codex`. Default frontier access uses authenticated Codex CLI on this Mac, without exposing its credentials to the browser. Optional `OPENAI_API_KEY` uses OpenAI Responses instead. The model remains `gpt-6.1-sol` with low reasoning. Missing provider access is an explicit error, not a mock plan.

Setting `IOT_AGENT_PROVIDER=fixture` swaps in a deterministic `FixtureAgent` (no model calls) for automated verification and container runs; `/api/status` labels it honestly.

## Run with Docker

```bash
docker compose up -d          # API + coordinator, loopback-only ports
open http://127.0.0.1:8787    # built workspace served by the API container
docker compose exec api npm test   # full unit suite inside the container
```

The compose file ships insecure dev tokens and an empty node project scope — replace `IOT_COORDINATOR_NODES`/`IOT_COORDINATOR_OWNERS` for anything beyond a local demo. The API container defaults to `IOT_AGENT_PROVIDER=fixture`; The stock image has neither Jev nor authenticated Codex. Setting `IOT_AGENT_PROVIDER=jev` fails explicitly until a custom image supplies executable `JEV_CODEX_BIN` and either `CODEX_BIN` plus explicit authentication or explicitly supplied `OPENAI_API_KEY`. No host credential directories or secrets are mounted automatically. Compile/flash/serial stay on the host because boards are attached there: run `npm run node:connect` on this machine against the published coordinator (`IOT_COORDINATOR_URL=http://127.0.0.1:8790`), after the coordinator's node entry lists your project UUIDs. Ports are published to 127.0.0.1 only; the coordinator container binds its own bridge network. The optional OpenViking knowledge service runs with `docker compose --profile knowledge up`.

Verified against Docker 29 / Compose v5 on Apple Silicon: the full edge loop works end to end — node client on the host syncs a contract graph, an owner enqueues a simulate job, the node leases it, executes through the containerized API's remote-jobs approval, and a bounded `SIMULATED_VERIFIED` summary returns to the coordinator's evidence list.

### Knowledge service

OpenViking is a real separate HTTP service. This tested setup uses local CPU embeddings and vectors-only ingestion; contract/experiment/repair notes are uploaded, indexed and retrieved. No cloud embedding credential is required.

```bash
uv venv --python 3.10 .venv
uv pip install --python .venv/bin/python 'openviking[local-embed]==0.4.23'
.venv/bin/python -m openviking.server.bootstrap --config services/knowledge/ov.conf.example --host 127.0.0.1 --port 1933
```

The first launch downloads the local embedding model. Wait for `/health` to report healthy before starting the API, which seeds catalog context. Existing OpenViking may be used through `OPENVIKING_URL` and optional `OPENVIKING_API_KEY`. The example is loopback development mode; do not expose it publicly. Receipts record live retrieval, stored ingestion, or unavailable service honestly. OpenViking is AGPL-3.0; review its licensing before a combined distribution.

### Physical experiment

```bash
bash runtime/local-bridge/setup.sh
```

Setup pins Arduino ESP32 core 3.3.7 and five Adafruit libraries. Runtime experiments never auto-install cores. Firmware uses the Arduino framework; ESP-IDF is a future adapter.

1. Power off. Wire both modules to 3V3 and GND. Wire SDA to GPIO21 and SCL to GPIO22. Confirm labels and voltage suitability on the actual breakouts.
2. Connect classic ESP32 through USB. Select Local board and a detected USB candidate. Authorize that port for compile/flash.
3. Run compile, flash and verification. The MCP adapter captures tool responses, serial frames and binary hashes. USB metadata alone does not prove ESP32 execution.
4. Power off. Disconnect shared SDA. Reconnect power and run another physical experiment. Expect missing I2C devices and a failed verification.
5. Inspect diagnosis. Power off, restore SDA, reconnect power, confirm repair and re-test. Recovery creates a fresh nonce and preserves the failed experiment.

OLED initialization/ACK proves communication, not visible pixels. Record visible output as a human observation in the experiment notes outside the current automated checks. V1 has no camera, electrical probe or analog power measurement.

## Coordinator and local node (edge execution)

Cloud coordinates; edge executes. `services/coordinator` is a self-hosted job coordinator: it stores project contract summaries, a SQLite job queue with leases, idempotency keys and per-device locks, and never touches hardware itself. A local node connects outbound, syncs validated contract summaries, leases one job at a time and executes it through the loopback API. Non-loopback coordinators must use HTTPS.

```bash
# Terminal 1 — coordinator (loopback dev example)
IOT_COORDINATOR_NODES='[{"id":"node-a","owner":"daniel","token":"<node token, 32+ chars>","projects":["<project uuid>"]}]' \
IOT_COORDINATOR_OWNERS='[{"owner":"daniel","token":"<owner token, 32+ chars>"}]' \
npm run coordinator

# Terminal 2 — local node on the API machine
IOT_NODE_ID=node-a IOT_NODE_TOKEN='<node token>' \
IOT_NODE_PROJECTS='["<project uuid>"]' IOT_SYNC_AUTHORIZED=true \
npm run node:connect

# Terminal 3 — owner MCP tools (list projects/jobs/evidence, enqueue jobs)
IOT_OWNER_TOKEN='<owner token>' npm run coordinator:mcp
```

Coordinator environment: `IOT_COORDINATOR_NODES` and `IOT_COORDINATOR_OWNERS` (JSON; all tokens unique, 32+ chars), `IOT_COORDINATOR_DB` (default `.data/coordinator.sqlite`), `IOT_COORDINATOR_HOST`/`IOT_COORDINATOR_PORT` (default `127.0.0.1:8790`). Node environment: `IOT_COORDINATOR_URL`, `IOT_NODE_ID`, `IOT_NODE_TOKEN`, `IOT_NODE_PROJECTS`, `IOT_LOCAL_API_URL`, and `IOT_SYNC_AUTHORIZED=true` — an explicit opt-in before any contract summary leaves the machine.

Job flow: the node leases a `detect`, `simulate` or `physical` job and posts it to the local API `/api/remote-jobs` with a ~31 second approval window. Simulate jobs are approved locally without hardware. Physical jobs wait for a human: the workbench shows a remote-approval banner, and approval additionally requires the requested USB device to be selected and locally trusted. Leases renew every 5 seconds. Interrupted or crashed jobs are marked failed/uncertain and never replayed automatically; the owner resolves them explicitly. Only bounded evidence summaries (checks, artifact hashes, verification status) return to the coordinator; raw serial, tool logs and private conversations stay local.

## Architecture

- `apps/web`: React/Vite product workspace, Wokwi reference visuals, hardware catalog, bench/arena methodology, docs.
- `packages/hardware-contract`: canonical Contract schema and deterministic golden firmware generator.
- `packages/component-catalog`: classic ESP32 execution manifests and common peripheral specifications. Supported execution is controlled by the recipe registry; other entries are planning references.
- `packages/validator`: deterministic capability, voltage, connection, bus/address, power and compatibility gates.
- `packages/agent-tools`: Zod input schemas for chat revisions, debug complaints and catalog edits.
- `packages/job-protocol`: shared wire protocol for coordinator jobs, node configuration, leases and bounded evidence summaries.
- `packages/ui-hardware`: shared Wokwi Elements board drawing used by the workspace.
- `packages/evidence`: canonical hashes and recipe-specific required named checks.
- `services/api`: loopback API, SQLite immutable artifacts and replay events, orchestration, local remote-job approval.
- `services/orchestrator`: AgentProvider/JevProvider, frontier requests, real OpenViking retrieval/ingestion through `services/knowledge`.
- `services/coordinator`: self-hosted job queue with separated node/owner auth scopes, leases, idempotency and device locks, plus an owner MCP surface.
- `packages/runtime-client` and `runtime/local-bridge/mcp-executor.ts`: isolated adapter to pinned MIT Arduino MCP server. Upstream owns board discovery, CLI wrapping, upload, safety preflight and serial capture.
- `runtime/local-bridge/node-client.ts`: outbound node that syncs contract summaries, leases coordinator jobs and drives the local API within explicit project scope.
- `docs/adr/002-integrate-first.md`: integration decisions and license boundaries.

SQLite lives under `.data`; build artifacts under `.runtime`. Contracts, agent runs, firmware, observations, failures, repairs and verifications are append-only. Project and experiment status can change. Startup terminates orphan planning/running state without automatically flashing. A project lock and a port lock prevent overlapping operations.

The API checks loopback Host/Origin and requires `X-IOT-Session`; obtain it through `GET /api/session`. `GET /api` returns a self-describing endpoint directory. Physical authorization expires after 20 minutes and is scoped to a detected port. Prompts cannot select executable names, shell commands or filesystem paths.

## Agent access: MCP over the local API

Agents connect without touching HTTP details: `npm run api:mcp` starts a local MCP stdio server (`iot-ai-local-api`) exposing the challenge catalog, project creation/status, design/debug chat, and simulation runs against the same evidence-bound API as the web workbench. Physical runs are deliberately absent from MCP — they still require the human USB trust and approval flow. Owner-side coordination (synced projects, job queue, evidence) is served by `npm run coordinator:mcp`.

## Challenge catalog

Challenges are deterministic manifests (`packages/challenge-catalog`), not invented database rows: `GET /api/challenges` returns each challenge with its scenarios, verification checks and honest support level — `golden` (room-monitor v1: executable recipe) or `draft` (threshold-alert, presence-button: no executable recipe yet, creation falls into clarification instead of pretending). Attempts live in the projects/experiments tables via `challengeId`/`challengeVersion` on project creation.

Golden scenarios carry declarative judge rules: `GET /api/projects/:id/challenge` grades every scenario pass/fail/pending purely from stored evidence (newest-cycle checks, observed deliberate failure, recovery after failure). The workbench Test tab shows the same verdicts; nobody can claim "done" without evidence. `npm run agent:run` makes one bounded autonomous attempt at a challenge through the public API — healthy run, deliberate failure, grounded diagnosis, recovery — recording an agent-side trajectory (`actor: "agent"`) in the same episode structure as human runs, ready for agent-vs-human comparison.

## Verification

```bash
npm run check     # typecheck, lint, unit tests, production build
npm run test:e2e  # Playwright browser suite against the built app
```

The e2e suite boots the API with `IOT_AGENT_PROVIDER=fixture`, a fresh temp database, and `OPENVIKING_URL=http://127.0.0.1:1` to exercise honest unavailable knowledge without depending on live indexing, then drives the real UI: golden path (prompt, simulated verification, deliberate SDA failure, repair, retry), chat pin revision, catalog planning-only gating, backoffice counts, and the remote-job approval banner for both simulate and physical jobs. It needs `npx playwright install chromium` once. Adapter tests use explicit MCP test doubles. Live knowledge retrieval is verified separately with an actual catalog-scoped OpenViking query and returned hits; fixture browser tests do not establish live knowledge availability. Real MCP discovery can be checked without touching a board:

```bash
printf '%s' '{"action":"detect"}' | node --import tsx runtime/local-bridge/mcp-executor.ts
```

The product distinguishes specifications, deterministic validation, simulation and physical evidence. Community profiles, leaderboards and lab operations remain honest proposed/draft surfaces. No invented active users, scores, labs or partnerships.

## Current limits

Only the room monitor and button/LED recipes generate executable firmware. Unsupported prompts require clarification. Wokwi Elements is visualization, not execution; its OLED depicts a different reference breakout, so actual pin labels win.

Two simulation backends exist. The default `template-model` is a deterministic teaching model that executes no firmware. `wokwi-cli` is a real Layer-1 simulator: it compiles the identity-bound firmware with `arduino-cli`, generates `diagram.json` and an automation scenario from the contract, runs Wokwi, and judges the serial evidence cycle like physical telemetry (simulated: true, never physical proof). The golden recipe is unsupported: BME280 is absent from the official supported chips list and no tested custom chip exists. Tooling availability alone never enables it. Tooling detection requires `wokwi-cli` (or `WOKWI_CLI_BIN`), a valid `WOKWI_CLI_TOKEN` (`wok_` + 40 chars from the Wokwi CI dashboard) and `arduino-cli` exist on the host. Select it with `backend: "wokwi-cli"` on a run request. Wokwi CLI is proprietary, token-gated tooling; review its licensing for commercial use. See `docs/adr/006-wokwi-cli-simulation-layer.md`.

Physical completion requires an attached ESP32, compatible BME280/OLED, installed toolchain, and user-performed wiring/failure/repair. See `docs/physical-demo.md` for reproducible evidence criteria.

### Apple Silicon ctags compatibility

Some Arduino builtin releases ship an Intel-only ctags helper. Setup builds the same official Arduino `5.8-arduino11` source tag (`abc8fca7499f44c725122881cd380a88c37abe0e`) for ARM64 when that helper cannot execute. This needs Xcode Command Line Tools. It preserves the original binary under `.runtime/toolchain-backups`, records hashes, and replaces only the installed helper. A modern macOS SDK needs the `-include dirent.h` build flag to avoid the old helper's `__unused__` macro collision. The parser source remains unchanged. Reinstalling Arduino builtin tools can overwrite this local compatibility fix; rerun setup if necessary. No Rosetta installation is required. Arduino ctags is GPL-licensed tooling, separate from the product core.

Physical telemetry carries a monotonically increasing `cycle` number. Verification uses only the newest observed valid cycle. Missing checks in that cycle fail; earlier samples cannot fill gaps. Conflicting duplicates fail the check. Capture ending mid-cycle may need a fresh re-test, never a fallback to older successful evidence.

## Physical experience episodes

The homepage has two entrances: Build with AI and Learn & Verify. `/learn` starts a real project using the existing golden challenge, with its entry point and challenge revision stored. `/project/:id/episode` shows an ordered trajectory, AI plans/diagnoses, manual actions, conditions, identities and parent-linked retests. The lesson is a local pilot, not school enrollment or an active nationwide Academy.

Actions, conditions and permission declarations are append-only. Manual reports never satisfy physical runtime checks. They stay local and are not added to OpenViking or frontier requests. Build goals and machine observations continue to be processed for operational AI assistance, disclosed at both entry points. Do not include personal data in prompts.

Local episode JSON is available independently of research permission. Research and model-improvement exports require purpose-specific permission and content-review attestations; unknown age or incomplete minor school/guardian attestations exclude reuse. Content review binds to a server-computed episode hash; new plans, runs, actions or measurements require fresh review. Withdrawal excludes subsequent exports but cannot recall previously downloaded copies. The local prototype records operator attestations, not authenticated legal authority or independent consent verification. Production school participation needs that external process.

Portable exports omit raw serial, USB paths, tool logs, knowledge context and plaintext authorization references. Pseudonymization and common text filtering are not certified anonymity. Original artifact hashes and redacted export hashes have separate scopes; the omitted artifact bodies cannot be independently recomputed from the portable export alone. Test-fixture records exclude an episode from research/model reuse.

The template model uses an injectable SimulationAdapter and explicitly executes no firmware. The Wokwi CLI adapter is implemented behind the same boundary but refuses the golden recipe until a tested BME280 implementation exists; no unavailable backend falls back to model success. See `docs/adr/003-physical-experience-episodes.md` and `docs/adr/006-wokwi-cli-simulation-layer.md`.

```text
POST /api/projects {goal, entryPoint, challengeId?, challengeVersion?}
POST /api/projects/:id/chat {message, purpose: design|debug, expectedContractId, expectedDraftId}
POST /api/projects/:id/components {componentId, operation: add|remove, expectedContractId, expectedDraftId}
POST /api/projects/:id/actions
POST /api/projects/:id/environment
POST /api/projects/:id/rights
GET  /api/projects/:id/episode?purpose=local|research|model_improvement
GET  /api/remote-jobs
GET  /api/backoffice
POST /api/remote-jobs/:id/approve {authorize: true, port?}
POST /api/remote-jobs/:id/renew {leaseId, expiresAt}
POST /api/runtime/trust {port, authorize: true}
```

## School visual workbench

Project routes open an Indonesian learning workspace with a component shelf, a dotted circuit canvas and step-by-step guidance. Select a component by keyboard or on the canvas to inspect contract-derived pins. Design, Code and Test views preserve real firmware and experiment history. The companion uses project status; actual AI plans and diagnoses are inspectable separately.

Chat revisions and catalog edits create new immutable design drafts: an executable draft binds a fresh validated contract version, while a planning-only draft blocks execution until a supported recipe exists. Debug complaints are grounded in the current experiment's evidence; stale experiments are rejected before knowledge retrieval. Design/debug chat queries OpenViking within the curated `hardware-catalog` resource using only allowlisted board/component IDs and named failed checks, records local live/unavailable retrieval receipts, and passes that explicit knowledge context to the operational provider. Chat never uploads goals, complaints, conversation, requested dimensions, or intent to shared knowledge and never calls knowledge ingestion. Initial planning and experiment ingestion remain separate existing flows. Requested behavior and dimensions remain local draft intent, displayed separately from wiring/code validation and physical proof; unresolved requirements keep the draft planning-only. When the coordinator enqueues a physical job on this node, the workspace shows a remote-approval banner with the requested USB device and an expiry countdown; approval requires that device to be locally trusted.

## Operator backoffice

`/backoffice` is the local operator dashboard: real counts only (projects, experiments, physical vs simulated verification, active remote jobs), an experiments-per-period bar chart, a recent-experiments table, the project table with status pills, and a runtime health panel (toolchain, USB candidates, simulators, OpenViking, coordinator). The coordinator panel proxies the owner API server-side: set `IOT_COORDINATOR_URL` and `IOT_COORDINATOR_OWNER_TOKEN` on the API process; without them it honestly reports "belum dikonfigurasi". No metric is invented; every number comes from the same SQLite artifacts the workspace reads.

Quick observations save locally into the immutable episode with explicit human/test provenance. Learning checklists never verify hardware or authorize training reuse. Physical runs retain USB authorization, validation and repair confirmation gates. Results always belong to the latest experiment; asynchronous runtime errors are visible. See `docs/adr/005-school-visual-workbench.md` for scope and verification.
