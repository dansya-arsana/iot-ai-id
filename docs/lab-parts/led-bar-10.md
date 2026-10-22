# led-bar-10

10-segment LED bar graph (25.4 x 10 x 5 mm housing, 2.54 mm pitch).

## Behaviour

Ten LEDs, A1..A10 each driven by a pin. The real part has ten cathode pins; this model joins them into one pin K so it fits one breadboard row (documented simplification). Current = duty x (5 V - Vf - Vk) / R, Vf per colour, over-current above 20 mA per segment.

## Notes

State: s1..s10 brightness, lit, level (unbroken from segment 1), totalMa, over. Tests: tests/lab-part-led-bar-10.test.ts.

## Provenance

Model and device written by us from public datasheet behaviour (generic part class). No vendor models, photos, logos or libraries.
