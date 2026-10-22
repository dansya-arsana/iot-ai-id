// Lesson 17: weather station. BMP280 (I2C 0x76, 3.3 V) + DHT22 (one wire on D2) -> 20x4 LCD (I2C 0x27) with min and max since power-up.
// Every driver here is ours: the BMP280 reader follows the integer compensation formulas of the public datasheet, the DHT22 reader times
// each pulse itself, and the LCD speaks to its PCF8574 backpack in 4-bit mode. Only Wire is used.
unsigned int readEvery = 2500;   // ms between screen updates (the DHT22 needs at least 2 s between readings)

#include <Wire.h>

const byte LCD = 0x27;
const byte BMP = 0x76;
const byte DATA_PIN = 2;

// ---------- LCD 20x4 ----------
void expander(byte v) { Wire.beginTransmission(LCD); Wire.write(v); Wire.endTransmission(); }
void nibble(byte n, byte rs) {
  byte v = (n << 4) | 0x08 | rs;   // backlight stays on
  expander(v | 0x04);              // E high ...
  delayMicroseconds(1);
  expander(v);                     // ... E low: the controller latches the nibble on this falling edge
  delayMicroseconds(50);
}
void lcdSend(byte b, byte rs) { nibble(b >> 4, rs); nibble(b & 0x0F, rs); }
void lcdInit() {
  delay(50);
  nibble(0x3, 0); delay(5);
  nibble(0x3, 0); delay(1);
  nibble(0x3, 0); delay(1);
  nibble(0x2, 0); delay(1);
  lcdSend(0x28, 0); lcdSend(0x0C, 0); lcdSend(0x01, 0); delay(2); lcdSend(0x06, 0);
}
const byte ROW_START[4] = {0x00, 0x40, 0x14, 0x54};   // DDRAM start of the four rows of a 20x4 display
void lcdRow(byte row, const char *text) {
  lcdSend(0x80 | ROW_START[row], 0);
  bool end = false;
  for (byte i = 0; i < 20; i++) {
    char ch = ' ';
    if (!end && text[i]) ch = text[i]; else end = true;
    lcdSend(ch, 1);
  }
}

// ---------- text helpers ----------
char *str(char *p, const char *s) { while (*s) *p++ = *s++; return p; }
char *num(char *p, long v) {
  if (v < 0) { *p++ = '-'; v = -v; }
  char t[8]; byte n = 0;
  do { t[n++] = '0' + v % 10; v /= 10; } while (v);
  while (n) *p++ = t[--n];
  return p;
}
// Serial twin of tenths(): 245 -> 24.5, -5 -> -0.5
void printTenths(long v) {
  if (v < 0) { Serial.print('-'); v = -v; }
  Serial.print(v / 10); Serial.print('.'); Serial.print(v % 10);
}

char *tenths(char *p, long v) {   // v is in tenths: 245 -> 24.5
  if (v < 0) { *p++ = '-'; v = -v; }
  p = num(p, v / 10);
  *p++ = '.';
  *p++ = '0' + v % 10;
  return p;
}

// ---------- DHT22 ----------
bool waitFor(bool level, byte maxPasses) {
  while (digitalRead(DATA_PIN) != level) { if (maxPasses-- == 0) return false; }
  return true;
}
bool readDht(int &tempT, int &humT) {
  byte b[5] = {0, 0, 0, 0, 0};
  pinMode(DATA_PIN, OUTPUT);
  digitalWrite(DATA_PIN, LOW);
  delay(18);                        // start signal: wire low for 18 ms
  digitalWrite(DATA_PIN, HIGH);
  pinMode(DATA_PIN, INPUT);
  noInterrupts();
  bool ok = waitFor(LOW, 100) && waitFor(HIGH, 100) && waitFor(LOW, 100);
  for (byte i = 0; ok && i < 40; i++) {
    ok = waitFor(HIGH, 100);
    if (!ok) break;
    delayMicroseconds(45);          // high for ~27 us is a 0, ~70 us is a 1: look 45 us in
    b[i / 8] = (b[i / 8] << 1) | digitalRead(DATA_PIN);
    ok = waitFor(LOW, 100);
  }
  interrupts();
  if (!ok || (byte)(b[0] + b[1] + b[2] + b[3]) != b[4]) return false;
  humT = ((unsigned int)b[0] << 8) | b[1];
  tempT = ((unsigned int)(b[2] & 0x7F) << 8) | b[3];
  if (b[2] & 0x80) tempT = -tempT;
  return true;
}

// ---------- BMP280 ----------
uint16_t dT1, dP1; int16_t dT2, dT3, dP2, dP3, dP4, dP5, dP6, dP7, dP8, dP9;
int32_t tfine;
uint8_t rd8(uint8_t r) { Wire.beginTransmission(BMP); Wire.write(r); Wire.endTransmission(false); Wire.requestFrom(BMP, (uint8_t)1); return Wire.read(); }
uint16_t rd16(uint8_t r) { Wire.beginTransmission(BMP); Wire.write(r); Wire.endTransmission(false); Wire.requestFrom(BMP, (uint8_t)2); uint8_t lo = Wire.read(); uint8_t hi = Wire.read(); return lo | (hi << 8); }
int32_t compT(int32_t adc) {        // 0.01 degrees C
  int32_t v1 = (((adc >> 3) - ((int32_t)dT1 << 1)) * (int32_t)dT2) >> 11;
  int32_t v2 = (((((adc >> 4) - (int32_t)dT1) * ((adc >> 4) - (int32_t)dT1)) >> 12) * (int32_t)dT3) >> 14;
  tfine = v1 + v2;
  return (tfine * 5 + 128) >> 8;
}
uint32_t compP(int32_t adc) {       // Pa in Q24.8
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
bool bmpOk = false;
bool bmpInit() {
  if (rd8(0xD0) != 0x58) return false;   // chip id of the BMP280
  dT1 = rd16(0x88); dT2 = rd16(0x8A); dT3 = rd16(0x8C);
  dP1 = rd16(0x8E); dP2 = rd16(0x90); dP3 = rd16(0x92); dP4 = rd16(0x94); dP5 = rd16(0x96);
  dP6 = rd16(0x98); dP7 = rd16(0x9A); dP8 = rd16(0x9C); dP9 = rd16(0x9E);
  return true;
}
// One forced measurement: temperature in tenths of a degree, pressure in whole hPa.
void readBmp(long &tempT, long &hpa) {
  Wire.beginTransmission(BMP); Wire.write(0xF4); Wire.write((2 << 5) | (3 << 2) | 1); Wire.endTransmission();   // T x2, P x4, forced
  delay(30);
  Wire.beginTransmission(BMP); Wire.write(0xF7); Wire.endTransmission(false);
  Wire.requestFrom(BMP, (uint8_t)6);
  uint8_t d[6];
  for (uint8_t i = 0; i < 6; i++) d[i] = Wire.read();
  int32_t adcP = ((int32_t)d[0] << 12) | ((int32_t)d[1] << 4) | (d[2] >> 4);
  int32_t adcT = ((int32_t)d[3] << 12) | ((int32_t)d[4] << 4) | (d[5] >> 4);
  int32_t t = compT(adcT);
  uint32_t p = compP(adcP);
  tempT = (t >= 0 ? t + 5 : t - 5) / 10;
  hpa = ((p >> 8) + 50) / 100;
}

// ---------- the station ----------
long tMin, tMax, pMin, pMax;
bool haveRange = false;

void setup() {
  Serial.begin(9600);
  pinMode(DATA_PIN, INPUT);
  Wire.begin();
  lcdInit();
  bmpOk = bmpInit();
  lcdRow(0, "Weather station");
  lcdRow(1, bmpOk ? "Measuring..." : "BMP280 not found");
  Serial.println("ready");
}

void loop() {
  int dhtT = 0, dhtH = 0;
  bool dhtOk = readDht(dhtT, dhtH);
  long bmpT = 0, hpa = 0;
  if (bmpOk) {
    readBmp(bmpT, hpa);
    if (!haveRange) { tMin = tMax = bmpT; pMin = pMax = hpa; haveRange = true; }
    if (bmpT < tMin) tMin = bmpT;
    if (bmpT > tMax) tMax = bmpT;
    if (hpa < pMin) pMin = hpa;
    if (hpa > pMax) pMax = hpa;
  }
  char line[24];
  char *p;
  if (dhtOk) {
    p = str(line, "DHT "); p = tenths(p, dhtT); p = str(p, "C  "); p = tenths(p, dhtH); p = str(p, "%");
  } else {
    p = str(line, "DHT22 no answer");
  }
  *p = 0;
  lcdRow(0, line);
  if (bmpOk) {
    p = str(line, "BMP "); p = tenths(p, bmpT); p = str(p, "C "); p = num(p, hpa); p = str(p, " hPa"); *p = 0;
    lcdRow(1, line);
    p = str(line, "Tmin "); p = tenths(p, tMin); p = str(p, " max "); p = tenths(p, tMax); *p = 0;
    lcdRow(2, line);
    p = str(line, "Pmin "); p = num(p, pMin); p = str(p, " max "); p = num(p, pMax); *p = 0;
    lcdRow(3, line);
    Serial.print("T="); printTenths(bmpT);
    Serial.print(" P="); Serial.print(hpa);
    Serial.print(" Tmin="); printTenths(tMin); Serial.print(" Tmax="); printTenths(tMax); Serial.println();
  }
  delay(readEvery);
}
