# ADR 011: Lab AI builder (prompt to circuit, assembly animation, real run)

Status: accepted; ops and api sides implemented (`services/ops/lab-ai.ts`, `lab-compile.ts`, `services/api/lab-spec.ts`). Contract: `apps/web/src/lab/circuit-spec.ts`, `packages/ops-contract/index.ts` (section "Lab AI builder"). Builds on ADR 009 (ops service, members) and the `/lab` simulator (avr8js running real firmware).

## Context

A visitor types "I want an Arduino that beeps and lights red when something is closer than 20 cm". The lab must design the circuit and the code, play a step-by-step 3D assembly with a caption per step, then run the sketch for real in the simulator. Three constraints shape the design:

1. `iot.ai.id` keeps `/api` closed (nginx returns 403). Provider keys live only in the `api` container (`services/api/credentials.ts`, `engine.ts`).
2. The simulator needs compiled firmware plus a line map. Lessons ship precompiled hex (`firmware/generated.ts`, built with `aiot-avr:1.8.8`). User sketches must be compiled on the server.
3. LLM output is untrusted. It must never reach the scene or the compiler without validation.

## Decision

### Format: CircuitSpec
One zod schema, `CircuitSpecSchema`: `{board:'uno', parts:[{id,kind,props,place}], wires:[{id?,from,to,color}], sketch:{source,params?}, steps:[{caption:{en,id},add:{parts?,wires?}}], goal?}`. Lessons, the AI builder and the future canvas all use it. `validateCircuitSpec` checks kinds, pins, shared holes, series resistor on every LED, 5V/GND shorts, output pins tied to a rail, and that pins used in the sketch (regex over `pinMode/digitalWrite/analogRead/tone/pulseIn/.attach` and `#define`/`const int` constants) match the wiring. Every issue is `{code,severity,en,id,ref}` so the same text can be shown to the user and fed back to the model.

### Route (public host): `/ops/v1/lab/`
Served by `services/ops`, proxied by nginx like the other `/ops/v1/*` routes. `/api` stays 403.

| Route | Access | Purpose |
|---|---|---|
| `GET /ops/v1/lab/examples` | anonymous | 3 curated examples (`close-alarm`, `night-light`, `servo-gate`): committed CircuitSpec + committed hex. No LLM, no compile. |
| `POST /ops/v1/lab/build` | `{exampleId}` anonymous; `{prompt}` member with grant `lab-ai`, or staff | Build from a prompt. |
| `POST /ops/v1/lab/compile` | same as prompt build | Recompile an edited sketch. |
| `GET /ops/v1/lab/history` | member / staff | Own past builds and today's quota. |

Access default: a new member grant `lab-ai` (added to `MEMBER_GRANTS`; owner and sales assign it in the backoffice) plus any signed-in staff. Anonymous visitors only get the examples, which are served from files, so a bot cannot cause spend. Quotas: 20 builds per member per UTC+7 day, 500 builds per day globally (both configurable by `OPS_LAB_AI_MEMBER_QUOTA`, `OPS_LAB_AI_GLOBAL_CAP`). Staff are exempt from the member quota but count in the global cap. Cache hits (same normalised prompt and lang) do not consume quota. Responses carry `quota`. nginx adds a per-IP `limit_req` on the route like the inquiry form.

### LLM path: keys never leave `api`
`ops` does not hold provider keys. It calls the api container over the existing internal docker network `ops` (`OPS_URL` already points the other way; add `IOT_API_INTERNAL_URL=http://iot-ai-api:8787` in `ops.env`) at one narrow endpoint, `POST /internal/lab/spec`, with header `x-aiot-internal: <OPS_API_INTERNAL_TOKEN>`. The token is a 32-byte random secret present in both `ops.env` and the api env. The endpoint:
- is not routed by nginx (the public vhost keeps `/api` at 403, and `/internal` is not proxied at all) and also refuses requests that carry `x-forwarded-for` or arrive from outside the `ops` network;
- compares the token in constant time, accepts only `InternalSpecRequestSchema` (prompt up to 600 characters, lang, optional repair block), and returns only `InternalSpecResponseSchema` (`spec`, provider, model). It has no tools, no history, no other capability;
- calls the owner's configured provider through the existing credentials layer in structured-output mode with `CircuitSpecSchema` as the JSON schema, a fixed system prompt (part catalogue from the registry, UNO R3 pin facts, rules the validator enforces, "reply with JSON only"), low temperature, and a max-token cap.

Alternative rejected: giving `ops` its own provider key. It spreads the secret to a second container and duplicates the credentials and rotation logic. Alternative rejected: exposing `/api` publicly with auth. It breaks the invariant.

### Validate, repair once, then compile
1. `ops` receives the model JSON, runs `parseCircuitSpec` (schema then validator, using the shared module).
2. On errors it makes exactly one repair call (`repair:{previous,issues}`) and validates again. Still invalid: respond `422 {kind:'validation', issues}`; that failed attempt still counts toward quota.
3. On success it compiles `spec.sketch.source` (size cap 20 KB) and returns `{spec, build, issues(warnings), repaired, quota, buildId, source}`.
4. The prompt, the final spec (or the issues), the sha256 of the sketch and timings are appended to the member's history in ops (same `history` pattern as members), and to the global audit log. Prompts are user content: shown only to that member and to owner/sales.

### Compile sandbox
`arduino-cli` runs in a dedicated one-shot container (`aiot-avr` image family, pinned toolchain; same version string as `firmware/generated.ts`), started by ops through a tiny compile worker, never inside `ops` or `api`:
- compile only, never execute; no network (`--network none`), read-only root filesystem, a tmpfs work dir, user `nobody`, no capabilities, `--pids-limit`, `--memory 512m`, `--cpus 1`, wall-clock timeout 20 s then kill, output size cap, 32 KB flash limit enforced;
- source size cap 20 KB and a rejection list for `#include` of anything outside the AVR core and the allow-listed libraries (Servo, Wire not needed), so no `#include "/etc/..."` reads;
- result: Intel hex converted to base64 flash image, plus a DWARF line map `[firstWord,lastWord,inoLine]` produced the same way as `scripts/build-lab-firmware.ts`, so the browser feeds it to the existing runner unchanged (`LabBuildArtifactSchema` mirrors `FirmwareVariant`);
- cache: by `sha256(source + toolchain)`, in the ops sqlite (value: artifact JSON) with a 30 day TTL; concurrent identical compiles are coalesced; at most 2 compiles run at once, extra requests queue up to 5 s then get `503`.

### Browser flow
`build` response -> `loadCircuit(spec)` -> `playAssembly(spec,{onStep})` showing each caption -> `runner.load(artifact,...)` -> the circuit runs for real. The HUD never trusts the server beyond schema: the client re-runs `parseCircuitSpec` before touching the scene.

### Tests and e2e
`IOT_AGENT_PROVIDER=fixture` makes the api internal endpoint return a canned CircuitSpec (`EXAMPLE_CLOSE_ALARM` from `apps/web/src/lab/circuit-examples.ts`, plus a deliberately invalid one when the prompt contains `[invalid]`, to exercise the repair path). Compilation in tests uses a stub compiler that returns a committed hex for the example's sketch hash. No test calls a real provider or Docker.

## Consequences

- Owner effort: add the `lab-ai` grant to members who should use it; set `OPS_API_INTERNAL_TOKEN` in both env files; add `ops` to the api's networks (already there); add an nginx location for `/ops/v1/lab/` with a rate limit. No change to `deploy/*.sh`.
- The compile worker is the one new moving part and the main security surface; its isolation settings above are mandatory, not tuning.
- The CircuitSpec validator is the single quality gate; any new part kind must be added to the registry and the validator catalogue (a unit test keeps `PART_PINS`, `PIN_COLS` and the registry equal).
- LLM latency (5 to 20 s) is covered by a build-progress UI state; the assembly animation only starts after validation and compile succeed.

## Implementation notes (ops and api)

- **Paths.** The router answers `/ops/v1/lab/*` and the alias `/ops/v1/member/lab/*`. The member cookie is `Path=/ops/v1/member`, so a browser sends it only to the alias; the browser client must call `/ops/v1/member/lab/` for member sessions (staff cookies have `Path=/` and work on either). Anonymous examples work on both. Cookie-authenticated calls carry `x-aiot-member: 1` (or `x-aiot-staff: 1`) like the other member and staff routes.
- **Examples.** `servo-gate` replaced `knob-dimmer` as the third curated example. The JSON files in `apps/web/src/lab/ai/examples/` are produced by `npx tsx scripts/build-lab-examples.ts`, which compiles through the same sandbox as the server. Button wiring follows the simulator model (pin 1 to 5V, pin 2 to the digital pin, 10k pull-down, plain `INPUT`); `INPUT_PULLUP` buttons do not work in the simulator and the model prompt says so.
- **Storage.** Tables in the ops sqlite: `lab_usage` (per UTC+7 day and subject, plus `global`), `lab_history` (prompt, outcome, timings; shown only to that member), `lab_prompt_cache` (normalised prompt + lang, 30 days) and `lab_compile` (sha256 of source + toolchain, 30 days). Staff report `limit: 0` (no personal limit). `POST compile` counts only toward the global cap, is limited to 6 uncached recompiles per person per 10 minutes (429 `quota`), and a build slot is refunded when the provider itself fails (a design that fails validation still counts); and a cached artifact is free.
- **Order of checks for a prompt build.** access, prompt cache hit (free), model configured, compiler available, then quota is spent, then the model runs. A missing compiler or model never costs quota.
- **Error bodies** follow `LabBuildErrorSchema`: 401 and 403 `forbidden`, 400 `bad-request`, 422 `validation` or `compile`, 429 `quota`, 503 `unavailable` (including `compiler not configured`).
- **Local and e2e.** In the desktop/dev API (`localOps`) the model call is in-process (`IOT_AGENT_PROVIDER=fixture` returns the canned example) and the compiler is the Docker image when present, else 503 `compiler not configured`. The cloud ops service calls the api container over HTTP.

### Owner checklist (`deploy/*.sh` is untouched)

1. Build the images on the host that runs the compiler: `docker build -t aiot-avr:1.8.8 scripts/lab-firmware`, then `docker build -f scripts/lab-firmware/Dockerfile.sandbox -t aiot-avr-sandbox:1.8.8 scripts/lab-firmware`. The second image only moves the SDK out of `/root` and points arduino-cli's writable paths at the run-time tmpfs.
2. `ops.env`: `IOT_API_INTERNAL_URL=http://iot-ai-api:8787`, the shared internal secret `OPS_API_INTERNAL_TOKEN` (32+ random bytes), optional `OPS_LAB_AI_MEMBER_QUOTA`, `OPS_LAB_AI_GLOBAL_CAP`, `OPS_LAB_IMAGE`. The api container already reads `ops.env`, so it sees the same secret.
3. **Intended design: a dedicated compile sidecar** (small container or host running only the sandbox wrapper, reachable from ops on the internal network, no docker.sock in ops); the socket proxy below is the fallback. The ops container needs the Docker CLI and a way to start the sandbox. Do not mount the host docker socket into ops directly (that is root on the host). Use a socket proxy that only allows container create, start, wait, kill and delete plus image inspect, and point `DOCKER_HOST` (or `OPS_LAB_DOCKER`, a wrapper binary) at it; or run the compiler on a separate small host behind that wrapper. Until then `POST build` and `POST compile` answer 503 `compiler not configured` and only the examples work.
4. `deploy/Dockerfile` copies the pure `apps/web/src/lab` modules and the examples into the runtime image (ops imports `circuit-spec.ts` through `packages/ops-contract`, api imports `circuit-examples.ts` for the fixture and the prompt example). Add the Docker CLI binary to that image for step 3.
5. nginx (`deploy/nginx.conf` now has the `iot_lab` zone and `^~ /ops/v1/member/lab/` with a 64k body; anonymous example builds use that member alias because `/ops/v1/` is GET-only). Original notes: `/ops/v1/` denies POST (`limit_except GET`) and `/ops/v1/member/` has its own block, so add before them a zone `limit_req_zone $http_cf_connecting_ip zone=iot_lab:1m rate=10r/m;`, locations `= /ops/v1/lab/build` and `= /ops/v1/member/lab/build` with `limit_req zone=iot_lab burst=3 nodelay;`, and `^~ /ops/v1/lab/` and `^~ /ops/v1/member/lab/` (GET and POST, `client_max_body_size 64k`), all proxied to `http://iot-ai-ops:8791` with `X-Real-IP $http_cf_connecting_ip` like the member block. `/internal` must not be proxied anywhere, and `/api/` keeps its 403.

## Implementation notes (web, integration)

- The HUD mounts `AiBuilder` in the side column and "+ Build with AI" in the lesson strip. A build replaces the open lesson on the stage (its circuit from `specToCircuit`, its firmware from the build artifact) until the panel is closed, which restores the lesson. Lesson callouts, goals and the inspector are off while a build is on stage. The generated sketch is shown read-only with a "Generated by AI" chip.
- The browser client calls `/ops/v1/member/lab/*` with `x-aiot-member: 1`, because that is the only path where the member cookie is sent.
- The scene is interactive for every lesson (`setInteractive`): clicking a part with controls opens the popover instead of the inspector. The popover's `sweep` is run by the page loop (obstacle oscillates 10 to 122 cm while running); `load` is a visual effect on the servo horn and motor shaft, not a simulated physical load.
- Lessons still use the existing `CIRCUITS` for their layout; moving them onto `loadCircuit(CircuitSpec)` was not done (it needs spec.place layout support to avoid visual regressions).
- Dev hook: `?e2e=1` exposes `window.__labScene` (used by tests/e2e/21-lab-v3.spec.ts to find part positions).
