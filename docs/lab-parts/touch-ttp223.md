# TOUCH-TTP223

Protocol: `switch` (a digital output the sketch reads).

- Device (simulation): `apps/web/src/lab/sim/devices/touch-ttp223.ts`
- Part (3D): `apps/web/src/lab/scene/parts/touch-ttp223.ts`
- Test: `tests/lab-part-touch-ttp223.test.ts`
- Pins (silkscreen order): OUT (I/O), VCC, GND. Breadboard holes 0-2.

## Behaviour (public TTP223-BA6 behaviour)

- Direct mode: OUT follows the pad after the response time, 60 ms (fast) or 220 ms (low-power, popover). Toggle mode (jumper A): each touch flips OUT, which is kept after release. Active LOW (jumper B) inverts idle and active. The output is push-pull.
- The first 0.5 s after power-up is calibration: a finger on the pad then becomes part of the baseline and is ignored until it lifts.
- Direct mode drops back to idle after 100 s of continuous touch (until the finger lifts).
- A change before the response time elapsed restarts the wait; the newest change wins.
- A popover edit is polled each slice (about 1 ms in the runner); a click on the 3D pad is a momentary touch.
- Power rating 2.0-5.5 V.

## Provenance

Own work from the public datasheet description of the TTP223 touch IC and the common 24 x 24 mm module. No vendor models, art or code.
