# Tipping-bucket rain gauge

Protocol: `gpio` (switch template, desk prop). Emulated.

- Device: `apps/web/src/lab/sim/devices/rain-gauge-tipping.ts`
- Part: `apps/web/src/lab/scene/parts/rain-gauge-tipping.ts`
- Test: `tests/lab-part-rain-gauge-tipping.test.ts`
- Catalog record: `packages/catalog/data/rain-gauge-tipping.json`
- Pins: SIG, GND (the two reed leads, no holes)

Model: one momentary closure per 0.2794 mm of rain (SparkFun SEN-15901, https://cdn.sparkfun.com/assets/d/1/e/0/6/DS-15901-Weather_Meter.pdf), prop `mmPerTip` for gauges with 0.2, 0.3 or 0.5 mm. The line idles HIGH (INPUT_PULLUP) and a closure pulls SIG LOW for 100 ms with one or two bounce pairs (2 or 4 extra edges) in the first millisecond, cycle-exact through `ctx.drive`. Inputs: `rate` mm/h (0-150, turned into tips over simulated time, one closure at a time) and a momentary `tip`. State: closed, tips, mm, lastTipS, rate.

## Sources disagree

- Closure length: the datasheet only says "momentary". 100 ms is OUR assumption (`CLOSURE_MS`) [U].
- Bounce: 2 or 4 extra edges inside 1 ms is our model of a reed, not a datasheet value [U].
- Funnel size: listings say 110-130 mm wide and about 90 mm tall [U]; we use 120 x 90 (https://core-electronics.com.au/weather-meter-kit.html).
- RJ11 pinout of the SEN-15901 cable is not modelled: the two reed leads are exposed as SIG and GND.

## Field notes

Level the funnel, keep leaves out of it, debounce 20-50 ms, and count on an interrupt pin. At 1 mm/h the bucket tips about once every 12.9 minutes.

Provenance: own work from public datasheet behaviour; no vendor models, photos or logos.
