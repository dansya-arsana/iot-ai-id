// Lesson 14: motion light. PIR OUT on D2, relay module IN on D7 (active low: LOW closes the contact).
unsigned int holdMs = 3000;      // keep the lamp on this long after the last motion

const byte PIR_PIN = 2;
const byte RELAY_PIN = 7;

bool lampOn = false;
unsigned long lastMotion = 0;

void setup() {
  Serial.begin(9600);
  pinMode(PIR_PIN, INPUT);
  digitalWrite(RELAY_PIN, HIGH);   // idle level first, so the relay never clicks at start-up
  pinMode(RELAY_PIN, OUTPUT);
  Serial.println("ready");
}

void loop() {
  bool motion = digitalRead(PIR_PIN) == HIGH;
  if (motion) {
    lastMotion = millis();         // every sign of movement restarts the hold timer
    if (!lampOn) {
      lampOn = true;
      digitalWrite(RELAY_PIN, LOW);
      Serial.println("motion: lamp ON");
    }
  } else if (lampOn && millis() - lastMotion >= holdMs) {
    lampOn = false;
    digitalWrite(RELAY_PIN, HIGH);
    Serial.println("quiet: lamp OFF");
  }
  delay(10);
}
