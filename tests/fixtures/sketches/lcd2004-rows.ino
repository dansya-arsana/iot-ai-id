// Test fixture for the lcd2004-i2c part: our own HD44780 driver over a PCF8574 backpack (address 0x27, Wire only).
// Writes one line on each of the four rows (row starts 0x00, 0x40, 0x14, 0x54) and reads a DDRAM byte back.
#include <Wire.h>
const byte LCD = 0x27;
void expander(byte v) { Wire.beginTransmission(LCD); Wire.write(v); Wire.endTransmission(); }
void nibble(byte n, byte rs) {
  byte v = (n << 4) | 0x08 | rs;     // backlight on
  expander(v | 0x04);
  delayMicroseconds(1);
  expander(v);                       // falling E latches the nibble
  delayMicroseconds(50);
}
void send(byte b, byte rs) { nibble(b >> 4, rs); nibble(b & 0x0F, rs); }
void lcdInit() {
  delay(50);
  nibble(0x3, 0); delay(5); nibble(0x3, 0); delay(1); nibble(0x3, 0); delay(1); nibble(0x2, 0); delay(1);
  send(0x28, 0); send(0x0C, 0); send(0x01, 0); delay(2); send(0x06, 0);
}
void row(byte addr, const char *text) {
  send(0x80 | addr, 0);
  for (byte i = 0; i < 20 && text[i]; i++) send(text[i], 1);
}
byte readData() {                    // data read: RS = 1, RW = 1, E high, two nibbles
  expander(0xFF);                    // release the port (inputs high), RS RW E set
  expander(0xFF | 0x04);
  byte hi = 0;
  Wire.requestFrom(LCD, (byte)1);
  if (Wire.available()) hi = Wire.read() & 0xF0;
  expander(0xFB);
  expander(0xFF);
  Wire.requestFrom(LCD, (byte)1);
  byte lo = 0;
  if (Wire.available()) lo = Wire.read() & 0xF0;
  expander(0xFB);
  return hi | (lo >> 4);
}
void setup() {
  Serial.begin(9600);
  Wire.begin();
  lcdInit();
  row(0x00, "Row one: 20 columns");
  row(0x40, "Row two");
  row(0x14, "Row three (0x14)");
  row(0x54, "Row four (0x54)");
  send(0x80 | 0x14, 0);              // set address to the third row
  Serial.print("r3=0x"); Serial.println(readData(), HEX);
  Serial.println("ready");
}
void loop() { delay(100); }
