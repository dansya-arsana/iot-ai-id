// Lesson 11: parking sensor. TRIG D7, ECHO D6, LEDs D10/D11/D12, buzzer D5.
unsigned int nearCm = 15;   // closer than this: STOP
unsigned int farCm = 40;    // closer than this: SLOW
byte tick = 0;

void setup() {
  Serial.begin(9600);
  pinMode(7, OUTPUT);
  pinMode(6, INPUT);
  pinMode(10, OUTPUT);
  pinMode(11, OUTPUT);
  pinMode(12, OUTPUT);
  Serial.println("ready");
}

unsigned int readCm() {
  digitalWrite(7, LOW);
  delayMicroseconds(2);
  digitalWrite(7, HIGH);
  delayMicroseconds(10);
  digitalWrite(7, LOW);
  unsigned long us = pulseIn(6, HIGH, 30000);
  return us == 0 ? 999 : us / 58;
}

void loop() {
  unsigned int cm = readCm();
  tick++;
  digitalWrite(10, LOW);
  digitalWrite(11, LOW);
  digitalWrite(12, LOW);
  if (cm < nearCm) {
    digitalWrite(12, HIGH);
    tone(5, 1500, 80);
    Serial.print(cm);
    Serial.println(" cm · STOP");
  } else if (cm < farCm) {
    digitalWrite(11, HIGH);
    if (tick % 4 == 0) tone(5, 1000, 40);
    Serial.print(cm);
    Serial.println(" cm · SLOW");
  } else {
    digitalWrite(10, HIGH);
    noTone(5);
    Serial.print(cm);
    Serial.println(" cm · OK");
  }
  delay(100);
}
