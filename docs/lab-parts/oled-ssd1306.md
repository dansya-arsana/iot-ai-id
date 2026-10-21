# OLED-SSD1306

Protocol: `i2c` (an I2C slave: the sketch talks to it with Wire (address 0x40, register 0 = value)).

- Device (simulation): `apps/web/src/lab/sim/devices/oled-ssd1306.ts`
- Part (3D): `apps/web/src/lab/scene/parts/oled-ssd1306.ts`
- Test: `tests/lab-part-oled-ssd1306.test.ts`
- Pins: VCC, SDA, SCL, GND

Models the SSD1306 command set and the I2C control-byte framing from the public controller datasheet: addressing modes, column/page windows, contrast, invert, remap. The 128x64 frame buffer is composed from the bytes the sketch really sends. Provenance: own work, no vendor art, photos or logos.
