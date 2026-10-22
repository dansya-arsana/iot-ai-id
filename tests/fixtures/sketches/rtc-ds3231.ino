// Test fixture: DS3231 + AT24C32 over Wire, no library. Sets a time, arms alarm 1 for second 00, uses the EEPROM with ACK polling.
#include <Wire.h>
const uint8_t RTC = 0x68, EE = 0x57;
uint8_t bcd(uint8_t v) { return ((v / 10) << 4) | (v % 10); }
uint8_t dec(uint8_t b) { return (b >> 4) * 10 + (b & 15); }
void wr(uint8_t reg, uint8_t v) { Wire.beginTransmission(RTC); Wire.write(reg); Wire.write(v); Wire.endTransmission(); }
uint8_t rd(uint8_t reg) { Wire.beginTransmission(RTC); Wire.write(reg); Wire.endTransmission(false); Wire.requestFrom(RTC, (uint8_t)1); return Wire.read(); }
uint16_t polls = 0;
void setup() {
  Serial.begin(9600);
  Wire.begin();
  Wire.beginTransmission(RTC);
  Wire.write(0);
  Wire.write(bcd(55)); Wire.write(bcd(59)); Wire.write(bcd(23)); Wire.write(6); Wire.write(bcd(15)); Wire.write(bcd(6)); Wire.write(bcd(30));
  Wire.endTransmission();
  wr(0x07, 0x00); wr(0x08, 0x80); wr(0x09, 0x80); wr(0x0A, 0x80);   // alarm 1: every minute at second 00
  wr(0x0F, 0x00);                                                   // clear OSF and the flags
  wr(0x0E, 0x1D);                                                   // INTCN + A1IE
  // EEPROM: write "Hi" at 0x0010, then poll until the chip answers again
  Wire.beginTransmission(EE); Wire.write(0x00); Wire.write(0x10); Wire.write('H'); Wire.write('i'); Wire.endTransmission();
  do { Wire.beginTransmission(EE); polls++; } while (Wire.endTransmission() != 0);
  Wire.beginTransmission(EE); Wire.write(0x00); Wire.write(0x10); Wire.endTransmission(false);
  Wire.requestFrom(EE, (uint8_t)2);
  char a = Wire.read(), b = Wire.read();
  Serial.print("ee="); Serial.print(a); Serial.print(b); Serial.print(" polls>0="); Serial.println(polls > 1);
}
void loop() {
  Wire.beginTransmission(RTC); Wire.write(0); Wire.endTransmission(false);
  Wire.requestFrom(RTC, (uint8_t)7);
  uint8_t s = dec(Wire.read() & 0x7F), m = dec(Wire.read()), h = dec(Wire.read() & 0x3F), dw = Wire.read(), d = dec(Wire.read()), mo = dec(Wire.read() & 0x1F), y = dec(Wire.read());
  Serial.print("20"); Serial.print(y); Serial.print('-'); Serial.print(mo); Serial.print('-'); Serial.print(d);
  Serial.print(' '); Serial.print(h); Serial.print(':'); Serial.print(m); Serial.print(':'); Serial.print(s);
  Serial.print(" dw="); Serial.print(dw); Serial.print(" A1F="); Serial.println(rd(0x0F) & 1);
  wr(0x0F, 0x00);   // clear the flag so the next minute can set it again
  delay(1000);
}
