// Test fixture: a minimal 28BYJ-48 driver of our own (no Stepper library). IN1-IN4 on D8-D11, written one digitalWrite at a time like a real driver.
// Script (runs once): 300 full steps forward at 2 ms, 300 half steps forward at 1 ms, 200 full steps at 0.5 ms (too fast for the motor), 300 full steps back at 2 ms.
const uint8_t PIN[4] = {8, 9, 10, 11};
const uint8_t SEQ[8] = {1, 3, 2, 6, 4, 12, 8, 9};
uint16_t stepUs = 2000;
uint16_t fastUs = 500;
int8_t phase = 0;
bool ran = false;
void coils(uint8_t m) { for (uint8_t k = 0; k < 4; k++) digitalWrite(PIN[k], (m >> k) & 1); }
void move(int16_t n, int8_t inc, uint16_t us) {
  for (int16_t i = 0; i < n; i++) { phase = (phase + inc + 8) & 7; coils(SEQ[phase]); delayMicroseconds(us); }
}
void setup() {
  Serial.begin(9600);
  for (uint8_t k = 0; k < 4; k++) pinMode(PIN[k], OUTPUT);
  Serial.println("ready");
}
void loop() {
  if (!ran) {
    ran = true;
    delay(5);
    move(300, 2, stepUs);
    Serial.println("fwd");
    delay(20);
    move(300, 1, 1000);
    Serial.println("half");
    delay(20);
    move(200, 2, fastUs);
    Serial.println("fast");
    delay(20);
    move(300, -2, stepUs);
    coils(0);
    Serial.println("done");
  }
}
