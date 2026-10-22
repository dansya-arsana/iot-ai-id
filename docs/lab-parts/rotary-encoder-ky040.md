# ROTARY-ENCODER-KY040

Protocol: `switch` (digital outputs the sketch reads): quadrature CLK/DT plus SW.

- Device (simulation): `apps/web/src/lab/sim/devices/rotary-encoder-ky040.ts`
- Part (3D): `apps/web/src/lab/scene/parts/rotary-encoder-ky040.ts`
- Test: `tests/lab-part-rotary-encoder-ky040.test.ts`
- Pins (header order): CLK, DT, SW, +, GND. Breadboard holes 0-4.

## Behaviour

- 20 detents per turn. One detent is one full Gray cycle on CLK (A) and DT (B), 2.5 ms between transitions and a 5 ms gap before the next detent. CW: CLK falls, DT falls, CLK rises, DT rises. CCW: DT leads. At rest both are HIGH (the module's 10 k pull-ups, modelled by driving HIGH).
- The shaft position is the popover value (0-60 detents). Changing it plays every detent in order; `state().angle` follows the transitions in quarter steps so the 3D knob turns with the signals.
- Optional contact bounce: after each edge the line flips back at 40 us and lands again at 90 us.
- SW is LOW while the knob is pushed (popover toggle, or a click on the 3D knob = momentary button input).
- Power rating 3.0-5.5 V.

## Provenance

Own work from the public description of an EC11-class incremental encoder and the common 5-pin module (PCB 30 x 19 mm, 17 mm knob). No vendor models, art or code.
