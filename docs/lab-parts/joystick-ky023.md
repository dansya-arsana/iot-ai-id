# JOYSTICK-KY023

Protocol: `adc` (two analog axes) plus a switch contact on SW.

- Device (simulation): `apps/web/src/lab/sim/devices/joystick-ky023.ts`
- Part (3D): `apps/web/src/lab/scene/parts/joystick-ky023.ts` (+ `input-labels.ts`, a silkscreen helper shared by the input modules)
- Test: `tests/lab-part-joystick-ky023.test.ts` (fake board in `tests/lab-input-fake.ts`)
- Pins (header order): GND, +5V, VRx, VRy, SW. Breadboard holes 0-4.

## Behaviour

- VRx and VRy are two 10 kohm potentiometers used as dividers between +5V and GND: wiper volts = counts / 1023 x supply (supply from `ctx.supply()`, 5 V when the rail is not wired). The default 512 counts is the mechanical centre. `adc()` returns VRx (A0..A5, or A6/A7 on a Nano via `ctx.analogPin`); the adapter polls only one pin per device, so VRy is pushed to its ADC channel with `env.setAdc` on every tick and on every change.
- SW is a contact to GND: LOW while pressed, HIGH when released (modelled as a pull-up, as on most KY-023 boards; a sketch with `INPUT_PULLUP` works either way).
- Inputs: X, Y (0-1023), `pressed` (sticky). A click on the 3D part arrives as a momentary `{kind:'button'}` input and presses SW.
- Axis direction: X above 512 = stick to the right, Y above 512 = stick pulled down (toward the pins).
- Power rating 3.0-5.5 V, about 1 mA.

## Provenance

Own work: board, housing, shaft and cap are three.js primitives from the lab palette, dimensions from public product drawings of this module family (PCB 26 x 34 mm, 16 mm housing). Behaviour written from the public description of a two-pot thumb joystick. No vendor models, art or code.
