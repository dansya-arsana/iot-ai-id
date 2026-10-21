# IR receiver (VS1838B)

Protocol: `pulse`

- Device (simulation): `apps/web/src/lab/sim/devices/ir-receiver.ts`
- Part (3D): `apps/web/src/lab/scene/parts/ir-receiver.ts`
- Test: `tests/lab-part-ir-receiver.test.ts`
- Pins: OUT, GND, VCC

Demodulated NEC: 9 ms + 4.5 ms leader, 32 bits (562.5 us mark, 562.5/1687.5 us space, LSB first, address/command with inverses), stop mark, repeat code every 108 ms while a key is held. 21-key remote in the popover.

Provenance: own work. Geometry from public datasheet dimensions and behaviour; no vendor models, photos or logos.
