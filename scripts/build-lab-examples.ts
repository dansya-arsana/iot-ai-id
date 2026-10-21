/**
 * Builds the three curated Lab AI examples (ADR 011): apps/web/src/lab/ai/examples/<id>.json = {exampleId,prompt,spec,build}.
 * Each spec is validated with parseCircuitSpec and its sketch is compiled through the same sandboxed compiler the server uses
 * (Docker image aiot-avr-sandbox:1.8.8, see scripts/lab-firmware/Dockerfile.sandbox). Run: npx tsx scripts/build-lab-examples.ts
 * Never hand-edit the JSON.
 */
import {mkdirSync,writeFileSync} from 'node:fs';
import {DatabaseSync} from 'node:sqlite';
import {dirname,join,resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import {parseCircuitSpec,type CircuitSpec} from '../apps/web/src/lab/circuit-spec.js';
import {EXAMPLE_CLOSE_ALARM} from '../apps/web/src/lab/circuit-examples.js';
import {DockerRunner,LabCompiler} from '../services/ops/lab-compile.js';

const OUT=join(resolve(dirname(fileURLToPath(import.meta.url)),'..'),'apps/web/src/lab/ai/examples');

const PARKING_SKETCH=`// Parking beeper: the closer something gets (under 20 cm), the faster it beeps.
const int TRIG = 7;
const int ECHO = 6;
const int LED = 8;
const int BUZZER = 9;
const int NEAR_CM = 20;

void setup() {
  pinMode(TRIG, OUTPUT);
  pinMode(ECHO, INPUT);
  pinMode(LED, OUTPUT);
  pinMode(BUZZER, OUTPUT);
  Serial.begin(9600);
}

void loop() {
  digitalWrite(TRIG, LOW);
  delayMicroseconds(2);
  digitalWrite(TRIG, HIGH);
  delayMicroseconds(10);
  digitalWrite(TRIG, LOW);
  long us = pulseIn(ECHO, HIGH, 30000);
  int cm = us / 58;
  Serial.print(cm);
  Serial.println(" cm");
  if (cm > 0 && cm < NEAR_CM) {
    tone(BUZZER, 1000);            // short beep and red light
    digitalWrite(LED, HIGH);
    delay(40);
    noTone(BUZZER);
    digitalWrite(LED, LOW);
    delay(30 + cm * 15);           // closer = shorter pause = faster beeps
  } else {
    noTone(BUZZER);
    digitalWrite(LED, LOW);
    delay(60);
  }
}
`;

const parking:CircuitSpec={...structuredClone(EXAMPLE_CLOSE_ALARM),sketch:{source:PARKING_SKETCH},goal:{en:'Beep faster and faster as something gets closer than 20 cm.',id:'Berbunyi makin cepat saat ada benda mendekat di bawah 20 cm.'}};

const NIGHT_SKETCH=`// Night light: the LED turns on when the room gets dark.
const int LDR_PIN = A0;
const int LED = 8;
const int DARK_BELOW = 400;   // 0..1023, lower = darker

void setup() {
  pinMode(LED, OUTPUT);
}

void loop() {
  int level = analogRead(LDR_PIN);
  digitalWrite(LED, level < DARK_BELOW ? HIGH : LOW);
  delay(50);
}
`;
const night:CircuitSpec={
 board:'uno',
 parts:[
  {id:'ldr1',kind:'ldr',props:{fixedOhms:10000},place:{breadboard:{col:4,row:2}}},
  {id:'r2',kind:'resistor',props:{ohms:10000,role:'divider'},place:{breadboard:{col:6,row:3}}},
  {id:'lamp1',kind:'lamp',props:{target:'ldr1',distanceCm:40,on:true},place:{free:{x:61,z:58}}},
  {id:'led1',kind:'led',props:{color:'yellow'},place:{breadboard:{col:14,row:2}}},
  {id:'r1',kind:'resistor',props:{ohms:220},place:{breadboard:{col:15,row:3}}},
 ],
 wires:[
  {id:'w-5v',from:'5V',to:'ldr1.A',color:'red'},
  {id:'w-a0',from:'A0',to:'ldr1.B',color:'green'},
  {id:'w-div',from:'r2.2',to:'GND',color:'black'},
  {id:'w-led',from:'D8',to:'led1.A',color:'orange'},
  {id:'w-rgnd',from:'r1.2',to:'GND',color:'black'},
 ],
 sketch:{source:NIGHT_SKETCH},
 steps:[
  {caption:{en:'A light sensor (LDR) goes on the breadboard.',id:'Sensor cahaya (LDR) dipasang di breadboard.'},add:{parts:['ldr1']}},
  {caption:{en:'A 10k resistor next to it forms a light divider.',id:'Resistor 10k di sebelahnya membentuk pembagi cahaya.'},add:{parts:['r2']}},
  {caption:{en:'5V feeds the sensor, A0 reads the middle point, the resistor returns to ground.',id:'5V memberi daya sensor, A0 membaca titik tengah, resistor kembali ke ground.'},add:{wires:['w-5v','w-a0','w-div']}},
  {caption:{en:'A desk lamp to play with the light level.',id:'Lampu meja untuk mengubah tingkat cahaya.'},add:{parts:['lamp1']}},
  {caption:{en:'A yellow LED with its resistor.',id:'LED kuning beserta resistornya.'},add:{parts:['led1','r1']}},
  {caption:{en:'Pin 8 lights the LED; the resistor returns to ground.',id:'Pin 8 menyalakan LED; resistor kembali ke ground.'},add:{wires:['w-led','w-rgnd']}},
 ],
 goal:{en:'Turn an LED on when it gets dark.',id:'Nyalakan LED saat gelap.'},
};

const GATE_SKETCH=`// Servo gate: press the button and the gate opens for 3 seconds.
#include <Servo.h>

const int BUTTON = 2;
const int SERVO_PIN = 9;
const int CLOSED_DEG = 0;
const int OPEN_DEG = 90;
const unsigned long OPEN_MS = 3000;

Servo gate;

void setup() {
  pinMode(BUTTON, INPUT);          // pressed reads HIGH (pull-down resistor keeps it LOW)
  gate.attach(SERVO_PIN);
  gate.write(CLOSED_DEG);
}

void loop() {
  if (digitalRead(BUTTON) == HIGH) {
    gate.write(OPEN_DEG);
    delay(OPEN_MS);
    gate.write(CLOSED_DEG);
    delay(400);
  }
}
`;
const gate:CircuitSpec={
 board:'uno',
 parts:[
  {id:'btn1',kind:'button',props:{pull:'down'},place:{breadboard:{col:8,row:2}}},
  {id:'r1',kind:'resistor',props:{ohms:10000,role:'pull-down'},place:{breadboard:{col:10,row:3}}},
  {id:'sv1',kind:'servo',props:{},place:{free:{x:88,z:62}}},
 ],
 wires:[
  {id:'w-b5v',from:'5V',to:'btn1.1',color:'red'},
  {id:'w-btn',from:'D2',to:'btn1.2',color:'yellow'},
  {id:'w-bgnd',from:'r1.2',to:'GND',color:'black'},
  {id:'w-sig',from:'D9',to:'sv1.SIG',color:'orange'},
  {id:'w-sv5',from:'5V',to:'sv1.V',color:'red'},
  {id:'w-sgnd',from:'GND',to:'sv1.GND',color:'black'},
 ],
 sketch:{source:GATE_SKETCH},
 steps:[
  {caption:{en:'A push button goes on the breadboard, with a 10k resistor that keeps the pin low until you press.',id:'Tombol tekan dipasang di breadboard, dengan resistor 10k yang menjaga pin tetap rendah sampai ditekan.'},add:{parts:['btn1','r1']}},
  {caption:{en:'5V to the button, pin 2 listens, the resistor returns to ground. Pressing makes pin 2 high.',id:'5V ke tombol, pin 2 mendengarkan, resistor kembali ke ground. Saat ditekan, pin 2 menjadi tinggi.'},add:{wires:['w-b5v','w-btn','w-bgnd']}},
  {caption:{en:'The servo is the gate arm.',id:'Servo adalah lengan palang gerbang.'},add:{parts:['sv1']}},
  {caption:{en:'Servo signal on pin 9, power from 5V and ground.',id:'Sinyal servo di pin 9, daya dari 5V dan ground.'},add:{wires:['w-sig','w-sv5','w-sgnd']}},
 ],
 goal:{en:'Open a gate for 3 seconds when a button is pressed.',id:'Buka palang gerbang selama 3 detik saat tombol ditekan.'},
};

const EXAMPLES=[
 {exampleId:'close-alarm',prompt:{en:'Parking beeper: beep faster as something gets closer than 20 cm',id:'Pengingat parkir: berbunyi makin cepat saat ada benda lebih dekat dari 20 cm'},spec:parking},
 {exampleId:'night-light',prompt:{en:'Night light: LED turns on when it gets dark',id:'Lampu malam: LED menyala saat gelap'},spec:night},
 {exampleId:'servo-gate',prompt:{en:'Servo gate: button opens a gate for 3 seconds',id:'Gerbang servo: tombol membuka gerbang selama 3 detik'},spec:gate},
] as const;

const compiler=new LabCompiler(new DatabaseSync(':memory:'),new DockerRunner());
if(!await compiler.available()){console.error('Docker image aiot-avr-sandbox:1.8.8 is missing. Build it: see scripts/lab-firmware/Dockerfile.sandbox');process.exit(1);}
mkdirSync(OUT,{recursive:true});
for(const ex of EXAMPLES){
 const parsed=parseCircuitSpec(ex.spec);
 if(!parsed.ok){console.error(ex.exampleId,'invalid spec',JSON.stringify(parsed.issues,null,1));process.exit(1);}
 const out=await compiler.compile(parsed.spec.sketch.source);
 if(!out.ok){console.error(ex.exampleId,'compile failed',JSON.stringify(out.diagnostics));process.exit(1);}
 writeFileSync(join(OUT,ex.exampleId+'.json'),JSON.stringify({exampleId:ex.exampleId,prompt:ex.prompt,spec:parsed.spec,build:out.build},null,1)+'\n');
 console.log(ex.exampleId,out.build.bytes,'bytes',out.build.lines.length,'line runs',parsed.issues.map(i=>i.code).join(',')||'no warnings');
}
