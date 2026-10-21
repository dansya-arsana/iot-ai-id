// Lesson 16: IR remote to 7-segment digit. IR receiver OUT on D2, segments a..g on D3..D9 (common cathode to GND).
// The NEC decoder is ours: it times the marks and spaces of the 32-bit frame with micros().
const byte IR_PIN = 2;
const byte SEG_FIRST = 3;        // a = D3, b = D4 ... g = D9

// Segment patterns for 0..9: bit 0 is segment a, bit 6 is segment g.
const byte DIGIT[10] = {0x3F, 0x06, 0x5B, 0x4F, 0x66, 0x6D, 0x7D, 0x07, 0x7F, 0x6F};
// NEC command byte of the keys 0..9 on the common 21-key mini remote.
const byte KEY_CODE[10] = {0x16, 0x0C, 0x18, 0x5E, 0x08, 0x1C, 0x5A, 0x42, 0x52, 0x4A};

// Wait for the pin to reach `level` and return how many microseconds that took, or 0 on a timeout.
unsigned int waitLevel(bool level, unsigned int timeoutUs) {
  unsigned long start = micros();
  while (digitalRead(IR_PIN) != level) {
    if (micros() - start > timeoutUs) return 0;
  }
  unsigned int took = (unsigned int)(micros() - start);
  return took ? took : 1;
}

// Length of the current level, measured until it flips. 0 on a timeout.
unsigned int measure(bool level, unsigned int timeoutUs) {
  return waitLevel(!level, timeoutUs);
}

// -1 nothing, -2 repeat code, else the NEC command byte of a valid frame.
int readNec() {
  if (digitalRead(IR_PIN) == HIGH) return -1;       // idle: the receiver output rests high
  unsigned int mark = measure(LOW, 12000);          // leader: 9 ms low
  if (mark < 7000 || mark > 11000) return -1;
  unsigned int space = measure(HIGH, 6000);         // 4.5 ms: a full frame, 2.25 ms: a repeat
  if (space > 1800 && space < 2700) return -2;
  if (space < 3600 || space > 5400) return -1;
  unsigned long bits = 0;
  for (byte i = 0; i < 32; i++) {
    if (!measure(LOW, 1500)) return -1;             // 562 us mark
    unsigned int gap = measure(HIGH, 3000);         // 562 us = 0, 1687 us = 1
    if (!gap) return -1;
    if (gap > 1100) bits |= 1UL << i;               // bits arrive least significant first
  }
  byte address = bits & 0xFF, notAddress = (bits >> 8) & 0xFF;
  byte command = (bits >> 16) & 0xFF, notCommand = (bits >> 24) & 0xFF;
  if ((byte)~address != notAddress || (byte)~command != notCommand) return -1;   // the frame checks itself
  return command;
}

void showDigit(byte d) {
  for (byte s = 0; s < 7; s++) digitalWrite(SEG_FIRST + s, (DIGIT[d] >> s) & 1);
}

void setup() {
  Serial.begin(9600);
  pinMode(IR_PIN, INPUT);
  for (byte s = 0; s < 7; s++) pinMode(SEG_FIRST + s, OUTPUT);
  Serial.println("ready");
}

void loop() {
  int code = readNec();
  if (code >= 0) {
    for (byte d = 0; d < 10; d++) {
      if (KEY_CODE[d] == code) {
        showDigit(d);
        Serial.print("key ");
        Serial.println(d);
      }
    }
  } else if (code == -2) {
    Serial.println("repeat");
  }
}
