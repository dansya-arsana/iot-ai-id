// Generated golden-v1. Serial identity is bound to this artifact SHA by the trusted runtime.
#include <Wire.h>
#include <Adafruit_BME280.h>
#include <Adafruit_GFX.h>
#include <Adafruit_SSD1306.h>
#include <math.h>
Adafruit_BME280 sensor;
Adafruit_SSD1306 display(128, 64, &Wire, -1);
bool sensorReady = false;
bool oledReady = false;
uint32_t observationCycle = 0;
const char* experimentId = "recipe-run";
const char* contractDigest = "b5d3ecfaef42df0ecbd69de012263a916094de63ddf16e8bcabb0538c63785a1";
const char* nonce = "recipe-nonce";
const uint8_t sensorAddress = 118;
const uint8_t oledAddress = 60;
bool ack(uint8_t address) { Wire.beginTransmission(address); return Wire.endTransmission() == 0; }
void prefix(const char* check, bool passed) {
 Serial.print("{\"marker\":\"iot_observation\",\"experimentId\":\""); Serial.print(experimentId);
 Serial.print("\",\"contractHash\":\""); Serial.print(contractDigest);
 Serial.print("\",\"nonce\":\""); Serial.print(nonce);
 Serial.print("\",\"cycle\":"); Serial.print(observationCycle);
 Serial.print(",\"check\":\""); Serial.print(check);
 Serial.print("\",\"passed\":"); Serial.print(passed ? "true" : "false"); Serial.print(",\"data\":");
}
void setup() {
 Serial.begin(115200);
 Wire.begin(21, 22);
 Wire.setTimeOut(100);
}
void loop() {
 observationCycle++;
 bool bmeAck = ack(sensorAddress);
 bool oledAck = ack(oledAddress);
 prefix("device_addresses", bmeAck && oledAck); Serial.print("{\"addresses\":[");
 bool first = true;
 for (uint8_t address = 1; address < 127; address++) { if (ack(address)) { if (!first) Serial.print(","); Serial.print(address); first = false; } }
 Serial.println("]}}");
 if (!bmeAck) sensorReady = false;
 if (bmeAck && !sensorReady) sensorReady = sensor.begin(sensorAddress, &Wire);
 float temperature = NAN, humidity = NAN;
 if (sensorReady) { temperature = sensor.readTemperature(); humidity = sensor.readHumidity(); }
 bool readingsValid = sensorReady && isfinite(temperature) && isfinite(humidity) && temperature >= -40 && temperature <= 85 && humidity >= 0 && humidity <= 100;
 prefix("sensor_readings", readingsValid);
 if (readingsValid) { Serial.print("{\"temperature\":"); Serial.print(temperature, 2); Serial.print(",\"humidity\":"); Serial.print(humidity, 2); Serial.println("}}"); }
 else Serial.println("{\"temperature\":null,\"humidity\":null,\"error\":\"sensor_missing_or_invalid\"}}");
 if (!oledAck) oledReady = false;
 if (oledAck && !oledReady) oledReady = display.begin(SSD1306_SWITCHCAPVCC, oledAddress);
 if (oledReady && oledAck) {
  display.clearDisplay(); display.setTextSize(1); display.setTextColor(SSD1306_WHITE); display.setCursor(0,0);
  if (readingsValid) { display.print("Temp: "); display.println(temperature); display.print("Humidity: "); display.println(humidity); }
  else display.println("Sensor unavailable");
  display.display();
 }
 bool usable = oledReady && ack(oledAddress);
 prefix("oled_initialized", usable); Serial.print("{\"initialized\":"); Serial.print(usable ? "true" : "false"); Serial.print(",\"addressAck\":"); Serial.print(oledAck ? "true" : "false"); Serial.println("}}");
 delay(2000);
}
