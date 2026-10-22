# TM1637-4DIGIT

Protocol: `twowire`. A custom clocked two-wire bus (not I2C): the MCU drives CLK, DIO is bidirectional open drain, bytes go out LSB first, no address byte.

- Device (simulation): `apps/web/src/lab/sim/devices/tm1637-4digit.ts`
- Part (3D): `apps/web/src/lab/scene/parts/tm1637-4digit.ts`
- Test: `tests/lab-part-tm1637-4digit.test.ts` (fake-board bus tests plus the real sketch `tests/fixtures/sketches/tm1637-display.ino`)
- Pins, in module order: CLK, DIO, VCC, GND (breadboard legs)

## What is simulated

- Framing: START is DIO falling while CLK is high, STOP is DIO rising while CLK is high (`TwoWireSlave`). The chip pulls DIO low from the falling edge of the 8th clock to the falling edge of the 9th (ACK) after every byte.
- Command classes by the top two bits: `0x40` data command (`0x40` write with auto increment, `0x44` fixed address, `0x42` key scan read), `0x80 | on<<3 | brightness` display control, `0xC0 | address` address command followed by display bytes in the same frame. Address 0..5 (six grids, the module wires four); the register wraps 5 to 0 in auto mode and takes one data byte per address command in fixed mode. Reserved patterns and addresses 6 and 7 are counted as `invalid`, extra bytes as `ignored`.
- Brightness uses the datasheet pulse widths 1, 2, 4, 10, 11, 12, 13, 14 of 16 (`state.duty`); the display control `on` bit gates everything. Nothing lights before the sketch sends a display control byte.
- Segment bytes: bit 0..6 = A..G, bit 7 = DP. On the clock layout the DP of digit 2 is the colon, on the decimal layout all four DPs are dots (popover choice). `state.text` decodes the digits from the segment bytes (derived, not stored).
- Key scan: after `0x42` and the ACK the chip puts the key byte on DIO LSB first, bit 0 at the falling edge that ends the ACK, one more bit per falling clock edge. 0xFF = no key; K1 clears bit 3, K2 clears bit 4, the low three bits count 7..0 for SG1..SG8. The common module has no keys; the `key` popover input (0 = none, 1..16) exists to exercise the read.

## Limits

- The clock has no maximum frequency check (the datasheet allows up to 500 kHz; the simulated sketches are far slower).
- Test mode (bit 3 of the data command) is accepted and ignored.
- The module is drawn standing on its header at the bottom edge so it plugs into the breadboard; the real board has the header on its short side.

## Provenance

Own work from the public TM1637 datasheet behaviour (command set, ACK timing, brightness table, key scan table). The module is modelled from dimensions only (42 x 24 mm board, 0.56 in digits, about 30 x 14 mm window); no vendor art, photos or logos. The fixture sketch contains our own driver, no library.
