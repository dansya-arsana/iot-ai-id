# slide-switch

SPDT slide switch (SS12D00-style, 8.6 x 3.6 x 3.5 mm can).

## Behaviour

Mechanical contact only. COM (middle leg) touches throw A or B, never both. `switches()` declares COM-A / COM-B so linked parts see it. When COM is on a board pin, it reads the level of the chosen throw (volts above 2.5 V = HIGH).

## Notes

Popover toggle `toB`. Tests: tests/lab-part-slide-switch.test.ts.

## Provenance

Model and device written by us from public datasheet behaviour (generic part class). No vendor models, photos, logos or libraries.
