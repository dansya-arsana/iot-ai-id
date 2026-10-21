# LOAD-LAMP

Protocol: `pwm` (an actuator driven by PWM: the device reads duty and frequency of its pin).

- Device (simulation): `apps/web/src/lab/sim/devices/load-lamp.ts`
- Part (3D): `apps/web/src/lab/scene/parts/load-lamp.ts`
- Test: `tests/lab-part-load-lamp.test.ts`
- Pins: none (desk prop)

A small 12 V bulb on the contact of a relay module, used by lesson 14 (motion light). It has no pins: it reads the relay it points at (props.target) and applies the same coil logic and operate/release delay, so it lights while COM joins NO. Provenance: own work (generic E10 bulb proportions), no vendor art, photos or logos.
