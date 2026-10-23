# M3 builder briefs: board and field parts for Pro

> Note: plan D7 applies. Group C builds `lora-rfm95w` (920-923 MHz) instead of `lora-ra02` (433 MHz, Learn lab only). Every new kind also gets a catalog record in `packages/catalog/data/` (plan M4).

Prepared 2026-10-23 for `docs/plans/level-ladder-execution.md` rev 2, milestone M3 ("parallel agents, file-only, model-only badges").
Format: `docs/lab-extending.md` (plugin API, scaffolder, parallel-safe rules, sub-agent brief). Precedent for a model-only board: `sim/devices/esp32-devkit.ts` + `scene/parts/esp32-devkit.ts` (`runtime:'not-emulated'`, exported pin table `ESP32_PINS`, no holes, every pin anchored).

Confidence tags on data: **[V]** checked against the cited source in this session · **[K]** well-known datasheet value, the agent re-checks it in the source · **[U]** vendor-dependent or sources disagree, so the agent picks one value, cites it, and says so in `docs/lab-parts/<kind>.md`.

## 0. How to run it

* 6 groups, one agent per group, all in parallel. Each group owns only the files of its own kinds, so no two agents touch the same file. Group A and group F each keep their kinds together because they share a table or a design check.
* For each agent, paste **COMMON** + **its group block**.
* Expected time: about 0.5 d per group. If an agent runs over its time box, drop the parts marked OPTIONAL first.

| Group | Kinds (new) | `--protocol` | Runtime |
|---|---|---|---|
| A. Linux gateway | `rpi-4b`, `rpi-5`, `rpi-lora-hat` | `gpio --desk` (scaffold label only) | **model-only** (all three) |
| B. MCU boards | `esp32-s3-devkitc`, `rpi-pico` | `gpio --desk` (scaffold label only) | **model-only** (both) |
| C. Radio and field bus | `lora-ra02`, `max485`, `soil-npk-rs485` | `spi --power 1.8-3.7`, `uart --power 4.75-5.25`, `uart --desk` | emulated / emulated (TX side only) / **model-only** |
| D. Field sensors | `bh1750`, `rain-gauge-tipping`, `soil-capacitive-v2` (OPTIONAL) | `i2c --power 3-5.5`, `switch --desk`, `adc --power 3.3-5.5` | emulated |
| E. Actuators | `solenoid-valve-12v`, `pump-12v-r385` | `gpio --desk` (linked load, like `load-lamp`/`dc-pump`) | emulated (power solver) |
| F. Power and enclosure | `solar-panel`, `solar-charge-pwm`, `battery-18650-pack`, `enclosure-ip65` | `gpio --desk` (power-part template, like `battery-9v`/`lm7805`) | emulated by the power solver / **model-only** enclosure |

**Already covered, so no agent is needed:**
* **DS18B20 waterproof probe** is the existing kind `ds18b20` with `props.form='probe'` (`scene/parts/ds18b20.ts`, a 6 mm stainless tube with black/yellow/red wires; full 1-Wire in the sim). Pro uses it with a 4.7 kΩ `resistor` from DQ to 3V3. Datasheet: https://www.analog.com/media/en/technical-documentation/data-sheets/DS18B20.pdf [K]: 3.0–5.5 V, −55…+125 °C, ±0.5 °C over −10…+85 °C, 750 ms at 12 bit.
* **Relay for the pump** is the existing kind `relay-module` (5 V coil, COM/NO/NC). See the design note in group E about driving it from 3.3 V.
* **Capacitive soil probe** is the existing kind `soil-moisture` (v1.2, 98 × 23 mm). The v2.0 kind in group D is OPTIONAL and only adds the 3.3 V/NE555 clone behaviour and the PH2.0 connector.

## 1. COMMON (paste first in every brief)

```
Repo: /Users/macbook/Documents/GPT Project/iot-ai-id-public
Context: Pro level (docs/plans/level-ladder-execution.md rev 2), milestone M3. The parts feed the Pro SystemSpec, the CAD view, the
wiring plan, the pin tables and the Build Sheet, so pin names, voltages and dimensions must be datasheet-true: they become wire labels like
"W1 · GPIO4 -> DATA (DS18B20)". No Pro code exists yet; you add lab parts only.

Read first: docs/lab-extending.md (all of it), apps/web/src/lab/sim/devices/types.ts, and the precedent named in your group.
Scaffold each kind: npm run lab:new-part -- <kind> --protocol <p> [--desk] [--power a-b]
  (for model-only boards scaffold with --desk, then add the pins back by hand without `holes`, exactly like esp32-devkit.ts).

Model-only rule: the def carries runtime:'not-emulated' and state() returns {runtime:'not-emulated',...}. It never fakes pin activity.
  The copy.note says plainly "Not emulated: wiring and pin map only; code for it is compile/lint-checked in Pro, never run here" (EN + ID).
Emulated rule: signal-level behaviour from the datasheet, with the timings cited in comments, honest values, typed inputs and typed state.

Every kind:
  - exports its pin table as a typed const (key, physical no., silk, kind power|ground|io|input-only|analog|bus|terminal, voltage level,
    alt functions, note EN/ID) so that Pro (M5 pin tables) can import it later. Follow ESP32_PINS in sim/devices/esp32-devkit.ts.
  - exports a DIMS const {l,w,h,mm:true,holes?:[[x,y,d]...]} in mm, and the PartModule uses those numbers.
  - declares `power` (the supply rating) when the datasheet gives one; a source adds `supplies`, a regulator `regulators`, a contact `switches()`.
  - has copy in English and Indonesian written in our own words, and 3D body proportions in mm with the anchor origin rules of the guide.
    Use the palette in scene/palette.ts; a new hex needs `// ds-allow-hex <reason>`. No logos, no brand marks on the silkscreen, and no
    downloaded images or vendor 3D models.
  - has docs/lab-parts/<kind>.md with Status (emulated | model-only), Provenance (the source URLs below), and "Sources disagree" notes for every [U] value.
Pin keys: [A-Za-z0-9_+-], unique. For duplicate power pins, suffix the physical number: 3V3_1, 5V_2, GND_6 ...
Kinds: <=24 chars, kebab-case, exactly the ids given (they are the shared namespace).

Own only: the four scaffolded files per kind (device, part, test, docs page) and docs/lab-parts/README.md through the scaffolder.
Never edit: contract.ts, boards.ts, circuit-spec.ts, sim/*.ts, sim/devices/core/*, scene/*.ts, scene/parts/index.ts, scene/parts/kit.ts,
  parts-copy.ts, layout.ts, lessons/*, ui/*, scripts/*, any other kind, apps/web/src/preview.tsx, deploy/*, .claude/.
  Another engineer is editing apps/web/src/lab (the lab gate) and preview.tsx right now: touch NOTHING outside your own new files.
  If you are missing a helper or an API is wrong: STOP and report it; do not patch it.
Rules: no GPL/LGPL code; datasheets and photos may be looked at on the web but never downloaded into the repo; scratch files go outside the repo, in your own temp directory; never use ports 5173 or 8787; do not commit; do not delete files you did not create.
Verify: npx tsx --test tests/lab-parts-contract.test.ts tests/lab-part-<kind>.test.ts && npm run typecheck && npm run lint
Screenshot: the /lab/parts/<kind> card (the Screenshots section of the guide, on a port of your own); save it outside the repo and report the path.
Report: STATUS, files created, test output tail, screenshot paths, every [U] value and the one you chose, and any core gap you hit.
```

---

## Group A: Linux gateway (model-only). One agent.

Precedent: `esp32-devkit.ts` (device + part). Shared table: export `RPI_HEADER` (40 pins) from `sim/devices/rpi-4b.ts`. `rpi-5.ts` and `rpi-lora-hat.ts` import it from there (the same agent owns all three files, so there is no cross-agent import).

### A1 · `rpi-4b`: Raspberry Pi 4 Model B (model-only)
* **Scaffold:** `npm run lab:new-part -- rpi-4b --protocol gpio --desk`, then add the 40 header pins + `USB_C_5V` as pins with no holes.
* **Dimensions [K]:** PCB 85 × 56 mm, 4 × M2.5 holes (Ø2.7 mm) on a 58 × 49 mm rectangle, 3.5 mm in from the header-side corner; 2×20 header at 2.54 mm pitch along the long edge. The tallest stack (USB/Ethernet) is about 16 mm above the PCB. Source: https://datasheets.raspberrypi.com/rpi4/raspberry-pi-4-mechanical-drawing.pdf. Take the connector positions from that drawing, not from memory.
* **Power [K]:** 5 V / 3 A over USB-C (or 5 V on header pins 2 and 4). Header 3V3 is the board regulator output. GPIO logic is **3.3 V and not 5 V tolerant**. Source: https://datasheets.raspberrypi.com/rpi4/raspberry-pi-4-product-brief.pdf
* **Header map [K], physical pin → name (default alt):**
  `1 3V3 · 2 5V · 3 GPIO2 SDA1 · 4 5V · 5 GPIO3 SCL1 · 6 GND · 7 GPIO4 GPCLK0 · 8 GPIO14 TXD0 · 9 GND · 10 GPIO15 RXD0 · 11 GPIO17 · 12 GPIO18 PCM_CLK/PWM0 · 13 GPIO27 · 14 GND · 15 GPIO22 · 16 GPIO23 · 17 3V3 · 18 GPIO24 · 19 GPIO10 SPI0_MOSI · 20 GND · 21 GPIO9 SPI0_MISO · 22 GPIO25 · 23 GPIO11 SPI0_SCLK · 24 GPIO8 SPI0_CE0 · 25 GND · 26 GPIO7 SPI0_CE1 · 27 GPIO0 ID_SD (HAT EEPROM) · 28 GPIO1 ID_SC (HAT EEPROM) · 29 GPIO5 GPCLK1 · 30 GND · 31 GPIO6 GPCLK2 · 32 GPIO12 PWM0 · 33 GPIO13 PWM1 · 34 GND · 35 GPIO19 PCM_FS/SPI1_MISO/PWM1 · 36 GPIO16 SPI1_CE2 · 37 GPIO26 · 38 GPIO20 PCM_DIN/SPI1_MOSI · 39 GND · 40 GPIO21 PCM_DOUT/SPI1_SCLK`
* **Alt functions:** fill the full ALT0–ALT5 per GPIO from the BCM2711 peripherals datasheet, §5.3 "Alternative Function Assignments": https://datasheets.raspberrypi.com/bcm2711/bcm2711-peripherals.pdf. Check the BCM2711-only extras: UART2–5 (on GPIO0/1, 4/5, 8/9, 12/13), I2C3–6 and SPI3–6 [K, verify each one]. Cross-check with https://pinout.xyz. Also record pull defaults (GPIO0–8 pull-up, 9–27 pull-down) [K].
* **Visual identity:** green PCB (use `C.PCB`/a new `// ds-allow-hex Pi green` tone), silver BCM2711 heat-spreader in the centre, a black 2×20 header with gold pins, 2× USB3 (blue tongue) + 2× USB2 (black) stacks, a gigabit RJ45, USB-C + 2× micro-HDMI + a 3.5 mm AV jack on the long edge, 2 CSI/DSI FFC slots, a microSD under the board, and red PWR + green ACT LEDs. No raspberry logo.
* **Callouts (3–5):** 40-pin header (pin 1 marked), USB-C power 5 V 3 A, BCM2711 SoC, Ethernet, microSD.
* **Copy note:** "Model only: the gateway runs Linux; the gateway.py that Pro writes for it is lint-checked, never run here."
* **Pro note in the docs page:** on Pi 4, `RPi.GPIO`, `gpiozero`, `spidev` and `smbus2` all work.

### A2 · `rpi-5`: Raspberry Pi 5 (model-only)
* **Scaffold:** same as A1. It imports `RPI_HEADER` (same names and numbering) and overrides the alt functions with RP1 ones.
* **Dimensions [K]:** 85 × 56 mm with the same hole pattern as Pi 4. Source: https://datasheets.raspberrypi.com/rpi5/raspberry-pi-5-mechanical-drawing.pdf. The Ethernet/USB positions differ from the Pi 4; read them off the drawing.
* **Power [K]:** 5 V / **5 A** USB-C PD. On a 3 A supply the USB ports are limited to 600 mA in total. GPIO is 3.3 V and not 5 V tolerant. Source: https://datasheets.raspberrypi.com/rpi5/raspberry-pi-5-product-brief.pdf
* **Alt functions:** the header GPIO is driven by the **RP1** I/O controller, not the SoC. Take FUNCSEL per GPIO from https://datasheets.raspberrypi.com/rp1/rp1-peripherals.pdf (GPIO bank 0 function table). Defaults match Pi 4 (I2C1 2/3, UART0 14/15, SPI0 7–11, PWM on 12/13/18/19).
* **Visual identity:** green PCB, a BCM2712 with a metal lid, the RP1 chip near the USB/Ethernet stacks, a power button, a 4-pin fan header, J5 RTC battery header, a PCIe FFC connector on the short edge, 2× 4-lane MIPI (camera/display) FFC, USB-C, 2× micro-HDMI, a 3-pin UART debug JST, and no 3.5 mm jack.
* **Callouts:** header, power button, PCIe FFC, RP1, fan header.
* **Pro note in the docs page (important for M2 code gen):** on Pi 5 the legacy `RPi.GPIO` does not work. Use `gpiozero`/`lgpio` (or `rpi-lgpio`); `spidev` and `smbus2` are unchanged.

### A3 · `rpi-lora-hat`: Dragino-style LoRa/GPS HAT, SX1276 (model-only)
* **Scaffold:** `--protocol gpio --desk`. Pins: only the header pins the HAT uses, named like the Pi side, plus `ANT`: `3V3_1, 5V_2, GND_6, GPIO4, GPIO23, GPIO24, GPIO25, GPIO17, GPIO10, GPIO9, GPIO11, GPIO14, GPIO15, ANT`.
* **Dimensions [K]:** the HAT form factor is 65 × 56.5 mm with holes on a 58 × 49 mm rectangle (aligned with the Pi), a 2×20 female header, and about 12 mm standoffs. Source: https://github.com/raspberrypi/hats (hat-board-mechanical.pdf).
* **Signal map [U, community sources, v1.3+ boards]:** NSS = **GPIO25 (pin 22, a manual chip select, not CE0)**, RESET = GPIO17 (pin 11), DIO0 = GPIO4 (pin 7), DIO1 = GPIO23 (pin 16), DIO2 = GPIO24 (pin 18), SPI0 MOSI/MISO/SCLK on 19/21/23, GPS UART on GPIO14/15. Sources: https://github.com/wklenk/lmic-rpi-lora-gps-hat , https://github.com/JaapBraam/single_chan_pkt_fwd , https://wiki.linksprite.com/index.php/LoRa/GPS_HAT_for_Raspberry_pi . Boards before v1.3 need DIO1/DIO2 bridged by hand: say so.
* **Radio [K]:** SX1276 (RFM95W-class, 868/915 band, which covers Indonesia's AS923-2 at 920–923 MHz; the agent checks AS923-2 for Indonesia in LoRa Alliance RP002 Regional Parameters). Same register map as C1 (`RegVersion` 0x42 = 0x12). Source: Semtech SX1276/77/78/79 datasheet, https://www.semtech.com/products/wireless-rf/lora-connect/sx1276
* **Visual identity:** a blue or black HAT PCB, a metal-can RFM95-style module, an SMA (or IPEX) antenna jack with a stub antenna, a GPS module (Quectel L80-class patch antenna square) and a CR1220 holder. No brand.
* **Callouts:** radio module, antenna jack ("never transmit without an antenna"), NSS on GPIO25, GPS.
* **Copy note:** a single-channel HAT is fine for point-to-point LoRa between our nodes; it is **not** a full LoRaWAN gateway (one channel, one spreading factor).

---

## Group B: microcontroller boards (model-only). One agent.

Precedent: `esp32-devkit.ts`. Both boards are model-only: the lab emulates AVR only, and RP2040 emulation is a later plan.

### B1 · `esp32-s3-devkitc`: ESP32-S3-DevKitC-1 v1.1 (model-only)
* **Scaffold:** `--protocol gpio --desk`. 44 pins: J1 1–22 and J3 1–22 as below, with duplicate power pins suffixed.
* **Dimensions:** 62.74 × 25.40 mm [V, the Espressif PCB drawing v1.0 https://dl.espressif.com/dl/PCB_ESP32-S3-DevKitC-1_V1_20210312CB.pdf ]. Header row spacing and pin-1 offsets [U]: read them from the v1.1 dimension PDF/DXF linked in the user guide. 2.54 mm pitch.
* **Power [V]:** 5 V in from either USB port or from the 5V+G pins, or 3.3 V into 3V3+G; **use only one input at a time**. The on-board LDO makes 3.3 V. GPIO is 3.3 V.
* **J1 [V]:** `1 3V3 · 2 3V3 · 3 RST(EN) · 4 GPIO4 TOUCH4 ADC1_CH3 · 5 GPIO5 ADC1_CH4 · 6 GPIO6 ADC1_CH5 · 7 GPIO7 ADC1_CH6 · 8 GPIO15 U0RTS ADC2_CH4 XTAL_32K_P · 9 GPIO16 U0CTS ADC2_CH5 XTAL_32K_N · 10 GPIO17 U1TXD ADC2_CH6 · 11 GPIO18 U1RXD ADC2_CH7 · 12 GPIO8 ADC1_CH7 · 13 GPIO3 ADC1_CH2 (strap) · 14 GPIO46 (strap) · 15 GPIO9 ADC1_CH8 FSPIHD · 16 GPIO10 ADC1_CH9 FSPICS0 · 17 GPIO11 ADC2_CH0 FSPID · 18 GPIO12 ADC2_CH1 FSPICLK · 19 GPIO13 ADC2_CH2 FSPIQ · 20 GPIO14 ADC2_CH3 FSPIWP · 21 5V · 22 G`
* **J3 [V]:** `1 G · 2 TX GPIO43 U0TXD · 3 RX GPIO44 U0RXD · 4 GPIO1 ADC1_CH0 · 5 GPIO2 ADC1_CH1 · 6 GPIO42 MTMS · 7 GPIO41 MTDI · 8 GPIO40 MTDO · 9 GPIO39 MTCK · 10 GPIO38 RGB LED (v1.1) · 11 GPIO37 · 12 GPIO36 · 13 GPIO35 · 14 GPIO0 BOOT (strap) · 15 GPIO45 (strap) · 16 GPIO48 (RGB LED on v1.0) · 17 GPIO47 · 18 GPIO21 · 19 GPIO20 USB_D+ · 20 GPIO19 USB_D- · 21 G · 22 G`
* **Reserved [V]:** on N8R8/N16R8 (octal PSRAM) and WROOM-2 modules, **GPIO35/36/37 are used by the flash/PSRAM**; mark them `kind:'flash'` with a prop `module` (`n8 | n8r8 | n16r8 | n32r16v`, default `n8r8`). Strapping pins: 0, 3, 45, 46 [K]. ADC2 cannot be used while Wi-Fi is on [K]: put that in the note.
* **Visual identity:** a black PCB, a WROOM-1 metal shield with the PCB antenna overhanging one short end, 2 USB ports on the other end (labelled UART and USB; micro-USB on the Espressif original, USB-C on many clones: make it a prop `usb: micro | c`), BOOT and RST buttons, an RGB LED, and white silk pin labels.
* **Callouts:** 2 USB ports (UART vs native USB), BOOT button, RGB LED (GPIO38), antenna keep-out.
* **Source:** https://docs.espressif.com/projects/esp-dev-kits/en/latest/esp32s3/esp32-s3-devkitc-1/user_guide_v1.1.html [V]. Chip: https://www.espressif.com/sites/default/files/documentation/esp32-s3_datasheet_en.pdf

### B2 · `rpi-pico`: Raspberry Pi Pico, RP2040 (model-only)
* **Scaffold:** `--protocol gpio --desk`. 40 edge pins + 3 debug pads (`SWCLK`, `GND_D`, `SWDIO`).
* **Dimensions [K]:** 51 × 21 × 1 mm PCB, castellated pads at 2.54 mm pitch, rows 17.78 mm apart, 4 holes Ø2.1 mm on 11.4 × 47 mm. Source: https://datasheets.raspberrypi.com/pico/pico-datasheet.pdf (mechanical drawing, pinout figure).
* **Power [K]:** VBUS = USB 5 V; VSYS input 1.8–5.5 V (buck-boost RT6150); 3V3(OUT) up to about 300 mA; 3V3_EN low switches it off; GPIO 3.3 V, **not 5 V tolerant**; ADC 12-bit on GP26–28 (+ the internal temperature sensor), with ADC_VREF on pin 35.
* **Pin map [K]:** `1 GP0 · 2 GP1 · 3 GND · 4 GP2 · 5 GP3 · 6 GP4 · 7 GP5 · 8 GND · 9 GP6 · 10 GP7 · 11 GP8 · 12 GP9 · 13 GND · 14 GP10 · 15 GP11 · 16 GP12 · 17 GP13 · 18 GND · 19 GP14 · 20 GP15 · 21 GP16 · 22 GP17 · 23 GND · 24 GP18 · 25 GP19 · 26 GP20 · 27 GP21 · 28 GND · 29 GP22 · 30 RUN · 31 GP26 ADC0 · 32 GP27 ADC1 · 33 AGND · 34 GP28 ADC2 · 35 ADC_VREF · 36 3V3(OUT) · 37 3V3_EN · 38 GND · 39 VSYS · 40 VBUS`. On-board LED = GP25 (on Pico W it is the WL_GPIO0 of the CYW43, so make a prop `variant: pico | pico-w | pico2`).
* **Alt functions [K, verify against the RP2040 datasheet §2.19.2 function table https://datasheets.raspberrypi.com/rp2040/rp2040-datasheet.pdf ]:** a computed table, so do not hand-type it. SPI: GPIO 0–7 and 16–23 = SPI0, 8–15 and 24–29 = SPI1, with n%4 → RX, CSn, SCK, TX. UART: UART0 on 0/1, 12/13, 16/17, 28/29 and UART1 on 4/5, 8/9, 20/21, 24/25, with n%4 → TX, RX, CTS, RTS. I2C: even n = SDA, odd n = SCL; I2C0 when (n>>1)%2==0, else I2C1. PWM slice = (n>>1)%8, channel A for even n and B for odd n. Write a unit test that the generated table matches 6 rows typed from the datasheet.
* **Visual identity:** a green PCB, the RP2040 QFN in the centre, a micro-USB on one short end, a BOOTSEL button, a W25Q16 flash, a green LED, castellations with white pin numbers, and the 3 SWD pads at the far end. (Pico W: a metal-can CYW43439 and the antenna end.)
* **Callouts:** micro-USB / VBUS, BOOTSEL, VSYS input range, ADC pins, the SWD pads.

---

## Group C: radio and field bus. One agent.

Precedents: the SPI test device in `tests/lab-bus.test.ts` (spi), the uart template (uart), `esp32-devkit.ts` (model-only).

### C1 · `lora-ra02`: Ai-Thinker Ra-02 LoRa module (SX1278), emulated register file
* **Scaffold:** `npm run lab:new-part -- lora-ra02 --protocol spi --power 1.8-3.7`
* **Dimensions [V/U]:** 17 × 16 × 3.2 mm (±0.1), 16 half-hole stamp pads, 2.0 mm pitch, an IPEX/U.FL antenna connector on the shield [V, distributor + Ai-Thinker page]. Spec PDF: https://aithinker-static.oss-cn-shenzhen.aliyuncs.com/docs/Public%20Document%20Center/LoRa/lora/Specification/Ra-02_V1.1%20Specification-20171219.pdf . Product page: https://docs.ai-thinker.com/en/Ra-02/
* **Pins [U, sources disagree; take the order from the spec PDF]:** the most common map is `1 GND · 2 GND · 3 3.3V · 4 RESET · 5 DIO0 · 6 DIO1 · 7 DIO2 · 8 DIO3 · 9 GND · 10 DIO4 · 11 DIO5 · 12 SCK · 13 MISO · 14 MOSI · 15 NSS · 16 GND` (https://shillehtek.com/blogs/shillehtek-product-manuals/sx1278-lora-433mhz-transceiver-module-manual). Pin key order for the `spi` template: SCK, MOSI, MISO, NSS first, then RESET, DIO0–5, 3V3 and GNDs. It is a stamp module (no breadboard legs): give it no holes and anchor the pads; the copy says "solder it to an adapter board".
* **Electrical [V/K]:** 3.3 V typ (2.5–3.7 V), up to +20 dBm, about 105–120 mA at TX, **not 5 V tolerant** (on a Uno the validator's `power-over` warning is the lesson), 410–525 MHz band (SX1278).
* **Band warning (copy + docs):** Ra-02 is a **433 MHz** part. Indonesia's LoRaWAN plan is AS923-2 (920–923 MHz). Pro should default to an SX1276 868/915 module (Ra-01H, RFM95W) or the A3 HAT. Add a prop `band: '433' | '920'`: '920' means "a pin-compatible SX1276 module", **only if the agent confirms Ra-01H pin compatibility from its spec; otherwise leave '433' only and report it**.
* **Behaviour (SPI slave, Semtech SX1276/77/78 datasheet §4.1.7 and the register table) [K]:** SPI mode 0, ≤10 MHz, MSB first. The first byte is `wnr<<7 | addr`, and burst access auto-increments while NSS stays low. The reset values are true to the datasheet. `RegVersion 0x42 = 0x12`. Implement `RegOpMode 0x01` (LongRangeMode bit 7, modes SLEEP/STDBY/TX/RXCONT), `RegFrf 0x06–0x08` (Fstep = 32 MHz / 2^19), `RegPaConfig 0x09`, FIFO `0x00` with `RegFifoAddrPtr 0x0D`, `TxBase 0x0E`, `RxBase 0x0F`, `RxCurrentAddr 0x10`, `RegIrqFlags 0x12` (write 1 to clear), `RegRxNbBytes 0x13`, `RegModemConfig1/2/3 0x1D/0x1E/0x26`, `RegPayloadLength 0x22`, `RegSyncWord 0x39`, `RegDioMapping1 0x40`. TX: going to TX mode sets **TxDone after the real time-on-air** (the datasheet §4.1.1.6 formula from SF, BW, CR, preamble and payload), and DIO0 goes high when it is mapped to TxDone. RX: a popover terminal `inject` puts a packet in the FIFO and raises RxDone on DIO0. **No fake air link:** the state shows the last TX payload (hex + ASCII), the frequency in MHz, SF, BW and the time-on-air.
* **Visual identity:** a small square tin shield (silver) on a blue/green stamp PCB, the IPEX connector at one corner, and half-holes along 2 sides.
* **Callouts:** antenna connector ("never transmit without an antenna"), 3.3 V only, NSS/DIO0.
* **Tests:** the RegVersion read over SPI, a burst FIFO write then read-back, and a TxDone cycle time for SF7/125 kHz/CR4/5 and a 10-byte payload equal to the formula.

### C2 · `max485`: MAX485 TTL ↔ RS-485 module, emulated TX side
* **Scaffold:** `npm run lab:new-part -- max485 --protocol uart --power 4.75-5.25`
* **Dimensions [U]:** about 44 × 14 mm (vendors list 44×13 to 45×20). Two 4-pin 2.54 mm headers at the two short ends plus a 2-way 5.0 mm screw terminal for A/B. Sources: https://protosupplies.com/product/max485-ttl-to-rs-485-interface-module/ , https://makerselectronics.com/ar/product/max485-ttl-to-rs485-converter-module/
* **Pins:** `RO, RE, DE, DI` (logic header) · `VCC, B, A, GND` (bus header) · terminals `A_T, B_T` (screw block, wires only, joined to A/B). Logic header holes 0–3; the module is wider than the lanes, so expect the back lane, or make it a desk part with anchors.
* **Electrical [K]:** MAX485, 4.75–5.25 V, half-duplex, 2.5 Mbit/s, 32 unit loads. RE is active low and DE is active high (usually bridged to one TX_EN pin). **RO swings to VCC (5 V): with an ESP32/Pi that is a 5 V input on a 3.3 V pin → add a divider or use a MAX3485 module** (a Pro design-check item; the docs page says so). The module has a 120 Ω termination across A/B (some 100 Ω [U]); keep it only at the two ends of the bus. Datasheet: https://www.analog.com/media/en/technical-documentation/data-sheets/MAX1487-MAX491.pdf
* **Behaviour:** `uart.onTx`: bytes reach the bus only while DE=1 and RE=1 (otherwise they are counted as "sent with the driver off", a common bug). Decode **Modbus RTU** frames by a ≥3.5-char silence at the current baud; check the CRC-16 (poly 0xA001, init 0xFFFF, low byte first); state = last frame (addr, function, start register, count, crc ok). RX side: **no reply is invented**. The state says "no bus partner emulated" unless the popover terminal injects a reply frame (hex), which is then sent on RO with real UART timing.
* **Visual identity:** a small blue PCB, the MAX485 SOIC-8 chip, a red/green power LED, the blue 2-way screw terminal, and the 120 Ω SMD resistor marked in the callout.
* **Callouts:** DE/RE (TX enable), A/B terminal, 120 Ω terminator, the 5 V logic warning.
* **Core gap to report:** there is no device-to-device message channel (`ctx.peers` gives pins, not models), so a probe behind A/B cannot answer the request from its own state. Ask the core owner for an RS-485/byte-link bus helper; do not build one.

### C3 · `soil-npk-rs485`: RS-485 soil NPK/EC/pH/moisture/temperature probe (model-only)
* **Scaffold:** `--protocol uart --desk`, then set `runtime:'not-emulated'`. Pins: `VCC, GND, A, B` (cable wires, no holes).
* **Dimensions [U]:** the typical 7-in-1 body is an ABS cylinder of about Ø45 × 75 mm (some square) with 3–4 stainless needles about Ø3 × 60 mm, and a 2–5 m 4-core cable, IP68. Cite the vendor sheet you use: https://embdev.net/attachment/640888/7_in_Soil_Sensor_Datasheet.pdf , https://sigmanortec.ro/en/7-in-1-soil-sensor-n-p-k-ph-ec-moisture-temperature-rs485-530v
* **Electrical [U]:** 5–30 V DC (some 12–24 V); wires **brown VCC, black GND, yellow A+, blue B−** (colours vary, so say "check the label").
* **Protocol [U]:** Modbus RTU, default address 0x01, **4800 8N1** (some 9600), function 0x03 read holding registers. The register map is vendor-specific, so export it as data with a `map` prop: `jxct-7in1` (common: 0x0006 pH×100, 0x0012 moisture %×10, 0x0013 temperature °C×10, 0x0015 EC µS/cm, 0x001E N, 0x001F P, 0x0020 K in mg/kg) and `cwt-thcph` (0x0000 moisture, 0x0001 temperature, 0x0002 EC, 0x0003 pH, 0x0004–0x0006 N/P/K). Both are [U]; the docs page lists the source of each and says "confirm on your unit". Export `NPK_REGISTER_MAPS` and an example request frame with its CRC (`01 03 00 1E 00 03 65 CD` for N/P/K on jxct, CRC checked; a unit test asserts it with the C2 CRC function). M2 code gen uses these.
* **Visual identity:** a dark-grey or black cylinder with a stainless needle fork, a cable gland at the top, and a 4-core black cable that splits into the 4 coloured wires.
* **Callouts:** needles ("fully into the soil, no air gap"), cable colours, the Modbus address/baud label.
* **Copy note:** "Model only: the reading comes over RS-485 through a MAX485. Pro writes the Modbus code; it is not run here." Also: NPK from EC is an estimate; calibrate against a lab soil test.

---

## Group D: field sensors (emulated). One agent.

Precedents: `bme280.ts` (i2c), `tilt-switch.ts` / `button.ts` (switch), `soil-moisture.ts` (adc).

### D1 · `bh1750`: BH1750 ambient light sensor (GY-302 module)
* **Scaffold:** `npm run lab:new-part -- bh1750 --protocol i2c --power 3-5.5`
* **Dimensions [U]:** GY-302 board about 18.5 × 13.9 mm (another listing says 19.25 × 14.4), a 5-pin 2.54 mm header, 2 Ø3 mm holes, and the sensor chip (WSOF6, 3.0 × 1.6 mm) on top. Sources: https://probots.co.in/light-intensity-bh1750-sensor-for-arduino-raspberry-pi-gy-302.html , https://github.com/Erriez/ErriezBH1750
* **Pins [V]:** `VCC, GND, SCL, SDA, ADDR` (holes 0–4). The module has a 3.3 V LDO and I2C pull-ups, so it works on 3–5 V. The bare chip VCC is 2.4–3.6 V [K].
* **Behaviour (ROHM BH1750FVI datasheet https://www.mouser.com/datasheet/2/348/bh1750fvi-e-186247.pdf ) [K]:** address **0x23** with ADDR low or floating, **0x5C** with ADDR high (≥0.7 VCC; read the ADDR net with `ctx.volts`). Opcodes: 0x00 power down, 0x01 power on, 0x07 reset (data register only, works only when powered on), 0x10/0x11/0x13 continuous H/H2/L, 0x20/0x21/0x23 one-time H/H2/L (then power down), MTreg 0b01000_hhh (0x40–0x47) and 0b011_lllll (0x60–0x7F), range 31–254, default 69. Measurement time: H typ 120 ms (max 180), L typ 16 ms (max 24), scaled by MTreg/69. Reading = 2 bytes MSB first; count = lux × 1.2 × (MTreg/69), with H2 counting half-lux steps; 0–65535; before the first conversion completes, the data read returns the previous value (power-on 0). Input: a `lux` range 0–100000 (log steps). State: lux, mode, mtreg, address, `ready`.
* **Visual identity:** a small blue PCB, the tiny clear-top sensor chip, the 662K regulator SOT-23, a 5-pin header, and "GY-302"-style silk (generic, no brand).
* **Callouts:** the light window ("face the sky, shade it from rain"), ADDR (0x23/0x5C), 3–5 V.
* **Field note (docs):** outdoors it needs a diffuser dome; full sun reaches about 100 klx, so use MTreg 31/L mode or expect clipping at 54612 lx in H mode at MTreg 69.

### D2 · `rain-gauge-tipping`: tipping-bucket rain gauge (reed switch)
* **Scaffold:** `npm run lab:new-part -- rain-gauge-tipping --protocol switch --desk`. Pins: `SIG, GND` (the two reed leads; the MCU uses `INPUT_PULLUP`), plus no holes.
* **Reference [V]:** SparkFun Weather Meter Kit SEN-15901 rain gauge: **one momentary closure per 0.2794 mm (0.011 in) of rain**, a passive reed switch, an RJ11 cable (the agent takes the RJ11 pinout from the datasheet: https://cdn.sparkfun.com/assets/d/1/e/0/6/DS-15901-Weather_Meter.pdf ; if that link has moved, take it from the SEN-15901 product page). Listings: https://core-electronics.com.au/weather-meter-kit.html , https://www.digikey.com/en/products/detail/sparkfun-electronics/SEN-15901/11570533
* **Dimensions [U]:** a funnel about 110–130 mm wide, about 90 mm tall, a 2-arm mounting bracket. Pick one source and cite it.
* **Behaviour:** inputs: `rate` mm/h (range 0–150, 0.5 steps) and a momentary `tip` (choice `momentaryMs`). It produces one closure per 0.2794 mm (prop `mmPerTip`, default 0.2794; other gauges use 0.2, 0.3 or 0.5). The closure length is about 100 ms [U; cite it or keep 100 ms and say so], **with reed bounce: 2–4 extra edges within the first 1 ms** (so the debounce in the Pro firmware is visible), using `ctx.drive` with real cycle times. State: tips, mm total, last-tip time, rate.
* **Visual identity:** a white/cream UV plastic funnel with a mesh over the opening, a translucent see-saw bucket visible in a cutaway or section view, and the black cable.
* **Callouts:** funnel ("level it; clear leaves"), the tipping bucket, the reed switch (debounce), mm per tip.

### D3 · `soil-capacitive-v2` (OPTIONAL): capacitive soil moisture sensor v2.0
* Skip it if the time box is tight. Pro can use the existing `soil-moisture` (v1.2).
* **Scaffold:** `npm run lab:new-part -- soil-capacitive-v2 --protocol adc --power 3.3-5.5`
* **Dimensions [U]:** 98 × 23 × 4 mm (others: 102 × 23, 92.1 × 23.5). A JST **PH2.0-3P** socket (pins `GND, VCC, AOUT`, as in DFRobot SEN0193; verify against the board), plus a 3-wire cable. Sources: https://wiki.dfrobot.com/Capacitive_Soil_Moisture_Sensor_SKU_SEN0193 , https://makerselectronics.com/product/capacitive-soil-moisture-sensor-v2-0 , https://microcontrollerslab.com/best-soil-moisture-sensors-for-arduino-esp32-embedded-projects-buying-guide/
* **Behaviour:** like `soil-moisture` (inverse: dry is a high voltage, wet a low one; export the same curve shape but your own constants, cited), with prop `timer: tlc555 | ne555`. **The NE555 clone does not oscillate reliably below about 4.5 V**: on a 3.3 V supply its output sticks near the dry value and does not follow the wetness (state `fault:'ne555-3v3'`). This is the real field bug that Pro's design check will flag. Also add a `calDry`/`calWet` ADC pair to the docs page.
* **Visual identity:** a black PCB blade, a white "max insert" line, the electronics at the top under a strip of heat-shrink or bare (prop), and the PH2.0 socket.
* **Callouts:** insert line ("never past it; seal the top edge with lacquer"), PH2.0 connector, the 3.3 V caveat.

---

## Group E: actuators (emulated through the power solver). One agent.

Precedents: `load-lamp.ts` (electrical mode: follows the voltage across `+`/`-`), `dc-pump.ts` (dry-run logic), `relay-module.ts` (COM/NO switch) and `l298n.ts` (output()). Both kinds are desk props with `+`/`-` terminals wired part-to-part (relay NO, battery or controller LOAD output).

**Design notes for the docs pages (Pro design checks):**
* the existing `relay-module` is a 5 V coil: on an ESP32/Pi node, power VCC from 5 V. A 3.3 V IN level may not switch a low-level-trigger opto board reliably, so check the trigger level or use a logic-level MOSFET.
* the existing `irf520-mosfet-module` is **not logic-level at 3.3 V gate drive**: do not drive 12 V loads with it from an ESP32.
* every inductive load needs a flyback diode (`diode` kind across `+`/`-`).

### E1 · `solenoid-valve-12v`: 12 V normally closed solenoid valve, 1/2"
* **Scaffold:** `npm run lab:new-part -- solenoid-valve-12v --protocol gpio --desk`. Pins: `+`, `-` (coil terminals).
* **Reference [V], Adafruit 997:** normally closed, **12 V DC, about 320 mA at 12 V (160 mA at 6 V)**, actuates down to about 6 V (slower), **0.02–0.8 MPa working pressure (needs ≥ about 3 PSI to seal; not for gravity-fed tanks with < 0.2 m head without a direct-acting valve)**, open ≤ 0.15 s, close ≤ 0.3 s, one flow direction (arrow on the body), 1/2" NPS threads, water only, 0–75 °C, 50 M cycles, about 76 × 57 × 51 mm (3 × 2.25 × 2 in), 4.3 oz. Source: https://www.adafruit.com/product/997 (+ the DigiKey listing https://digikey.cn/en/products/detail/adafruit-industries-llc/997/6827136 for the pressure figures).
* **Behaviour:** read `v = volts('+') − volts('-')` each update (as `load-lamp` does). It opens at v ≥ 6 V after 150 ms (0.15 s at 12 V, longer at 6 V: scale it and state the assumption) and closes 300 ms after v < about 3 V [U drop-out]. Current = v / R_coil with R_coil = 12 / 0.32 = 37.5 Ω. Inputs: `pressureKpa` (0–800, default 200) and the valve **does not open below 20 kPa** (state `open:false, reason:'low-pressure'`). Declare `power:{rail:['+','-'],min:10.8,max:13.2,ma:320,external:true}` [check the PowerSpec fields in types.ts]. State: open, amps, flowing, reason, `flyback` (true if a `diode` peer spans the coil; otherwise a design note: "add a 1N4007 across the coil").
* **Visual identity:** a white/translucent nylon body with two 1/2" threaded ports and a flow arrow, a black cylindrical coil housing on top with 2 spade tabs, and red/black leads.
* **Callouts:** flow direction, coil 12 V 320 mA, minimum pressure, flyback diode.

### E2 · `pump-12v-r385`: 12 V DC diaphragm pump (R385 class)
* **Scaffold:** `npm run lab:new-part -- pump-12v-r385 --protocol gpio --desk`. Pins: `+`, `-`.
* **Reference [U, vendor sheets disagree]:** 6–12 V DC; **0.5–0.7 A loaded at 12 V** (about 0.23 A no-load; **start surge up to about 2 A**); 1.5–2 L/min (range 1–3); suction about 2 m, lift about 3 m; barbs 6 mm ID / 8.5 mm OD; ≤80 °C liquid; about 2500 h life; about 90 × 40 × 35 mm. Sources: https://robotshop.com/en/6-12v-r385-dc-diaphragm-pump.html , https://www.electrokit.com/en/vattenpump-6-12v-med-slang , https://kitronik.co.uk/products/2567-water-pump-6v-12v-with-1m-silicone-tube , https://www.thingbits.in/products/r385-6-12v-dc-mini-diaphragm-pump . Pick one set, cite it and list the others under "Sources disagree".
* **Behaviour:** follows the voltage across `+`/`-` like `dc-pump` (copy its dry-run logic idea, written fresh in this file): flow ∝ v above about 3 V, rpm/flow state, amps (start surge for 100 ms [U]), a `primed` toggle input (a self-priming diaphragm still needs the hose filled for the stated suction), dry seconds. `power` external 6–12 V.
* **Visual identity:** a black motor can (385 size, Ø about 28 mm) on a dark-grey diaphragm pump head with two white/clear barbed nozzles side by side, and red/black leads.
* **Callouts:** inlet vs outlet (arrows on the head), start surge (size the relay, fuse and supply), flyback diode, keep it dry (not submersible).

---

## Group F: power and enclosure. One agent.

Precedents: `battery-9v.ts` (`supplies`), `lm7805.ts` / `ams1117-3v3.ts` (`regulators`), `relay-module.ts` (`switches()`), `esp32-devkit.ts` (model-only). Keep the solver honest: **never join two ideal sources by a closed switch** (the solver reports a short). That is why PV→BAT charging is modelled as state, not as a contact.

**Chemistry check (the cross-part design check lives in this group's docs and in Pro M6):** the chosen PWM controller (Renogy Wanderer 10A class) supports **Sealed/Gel/Flooded/LFP**, not 3S Li-ion NMC. An 18650 pack must therefore be **4S LiFePO4 (12.8 V nominal)** for this controller, or the 3S Li-ion option needs a Li-ion-capable controller. `battery-18650-pack` defaults to `lfp-4s`; `solar-charge-pwm` has a `battery` prop, and the docs page shows the compatibility table.

### F1 · `solar-panel`: 10–20 W 12 V solar panel
* **Scaffold:** `npm run lab:new-part -- solar-panel --protocol gpio --desk`. Pins: `PV+`, `PV-` (MC4 or bare leads).
* **Reference [U, 20 W 12 V class]:** Pmax 20 W, **Vmp about 17.5 V, Imp about 1.14 A, Voc about 21.6–22 V, Isc about 1.23 A**, about 345 × 470 × 20 mm (ACOPOWER) or 340 × 429 × 25 mm (Renogy-style listing), an aluminium frame, tempered glass. 10 W: about 18 V / 0.56 A, about 340 × 230 mm [U: cite a sheet]. Sources: https://www.acopower.com/products/hy-12m-20w , https://www.tokopedia.com/indosunergy/usa-renogy-20w-12v-solar-panel-rv-marine-boat-and-hazard-area (an Indonesian retail listing reproducing the spec), https://oe2.open-electronics.org/?p=45146 . Prop `watts: 10 | 20`.
* **Behaviour:** `supplies(props)`: `{pos:'PV+',neg:'PV-',volts:Voc(irr),maxMa:Isc(irr)}` with `irradiance` input 0–1000 W/m² (Isc ∝ irr, Voc ≈ Voc_stc + n·Vt·ln(irr/1000) with clamping; say it is a simple model). State: irradiance, volts open-circuit, available watts (≈ Pmax·irr/1000), and `tiltDeg` input → note "at about 6° S latitude in Indonesia tilt about 10–15° facing north for self-cleaning" [K: cite a PV tilt source or keep it as general guidance].
* **Visual identity:** a dark-blue/black mono cell grid (36 cells, 4×9), a silver frame, a junction box on the back with 2 leads, and an optional MC4 pair.
* **Callouts:** Voc (the controller's PV input must exceed it with margin), Imp, the junction box, tilt/orientation.

### F2 · `solar-charge-pwm`: small PWM solar charge controller, 10 A, 12/24 V
* **Scaffold:** `npm run lab:new-part -- solar-charge-pwm --protocol gpio --desk`. Pins: `PV+, PV-, BAT+, BAT-, LOAD+, LOAD-` (screw terminals, wires only).
* **Reference [V], Renogy Wanderer 10A (WND10):** 10 A rated charge current, **PV input max 50 V DC**, about 130 W at 12 V / 260 W at 24 V, battery types Sealed/Gel/Flooded/**LFP**, 12/24 V auto-detect **for non-lithium only (set it manually for LFP)**, 12 AWG max wire, **119 × 75 × 27.5 mm**, about 122 g, −35…+45 °C (Renogy's own page says −25 °C). Datasheet: https://uk.renogy.com/cdn/shop/files/WND10-Datasheet.pdf ; product page: https://www.renogy.com/products/wanderer-10a-pwm-charge-controller . **Common-positive vs common-negative switching [U]:** read it from the manual. It matters for grounding the RS-485/sensor negative of a node, so state it in the docs page.
* **Behaviour (honest, simple):** BAT+/BAT- must see a supply (battery). `switches()`: `BAT+`↔`LOAD+` closed while battery V > LVD (the LVD/LVR thresholds from the manual [U], e.g. 11.1/12.6 V for lead-acid and LFP-specific values), and opened by the low-voltage disconnect, also with a `loadOn` toggle input. The negative path follows the common-pos/neg finding. **PV→battery charging is NOT a contact:** compute the charge current in state (PWM: I = min(10 A, panel Isc at the irradiance) when PV V > BAT V + about 0.5 V and the battery is below its absorption/float set-point, tapering in absorption) and expose `chargeA`, `stage: night|bulk|absorb|float`, `pvV`, `batV` and `loadOn`. Read PV and battery voltages with `ctx.volts`. Add a `battery` prop (`agm | gel | flooded | lfp`) and set `issue:'chemistry'` in state when the linked pack's chemistry is not supported (if `ctx.peers('BAT+')` shows `battery-18650-pack`, the kind is visible; its props are not, so this check is otherwise a Pro M6 check: report it).
* **Visual identity:** a matte dark-grey or black plastic case with a heatsink-fin top or a flat face, 3 pairs of screw terminals (PV / BAT / LOAD icons), 3–4 status LEDs (charge, battery level, load) and a mode button. No brand.
* **Callouts:** terminal order "connect the battery first, then PV, then the load", PV max 50 V, LFP mode is manual, the load LVD.

### F3 · `battery-18650-pack`: 18650 battery pack with BMS
* **Scaffold:** `npm run lab:new-part -- battery-18650-pack --protocol gpio --desk`. Pins: `P+`, `P-` (BMS output leads).
* **Reference [K/U]:** props `chem: 'lfp-4s' | 'liion-3s'` (default `lfp-4s`), `parallel: 1..4`, `bmsA` (default 10).
  * LFP cell (IFR18650, about 1.4–1.5 Ah, 3.2 V nominal, 2.5–3.65 V) ×4 series → 12.8 V nominal, 10.0–14.6 V. The agent picks one cell datasheet and cites it, e.g. a Lithium Werks/A123 APR18650M1B sheet (1.1 Ah) or an EVE/Lishen IFR18650.
  * Li-ion NMC cell (e.g. Samsung INR18650-35E: 3.4 Ah, 3.6 V nominal, 2.65–4.2 V, 8 A max continuous) ×3 → 10.8–11.1 V nominal, 12.6 V full. The agent finds and cites the Samsung SDI 35E spec sheet.
  * BMS: 4S LFP / 3S Li-ion protection board (over-charge about 3.75 V/cell LFP, 4.25 V/cell Li-ion; over-discharge about 2.5–2.8 V/cell; over-current about bmsA). Values [U]: cite a BMS sheet, or label them typical.
* **Dimensions:** an 18650 cell is Ø18.4 × 65.2 mm [K]. Pack = cells side by side in a holder or shrink-wrapped (e.g. 4S1P about 74 × 65 × 19 mm + BMS board). Compute it from the props; that is the BOM/CAD number.
* **Behaviour:** `supplies(props)`: `{pos:'P+',neg:'P-',volts:ocv(soc,chem)·series,maxMa:bmsA·1000}`, with the OCV curve per chemistry (LFP flat about 3.2–3.3 V from 20–90 % SoC, which is why LFP SoC by voltage is poor: put that in the note). Inputs: `soc` 0–100, `tempC`. **The BMS cut-off opens the output:** volts 0 / supply absent below the UVP, with state `bms:'uvp'|'ovp'|'ok'|'ocp'|'cold-charge'` (LFP must not charge below 0 °C [K]). State: volts, soc, Wh = nominal V × Ah × parallel, chem.
* **Visual identity:** cells in blue/green PVC shrink (LFP often grey), nickel strips, a small green BMS PCB with balance wires, a thick red/black lead pair, and an optional XT60.
* **Callouts:** the BMS (what it protects), the chemistry to match the controller setting, capacity in Wh, the "fuse P+ within 10 cm" note.

### F4 · `enclosure-ip65`: IP65 junction box with cable glands (model-only)
* **Scaffold:** `npm run lab:new-part -- enclosure-ip65 --protocol gpio --desk`, then `runtime:'not-emulated'`. **No pins** (a passive housing; the contract allows a desk prop with no pins). `state()` returns `{runtime:'not-emulated',size,glands}`.
* **Reference:** IP65 = dust-tight + water jets (IEC 60529) [K]. A Hammond 1554 series (polycarbonate, IP66/IP68, NEMA 4X) is the cited example, e.g. 1554X2GY 299.7 × 198.1 × 89.9 mm, 1554WA2GYSL 180.3 × 180.3 × 89.9 mm, 1554D2GYCL 66 × 119 × 61 mm [V, RS/Farnell listings]: https://uk.rs-online.com/web/p/general-purpose-enclosures/2291109 , https://uk.farnell.com/hammond/1554x2gysl/enclosure-pc-200mmx300mmx200mm/dp/3649408 . The common generic ABS IP65 sizes are 150 × 110 × 70, 200 × 120 × 75 and 250 × 150 × 100 mm [U, retail]. Props: `size` (choice of the above, default 200×120×75), `lid: grey | clear`, `glands` (1–6), `glandSize: pg7 | pg9 | m16 | m20` with the cable clamping ranges in the docs page (typical PG7 about 3–6.5 mm, PG9 about 4–8 mm, M16 about 4–8 mm, M20 about 6–12 mm [U: cite a gland maker's sheet, e.g. a Lapp SKINTOP or Hammond gland datasheet]).
* **Behaviour:** none (model-only), but export `ENCLOSURE_SIZES` and `GLAND_RANGES`, because Pro M4 places the node parts inside the box and M6 checks "cable OD within the gland range" and "glands on the bottom face only".
* **Visual identity:** a light-grey box with a slightly domed lid and 4 captive lid screws in the corners, a grey or clear lid (prop), an internal mounting-plate outline, black glands with dome nuts on the bottom face, and a vent/breather plug option.
* **Callouts:** glands at the bottom ("drip loop on every cable"), lid screws/gasket, the breather (condensation in the tropics), the mounting plate.
* **Section view (for Pro M4):** the part sets `userData.section=true` on the lid and walls so a future section tool can cut it. That is a convention proposal; report it, since no core reads it yet.

---

## 2. Open items for the integrator (not for the part agents)

1. **BoardId:** Pro nodes need `board: 'esp32s3' | 'pico' | 'rpi4' | 'rpi5'` (or a Pro-side board field) in `boards.ts` / `contract.ts` / `circuit-spec.ts`. These are core files, so M2 owns them. The M3 kinds expose the pin tables that M2 maps to.
2. **RS-485 / byte-link bus helper** in `sim/devices/core`, so that `max485` ↔ `soil-npk-rs485` can talk (C2 reports this gap). Until then the NPK probe stays model-only.
3. **Cross-part property checks** (controller chemistry vs pack, relay trigger vs 3.3 V MCU, NE555 on 3.3 V, MAX485 RO 5 V into a 3.3 V pin, a missing flyback diode, a missing DS18B20 4.7 k pull-up, Ra-02 433 MHz in Indonesia) belong to the Pro design checks (M6), since devices cannot read peer props.
4. **Section-view hint** (`userData.section`) for M4 (F4 proposes it).
5. **IDR price ranges for the BOM:** not gathered here, because no source was checked. M6 needs a sourced price table, e.g. from Indonesian retail listings, with a date.
6. `docs/lab-parts/README.md` is regenerated by each scaffold run. With 6 agents scaffolding in parallel, re-run any `lab:new-part` once after the merge (see the guide).
