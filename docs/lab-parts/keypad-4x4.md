# KEYPAD-4X4

Protocol: `switch` (the part drives pins the sketch reads), a matrix solved at net level.

- Device (simulation): `apps/web/src/lab/sim/devices/keypad-4x4.ts`
- Part (3D): `apps/web/src/lab/scene/parts/keypad-4x4.ts`
- Test: `tests/lab-part-keypad-4x4.test.ts`
- Pins: R1, R2, R3, R4, C1, C2, C3, C4 (desk prop: every pin takes a jumper from the ribbon header).

## Behaviour

- Layout: row 1 = 1 2 3 A, row 2 = 4 5 6 B, row 3 = 7 8 9 C, row 4 = * 0 # D.
- A pressed key is only a contact between its row line and its column line. The model builds the groups of lines the pressed keys join (union-find), then drives every line the sketch is not driving: it takes the level of a driven line in its group (LOW wins), otherwise it floats HIGH (the sketch's INPUT_PULLUP). Either scan direction works. The solver runs on every edge of any keypad pin and every tick, so `digitalWrite(row, LOW)` followed by `digitalRead(col)` sees the key at once.
- Up to three keys can be held from the popover. Three keys in an L make a fourth contact appear (ghost key, the pad has no diodes); `state.ghost` lists those keys and the part shows them amber.
- No contact bounce is modelled; a sketch that debounces still works, one that does not will see clean edges.
- State: `pressed` (comma list), `count`, `ghost`, `lowMask` (bit i = line i is LOW).

## Provenance

Own work from the public description of the common 16-key membrane keypad (69 x 77 mm, 15.5 mm key pitch, 8-pin header). No vendor models, art or code.
