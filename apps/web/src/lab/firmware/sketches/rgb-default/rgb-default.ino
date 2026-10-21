// Lesson 5: mix colour with three PWM pins (R=D9, G=D10, B=D11).
byte red = 255;     // 0-255
byte green = 64;    // 0-255
byte blue = 160;    // 0-255

void setup() {
  Serial.begin(9600);
  pinMode(9, OUTPUT);
  pinMode(10, OUTPUT);
  pinMode(11, OUTPUT);
  Serial.println("ready");
}

void loop() {
  analogWrite(9, red);
  analogWrite(10, green);
  analogWrite(11, blue);
  Serial.print("R ");
  Serial.print(red);
  Serial.print(" G ");
  Serial.print(green);
  Serial.print(" B ");
  Serial.println(blue);
  delay(1000);
}
