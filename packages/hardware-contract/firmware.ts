import {resolveRecipe} from '../recipe-registry/index.js';
import type {HardwareContract} from './index.js';
import {validateContract} from '../../packages/validator/index.js';
import {contractHash,hashText} from '../evidence/index.js';
export interface FirmwareArtifact {source:string;hash:string;sourceHash:string;contractHash:string;experimentId:string;nonce:string;filename:string;fqbn:string;libraries:string[]}
/** Source SHA is attached by the trusted runtime to serial observations, not self-embedded. */
export function generateFirmware(contract:HardwareContract,run:{experimentId:string;nonce:string}):FirmwareArtifact{
 const validation=validateContract(contract,{execution:true});if(!validation.valid)throw new Error(`Invalid contract: ${validation.errors.map(e=>e.code).join(', ')}`);
 const recipe=resolveRecipe(contract);
 if(!recipe)throw new Error('Unsupported firmware recipe.');
 if(recipe.generator==='golden-v1')return generateGoldenFirmware(contract,run);
 if(recipe.generator==='button-led-v1')return generateButtonLedFirmware(contract,run);
 throw new Error('Unsupported firmware recipe.');
}
function generateGoldenFirmware(contract:HardwareContract,run:{experimentId:string;nonce:string}):FirmwareArtifact{
 if(contract.board.id!=='esp32-devkit'||contract.components.length!==2||!['bme280','ssd1306'].every(id=>contract.components.some(x=>x.manifest.id===id)))throw new Error('Firmware generation supports only the golden ESP32+BME280+SSD1306 contract.');
 if(!/^[a-zA-Z0-9_-]{1,128}$/.test(run.experimentId)||!/^[a-zA-Z0-9_-]{1,128}$/.test(run.nonce))throw new Error('Invalid run identifier.');
 const bme=contract.components.find(x=>x.manifest.id==='bme280')!,oled=contract.components.find(x=>x.manifest.id==='ssd1306')!;
 const pin=(role:string,id:string)=>Number(contract.connections.find(w=>w.componentId===id&&w.role===role)!.boardPin);
 if(pin('sda',bme.instanceId)!==pin('sda',oled.instanceId)||pin('scl',bme.instanceId)!==pin('scl',oled.instanceId))throw new Error('Golden firmware requires one shared I2C bus.');
 const digest=contractHash(contract);
 const source=`// Generated golden-v1. Serial identity is bound to this artifact SHA by the trusted runtime.
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
const char* experimentId = "${run.experimentId}";
const char* contractDigest = "${digest}";
const char* nonce = "${run.nonce}";
const uint8_t sensorAddress = ${bme.address};
const uint8_t oledAddress = ${oled.address};
bool ack(uint8_t address) { Wire.beginTransmission(address); return Wire.endTransmission() == 0; }
void prefix(const char* check, bool passed) {
 Serial.print("{\\"marker\\":\\"iot_observation\\",\\"experimentId\\":\\""); Serial.print(experimentId);
 Serial.print("\\",\\"contractHash\\":\\""); Serial.print(contractDigest);
 Serial.print("\\",\\"nonce\\":\\""); Serial.print(nonce);
 Serial.print("\\",\\"cycle\\":"); Serial.print(observationCycle);
 Serial.print(",\\"check\\":\\""); Serial.print(check);
 Serial.print("\\",\\"passed\\":"); Serial.print(passed ? "true" : "false"); Serial.print(",\\"data\\":");
}
void setup() {
 Serial.begin(115200);
 Wire.begin(${pin('sda',bme.instanceId)}, ${pin('scl',bme.instanceId)});
 Wire.setTimeOut(100);
}
void loop() {
 observationCycle++;
 bool bmeAck = ack(sensorAddress);
 bool oledAck = ack(oledAddress);
 prefix("device_addresses", bmeAck && oledAck); Serial.print("{\\"addresses\\":[");
 bool first = true;
 for (uint8_t address = 1; address < 127; address++) { if (ack(address)) { if (!first) Serial.print(","); Serial.print(address); first = false; } }
 Serial.println("]}}");
 if (!bmeAck) sensorReady = false;
 if (bmeAck && !sensorReady) sensorReady = sensor.begin(sensorAddress, &Wire);
 float temperature = NAN, humidity = NAN;
 if (sensorReady) { temperature = sensor.readTemperature(); humidity = sensor.readHumidity(); }
 bool readingsValid = sensorReady && isfinite(temperature) && isfinite(humidity) && temperature >= -40 && temperature <= 85 && humidity >= 0 && humidity <= 100;
 prefix("sensor_readings", readingsValid);
 if (readingsValid) { Serial.print("{\\"temperature\\":"); Serial.print(temperature, 2); Serial.print(",\\"humidity\\":"); Serial.print(humidity, 2); Serial.println("}}"); }
 else Serial.println("{\\"temperature\\":null,\\"humidity\\":null,\\"error\\":\\"sensor_missing_or_invalid\\"}}");
 if (!oledAck) oledReady = false;
 if (oledAck && !oledReady) oledReady = display.begin(SSD1306_SWITCHCAPVCC, oledAddress);
 if (oledReady && oledAck) {
  display.clearDisplay(); display.setTextSize(1); display.setTextColor(SSD1306_WHITE); display.setCursor(0,0);
  if (readingsValid) { display.print("Temp: "); display.println(temperature); display.print("Humidity: "); display.println(humidity); }
  else display.println("Sensor unavailable");
  display.display();
 }
 bool usable = oledReady && ack(oledAddress);
 prefix("oled_initialized", usable); Serial.print("{\\"initialized\\":"); Serial.print(usable ? "true" : "false"); Serial.print(",\\"addressAck\\":"); Serial.print(oledAck ? "true" : "false"); Serial.println("}}");
 delay(2000);
}
`;
 const hash=hashText(source);return{source,hash,sourceHash:hash,contractHash:digest,...run,filename:'room_monitor.ino',fqbn:contract.firmware.fqbn,libraries:contract.firmware.libraries};
}

/** Button+LED telemetry: raw and debounced input, commanded output level, and a completed release-press-release sequence count per cycle. */
function generateButtonLedFirmware(contract:HardwareContract,run:{experimentId:string;nonce:string}):FirmwareArtifact{
 if(!/^[a-zA-Z0-9_-]{1,128}$/.test(run.experimentId)||!/^[a-zA-Z0-9_-]{1,128}$/.test(run.nonce))throw new Error('Invalid run identifier.');
 const button=contract.components.find(x=>x.manifest.id==='button-pullup-10k'),led=contract.components.find(x=>x.manifest.id==='led-series-330');
 if(!button||!led)throw new Error('Button-LED firmware requires the exact button and LED assemblies.');
 const wire=(componentId:string,pin:string)=>contract.connections.find(w=>w.componentId===componentId&&w.pin===pin)?.boardPin;
 const inputPin=wire(button.instanceId,'SIGNAL'),outputPin=wire(led.instanceId,'SIGNAL');
 if(!inputPin||!outputPin||inputPin===outputPin)throw new Error('Button-LED firmware requires distinct input and output GPIO.');
 const digest=contractHash(contract);
 const source=`// Generated button-led-v1. Serial identity is bound to this artifact SHA by the trusted runtime.
#include <Arduino.h>
uint32_t observationCycle = 0;
uint32_t presses = 0;
uint32_t releases = 0;
bool stablePressed = false;
bool lastRaw = HIGH;
uint32_t lastChangeMs = 0;
const uint32_t debounceMs = 30;
const char* experimentId = "${run.experimentId}";
const char* contractDigest = "${digest}";
const char* nonce = "${run.nonce}";
const uint8_t inputPin = ${inputPin};
const uint8_t outputPin = ${outputPin};
void prefix(const char* check, bool passed) {
 Serial.print("{\\"marker\\":\\"iot_observation\\",\\"experimentId\\":\\""); Serial.print(experimentId);
 Serial.print("\\",\\"contractHash\\":\\""); Serial.print(contractDigest);
 Serial.print("\\",\\"nonce\\":\\""); Serial.print(nonce);
 Serial.print("\\",\\"cycle\\":"); Serial.print(observationCycle);
 Serial.print(",\\"check\\":\\""); Serial.print(check);
 Serial.print("\\",\\"passed\\":"); Serial.print(passed ? "true" : "false"); Serial.print(",\\"data\\":");
}
void setup() {
 Serial.begin(115200);
 pinMode(inputPin, INPUT);
 pinMode(outputPin, OUTPUT);
 digitalWrite(outputPin, LOW);
}
void loop() {
 observationCycle++;
 bool rawPressed = digitalRead(inputPin) == LOW;
 if (rawPressed != (lastRaw == LOW)) { lastChangeMs = millis(); lastRaw = rawPressed ? LOW : HIGH; }
 if (millis() - lastChangeMs >= debounceMs && rawPressed != stablePressed) {
  stablePressed = rawPressed;
  if (stablePressed) presses++; else releases++;
 }
 digitalWrite(outputPin, stablePressed ? HIGH : LOW);
 bool sequenceValid = presses >= 1 && releases >= 1 && presses == releases;
 prefix("button_input", true); Serial.print("{\\"pin\\":"); Serial.print(inputPin);
 Serial.print(",\\"raw\\":"); Serial.print(rawPressed ? "\\"pressed\\"" : "\\"released\\"");
 Serial.print(",\\"stable\\":"); Serial.print(stablePressed ? "\\"pressed\\"" : "\\"released\\"");
 Serial.print(",\\"presses\\":"); Serial.print(presses);
 Serial.print(",\\"releases\\":"); Serial.print(releases); Serial.println("}}");
 prefix("output_commanded", true); Serial.print("{\\"pin\\":"); Serial.print(outputPin);
 Serial.print(",\\"level\\":"); Serial.print(stablePressed ? "HIGH" : "LOW");
 Serial.print(",\\"matchesInput\\":true"); Serial.println("}}");
 prefix("behavior_sequence", sequenceValid); Serial.print("{\\"presses\\":"); Serial.print(presses);
 Serial.print(",\\"releases\\":"); Serial.print(releases);
 Serial.print(",\\"complete\\":"); Serial.print(sequenceValid ? "true" : "false"); Serial.println("}}");
 delay(500);
}
`;
 const hash=hashText(source);return{source,hash,sourceHash:hash,contractHash:digest,...run,filename:'button_led.ino',fqbn:contract.firmware.fqbn,libraries:contract.firmware.libraries};
}
