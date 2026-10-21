// Lesson 13: OLED dashboard. DHT22 on D2 (one wire), SSD1306 128x64 on I2C (A4 = SDA, A5 = SCL, address 0x3C).
// No libraries except Wire: the DHT22 reader and the tiny SSD1306 text driver below are ours.
unsigned int readEvery = 2000;   // ms between readings (the DHT22 needs at least 2 s)

#include <Wire.h>

const byte DATA_PIN = 2;
const byte OLED = 0x3C;

// ---------- DHT22 (same reader as lesson 12) ----------
bool waitFor(bool level, byte maxPasses) {
  while (digitalRead(DATA_PIN) != level) {
    if (maxPasses-- == 0) return false;
  }
  return true;
}

bool readDht(byte bytes[5]) {
  for (byte i = 0; i < 5; i++) bytes[i] = 0;
  pinMode(DATA_PIN, OUTPUT);
  digitalWrite(DATA_PIN, LOW);
  delay(18);
  digitalWrite(DATA_PIN, HIGH);
  pinMode(DATA_PIN, INPUT);
  noInterrupts();
  bool ok = waitFor(LOW, 100) && waitFor(HIGH, 100) && waitFor(LOW, 100);
  for (byte i = 0; ok && i < 40; i++) {
    ok = waitFor(HIGH, 100);
    if (!ok) break;
    delayMicroseconds(45);
    byte bit = digitalRead(DATA_PIN);
    bytes[i / 8] = (bytes[i / 8] << 1) | bit;
    ok = waitFor(LOW, 100);
  }
  interrupts();
  return ok && (byte)(bytes[0] + bytes[1] + bytes[2] + bytes[3]) == bytes[4];
}

// ---------- SSD1306 ----------
void oledCommand(byte a) {
  Wire.beginTransmission(OLED);
  Wire.write(0x00);              // control byte: Co = 0, D/C# = 0 -> command
  Wire.write(a);
  Wire.endTransmission();
}

void oledCommand2(byte a, byte b) {
  Wire.beginTransmission(OLED);
  Wire.write(0x00);
  Wire.write(a);
  Wire.write(b);
  Wire.endTransmission();
}

void oledInit() {
  oledCommand(0xAE);             // display off
  oledCommand2(0xD5, 0x80);      // clock
  oledCommand2(0xA8, 0x3F);      // 64 rows
  oledCommand2(0xD3, 0x00);      // no offset
  oledCommand(0x40);             // start line 0
  oledCommand2(0x8D, 0x14);      // charge pump on
  oledCommand2(0x20, 0x00);      // horizontal addressing: columns, then the next page
  oledCommand(0xA1);             // flip columns
  oledCommand(0xC8);             // flip rows (upright image)
  oledCommand2(0xDA, 0x12);
  oledCommand2(0x81, 0xCF);      // contrast
  oledCommand2(0xD9, 0xF1);
  oledCommand2(0xDB, 0x40);
  oledCommand(0xA4);             // follow RAM
  oledCommand(0xA6);             // normal (not inverted)
  oledCommand(0xAF);             // display on
}

// Draw area: columns x..x+w-1, pages p0..p1. The next data bytes fill it column by column, page by page.
void oledWindow(byte x, byte w, byte p0, byte p1) {
  Wire.beginTransmission(OLED);
  Wire.write(0x00);
  Wire.write(0x21); Wire.write(x); Wire.write(x + w - 1);
  Wire.write(0x22); Wire.write(p0); Wire.write(p1);
  Wire.endTransmission();
}

void oledClear() {
  oledWindow(0, 128, 0, 7);
  for (byte chunk = 0; chunk < 64; chunk++) {
    Wire.beginTransmission(OLED);
    Wire.write(0x40);            // control byte: D/C# = 1 -> display data
    for (byte i = 0; i < 16; i++) Wire.write((byte)0);
    Wire.endTransmission();
  }
}

// 5x7 font, one byte per column, bit 0 is the top row. Only the characters this dashboard needs.
const char GLYPHS[] = "0123456789.-CTH%ER ";
const byte FONT[][5] = {
  {0x3E, 0x51, 0x49, 0x45, 0x3E}, {0x00, 0x42, 0x7F, 0x40, 0x00}, {0x42, 0x61, 0x51, 0x49, 0x46},
  {0x21, 0x41, 0x45, 0x4B, 0x31}, {0x18, 0x14, 0x12, 0x7F, 0x10}, {0x27, 0x45, 0x45, 0x45, 0x39},
  {0x3C, 0x4A, 0x49, 0x49, 0x30}, {0x01, 0x71, 0x09, 0x05, 0x03}, {0x36, 0x49, 0x49, 0x49, 0x36},
  {0x06, 0x49, 0x49, 0x29, 0x1E}, {0x00, 0x60, 0x60, 0x00, 0x00}, {0x08, 0x08, 0x08, 0x08, 0x08},
  {0x3E, 0x41, 0x41, 0x41, 0x22}, {0x01, 0x01, 0x7F, 0x01, 0x01}, {0x7F, 0x08, 0x08, 0x08, 0x7F},
  {0x23, 0x13, 0x08, 0x64, 0x62}, {0x7F, 0x49, 0x49, 0x49, 0x41}, {0x7F, 0x09, 0x19, 0x29, 0x46},
  {0x00, 0x00, 0x00, 0x00, 0x00}
};

// One character at double size: 10 columns wide, two pages tall (every font pixel becomes a 2x2 block).
void oledBigChar(byte x, byte page, char ch) {
  byte g = 18;                                   // blank when unknown
  for (byte i = 0; GLYPHS[i]; i++) if (GLYPHS[i] == ch) g = i;
  byte top[10], bottom[10];
  for (byte c = 0; c < 5; c++) {
    byte col = FONT[g][c], t = 0, b = 0;
    for (byte r = 0; r < 4; r++) {
      if (col & (1 << r)) t |= 3 << (r * 2);       // font rows 0..3 -> pixel rows 0..7
      if (col & (1 << (r + 4))) b |= 3 << (r * 2); // font rows 4..6 (7 is blank) -> pixel rows 8..15
    }
    top[c * 2] = top[c * 2 + 1] = t;
    bottom[c * 2] = bottom[c * 2 + 1] = b;
  }
  oledWindow(x, 10, page, page + 1);
  Wire.beginTransmission(OLED);
  Wire.write(0x40);
  for (byte i = 0; i < 10; i++) Wire.write(top[i]);
  for (byte i = 0; i < 10; i++) Wire.write(bottom[i]);
  Wire.endTransmission();
}

// Ten character cells of 12 px each fill one line; pad with blanks so old text is overwritten.
void oledLine(byte page, const char *text) {
  bool end = false;
  for (byte i = 0; i < 10; i++) {
    char ch = ' ';
    if (!end && text[i]) ch = text[i]; else end = true;
    oledBigChar(i * 12, page, ch);
  }
}

// "T 24.0 C" from tenths of a degree; handles a minus sign.
void formatTenths(char *out, char tag, int tenths, char unit) {
  byte n = 0;
  out[n++] = tag;
  out[n++] = ' ';
  if (tenths < 0) { out[n++] = '-'; tenths = -tenths; }
  if (tenths >= 100) out[n++] = '0' + (tenths / 100) % 10;
  out[n++] = '0' + (tenths / 10) % 10;
  out[n++] = '.';
  out[n++] = '0' + tenths % 10;
  out[n++] = ' ';
  out[n++] = unit;
  out[n] = 0;
}

void setup() {
  Serial.begin(9600);
  pinMode(DATA_PIN, INPUT);
  Wire.begin();
  oledInit();
  oledClear();
  Serial.println("ready");
}

void loop() {
  byte b[5] = {0, 0, 0, 0, 0};
  char line[12];
  if (readDht(b)) {
    int humidity = ((unsigned int)b[0] << 8) | b[1];
    int temp = ((unsigned int)(b[2] & 0x7F) << 8) | b[3];
    if (b[2] & 0x80) temp = -temp;
    formatTenths(line, 'T', temp, 'C');
    oledLine(1, line);
    Serial.println(line);
    formatTenths(line, 'H', humidity, '%');
    oledLine(4, line);
    Serial.println(line);
  } else {
    oledLine(1, "T ERR");
    oledLine(4, "H ERR");
    Serial.println("read failed");
  }
  delay(readEvery);
}
