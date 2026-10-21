// Lesson 10: sweep a servo on D9 back and forth.
#include <Servo.h>

byte fromDeg = 10;   // start angle
byte toDeg = 170;    // end angle
byte stepMs = 15;    // ms per degree
Servo arm;

void setup() {
  Serial.begin(9600);
  arm.attach(9);
  Serial.println("ready");
}

void loop() {
  Serial.println("sweep out");
  for (int a = fromDeg; a <= toDeg; a++) {
    arm.write(a);
    delay(stepMs);
  }
  Serial.println("sweep back");
  for (int a = toDeg; a >= fromDeg; a--) {
    arm.write(a);
    delay(stepMs);
  }
}
