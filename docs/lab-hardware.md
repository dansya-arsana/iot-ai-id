# Lab: simulator to real UNO (desktop only)

The `/lab` page shows a "Real board" panel only when it runs on the local API (the desktop app or `127.0.0.1`) and at desktop widths (hidden on the mobile layout). On the public host it shows a note pointing to the desktop app. `/api/lab/hardware/*` is part of the loopback-only, session-gated `/api`, so it is not reachable from the public host.

## Flow

1. `GET /api/lab/hardware/detect` lists UNO boards (`arduino-cli board list`, FQBN `arduino:avr:uno` or UNO/CH340/FTDI VID:PID).
2. The human clicks "Authorize this port for 20 minutes" -> `POST /api/lab/hardware/trust`. This writes the same trusted-port map that `POST /api/runtime/trust` uses, but accepts UNO ports (the existing route only accepts the ESP32 candidates). Nothing is uploaded or read without it.
3. "Upload" sends the exact flash bytes the simulator runs (base firmware plus patched params). The server converts them to Intel HEX and runs `arduino-cli upload --input-file`, with no recompile, so sim and board run identical bytes.
4. Serial at 9600 is read with `arduino-cli monitor` and polled by the page. Sim and board lines are shown side by side with timestamps.
5. The match indicator compares the last 8 lines: same line shapes, then same period (median gap, +-10%) or same value (+-10%). It reports "behaves the same" or "differs: ... check wiring on D8".

Errors (busy port, unplugged board, missing arduino-cli or AVR core, upload failure) are mapped to EN/ID messages.

## Automated tests

- `tests/lab-hardware.test.ts`: server route with a fake bridge (trust gate, expiry, hex bytes, error mapping, serial, board-list parsing, match logic).
- `tests/e2e/25-lab-hardware.spec.ts`: mocked bridge responses, detection to match, plus the public-host check.

## Manual checklist (needs a real UNO)

- [ ] Plug in a UNO: panel says "UNO on /dev/cu.usbmodem... detected".
- [ ] Upload is disabled until "Authorize" is clicked; after 20 minutes it is refused again.
- [ ] Upload blink: the D8 LED blinks at the same rate as the simulator; match says "behaves the same".
- [ ] Change the on/off time in the lab, upload again: the board follows the new value.
- [ ] Unplug during serial: "The board was unplugged" appears.
- [ ] Open the Arduino IDE serial monitor on the port, then upload: "The port is busy".
- [ ] Rename `arduino-cli` out of PATH: "Arduino toolchain not found".
- [ ] Move the LED wire off D8: match says "differs ... check wiring on D8".
