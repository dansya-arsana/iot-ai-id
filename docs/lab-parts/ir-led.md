# ir-led

940 nm infrared emitter, 5 mm.

## Behaviour

Vf 1.3 V, radiant intensity 30 mW/sr at 50 mA, linear in current. Reports duty, the carrier frequency the sketch makes (38 kHz) and writes `emitMwSr` into its own props for sibling photodiodes. Flags pin overload above 40 mA. Light is invisible: the 3D glow is a faint camera-view violet.

## Notes

Tests: tests/lab-part-ir-led.test.ts.

## Provenance

Model and device written by us from public datasheet behaviour (generic part class). No vendor models, photos, logos or libraries.
