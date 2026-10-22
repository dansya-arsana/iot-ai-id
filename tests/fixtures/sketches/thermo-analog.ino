// Test fixture: an LM35 on A0 (10 mV per degC) and a 10k B3950 NTC divider on A1 (beta equation), both read with analogRead.
const float BETA = 3950.0, R0 = 10000.0, T0 = 298.15, RSERIES = 10000.0;
uint16_t readEvery = 100;
void setup() {
  Serial.begin(9600);
  Serial.println("ready");
}
void loop() {
  int a0 = analogRead(A0);
  float lm35 = a0 * 5000.0 / 1023.0 / 10.0;
  int a1 = analogRead(A1);
  float rntc = RSERIES * (1023.0 / a1 - 1.0);       // NTC on the supply side, series resistor to GND
  float tk = 1.0 / (1.0 / T0 + log(rntc / R0) / BETA);
  Serial.print("lm35="); Serial.print(lm35, 1);
  Serial.print(" a1="); Serial.print(a1);
  Serial.print(" ntc="); Serial.println(tk - 273.15, 1);
  delay(readEvery);
}
