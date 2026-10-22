# NTC thermistor (10k, B3950)

Protocol: `adc`. A module with the 10k bead on two leads and a series resistor (default 10k, popover 1k to 100k).

- Device: `apps/web/src/lab/sim/devices/ntc-thermistor.ts`; part: `apps/web/src/lab/scene/parts/ntc-thermistor.ts`; test: `tests/lab-part-ntc-thermistor.test.ts` (real firmware: beta equation on A1)
- Pins: VCC, SIG, GND. Divider: VCC -> NTC -> SIG -> series resistor -> GND, so SIG rises with temperature (2.5 V at 25 degC with 10k).

Model: R = R25 * exp(B * (1/T - 1/298.15)), R25 = 10k, B = 3950 K. The B value is specified for 25/50 degC, so far from that range a real bead follows Steinhart-Hart more closely than this curve; the difference is not modelled. The supply is read from the wired rail (`ctx.supply()`), fallback 5 V.

Provenance: own work; the beta equation is textbook, the geometry is our own.
