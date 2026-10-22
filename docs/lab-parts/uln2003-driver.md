# ULN2003 stepper driver board

Protocol: `gpio`.

- Device (simulation): `apps/web/src/lab/sim/devices/uln2003-driver.ts`
- Part (3D): `apps/web/src/lab/scene/parts/uln2003-driver.ts`
- Test: `tests/lab-motion-drivers.test.ts` (group test for stepper, ULN2003, MG996R, IRF520 and pump)
- Pins: IN1-IN4, -, + on the breadboard header; OUT1-OUT4 and COM are the motor socket (wires only)

Model: four Darlington sinks (VCE(sat) 0.9 V). An input high pulls its output to ground, an off channel is open; COM carries the + supply. Nothing conducts below 3.5 V supply. LEDs A-D follow the outputs. Every input edge is time-stamped on a per-board queue that a wired 28BYJ-48 drains. Power rating 4.5-12 V, about 240 mA.

Provenance: own work from public datasheet behaviour and typical module dimensions (stated in the file header of the part); no vendor models, photos or logos, nothing downloaded into the repo.
