# ADR 008: Device adapters for partner hardware

Status: proposed. Normative schema: `packages/device-adapter/index.ts` (protocol version 1).

## Context

The local runtime is built for one hardware shape: a microcontroller we flash. `runtime/local-bridge/mcp-executor.ts` detects USB serial candidates by bridge-chip VID (CP210x, CH340, FTDI, Espressif), compiles and uploads with Arduino CLI, and proves identity with a firmware handshake on serial. `HardwareContract.firmware.framework` is the literal `'arduino'` and `CHECKS` are microcontroller checks (`compiled`, `flashed`, `oled_initialized`).

Partner hardware does not fit that shape. Dexterous hands and tactile sensors ship with their own firmware and are driven through a vendor SDK over an industrial bus:

| Device | Transport | Vendor software |
|---|---|---|
| BrainCo Revo 2 | RS-485, CAN-FD (EtherCAT on Pro/Touch) | Python/C SDK, ROS |
| AgiBot OmniHand | RS-485, CAN-FD, USB | Python/C++ SDK; ROS 2 in development |
| PaXini tactile (GEN3) | USB via a communication board (SPI/I2C/UART inside) | `paxini-sdk` (Python), ROS 2 bridge |
| Inspire RH56 | RS-485, CAN-FD or Modbus TCP, by model | ROS package |

These connect through USB-to-RS485 or USB-to-CAN dongles, so the host sees an FTDI serial port or a CAN interface, not "a BrainCo hand". USB metadata cannot identify them. A universal driver is not feasible: protocols, register maps and safety behaviour differ per vendor and per firmware version.

The existing runtime already holds the right principle: USB metadata is a candidate; proof is a bound handshake. This ADR generalises that principle instead of the Arduino path.

## Decision

The platform stays one system; each device family gets a small **adapter** that wraps the vendor's own SDK behind a fixed protocol. We never re-implement a vendor protocol when an SDK exists.

```
 test contract → operator instructions → run → evidence      (platform, unchanged per vendor)
                         │
          local bridge (enforces state, envelope, watchdog, records raw data)
             │                                   │
   DUT adapter (one per device family)     Rig adapters (ours)
   brainco.revo2, agibot.omnihand, …       iot.rig.esp32: climate, power relay, fixture, camera
```

- **DUT adapter**: the device under test. Written by iot.ai.id from the partner's SDK and protocol document, versioned, signed, distributed to every Lab Mitra.
- **Rig adapter**: our instruments around the DUT (temperature/humidity, power cycling, press fixtures, cameras). Built on our ESP32 kits and spoken through the same protocol, so the bridge treats DUT and rig uniformly.
- The existing Arduino flow remains the `firmware` path. It is not migrated by this ADR.

### Process model

An adapter is a separate process launched by the local bridge with a fixed argv, a whitelisted environment and no shell. It speaks **JSON-RPC 2.0, one JSON object per line, over stdio**. stdout carries protocol messages only; diagnostics go to stderr and are captured as logs. Any language works; vendor SDKs make Python the expected default.

Plain JSON-RPC rather than MCP: MCP exposes tools to agents, and agents must never reach an actuator except through the bridge's state machine, envelope and approval checks. Keeping the adapter surface non-agent keeps that boundary structural.

### Adapter package and manifest

A package is a directory with `adapter.json` (schema `AdapterManifestSchema`) and its entrypoint. The manifest declares:

- `id` (`vendor.family`, e.g. `brainco.revo2`), semver `version`, `protocolVersion: 1`, `role: dut | rig`
- `devices`: model names and supported firmware ranges
- `transports`: `serial`, `rs485`, `can`, `can-fd`, `usb-hid`, `usb-bulk`, `ethernet`, `modbus-tcp`, `ethercat`
- `probe`: host-side hints only (dongle USB VID/PID, baud rates, CAN bitrates). Hints select which candidates to probe; they never establish identity.
- `runtime`: `python | node | binary`, entrypoint, argv
- `sdk`: name, version, licence, and whether it is bundled or must be installed separately (proprietary SDKs are not redistributed)
- `channels`: static capability description (see below)
- `safety`: `stopLatencyMs`, `heartbeatTimeoutMs`, whether the device needs a hardware stop, and the vendor's absolute limits
- `network`: `none` by default; any other value is reviewed before signing

Physical runs accept only packages whose SHA-256 matches a registry entry signed by iot.ai.id. Unsigned adapters run against simulators only.

### Channels

Capabilities are described as channels so the platform needs no vendor knowledge:

- `id` (`index.flex`, `thumb.rotation`, `palm.taxels`), `kind: actuator | sensor`
- `quantity` (`position`, `velocity`, `force`, `current`, `temperature`, `pressure`, `taxel_array`, …) and SI `unit`
- `range` for scalars, `shape` for arrays, `maxRateHz`
- for actuators, `control`: `position | velocity | force | current`

### Methods (bridge → adapter)

| Method | State required | Must |
|---|---|---|
| `hello` | any | Return adapter id, version, protocol version. Incompatible protocol version ends the session. |
| `probe {port}` | idle | Read-only and time-bounded. Never actuates or writes configuration. Returns `match: none \| possible \| confirmed`. `confirmed` requires a vendor handshake answer, not metadata. |
| `connect {port}` | idle → connected | Open the transport; no motion. |
| `identify` | connected | Return model, serial number, firmware version as read from the device. |
| `describe` | connected | Return live channels; must be a subset of the manifest channels. |
| `arm {approvalToken, envelope}` | connected → armed | Accept actuation only inside `envelope`. The token comes from the bridge's human approval. |
| `command {seq, targets[]}` | armed | Reject (never silently clamp) any target outside the envelope or channel range. Commands are rejected unless armed. |
| `read {channels}` | connected/armed/faulted | Return one sample per channel with device timestamps; allowed while faulted for diagnosis. |
| `stream {channels, rateHz}` | connected/armed | Start `telemetry` notifications. |
| `heartbeat {seq}` | armed | Bridge sends at least every `heartbeatTimeoutMs / 3`. |
| `stop` | any | Idempotent; bring all actuators to a safe state within `stopLatencyMs`; works mid-command. An armed session drops to connected, so further motion needs a fresh approval. |
| `disarm` | armed/faulted → connected | Leave actuators safe. Clears a fault only after the bridge has recorded it. |
| `disconnect` | connected/faulted → idle | Close the transport. |

Notifications (adapter → bridge): `telemetry` (samples with channel, value, device timestamp, host timestamp), `fault` (code, severity, message; any `critical` fault moves the session to `faulted` and implies `stop`), `log`.

### State machine and safety

`idle → connected → armed → connected → idle`, with `faulted` reachable from any non-idle state on a critical fault and left only through `disarm`. The reference implementation is `canCall`/`transition`/`onFault` in the schema package. The bridge owns this machine and refuses out-of-state calls before they reach the adapter; the adapter enforces it again. Safety does not rely on software alone:

1. **Deadman**: an armed adapter that misses heartbeats for `heartbeatTimeoutMs` must stop actuators by itself.
2. **Envelope**: per-run limits from the test contract (force, speed, current, position span) are always at or inside the manifest's vendor limits; violations are rejected and recorded.
3. **Hardware stop**: devices with `requiresHardwareStop` cannot be armed unless a rig power relay with a physical stop button is present and reported healthy. Operators are vocational students; a software stop is not enough.
4. **Approval**: arming needs the same explicit local human approval the current physical path uses for USB trust.

### Evidence

Adapters report observations; they never report pass/fail. The bridge records raw telemetry, rig measurements and faults, and the verifier derives check results, as `verifyEvidence` already does for firmware runs. Every record is bound to the run identity (experiment id, contract hash, nonce) plus adapter id, version and package hash, and the device identity returned by `identify`. A run whose identity changes mid-session (different serial number or firmware) fails.

New check kinds for device tests: `device_identified`, `command_tracking` (target vs measured within tolerance), `telemetry_in_range`, `endurance_cycles`, `fault_recovered`, `stop_latency`. The existing `CHECKS` stay for firmware runs; extending `HardwareContract` into a device test contract is a follow-up ADR.

### Conformance

Before signing, every adapter passes the conformance suite against real hardware, and the simulated adapter passes it in CI:

- `probe` causes no actuation and no configuration writes
- `command` is rejected when not armed and when outside the envelope
- `stop` meets `stopLatencyMs`, also during motion
- missing heartbeats stop the device within `heartbeatTimeoutMs`
- `identify` is stable across reconnects
- stdout contains only valid protocol lines

### Partner onboarding

To be testable on the network a partner provides: two units, the SDK and its licence terms, the protocol or register document, the safe operating limits, the calibration procedure, and the firmware versions in scope. iot.ai.id writes, conformance-tests and signs the adapter; it then ships to every lab.

## Consequences

- Adding a vendor is adapter work, not platform work. The adapter catalogue becomes part of the network's value.
- Vendor protocol and firmware changes are isolated to one versioned package.
- ESP32 skills remain central: they build the rig, which is the part that is genuinely universal.
- Cost: one adapter per device family and a conformance run per firmware range. Proprietary SDKs that cannot be redistributed need a per-lab install step.

## Open questions

- Python runtime distribution in the desktop app (bundled interpreter vs per-adapter virtualenv).
- CAN access on macOS and Windows (vendor dongle drivers vs SocketCAN on Linux lab machines).
- Signing key custody and registry hosting.
- Telemetry volume for taxel arrays at 1 kHz: local storage format and what syncs to the coordinator.
- First real adapter: an open hand (Aero Hand Open, ESP32-S3) to prove the path, or the first partner device.
