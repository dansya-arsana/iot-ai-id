// Lesson 9: DC motor through a transistor on D6 (PWM).
byte topSpeed = 200;   // 0-255 PWM at the top
byte stepMs = 20;      // ms per ramp step

void setup() {
  Serial.begin(9600);
  pinMode(6, OUTPUT);
  Serial.println("ready");
}

void loop() {
  Serial.println("ramp up");
  for (int s = 0; s <= topSpeed; s += 5) {
    analogWrite(6, s);
    delay(stepMs);
  }
  Serial.print("hold ");
  Serial.println(topSpeed);
  delay(2000);
  Serial.println("ramp down");
  for (int s = topSpeed; s >= 0; s -= 5) {
    analogWrite(6, s);
    delay(stepMs);
  }
  analogWrite(6, 0);
  Serial.println("rest 0");
  delay(1000);
}
