// Lesson 8b: two-tone alarm on the buzzer (D5).
unsigned int noteMs = 300;   // ms per tone

void setup() {
  Serial.begin(9600);
  pinMode(5, OUTPUT);
  Serial.println("ready");
}

void loop() {
  Serial.println("alarm 880");
  tone(5, 880);
  delay(noteMs);
  Serial.println("alarm 660");
  tone(5, 660);
  delay(noteMs);
}
