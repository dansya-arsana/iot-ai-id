# NEO-6M GPS module

Protocol: `uart`. u-blox NEO-6M receiver on a GY-GPS6MV2 style breakout (4 pins: VCC RX TX GND). The module talks on TX, the sketch normally ignores RX.

- Device (simulation): `apps/web/src/lab/sim/devices/gps-neo6m.ts` (serial helper: `apps/web/src/lab/sim/devices/serial/uart-link.ts`)
- Part (3D): `apps/web/src/lab/scene/parts/gps-neo6m.ts`
- Tests: `tests/lab-part-gps-neo6m.test.ts`, `tests/lab-rtc-comms.test.ts` (fixture `tests/fixtures/sketches/gps-nmea.ino`)

## Fidelity

- Once per simulated second, 9600 baud 8N1 (popover can change the receiver baud): `$GPRMC`, `$GPVTG`, `$GPGGA`, `$GPGLL`, each with a real XOR checksum, CR LF terminated. Position is written as ddmm.mmmmm / dddmm.mmmmm from the popover latitude and longitude (default Jakarta -6.2088, 106.8456), altitude, speed and heading; speed above 0 moves the receiver along the heading from the popover point.
- No fix (toggle off): the empty forms the chip sends indoors (`$GPRMC,,V,,,,,,,,,,N*53`, `$GPGGA,,,,,,0,00,99.99,,,,,,*48`).
- UTC time starts at 2026-01-15 03:00:00 (10:00 in Jakarta) and follows simulated time. The LED is the PPS output: 100 ms per second while there is a fix.
- Serial: hardware (TX on D0) or a software UART on any pin with exact bit timing. Bytes the sketch sends to RX (u-blox configuration) are counted and ignored.
- Not modelled: GSA and GSV satellite sentences (the per-satellite data would be invented), the geoid separation field (left empty), cold start time to first fix, UBX binary, the configuration commands. HDOP is a simple function of the satellites popover value.

## Provenance

Own work from the public NMEA 0183 sentence layouts. No vendor model, photo, logo or code.
