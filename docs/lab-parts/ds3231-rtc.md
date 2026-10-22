# DS3231 clock (RTC)

Protocol: `i2c`. DS3231 real-time clock on a ZS-042 style breakout (6 pins: 32K SQW SCL SDA VCC GND) with the AT24C32 EEPROM that shares the board.

- Device (simulation): `apps/web/src/lab/sim/devices/ds3231-rtc.ts`
- Part (3D): `apps/web/src/lab/scene/parts/ds3231-rtc.ts`
- Tests: `tests/lab-part-ds3231-rtc.test.ts` (exact registers and cycle times), `tests/lab-rtc-comms.test.ts` (real firmware, fixture `tests/fixtures/sketches/rtc-ds3231.ino`)

## Fidelity

- I2C 0x68. Registers 0x00-0x06 are BCD time (24 h, or 12 h with the AM/PM bit), day of week 1-7 that counts up at midnight, date, month with the century bit, year. 16 000 000 CPU cycles are one second of clock; the chip freezes a copy of the time at every START, so a burst read cannot tear. Writing the time sets the clock when the transfer ends.
- Alarm 1 (0x07-0x0A, seconds resolution) and alarm 2 (0x0B-0x0D, checked when seconds roll to 00), A1Mx/A2Mx mask bits, DY/DT day-or-date. A1F/A2F set on a match and only clear by writing 0. With INTCN=1 and AxIE=1 the SQW/INT pin goes low (open drain, released = high) until the flag is cleared.
- Control 0x0E (power-up 0x1C), status 0x0F (OSF set until software clears it; the popover can pretend the battery died), aging 0x10 (stored), temperature 0x11/0x12 in 0.25 degC steps from the popover.
- INTCN=0: square wave on SQW at 1 Hz, 1.024 kHz, 4.096 kHz or 8.192 kHz from the RS bits, scheduled edge by edge in CPU cycles.
- AT24C32 at 0x57: 4096 bytes, two address bytes (high first), 32-byte pages that wrap inside the page, 0xFF when erased, sequential reads wrap at the end. After a write transfer the chip is busy for 5 ms and does not ACK its address, so `beginTransmission/endTransmission` ACK polling works. A transfer that only sets the address starts no write cycle. The device registers a second I2C slave from `create()` for it (`ctx.env.attachI2c`).
- Not modelled: the 32.768 kHz output wave (the 32K pin idles high), the 64 s temperature conversion and BSY, the oscillator-stop behaviour on VCC loss, the A0-A2 address pads of the EEPROM (fixed 0x57), the trickle charger of the module.

## Notes for sketch authors

- The clock starts at 2026-01-15 10:00:00 and OSF is set at power-up, like a module whose battery was just inserted. `RTClib`-style code (`lostPower()` then `adjust()`) works; the repo does not ship that library, write the few register writes yourself.

## Provenance

Own work from the public DS3231 and AT24C32 datasheet behaviour. No vendor model, photo, logo or code. Board dimensions (about 22 x 38 mm) and the 20 mm coin-cell holder come from the dimensions of common modules; the `CR2032` marking is a generic cell type name.
