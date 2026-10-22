# Rain sensor

Protocol: `adc`.

- Device (simulation): `apps/web/src/lab/sim/devices/rain-sensor.ts`
- Part (3D): `apps/web/src/lab/scene/parts/rain-sensor.ts`
- Test: `tests/lab-part-rain-sensor.test.ts`
- Pins (physical order): VCC, GND, DO, AO
- Supply: 3.3 to 5.5 V (rated in the device; below 2.7 V the module is dead)

## Model

The plate conducts when water bridges the comb traces: conductance is linear in coverage, 2 kohm when fully wet, open when dry. AO = VCC x Rp / (Rp + 10 kohm), DO is LOW while AO is below the trimmer level (LED on). The plate wets and dries with a first-order lag of 0.4 s. Water drops appear on the 3D plate as the wetness rises.

## Provenance

Own work from public datasheet behaviour (LM393 comparator module family). The 3D body is modelled from nominal dimensions in millimetres with the lab palette; no vendor model, photo, logo or marking was copied. No third-party code.

## Honest limits

- Real plates corrode and read differently with dirty or mineral-rich water; here conductivity is fixed.
- The plate and its cable are drawn behind the control board and reach about 85 mm back; the layout does not reserve that depth.
