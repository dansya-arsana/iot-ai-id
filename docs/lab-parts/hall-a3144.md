# HALL-A3144

Protocol: `switch (output reads like gpio)`

- Device (simulation): `apps/web/src/lab/sim/devices/hall-a3144.ts`
- Part (3D): `apps/web/src/lab/scene/parts/hall-a3144.ts`
- Test: `tests/lab-part-hall-a3144.test.ts`
- Pins: VCC, SIG, GND

## Behaviour

Unipolar Hall switch (A3144 family) on a module with a pull-up. A SOUTH pole facing the marked face above the operate point BOP (typ 70 G) pulls SIG LOW; it releases only below BRP (typ 50 G), so there is a 20 G hysteresis. A north pole never operates it. Magnet model (10 mm disc): B = 2500 G * (5 / (5 + d))^3, d in mm, so BOP is reached at about 11 mm. Supply 4.5..24 V (the power check warns on 3.3 V). Popover: magnet distance (0..40 mm) and the pole that faces the sensor; the 3D magnet hangs above the flat face at the simulated distance (hidden beyond 30 mm) and the module LED shows the output being pulled low. SIG is driven by the slice, so the edge lands within one 16 ms frame in the browser (1 ms in `advance()`).

## Provenance

Own work: the body is plain three.js primitives from the lab palette (dimensions from public datasheets); behaviour written from the public datasheet descriptions. No vendor models, photos, logos or code, no third-party libraries.
