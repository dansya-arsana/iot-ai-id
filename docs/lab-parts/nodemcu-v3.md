# NodeMCU v3 (ESP8266 dev board)

Protocol label: `gpio`, but the model is `runtime:'not-emulated'`: it is a visual and pin-map reference only. The lab emulator is AVR only, so ESP8266 firmware does not run and no pin activity is faked. State reports `{runtime:'not-emulated',pinCount:30}`.

- Device: `apps/web/src/lab/sim/devices/nodemcu-v3.ts`
- Part (3D): `apps/web/src/lab/scene/parts/nodemcu-v3.ts`
- Test: `tests/lab-part-nodemcu-v3.test.ts`
- Pins: 30, in physical order with the D0-D8 to GPIO mapping, A0 (0-1 V), RSV and flash pins flagged. Board about 58 x 31 mm, rows 27.94 mm apart (LoLin style).

## Provenance

Own work from the public pinout and board outline. No vendor models, photos or logos. Pins are 3.3 V logic; no power rating is declared because nothing is simulated.
