# RPI-4B

Protocol: `gpio` (a digital input the sketch drives (an indicator): the device watches one pin).

- Device (simulation): `apps/web/src/lab/sim/devices/rpi-4b.ts`
- Part (3D): `apps/web/src/lab/scene/parts/rpi-4b.ts`
- Test: `tests/lab-part-rpi-4b.test.ts`
- Pins: none (desk prop)

## About

Model only (`runtime:'not-emulated'`): the gateway runs Linux; the gateway.py that Pro writes for it is lint-checked, never run here.

- On Pi 4, `RPi.GPIO`, `gpiozero`, `spidev` and `smbus2` all work.
- Header: 40 pins, wire names `GPIOn`, `3V3_p`, `5V_p`, `GND_p` (p = physical pin). `RPI_HEADER` is exported from the device and reused by `rpi-5`.
- GPIO is 3.3 V and not 5 V tolerant. GPIO0/1 are the HAT ID EEPROM bus.
- Alt functions: `BCM2711_ALT` (ALT0..ALT5, GPIO0-27) typed from BCM2711 ARM Peripherals section 5.3, cross-checked with pinout.xyz.

Catalog record: `packages/catalog/data/rpi-4b.json` (field-level provenance).

## Provenance

Our own simplified model written from public datasheets and mechanical drawings; no vendor 3D models, photos, logos or code.

## Sources disagree / unconfirmed

- Source: https://datasheets.raspberrypi.com/rpi4/raspberry-pi-4-product-brief.pdf , https://datasheets.raspberrypi.com/rpi4/raspberry-pi-4-mechanical-drawing.pdf , https://datasheets.raspberrypi.com/bcm2711/bcm2711-peripherals.pdf
- [U] Connector positions (USB/Ethernet side, HDMI, USB-C) are approximations: the mechanical drawing was not read. Chosen: Ethernet at z+, two USB stacks at z- and 0.
- [U] The ALT table was typed from the datasheet from memory and not re-read against the PDF (confidence medium); verify the BCM2711-only UART2-5, I2C3-6, SPI3-6 columns.
- [U] Typical and peak current (600 and 3000 mA) are estimates.
