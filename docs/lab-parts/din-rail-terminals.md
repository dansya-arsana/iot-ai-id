# DIN rail with 6 feed-through terminal blocks

Status: emulated (wiring continuity in the net solver)

- Device (simulation): `apps/web/src/lab/sim/devices/din-rail-terminals.ts`
- Part (3D): `apps/web/src/lab/scene/parts/din-rail-terminals.ts`
- Test: `tests/lab-part-din-rail-terminals.test.ts`
- Catalog record: `packages/catalog/data/din-rail-terminals.json`

## Provenance

- TS35 rail 35 x 7.5 mm (IEC 60715) [K]. Block ratings are the class values of a 2.5 mm2 grey block (Phoenix Contact UT 2,5, item 3044076): 5.2 mm pitch, 800 V, 24 A, 0.14-4 mm2 [U]. No sheet was fetched.

## Behaviour

Pins T1A..T6B. Each block joins its A and B side. Prop `bridge` (none, 1-2, 1-3, all) adds a jumper bar that joins the A sides of neighbouring blocks into one rail. No voltage drop or heating is simulated. `RATED` is exported for Pro fuse and wire checks. The 3D blocks are drawn 3x wider than the real 5.2 mm pitch so the pins are readable.

## Sources disagree

- [U] Rated current and voltage differ by block family (16 A to 32 A). Chosen: 24 A / 800 V.

## Model origin

Own work from public specifications. No vendor 3D models, images or logos.
