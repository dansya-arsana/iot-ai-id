// Lesson 1: the board's own LED (L) on pin 13.
unsigned int waitMs = 1000;   // ms between changes

void setup() {
  Serial.begin(9600);
  pinMode(LED_BUILTIN, OUTPUT);
  Serial.println("ready");
}

void loop() {
  digitalWrite(LED_BUILTIN, HIGH);
  Serial.println("L on");
  delay(waitMs);
  digitalWrite(LED_BUILTIN, LOW);
  Serial.println("L off");
  delay(waitMs);
}
