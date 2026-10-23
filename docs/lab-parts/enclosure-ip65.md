# IP65 junction box with cable glands

Status: model-only (runtime 'not-emulated'; no pins)

- Device (simulation): `apps/web/src/lab/sim/devices/enclosure-ip65.ts`
- Part (3D): `apps/web/src/lab/scene/parts/enclosure-ip65.ts`
- Test: `tests/lab-part-enclosure-ip65.test.ts`
- Catalog record: `packages/catalog/data/enclosure-ip65.json`

## Provenance

- IP65 = dust-tight and protected against water jets, IEC 60529 [K].
- Hammond 1554 example: https://uk.farnell.com/hammond/1554x2gysl/enclosure-pc-200mmx300mmx200mm/dp/3649408 and https://uk.rs-online.com/web/p/general-purpose-enclosures/2291109

## Exports for Pro

`ENCLOSURE_SIZES` (150x110x70, 200x120x75, 250x150x100, 300x200x90 mm) and `GLAND_RANGES` (pg7 3-6.5 mm, pg9 4-8, m16 4-8, m20 6-12), `cableFits()`. M6 can check cable OD within the gland range and glands on the bottom face only. The lid and wall groups carry `userData.section=true` (a convention proposal: no core reads it yet).

## Sources disagree

- [U] Generic ABS sizes (retail) versus the Hammond 1554 polycarbonate (IP66/IP68). Default 200 x 120 x 75.
- [U] Gland clamping ranges are typical, no gland maker's sheet cited. Chosen: the values above.
- Not emulated: a housing only.

## Model origin

Own work from public specifications. No vendor 3D models, images or logos.
