# ADR 004: Cloud coordinates, edge executes

Status: accepted; loopback V1 coordinator implemented (see the 6 October 2026 update); remote fleet operation remains future work.

## Context

The user supplied an additional architecture reference on 6 October 2026. This document captures its direction, not a capacity benchmark or evidence of deployed infrastructure. The current product runs on a user's laptop with a local API, SQLite, Arduino MCP, and an optional external agent provider. It has no distributed lab fleet or cloud job queue.

## Decision

Cloud coordinates. Edge executes. The physical world provides evidence.

Compile, flash, USB/serial capture and future instrument acquisition belong to the authorized local runtime. A future cloud service owns project metadata, contracts, job coordination, permission records and curated evidence references. Runtime tools and model providers remain replaceable behind explicit adapters; no new cloud compilation service is required for V1.

Raw serial, future camera recordings and instrument streams should be processed locally. Publish bounded summaries and deliberately selected artifacts rather than continuous streams by default. An evidence envelope must preserve contract/firmware/experiment identity, measurement source, timestamps, outcome, artifact hashes and parent-linked recovery. A summary never upgrades simulation or a manual report into physical proof.

Research or model-improvement reuse remains a separate, purpose-specific authorization flow. Cloud coordination does not imply permission to upload private local records. Minors and schools need an authenticated external authorization process before production participation; the current local declarations are operator attestations.

## Future implementation requirements

- Authenticate local runtimes and scope commands to an authorized project, device and operation. Cloud jobs must not grant arbitrary shell execution or silent flash permissions.
- Use explicit job leases, idempotency keys and device locking. Preserve failed attempts and interrupted executions; never automatically replay a flash after reconnect.
- Define offline behavior, queue backpressure, maximum artifact sizes, retention, withdrawal handling and upload consent before connecting a lab fleet.
- Keep model access replaceable and allow future user-funded inference without storing credentials in episodes. Current operational inference uses authenticated Codex with GPT-6.1 Sol low; general BYOK support is not implemented.
- Keep metadata, object artifacts, analytical storage and search independently scalable when measured demand justifies it. SQLite remains the current local store.

## Scope and evidence

V1 retains ESP32 and the BME280/SSD1306 golden recipe. Cameras, company PLCs, distributed SMK scheduling, national Arena operations, cloud authentication and remote execution are later work.

The reference's 1,000/100,000/1,000,000 user thresholds, 100 million experiments, VPS sufficiency and software-like gross margin are hypotheses, not capacity or financial guarantees. Sizing requires measured active concurrency, ingestion rate, artifact volume, retention, inference spend and runtime reliability. Registered-user count alone is insufficient.

This direction does not change the acceptance milestone: one real ESP32 build, deliberate physical failure, AI diagnosis, human repair and verified recovery. No attached board has yet supplied that proof.

## Update — 6 October 2026: loopback coordinator implemented

The direction above now has a working V1 loopback implementation. `services/coordinator` provides the self-hosted job queue: separated node and owner authorization scopes, leased jobs with renewal, idempotency keys, per-device locking and explicit resolution of uncertain jobs. `runtime/local-bridge/node-client.ts` is the outbound node: it syncs validated contract summaries (only after `IOT_SYNC_AUTHORIZED=true`), leases one job at a time and executes through the loopback API. `services/api/remote-jobs.ts` enforces the ~31 second approval window and never replays interrupted work. Physical jobs require a human approval in the workbench banner plus a locally trusted USB device matching the request. `services/coordinator/mcp.ts` exposes owner tools (list projects/jobs/evidence, enqueue job). `tests/coordinator.test.ts` covers queue scoping, idempotency, lease expiry, restart uncertainty and the fail-closed node configuration; the node client refuses plain HTTP to non-loopback coordinators.

With this update, the first two future requirements below — authenticated, scoped nodes and explicit leases/idempotency/device locking without automatic flash replay — are implemented for the loopback case. Offline backpressure, artifact size caps, retention policy, fleet-scale consent flows and any non-loopback deployment remain future work.
