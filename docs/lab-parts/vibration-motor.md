# vibration-motor

Protocol: `pwm`. Coin (pancake) vibration motor, 10 mm x 2.7 mm, 3 V, about 75 mA, about 12000 rpm at 3 V.

- Device (simulation): `apps/web/src/lab/sim/devices/vibration-motor.ts`
- Part (3D): `apps/web/src/lab/scene/parts/vibration-motor.ts`
- Test: `tests/lab-part-vibration-motor.test.ts`

Desk prop, pins + and - are flying leads (wire only). Speed follows the voltage across the leads from the net solver (an L298N output, a pin, a battery): starts above 2 V, keeps running to 1 V, 80 ms spin-up lag, reverse polarity reverses the shaft, capped at 1.3 x rated speed. Shake = (rpm/12000)^2, frequency = rpm/60. Wired to an I/O pin it raises the external-load warning (rating 2-3.8 V, 75 mA). The 3D shake is slowed and exaggerated so it can be seen.

Provenance: own model and own code, written from the public datasheet behaviour of the part family; no vendor models, photos, logos or GPL code. Screenshot: `/lab/parts/vibration-motor`.
