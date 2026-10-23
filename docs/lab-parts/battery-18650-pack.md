# 18650 battery pack with BMS (chem prop)

Status: emulated (a supply with a BMS cut-off)

- Device (simulation): `apps/web/src/lab/sim/devices/battery-18650-pack.ts`
- Part (3D): `apps/web/src/lab/scene/parts/battery-18650-pack.ts`
- Test: `tests/lab-part-battery-18650-pack.test.ts`
- Catalog record: `packages/catalog/data/battery-18650-pack.json`

## Provenance

- Brief: docs/research/pro-parts-briefs.md Group F (F3). Cell references: IFR18650 class LFP (about 1.5 Ah) and Samsung INR18650-35E (3.4 Ah, 2.65-4.2 V, 8 A). No cell datasheet was fetched or cited by URL.

## Behaviour

Pins P+ and P-. Props: chem (lfp-4s default, liion-3s), parallel 1-4, bmsA, soc, tempC. OCV curves are piecewise, LFP is flat 3.2-3.3 V per cell from 20 to 90 %. BMS under-voltage opens the output (no supply); state bms is ok, uvp or cold-charge (LFP below 0 C). ovp and ocp are not simulated. Wh = nominal V x Ah x parallel. Size: cells lie side by side, 18.4 x 65.2 mm each, plus 5 mm for the BMS plate.

## Sources disagree

- [U] LFP cell capacity: 1.1 Ah (A123 APR18650M1B) to about 1.8 Ah (IFR18650 makers). Chosen: 1.5 Ah.
- [U] BMS cut-offs: LFP over 3.65-3.75 V and under 2.5 V per cell, Li-ion 4.25 V and 2.8 V. Typical values, no BMS sheet.
- [U] The 10 A BMS limit default is a typical choice, not a cell rating.
- Fuse P+ within 10 cm of the pack.

## Model origin

Own work from public specifications. No vendor 3D models, images or logos.
