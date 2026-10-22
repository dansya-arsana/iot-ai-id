// Lesson 22: Stepper control. KY-023 joystick (VRx on A0, SW on D2) turns a 28BYJ-48 through a ULN2003 board (IN1-IN4 on D8-D11);
// an SSD1306 OLED on I2C (A4 = SDA, A5 = SCL, 0x3C) shows the position. No libraries except Wire: the half-step driver and the tiny text driver are ours.
unsigned int fastUs = 1500;   // time per half step with the stick fully over (the motor cannot follow much below 900 us)
unsigned int slowUs = 6000;   // time per half step just past the dead zone

#include <Wire.h>

const byte IN_PINS[4] = {8, 9, 10, 11};
const byte SEQ[8] = {1, 3, 2, 6, 4, 12, 8, 9};   // IN1, IN1+IN2, IN2, IN2+IN3 ... : the half-step order, one bit per coil
const byte SW_PIN = 2;
const byte OLED = 0x3C;
const int CENTRE = 512;
const int DEAD = 60;                              // dead zone around the centre, in ADC counts
const long HALF_STEPS_PER_TURN = 4076;            // 28BYJ-48: 64 half steps of the rotor x 63.68:1 gearbox

long drawnPos = -1;                               // the position last written to the screen
long pos = 0;                                     // net half steps since power-up (positive = IN1 to IN4 order)
byte phase = 0;
unsigned long lastStep = 0, lastMove = 0, lastDraw = 0;
bool released = false;
char shown[2][11];

void coils(byte m) { for (byte k = 0; k < 4; k++) digitalWrite(IN_PINS[k], (m >> k) & 1); }

// ---------- SSD1306 ----------
void oledCommand(byte a) {
  Wire.beginTransmission(OLED);
  Wire.write(0x00);
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
  oledCommand(0xAE);
  oledCommand2(0xD5, 0x80);
  oledCommand2(0xA8, 0x3F);
  oledCommand2(0xD3, 0x00);
  oledCommand(0x40);
  oledCommand2(0x8D, 0x14);
  oledCommand2(0x20, 0x00);
  oledCommand(0xA1);
  oledCommand(0xC8);
  oledCommand2(0xDA, 0x12);
  oledCommand2(0x81, 0xCF);
  oledCommand2(0xD9, 0xF1);
  oledCommand2(0xDB, 0x40);
  oledCommand(0xA4);
  oledCommand(0xA6);
  oledCommand(0xAF);
}
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
    Wire.write(0x40);
    for (byte i = 0; i < 16; i++) Wire.write((byte)0);
    Wire.endTransmission();
  }
}

// 5x7 font, one byte per column, bit 0 is the top row. Only the characters this screen needs.
const char GLYPHS[] = "0123456789-POSDEG ";
const byte FONT[][5] = {
  {0x3E, 0x51, 0x49, 0x45, 0x3E}, {0x00, 0x42, 0x7F, 0x40, 0x00}, {0x42, 0x61, 0x51, 0x49, 0x46},
  {0x21, 0x41, 0x45, 0x4B, 0x31}, {0x18, 0x14, 0x12, 0x7F, 0x10}, {0x27, 0x45, 0x45, 0x45, 0x39},
  {0x3C, 0x4A, 0x49, 0x49, 0x30}, {0x01, 0x71, 0x09, 0x05, 0x03}, {0x36, 0x49, 0x49, 0x49, 0x36},
  {0x06, 0x49, 0x49, 0x29, 0x1E}, {0x08, 0x08, 0x08, 0x08, 0x08}, {0x7F, 0x09, 0x09, 0x09, 0x06},
  {0x3E, 0x41, 0x41, 0x41, 0x3E}, {0x46, 0x49, 0x49, 0x49, 0x31}, {0x7F, 0x41, 0x41, 0x22, 0x1C},
  {0x7F, 0x49, 0x49, 0x49, 0x41}, {0x3E, 0x41, 0x49, 0x49, 0x7A}, {0x00, 0x00, 0x00, 0x00, 0x00}
};

// One character at double size: 10 columns wide, two pages tall.
void oledBigChar(byte x, byte page, char ch) {
  byte g = 17;
  for (byte i = 0; GLYPHS[i]; i++) if (GLYPHS[i] == ch) g = i;
  byte top[10], bottom[10];
  for (byte c = 0; c < 5; c++) {
    byte col = FONT[g][c], t = 0, b = 0;
    for (byte r = 0; r < 4; r++) {
      if (col & (1 << r)) t |= 3 << (r * 2);
      if (col & (1 << (r + 4))) b |= 3 << (r * 2);
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

// Ten cells of 12 px per line. Only the cells that changed are sent, so a redraw is quick.
void oledLine(byte row, byte page, const char *text) {
  bool end = false;
  for (byte i = 0; i < 10; i++) {
    char ch = ' ';
    if (!end && text[i]) ch = text[i]; else end = true;
    if (shown[row][i] != ch) { oledBigChar(i * 12, page, ch); shown[row][i] = ch; }
  }
}

// "<tag> <number>" into out.
void formatNumber(char *out, const char *tag, long v) {
  byte n = 0;
  while (*tag) out[n++] = *tag++;
  out[n++] = ' ';
  if (v < 0) { out[n++] = '-'; v = -v; }
  char digits[8];
  byte d = 0;
  do { digits[d++] = '0' + v % 10; v /= 10; } while (v > 0 && d < 7);
  while (d) out[n++] = digits[--d];
  out[n] = 0;
}

void drawPosition() {
  char line[12];
  formatNumber(line, "POS", pos);
  oledLine(0, 1, line);
  formatNumber(line, "DEG", pos * 360L / HALF_STEPS_PER_TURN);
  oledLine(1, 4, line);
  Serial.println(line);
  drawnPos = pos;
  lastDraw = millis();
}

void setup() {
  Serial.begin(9600);
  for (byte k = 0; k < 4; k++) pinMode(IN_PINS[k], OUTPUT);
  pinMode(SW_PIN, INPUT_PULLUP);
  for (byte r = 0; r < 2; r++) for (byte i = 0; i < 11; i++) shown[r][i] = (i < 10) ? '?' : 0;
  Wire.begin();
  oledInit();
  oledClear();
  for (byte r = 0; r < 2; r++) for (byte i = 0; i < 10; i++) shown[r][i] = ' ';
  coils(SEQ[0]);
  lastMove = millis();
  drawPosition();
  Serial.println("ready");
}

void loop() {
  int x = analogRead(A0);
  bool home = digitalRead(SW_PIN) == LOW;       // pressing the stick sends the shaft back to zero
  int dir = 0;
  long dev = 0;
  if (home) {
    if (pos != 0) { dir = pos > 0 ? -1 : 1; dev = 300; }
  } else if (x > CENTRE + DEAD) { dir = 1; dev = x - CENTRE; }
  else if (x < CENTRE - DEAD) { dir = -1; dev = CENTRE - x; }

  unsigned long now = micros();
  if (dir != 0) {
    long interval = (long)slowUs - ((long)(slowUs - fastUs) * (dev - DEAD)) / (CENTRE - DEAD);
    if (interval < (long)fastUs) interval = fastUs;
    if (now - lastStep >= (unsigned long)interval) {
      lastStep = now;
      phase = (phase + dir + 8) & 7;
      coils(SEQ[phase]);
      pos += dir;
      lastMove = millis();
      released = false;
    }
  } else if (!released && millis() - lastMove > 1500) {
    coils(0);                                    // let the coils rest: a holding motor runs hot
    released = true;
  }
  // redraw when the shaft is still, or every 400 ms while it turns (a redraw pauses the steps for a moment)
  if (pos != drawnPos && ((dir == 0 && millis() - lastMove > 120) || millis() - lastDraw > 400)) {
    drawPosition();
  }
}
