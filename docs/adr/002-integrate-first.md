# ADR 002: Integrate existing hardware plumbing

Status: accepted, 2026-10-05.

IOT AI ID is a product and orchestration layer. The project owns its canonical Hardware Contract, deterministic product gates, evidence protocol, immutable experiment history, verification engine, and diagnosis/recovery experience. Device plumbing belongs to existing tools.

## Selected integrations

- `arduino-mcp-server@0.2.8` from HardwareMCP, MIT, through an isolated MCP stdio client. Detection, compile, upload, electrical preflight, and serial capture use its tools. Upstream main advertises 0.2.9; npm currently publishes 0.2.8. Runtime pins the published release and disables automatic core installation during experiments.
- `@wokwi/elements@1.9.2`, MIT, renders ESP32 DevKit and SSD1306 web components. Wires use component pin coordinates. This is a reference visualization, not a circuit simulator. The OLED reference depicts an eight-pin breakout; users must inspect their actual four-pin I2C module. BME280 has no element in this package and remains an explicit manifest block.
- Jev remains the typed routing layer. GPT-6.1 Sol with low reasoning generates proposals and diagnoses. Deterministic validation and evidence decide success.
- OpenViking 0.4.23 is a separate local knowledge service accessed through its HTTP API. Real upload, indexing, search and content retrieval are required; outages are persisted as unavailable, never invented context. OpenViking is AGPL-3.0, not MIT. This ADR records separate-service use, not a conclusion about proprietary distribution obligations. Review its license before publishing a combined distribution.

## KiCadAI boundary

Study KiCadAI's structured IR and fail-closed validation approach. Retain the small ESP32 breadboard validator. PCB models, schematic export, ERC/DRC and Go tooling are outside V1. Existing rules check required connections, pin capabilities, catalog integrity, supply/logic voltage, current budget, bus consistency, address conflicts and libraries. Missing checks cannot be described as passing physical proof.

## Deferred integrations

qarnet/serial-mcp is a replacement option if HardwareMCP serial sessions prove inadequate. ESP-IDF MCP is a future RuntimeProvider, with no Arduino/IDF conflation. nff-core local patterns inform future remote devices; hosted backend is outside scope. KiCad Copilot is future PCB work.

Boardsmith and Arduino-Agent are reference research only; no code or component datasets are copied. AI-Agents-in-Physical-Computing is reference only until a verified license permits reuse.

## Evidence ownership

A tool's success proves its operation, not the whole circuit. Verification requires the current experiment, contract hash, source hash and fresh nonce. Only a physical executor envelope can produce physical observations. Simulated flags or contradictory provenance are rejected. USB inference is a candidate, not board proof. Successful ESP32 upload and a bound firmware handshake prove board execution; I2C scan and bounded readings prove named peripheral checks. OLED ACK does not prove visible pixels.

Compile exports binaries into the sketch's build directory because upload_sketch has no custom input directory argument. Capture tool responses, serial frames and binary hashes for replay. A failed or interrupted operation cannot automatically flash on restart. Port locks remain held until the entire executor process group exits.

Sources: [HardwareMCP](https://github.com/hardware-mcp/arduino-mcp-server), [Wokwi Elements](https://github.com/wokwi/wokwi-elements), [KiCadAI](https://github.com/dshills/KiCadAI), [OpenViking](https://github.com/volcengine/OpenViking).

Physical telemetry carries a monotonically increasing `cycle` number. Verification uses only the newest observed valid cycle. Missing checks in that cycle fail; earlier samples cannot fill gaps. Conflicting duplicates fail the check. Capture ending mid-cycle may need a fresh re-test, never a fallback to older successful evidence.
