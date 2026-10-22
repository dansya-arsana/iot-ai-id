# laser-ky008

Protocol: `gpio`. KY-008 650 nm laser dongle.

- Device (simulation): `apps/web/src/lab/sim/devices/laser-ky008.ts`
- Part (3D): `apps/web/src/lab/scene/parts/laser-ky008.ts`
- Test: `tests/lab-part-laser-ky008.test.ts`

Pins: SIG (S), VCC (middle), GND (minus). The diode sits between S and minus, so S lights it: HIGH on, PWM dims by duty, no ground wire means no light. Middle pin only counts for the supply-rating check. About 30 mA (diode plus resistor), under the 40 mA pin limit.

Safety copy: never aim a real laser at eyes. The beam is drawn 90 mm long.

Provenance: own model and own code, written from the public datasheet behaviour of the part family; no vendor models, photos, logos or GPL code. Screenshot: `/lab/parts/laser-ky008`.
