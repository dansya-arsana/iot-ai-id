# ADR 007: Open-source stack integration map

Status: accepted; records what we adopt, align with, study, or defer across the open-source hardware tooling landscape.

## Context

The architecture thesis is integrate-first: replaceable tools around irreplaceable evidence. Several MIT-licensed projects now cover the layers we need. This decision maps each recommended project to our boundaries so adoption is deliberate and licensing risk is explicit. Verified facts are stated as such; items marked "per reference" come from the recommending document and must be re-verified before vendoring.

## Adopted (in the live path today)

- **arduino-mcp-server** (MIT): pinned at 0.2.8 behind `runtime/local-bridge/mcp-executor.ts`. Owns board detection, compile, upload, serial capture and safety preflight for the V1 local runtime. Exactly the recommended shape: we wrap, we do not re-implement.
- **wokwi-elements** (MIT): `packages/ui-hardware` board visuals and the workbench canvas. Visual components only — never treated as a simulator.

## Adapter available at the CLI boundary

- **Wokwi CLI** (proprietary, token-gated): The `WokwiCliAdapter` and test plumbing exist (ADR 006), including contract-generated `diagram.json`, automation scenarios, compilation, and serial evidence handling. Live golden-recipe execution currently refuses because its BME280 sensor has no tested simulator chip. A Wokwi token alone does not make this recipe executable. No white-label embed dependency; license review required before commercial reliance.

## Aligned by construction

- **KiCadAI** (`dshills/KiCadAI`, per reference MIT — verify LICENSE before vendoring): philosophy matches ours (AI proposes, deterministic system proves/refuses; structured IR, pinmap checks, component catalog, validation). Our equivalents already exist as `packages/hardware-contract` (structured IR), `packages/validator` (deterministic electrical gates), `packages/component-catalog`. We study its pinmap/rule-code patterns rather than adopting a Go/PCB-oriented system. PCB generation stays out of scope.

## Deferred with explicit triggers

- **qarnet/serial-mcp** (per reference MIT, 25 tools, reconnect, persistent logs, boot capture, AT/JSON/NMEA/Modbus parsers): adopt only when arduino-mcp-server serial sessions demonstrably fall short (e.g. multi-session logging or parser needs). Current single-session capture with cycle telemetry suffices for the golden recipe.
- **Official ESP-IDF MCP / esp32-ai-loop-mcp-server** (Espressif ships an idf.py MCP for build/flash/target; esp32-ai-loop per reference adds background serial and flash-observe loops, MIT): ESP-IDF firmware generation is a future adapter behind the existing `RuntimeRequest` boundary. Known Windows/dependency bugs are one reason we abstract; do not couple the engine to any single MCP surface.
- **nff-core** (per reference MIT core): bench → flash → serial → remote diagnosis/OTA direction matches our local-bridge pattern. Take local/core patterns only; the hosted backend is proprietary and stays out.

## Not in V1

- **KiCad Copilot** (per reference MIT): agent-driven schematic/placement/routing/ERC/DRC. revisit when experiments demand real PCB design.

## Decision rules going forward

1. Every external tool sits behind an explicit adapter boundary (`SimulationAdapter`, `RuntimeRequest`/`LocalRuntimeClient`, `AgentProvider`, `OpenVikingKnowledge`) so any of them can be replaced without touching evidence semantics.
2. Licenses are verified at adoption time, not assumed; per-reference claims are re-checked before code depends on them.
3. Deterministic electrical truth never moves into an external AI-facing tool; it stays in our validator and manifests.
4. Nothing gets embedded as a product dependency unless it can be forked or replaced without breaking the evidence protocol.
