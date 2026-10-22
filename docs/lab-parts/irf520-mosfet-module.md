# IRF520 MOSFET module

Protocol: `pwm`.

- Device (simulation): `apps/web/src/lab/sim/devices/irf520-mosfet-module.ts`
- Part (3D): `apps/web/src/lab/scene/parts/irf520-mosfet-module.ts`
- Test: `tests/lab-motion-drivers.test.ts` (group test for stepper, ULN2003, MG996R, IRF520 and pump)
- Pins: SIG, VCC, GND on the breadboard header; VIN+, VIN-, V+, V- are screw terminals (wires only)

Model: a low-side switch. V+ is VIN+ passed through, V- is the switched drain: wire the load between V+ and V-. RDS(on) follows a typical gate curve through the Vishay points (0.27 ohm at 10 V, about 0.6 ohm at 5 V, several ohms at 3.3 V, off below the threshold); it is NOT a logic-level part and the curve between points is an estimate, not a guarantee. PWM on SIG gives the load duty x I x R_load. The drop across the switch depends on the load, so the popover has the load resistance. State: gate, duty, RDS(on), load volts and mA, watts, junction temperature (RthJA 62 degC/W, free air).

Provenance: own work from public datasheet behaviour and typical module dimensions (stated in the file header of the part); no vendor models, photos or logos, nothing downloaded into the repo.
