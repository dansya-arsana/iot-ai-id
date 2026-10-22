// Test fixture: read the load cell amplifier, selecting gain 64 for the NEXT conversion with 27 pulses, then read again. Our own code.
// DT (DOUT) low = ready; 24 data pulses MSB first; pulse 25 = gain 128, 26 = channel B gain 32, 27 = gain 64 for the next conversion.
const int SCK_PIN = 4, DOUT_PIN = 5;
long readValue(uint8_t extra) {
  uint32_t t0 = millis();
  while (digitalRead(DOUT_PIN) == HIGH) { if (millis() - t0 > 700) return 0x7FFFFFFF; }
  long v = 0;
  for (uint8_t i = 0; i < 24; i++) {
    digitalWrite(SCK_PIN, HIGH);
    delayMicroseconds(1);
    v = (v << 1) | digitalRead(DOUT_PIN);
    digitalWrite(SCK_PIN, LOW);
    delayMicroseconds(1);
  }
  for (uint8_t i = 0; i < extra; i++) { digitalWrite(SCK_PIN, HIGH); delayMicroseconds(1); digitalWrite(SCK_PIN, LOW); delayMicroseconds(1); }
  if (v & 0x800000L) v |= 0xFF000000L;
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
  Serial.println(readValue(3));
}
