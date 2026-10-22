# IR flame sensor

Protocol: `adc`.

- Device (simulation): `apps/web/src/lab/sim/devices/flame-sensor.ts`
- Part (3D): `apps/web/src/lab/scene/parts/flame-sensor.ts`
- Test: `tests/lab-part-flame-sensor.test.ts`
- Pins (physical order): AO, GND, VCC, DO
- Supply: 3.3 to 5.5 V (rated in the device; below 2.7 V the module is dead)

## Model

A phototransistor in a divider: AO = VCC / (1 + 15 x ir), so more infrared pulls AO down; DO is LOW while AO is below the trimmer level. A lit flame gives ir = (20 cm / distance)^2, capped at 1, times a repeatable flicker (about +-15 percent at 7.3 Hz and 2.9 Hz). Ambient infrared (sunlight) adds on top. A candle with a flickering flame appears in the 3D view while lit.

## Provenance

Own work from public datasheet behaviour (LM393 comparator module family). The 3D body is modelled from nominal dimensions in millimetres with the lab palette; no vendor model, photo, logo or marking was copied. No third-party code.

## Honest limits

- The 20 cm reference distance and the divider gain are model assumptions, not datasheet values.
- Real flames flicker randomly; this one flickers with a fixed pattern so tests repeat.
- The detection cone is not modelled: only distance, not angle.
