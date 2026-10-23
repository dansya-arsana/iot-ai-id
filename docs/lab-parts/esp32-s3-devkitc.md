# ESP32-S3-DEVKITC

Protocol: `gpio` (a digital input the sketch drives (an indicator): the device watches one pin).

- Device (simulation): `apps/web/src/lab/sim/devices/esp32-s3-devkitc.ts`
- Part (3D): `apps/web/src/lab/scene/parts/esp32-s3-devkitc.ts`
- Test: `tests/lab-part-esp32-s3-devkitc.test.ts`
- Pins: none (desk prop)

## About

Model only: ESP32 code does not run in the browser.

- 44 pins: J1 1-22 and J3 1-22. Wire names `GPIOn`, `3V3_1`, `3V3_2`, `RST`, `5V`, `G_1..G_4`, `TX` (GPIO43), `RX` (GPIO44).
- Props `module` (n8 | n8r8 | n16r8 | n32r16v, default n8r8: GPIO35-37 are flash/PSRAM on octal modules, see `s3Pins(module)`) and `usb` (micro | c).
- Use one power input at a time. GPIO is 3.3 V. Strapping pins: 0, 3, 45, 46. ADC2 does not work while Wi-Fi is on.

Catalog record: `packages/catalog/data/esp32-s3-devkitc.json` (field-level provenance).

## Provenance

Our own simplified model written from public datasheets and mechanical drawings; no vendor 3D models, photos, logos or code.

## Sources disagree / unconfirmed

- Source: https://docs.espressif.com/projects/esp-dev-kits/en/latest/esp32s3/esp32-s3-devkitc-1/user_guide_v1.1.html , https://www.espressif.com/sites/default/files/documentation/esp32-s3_datasheet_en.pdf , https://dl.espressif.com/dl/PCB_ESP32-S3-DevKitC-1_V1_20210312CB.pdf
- [U] Header row spacing (22.86 mm assumed) and pin-1 offset: not read from the v1.1 dimension PDF.
- [U] The pin list comes from the brief (marked [V]); it was not re-read against the user guide page.
- [U] Typical and peak current (80 and 500 mA) are estimates.
