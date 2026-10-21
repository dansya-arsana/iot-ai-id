// Lesson 15: plant monitor. Soil moisture sensor on A0, LCD 16x2 with an I2C backpack (address 0x27) on A4/A5, alert LED on D8.
// The LCD driver is ours: it speaks to the PCF8574 backpack and runs the HD44780 in 4-bit mode. Only Wire is used.
byte dryBelow = 30;              // alert (LED on) while the soil moisture is below this percent

#include <Wire.h>

const byte LCD = 0x27;
const byte LED_PIN = 8;
const int RAW_DRY = 573;         // ADC reading in dry soil (2.8 V)
const int RAW_WET = 245;         // ADC reading in wet soil (1.2 V)

// Backpack bits: P0 = RS, P1 = RW, P2 = E, P3 = backlight, P4..P7 = D4..D7.
void expander(byte v) {
  Wire.beginTransmission(LCD);
  Wire.write(v);
  Wire.endTransmission();
}

void nibble(byte n, byte rs) {
  byte v = (n << 4) | 0x08 | rs;   // backlight stays on
  expander(v | 0x04);              // E high ...
  delayMicroseconds(1);
  expander(v);                     // ... E low: the controller latches the nibble on this falling edge
  delayMicroseconds(50);
}

void lcdSend(byte b, byte rs) {
  nibble(b >> 4, rs);
  nibble(b & 0x0F, rs);
}

void lcdInit() {
  delay(50);
  nibble(0x3, 0); delay(5);        // the datasheet wake-up: 0x3 three times, then 0x2 selects 4-bit
  nibble(0x3, 0); delay(1);
  nibble(0x3, 0); delay(1);
  nibble(0x2, 0); delay(1);
  lcdSend(0x28, 0);                // 4-bit, 2 lines, 5x8 font
  lcdSend(0x0C, 0);                // display on, no cursor
  lcdSend(0x01, 0); delay(2);      // clear
  lcdSend(0x06, 0);                // move right after each character
}

// Write up to 16 characters on a row and pad with spaces.
void lcdRow(byte row, const char *text) {
  lcdSend(0x80 | (row ? 0x40 : 0x00), 0);
  bool end = false;
  for (byte i = 0; i < 16; i++) {
    char ch = ' ';
    if (!end && text[i]) ch = text[i]; else end = true;
    lcdSend(ch, 1);
  }
}

void setup() {
  Serial.begin(9600);
  pinMode(LED_PIN, OUTPUT);
  Wire.begin();
  lcdInit();
  Serial.println("ready");
}

void loop() {
  int raw = analogRead(A0);
  long pct = ((long)(RAW_DRY - raw) * 100 + (RAW_DRY - RAW_WET) / 2) / (RAW_DRY - RAW_WET);   // dry soil reads high, wet soil reads low
  if (pct < 0) pct = 0;
  if (pct > 100) pct = 100;
  char line[17];
  byte n = 0;
  const char *label = "Soil ";
  while (*label) line[n++] = *label++;
  if (pct >= 100) line[n++] = '1';
  if (pct >= 10) line[n++] = '0' + (pct / 10) % 10;
  line[n++] = '0' + pct % 10;
  line[n++] = '%';
  line[n] = 0;
  bool dry = pct < dryBelow;
  lcdRow(0, line);
  lcdRow(1, dry ? "Needs water!" : "Soil is fine");
  digitalWrite(LED_PIN, dry ? HIGH : LOW);
  Serial.print(line);
  Serial.println(dry ? " dry, LED on" : " fine, LED off");
  delay(500);
}
