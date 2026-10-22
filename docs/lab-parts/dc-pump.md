# Mini submersible pump

Protocol: `gpio (desk prop, load)`.

- Device (simulation): `apps/web/src/lab/sim/devices/dc-pump.ts`
- Part (3D): `apps/web/src/lab/scene/parts/dc-pump.ts`
- Test: `tests/lab-motion-drivers.test.ts` (group test for stepper, ULN2003, MG996R, IRF520 and pump)
- Pins: +, - (two leads, no breadboard holes)

Model: a 3-6 V brushed pump, the 120 L/h class. Starts above 2 V, flow rises with the voltage up to 100 L/h at 6 V, current about 70 mA + 25 mA per volt. It reads the voltage across its leads from the net solver (MOSFET module V+/V-, relay COM/NO and a battery, a driver); a floating end is an open circuit. The popover has In the water: out of the water the pump spins without flow, and after 10 s it is flagged as overheated. Rated 2.5-6 V and flagged as needing an external supply.

Provenance: own work from public datasheet behaviour and typical module dimensions (stated in the file header of the part); no vendor models, photos or logos, nothing downloaded into the repo.
