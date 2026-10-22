// Test fixture: read a 24-bit value from a two-wire converter (PD_SCK = D4 output, DOUT = D5 input), our own code.
// DOUT low means ready; every PD_SCK pulse shifts out one bit, MSB first; a 25th pulse selects gain 128 and releases DOUT.
const int SCK_PIN = 4, DOUT_PIN = 5;
long readValue() {
  uint32_t t0 = millis();
  while (digitalRead(DOUT_PIN) == HIGH) { if (millis() - t0 > 500) return 0x7FFFFFFF; }
  long v = 0;
  for (uint8_t i = 0; i < 24; i++) {
    digitalWrite(SCK_PIN, HIGH);
    delayMicroseconds(1);
    v = (v << 1) | digitalRead(DOUT_PIN);
    digitalWrite(SCK_PIN, LOW);
    delayMicroseconds(1);
  }
  digitalWrite(SCK_PIN, HIGH); delayMicroseconds(1); digitalWrite(SCK_PIN, LOW);
  if (v & 0x800000L) v |= 0xFF000000L;   // sign extend
  return v;
}
void setup() {
  Serial.begin(9600);
  pinMode(SCK_PIN, OUTPUT);
  pinMode(DOUT_PIN, INPUT);
  Serial.println("ready");
}
void loop() {
  Serial.print("raw=");
  Serial.println(readValue());
  delay(100);
}
