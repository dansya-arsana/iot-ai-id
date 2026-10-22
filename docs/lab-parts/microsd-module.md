# microSD card module

Protocol: `spi`. The common 6-pin microSD breakout (about 42 x 24 mm, push-push slot, 3.3 V regulator and level-shifter chip). Pins in module order: GND, VCC (5 V), MISO, MOSI, SCK, CS. Desk prop. The popover chooses the card (none, old v1 standard card, v2 standard card, SDHC) and its size (1, 2, 8, 16, 32 GB).

- Device (simulation): `apps/web/src/lab/sim/devices/microsd-module.ts`
- Part (3D): `apps/web/src/lab/scene/parts/microsd-module.ts`
- Test: `tests/lab-part-microsd-module.test.ts` (unit tests plus a real-firmware start-up, fixture `tests/fixtures/sketches/microsd-init.ino`)

## What it is, and what it is not

It answers the SD card start-up conversation in SPI mode, so a sketch can tell that a card is present, its type and its size. **It has no file system.** The card is blank (blocks you never wrote read as zeros, there is no FAT, no MBR). SD/FAT libraries get through card detection and then stop at the volume step ("no FAT partition"); raw block reads and writes work. Say this honestly in any lesson that uses it.

## Fidelity

- Command frames: `0x40 | index`, 32-bit argument, CRC7 << 1 | 1. The card powers up in SD mode and only a CMD0 with its valid CRC (0x95) switches it to SPI mode (a wrong CRC is silence). In SPI mode the CRC is checked only for CMD0 and CMD8 until CMD59 turns it on for everything (a bad CRC gives R1 bit 3).
- Response timing: one 0xFF byte (NCR = 1) then R1. R1 bits: idle 0x01, illegal command 0x04, CRC error 0x08, address error 0x20, parameter error 0x40.
- CMD0 (R1 idle), CMD8 (R7 echoes voltage range and check pattern; only version-2 cards answer, a version-1 card says illegal command; an unsupported voltage range gets silence), CMD55 + ACMD41 (idle until 25 ms after the first ACMD41, then 0x00; HCS decides high capacity), CMD58 (OCR: power-up done bit 31, CCS bit 30 only for SDHC when HCS was asked, 2.7-3.6 V window), CMD59, CMD16, CMD9 (CSD v2 for SDHC, v1 for standard cards, size decodes back to the chosen size, real CRC7 and CRC16) and CMD10 (CID).
- CMD17 single-block read: R1, filler, token 0xFE, 512 bytes, CRC16. CMD24 single-block write: R1, token 0xFE, 512 bytes plus CRC16, data response 0x05, busy (MISO low) for 3 ms. Written blocks are kept (up to 256 blocks, 128 KiB) and read back. Standard-capacity cards are byte addressed (an address that is not a multiple of 512 gives an address error), SDHC is block addressed, addresses past the capacity give a parameter error. Standard-capacity cards stop at 2 GB.
- SPI mode 0 or 3 only. Init above 400 kHz still works but sets `fastInit`. The state shows the phase (empty, sd-mode, idle, ready), the card type, size and counters. A card change in the popover is a new power-up.

## Not modelled

- A file system (FAT/exFAT), multi-block read/write (CMD18/CMD25), CMD12, erase, CMD6, write protect, UHS, the real 74-clock power-up requirement (the SPI bus draws one SCK pulse per byte, so the clocks are counted as 8 per pulse for information, `initClocks`, and CMD0 is answered even before 74 clocks, as most real cards do), CRC16 checking of written data, CSD/CID details beyond size and a made-up maker.
- Power: the board has its own 3.3 V regulator and level shifter, so VCC must be 4.5-5.5 V (`power` rail VCC/GND).

## Provenance

Own work from the public SD Physical Layer Simplified Specification (SPI mode chapter). The sketch in the fixture is our own code. No vendor model, photo or logo.
