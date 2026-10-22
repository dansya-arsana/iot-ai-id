// Lesson 20: keypad lock. 4x4 membrane keypad (rows D2-D5, columns D6-D9), TM1637 display (CLK D10, DIO D11), servo latch on D12.
// Type the 4-digit PIN and press # to open the lock. * clears what you typed. No libraries except Servo: the keypad scan and the
// TM1637 driver below are ours.
#include <Servo.h>

unsigned int pinCode = 1234;   // the secret PIN (4 digits)
unsigned int openMs = 3000;    // how long the latch stays open

const byte ROW[4] = {2, 3, 4, 5};
const byte COL[4] = {6, 7, 8, 9};
const char KEYS[16] = {'1','2','3','A','4','5','6','B','7','8','9','C','*','0','#','D'};
const byte CLK = 10, DIO = 11;
const byte DIGIT[10] = {0x3F, 0x06, 0x5B, 0x4F, 0x66, 0x6D, 0x7D, 0x07, 0x7F, 0x6F};
Servo latch;
unsigned int typed = 0;   // number typed so far
byte count = 0;           // digits typed so far
byte attempts = 0;
char last = 0;           // the key seen on the previous pass

// ---------- keypad: drive one row LOW, read the columns with pull-ups ----------
char scanKey() {
  char found = 0;
  for (byte r = 0; r < 4; r++) {
    digitalWrite(ROW[r], LOW);
    delayMicroseconds(50);
    for (byte c = 0; c < 4; c++) {
      if (digitalRead(COL[c]) == LOW) found = KEYS[r * 4 + c];
    }
    digitalWrite(ROW[r], HIGH);
  }
  return found;
}

// ---------- TM1637 ----------
void bitDelay() { delayMicroseconds(5); }
void start() { digitalWrite(CLK, HIGH); digitalWrite(DIO, HIGH); bitDelay(); digitalWrite(DIO, LOW); bitDelay(); digitalWrite(CLK, LOW); }
void stop() { digitalWrite(CLK, LOW); digitalWrite(DIO, LOW); bitDelay(); digitalWrite(CLK, HIGH); bitDelay(); digitalWrite(DIO, HIGH); bitDelay(); }
void writeByte(byte b) {
  for (byte i = 0; i < 8; i++) {
    digitalWrite(CLK, LOW);
    digitalWrite(DIO, (b >> i) & 1);   // LSB first
    bitDelay();
    digitalWrite(CLK, HIGH);
    bitDelay();
  }
  digitalWrite(CLK, LOW);
  pinMode(DIO, INPUT);                 // release DIO for the chip's ACK
  bitDelay();
  digitalWrite(CLK, HIGH);
  bitDelay();
  digitalWrite(CLK, LOW);
  pinMode(DIO, OUTPUT);
  digitalWrite(DIO, LOW);
}
void show(byte a, byte b, byte c, byte d) {
  start(); writeByte(0x40); stop();
  start(); writeByte(0xC0); writeByte(a); writeByte(b); writeByte(c); writeByte(d); stop();
  start(); writeByte(0x8B); stop();    // display on, brightness 3
}
// the digits typed so far, then dashes for the digits still to come
void showTyped() {
  byte seg[4] = {0x40, 0x40, 0x40, 0x40};
  unsigned int v = typed;
  for (int i = count - 1; i >= 0; i--) { seg[i] = DIGIT[v % 10]; v /= 10; }
  show(seg[0], seg[1], seg[2], seg[3]);
}

void setup() {
  Serial.begin(9600);
  for (byte i = 0; i < 4; i++) {
    pinMode(ROW[i], OUTPUT);
    digitalWrite(ROW[i], HIGH);
    pinMode(COL[i], INPUT_PULLUP);
  }
  pinMode(CLK, OUTPUT);
  pinMode(DIO, OUTPUT);
  digitalWrite(CLK, HIGH);
  digitalWrite(DIO, HIGH);
  latch.attach(12);
  latch.write(0);                      // locked
  showTyped();
  Serial.println("ready");
}

void loop() {
  char k = scanKey();
  if (k != last) {
    delay(15);                         // debounce: the same key twice in a row
    if (scanKey() != k) return;
    last = k;
    if (k == 0) return;
    if (k >= '0' && k <= '9') {
      if (count < 4) { typed = typed * 10 + (k - '0'); count++; showTyped(); }
      Serial.print("digit "); Serial.println(count);
    } else if (k == '*') {
      typed = 0; count = 0; showTyped();
      Serial.println("cleared");
    } else if (k == '#') {
      attempts++;
      if (count == 4 && typed == pinCode) {
        Serial.println("unlocked");
        show(0x3F, 0x73, 0x79, 0x54);  // OPEn
        latch.write(90);
        delay(openMs);
        latch.write(0);
        Serial.println("locked");
      } else {
        Serial.print("denied "); Serial.println(attempts);
        show(0x79, 0x50, 0x50, 0x00);  // Err
        delay(800);
      }
      typed = 0; count = 0; showTyped();
    }
  }
}
