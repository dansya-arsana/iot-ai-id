# IR obstacle sensor FC-51

Protocol: `switch`.

- Device (simulation): `apps/web/src/lab/sim/devices/ir-obstacle-fc51.ts`
- Part (3D): `apps/web/src/lab/scene/parts/ir-obstacle-fc51.ts`
- Test: `tests/lab-part-ir-obstacle-fc51.test.ts`
- Pins (physical order): OUT, GND, VCC
- Supply: 3.3 to 5.5 V (rated in the device; below 2.7 V the module is dead)

## Model

Reflected IR falls with the square of the distance and scales with the surface (white 1.0, wood 0.5, black 0.12). The trimmer sets the range for a white surface (2 to 30 cm); the reach of a surface is range x sqrt(reflectivity). OUT is LOW while an obstacle is detected, HIGH otherwise. Strong sunlight saturates the photodiode and reads as an obstacle. A faint beam shows while it detects.

## Provenance

Own work from public datasheet behaviour (LM393 comparator module family). The 3D body is modelled from nominal dimensions in millimetres with the lab palette; no vendor model, photo, logo or marking was copied. No third-party code.

## Honest limits

- The comparator has no hysteresis, like the cheap module, so an object at the limit can flicker in a real build.
- Reflectivity values are model assumptions.
- No 38 kHz carrier: the real FC-51 does not modulate, which is why daylight fools it.
