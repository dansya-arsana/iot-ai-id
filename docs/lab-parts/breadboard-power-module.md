# BREADBOARD-POWER-MODULE

Protocol: `gpio` (a power part: it only takes part in the net solver, see docs/lab-extending.md "Power").

- Device (simulation): `apps/web/src/lab/sim/devices/breadboard-power-module.ts`
- Part (3D): `apps/web/src/lab/scene/parts/breadboard-power-module.ts`
- Test: `tests/lab-part-breadboard-power-module.test.ts`
- Pins: VIN (jack +), GND, LEFT, RIGHT (desk prop, wires only)

Behaviour: MB102 style. Source `jack`: each rail is a regulator from VIN (5 V: 1.3 V dropout, 3.3 V: 1.1 V dropout, 700 mA). Source `usb`: the rails are stiff supplies of 5 V or 3.3 V against GND, no battery needed. Per-rail jumpers pick 5 V or 3.3 V; the slide switch (`on`) kills both. A 3.3 V part on a 5 V rail raises the usual `over` note.

Note: the core already has `breadboard-power` (jack only). This kind is the USB-capable variant with its own source popover; the two share pin names so a circuit can use either.

Provenance: own model and behaviour from the public MB102 / AMS1117 facts (about 53 x 34 mm board). No vendor model, logo or art.
