# Gas sensor (MQ-2)

Protocol: `adc`

- Device (simulation): `apps/web/src/lab/sim/devices/mq2.ts`
- Part (3D): `apps/web/src/lab/scene/parts/mq2.ts`
- Test: `tests/lab-part-mq2.test.ts`
- Pins: VCC, GND, DO, AO

LPG curve ppm=574.25*(Rs/R0)^-2.222, RL divider on AO, LM393 DO active low with hysteresis and trimmer threshold, heater warm-up and 1.5 s mesh lag. Popover: gas ppm, threshold, warm-up.

Provenance: own work. Geometry from public datasheet dimensions and behaviour; no vendor models, photos or logos.
