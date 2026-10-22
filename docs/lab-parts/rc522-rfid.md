# RC522 RFID reader

Protocol: `spi`. The common blue RC522 module (NXP MFRC522 chip, 13.56 MHz, 60 x 39 mm) with an 8-pin header: SDA (this is the SPI chip select, SS), SCK, MOSI, MISO, IRQ, GND, RST, 3V3. It is a desk prop; the pins are wire terminals.

- Device (simulation): `apps/web/src/lab/sim/devices/rc522-rfid.ts`
- Part (3D): `apps/web/src/lab/scene/parts/rc522-rfid.ts`
- Test: `tests/lab-part-rc522-rfid.test.ts` (register level unit tests plus a real-firmware test, fixture `tests/fixtures/sketches/rc522-uid.ino`)

## Fidelity

SPI (mode 0, MSB first; any other mode reads back 0xFF):
- Address byte `(addr << 1) | 0x80` for a read, `(addr << 1)` for a write. A read returns the data of the previous address on the next byte (burst reads repeat the address and end with 0x00), a write sends the address once and then data bytes to the same register (FIFO fill).
- Register file with the datasheet reset values, `VersionReg` 0x37 = 0x92, read-only registers, `ComIrqReg` / `DivIrqReg` with the bit-7 set/clear rule, 64-byte FIFO with level, flush (bit 7 of `FIFOLevelReg`), overflow (`ErrorReg` BufferOvfl) and water-level alerts in `Status1Reg`.
- Commands (`CommandReg`): Idle, Mem, GenerateRandomID, CalcCRC, SoftReset (PowerDown bit 4 reads 1 for about 1 ms while the oscillator starts), Transceive with `BitFramingReg` StartSend. Transmit, Receive and MFAuthent are accepted and do nothing.
- The CRC coprocessor: CRC_A with the preset taken from `ModeReg` (0x6363 for the usual 0x3D), result in `CRCResultReg`, `DivIrqReg` CRCIRq after 8 bits per 13.56 MHz clock, `Status1Reg` CRCReady.
- The internal timer: `TModeReg` TAuto, prescaler (`f = 13.56 MHz / (2 * TPrescaler + 1)`), reload. With the library values (0xA9 / 0x03E8) the TimerIRq arrives 25 ms after the end of the transmitted frame when nobody answers.
- `TxControlReg`: the field is on only when bits 1:0 are set; switching it off resets the card (it lost power).
- `TxModeReg` / `RxModeReg` bit 7: the reader appends and checks/strips the CRC itself.
- The IRQ pin follows `ComIEnReg` / `ComIrqReg` (`ComIEnReg` bit 7 inverts it; idle high with the default 0x80). The RST pin: the sketch driving it low powers the chip down and clears the registers, the rising edge restarts it (about 1 ms).
- Frame times at 106 kbit/s: 9.44 us per bit, 9 bits per byte (parity), 91 us before the card answers. `TxIRq` comes at the end of the reader frame, `RxIRq | IdleIRq` at the end of the card's answer.

The card (ISO/IEC 14443-3 type A), chosen in the popover:
- `card1` white card, 4-byte UID `4B A2 1F 93`, ATQA `04 00`, SAK 0x08.
- `card2` key fob, 4-byte UID `07 C5 6E 2D`, ATQA `04 00`, SAK 0x08.
- `card3` sticker tag, 7-byte UID `04 6A B1 2C 5F 71 80`, ATQA `44 00`, SAK 0x00 after two cascade levels (cascade tag 0x88 and SAK bit 2 on level 1).
- State machine IDLE, READY, ACTIVE, HALT. REQA is answered in IDLE/READY, WUPA also in HALT. Anticollision (NVB 0x20, and byte-aligned partial NVB), SELECT with a CRC_A check (a wrong CRC is ignored), HLTA (no answer, the card halts). The UIDs are made up.

## Not modelled (honest list)

- MIFARE authentication (Crypto1) and READ/WRITE of blocks: such frames get no answer, so the reader times out. The sketch can find the card and its UID, but cannot read its data.
- Bit-oriented anticollision (partial NVB with extra bits), `RxAlign`, parity and collision errors (there is only ever one card), RF field strength and range, the self test and the analog test registers.
- Power: the real module is a 3.3 V part and 5 V damages it (`power` is 2.5-3.6 V on 3V3/GND). The module's 5 V-tolerant logic is not claimed: use 3.3 V logic or a level shifter on a real board.

## Provenance

Own work from the public NXP MFRC522 datasheet (rev. 3.9) and ISO/IEC 14443-3 behaviour. The sketch driver in the test fixture is our own, no vendor library. No vendor model, photo or logo; the board is modelled from its public dimensions and the card UIDs are invented.
