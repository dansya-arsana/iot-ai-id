/** Part-to-part nets, the power-net solver and the supply warnings (sim/world.ts, sim/power.ts, circuit-spec). */
import test from 'node:test';
import assert from 'node:assert/strict';
import type {BoardPin,Circuit,PartLink,PartSpec,PinSample,UnoPin} from '../apps/web/src/lab/contract.js';
import {EMPTY,createWorldModels} from '../apps/web/src/lab/sim/peripherals.js';
import {CircuitSpecSchema,specToCircuit,validateCircuitSpec} from '../apps/web/src/lab/circuit-spec.js';
import {layoutCircuit} from '../apps/web/src/lab/scene/layout.js';
import {LESSON_MODULES} from '../apps/web/src/lab/lessons/index.js';
import {labFirmware} from '../apps/web/src/lab/firmware/index.js';
import {createLabRunner} from '../apps/web/src/lab/sim/runner.js';

const env={setPin(){},setAdc(){},schedule(){},now:()=>0};
const link=(a:string,b:string):PartLink=>{const [pa,pp]=a.split('.'),[qa,qp]=b.split('.');return {a:{part:pa!,pin:pp!},b:{part:qa!,pin:qp!},color:'orange'};};
const part=(id:string,kind:string,net:Partial<Record<string,BoardPin>>={},props:Record<string,string|number|boolean>={}):PartSpec=>({id,kind,net,props});
const out=(duty:number):PinSample=>({mode:'output',level:duty>0.5?1:0,duty,freqHz:490,highUs:0,analog:null});
/** Run `ms` of 10 ms slices with the given pin duties. */
function run(c:Circuit,duties:Partial<Record<UnoPin,number>>,ms:number,after?:(r:ReturnType<typeof createWorldModels>)=>void){
 const r=createWorldModels(c,env);
 const samples=EMPTY();
 for(const [p,d] of Object.entries(duties))samples[p as UnoPin]=out(d!);
 for(let t=0;t<ms;t+=10)for(const m of r.models.values())m.update({samples,dtSec:0.01,cycles:t*16000});
 after?.(r);
 return r;
}
const st=(r:ReturnType<typeof createWorldModels>,id:string)=>{const s=r.models.get(id)!.state();return s.kind==='ext'?s.v:s as unknown as Record<string,unknown>;};

const bridge=(extra:PartSpec[]=[],links:PartLink[]=[]):Circuit=>({wires:[],parts:[
 part('drv','l298n',{ENA:'D9',IN1:'D7',IN2:'D8',GND:'GND'},{vs:9}),part('m1','motor'),...extra,
],links:[link('drv.OUT1','m1.+'),link('drv.OUT2','m1.-'),...links]});

test('nets: an L298N drives the existing motor part through OUT1/OUT2, both directions, brake and coast',()=>{
 const fwd=run(bridge(),{D9:1,D7:1,D8:0},2000);
 const m=fwd.models.get('m1')!.state();
 assert.equal(m.kind,'motor');
 if(m.kind==='motor'){assert.ok(m.rpm>0.9*6000,`forward rpm ${m.rpm}`);assert.equal(m.duty,1);}
 const rev=run(bridge(),{D9:1,D7:0,D8:1},2000).models.get('m1')!.state();
 if(rev.kind==='motor')assert.ok(rev.rpm<-0.9*6000,`reverse rpm ${rev.rpm}`);
 const brake=run(bridge(),{D9:1,D7:1,D8:1},2000).models.get('m1')!.state();
 if(brake.kind==='motor')assert.ok(Math.abs(brake.rpm)<5,'both inputs high: bridge shorts the motor, it stops');
 const coast=run(bridge(),{D9:0,D7:1,D8:0},2000).models.get('m1')!.state();
 if(coast.kind==='motor')assert.ok(Math.abs(coast.rpm)<5,'EN low: outputs float, no torque');
});
test('nets: PWM on ENA gives the motor the average voltage (speed follows duty)',()=>{
 const half=run(bridge(),{D9:0.5,D7:1,D8:0},3000).models.get('m1')!.state();
 // (9 V - 2 V drop) x 0.5 = 3.5 V of the 6 V rating
 if(half.kind==='motor'){assert.ok(Math.abs(half.duty-3.5/6)<0.02,`duty ${half.duty}`);assert.ok(half.rpm>0.5*6000&&half.rpm<0.65*6000,`rpm ${half.rpm}`);}
});
test('nets: an unwired motor does not move and a wired one reads its peers',()=>{
 const r=run({wires:[],parts:[part('m1','motor')]},{},500);
 const m=r.models.get('m1')!.state();if(m.kind==='motor')assert.equal(m.rpm,0);
 const r2=run(bridge(),{D9:1,D7:1,D8:0},50);
 assert.deepEqual(r2.world.peers('m1','+').map(p=>`${p.part}.${p.pin}`),['drv.OUT1']);
 assert.equal(r2.world.peers('m1','+')[0]!.kind,'l298n');
});
test('nets: a battery on VS powers the bridge (VS comes from the net, not the popover)',()=>{
 const c=bridge([part('bat','battery-9v',{},{charge:100})],[link('bat.PLUS','drv.VS'),link('bat.MINUS','drv.GND')]);
 const r=run(c,{D9:1,D7:1,D8:0},2000);
 const s=st(r,'drv') as {vs:number;outAV:number};
 assert.ok(Math.abs(s.vs-9.6)<0.05,`vs ${s.vs}`);
 assert.ok(Math.abs(s.outAV-7.6)<0.05,`out ${s.outAV}`);
 assert.equal(r.world.notes().filter(n=>n.code==='external').length,0,'a battery is an external supply');
});
test('nets: a relay contact joins the nets: battery -> COM, NO -> lamp',()=>{
 const c:Circuit={wires:[],parts:[
  part('rel','relay-module',{VCC:'5V',GND:'GND',IN:'D7'}),part('bat','battery-9v',{},{charge:100}),part('lamp','load-lamp'),
 ],links:[link('bat.PLUS','rel.COM'),link('rel.NO','lamp.+'),link('lamp.-','bat.MINUS')]};
 const off=run(c,{D7:1},100);   // active low: IN high = off
 assert.equal((st(off,'lamp') as {on:boolean}).on,false);
 assert.equal(off.world.volts('lamp','+'),null,'NC side is not connected to anything');
 const on=run(c,{D7:0},100);
 const l=st(on,'lamp') as {on:boolean;linked:boolean;watts:number};
 assert.equal(l.on,true);assert.equal(l.linked,true);
 assert.ok(l.watts>2.5&&l.watts<5,`watts ${l.watts}`);
 assert.ok(Math.abs((on.world.volts('lamp','+')??0)-9.6)<0.05);
 const r=st(on,'rel') as {comTo:string};assert.equal(r.comTo,'NO');
});
test('nets: the relay lamp keeps its legacy target link when its pins are unwired',()=>{
 const c:Circuit={wires:[],parts:[part('rel','relay-module',{VCC:'5V',GND:'GND',IN:'D7'}),part('bulb','load-lamp',{},{target:'rel'})]};
 assert.equal((st(run(c,{D7:0},100),'bulb') as {on:boolean}).on,true);
 assert.equal((st(run(c,{D7:1},100),'bulb') as {on:boolean}).on,false);
});

test('power: LM7805 holds 5 V from a 9 V battery, sags below 7 V, AMS1117 makes 3.3 V from the 5V pin',()=>{
 const c=(charge:number):Circuit=>({wires:[],parts:[part('bat','battery-9v',{},{charge}),part('reg','lm7805')],links:[link('bat.PLUS','reg.IN'),link('bat.MINUS','reg.GND')]});
 const full=run(c(100),{},50);
 assert.ok(Math.abs((full.world.volts('reg','OUT')??0)-5)<0.01,'5 V out');
 assert.equal((st(full,'reg') as {regulating:boolean}).regulating,true);
 const low=run(c(10),{},50);   // 6.8 V in: 4.8 V out, the lab warns
 assert.ok(Math.abs((low.world.volts('reg','OUT')??0)-4.8)<0.02);
 assert.ok(low.world.notes().some(n=>n.code==='dropout'||n.code==='under'),'low input is reported');
 const z:Circuit={wires:[],parts:[part('reg','ams1117-3v3',{VIN:'5V',GND:'GND'})]};
 const zr=run(z,{},50);
 assert.ok(Math.abs((zr.world.volts('reg','VOUT')??0)-3.3)<0.01,'3.3 V out');
 const direct:Circuit={wires:[],parts:[part('reg','ams1117-3v3',{VIN:'5V',GND:'GND'}),part('s','bme280',{VCC:'3V3',GND:'GND'}),],links:[link('reg.VOUT','s.VCC')]};
 const dr=run(direct,{},50);
 assert.ok(Math.abs((dr.world.volts('s','VCC')??0)-3.3)<0.01);
 assert.equal(dr.world.notes().length,0,'a 3.3 V sensor on the regulator output is fine');
});
test('power: the breadboard power module feeds both rails from a battery and honours the jumpers',()=>{
 const c:Circuit={wires:[],parts:[part('bat','battery-9v'),part('pw','breadboard-power',{},{left:'5',right:'3.3'})],links:[link('bat.PLUS','pw.VIN'),link('bat.MINUS','pw.GND')]};
 const r=run(c,{},50);
 assert.ok(Math.abs((r.world.volts('pw','LEFT')??0)-5)<0.01);
 assert.ok(Math.abs((r.world.volts('pw','RIGHT')??0)-3.3)<0.01);
 const off:Circuit={...c,parts:[part('bat','battery-9v'),part('pw','breadboard-power',{},{on:false})]};
 assert.equal(run(off,{},50).world.volts('pw','LEFT'),null,'switched off: rails float');
});
test('power: friendly warnings (3.3 V part on 5 V, motor on a board pin, shorted supplies)',()=>{
 const over=run({wires:[],parts:[part('bme','bme280',{VCC:'5V',GND:'GND'})]},{},50);
 const n=over.world.notes();
 assert.equal(n.length,1);assert.equal(n[0]!.code,'over');assert.equal(n[0]!.severity,'error');
 assert.match(n[0]!.en,/BME280/);assert.match(n[0]!.id,/dirancang/);
 const motor=run({wires:[],parts:[part('m','motor',{'+':'5V','-':'GND'})]},{},50).world.notes();
 assert.deepEqual(motor.map(x=>x.code),['external']);
 // a 9 V battery whose PLUS goes to the 5V pin and MINUS to GND: the rail is already 5 V, the battery says 9.6 V
 const clash=run({wires:[],parts:[part('bat','battery-9v',{PLUS:'5V',MINUS:'GND'},{charge:100})]},{},50).world.notes();
 assert.deepEqual(clash.map(x=>x.code),['conflict']);assert.match(clash[0]!.en,/short circuit/);
});
test('power: an under-powered part says so and a snapshot-free circuit has no notes',()=>{
 const lcd=run({wires:[],parts:[part('lcd','lcd1602-i2c',{VCC:'3V3',GND:'GND'})]},{},50).world.notes();
 assert.equal(lcd[0]?.code,'under');
 assert.deepEqual(run({wires:[],parts:[part('dht','dht22',{VCC:'5V',GND:'GND'})]},{},50).world.notes(),[]);
});

test('spec: part-to-part wires become Circuit.links and the validator warns about supplies',()=>{
 const spec=CircuitSpecSchema.parse({board:'uno',
  parts:[
   {id:'drv',kind:'l298n',place:{free:{x:0,z:60}}},{id:'m1',kind:'motor',place:{free:{x:30,z:60}}},{id:'bat',kind:'battery-9v',place:{free:{x:60,z:60}}},
  ],
  wires:[
   {from:'D9',to:'drv.ENA'},{from:'D7',to:'drv.IN1'},{from:'D8',to:'drv.IN2'},{from:'GND',to:'drv.GND'},
   {from:'drv.OUT1',to:'m1.+',color:'red'},{from:'drv.OUT2',to:'m1.-',color:'black'},
   {from:'bat.PLUS',to:'drv.VS',color:'red'},{from:'bat.MINUS',to:'GND',color:'black'},
  ],
  sketch:{source:'void setup(){pinMode(9,OUTPUT);pinMode(7,OUTPUT);pinMode(8,OUTPUT);}\nvoid loop(){digitalWrite(7,HIGH);digitalWrite(8,LOW);analogWrite(9,200);}'}});
 const c=specToCircuit(spec);
 assert.equal(c.links?.length,3);
 assert.deepEqual(c.links![0],{a:{part:'drv',pin:'OUT1'},b:{part:'m1',pin:'+'},color:'red'});
 assert.equal(c.parts.find(p=>p.id==='drv')!.net.ENA,'D9');
 assert.equal(c.parts.find(p=>p.id==='drv')!.net.VS,undefined,'VS reaches no board pin');
 assert.equal(c.parts.find(p=>p.id==='bat')!.net.MINUS,'GND');
 const v=validateCircuitSpec(spec);
 assert.ok(v.ok,JSON.stringify(v.issues.filter(i=>i.severity==='error')));
 assert.equal(v.issues.filter(i=>i.code.startsWith('power-')).length,0,'a battery on VS is a proper supply');
 // the same bridge with VS on the 5V pin: external-power warning; a bare BME280 on 5V: over-voltage warning
 const bad=CircuitSpecSchema.parse({...spec,wires:[...spec.wires.filter(w=>w.from!=='bat.PLUS'),{from:'5V',to:'drv.VS'}],
  parts:[...spec.parts,{id:'bme',kind:'bme280',place:{free:{x:90,z:60}}}]});
 const w=[...validateCircuitSpec({...bad,wires:[...bad.wires,{from:'5V',to:'bme.VCC',color:'red'},{from:'GND',to:'bme.GND',color:'black'}]}).issues].filter(i=>i.code.startsWith('power-')).map(i=>i.code+':'+i.ref);
 assert.ok(w.includes('power-external:drv')&&w.includes('power-over:bme'),w.join(','));
});

test('power: no shipped lesson triggers a supply warning (the notice must never cry wolf)',()=>{
 for(const m of LESSON_MODULES){
  const v=labFirmware.lessons[m.id]!.variants[0]!;
  const r=createLabRunner();
  r.load(v,{},structuredClone(m.circuit),labFirmware.toolchain);r.start();
  const snap=r.advance(400);
  assert.deepEqual(snap.power,[],`${m.id}: ${JSON.stringify(snap.power)}`);
  r.dispose();
 }
});
test('power: a runner snapshot carries the notes of a miswired circuit',()=>{
 const v=labFirmware.lessons.blink!.variants[0]!;
 const r=createLabRunner();
 r.load(v,{},{wires:[],parts:[part('bme','bme280',{VCC:'5V',GND:'GND'})]},labFirmware.toolchain);r.start();
 const snap=r.advance(200);
 assert.equal(snap.power?.[0]?.code,'over');
});

test('layout: desk props that share the default slot are spread out, a lone prop keeps its old slot',()=>{
 const c:Circuit={wires:[],parts:[part('b1','battery-9v'),part('b2','battery-aa-4'),part('pw','breadboard-power'),part('m1','motor'),part('lm','lm7805')]};
 const pl=layoutCircuit(c);
 const desk=['b1','b2','pw','m1'].map(id=>pl[id]!);
 for(let i=0;i<desk.length;i++)for(let j=i+1;j<desk.length;j++)assert.ok(Math.abs(desk[i]!.x-desk[j]!.x)>=46||Math.abs(desk[i]!.z-desk[j]!.z)>=30,`${i} and ${j} overlap`);
 assert.equal(pl.b1!.x,88,'the first prop keeps BB_CX');assert.equal(pl.lm!.onBoard,true);
 assert.equal(layoutCircuit({wires:[],parts:[part('r','relay-module')]}).r!.x,88);
});

