// Test fixture: BMP280 read with Wire and the Bosch integer compensation formulas written out here (our own code).
#include <Wire.h>
uint8_t ADDR = 0x76;
uint16_t dT1, dP1; int16_t dT2, dT3, dP2, dP3, dP4, dP5, dP6, dP7, dP8, dP9;
int32_t tfine;
uint8_t rd8(uint8_t r) { Wire.beginTransmission(ADDR); Wire.write(r); Wire.endTransmission(false); Wire.requestFrom(ADDR, (uint8_t)1); return Wire.read(); }
uint16_t rd16le(uint8_t r) { Wire.beginTransmission(ADDR); Wire.write(r); Wire.endTransmission(false); Wire.requestFrom(ADDR, (uint8_t)2); uint8_t lo = Wire.read(); uint8_t hi = Wire.read(); return (uint16_t)(lo | (hi << 8)); }
void wr8(uint8_t r, uint8_t v) { Wire.beginTransmission(ADDR); Wire.write(r); Wire.write(v); Wire.endTransmission(); }
int32_t compT(int32_t adc) {
  int32_t v1 = (((adc >> 3) - ((int32_t)dT1 << 1)) * (int32_t)dT2) >> 11;
  int32_t v2 = (((((adc >> 4) - (int32_t)dT1) * ((adc >> 4) - (int32_t)dT1)) >> 12) * (int32_t)dT3) >> 14;
  tfine = v1 + v2;
  return (tfine * 5 + 128) >> 8;
}
uint32_t compP(int32_t adc) {
  int64_t v1 = (int64_t)tfine - 128000;
  int64_t v2 = v1 * v1 * (int64_t)dP6;
  v2 = v2 + ((v1 * (int64_t)dP5) << 17);
  v2 = v2 + (((int64_t)dP4) << 35);
  v1 = ((v1 * v1 * (int64_t)dP3) >> 8) + ((v1 * (int64_t)dP2) << 12);
  v1 = (((((int64_t)1) << 47) + v1)) * ((int64_t)dP1) >> 33;
  if (v1 == 0) return 0;
  int64_t p = 1048576 - adc;
  p = (((p << 31) - v2) * 3125) / v1;
  v1 = (((int64_t)dP9) * (p >> 13) * (p >> 13)) >> 25;
  v2 = (((int64_t)dP8) * p) >> 19;
  p = ((p + v1 + v2) >> 8) + (((int64_t)dP7) << 4);
  return (uint32_t)p;
}
uint16_t readEvery = 500;
void setup() {
  Serial.begin(9600);
  Wire.begin();
  Serial.print("id="); Serial.println(rd8(0xD0), HEX);
  dT1 = rd16le(0x88); dT2 = rd16le(0x8A); dT3 = rd16le(0x8C);
  dP1 = rd16le(0x8E); dP2 = rd16le(0x90); dP3 = rd16le(0x92); dP4 = rd16le(0x94); dP5 = rd16le(0x96);
  dP6 = rd16le(0x98); dP7 = rd16le(0x9A); dP8 = rd16le(0x9C); dP9 = rd16le(0x9E);
  Serial.println("ready");
}
void loop() {
  wr8(0xF4, (1 << 5) | (3 << 2) | 1);   // temperature x1, pressure x4, forced mode
  delay(20);
  Wire.beginTransmission(ADDR); Wire.write(0xF7); Wire.endTransmission(false);
  Wire.requestFrom(ADDR, (uint8_t)6);
  uint8_t b[6];
  for (uint8_t i = 0; i < 6; i++) b[i] = Wire.read();
  int32_t adcP = ((int32_t)b[0] << 12) | ((int32_t)b[1] << 4) | (b[2] >> 4);
  int32_t adcT = ((int32_t)b[3] << 12) | ((int32_t)b[4] << 4) | (b[5] >> 4);
  int32_t t = compT(adcT);
  uint32_t p = compP(adcP);
  Serial.print("T="); Serial.print(t);
  Serial.print(" P="); Serial.println(p / 256);
  Serial.print("status="); Serial.println(rd8(0xF3));
  delay(readEvery);
}
