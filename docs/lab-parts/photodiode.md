# photodiode

BPW34-class silicon photodiode on a 3-pin module with a load resistor.

## Behaviour

Current source: 70 uA per mW/cm2 at 940 nm, 2 nA dark current. V(SIG) = I x Rload, clamped to the supply. Irradiance = ir-led `emitMwSr` / distance^2 + ambient slider. adc() on SIG (A6/A7 work on the Nano).

## Notes

Tests: tests/lab-part-photodiode.test.ts. Power rating 3.3-5.5 V.

## Provenance

Model and device written by us from public datasheet behaviour (generic part class). No vendor models, photos, logos or libraries.
