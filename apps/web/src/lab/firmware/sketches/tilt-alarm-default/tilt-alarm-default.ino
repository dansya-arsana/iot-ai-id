// Lesson 18: Tilt alarm. MPU6050 on I2C (A4 = SDA, A5 = SCL, address 0x68), passive buzzer on D5,
// 10-segment LED bar on D2,D3,D4,D6..D12 (segment 1 first). No libraries except Wire: the MPU6050 driver is ours.
unsigned int alarmDeg = 45;     // tilt angle that sounds the buzzer
unsigned int sampleMs = 50;     // ms between readings

#include <Wire.h>
#include <math.h>

const byte MPU = 0x68;
const byte BUZZER = 5;
const byte BAR[10] = {2, 3, 4, 6, 7, 8, 9, 10, 11, 12};

bool mpuWrite(byte reg, byte value) {
  Wire.beginTransmission(MPU);
  Wire.write(reg);
  Wire.write(value);
  return Wire.endTransmission() == 0;
}

// Reads the three accelerometer axes (raw, 16384 per g at the default +-2 g range). Returns false if the chip does not answer.
bool mpuAccel(int &ax, int &ay, int &az) {
  Wire.beginTransmission(MPU);
  Wire.write(0x3B);                       // ACCEL_XOUT_H
  if (Wire.endTransmission(false) != 0) return false;
  if (Wire.requestFrom((int)MPU, 6) != 6) return false;
  ax = (Wire.read() << 8) | Wire.read();
  ay = (Wire.read() << 8) | Wire.read();
  az = (Wire.read() << 8) | Wire.read();
  return true;
}

void showBar(byte n) {
  for (byte i = 0; i < 10; i++) digitalWrite(BAR[i], i < n ? HIGH : LOW);
}

void setup() {
  Serial.begin(9600);
  for (byte i = 0; i < 10; i++) pinMode(BAR[i], OUTPUT);
  pinMode(BUZZER, OUTPUT);
  Wire.begin();
  mpuWrite(0x6B, 0x00);                   // PWR_MGMT_1 = 0: wake the chip from sleep
  Serial.println("ready");
}

void loop() {
  int ax = 0, ay = 0, az = 0;
  if (mpuAccel(ax, ay, az)) {
    float x = ax / 16384.0, y = ay / 16384.0, z = az / 16384.0;
    // tilt = angle between the board's up axis and gravity
    float tilt = atan2(sqrt(x * x + y * y), z) * 57.29578;
    if (tilt < 0) tilt = 0;
    int deg = (int)(tilt + 0.5);
    byte bars = (byte)(tilt * 10.0 / 90.0 + 0.5);
    if (bars > 10) bars = 10;
    showBar(bars);
    if (deg >= (int)alarmDeg) {
      tone(BUZZER, 1000);
    } else {
      noTone(BUZZER);
    }
    Serial.print("tilt ");
    Serial.print(deg);
    Serial.println(deg >= (int)alarmDeg ? " ALARM" : " ok");
  } else {
    showBar(0);
    noTone(BUZZER);
    Serial.println("no sensor");
  }
  delay(sampleMs);
}
