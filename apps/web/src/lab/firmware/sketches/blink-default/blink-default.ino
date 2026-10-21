// Lesson 2: blink an external LED on pin 8.
unsigned int onTime = 500;    // ms LED stays on
unsigned int offTime = 500;   // ms LED stays off

void setup() {
  Serial.begin(9600);
  pinMode(8, OUTPUT);
  Serial.println("ready");
}

void loop() {
  digitalWrite(8, HIGH);
  Serial.println("D8 HIGH");
  delay(onTime);
  digitalWrite(8, LOW);
  Serial.println("D8 LOW");
  delay(offTime);
}
