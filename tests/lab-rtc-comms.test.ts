/**
 * Real firmware on the rtc-comms parts: a DS3231 + AT24C32 sketch over Wire, an NMEA reader on hardware Serial, and an HC-05 terminal
 * on a hand-written software UART (no SoftwareSerial library). Fixtures: tests/fixtures/sketches/{rtc-ds3231,gps-nmea,bt-terminal}.ino.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import type {BoardPin,Circuit,FirmwareVariant,PartSpec} from '../apps/web/src/lab/contract.js';
import {createLabRunner} from '../apps/web/src/lab/sim/runner.js';
import {extInput} from '../apps/web/src/lab/sim/devices/types.js';

const fixture=(n:string):{toolchain:string;variant:FirmwareVariant}=>JSON.parse(readFileSync(new URL(`./fixtures/firmware/${n}.json`,import.meta.url),'utf8'));
const part=(id:string,kind:string,net:Partial<Record<string,BoardPin>>,props:Record<string,string|number|boolean>={}):PartSpec=>({id,kind,net,props});
function boot(name:string,c:Circuit){
 const fx=fixture(name),r=createLabRunner();
 r.load(fx.variant,{},c,fx.toolchain);r.start();
 return r;
}
const ext=(r:ReturnType<typeof boot>,id:string):Record<string,string|number|boolean|null>=>{const s=r.snapshot().parts[id]!;assert.equal(s.kind,'ext');return (s as {v:Record<string,string|number|boolean|null>}).v;};

test('ds3231 firmware: sets the time over Wire, reads it back ticking, alarm 1 fires on the minute, EEPROM ACK polling works',()=>{
 const r=boot('rtc-ds3231',{wires:[],parts:[part('rtc','ds3231-rtc',{SCL:'A5',SDA:'A4',SQW:'D2',VCC:'5V',GND:'GND'})]});
 r.advance(60);
 // the EEPROM answered after the write cycle (at least one NACKed poll), then returned what was stored
 assert.match(r.serialText(),/ee=Hi polls>0=1/);
 r.advance(1300);
 const t=r.serialText();
 // the sketch set 2030-06-15 23:59:55: the reads advance with simulated time and the minute rolls into the next day
 assert.match(t,/2030-6-15 23:59:5\d dw=6 A1F=0/);
 r.advance(6000);
 assert.match(r.serialText(),/2030-6-16 0:0:\d dw=7/);
 assert.match(r.serialText(),/A1F=1/);   // the alarm matched at 00:00:00
 const v=ext(r,'rtc');
 assert.equal(v.address,0x68);assert.ok(Number(v.reads)>20);assert.equal(v.eepromWrites,2);
});

test('gps firmware: the NEO-6M sends NMEA over hardware Serial and the sketch parses the GGA line',()=>{
 const r=boot('gps-nmea',{wires:[],parts:[part('gps','gps-neo6m',{TX:'D0',RX:'D1',VCC:'5V',GND:'GND'})]});
 r.advance(2600);
 const t=r.serialText();
 assert.match(t,/gps ready/);
 assert.match(t,/GGA\s+0612\.52800 S 10650\.73600 E 1/);
 const v=ext(r,'gps');
 assert.ok(Number(v.sentences)>=8);assert.equal(v.ioTx,'hardware');assert.equal(v.fix,true);
 // lose the fix: the next epoch sends the empty GGA
 r.setPartProps('gps',{fix:false});
 const before=r.serialText().length;
 r.advance(1500);
 assert.match(r.serialText().slice(before),/GGA\s+0\s/);
 assert.equal(ext(r,'gps').fix,false);
});

test('hc05 firmware: a hand-written software UART talks to the module in both directions at 9600 baud',()=>{
 const r=boot('bt-terminal',{wires:[],parts:[part('bt','hc05-bluetooth',{RXD:'D11',TXD:'D10',VCC:'5V',GND:'GND'})]});
 r.advance(80);
 assert.match(r.serialText(),/bt ready/);
 let v=ext(r,'bt');
 assert.equal(v.ioRx,'software');assert.equal(v.framingErrors,0);
 assert.match(String(v.transcript),/< hello phone/);
 // the phone sends a line; the sketch prints it and answers
 r.setInput('bt',extInput('hc05-bluetooth',{line:'LED ON',ending:'lf'}));
 r.advance(150);
 assert.match(r.serialText(),/got=LED ON/);
 v=ext(r,'bt');
 assert.match(String(v.transcript),/> LED ON/);
 assert.match(String(v.transcript),/< ack:LED ON/);
 assert.equal(v.framingErrors,0);
});
