// Lesson 6: night light. LDR divider on A1, LED on D8.
unsigned int threshold = 400;   // below this reading it is "dark"

void setup() {
  Serial.begin(9600);
  pinMode(8, OUTPUT);
  Serial.println("ready");
}

void loop() {
  int v = analogRead(A1);
  if (v < threshold) {
    digitalWrite(8, HIGH);
    Serial.print(v);
    Serial.println(" dark, light on");
  } else {
    digitalWrite(8, LOW);
    Serial.print(v);
    Serial.println(" bright, light off");
  }
  delay(100);
}
