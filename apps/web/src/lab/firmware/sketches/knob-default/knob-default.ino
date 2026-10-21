// Lesson 4: a potentiometer on A0 sets LED brightness on D9 (PWM).
unsigned int printEvery = 200;   // ms between serial lines
unsigned long lastPrint = 0;

void setup() {
  Serial.begin(9600);
  pinMode(9, OUTPUT);
  Serial.println("ready");
}

void loop() {
  int raw = analogRead(A0);
  int pwm = raw / 4;
  analogWrite(9, pwm);
  if (millis() - lastPrint >= printEvery) {
    lastPrint = millis();
    Serial.print(raw);
    Serial.print(" -> ");
    Serial.println(pwm);
  }
}
