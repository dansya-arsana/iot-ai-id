# ESP-01 (ESP8266 module)

Protocol: `uart`. An AT-command shell on the serial pins, signal level: bytes are paced at the baud rate (9600 or 115200, 10 bits per byte), so a sketch reading them with `Serial` sees realistic timing.

- Device: `apps/web/src/lab/sim/devices/esp-01.ts`
- Part (3D): `apps/web/src/lab/scene/parts/esp-01.ts`
- Test: `tests/lab-part-esp-01.test.ts`
- Pins: VCC, TX, RX, GND, CH_PD, RST, GPIO0, GPIO2 (all wire-only terminals, the 2x4 header does not fit across the breadboard gap)

## Behaviour

- Answers only when VCC reads 2.7-3.9 V and CH_PD is high. A floating CH_PD keeps it silent, like the real chip. Wired to 5 V it is silent and the power notice warns (rating 3.0-3.6 V).
- Echo is on by default (`ATE0` / `ATE1`). A command ends with CR; the module replies `CR CR LF` (echo) then the answer.
- `AT`, `AT+GMR`, `AT+CWMODE?` / `=1|2|3` (also `_CUR`, `_DEF`), `AT+RST` (OK, then `ready`), `AT+CWLAP`, `AT+CWJAP`, `AT+CIFSR`. Anything else returns `ERROR`.
- Honest limits: there is no Wi-Fi. `AT+CWLAP` lists nothing, `AT+CWJAP` always fails with code 3, `AT+CIFSR` gives 0.0.0.0. State reports `wifi:'none'`. RST, GPIO0 and GPIO2 are drawn and wireable but boot modes are not modelled.

## Provenance

Own work from the public Espressif AT instruction set behaviour and the module outline (24.75 x 14.5 mm). No vendor models, photos or logos.
