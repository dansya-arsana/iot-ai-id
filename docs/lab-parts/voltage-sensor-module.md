# VOLTAGE-SENSOR-MODULE

Protocol: `adc` (a passive divider, no supply).

- Device (simulation): `apps/web/src/lab/sim/devices/voltage-sensor-module.ts`
- Part (3D): `apps/web/src/lab/scene/parts/voltage-sensor-module.ts`
- Test: `tests/lab-part-voltage-sensor-module.test.ts`
- Pins: S, NC (the "+" header pin, not connected on the real board), GND (breadboard columns 0, 1, 2), VIN+ and VIN- (screw terminals; VIN- is the same copper as GND)

Behaviour: R1 = 30 k and R2 = 7.5 k, so `Vout = Vin / 5` (25 V gives 5 V). VIN+ takes whatever net it is wired to (battery, regulator, rail) through the part-to-part nets; with VIN+ unwired the popover probe voltage stands in. Above 25 V the pin is held at 5 V and the state says `over`. The output impedance (6 k) is not modelled, the ADC input is ideal.

Provenance: own model; the divider values and the 0-25 V range are public knowledge of this common module. No vendor model, logo or art.
