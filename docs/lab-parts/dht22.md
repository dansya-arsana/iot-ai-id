# DHT22 (AM2302)

Protocol: `onewire`. The proof module of the platform: the device model is the real single-wire timing, not a shortcut.

- Device (simulation): `apps/web/src/lab/sim/devices/dht22.ts`
- Part (3D): `apps/web/src/lab/scene/parts/dht22.ts` (white grille body, grille slots glow green while the sensor talks)
- Tests: `tests/lab-dht22.test.ts` (frame, timing, real firmware), `tests/e2e/26-lab-dht22.spec.ts`
- Lesson: "12 · Read temperature & humidity" (`dht`, sketch `firmware/sketches/dht-default`)
- Pins: VCC, DATA, NC, GND (breadboard holes 0..3). Wired lesson: DATA to D2 plus a 10k pull-up to 5V.

Timing (datasheet): host holds DATA low at least 1 ms (we send 18 ms) and releases. About 30 us later the sensor pulls low 80 us, high 80 us, then 40 bits MSB first. Every bit is a 50 us low followed by a high of 26-28 us (0) or 70 us (1). Bytes: humidity x10 (2 bytes), temperature x10 (2 bytes, MSB = sign), checksum (low byte of the sum of the first four). The line is released after a final 50 us low.

Inputs (popover): `tempC` -40..80 step 0.5, `humidity` 0..100 step 1.

Provenance: model and reader are our own work from the public datasheet timing. The sketch is a minimal bit-banged reader, no DHT library, so there is no GPL or LGPL code in the lesson.
