---
name: lora-as923-id
version: 1
summary: LoRa for Indonesia on 920 to 923 MHz (AS923): modules, antennas, range and link-budget habits.
---
# LoRa in Indonesia (920 to 923 MHz)

## Band
- Use 920 to 923 MHz. Do not design with a 433 MHz module in Pro: treat it as an error and swap it. The default module is the RFM95W (SX1276 class, 868/915 family tuned for the 920 to 923 band in firmware).
- The company holds an official licence. Regulatory power and duty-cycle limits are information only: mention them if asked, never block or warn a design for them. Band correctness still applies.

## Hardware habits
- Always fit the antenna before powering the radio; transmitting without one can damage the module.
- Antenna cut for the band (quarter wave is about 8 cm). A proper 3 dBi antenna on a pole beats a longer cable with a worse antenna. Keep the antenna vertical, clear of metal and at least a few cm from other electronics.
- RFM95W is 3.3 V only. Do not power it from 5 V and do not feed 5 V logic into it. Peak transmit current is about 120 mA at 20 dBm: size the regulator and battery for it.
- Common ESP32 pin plan used by the tools: RST on 14, DIO0 on 26, SPI on the default VSPI pins. `allocate_pins` and `validate_netlist` decide; do not invent pins.

## Link budget
- Use `estimate_link`. It returns an estimate, never a guarantee: margin of 18 dB or more is ok, 10 to 18 is a warning, under 10 is an error.
- Higher spreading factor (SF) gives more range and less data rate and more battery per message. SF7 to SF9 suits most farms; SF10 to SF12 only for hard links.
- Terrain matters more than distance: open paddy gives kilometres, dense plantation or hills can cut it to a few hundred metres. Foliage in the wet season absorbs more. Raise the gateway antenna first.
- Ask for the distance and terrain between each node and the gateway. If unknown, say the margin is a guess and add a range-test item to the checklist.

## Network design
- One gateway per site is the default. Nodes send small payloads (a few bytes of readings) at low rate, for example once every 5 to 15 minutes.
- Add an acknowledgement or a retry for actuator commands; sensors can send and forget.
- The gateway needs mains or a bigger solar system and an uplink (Wi-Fi, Ethernet or cellular). Say which.
