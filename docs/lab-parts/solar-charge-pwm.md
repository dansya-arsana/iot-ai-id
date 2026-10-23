# PWM solar charge controller, 10 A, 12/24 V

Status: emulated (switch contact and charge state in the power solver)

- Device (simulation): `apps/web/src/lab/sim/devices/solar-charge-pwm.ts`
- Part (3D): `apps/web/src/lab/scene/parts/solar-charge-pwm.ts`
- Test: `tests/lab-part-solar-charge-pwm.test.ts`
- Catalog record: `packages/catalog/data/solar-charge-pwm.json`

## Provenance

- Datasheet: https://uk.renogy.com/cdn/shop/files/WND10-Datasheet.pdf (Renogy Wanderer 10A, WND10)
- Product page: https://www.renogy.com/products/wanderer-10a-pwm-charge-controller

## Behaviour

Pins PV+, PV-, BAT+, BAT-, LOAD+, LOAD- (screw terminals, wires only). BAT+ to LOAD+ is a contact that follows the low-voltage disconnect with hysteresis and the load-on toggle. PV to battery charging is NOT a contact (two ideal sources are never joined): state has chargeA, stage (night, bulk, absorb, float), pvV, batV, loadConnected and issue. The linked panel's irradiance and the linked pack's chemistry are read from the sibling parts' props.

## Battery compatibility

| Controller mode | LiFePO4 4S pack | Li-ion 3S pack |
|---|---|---|
| lfp | ok | issue 'chemistry' (not supported) |
| agm, gel, flooded | issue 'chemistry' (set LFP by hand) | issue 'chemistry' |

Pro M6 should raise the same check from the SystemSpec.

## Sources disagree

- [U] Set points (absorb / float / LVD / LVR) are typical 12 V values: agm 14.4/13.7, gel 14.2/13.7, flooded 14.6/13.7, lfp 14.4/13.5, LVD 10.7 / LVR 12.6 (lead-acid), 11.0 / 12.8 (lfp). Read the manual for the exact ones.
- [U] Common-negative versus common-positive switching: not read from the manual. Modelled as common-negative (PV-, BAT-, LOAD- one node). This matters for grounding an RS-485 or sensor negative: check the manual.
- [U] Temperature: datasheet -35 to +45 C, Renogy's own page says -25 C. Chosen: -35 to +45.
- Sealed/Gel/Flooded/LFP only; 12/24 V auto-detect is for non-lithium (set LFP by hand): [V] datasheet.

## Model origin

Own work from public specifications. No vendor 3D models, images or logos.
