// Test fixture for the Nano board: A6 and A7 are analog input only and need the Nano core.
void setup() {
  Serial.begin(9600);
  Serial.println("ready");
}
void loop() {
  Serial.print("a6=");
  Serial.print(analogRead(A6));
  Serial.print(" a7=");
  Serial.println(analogRead(A7));
  delay(100);
}
