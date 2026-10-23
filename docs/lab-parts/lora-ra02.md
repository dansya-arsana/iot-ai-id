# lora-ra02

Ai-Thinker Ra-02 LoRa module (Semtech SX1278, 433 MHz class). **Learn lab only.** 433 MHz is not the Indonesian LoRa band (AS923-2, 920-923 MHz): in Pro it is a band error (plan D7, DOMAIN NET-05). Use `lora-rfm95w`. Emulated.

- Device (simulation): `apps/web/src/lab/sim/devices/lora-ra02.ts` (shares the SX127x core exported by `lora-rfm95w.ts`)
- Part (3D): `apps/web/src/lab/scene/parts/lora-ra02.ts`
- Test: `tests/lab-part-lora-ra02.test.ts`
- Catalog record: `packages/catalog/data/lora-ra02.json` (`protocols.freqMHz` 410-525 MHz, empty `compatibleWith`, a pitfall that says "band error")
- Protocol: `spi`. Pins (spec order, 16 half-hole pads, 2.0 mm pitch, wires only): GND, GND2, 3V3, RESET, DIO0, DIO1, DIO2, DIO3, GND3, DIO4, DIO5, SCK, MISO, MOSI, NSS, GND4
- Supply 1.8-3.7 V in the lab (SX1278), not 5 V tolerant: on a Uno the `power-over` warning is the lesson.

## How Pro flags it

Pro's design check compares the part's `protocols.freqMHz` in the catalog (410-525 MHz) with the region plan (920-923 MHz): no overlap means a band error. `packages/pro-tools/data/radio.ts` (`isWrongBandId`) already matches the id. Device state also reports `inBand` (frequency inside 410-525 MHz) and `inAs923_2` (info only): setting 920.2 MHz on this part gives `inBand:false`, because the module could not radiate it.

## Provenance

Own work from the public datasheet behaviour (Semtech SX1278 datasheet, Ai-Thinker Ra-02 spec V1.1). Spec PDF: https://aithinker-static.oss-cn-shenzhen.aliyuncs.com/docs/Public%20Document%20Center/LoRa/lora/Specification/Ra-02_V1.1%20Specification-20171219.pdf . Product page: https://docs.ai-thinker.com/en/Ra-02/ . No vendor model, photo, logo or code. Register model and time-on-air: see `lora-rfm95w.md`.

## Sources disagree

- [U] Pad order: sources disagree; this is the commonly published map (https://shillehtek.com/blogs/shillehtek-product-manuals/sx1278-lora-433mhz-transceiver-module-manual), not re-checked against the spec PDF in this build. Catalog pin confidence is `low`. Confirm before soldering.
- [U] Supply minimum: 2.5 V (spec) in the catalog; the lab rating uses the SX1278 chip window 1.8-3.7 V.
- [U] Whether the Ra-01H (868/915 MHz) fits the same footprint: not confirmed, so there is no `band` prop on this kind.
