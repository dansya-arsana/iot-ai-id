import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {PartRecordSchema,type PartRecord} from '../packages/catalog/schema.js';
import {SystemSpecSchema} from '../packages/pro-contract/system-spec.js';
import {allocatePins} from '../packages/pro-tools/impl/allocate.js';
import {checkCompatibility,checkNodeCompat} from '../packages/pro-tools/impl/compatibility.js';
import {validateNetlist,validateNetlistFull,checkNodeNetlist} from '../packages/pro-tools/impl/netlist.js';
import {deriveWires} from '../packages/pro-tools/impl/wiring.js';
import {lintCode,stripComments} from '../packages/pro-tools/impl/code-lint.js';
import {buildConfigBlock,injectConfigBlock,CONFIG_BEGIN,CONFIG_END} from '../packages/pro-tools/impl/config-block.js';
import {getTool} from '../packages/pro-tools/registry.js';

const cat=JSON.parse(readFileSync(new URL('../packages/catalog/fixtures/farm-parts.json',import.meta.url),'utf8')) as {parts:unknown[]};
const parts=new Map((cat.parts as PartRecord[]).map(p=>[PartRecordSchema.parse(p).identity.id,p]));
const lookup=(id:string)=>parts.get(id);
const spec=SystemSpecSchema.parse(JSON.parse(readFileSync(new URL('../packages/pro-contract/fixtures/farm-4-fields/spec.r1.json',import.meta.url),'utf8')));
const P=[{ref:'soil-moisture-capacitive-1',partId:'soil-moisture-capacitive'},{ref:'ds18b20-1',partId:'ds18b20'},{ref:'lora-rfm95w-1',partId:'lora-rfm95w'}];

test('allocator: LoRa on 5/14/26 with SPI 18/19/23, 1-Wire on 4, ADC1 for analog',()=>{
 const r=allocatePins({board:'esp32-devkitc',parts:P},lookup);
 assert.deepEqual(r.issues,[]);
 const by=(ref:string,pin:string)=>r.pins.find(p=>p.part===ref&&p.partPin===pin)!.boardPin;
 assert.equal(by('ds18b20-1','DQ'),'GPIO4');
 assert.equal(by('lora-rfm95w-1','NSS'),'GPIO5');assert.equal(by('lora-rfm95w-1','RST'),'GPIO14');assert.equal(by('lora-rfm95w-1','DIO0'),'GPIO26');
 assert.equal(by('lora-rfm95w-1','SCK'),'GPIO18');assert.equal(by('lora-rfm95w-1','MISO'),'GPIO19');assert.equal(by('lora-rfm95w-1','MOSI'),'GPIO23');
 assert.equal(by('soil-moisture-capacitive-1','AOUT'),'GPIO34');
 assert.ok(r.pins.every(p=>/^[A-Z][A-Z0-9_]{0,31}$/.test(p.symbol!)));
 assert.equal(new Set(r.pins.map(p=>p.symbol)).size,r.pins.length);
 // deterministic and order-independent for fixed-function pins
 assert.deepEqual(allocatePins({board:'esp32-devkitc',parts:P},lookup),r);
 const rev=allocatePins({board:'esp32-devkitc',parts:[...P].reverse()},lookup);
 assert.equal(rev.pins.find(p=>p.partPin==='DQ')!.boardPin,'GPIO4');
});
test('allocator never uses strap, flash or input-only pins for outputs; reports unknown parts and exhaustion',()=>{
 const many=Array.from({length:9},(_,i)=>({ref:`soil-moisture-capacitive-${i+1}`,partId:'soil-moisture-capacitive'}));
 const r=allocatePins({board:'esp32-devkitc',parts:many},lookup);
 assert.equal(r.pins.length,6);                       // six ADC1 pins
 assert.equal(r.issues.filter(i=>i.code==='alloc.no-pin').length,3);
 for(const n of [0,2,12,15,6,7,8,9,10,11])assert.ok(!r.pins.some(p=>p.gpio===n),`pin ${n}`);
 assert.equal(allocatePins({board:'esp32-devkitc',parts:[{ref:'x-1',partId:'nope'}]},lookup).issues[0]!.code,'part.unknown');
 const uno=allocatePins({board:'uno',parts:[P[1]!]},lookup);
 assert.equal(uno.pins[0]!.boardPin,'D4');
});
test('compatibility: 3.3 V board accepts the farm parts; flags a 5 V part, wrong band, I2C clash and current',()=>{
 const ok=checkCompatibility({board:'esp32-devkitc',parts:[{partId:'soil-moisture-capacitive'},{partId:'ds18b20'},{partId:'lora-rfm95w'}]},lookup);
 assert.equal(ok.ok,true,JSON.stringify(ok.issues));
 const uno=checkCompatibility({board:'uno',parts:[{partId:'lora-rfm95w'}]},lookup);
 assert.equal(uno.ok,false);assert.ok(uno.issues.some(i=>i.code==='voltage.supply'));assert.ok(uno.issues.some(i=>i.code==='logic.low'||i.code==='logic.high'));
 assert.equal(checkCompatibility({board:'esp32-devkitc',parts:[{partId:'ghost'}]},lookup).ok,false);
 // I2C clash and wrong band via synthetic records
 const i2c=structuredClone(parts.get('ds18b20')!) as PartRecord;i2c.protocols.supported.v=['i2c'];i2c.protocols.i2cAddresses={v:[0x76],p:i2c.protocols.supported.p};
 const lk=(id:string)=>id==='bme-a'||id==='bme-b'?i2c:id==='lora-ra02'?{...structuredClone(parts.get('lora-rfm95w')!),identity:{...parts.get('lora-rfm95w')!.identity,id:'lora-ra02'}} as PartRecord:lookup(id);
 const clash=checkCompatibility({board:'esp32-devkitc',parts:[{partId:'bme-a'},{partId:'bme-b'}]},lk);
 assert.ok(clash.issues.some(i=>i.code==='i2c.address'&&i.severity==='error'));
 const ra=checkCompatibility({board:'esp32-devkitc',parts:[{partId:'lora-ra02'}]},lk);
 assert.ok(ra.issues.some(i=>i.code==='net-05'&&i.severity==='error'),'RA-02 is an error in Pro');
 const hot=checkCompatibility({board:'esp32-devkitc',parts:[{partId:'lora-rfm95w',qty:5}]},lookup);
 assert.ok(hot.issues.some(i=>i.code==='current.rail'));
});
test('compatibility: low-confidence data never errors on its own',()=>{
 const low=structuredClone(parts.get('ds18b20')!) as PartRecord;low.electrical.supplyV.v={min:4.5,max:5.5};low.electrical.supplyV.p.confidence='low';
 const r=checkCompatibility({board:'esp32-devkitc',parts:[{partId:'ds18b20'}],supplyV:3.7},id=>id==='ds18b20'?low:lookup(id));
 assert.ok(r.issues.some(i=>i.code==='voltage.supply'&&i.severity==='warning'));assert.equal(r.ok,true);
});
test('netlist: farm wiring is valid; shorts, rail mismatch, unknown pins, flash pins and unpowered parts are caught',()=>{
 const base={board:'esp32-devkitc',parts:P,nets:[
  {name:'3v3',terminals:['board.3V3','soil-moisture-capacitive-1.VCC','ds18b20-1.VCC','lora-rfm95w-1.3V3']},
  {name:'gnd',terminals:['board.GND','soil-moisture-capacitive-1.GND','ds18b20-1.GND','lora-rfm95w-1.GND']},
  {name:'soil',terminals:['board.GPIO34','soil-moisture-capacitive-1.AOUT']},{name:'dq',terminals:['board.GPIO4','ds18b20-1.DQ']},
  {name:'sck',terminals:['board.GPIO18','lora-rfm95w-1.SCK']},{name:'miso',terminals:['board.GPIO19','lora-rfm95w-1.MISO']},{name:'mosi',terminals:['board.GPIO23','lora-rfm95w-1.MOSI']},
  {name:'cs',terminals:['board.GPIO5','lora-rfm95w-1.NSS']},{name:'rst',terminals:['board.GPIO14','lora-rfm95w-1.RST']},{name:'irq',terminals:['board.GPIO26','lora-rfm95w-1.DIO0']},
 ]};
 const r=validateNetlist(base,lookup);
 assert.equal(r.ok,true,JSON.stringify(r.issues.filter(i=>i.severity==='error')));
 assert.deepEqual(r.wires.map(w=>w.id),r.wires.map((_,i)=>`W${i+1}`));
 assert.ok(getTool('validate_netlist')!.output.safeParse(r).success,'matches the registry output schema');
 assert.equal(r.wires[0]!.color,'red');assert.ok(r.wires.some(w=>w.color==='black'));
 const bad=(nets:typeof base.nets,partsOverride=P)=>validateNetlist({board:'esp32-devkitc',parts:partsOverride,nets},lookup);
 assert.ok(bad([{name:'x',terminals:['board.3V3','board.GND','ds18b20-1.VCC']}]).issues.some(i=>i.code==='net.short'));
 assert.ok(bad([{name:'x',terminals:['board.5V','lora-rfm95w-1.3V3']}]).issues.some(i=>i.code==='net.rail-voltage'));
 assert.ok(bad([{name:'x',terminals:['board.GPIO99','ds18b20-1.DQ']}]).issues.some(i=>i.code==='net.board-pin-unknown'));
 assert.ok(bad([{name:'x',terminals:['board.GPIO4','ds18b20-1.XX']}]).issues.some(i=>i.code==='net.pin-unknown'));
 assert.ok(bad([{name:'x',terminals:['board.GPIO6','ds18b20-1.DQ']}]).issues.some(i=>i.code==='net.flash-pin'&&i.severity==='error'));
 assert.ok(bad([{name:'x',terminals:['board.GPIO12','ds18b20-1.DQ']}]).issues.some(i=>i.code==='net.strap-pin'));
 assert.ok(bad([{name:'x',terminals:['board.GPIO34','ds18b20-1.DQ']}]).issues.some(i=>i.code==='net.input-only'));
 assert.ok(bad([{name:'x',terminals:['board.GPIO4','ds18b20-1.DQ','soil-moisture-capacitive-1.AOUT']}]).issues.some(i=>i.code==='net.pin-conflict'));
 assert.ok(bad([{name:'x',terminals:['board.GPIO4','ds18b20-1.DQ']}]).issues.some(i=>i.code==='net.unpowered'));
 assert.ok(bad([{name:'x',terminals:['board.GPIO4','nope-1.DQ']}]).issues.some(i=>i.code==='net.ref-unknown'));
 assert.ok(bad([{name:'x',terminals:['board.GPIO4']}]).issues.some(i=>i.code==='net.terminal-format'||i.code==='net.single'));
 // nets sharing a terminal are merged: one GND wire per part, not a conflict
 const m=validateNetlistFull({...base,nets:[{name:'g1',terminals:['board.GND','ds18b20-1.GND']},{name:'g2',terminals:['board.GND','soil-moisture-capacitive-1.GND']}]},lookup);
 assert.ok(!m.issues.some(i=>i.code==='net.pin-conflict'));assert.equal(m.specWires.filter(w=>w.func==='ground').length,2);
});
test('wiring: field parts get glands, terminal blocks, shielded cable; stored fixture node verifies',()=>{
 const n=spec.nodes[0]!;
 const parts2=n.parts.map(p=>({ref:p.id,partId:p.kind,mount:p.mount==='field'?'field' as const:'enclosure' as const,cableM:p.cableM}));
 const conns=n.wires.map(w=>({net:w.id,a:w.from,b:w.to}));
 const r=deriveWires({board:n.board,parts:parts2,connections:conns},lookup);
 assert.ok(r.glands>=2);assert.ok(Object.keys(r.terminals).length>=2);
 assert.ok(r.wires.every(w=>WireOk(w)));
 const sig=r.wires.find(w=>w.func==='signal'&&w.viaGland)!;assert.equal(sig.cable,'3-core-shielded');assert.equal(sig.lengthM,3);
 const inside=r.wires.find(w=>!w.viaGland);if(inside){assert.equal(inside.lengthM,0.15);assert.equal(inside.cable,'dupont');}
 // order: power, then ground, then signals
 const rank=(f:string)=>f==='power'?0:f==='ground'?1:2;
 assert.deepEqual(r.wires.map(w=>rank(w.func)),[...r.wires.map(w=>rank(w.func))].sort());
 assert.ok(checkNodeNetlist(n,lookup).every(i=>i.code!=='net.ref-unknown'&&i.code!=='net.pin-unknown'));
 assert.ok(checkNodeCompat(n,lookup).every(i=>i.severity!=='error'),JSON.stringify(checkNodeCompat(n,lookup)));
});
const WireOk=(w:{id:string;awg:number;lengthM:number})=>/^W\d+$/.test(w.id)&&w.awg>=14&&w.lengthM>0;

const nodeId='node-melon';
const pins=allocatePins({board:'esp32-devkitc',parts:P},lookup).pins;
const CODE=(banner='Serial.println(AIOT_BOOT_BANNER);')=>`void setup(){Serial.begin(115200);${banner}pinMode(PIN_DS18B20_1,INPUT);}\nvoid loop(){int v=analogRead(PIN_SOIL_MOISTURE_CAPACITIVE_1);}\n`;
test('config block: pins, banner, placeholders; injection overwrites the model\'s block',()=>{
 const c=buildConfigBlock({language:'arduino-cpp',nodeId,pins,loraFreqMHz:921.4,wifi:true,thresholds:{THRESH_SOIL_DRY:30},sampleEveryS:120});
 assert.ok(c.block.startsWith(`// ${CONFIG_BEGIN}`));assert.ok(c.block.trimEnd().endsWith(`// ${CONFIG_END}`));
 assert.match(c.block,/#define LORA_FREQ_HZ 921400000/);assert.match(c.block,/#define WIFI_SSID "YOUR_WIFI_SSID"/);
 assert.match(c.block,/#define AIOT_BOOT_BANNER "AIOT_BOOT:node-melon:[0-9a-f]{8}"/);
 assert.match(c.block,/#define PIN_DS18B20_1 4 \/\/ GPIO4 ds18b20-1\.DQ/);
 assert.equal(c.sha256.length,64);
 assert.equal(buildConfigBlock({language:'arduino-cpp',nodeId,pins}).sha256,buildConfigBlock({language:'arduino-cpp',nodeId,pins}).sha256);
 assert.throws(()=>buildConfigBlock({language:'arduino-cpp',nodeId,pins,loraFreqMHz:433}));
 const evil=`// ${CONFIG_BEGIN}\n#define PIN_SOIL 99\n// ${CONFIG_END}\nvoid setup(){}\n// ${CONFIG_BEGIN}\n#define X 1\n// ${CONFIG_END}\n`;
 const out=injectConfigBlock(evil,c.block);
 assert.ok(!out.includes('PIN_SOIL 99')&&!out.includes('#define X 1'));assert.equal(out.split(CONFIG_BEGIN).length,2);assert.ok(out.includes('void setup(){}'));
 assert.equal(injectConfigBlock('void setup(){}\n',c.block).startsWith(`// ${CONFIG_BEGIN}`),true);
 const py=buildConfigBlock({language:'python',nodeId,pins});assert.match(py.block,/^# ==== CONFIG/);assert.match(py.block,/PIN_DS18B20_1 = 4/);
});
const full=(body:string)=>injectConfigBlock(body,buildConfigBlock({language:'arduino-cpp',nodeId,pins}).block);
const codes=(src:string,language:'arduino-cpp'|'python'|'micropython'='arduino-cpp')=>lintCode({content:src,language,board:'esp32-devkitc'});
test('code lint: clean file passes and pinsReferenced is parsed from the code',()=>{
 const r=codes(full(CODE()));
 assert.equal(r.ok,true,JSON.stringify(r.diagnostics));
 assert.deepEqual(r.pinsReferenced.map(p=>p.symbol).sort(),['PIN_DS18B20_1','PIN_SOIL_MOISTURE_CAPACITIVE_1']);
 assert.equal(r.pinsReferenced.find(p=>p.symbol==='PIN_DS18B20_1')!.pin,'GPIO4');
 assert.ok(r.diagnostics.every(d=>d.severity==='warning'));          // unused LoRa symbols only
});
test('code lint: raw pin literal, include, URL, missing banner and missing CONFIG are errors',()=>{
 const has=(src:string,re:RegExp)=>codes(src).diagnostics.some(d=>d.severity==='error'&&re.test(d.message));
 assert.ok(has(full('void setup(){Serial.println(AIOT_BOOT_BANNER);pinMode(4,OUTPUT);}'),/pin literal/i));
 assert.ok(has(full('void setup(){Serial.println(AIOT_BOOT_BANNER);Wire.begin(21,22);}'),/pin literal/i));
 assert.ok(has(full('void setup(){Serial.println(AIOT_BOOT_BANNER);}\nOneWire ow(4);'),/pin literal/i));
 assert.ok(has(full('void setup(){Serial2.begin(9600,SERIAL_8N1,16,17);Serial.println(AIOT_BOOT_BANNER);}'),/pin literal/i));
 assert.ok(!has(full('// pinMode(4,OUTPUT)\nvoid setup(){Serial.println(AIOT_BOOT_BANNER);}'),/pin literal/i),'comments are ignored');
 assert.ok(has('#include <esp_https_ota.h>\n'+full(CODE()),/allowlist/));
 assert.ok(has(full(CODE()+'const char* u="https://evil.example/x";'),/URL/));
 assert.ok(has(full(CODE()+'const char* h="broker.example.com";'),/Hostname/));
 assert.ok(has(full(CODE()+'const char* ip="192.168.1.5";'),/IP literal/));
 assert.ok(!has(full(CODE()+'const char* s="YOUR_WIFI_SSID";'),/Hostname|URL/));
 assert.ok(has(full(CODE('')),/AIOT_BOOT_BANNER/));
 assert.ok(has('void setup(){}',/CONFIG/));
 assert.ok(has(full(CODE()+'\n#define PIN_X 3\n'),/CONFIG block/));
 assert.ok(codes(full(CODE())).diagnostics.length<=20);
});
test('code lint: python rules',()=>{
 const blk=buildConfigBlock({language:'python',nodeId,pins}).block;
 const ok=codes(`${blk}import json\nimport time\nprint(AIOT_BOOT_BANNER)\nx=PIN_DS18B20_1\n`,'python');
 assert.equal(ok.ok,true,JSON.stringify(ok.diagnostics));
 const bad=(s:string)=>codes(`${blk}print(AIOT_BOOT_BANNER)\n${s}\n`,'python').diagnostics.filter(d=>d.severity==='error').map(d=>d.message).join('|');
 assert.match(bad('eval("1")'),/eval/);assert.match(bad('import subprocess'),/subprocess/);assert.match(bad('import socket'),/socket/);
 assert.match(bad('import os\nos.system("ls")'),/os\.system/);assert.match(bad('__import__("x")'),/__import__/);assert.match(bad('import requests'),/not allowed/);
 assert.match(bad('GPIO.setup(17,GPIO.OUT)'),/pin literal/i);
 assert.equal(codes(`${blk}import machine\nprint(AIOT_BOOT_BANNER)\nx=PIN_DS18B20_1\n`,'micropython').ok,true);
});
test('stripComments keeps offsets and strings',()=>{
 const s='a // b\n/* c\n d */ "//x" e';const o=stripComments(s,false);
 assert.equal(o.length,s.length);assert.equal(o.split('\n').length,3);assert.ok(o.includes('"//x"'));assert.ok(!o.includes('b'));
});
