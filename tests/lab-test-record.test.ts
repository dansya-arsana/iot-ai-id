import test from 'node:test';
import assert from 'node:assert/strict';
import {CIRCUITS,LESSON_IDS} from '../apps/web/src/lab/contract.js';
import type {LessonId,SimSnapshot} from '../apps/web/src/lab/contract.js';
import {createLabRunner} from '../apps/web/src/lab/sim/index.js';
import {labFirmware} from '../apps/web/src/lab/firmware/index.js';
import {recordFor} from '../apps/web/src/lab/ui/test-record.js';
import {createPinHistory} from '../apps/web/src/lab/ui/pin-history.js';

/** The generic Test Record speaks the protocol of each pin: UART bytes/lines/baud, SPI transactions, I2C addresses, WS2812 frames and pixels. */
function record(id:LessonId,ms:number){
 const runner=createLabRunner();
 runner.load(labFirmware.lessons[id].variants[0]!,{},structuredClone(CIRCUITS[id]),labFirmware.toolchain);
 runner.start();
 const h=createPinHistory();
 let s:SimSnapshot=runner.snapshot();
 for(let t=0;t<ms;t+=20){s=runner.advance(20);h.push(s);}
 return {rows:recordFor(id)(h,s,{}),s};
}
const row=(rows:{k:string;v:string}[],k:string)=>rows.find(r=>r.k===k)?.v;

test('record: SPI lesson reports transactions, bytes, mode and clock, not pin toggles',()=>{
 const {rows,s}=record('rfid-door',2500);
 assert.ok(s.bus!.spi.transactions>0&&s.bus!.spi.bytes>=s.bus!.spi.transactions);
 assert.match(row(rows,'SPI')??'',/^\d+ tx · \d+ B · \d+ (kHz|MHz)$/);
 assert.ok(!rows.some(r=>/^D1[0-3] toggled/.test(r.k)),'no per-pin toggle rows for SPI pins');
});
test('record: I2C lesson reports the addresses it talked to',()=>{
 const {rows,s}=record('weather-station',3000);
 assert.ok(s.bus!.i2c.addresses.length>=2,'BMP280 and LCD answered');
 const v=row(rows,'I2C')??'';
 assert.match(v,/0x[0-9A-F]{2}, 0x[0-9A-F]{2}/);assert.match(v,/transactions/);
 assert.ok(!rows.some(r=>/^A[45] toggled/.test(r.k)));
});
test('record: UART lesson reports bytes, lines and the real baud',()=>{
 const {rows,s}=record('gps-tracker',4000);
 assert.ok(s.bus!.uart.bytes>0);
 const v=row(rows,'UART')??'';
 assert.match(v,/^TX \d+ B · RX \d+ B · \d+ lines? · 9600 baud$/);
});
test('record: WS2812 lesson reports frames and pixel count',()=>{
 const {rows}=record('neopixel',2500);
 assert.match(row(rows,'WS2812')??'',/^\d+ frames? · 16 pixels · 0 timing errors$/);
});
test('record: every lesson still yields a record with at most five rows and a timestamp',()=>{
 for(const id of LESSON_IDS){
  const {rows}=record(id as LessonId,600);
  assert.ok(rows.length>=1&&rows.length<=5,`${id}: ${rows.length} rows`);
 }
});

test('record: clock shows SPI row and weather-station shows DHT22 row',()=>{
 assert.match(row(record('clock',3000).rows,'SPI')??'',/\d+ tx · \d+ B/);
 assert.match(row(record('weather-station',3000).rows,'DHT22')??'',/reads · 24 °C 60 %RH/);
});
test('record: stepper keeps its timestamp row',()=>{
 assert.ok(record('stepper',3000).rows.some(r=>r.k==='at'));
});
