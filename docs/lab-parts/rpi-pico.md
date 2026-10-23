# RPI-PICO

Protocol: `gpio` (a digital input the sketch drives (an indicator): the device watches one pin).

- Device (simulation): `apps/web/src/lab/sim/devices/rpi-pico.ts`
- Part (3D): `apps/web/src/lab/scene/parts/rpi-pico.ts`
- Test: `tests/lab-part-rpi-pico.test.ts`
- Pins: none (desk prop)

## About

Model only: the lab emulates AVR only.

- 40 edge pins + 3 SWD pads (`SWCLK`, `GND_D`, `SWDIO`). Wire names `GPn`, `GND_p`, `RUN`, `ADC_VREF`, `3V3_OUT`, `3V3_EN`, `VSYS`, `VBUS`.
- Alt functions are computed by `picoFunctions(n)` (SPI, UART, I2C, PWM); the unit test matches 6 rows typed from the RP2040 datasheet.
- Prop `variant`: pico | pico-w | pico2 (Pico W LED is on the Wi-Fi chip; Pico 2 pinout is the same). GPIO is 3.3 V, not 5 V tolerant. VSYS 1.8 to 5.5 V.

Catalog record: `packages/catalog/data/rpi-pico.json` (field-level provenance).

## Provenance

Our own simplified model written from public datasheets and mechanical drawings; no vendor 3D models, photos, logos or code.

## Sources disagree / unconfirmed

- Source: https://datasheets.raspberrypi.com/pico/pico-datasheet.pdf , https://datasheets.raspberrypi.com/rp2040/rp2040-datasheet.pdf (2.19.2)
- [U] The six reference rows in the test were derived by hand from the function table, not re-read from the PDF; confirm them once.
- [U] Pico 2 (RP2350) function table differs slightly; the variant prop only changes the label for now.
- [U] Typical and peak current (25 and 100 mA) are estimates.
