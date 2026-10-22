// Test fixture: SD card start-up over SPI mode in our own code (CMD0, CMD8, ACMD41, CMD58, CMD9 for the size, CMD17/CMD24 raw blocks).
// CS = D10, 250 kHz. Prints every step so a test can check the answers. No file system: this talks to blocks only.
#include <SPI.h>
const uint8_t CS = 10;

uint8_t cmd(uint8_t c, uint32_t a, uint8_t crc) {
  SPI.transfer(0x40 | c);
  SPI.transfer(a >> 24); SPI.transfer(a >> 16); SPI.transfer(a >> 8); SPI.transfer(a);
  SPI.transfer(crc);
  uint8_t r = 0xFF;
  for (uint8_t i = 0; i < 10; i++) { r = SPI.transfer(0xFF); if (!(r & 0x80)) break; }
  return r;
}
void hex2(uint8_t b) { if (b < 16) Serial.print('0'); Serial.print(b, HEX); }
bool waitToken() {
  for (uint16_t i = 0; i < 2000; i++) if (SPI.transfer(0xFF) == 0xFE) return true;
  return false;
}

void setup() {
  Serial.begin(9600);
  pinMode(CS, OUTPUT);
  digitalWrite(CS, HIGH);
  SPI.begin();
  SPI.beginTransaction(SPISettings(250000, MSBFIRST, SPI_MODE0));
  for (uint8_t i = 0; i < 10; i++) SPI.transfer(0xFF);   // 80 clocks with CS high
  digitalWrite(CS, LOW);
  uint8_t r = cmd(0, 0, 0x95);
  Serial.print("cmd0="); hex2(r); Serial.println();
  if (r != 0x01) { Serial.println("no card"); return; }
  r = cmd(8, 0x1AA, 0x87);
  Serial.print("cmd8="); hex2(r);
  bool v2 = !(r & 0x04);
  if (v2) { Serial.print(" "); for (uint8_t i = 0; i < 4; i++) hex2(SPI.transfer(0xFF)); }
  Serial.println();
  uint16_t tries = 0;
  do {
    cmd(55, 0, 0x01);
    r = cmd(41, v2 ? 0x40000000UL : 0, 0x01);
    if (r) delay(5);
  } while (r != 0 && ++tries < 200);
  Serial.print("acmd41="); hex2(r); Serial.print(" tries="); Serial.println(tries);
  uint32_t ocr = 0;
  r = cmd(58, 0, 0x01);
  for (uint8_t i = 0; i < 4; i++) ocr = (ocr << 8) | SPI.transfer(0xFF);
  Serial.print("ocr="); Serial.println(ocr, HEX);
  bool hc = ocr & 0x40000000UL;
  // CSD gives the size
  r = cmd(9, 0, 0x01);
  uint8_t csd[16];
  if (r == 0 && waitToken()) {
    for (uint8_t i = 0; i < 16; i++) csd[i] = SPI.transfer(0xFF);
    SPI.transfer(0xFF); SPI.transfer(0xFF);
    uint32_t mb;
    if ((csd[0] >> 6) == 1) {
      uint32_t cs = ((uint32_t)(csd[7] & 0x3F) << 16) | ((uint32_t)csd[8] << 8) | csd[9];
      mb = (cs + 1) / 2;
    } else {
      uint16_t cs = ((csd[6] & 3) << 10) | (csd[7] << 2) | (csd[8] >> 6);
      uint8_t mult = ((csd[9] & 3) << 1) | (csd[10] >> 7);
      uint8_t bl = csd[5] & 0x0F;
      mb = ((uint32_t)(cs + 1) << (mult + 2)) >> (20 - bl);
    }
    Serial.print("size="); Serial.print(mb); Serial.println("MB");
  } else Serial.println("csd failed");
  // raw block 0 (a blank card reads zeros), then write block 5 and read it back
  uint32_t sum = 0;
  r = cmd(17, 0, 0x01);
  if (r == 0 && waitToken()) { for (uint16_t i = 0; i < 512; i++) sum += SPI.transfer(0xFF); SPI.transfer(0xFF); SPI.transfer(0xFF); }
  Serial.print("blk0 sum="); Serial.println(sum);
  uint32_t a5 = hc ? 5UL : 5UL * 512;
  r = cmd(24, a5, 0x01);
  if (r == 0) {
    SPI.transfer(0xFF);
    SPI.transfer(0xFE);
    for (uint16_t i = 0; i < 512; i++) SPI.transfer((uint8_t)(i * 3));
    SPI.transfer(0xFF); SPI.transfer(0xFF);
    uint8_t resp = SPI.transfer(0xFF) & 0x1F;
    Serial.print("write="); hex2(resp); Serial.println();
    uint16_t busy = 0;
    while (SPI.transfer(0xFF) == 0x00 && ++busy < 30000) {}
    Serial.print("busy="); Serial.println(busy > 0 ? "yes" : "no");
  }
  sum = 0;
  r = cmd(17, a5, 0x01);
  if (r == 0 && waitToken()) { for (uint16_t i = 0; i < 512; i++) sum += SPI.transfer(0xFF); SPI.transfer(0xFF); SPI.transfer(0xFF); }
  Serial.print("blk5 sum="); Serial.println(sum);
  digitalWrite(CS, HIGH);
  SPI.endTransaction();
  Serial.println("done");
}
void loop() {}
