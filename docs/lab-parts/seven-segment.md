# 7-segment digit

Protocol: `gpio`.

- Device: `apps/web/src/lab/sim/devices/seven-segment.ts`
- Part: `apps/web/src/lab/scene/parts/seven-segment.ts`
- Test: `tests/lab-part-seven-segment.test.ts`
- Pins: a-g, dp, COM

Model: per-segment LED current from pin duty, series resistor and colour Vf; glyph detection. Pins sit in one row (platform has one hole row); the digit stands in a 9-way socket strip.

Provenance: own work from public datasheet behaviour and typical module dimensions; no vendor models, photos or logos.
