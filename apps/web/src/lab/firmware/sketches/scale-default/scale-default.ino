// Lesson 23: kitchen scale. HX711 load cell amplifier (SCK = D4, DT = D5), tare button on D2 (pull-down, HIGH when pressed),
// TM1637 4-digit display (CLK = D8, DIO = D9). Both chips are driven by our own bit-banged code: no library.
unsigned int countsPer10g = 4295;   // raw counts for ten grams: the calibration factor of a 5 kg bar at 5 V, gain 128 (429.5 per gram)
byte averages = 4;                  // readings averaged per update (the chip makes 10 per second)

const byte BTN = 2, HX_SCK = 4, HX_DT = 5, TM_CLK = 8, TM_DIO = 9;
const byte GLYPH[10] = {0x3F, 0x06, 0x5B, 0x4F, 0x66, 0x6D, 0x7D, 0x07, 0x7F, 0x6F};

long avg = 0;          // average of the last readings
long offset = 0;       // raw value of the empty (or tared) scale
bool tared = false;
bool tareReq = false;
byte btnWas = 0;

// ---------- HX711: DT low = ready, then 24 clocks (MSB first) and one more for gain 128 ----------
bool waitReady() {
  unsigned long t0 = millis();
  while (digitalRead(HX_DT) == HIGH) {
    byte b = digitalRead(BTN);                    // watch the tare button while we wait for the chip
    if (b && !btnWas) tareReq = true;
    btnWas = b;
    if (millis() - t0 > 600) return false;
  }
  return true;
}

long readRaw() {
  long v = 0;
  for (byte i = 0; i < 24; i++) {
    digitalWrite(HX_SCK, HIGH);
    delayMicroseconds(1);
    v = (v << 1) | digitalRead(HX_DT);
    digitalWrite(HX_SCK, LOW);
    delayMicroseconds(1);
  }
  digitalWrite(HX_SCK, HIGH);                     // 25th pulse: next reading is channel A, gain 128
  delayMicroseconds(1);
  digitalWrite(HX_SCK, LOW);
  if (v & 0x800000L) v |= 0xFF000000L;            // sign extend 24 -> 32 bits
  return v;
}

bool sample() {
  long sum = 0;
  for (byte i = 0; i < averages; i++) {
    if (!waitReady()) return false;
    sum += readRaw();
  }
  avg = sum / averages;
  return true;
}

// ---------- TM1637: two wires, START / STOP, LSB first, an ACK after every byte ----------
void tmDelay() { delayMicroseconds(5); }
void tmStart() { digitalWrite(TM_CLK, HIGH); digitalWrite(TM_DIO, HIGH); tmDelay(); digitalWrite(TM_DIO, LOW); tmDelay(); digitalWrite(TM_CLK, LOW); }
void tmStop() { digitalWrite(TM_CLK, LOW); digitalWrite(TM_DIO, LOW); tmDelay(); digitalWrite(TM_CLK, HIGH); tmDelay(); digitalWrite(TM_DIO, HIGH); tmDelay(); }
void tmWrite(byte b) {
  for (byte i = 0; i < 8; i++) {
    digitalWrite(TM_CLK, LOW);
    digitalWrite(TM_DIO, (b >> i) & 1);
    tmDelay();
    digitalWrite(TM_CLK, HIGH);
    tmDelay();
  }
  digitalWrite(TM_CLK, LOW);
  pinMode(TM_DIO, INPUT);                         // release DIO: the chip pulls it low for the ACK
  tmDelay();
  digitalWrite(TM_CLK, HIGH);
  tmDelay();
  digitalWrite(TM_CLK, LOW);
  pinMode(TM_DIO, OUTPUT);
  digitalWrite(TM_DIO, LOW);
}
void tmShow(const byte *d) {
  tmStart(); tmWrite(0x40); tmStop();             // data command: automatic address increment
  tmStart(); tmWrite(0xC0);                       // address command: first digit
  for (byte i = 0; i < 4; i++) tmWrite(d[i]);
  tmStop();
  tmStart(); tmWrite(0x8F); tmStop();             // display on, brightest
}

void showGrams(long g) {
  byte d[4] = {0, 0, 0, 0};                       // 0 = blank digit
  if (g > 9999 || g < -999) {
    d[0] = d[1] = d[2] = d[3] = 0x40;             // "----": out of range
  } else {
    bool neg = g < 0;
    long a = neg ? -g : g;
    for (int i = 3; i >= 0; i--) {
      d[i] = GLYPH[a % 10];
      a /= 10;
      if (a == 0) {
        if (neg && i > 0) d[i - 1] = 0x40;        // minus sign just left of the number
        break;
      }
    }
  }
  tmShow(d);
}

void setup() {
  Serial.begin(9600);
  pinMode(BTN, INPUT);
  pinMode(HX_SCK, OUTPUT);
  pinMode(HX_DT, INPUT);
  pinMode(TM_CLK, OUTPUT);
  pinMode(TM_DIO, OUTPUT);
  digitalWrite(HX_SCK, LOW);
  digitalWrite(TM_CLK, HIGH);
  digitalWrite(TM_DIO, HIGH);
  Serial.println("ready");
}

void loop() {
  bool ok = sample();
  if (!ok) {
    const byte err[4] = {0, 0x79, 0x50, 0x50};    // " Err": the chip never answered
    tmShow(err);
    Serial.println("no hx711");
    return;
  }
  if (!tared || tareReq) {                        // first reading, or the button: this weight becomes zero
    offset = avg;
    tared = true;
    tareReq = false;
    Serial.println("tare");
  }
  long delta = avg - offset;
  long scaled = delta * 10;                       // ten times the counts, so the factor can keep one decimal
  long half = countsPer10g / 2;
  long g = (scaled >= 0 ? scaled + half : scaled - half) / (long)countsPer10g;
  Serial.print("g=");
  Serial.println(g);
  showGrams(g);
}
