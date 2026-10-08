# ADR 003: Own physical experience, keep tools replaceable

Status: accepted for V1 foundations, 2026-10-06.

## Problem and scope

The product needs two entrances: Build with AI for developers and agents, and Learn & Verify for students and Hardware Fellows. Both feed the same engineering episode model. The durable asset is the ordered experience, its provenance and permissions, rather than a particular simulator or orchestrator.

The current executable challenge remains classic ESP32 + BME280 at 0x76 + SSD1306 at 0x3C, including deliberate shared-SDA failure and recovery. DHT22, fan control and fifty power-loss trials in the thesis are examples, not implemented or verified capabilities. School enrollment, teacher accounts, badges, leaderboards and nationwide labs remain future operations.

## Implementation plan

1. Persist entry point and challenge version on project creation; expose a genuine learning challenge that starts the existing workspace.
2. Add immutable human actions, environment measurements and permission records. Cross-project artifact references must be refused. Human reports cannot satisfy runtime verification checks.
3. Assemble a versioned episode from existing contracts, generated firmware, agent plans/diagnoses, experiments, failures, repairs, verification and ordered events. Download local engineering JSON independently from optional research/model-improvement export.
4. Default research permissions to absent. Require explicit, purpose-specific attestations and content review. School and guardian references are required for declared minors; unknown age never qualifies. Content review binds to the server-computed content hash; later episode content requires fresh review. Withdrawal excludes future exports. This local application records attestations; it cannot authenticate legal authority or independently certify consent.
5. Exclude runtime USB paths, raw serial, arbitrary tool output, local session tokens and private knowledge context from portable exports. Export only curated trajectory fields. Pseudonymization and hashes are not claims of anonymization or authenticity.
6. Keep new human/permission/environment records out of automatic knowledge ingestion and agent requests. Existing build goals and machine observations may be processed for operational assistance, disclosed at the entry points; research reuse is a separate permission.
7. Move the current software scenario behind an injectable SimulationAdapter. Label it a template model that executes no firmware. Wokwi is an optional external CLI/scenario adapter, never an embedded editor dependency or automatic fallback.
8. Preserve the existing light Swiss industrial interface. Add the two entrances, a working learning challenge and an episode page with action/measurement forms, permissions and exports. No invented learner counts or dataset size.

## Wokwi boundary

Official Wokwi docs describe token-authenticated CLI execution, YAML automation scenarios and experimental MCP support. Wokwi Elements is a separate component visualization library. This environment currently has neither a Wokwi CLI binary nor a configured CLI token. The published supported-hardware list includes DHT22 and SSD1306 but does not list BME280, so the existing golden recipe must not be silently replaced with a different sensor or reported as Wokwi-tested.

The adapter reports unavailable or unsupported honestly until a matching recipe, licensed CLI access and executed scenarios are available. Generic white-label editor embedding is not an assumed capability.

Sources: [CLI usage](https://docs.wokwi.com/wokwi-ci/cli-usage), [automation scenarios](https://docs.wokwi.com/wokwi-ci/automation-scenarios), [experimental MCP](https://docs.wokwi.com/wokwi-ci/mcp-support), [supported hardware](https://docs.wokwi.com/getting-started/supported-hardware).

## Acceptance and verification

- Both entrances create real projects with distinct entry metadata and the same canonical contract/evidence workflow.
- Actions and measurements persist across reload; invalid references and non-finite measurements are rejected; human reports never alter physical verification.
- Episode trajectories retain the failed experiment and fresh parent-linked recovery in event sequence order.
- Local exports preserve simulation/physical distinctions and source identities without private runtime details.
- Missing, unknown, incomplete or withdrawn permissions refuse research exports; permissions do not affect the ability to learn locally.
- Template simulation remains explicit; missing or unsupported Wokwi cannot silently produce passing results.
- Existing tests pass, meaningful episode/permission/adapter regressions pass, production build passes, and native browser checks prove the new flow works.
- Actual physical verification still requires attached hardware and user-performed wiring/failure/repair. This ADR does not redefine that milestone.

## Ownership

Root coordinates and verifies. A bounded GPT-6.1 Sol low worker implements backend/schema/adapter foundations, then root implements UI sequentially. A separate read-only review checks export provenance, permission gates and operational data boundaries. Graphify is refreshed after the implementation.
