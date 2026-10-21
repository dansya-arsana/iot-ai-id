// Lesson 7: HC-SR04 distance. TRIG on D7, ECHO on D6.
unsigned int interval = 250;   // ms between measurements

void setup() {
  Serial.begin(9600);
  pinMode(7, OUTPUT);
  pinMode(6, INPUT);
  Serial.println("ready");
}

void loop() {
  digitalWrite(7, LOW);
  delayMicroseconds(2);
  digitalWrite(7, HIGH);          // 10 us trigger pulse
  delayMicroseconds(10);
  digitalWrite(7, LOW);
  unsigned long us = pulseIn(6, HIGH, 30000);
  if (us == 0) {
    Serial.println("no echo");
  } else {
    Serial.print(us / 58);
    Serial.println(" cm");
  }
  delay(interval);
}
