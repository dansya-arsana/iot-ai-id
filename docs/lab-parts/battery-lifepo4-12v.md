# 12.8 V LiFePO4 battery

Status: emulated (a supply with a BMS cut-off)

- Device (simulation): `apps/web/src/lab/sim/devices/battery-lifepo4-12v.ts`
- Part (3D): `apps/web/src/lab/scene/parts/battery-lifepo4-12v.ts`
- Test: `tests/lab-part-battery-lifepo4-12v.test.ts`
- Catalog record: `packages/catalog/data/battery-lifepo4-12v.json`

## Provenance

- No single datasheet. Chemistry and BMS behaviour follow `battery-18650-pack` (4S LFP). Case sizes are retail classes [U].

## Behaviour

Pins P+ and P-. Props: ah (6, 12, 20, 50), soc, tempC. Supply is the 4S LFP open-circuit voltage; empty (UVP) removes the supply; cold (below 0 C) reports bms 'cold-charge'. Max current defaults to about 1 C of capacity [U]. Wh = 12.8 V x Ah.

## Sources disagree

- [U] Case sizes: 6 Ah about 151 x 65 x 94 mm, 12 Ah 151 x 98 x 95, 20 Ah 181 x 77 x 167, 50 Ah 229 x 138 x 208 (varies by maker). Chosen: these.
- [U] Maximum continuous current varies from 0.5 C to 2 C by maker. Chosen: about 1 C.
- The 3D terminal anchors are drawn for the 12 Ah case; other capacities change the body height only.

## Model origin

Own work from public specifications. No vendor 3D models, images or logos.
