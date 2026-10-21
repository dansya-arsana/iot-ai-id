import test from 'node:test';
import assert from 'node:assert/strict';
import {CIRCUITS} from '../apps/web/src/lab/contract.js';
import type {UnoPin} from '../apps/web/src/lab/contract.js';
import {createLabRunner} from '../apps/web/src/lab/sim/index.js';
import {createModels} from '../apps/web/src/lab/sim/peripherals.js';
import {dht22Frame,dht22Response,DHT22_US} from '../apps/web/src/lab/sim/devices/dht22.js';
import {labFirmware} from '../apps/web/src/lab/firmware/index.js';

test('frame encodes humidity, temperature (sign bit) and the checksum',()=>{
 const bits=dht22Frame(24.5,60.3);
 assert.equal(bits.length,40);
 const byte=(i:number)=>parseInt(bits.slice(i*8,i*8+8).join(''),2);
 assert.equal((byte(0)<<8)|byte(1),603);
 assert.equal((byte(2)<<8)|byte(3),245);
 assert.equal(byte(4),(byte(0)+byte(1)+byte(2)+byte(3))&0xff);
 const neg=dht22Frame(-10.1,40);
 assert.equal(((parseInt(neg.slice(16,24).join(''),2)<<8)|parseInt(neg.slice(24,32).join(''),2)),0x8000|101);
});
test('response timing: 80/80 us ack, 50 us low per bit, 26-28 us zero, 70 us one',()=>{
 const r=dht22Response(24,60);
 assert.deepEqual(r.slice(0,2),[{level:0,us:80},{level:1,us:80}]);
 assert.equal(r.length,2+80+2);
 for(let i=0;i<40;i++){
  const lo=r[2+i*2]!,hi=r[3+i*2]!;
  assert.equal(lo.us,DHT22_US.bitLow);
  assert.ok(hi.us===70||(hi.us>=26&&hi.us<=28));
 }
});

function fakeEnv(){
 const pins:Partial<Record<UnoPin,boolean>>={};
 const events:{at:number;cb:()=>void}[]=[];
 let now=0;
 const log:{pin:UnoPin;level:boolean;at:number}[]=[];
 return {pins,log,env:{
  setPin:(p:UnoPin,l:boolean)=>{pins[p]=l;log.push({pin:p,level:l,at:now});},setAdc:()=>undefined,
  schedule:(c:number,cb:()=>void)=>{events.push({at:now+c,cb});events.sort((a,b)=>a.at-b.at);},now:()=>now,
 },run(to:number){while(events.length&&events[0]!.at<=to){const e=events.shift()!;now=e.at;e.cb();}now=to;},at:(n:number)=>{now=n;}};
}
test('device answers only a long low start pulse, with exact edge times',()=>{
 const f=fakeEnv();
 const ms=createModels({parts:[{id:'d',kind:'dht22',net:{VCC:'5V',DATA:'D2',GND:'GND'},props:{tempC:21.5,humidity:48}}],wires:[]},f.env);
 const d=ms.get('d')!;
 assert.equal(f.pins.D2,true,'idle high');
 f.log.length=0;
 // too short a start: ignored
 f.at(1000);d.onEdge!('D2',0,1000);f.at(1000+16*500);d.onEdge!('D2',1,1000+16*500);f.run(1000+16*5000);
 assert.equal(f.log.length,0);
 const t0=16*30000;
 f.at(t0);d.onEdge!('D2',0,t0);f.at(t0+16*18000);d.onEdge!('D2',1,t0+16*18000);
 f.run(t0+16*18000+16*20000);
 const edges=f.log;
 assert.equal(edges[0]!.level,false);
 assert.equal(edges[0]!.at-(t0+16*18000),16*30,'responds 30 us after release');
 assert.equal(edges[1]!.at-edges[0]!.at,16*80);
 assert.equal(edges[2]!.at-edges[1]!.at,16*80);
 const s=d.state();
 assert.equal(s.kind,'ext');
 if(s.kind==='ext'){assert.equal(s.v.reads,1);assert.equal(s.v.readT,21.5);assert.equal(s.v.readH,48);}
});

test('real firmware reads the sliders over the wire and prints them',()=>{
 const runner=createLabRunner();
 const v=labFirmware.lessons.dht.variants[0]!;
 const circuit=structuredClone(CIRCUITS.dht);
 runner.load(v,{},circuit,labFirmware.toolchain);runner.start();
 runner.advance(2600);
 const first=runner.serialText();
 assert.match(first,/ready/);
 assert.match(first,/T=24\.0 C {2}H=60\.0 %/,first);
 runner.setPartProps('dht1',{tempC:-3.5,humidity:81});
 runner.advance(2600);
 assert.match(runner.serialText(),/T=-3\.5 C {2}H=81\.0 %/,runner.serialText());
 assert.doesNotMatch(runner.serialText(),/read failed/);
 const s=runner.snapshot().parts.dht1!;
 assert.ok(s.kind==='ext'&&s.type==='dht22'&&(s.v.reads as number)>=2);
});
