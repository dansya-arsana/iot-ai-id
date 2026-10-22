/** Board variants: the Nano runs (A6/A7 analog only), the ESP32 stays a model. */
import test from 'node:test';
import assert from 'node:assert/strict';
import {BOARDS,boardOf,boardPinNames,isAnalogOnly} from '../apps/web/src/lab/boards.js';
import {ADC_CHANNEL} from '../apps/web/src/lab/contract.js';
import {CircuitSpecSchema,specToCircuit,sketchPins,validateCircuitSpec} from '../apps/web/src/lab/circuit-spec.js';
import {deviceRegistry} from '../apps/web/src/lab/sim/devices/index.js';

const spec=(board:string|undefined,source:string,wire:string)=>CircuitSpecSchema.parse({
 ...(board?{board}:{}),
 parts:[{id:'pot',kind:'potentiometer',place:{free:{x:0,z:60}}}],
 wires:[{from:'5V',to:'pot.VCC',color:'red'},{from:'GND',to:'pot.GND',color:'black'},{from:wire,to:'pot.SIG',color:'yellow'}],
 sketch:{source},
});
const codes=(s:ReturnType<typeof spec>)=>validateCircuitSpec(s).issues.filter(i=>i.severity==='error').map(i=>i.code);

test('boards: uno and nano run, esp32 does not',()=>{
 assert.equal(BOARDS.uno.runtime,'emulated');assert.equal(BOARDS.nano.runtime,'emulated');
 assert.equal(BOARDS.esp32.runtime,'not-emulated');assert.equal(BOARDS.esp32.fqbn,undefined);
 assert.equal(BOARDS.nano.chip,BOARDS.uno.chip,'same ATmega328P');
 assert.deepEqual(BOARDS.uno.analogOnly,[]);assert.deepEqual([...BOARDS.nano.analogOnly],['A6','A7']);
 assert.equal(BOARDS.nano.jack,false);assert.equal(BOARDS.nano.fqbn,'arduino:avr:nano:cpu=atmega328');
 assert.equal(boardOf(undefined).id,'uno');assert.equal(boardOf({board:'nano'}).id,'nano');
 assert.ok(boardPinNames('nano').includes('A7'));assert.ok(!boardPinNames('uno').includes('A7'));
 assert.ok(isAnalogOnly('A6')&&!isAnalogOnly('A5'));
 assert.equal(ADC_CHANNEL.A6,6);assert.equal(ADC_CHANNEL.A7,7);
});
test('boards: the ESP32 device keeps its honest not-emulated flag, the Nano model does not claim to be model-only',()=>{
 assert.equal(deviceRegistry.get('esp32-devkit')!.runtime,'not-emulated');
 assert.notEqual(deviceRegistry.get('arduino-nano')!.runtime,'not-emulated');
});
test('boards: a spec defaults to the Uno and carries the board into the Circuit',()=>{
 const u=spec(undefined,'void setup(){}void loop(){analogRead(A0);}','A0');
 assert.equal(u.board,'uno');assert.equal(specToCircuit(u).board,'uno');
 const n=spec('nano','void setup(){}void loop(){analogRead(A6);}','A6');
 assert.equal(specToCircuit(n).board,'nano');
 assert.equal(specToCircuit(n).parts.find(p=>p.id==='pot')!.net.SIG,'A6');
});
test('boards: A6 and A7 exist on the Nano only and are analog input only',()=>{
 assert.deepEqual(codes(spec('nano','void setup(){}void loop(){analogRead(A6);}','A6')),[]);
 assert.ok(codes(spec('uno','void setup(){}void loop(){analogRead(A6);}','A6')).includes('pin-not-on-board'));
 assert.ok(codes(spec('nano','void setup(){pinMode(A6,INPUT);}void loop(){digitalRead(A6);}','A6')).includes('analog-only-pin'));
 assert.deepEqual(codes(spec('nano','void setup(){}void loop(){analogRead(7);}','A7')),[],'plain number 7 with analogRead is A7');
 const sp=sketchPins('void loop(){analogRead(A6);digitalWrite(5,HIGH);pinMode(21,INPUT);}');
 assert.ok(sp.used.has('A6')&&sp.used.has('D5')&&sp.used.has('A7'));   // 21 is A7 in the Nano core numbering
 assert.ok(sp.digital.has('A7')&&sp.digital.has('D5')&&!sp.digital.has('A6'));
 assert.ok(sketchPins('#include <SPI.h>\nvoid setup(){SPI.begin();}').used.has('D13'),'SPI uses D11-D13');
});
