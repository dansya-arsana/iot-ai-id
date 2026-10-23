# Diaphragm water pump 12 V (R385)

Protocol: `gpio` (desk prop, linked load). Emulated through the power solver. The relay channel is the existing `relay-module` kind (COM to the 12 V source, NO to the pump +).

- Device: `apps/web/src/lab/sim/devices/pump-12v-r385.ts`
- Part: `apps/web/src/lab/scene/parts/pump-12v-r385.ts`
- Test: `tests/lab-part-pump-12v-r385.test.ts` (includes the relay chain)
- Catalog record: `packages/catalog/data/pump-12v-r385.json`
- Pins: +, - (motor leads, no holes)

Values used (middle of the ranges, see below): 6-12 V, starts above 3 V, flow rising linearly to 1.5 L/min at 12 V, 0.6 A loaded and 0.23 A no-load at 12 V (both scale with v/12), start surge 2 A at 12 V for 100 ms, about 90 x 40 x 35 mm. Input `primed`: an unprimed pump only moves air (no flow, no-load current, dry seconds count, overheated flag after 30 s).

## Design notes (Pro checks)

- Size the relay, the fuse and the supply for the 2 A start surge, not the 0.6 A running current. The SRD-05VDC relay contact is rated 10 A, fine.
- Add a flyback diode across the motor.
- Not submersible: mount it above the water line, hose primed.
- A 3.3 V IN level may not switch a low-level-trigger opto relay board reliably: power the relay VCC from 5 V and check the trigger level, or use a logic-level MOSFET.

## Sources disagree

Vendor sheets for "R385 6-12 V" pumps disagree [U]:
- Loaded current 0.5-0.7 A at 12 V (we use 0.6), no-load about 0.23 A, surge "up to about 2 A" (the 100 ms length is our assumption).
- Flow 1.5-2 L/min (range 1-3); we use 1.5.
- Suction about 2 m, lift about 3 m, barbs 6 mm ID / 8.5 mm OD, liquid up to 80 C, life about 2500 h, size about 90 x 40 x 35 mm.
Sources: https://robotshop.com/en/6-12v-r385-dc-diaphragm-pump.html , https://www.electrokit.com/en/vattenpump-6-12v-med-slang , https://kitronik.co.uk/products/2567-water-pump-6v-12v-with-1m-silicone-tube , https://www.thingbits.in/products/r385-6-12v-dc-mini-diaphragm-pump

Provenance: own work from public vendor behaviour; no vendor models, photos or logos.
