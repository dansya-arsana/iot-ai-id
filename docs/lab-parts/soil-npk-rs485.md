# Soil NPK / EC / pH probe (RS-485)

Status: model-only (`runtime:'not-emulated'`). Protocol: `uart` (Modbus RTU over RS-485 through a MAX485).

- Device: `apps/web/src/lab/sim/devices/soil-npk-rs485.ts`; part: `apps/web/src/lab/scene/parts/soil-npk-rs485.ts`; test: `tests/lab-part-soil-npk-rs485.test.ts`
- Catalog record: `packages/catalog/data/soil-npk-rs485.json`
- Pins (`SOIL_NPK_PINS`): `VCC, GND, A, B`, cable wires with no holes. Wire colours brown, black, yellow, blue: check the label on your unit.

## Modbus data (for code generation)

- `NPK_REGISTER_MAPS['jxct-7in1']`: 0x0006 pH x100, 0x0012 moisture x10, 0x0013 temperature x10, 0x0015 EC, 0x001E N, 0x001F P, 0x0020 K.
- `NPK_REGISTER_MAPS['cwt-thcph']`: 0x0000 moisture, 0x0001 temperature, 0x0002 EC, 0x0003 pH, 0x0004-0x0006 N, P, K. The scales of this map are our guess.
- Defaults: address 1, 4800 8N1 (some units 9600), function 0x03.
- `NPK_EXAMPLE_REQUEST` = `01 03 00 1E 00 03 65 CD` (N, P, K on the jxct map). The test checks its CRC with the MAX485 CRC function. `npkReadResponse()` builds the matching reply; it is pure and not wired to a bus.

## Provenance

- 7-in-1 datasheet (U): https://embdev.net/attachment/640888/7_in_Soil_Sensor_Datasheet.pdf
- Vendor listing (U): https://sigmanortec.ro/en/7-in-1-soil-sensor-n-p-k-ph-ec-moisture-temperature-rs485-530v

## Sources disagree (all U: confirm on your unit)

- Supply: 5-30 V on most, 12-24 V on some.
- Baud: 4800 on most, 9600 on some. Register map and scales: vendor specific.
- Size: cylinder about 45 x 75 mm, some square; needles about 3 x 60 mm; cable 2-5 m. We draw it at half scale next to boards.
- NPK from EC is an estimate; calibrate against a lab soil test.

Core gap: no device-to-device byte link, so this probe cannot answer a MAX485 request. Own work: 3D model built from the dimensions above.
