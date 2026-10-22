// Test fixture: minimal MFRC522 reader (our own driver, SPI.h only). Reads the UID of one ISO 14443-A card: REQA, anticollision, select (two
// cascade levels for 7-byte UIDs), HLTA. Prints "uid=XXXXXXXX sak=SS atqa=AAAA" or "no card".
#include <SPI.h>
const uint8_t SS_PIN = 10, RST_PIN = 9;
enum { CommandReg = 0x01, ComIrqReg = 0x04, DivIrqReg = 0x05, ErrorReg = 0x06, FIFODataReg = 0x09, FIFOLevelReg = 0x0A, BitFramingReg = 0x0D,
       ModeReg = 0x11, TxControlReg = 0x14, TxASKReg = 0x15, CRCResultRegH = 0x21, CRCResultRegL = 0x22, TModeReg = 0x2A, TPrescalerReg = 0x2B,
       TReloadRegH = 0x2C, TReloadRegL = 0x2D, VersionReg = 0x37 };

uint8_t rd(uint8_t r) {
  SPI.beginTransaction(SPISettings(4000000, MSBFIRST, SPI_MODE0));
  digitalWrite(SS_PIN, LOW);
  SPI.transfer(0x80 | (r << 1));
  uint8_t v = SPI.transfer(0);
  digitalWrite(SS_PIN, HIGH);
  SPI.endTransaction();
  return v;
}
void wr(uint8_t r, uint8_t v) {
  SPI.beginTransaction(SPISettings(4000000, MSBFIRST, SPI_MODE0));
  digitalWrite(SS_PIN, LOW);
  SPI.transfer(r << 1);
  SPI.transfer(v);
  digitalWrite(SS_PIN, HIGH);
  SPI.endTransaction();
}

void crc(const uint8_t *d, uint8_t n, uint8_t *out) {
  wr(CommandReg, 0x00);
  wr(DivIrqReg, 0x04);
  wr(FIFOLevelReg, 0x80);
  for (uint8_t i = 0; i < n; i++) wr(FIFODataReg, d[i]);
  wr(CommandReg, 0x03);
  for (uint16_t i = 0; i < 5000; i++) if (rd(DivIrqReg) & 0x04) break;
  wr(CommandReg, 0x00);
  out[0] = rd(CRCResultRegL);
  out[1] = rd(CRCResultRegH);
}

// send tx[0..n), lastBits valid bits in the last byte (0 = 8); returns the answer length or -1 on timeout/error
int8_t xcv(const uint8_t *tx, uint8_t n, uint8_t lastBits, uint8_t *rx) {
  wr(CommandReg, 0x00);
  wr(ComIrqReg, 0x7F);
  wr(FIFOLevelReg, 0x80);
  for (uint8_t i = 0; i < n; i++) wr(FIFODataReg, tx[i]);
  wr(BitFramingReg, lastBits);
  wr(CommandReg, 0x0C);
  wr(BitFramingReg, rd(BitFramingReg) | 0x80);
  uint32_t t0 = millis();
  for (;;) {
    uint8_t irq = rd(ComIrqReg);
    if (irq & 0x30) break;
    if (irq & 0x01) return -1;
    if (millis() - t0 > 60) return -1;
  }
  if (rd(ErrorReg) & 0x13) return -1;
  uint8_t lvl = rd(FIFOLevelReg);
  for (uint8_t i = 0; i < lvl; i++) rx[i] = rd(FIFODataReg);
  return lvl;
}

void hex2(uint8_t b) { if (b < 16) Serial.print('0'); Serial.print(b, HEX); }

void setup() {
  Serial.begin(9600);
  pinMode(SS_PIN, OUTPUT);
  digitalWrite(SS_PIN, HIGH);
  pinMode(RST_PIN, OUTPUT);
  digitalWrite(RST_PIN, LOW);
  delay(2);
  digitalWrite(RST_PIN, HIGH);
  delay(5);
  SPI.begin();
  wr(CommandReg, 0x0F);
  while (rd(CommandReg) & 0x10) delay(1);
  wr(TModeReg, 0x80);
  wr(TPrescalerReg, 0xA9);
  wr(TReloadRegH, 0x03);
  wr(TReloadRegL, 0xE8);
  wr(TxASKReg, 0x40);
  wr(ModeReg, 0x3D);
  wr(TxControlReg, rd(TxControlReg) | 0x03);
  Serial.print("ver=");
  hex2(rd(VersionReg));
  Serial.println();
  Serial.println("ready");
}

void loop() {
  uint8_t rx[16], tx[10];
  uint8_t uid[10], uidLen = 0, sak = 0;
  tx[0] = 0x26;
  int8_t n = xcv(tx, 1, 7, rx);
  if (n != 2) { Serial.println("no card"); delay(100); return; }
  uint8_t atqa0 = rx[0], atqa1 = rx[1];
  for (uint8_t level = 0; level < 2; level++) {
    uint8_t sel = level == 0 ? 0x93 : 0x95;
    tx[0] = sel; tx[1] = 0x20;
    n = xcv(tx, 2, 0, rx);
    if (n != 5) { Serial.println("anticollision failed"); delay(100); return; }
    uint8_t bcc = rx[0] ^ rx[1] ^ rx[2] ^ rx[3];
    if (bcc != rx[4]) { Serial.println("bcc error"); delay(100); return; }
    tx[0] = sel; tx[1] = 0x70;
    for (uint8_t i = 0; i < 5; i++) tx[2 + i] = rx[i];
    crc(tx, 7, tx + 7);
    uint8_t keep[4] = {rx[0], rx[1], rx[2], rx[3]};
    n = xcv(tx, 9, 0, rx);
    if (n != 3) { Serial.println("select failed"); delay(100); return; }
    sak = rx[0];
    if (keep[0] == 0x88) { for (uint8_t i = 1; i < 4; i++) uid[uidLen++] = keep[i]; }
    else { for (uint8_t i = 0; i < 4; i++) uid[uidLen++] = keep[i]; }
    if (!(sak & 0x04)) break;
  }
  Serial.print("uid=");
  for (uint8_t i = 0; i < uidLen; i++) hex2(uid[i]);
  Serial.print(" sak=");
  hex2(sak);
  Serial.print(" atqa=");
  hex2(atqa0); hex2(atqa1);
  Serial.println();
  tx[0] = 0x50; tx[1] = 0x00;
  crc(tx, 2, tx + 2);
  xcv(tx, 4, 0, rx);   // HLTA: the card never answers, the reader times out
  delay(300);
}
