# rgb-module-ky016

Protocol: `pwm`. KY-016 RGB LED module, common cathode, 150 ohm per colour.

- Device (simulation): `apps/web/src/lab/sim/devices/rgb-module-ky016.ts`
- Part (3D): `apps/web/src/lab/scene/parts/rgb-module-ky016.ts`
- Test: `tests/lab-part-rgb-module-ky016.test.ts`

Pins in our order: R, G, B, GND (silkscreen order on real boards varies by maker; check yours). Each colour pin is read as duty, current = duty x (5 V - Vf) / 150 ohm with Vf 2.0 V red and 3.0 V green and blue. Needs the minus pin on GND.

Provenance: own model and own code, written from the public datasheet behaviour of the part family; no vendor models, photos, logos or GPL code. Screenshot: `/lab/parts/rgb-module-ky016`.
