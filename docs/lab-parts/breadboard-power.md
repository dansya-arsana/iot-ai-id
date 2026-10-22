# BREADBOARD-POWER

Protocol: `gpio` (a power part: no signal pins, it only takes part in the net solver, see docs/lab-extending.md "Power").

- Device (simulation): `apps/web/src/lab/sim/devices/breadboard-power.ts`
- Part (3D): `apps/web/src/lab/scene/parts/breadboard-power.ts`
- Test: `tests/lab-part-breadboard-power.test.ts`
- Pins: VIN, GND, LEFT, RIGHT (wires only, a desk part)

Provenance: own model of the common MB102 style breadboard power module from its public description (barrel jack 6.5-12 V, two AMS1117 regulators, a 5 V / 3.3 V jumper per rail). No vendor art or logo.
