// Lesson 26: GPS logger. A NEO-6M GPS module sends NMEA text lines at 9600 baud into hardware Serial (module TX -> D0).
// The sketch checks the checksum of every $..GGA line, converts the ddmm.mmmmm fields to decimal degrees with integer math,
// and draws the fix on a Nokia 5110 (PCD8544, hardware SPI: CE = D10, DC = D9, RST = D8, DIN = D11, CLK = D13).
// No libraries except SPI: the NMEA parser, the 5x7 font and the PCD8544 driver below are ours.
unsigned int refreshMs = 1000;   // shortest time between two redraws of the screen
byte satsNeeded = 4;             // the screen says FIX only when the receiver uses at least this many satellites

#include <SPI.h>

const byte CE = 10, DC = 9, RST = 8;

// ---------- 5x7 font: 5 columns per glyph, bit 0 is the top pixel ----------
const char GLY[] = "0123456789.-: NSEWFIXOAT";
const byte FONT[][5] = {
  {0x3E, 0x51, 0x49, 0x45, 0x3E}, {0x00, 0x42, 0x7F, 0x40, 0x00}, {0x42, 0x61, 0x51, 0x49, 0x46}, {0x21, 0x41, 0x45, 0x4B, 0x31},
  {0x18, 0x14, 0x12, 0x7F, 0x10}, {0x27, 0x45, 0x45, 0x45, 0x39}, {0x3C, 0x4A, 0x49, 0x49, 0x30}, {0x01, 0x71, 0x09, 0x05, 0x03},
  {0x36, 0x49, 0x49, 0x49, 0x36}, {0x06, 0x49, 0x49, 0x29, 0x1E}, {0x00, 0x60, 0x60, 0x00, 0x00}, {0x08, 0x08, 0x08, 0x08, 0x08},
  {0x00, 0x36, 0x36, 0x00, 0x00}, {0x00, 0x00, 0x00, 0x00, 0x00}, {0x7F, 0x04, 0x08, 0x10, 0x7F}, {0x46, 0x49, 0x49, 0x49, 0x31},
  {0x7F, 0x49, 0x49, 0x49, 0x41}, {0x3F, 0x40, 0x38, 0x40, 0x3F}, {0x7F, 0x09, 0x09, 0x09, 0x01}, {0x00, 0x41, 0x7F, 0x41, 0x00},
  {0x63, 0x14, 0x08, 0x14, 0x63}, {0x3E, 0x41, 0x41, 0x41, 0x3E}, {0x7E, 0x11, 0x11, 0x11, 0x7E}, {0x01, 0x01, 0x7F, 0x01, 0x01}
};

// ---------- PCD8544 ----------
void sendByte(byte dc, byte b) {
  digitalWrite(DC, dc);
  digitalWrite(CE, LOW);
  SPI.transfer(b);
  digitalWrite(CE, HIGH);
}
void cmd(byte b) { sendByte(LOW, b); }

void putChar(char ch) {
  byte g = 13;                                   // unknown characters print as a blank
  for (byte i = 0; GLY[i]; i++) if (GLY[i] == ch) g = i;
  for (byte i = 0; i < 5; i++) sendByte(HIGH, FONT[g][i]);
  sendByte(HIGH, 0);
}

// One text row of 14 characters (84 columns); the rest of the row is cleared.
void putRow(byte bank, const char *s) {
  cmd(0x40 | bank);
  cmd(0x80);
  byte n = 0;
  while (s[n] && n < 14) putChar(s[n++]);
  while (n < 14) { putChar(' '); n++; }
}

void lcdInit() {
  digitalWrite(RST, LOW); delay(10); digitalWrite(RST, HIGH);
  cmd(0x21);                                     // extended instruction set
  cmd(0xBF);                                     // Vop: contrast
  cmd(0x04);                                     // temperature coefficient 0
  cmd(0x14);                                     // bias 1:48
  cmd(0x20);                                     // basic set, horizontal addressing
  for (int i = 0; i < 504; i++) sendByte(HIGH, 0x00);
  cmd(0x0C);                                     // normal display mode
}

// ---------- NMEA ----------
char line[96];
byte n = 0;
char *field[10];

byte hexValue(char c) { return c >= 'A' ? c - 'A' + 10 : c - '0'; }

// "ddmm.mmmmm" (degDigits = 2) or "dddmm.mmmmm" (3) -> "d.ddddd H" with integer math
bool toDegrees(const char *s, byte degDigits, char hemi, char *out) {
  if (strlen(s) < degDigits + 8 || s[degDigits + 2] != '.') return false;
  long deg = 0;
  for (byte i = 0; i < degDigits; i++) deg = deg * 10 + (s[i] - '0');
  const char *m = s + degDigits;
  long minE5 = ((m[0] - '0') * 10L + (m[1] - '0')) * 100000L;
  long frac = 0;
  for (byte i = 0; i < 5; i++) frac = frac * 10 + (m[3 + i] - '0');
  minE5 += frac;
  long e5 = deg * 100000L + minE5 / 60;          // degrees x 100000
  sprintf(out, "%ld.%05ld %c", e5 / 100000L, e5 % 100000L, hemi);
  return true;
}

char latTxt[14], lonTxt[14], timeTxt[10], statusTxt[15];
bool dirty = false;
unsigned long lastDraw = 0;
unsigned int goodLines = 0, badLines = 0;

void parseGga() {
  // fields: 0 id, 1 time, 2 lat, 3 N/S, 4 lon, 5 E/W, 6 quality, 7 satellites
  byte quality = field[6][0] ? field[6][0] - '0' : 0;
  byte sats = atoi(field[7]);
  bool ok = quality > 0 && sats >= satsNeeded;
  latTxt[0] = 0; lonTxt[0] = 0; timeTxt[0] = 0;
  if (ok) {
    ok = toDegrees(field[2], 2, field[3][0], latTxt) && toDegrees(field[4], 3, field[5][0], lonTxt) && strlen(field[1]) >= 6;
    if (ok) {
      timeTxt[0] = field[1][0]; timeTxt[1] = field[1][1]; timeTxt[2] = ':';
      timeTxt[3] = field[1][2]; timeTxt[4] = field[1][3]; timeTxt[5] = ':';
      timeTxt[6] = field[1][4]; timeTxt[7] = field[1][5]; timeTxt[8] = 0;
    }
  }
  if (ok) sprintf(statusTxt, "FIX %02d SAT", sats);
  else strcpy(statusTxt, "NO FIX");
  dirty = true;
}

void handleLine() {
  line[n] = 0;
  n = 0;
  if (line[0] != '$') return;
  byte x = 0, i = 1;
  while (line[i] && line[i] != '*') x ^= line[i++];
  if (line[i] != '*' || hexValue(line[i + 1]) != (x >> 4) || hexValue(line[i + 2]) != (x & 15)) { badLines++; return; }
  line[i] = 0;
  goodLines++;
  if (strncmp(line + 3, "GGA", 3) != 0) return;
  byte f = 0;
  field[0] = line;
  for (char *p = line; *p && f < 9; p++) if (*p == ',') { *p = 0; field[++f] = p + 1; }
  if (f < 7) return;
  parseGga();
}

void draw() {
  putRow(0, statusTxt);
  putRow(1, latTxt[0] ? latTxt : "-");
  putRow(2, lonTxt[0] ? lonTxt : "-");
  putRow(3, "");
  putRow(4, timeTxt[0] ? timeTxt : "-");
  putRow(5, "");
  Serial.print(statusTxt);
  Serial.print(' ');
  Serial.print(latTxt);
  Serial.print(' ');
  Serial.println(lonTxt);
}

void setup() {
  Serial.begin(9600);
  pinMode(CE, OUTPUT); pinMode(DC, OUTPUT); pinMode(RST, OUTPUT);
  digitalWrite(CE, HIGH);
  SPI.begin();
  SPI.setClockDivider(SPI_CLOCK_DIV4);
  lcdInit();
  strcpy(statusTxt, "NO FIX");
  draw();
  Serial.println("gps ready");
}

void loop() {
  unsigned long now = millis();
  while (Serial.available()) {
    char c = Serial.read();
    if (c == '\n') handleLine();
    else if (c != '\r' && n < sizeof(line) - 1) line[n++] = c;
  }
  if (dirty && now - lastDraw >= refreshMs) {
    dirty = false;
    lastDraw = now;
    draw();
  }
}
