# Relay module

Protocol: `gpio`.

- Device: `apps/web/src/lab/sim/devices/relay-module.ts`
- Part: `apps/web/src/lab/scene/parts/relay-module.ts`
- Test: `tests/lab-part-relay-module.test.ts`
- Pins: VCC, GND, IN

Model: active-low (jumper-selectable) coil, 10 ms operate / 5 ms release, COM to NC or NO, click counter in state. No audio hook exists in the parts layer, so no click sound.

Provenance: own work from public datasheet behaviour and typical module dimensions; no vendor models, photos or logos.
