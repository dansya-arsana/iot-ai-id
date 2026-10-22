# HX711-LOADCELL

Protocol: `twowire` (clocked, shift-out: DT low = ready, MSB first on each SCK rising edge, `framing:'free'`).

- Device (simulation): `apps/web/src/lab/sim/devices/hx711-loadcell.ts`
- Part (3D): `apps/web/src/lab/scene/parts/hx711-loadcell.ts`
- Test: `tests/lab-part-hx711-loadcell.test.ts` (fake clock, plus real firmware from `tests/fixtures/sketches/hx711-read.ino` and `hx711-gain.ino`)
- Pins: GND, DT, SCK, VCC (desk prop, wires only). The bar and its four wires are part of the 3D model, not pins.

Signal behaviour: 10 results per second (RATE low), 400 ms settling after power up or reset, DT low while a result waits, 24 bits two's complement MSB first, pulse 25 = gain 128, 26 = channel B gain 32, 27 = gain 64 for the NEXT result, SCK high for more than 60 us powers the chip down and resets the gain. Full scale is +-0.5 x AVDD / gain; the bar is 1.0 mV/V at capacity (1, 5, 10, 20 or 50 kg from the popover). 1 kg on a 5 kg bar at 5 V and gain 128 reads 429497. Channel B has no sensor and reads 0. No noise or drift: tare in your sketch.

Provenance: own model and behaviour from the public HX711 datasheet facts and the common bar-type load cell outline (about 80 x 12.7 x 12.7 mm). No vendor model, logo or art; the sketch fixtures are our own minimal readers (no HX711 library).
