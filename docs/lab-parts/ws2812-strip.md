# ws2812-strip

Protocol: `ws2812`. WS2812 LEDs: 8 LED stick, 16 LED ring, 8x8 matrix (popover `shape`: strip, ring, matrix).

- Device (simulation): `apps/web/src/lab/sim/devices/ws2812-strip.ts`
- Part (3D): `apps/web/src/lab/scene/parts/ws2812-strip.ts`
- Test: `tests/lab-part-ws2812-strip.test.ts`

Pins: VCC, DIN, GND (screw-free pigtail, wires only).

Signal: 800 kHz NZR, T0H 0.4 us, T1H 0.8 us (+-150 ns), GRB, MSB first, 24 bits per LED, low >= 50 us latches. The decoder reads every high pulse from cycle-stamped edges; `timingErrors` counts pulses outside the window. The chain keeps the first 8, 16 or 64 pixels of a longer stream, like a real first-LED-eats-24-bits chain. State: shape, count, leds (rrggbb per LED), frames, timingErrors, ma (estimate, 20 mA per full channel).

Geometry (typical public outlines, our own model): stick 51 x 10 mm, 5050 packages at 6.35 mm; ring 44.5 mm outside / 31.7 mm inside, 16 LEDs clockwise from 12 o'clock; matrix 71 x 71 mm, 8.6 mm pitch, row-by-row numbering (no serpentine).

Tests: `tests/lab-part-ws2812-strip.test.ts`, with the real-firmware fixture `tests/fixtures/sketches/ws2812-strip-64.ino` (our own bit-bang driver, no library).

Provenance: own model and own code, written from the public datasheet behaviour of the part family; no vendor models, photos, logos or GPL code. Screenshot: `/lab/parts/ws2812-strip`.
