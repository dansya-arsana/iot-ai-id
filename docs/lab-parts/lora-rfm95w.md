# lora-rfm95w

RFM95W LoRa module (HopeRF, Semtech SX1276 inside, 868/915 MHz class). The Pro default radio: used at 920-923 MHz it sits inside Indonesia's AS923-2 plan (LoRa Alliance RP002 regional parameters). Emulated.

- Device (simulation): `apps/web/src/lab/sim/devices/lora-rfm95w.ts` (also exports the shared SX127x core `createSx127x`, used by `lora-ra02`)
- Part (3D): `apps/web/src/lab/scene/parts/lora-rfm95w.ts`
- Test: `tests/lab-part-lora-rfm95w.test.ts`, catalog record test `tests/catalog-radio-records.test.ts`
- Catalog record: `packages/catalog/data/lora-rfm95w.json`
- Protocol: `spi` (SPI slave, mode 0 only). Runtime: emulated.
- Pins (HopeRF pad order, 16 castellated pads, 2.0 mm pitch, wires only, no breadboard legs): GND, MISO, MOSI, SCK, NSS, RESET, DIO5, GND2, ANT, GND3, DIO3, DIO4, 3V3, DIO0, DIO1, DIO2
- Supply: 1.8-3.7 V (`power` rail 3V3/GND); about 120 mA at +20 dBm. On a 5 V pin the lab reports `power-over`.

## What is modelled

SPI framing (first byte `wnr<<7 | addr`, burst auto-increment, the FIFO address 0x00 does not move), the LoRa register view with datasheet reset values (RegVersion 0x42 = 0x12, Frf 0x6C8000 = 434 MHz), RegOpMode with LongRangeMode changing only in SLEEP, FIFO with RegFifoAddrPtr/TxBase/RxBase, RegIrqFlags (write 1 to clear) and RegIrqFlagsMask, RegDioMapping1 for DIO0/DIO1/DIO3, RegModemConfig1/2/3, RegPreamble, RegPayloadLength, RegSyncWord, RegPaConfig/RegPaDac (output power), NRESET.

TX: setting mode TX sends RegPayloadLength bytes from the TX base; TxDone rises after the real time on air (SX1276 datasheet 4.1.1.6) and DIO0 follows when mapped. Leaving TX early aborts the packet. RX: no air link; the popover terminal injects a packet (ASCII, or `hex: 48 69`) and RxDone rises after that packet's time on air. State shows the last TX payload (hex and ASCII), frequency, SF, BW, CR, time on air, `inBand` (frequency inside the module band 862-1020 MHz) and `inAs923_2` (info only).

Not modelled (honest list): FSK/OOK register view, CAD, frequency hopping, RX timeout, CRC errors, RSSI/SNR (registers stay 0), PA ramp and oscillator start-up, any radio link between two modules.

## Provenance

Own work from the public datasheet behaviour: Semtech SX1276/77/78/79 datasheet https://www.semtech.com/products/wireless-rf/lora-connect/sx1276 and HopeRF RFM95/96/97/98(W) datasheet https://www.hoperf.com/modules/lora/RFM95.html. Region: https://resources.lora-alliance.org/technical-specifications/rp002-1-0-4-regional-parameters. No vendor model, photo, logo or code. The 3D body is ours (16 x 16 mm board, silver shield, gold half-hole pads).

## Sources disagree

- [U] Pad order of the RFM95W (recalled from the HopeRF datasheet, not re-fetched in this build): 1 GND, 2 MISO, 3 MOSI, 4 SCK, 5 NSS, 6 RESET, 7 DIO5, 8 GND, 9 ANT, 10 GND, 11 DIO3, 12 DIO4, 13 3.3V, 14 DIO0, 15 DIO1, 16 DIO2. Catalog confidence is `medium`; confirm against the datasheet PDF before the Build Sheet prints a pin table from it.
- [U] Module thickness (2.0 mm used, confidence `low`) and mass.
- [U] Module band: the SX1276 chip tunes 137-1020 MHz, the RFM95W 868/915 variant is matched for about 862-1020 MHz; the model uses 862-1020 as its hardware band.
- [U] The Ra-01H (868/915) pad compatibility with the Ra-02 footprint is NOT confirmed; no `band` prop is offered on `lora-ra02`.
- Driver snippet (RadioLib, MIT) in the catalog record is `verify: untested` and its API was written from memory.
