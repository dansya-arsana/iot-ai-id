// Lesson 24: Real-time clock. A DS3231 keeps the time (I2C, address 0x68), a chain of four MAX7219 8x8 matrices shows HH:MM:SS (SPI),
// alarm 1 of the DS3231 pulls its SQW/INT pin low, and the buzzer on D8 rings. No libraries except Wire and SPI: the drivers below are ours.
byte alarmAfter = 6;           // seconds from boot until the alarm goes off
unsigned int beepMs = 2500;    // how long the alarm rings

#include <Wire.h>
#include <SPI.h>

const byte RTC = 0x68;         // DS3231 I2C address
const byte LOAD = 10;          // MAX7219 chip select (LOAD)
const byte SQW = 2;            // DS3231 INT/SQW, open drain, low while an alarm flag is set
const byte BUZZ = 8;
const byte CHIPS = 4;

// ---------- DS3231 ----------
byte toBcd(byte v) { return ((v / 10) << 4) | (v % 10); }
byte fromBcd(byte v) { return (v >> 4) * 10 + (v & 0x0F); }

// two digits with a leading zero: 7 -> 07
void print2(byte v) {
  if (v < 10) Serial.print('0');
  Serial.print(v);
}

void rtcWrite(byte reg, byte value) {
  Wire.beginTransmission(RTC);
  Wire.write(reg);
  Wire.write(value);
  Wire.endTransmission();
}

byte rtcRead(byte reg) {
  Wire.beginTransmission(RTC);
  Wire.write(reg);
  Wire.endTransmission();
  Wire.requestFrom(RTC, (byte)1);
  return Wire.available() ? Wire.read() : 0;
}

// seconds, minutes, hours in one burst (registers 0x00..0x02)
bool rtcTime(byte &s, byte &m, byte &h) {
  Wire.beginTransmission(RTC);
  Wire.write((byte)0);
  if (Wire.endTransmission() != 0) return false;
  if (Wire.requestFrom(RTC, (byte)3) != 3) return false;
  s = fromBcd(Wire.read() & 0x7F);
  m = fromBcd(Wire.read() & 0x7F);
  h = fromBcd(Wire.read() & 0x3F);
  return true;
}

void rtcSetTime(byte h, byte m, byte s) {
  Wire.beginTransmission(RTC);
  Wire.write((byte)0);
  Wire.write(toBcd(s));
  Wire.write(toBcd(m));
  Wire.write(toBcd(h));
  Wire.write((byte)4);          // day of week
  Wire.write(toBcd(15));        // date
  Wire.write(toBcd(1));         // month
  Wire.write(toBcd(26));        // year
  Wire.endTransmission();
}

// alarm 1: match hours, minutes and seconds (A1M4 set = ignore the date)
void rtcSetAlarm(byte h, byte m, byte s) {
  Wire.beginTransmission(RTC);
  Wire.write((byte)0x07);
  Wire.write(toBcd(s));
  Wire.write(toBcd(m));
  Wire.write(toBcd(h));
  Wire.write((byte)0x80);
  Wire.endTransmission();
  rtcWrite(0x0F, 0x00);         // clear the flags
  rtcWrite(0x0E, 0x05);         // INTCN = 1 (alarm output), A1IE = 1
}

// ---------- MAX7219 chain ----------
void sendAll(byte reg, const byte *data) {
  SPI.beginTransaction(SPISettings(4000000, MSBFIRST, SPI_MODE0));
  digitalWrite(LOAD, LOW);
  for (int8_t k = CHIPS - 1; k >= 0; k--) {   // the first word goes to the farthest chip
    SPI.transfer(reg);
    SPI.transfer(data[k]);
  }
  digitalWrite(LOAD, HIGH);
  SPI.endTransaction();
}

void sendSame(byte reg, byte value) {
  byte d[CHIPS];
  for (byte i = 0; i < CHIPS; i++) d[i] = value;
  sendAll(reg, d);
}

// 3 x 5 digits, one row per byte, bit 2 = left column
const byte DIGITS[10][5] = {
  {7, 5, 5, 5, 7}, {2, 6, 2, 2, 7}, {7, 1, 7, 4, 7}, {7, 1, 7, 1, 7}, {5, 5, 7, 1, 1},
  {7, 4, 7, 1, 7}, {7, 4, 7, 5, 7}, {7, 1, 1, 1, 1}, {7, 5, 7, 5, 7}, {7, 5, 7, 1, 7}
};

unsigned long rowBits[5];

// put a glyph of 3 columns into the 32-column picture at column col (0 = left edge)
void putDigit(byte value, byte col) {
  for (byte r = 0; r < 5; r++) {
    unsigned long bits = DIGITS[value][r];
    rowBits[r] |= bits << (29 - col);
  }
}

void putColon(byte col) {
  rowBits[1] |= 1UL << (31 - col);
  rowBits[3] |= 1UL << (31 - col);
}

void showTime(byte h, byte m, byte s) {
  for (byte r = 0; r < 5; r++) rowBits[r] = 0;
  putDigit(h / 10, 2);  putDigit(h % 10, 6);  putColon(10);
  putDigit(m / 10, 12); putDigit(m % 10, 16); putColon(20);
  putDigit(s / 10, 22); putDigit(s % 10, 26);
  for (byte r = 0; r < 8; r++) {
    byte d[CHIPS];
    for (byte k = 0; k < CHIPS; k++) {
      d[k] = (r >= 1 && r <= 5) ? (byte)(rowBits[r - 1] >> (8 * (CHIPS - 1 - k))) : 0;
    }
    sendAll(r + 1, d);
  }
}

bool ringing = false;
unsigned long ringStart = 0;
byte lastSecond = 99;

void setup() {
  Serial.begin(9600);
  pinMode(LOAD, OUTPUT);
  digitalWrite(LOAD, HIGH);
  pinMode(SQW, INPUT);
  pinMode(BUZZ, OUTPUT);
  Wire.begin();
  SPI.begin();
  sendSame(0x0F, 0x00);   // display test off
  sendSame(0x09, 0x00);   // no decode, we send pixels
  sendSame(0x0B, 0x07);   // scan all 8 rows
  sendSame(0x0A, 0x02);   // dim
  sendSame(0x0C, 0x01);   // normal operation

  // A clock that lost its backup battery has the OSF flag set: its time cannot be trusted, so set it.
  if (rtcRead(0x0F) & 0x80) {
    rtcSetTime(7, 30, 0);
    Serial.println("clock was stopped: set 07:30:00");
  }
  byte s = 0, m = 0, h = 0;
  rtcTime(s, m, h);
  unsigned long total = (unsigned long)h * 3600UL + (unsigned long)m * 60UL + s + alarmAfter;
  total %= 86400UL;
  rtcSetAlarm(total / 3600UL, (total / 60UL) % 60UL, total % 60UL);
  Serial.print("alarm at ");
  print2((byte)(total / 3600UL)); Serial.print(':');
  print2((byte)((total / 60UL) % 60UL)); Serial.print(':');
  print2((byte)(total % 60UL)); Serial.println();
  Serial.println("clock ready");
}

void loop() {
  unsigned long now = millis();
  byte s = 0, m = 0, h = 0;
  if (rtcTime(s, m, h) && s != lastSecond) {
    lastSecond = s;
    showTime(h, m, s);
  }
  if (!ringing && digitalRead(SQW) == LOW) {   // alarm 1 fired: the chip holds INT low until we clear A1F
    ringing = true;
    ringStart = now;
    sendSame(0x0A, 0x0F);                       // full brightness
    byte hi = rtcRead(0x11);                    // chip temperature: signed integer part, then 0.25 degree steps in the top 2 bits
    byte lo = rtcRead(0x12) >> 6;
    int centi = (int)(int8_t)hi * 100 + lo * 25;   // hundredths of a degree
    Serial.print("ALARM ");
    if (centi < 0) { Serial.print('-'); centi = -centi; }
    Serial.print(centi / 100);
    Serial.print('.');
    if (centi % 100 < 10) Serial.print('0');
    Serial.print(centi % 100);
    Serial.println(" C");
  }
  if (ringing) {
    unsigned long t = now - ringStart;
    if (t >= beepMs) {
      noTone(BUZZ);
      rtcWrite(0x0F, 0x00);                     // clear A1F, the chip releases INT
      sendSame(0x0A, 0x02);
      ringing = false;
      Serial.println("alarm cleared");
    } else if ((t / 250UL) % 2UL == 0UL) {
      tone(BUZZ, 2000);
    } else {
      noTone(BUZZ);
    }
  }
  delay(50);
}
