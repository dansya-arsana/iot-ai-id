# Capacitive soil moisture sensor v2.0

Status: emulated. Protocol: `adc`.

- Device: `apps/web/src/lab/sim/devices/soil-capacitive-v2.ts`; part: `apps/web/src/lab/scene/parts/soil-capacitive-v2.ts`; test: `tests/lab-part-soil-capacitive-v2.test.ts`
- Catalog record: `packages/catalog/data/soil-capacitive-v2.json`
- Pins (`SOIL_V2_PINS`): `GND, VCC, AOUT` on a JST PH2.0 3-pin socket with a 3-wire cable (wires only, no breadboard holes).

## Behaviour

- Inverse to wetness: dry about 2.54 V, wet about 1.27 V at 5 V (DFRobot sample counts 520 and 260 on a 10-bit 5 V ADC), linear in between. Different constants from the v1.2 `soil-moisture` kind.
- Prop `timer`: `tlc555` (works from 3.3 V) or `ne555`. An NE555 clone does not oscillate reliably below about 4.5 V: on 3.3 V its output sticks near the dry value and ignores the soil, state `fault:'ne555-3v3'`. This is the field bug the Pro design check flags.
- State `counts5v` is the raw count on a 10-bit 5 V ADC. Use it for the calibration below.

## Calibration (calDry / calWet)

Read the raw ADC value in dry air (`calDry`) and in water up to the white line, or at field capacity (`calWet`), then `wet% = (calDry - raw) / (calDry - calWet) * 100`. Starting points are about 520 and 260 (10-bit, 5 V) but they differ per probe and per soil.

## Provenance

- https://wiki.dfrobot.com/Capacitive_Soil_Moisture_Sensor_SKU_SEN0193 (U)
- https://makerselectronics.com/product/capacitive-soil-moisture-sensor-v2-0 (U)
- https://microcontrollerslab.com/best-soil-moisture-sensors-for-arduino-esp32-embedded-projects-buying-guide/ (U)

## Sources disagree

- Size: 98 x 23 x 4 mm; others list 102 x 23 or 92.1 x 23.5. We model 98 x 23.
- PH2.0 pin order GND, VCC, AOUT follows DFRobot SEN0193: verify against your board.
- Output voltage and the 4.5 V NE555 limit are typical values, not datasheet guarantees.

Own work: the 3D model is built from the dimensions above.
