// Lesson 25: a potentiometer sets the speed of two DC motors through an L298N dual H-bridge.
// Motor A turns one way, motor B the other way (on a two-wheel robot the motors face opposite directions).
unsigned int deadband = 40;      // pot readings below this stop both motors (0-1023)
unsigned int printEvery = 300;   // ms between serial lines
unsigned long lastPrint = 0;

const byte ENA = 9;    // PWM, speed of motor A
const byte ENB = 10;   // PWM, speed of motor B
const byte IN1 = 7;
const byte IN2 = 8;
const byte IN3 = 4;
const byte IN4 = 12;

void setup() {
  Serial.begin(9600);
  pinMode(ENA, OUTPUT);
  pinMode(ENB, OUTPUT);
  pinMode(IN1, OUTPUT);
  pinMode(IN2, OUTPUT);
  pinMode(IN3, OUTPUT);
  pinMode(IN4, OUTPUT);
  Serial.println("ready");
}

void loop() {
  int raw = analogRead(A0);
  int pwm = 0;
  if (raw >= (int)deadband) {
    pwm = raw / 4;
  }
  // direction: IN1 high / IN2 low is forward; motor B is mirrored
  digitalWrite(IN1, HIGH);
  digitalWrite(IN2, LOW);
  digitalWrite(IN3, LOW);
  digitalWrite(IN4, HIGH);
  analogWrite(ENA, pwm);
  analogWrite(ENB, pwm);
  if (millis() - lastPrint >= printEvery) {
    lastPrint = millis();
    Serial.print("pot ");
    Serial.print(raw);
    Serial.print(" -> pwm ");
    Serial.println(pwm);
  }
}
