# rpi-lora-hat

LoRa/GPS HAT for the Raspberry Pi (Dragino-style, Semtech SX1276, 868/915 MHz class). **Model only**: the Pi runs Linux, so nothing runs in the browser (`runtime: 'not-emulated'`, the device never fakes pin activity).

- Device: `apps/web/src/lab/sim/devices/rpi-lora-hat.ts` (exports `HAT_PINS`: key, header pin number, role, note EN/ID)
- Part (3D): `apps/web/src/lab/scene/parts/rpi-lora-hat.ts`
- Test: `tests/lab-part-rpi-lora-hat.test.ts`
- Catalog record: `packages/catalog/data/rpi-lora-hat.json`
- Pins: 3V3_1, 5V_2, GND_6, GPIO4, GPIO14, GPIO15, GPIO17, GPIO23, GPIO24, GPIO10, GPIO9, GPIO25, GPIO11, ANT (in header order, then the antenna jack)

## Signal map [U, community sources, v1.3+ boards]

NSS = GPIO25 (header pin 22, a manual chip select, not CE0), RESET = GPIO17 (pin 11), DIO0 = GPIO4 (pin 7), DIO1 = GPIO23 (pin 16), DIO2 = GPIO24 (pin 18), SPI0 MOSI/MISO/SCLK on pins 19/21/23, GPS UART on GPIO14/15 (pins 8/10). Boards before v1.3 need DIO1 and DIO2 bridged by hand. The radio has the same register map as `lora-rfm95w` (RegVersion 0x42 = 0x12) and covers AS923-2 at 920-923 MHz. A single-channel HAT is fine for point-to-point LoRa between our nodes; it is not a full LoRaWAN gateway (one channel, one spreading factor).

## Provenance

Own work. Form factor 65 x 56.5 mm, holes on a 58 x 49 mm rectangle, 2x20 header: https://github.com/raspberrypi/hats . Signal map: https://github.com/wklenk/lmic-rpi-lora-gps-hat , https://github.com/JaapBraam/single_chan_pkt_fwd , https://wiki.linksprite.com/index.php/LoRa/GPS_HAT_for_Raspberry_pi . Radio: https://www.semtech.com/products/wireless-rf/lora-connect/sx1276 . No vendor model, photo, logo or brand.

## Sources disagree

- [U] The whole signal map (community sources, revision dependent); catalog pin confidence is `low` or `medium`. Verify on the physical board.
- [U] Supply window (3.3-5.25 V), typical and peak current (60 and 150 mA) and the 18 mm stack height are estimates (confidence `low`); the HAT depends on its host.
- [U] The "pins used" list is the radio and GPS subset only; the HAT passes the rest of the header through.
