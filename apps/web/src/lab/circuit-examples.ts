/** Hand-checked CircuitSpecs used by tests, by the fixture AI provider and as the anonymous curated examples (ADR 011). Pure data. */
import type {CircuitSpec} from './circuit-spec';

const SKETCH_CLOSE=`// Beep and light red when something is closer than 20 cm.
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
  bool close = cm > 0 && cm < NEAR_CM;
  digitalWrite(LED, close ? HIGH : LOW);
  if (close) tone(BUZZER, 1000); else noTone(BUZZER);
  delay(60);
}
`;

export const EXAMPLE_CLOSE_ALARM:CircuitSpec={
 board:'uno',
 parts:[
  {id:'us1',kind:'hcsr04',props:{},place:{breadboard:{col:21,row:9}}},
  {id:'obs1',kind:'obstacle',props:{target:'us1',distanceCm:40,shape:'box'},place:{free:{x:100,z:20}}},
  {id:'led1',kind:'led',props:{color:'red'},place:{breadboard:{col:8,row:2}}},
  {id:'r1',kind:'resistor',props:{ohms:220},place:{breadboard:{col:9,row:3}}},
  {id:'bz1',kind:'buzzer',props:{},place:{breadboard:{col:14,row:2}}},
 ],
 wires:[
  {id:'w-vcc',from:'us1.VCC',to:'5V',color:'red'},
  {id:'w-trig',from:'us1.TRIG',to:'D7',color:'yellow'},
  {id:'w-echo',from:'us1.ECHO',to:'D6',color:'green'},
  {id:'w-ugnd',from:'us1.GND',to:'GND',color:'black'},
  {id:'w-led',from:'D8',to:'led1.A',color:'orange'},
  {id:'w-rgnd',from:'r1.2',to:'GND',color:'black'},
  {id:'w-bz',from:'D9',to:'bz1.+',color:'purple'},
  {id:'w-bzg',from:'bz1.-',to:'GND',color:'black'},
 ],
 sketch:{source:SKETCH_CLOSE},
 steps:[
  {caption:{en:'The distance sensor goes on the breadboard.',id:'Sensor jarak dipasang di breadboard.'},add:{parts:['us1']}},
  {caption:{en:'Power the sensor from 5V and ground.',id:'Beri daya sensor dari 5V dan ground.'},add:{wires:['w-vcc','w-ugnd']}},
  {caption:{en:'Trigger and echo wires carry the ping and its return.',id:'Kabel trigger dan echo membawa ping dan pantulannya.'},add:{wires:['w-trig','w-echo']}},
  {caption:{en:'Something to measure: an obstacle in front of the sensor.',id:'Sesuatu untuk diukur: halangan di depan sensor.'},add:{parts:['obs1']}},
  {caption:{en:'A red LED with its resistor.',id:'LED merah beserta resistornya.'},add:{parts:['led1','r1']}},
  {caption:{en:'Pin 8 lights the LED; the resistor returns to ground.',id:'Pin 8 menyalakan LED; resistor kembali ke ground.'},add:{wires:['w-led','w-rgnd']}},
  {caption:{en:'The buzzer sits next to it.',id:'Buzzer dipasang di sebelahnya.'},add:{parts:['bz1']}},
  {caption:{en:'Pin 9 makes the sound.',id:'Pin 9 membuat suara.'},add:{wires:['w-bz','w-bzg']}},
 ],
 goal:{en:'Beep and light red when something is closer than 20 cm.',id:'Berbunyi dan menyala merah saat ada benda lebih dekat dari 20 cm.'},
};
