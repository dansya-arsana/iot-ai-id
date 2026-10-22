// Test fixture for the nokia5110-pcd8544 part: our own PCD8544 driver on hardware SPI (CE = D10, DC = D9, RST = D8).
// Initialises with the extended instruction set, clears the RAM, writes "HI 42" with a tiny 5x7 font and draws a frame with vertical addressing.
#include <SPI.h>
const byte CE = 10, DC = 9, RST = 8;
// columns of each glyph, bit 0 is the top pixel
const byte F_H[5] = {0x7F, 0x08, 0x08, 0x08, 0x7F};
const byte F_I[5] = {0x00, 0x41, 0x7F, 0x41, 0x00};
const byte F_4[5] = {0x18, 0x14, 0x12, 0x7F, 0x10};
const byte F_2[5] = {0x42, 0x61, 0x51, 0x49, 0x46};
void sendByte(byte dc, byte b) {
  digitalWrite(DC, dc);
  digitalWrite(CE, LOW);
  SPI.transfer(b);
  digitalWrite(CE, HIGH);
}
void cmd(byte b) { sendByte(LOW, b); }
void glyph(const byte *g) { for (byte i = 0; i < 5; i++) sendByte(HIGH, g[i]); sendByte(HIGH, 0); }
void setup() {
  Serial.begin(9600);
  pinMode(CE, OUTPUT); pinMode(DC, OUTPUT); pinMode(RST, OUTPUT);
  digitalWrite(CE, HIGH);
  SPI.begin();
  SPI.setClockDivider(SPI_CLOCK_DIV4);       // 4 MHz, mode 0, MSB first: the PCD8544 maximum
  digitalWrite(RST, LOW); delay(10); digitalWrite(RST, HIGH);
  cmd(0x21);                                 // function set: extended instruction set (H = 1)
  cmd(0xBF);                                 // Vop = 0x3F: contrast
  cmd(0x04);                                 // temperature coefficient 0
  cmd(0x14);                                 // bias 1:48
  cmd(0x20);                                 // back to the basic set, horizontal addressing, chip active
  for (int i = 0; i < 504; i++) sendByte(HIGH, 0x00);   // clear all 84 x 6 bytes (the RAM is random after power up)
  cmd(0x0C);                                 // normal display mode
  cmd(0x40 | 2); cmd(0x80 | 10);             // bank 2, column 10
  glyph(F_H); glyph(F_I); sendByte(HIGH, 0); sendByte(HIGH, 0); glyph(F_4); glyph(F_2);
  cmd(0x22);                                 // vertical addressing
  cmd(0x40 | 0); cmd(0x80 | 83);             // right edge: a vertical line down all six banks
  for (byte i = 0; i < 6; i++) sendByte(HIGH, 0xFF);
  cmd(0x20);
  Serial.println("ready");
}
void loop() { delay(100); }
