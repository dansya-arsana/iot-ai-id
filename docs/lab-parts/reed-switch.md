# REED-SWITCH

Protocol: `switch`

- Device (simulation): `apps/web/src/lab/sim/devices/reed-switch.ts`
- Part (3D): `apps/web/src/lab/scene/parts/reed-switch.ts`
- Test: `tests/lab-part-reed-switch.test.ts`
- Pins: VCC, SIG, GND

## Behaviour

Normally-open reed capsule on a module with a pull-down on SIG. The contact pulls in above 100 G along the glass and drops out below 60 G (hysteresis); a magnet across the glass couples only 15%, so it must sit much closer. Closed joins VCC to SIG (SIG reads HIGH, only if VCC is powered); open leaves the pull-down holding LOW. Closing bounces: the edge is a 5-step train (up 50 us, down 30 us, up 70 us, down 25 us, up) per the typical 0.1..0.5 ms contact bounce, so a sketch without debounce can count extra edges; releasing is a clean fall. The contact is published through `switches()` (VCC-SIG), so a linked part sees the merged net. Popover: magnet distance and direction (along or across the glass); the 3D blades touch and glow while closed.

## Provenance

Own work: the body is plain three.js primitives from the lab palette (dimensions from public datasheets); behaviour written from the public datasheet descriptions. No vendor models, photos, logos or code, no third-party libraries.
