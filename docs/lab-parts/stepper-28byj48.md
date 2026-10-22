# 28BYJ-48 stepper motor

Protocol: `gpio (desk prop, coil voltages)`.

- Device (simulation): `apps/web/src/lab/sim/devices/stepper-28byj48.ts`
- Part (3D): `apps/web/src/lab/scene/parts/stepper-28byj48.ts`
- Test: `tests/lab-motion-drivers.test.ts` (group test for stepper, ULN2003, MG996R, IRF520 and pump)
- Pins: BLU, PNK, YEL, ORG, RED (the five wires, in plug order; no breadboard holes)

Model: two centre-tapped windings. The field of the energised coils is the vector sum of coils at 0/90/180/270 degrees, so one coil is an even beat, two neighbours the beat between, two opposite coils cancel. One half step is 5.625 degrees of rotor divided by the gearbox (63.68395:1 measured, popover can pick the 64:1 label ratio): 4075.77 half steps (2037.9 full steps) per output turn. The rotor cannot follow steps faster than about 500 full steps per second (datasheet pull-in frequency): faster steps are counted in `missed` and the rotor stalls. Coil changes closer than 100 us are one change (a 4 us glitch between two digitalWrite calls cannot move a winding). State: angle, turns, steps, half steps, missed, coils, rpm, mode, powered, stalled.

Wiring: wired to a ULN2003 board (OUT1-OUT4 and COM) the step times are read from that board's cycle-stamped input edges (`coilBus` in the ULN2003 device), so a 1 ms sequence is exact even when a simulation slice holds many steps; wired to anything else the coil voltages are sampled once per slice. Wire order matters (swap two coil wires and the sequence scrambles).

Provenance: own work from public datasheet behaviour and typical module dimensions (stated in the file header of the part); no vendor models, photos or logos, nothing downloaded into the repo.
