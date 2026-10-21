# ESP32-DEVKIT

Protocol: `gpio` (a digital input the sketch drives (an indicator): the device watches one pin).

- Device (simulation): `apps/web/src/lab/sim/devices/esp32-devkit.ts`
- Part (3D): `apps/web/src/lab/scene/parts/esp32-devkit.ts`
- Test: `tests/lab-part-esp32-devkit.test.ts`
- Pins: none (desk prop)

## Status

Visual and pin map only. `runtime:'not-emulated'` (device def and state): the lab emulator is AVR only, ESP32 code does not run in the browser.

Provenance: own model from the public Espressif DevKitC V4 drawing dimensions (board 54.4 x 27.9 mm, 2.54 mm pitch, rows 25.4 mm apart) and the WROOM-32 datasheet pin table. No vendor models, photos or logos.
