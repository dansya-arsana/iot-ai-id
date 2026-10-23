# DS18B20 waterproof probe

Status: emulated. This is not a new lab kind. It is the existing kind `ds18b20` with the prop `form:'probe'` (a 6 mm stainless tube with red, yellow and black wires, full 1-Wire protocol in the sim). Pro uses it with a 4.7 k `resistor` from DQ to 3V3.

- Catalog record: `packages/catalog/data/ds18b20-probe.json` (id `ds18b20-probe`, lab kind `ds18b20`)
- Datasheet (K): https://www.analog.com/media/en/technical-documentation/data-sheets/DS18B20.pdf : 3.0-5.5 V, -55 to +125 C, +-0.5 C over -10 to +85 C, 750 ms at 12 bit.

## Sources disagree

- Tube length and size vary by vendor (U); we record 6 x 50 mm and the cable length is not modelled.
- IP67 is a vendor claim for the potted probe, not part of the chip datasheet.
