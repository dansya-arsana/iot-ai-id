# TILT-SWITCH

Protocol: `gpio` (a digital input the sketch drives (an indicator): the device watches one pin).

- Device (simulation): `apps/web/src/lab/sim/devices/tilt-switch.ts`
- Part (3D): `apps/web/src/lab/scene/parts/tilt-switch.ts`
- Test: `tests/lab-part-tilt-switch.test.ts`
- Pins: VCC, SIG, GND

## Behaviour

Rolling-ball SW-520D on a 3-pin module: upright = SIG LOW, tilted = SIG HIGH (module pull-up). Input `tilted` (toggle). The device re-reads `ctx.props.tilted` each slice and on `state()`, and drives SIG only on change.

## Provenance

Own work: the body is plain three.js primitives (board, metal can) from the lab palette; behaviour written from the public description of a tilt switch. No vendor models, art or code.
