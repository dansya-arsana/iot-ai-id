# PIR motion sensor (HC-SR501)

Protocol: `gpio`

- Device (simulation): `apps/web/src/lab/sim/devices/pir-hc-sr501.ts`
- Part (3D): `apps/web/src/lab/scene/parts/pir-hc-sr501.ts`
- Test: `tests/lab-part-pir-hc-sr501.test.ts`
- Pins: VCC, OUT, GND

Models settling time (~60 s, OUT LOW), hold time Th, jumper H (retrigger) vs L (single), 2.5 s block time, and sensitivity range. Popover: motion, mover distance, hold, range, jumper, settling.

Provenance: own work. Geometry from public datasheet dimensions and behaviour; no vendor models, photos or logos.
