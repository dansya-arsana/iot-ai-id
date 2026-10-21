// Lesson 12: read a DHT22 (AM2302) over its single wire. No library: the bit-banged reader below is ours (MIT-style, free to reuse).
unsigned int readEvery = 2000;   // ms between readings (the DHT22 needs at least 2 s)

const byte DATA_PIN = 2;

// Wait until the wire reaches `level`. Counts loop passes instead of reading micros(), which freezes while interrupts are off.
// false after about maxPasses * 5 us.
bool waitFor(bool level, byte maxPasses) {
  while (digitalRead(DATA_PIN) != level) {
    if (maxPasses-- == 0) return false;
  }
  return true;
}

// One reading: 5 bytes (humidity x10, temperature x10, checksum). false when the sensor does not answer.
bool readDht(byte bytes[5]) {
  for (byte i = 0; i < 5; i++) bytes[i] = 0;
  pinMode(DATA_PIN, OUTPUT);
  digitalWrite(DATA_PIN, LOW);      // start signal: pull the wire low for 18 ms
  delay(18);
  digitalWrite(DATA_PIN, HIGH);
  pinMode(DATA_PIN, INPUT);         // let go; the pull-up raises the wire
  noInterrupts();
  bool ok = waitFor(LOW, 100)       // sensor answers: low 80 us ...
         && waitFor(HIGH, 100)      // ... high 80 us ...
         && waitFor(LOW, 100);      // ... then the first bit starts
  for (byte i = 0; ok && i < 40; i++) {
    ok = waitFor(HIGH, 100);        // every bit begins with 50 us low, then a high
    if (!ok) break;
    delayMicroseconds(45);          // a 0 is high for ~27 us, a 1 for ~70 us: look 45 us in
    byte bit = digitalRead(DATA_PIN);
    bytes[i / 8] = (bytes[i / 8] << 1) | bit;
    ok = waitFor(LOW, 100);         // wait for the end of the high
  }
  interrupts();
  return ok && (byte)(bytes[0] + bytes[1] + bytes[2] + bytes[3]) == bytes[4];
}

void setup() {
  Serial.begin(9600);
  pinMode(DATA_PIN, INPUT);
  Serial.println("ready");
}

void loop() {
  byte b[5] = {0, 0, 0, 0, 0};
  if (readDht(b)) {
    unsigned int humidity = ((unsigned int)b[0] << 8) | b[1];
    int temp = ((unsigned int)(b[2] & 0x7F) << 8) | b[3];
    if (b[2] & 0x80) temp = -temp;
    Serial.print("T=");
    if (temp < 0) { Serial.print('-'); temp = -temp; }
    Serial.print(temp / 10);
    Serial.print('.');
    Serial.print(temp % 10);
    Serial.print(" C  H=");
    Serial.print(humidity / 10);
    Serial.print('.');
    Serial.print(humidity % 10);
    Serial.println(" %");
  } else {
    Serial.println("read failed");
  }
  delay(readEvery);
}
