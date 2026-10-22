# MAX7219 LED matrix

Protocol: `spi`. An 8x8 red LED matrix module driven by a MAX7219 chip (32 x 32 mm per matrix, 3.75 mm dot pitch). The popover picks one module or a chain of four (the common FC-16 board, 128 x 32 mm). Pins: VCC, GND, DIN (to MOSI D11), CS (LOAD, any pin), CLK (to SCK D13). Desk prop; DOUT is only drawn.

- Device (simulation): `apps/web/src/lab/sim/devices/max7219-matrix.ts`
- Part (3D): `apps/web/src/lab/scene/parts/max7219-matrix.ts`
- Test: `tests/lab-part-max7219-matrix.test.ts` (unit tests plus a real-firmware four-module chain, fixture `tests/fixtures/sketches/max7219-chain.ino`)

## Fidelity

- 16-bit words: address D11..D8, data D7..D0. The chain is modelled as a byte queue of 2 x modules bytes, so the first word sent lands in the farthest chip and a frame shorter than the chain leaves the other chips with stale shift-register data (the real quirk). LOAD (CS) rising latches every chip at once; nothing changes before that.
- Registers: 0x00 no-op (use it to address one chip), 0x01-0x08 digit 0-7 (one matrix row each, bit 7 = left-most dot), 0x09 decode mode (Code B for the digits whose bit is set: glyphs 0-9, -, E, H, L, P, blank, bit 7 = decimal point), 0x0A intensity (duty (2i+1)/32), 0x0B scan limit, 0x0C shutdown (power-up: shut down), 0x0F display test (all dots on at 31/32 duty).
- Brightness shown is duty x 8/(scan limit + 1), capped at 1, so a short scan limit looks brighter, as on the bench.
- SPI mode: data is sampled on the rising edge MSB first, so modes 0 and 3 work. Modes 1 and 2 see every bit a half clock late (bytes shifted one bit), an LSB-first master sends reversed bits: both are modelled and counted in `badFrames`.
- State: `fb` (the rows actually lit, 16 hex digits per module), `lum` (apparent brightness per module), the raw registers and counters (`latches`, `words`, `partial` = the last frame was not a whole number of words per chip).

## Not modelled

- DOUT of the last chip, the ISET resistor / segment current, multiplexing flicker, the MAX7221 variant. The digit registers are undefined on a real chip at power-up; here they start at 0. Module orientation differs between vendors (rows and columns can be swapped or mirrored); the model uses digit = row, bit 7 = left.
- Power: 4.0-5.5 V (`power` rail VCC/GND).

## Provenance

Own work from the public Maxim MAX7219/MAX7221 datasheet behaviour. The sketch driver in the fixture is our own. No vendor model, photo or logo.
