# ADR 006: Wokwi CLI as the Layer-1 simulation backend

Status: adapter pipeline implemented; live golden recipe unsupported (BME280 is not an official supported chip and no tested custom chip is installed). implemented as a capability-gated `SimulationAdapter`. Live execution additionally requires the `wokwi-cli` binary, a valid `WOKWI_CLI_TOKEN`, and `arduino-cli` on the host — none of which are bundled or assumed present.

## Context

The product strategy positions Wokwi as a Layer-1 simulator inside our loop (challenge → JEV → student → simulation → physical arena), explicitly not as an embeddable product surface or a dependency we cannot replace. Wokwi's public open tooling is real: the CLI runs projects locally with scenarios, serial-log capture, timeouts and exit codes; automation scenarios support `set-control`, `wait-serial` and pin assertions; `diagram.json` describes wiring. There is no official generic white-label web embed API, and commercial usage is directed to paid plans — so integration happens at the CLI boundary only, behind our own adapter interface.

## Decision

`packages/simulator-client` now contains a real `WokwiCliAdapter` instead of a capability stub:

- The Hardware Contract generates the simulation project deterministically: `diagram.json` (board-esp32-devkit-c-v4 + wokwi-bme280 + wokwi-ssd1306 wired from contract pins, SDO grounded for address 0x76, display `i2cAddress` from the contract), `wokwi.toml` pointing at the compiled ELF, and an automation scenario that asserts the serial evidence protocol markers.
- The identity-bound firmware artifact (same source the engine hashed for the experiment) is compiled with `arduino-cli` and executed by `wokwi-cli`; the serial log is judged by the same rule as physical telemetry: only the newest identity-matched observed cycle counts, missing checks fail, and conflicting duplicates fail.
- Every emitted check carries `simulated: true` and `backend: 'wokwi-cli'`; the engine rejects backend impersonation, so Wokwi output can never masquerade as physical evidence or as the template model.
- Availability is fail-closed: missing token (expected `wok_` + 40 chars), missing binary (or `WOKWI_CLI_BIN` override) or missing toolchain each produce an explicit unavailable capability with reason; no fallback to model success. The golden recipe is refused in live execution; explicit injected test scenarios alone exercise this pipeline.
- BME280 automation controls are not documented for scenario `set-control`, so the scenario asserts protocol markers only; sensor values come from the simulator itself and are judged against the firmware's own validity rules.

Wokwi remains replaceable: the template model stays the default backend, and any future simulator (or Wokwi's experimental MCP surface) plugs into the same `SimulationAdapter` boundary. Wokwi CLI is proprietary, token-gated tooling invoked as an external process; Wokwi Elements (our board visuals) are MIT-licensed and unrelated to this execution path. Review Wokwi's licensing before depending on it in a commercial offering.

## Verification

`tests/simulator.test.ts` drives the full pipeline against a fake CLI: project generation (sketch, diagram pins from the contract, scenario), newest-complete-cycle judging, deliberate SDA-wire-omission failure, non-golden recipe refusal, and missing-token refusal. These are injected tests, not live execution proof. A token and binaries cannot establish BME280 support; `/api/status` reports this unsupported recipe explicitly.
