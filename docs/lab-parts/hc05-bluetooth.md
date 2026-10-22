# HC-05 Bluetooth module

Protocol: `uart`. HC-05 serial-over-Bluetooth module on its breakout (6 pins: STATE RXD TXD GND VCC EN). RXD receives from the sketch, TXD sends to the sketch.

- Device (simulation): `apps/web/src/lab/sim/devices/hc05-bluetooth.ts` (serial helper: `apps/web/src/lab/sim/devices/serial/uart-link.ts`, shared with the GPS, not a device)
- Part (3D): `apps/web/src/lab/scene/parts/hc05-bluetooth.ts`
- Tests: `tests/lab-part-hc05-bluetooth.test.ts`, `tests/lab-rtc-comms.test.ts` (fixture `tests/fixtures/sketches/bt-terminal.ino`, a hand-written software UART)

## Fidelity

- Data mode: transparent pipe at the configured baud (popover, default 9600, 8N1). Sketch bytes go to the fake phone transcript while the phone is connected; a phone line (popover phrase plus send toggle, or `setInput(extInput('hc05-bluetooth',{line,ending}))`) goes out as real frames, 10 bits per byte, queued.
- Hardware serial (RXD on D1, TXD on D0): bytes come from the USART tap and go to the USART RX (the avr8js USART shifts them at the sketch's own baud; the module paces the queue at its baud). Any other pin: software UART, decoded from cycle-stamped edges (8N1, judged at the middle of the stop bit) and driven bit by bit. A baud mismatch with a software sketch gives garbage or framing errors, like a real bus.
- AT mode (EN high, 38400 baud, CR LF): AT, AT+VERSION?, AT+NAME?/=, AT+ADDR?, AT+UART?/=, AT+PSWD?/=, AT+PIN?/=, AT+ROLE?/=, AT+CMODE?/=, AT+STATE?, AT+ORGL, AT+RESET. Replies are `+KEY:value`, `OK`, `ERROR:(0)`. AT+UART= sets the data-mode baud.
- STATE pin follows the pairing; the LED blinks fast (waiting), slow (AT mode) or double (paired).
- Not modelled: the radio and the pairing handshake, the 3.3 V level of the RXD input (real hardware wants a divider from 5 V), the extra AT commands (inquiry, binding).
- Limit: on the hardware path the simulator does not tell the device the sketch's baud, so a mismatch is only visible on the software path.

## Provenance

Own work from the public behaviour of HC-05 modules. No vendor model, photo, logo or text. The floating phone is a stylised screen, not a real handset.
