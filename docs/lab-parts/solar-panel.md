# Solar panel 10 W / 20 W (12 V class)

Status: emulated (a source for the power solver; simple model)

- Device (simulation): `apps/web/src/lab/sim/devices/solar-panel.ts`
- Part (3D): `apps/web/src/lab/scene/parts/solar-panel.ts`
- Test: `tests/lab-part-solar-panel.test.ts`
- Catalog record: `packages/catalog/data/solar-panel.json`

## Provenance

- 20 W reference: https://www.acopower.com/products/hy-12m-20w (Vmp 17.5 V, Imp 1.14 A, Voc 21.6 V, Isc 1.23 A, 345 x 470 x 20 mm).
- Indonesian retail spec listing: https://www.tokopedia.com/indosunergy/usa-renogy-20w-12v-solar-panel-rv-marine-boat-and-hazard-area
- Background: https://oe2.open-electronics.org/?p=45146

## Behaviour

Isc is proportional to sunlight; Voc = Voc_stc + 1.2 V x ln(irr/1000) (36 cells), 0 V below 5 W/m2. Pins PV+ and PV-. Inputs: rating (10 or 20 W), sunlight, tilt. Tilt guidance (10-15 degrees at about 6 degrees south latitude, facing north, for self-cleaning) is general guidance [K], no PV tilt source cited.

## Sources disagree

- [U] 20 W size: 345 x 470 x 20 mm (ACOPOWER) versus 340 x 429 x 25 mm (Renogy-style listing). Chosen: 470 x 345 x 20.
- [U] 10 W figures (about 18 V / 0.56 A, 340 x 230 mm, Isc 0.6 A) come from retail class values, no single sheet. Chosen: those.
- [U] Voc 21.6 to 22 V. Chosen: 21.6.

## Model origin

Own work from public specifications. No vendor 3D models, images or logos.
