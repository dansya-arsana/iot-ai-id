// Lesson 3b: each press toggles the LED. Debounce uses millis().
unsigned int debounceMs = 50;   // ms to ignore bounce after a press
bool ledOn = false;
int lastReading = LOW;
unsigned long lastPress = 0;

void setup() {
  Serial.begin(9600);
  pinMode(2, INPUT);
  pinMode(8, OUTPUT);
  Serial.println("ready");
}

void loop() {
  int reading = digitalRead(2);
  if (reading == HIGH && lastReading == LOW && millis() - lastPress >= debounceMs) {
    lastPress = millis();
    ledOn = !ledOn;
    digitalWrite(8, ledOn);
    Serial.println(ledOn ? "toggle -> ON" : "toggle -> OFF");
  }
  lastReading = reading;
}
