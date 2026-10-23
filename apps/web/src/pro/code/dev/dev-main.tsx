/** Dev harness: farm fixture, with richer sources and one linted and one failed file so every badge shows. */
import {createRoot} from 'react-dom/client';
import {proActions} from '../../api/spec-store';
import {devSpec,DEV_PROJECT_ID} from '../../workspace/dev-fixture';
import {CodeTab} from '../CodeTab';

const melon=`// node-melon.ino · node N1 · Field B (melon, drip)
// Pins come from pins_n1.h (wiring W1-W5).
#include <SPI.h>
#include <OneWire.h>   // 2.3.8
#include "pins_n1.h"

constexpr long LORA_FREQ_HZ = 921400000;  // AS923-2
constexpr uint32_t REPORT_S = 300;        // uplink every 5 min
constexpr int SOIL_DRY_RAW  = 3150;

OneWire oneWire(PIN_SOIL_1);
float vwc(int raw) {
  float p = 100.0f * (SOIL_DRY_RAW - raw) / 1770.0f;
  return constrain(p, 0.0f, 100.0f);
}

void setup() {
  Serial.begin(115200);
  pinMode(PIN_SOIL_1, INPUT);
  Serial.println("AIOT_BOOT_BANNER");
}

void loop() {
  int raw = analogRead(PIN_SOIL_1);
  Serial.println(vwc(raw));
  delay(REPORT_S * 1000UL);
}
`;
const spec=JSON.parse(JSON.stringify(devSpec));
spec.code[0].content=melon;spec.code[0].pinsReferenced=[{symbol:'PIN_SOIL_1',pin:'GPIO34',lines:[5,10,18,23]}];
const lint={...JSON.parse(JSON.stringify(spec.code[1])),id:'code-node-mango-gateway-py',filename:'gateway.py',language:'python',content:'import time\n\n# forward readings\nwhile True:\n    time.sleep(1)\n'};
lint.verify.status='linted';lint.verify.toolchain='ruff@0.6.9';lint.pinsReferenced=[];spec.code.splice(2,0,lint);
spec.code[3].verify={...spec.code[3].verify,status:'failed',diagnostics:[{line:2,message:"'Serial2' was not declared in this scope",severity:'error'}]};
spec.verification={...spec.verification};delete spec.verification['/code/2'];
proActions.setSpec(DEV_PROJECT_ID,1,spec);
createRoot(document.getElementById('root')!).render(<CodeTab/>);
