# SOIL-MOISTURE

Protocol: `adc` (an analog sensor: the device puts a voltage on an ADC pin).

- Device (simulation): `apps/web/src/lab/sim/devices/soil-moisture.ts`
- Part (3D): `apps/web/src/lab/scene/parts/soil-moisture.ts`
- Test: `tests/lab-part-soil-moisture.test.ts`
- Pins: VCC, SIG, GND

Output is a linear inverse voltage (2.8 V dry, 1.2 V wet) on SIG, our simplification of the capacitive sensor, not measured data. Provenance: own work, no vendor art, photos or logos.
