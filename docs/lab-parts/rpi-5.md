# RPI-5

Protocol: `gpio` (a digital input the sketch drives (an indicator): the device watches one pin).

- Device (simulation): `apps/web/src/lab/sim/devices/rpi-5.ts`
- Part (3D): `apps/web/src/lab/scene/parts/rpi-5.ts`
- Test: `tests/lab-part-rpi-5.test.ts`
- Pins: none (desk prop)

## About

Model only: lint-checked, never run here.

- On Pi 5 the legacy `RPi.GPIO` does not work. Use `gpiozero`/`lgpio` (or `rpi-lgpio`); `spidev` and `smbus2` are unchanged (important for Pro code generation).
- Same 40-pin header and wire names as `rpi-4b` (imported `RPI_HEADER`). 5 V / 5 A USB-C PD; on a 3 A supply the USB ports are limited to 600 mA total.
- The header GPIO is driven by RP1, not the SoC.

Catalog record: `packages/catalog/data/rpi-5.json` (field-level provenance).

## Provenance

Our own simplified model written from public datasheets and mechanical drawings; no vendor 3D models, photos, logos or code.

## Sources disagree / unconfirmed

- Source: https://datasheets.raspberrypi.com/rpi5/raspberry-pi-5-product-brief.pdf , https://datasheets.raspberrypi.com/rpi5/raspberry-pi-5-mechanical-drawing.pdf , https://datasheets.raspberrypi.com/rp1/rp1-peripherals.pdf
- [U] `RP1_ALT` lists only the documented header-default functions (matching the Pi 4), NOT the full a0..a8 FUNCSEL table. Full table still to fill from the RP1 datasheet (GPIO bank 0).
- [U] Ethernet/USB positions are mirrored from the Pi 4 model as an approximation; read them off the mechanical drawing.
- [U] Typical and peak current (800 and 5000 mA) are estimates.
