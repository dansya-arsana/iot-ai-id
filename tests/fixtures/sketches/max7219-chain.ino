// Test fixture: four chained MAX7219 8x8 modules, LOAD on D10, our own driver on SPI.h. Draws a different picture on every module,
// then raises the brightness of the last one and finally shows the Code B digits "7" on module 0 row 0 (decode mode bit 0).
#include <SPI.h>
const uint8_t LOAD = 10, N = 4;

// one frame: the same register on every chip but with its own data (data[0] is module 0, the one next to the MCU)
void sendAll(uint8_t reg, const uint8_t *data) {
  SPI.beginTransaction(SPISettings(4000000, MSBFIRST, SPI_MODE0));
  digitalWrite(LOAD, LOW);
  for (int8_t m = N - 1; m >= 0; m--) {   // the first word goes to the farthest chip
    SPI.transfer(reg);
    SPI.transfer(data[m]);
  }
  digitalWrite(LOAD, HIGH);
  SPI.endTransaction();
}
void sendSame(uint8_t reg, uint8_t v) {
  uint8_t d[N];
  for (uint8_t i = 0; i < N; i++) d[i] = v;
  sendAll(reg, d);
}

const uint8_t smiley[8] = {0x3C, 0x42, 0xA5, 0x81, 0xA5, 0x99, 0x42, 0x3C};
void setup() {
  Serial.begin(9600);
  pinMode(LOAD, OUTPUT);
  digitalWrite(LOAD, HIGH);
  SPI.begin();
  sendSame(0x0F, 0x00);   // display test off
  sendSame(0x09, 0x00);   // no decode
  sendSame(0x0B, 0x07);   // scan all 8 digits
  sendSame(0x0A, 0x04);   // intensity
  sendSame(0x0C, 0x01);   // normal operation
  for (uint8_t r = 0; r < 8; r++) {
    uint8_t d[N];
    d[0] = smiley[r];                   // module 0: smiley
    d[1] = (r & 1) ? 0xAA : 0x55;       // module 1: checker board
    d[2] = 1 << r;                      // module 2: diagonal
    d[3] = 0xFF;                        // module 3: all on
    sendAll(r + 1, d);
  }
  // module 3 brighter: intensity 15 for chip 3 only, 4 for the others
  uint8_t ints[N] = {4, 4, 4, 15};
  sendAll(0x0A, ints);
  // module 0 digit 0 in Code B: decode bit 0 set, the value 7 (plus decimal point)
  uint8_t dec[N] = {0x01, 0, 0, 0};
  sendAll(0x09, dec);
  uint8_t seven[N] = {0x87, 0, 0, 0};
  sendAll(0x01, seven);
  Serial.println("drawn");
}
void loop() { delay(100); }
