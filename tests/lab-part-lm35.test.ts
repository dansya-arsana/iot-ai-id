import test from 'node:test';
import assert from 'node:assert/strict';
import type {BoardPin,Circuit,UnoPin} from '../apps/web/src/lab/contract.js';
import {createModels} from '../apps/web/src/lab/sim/peripherals.js';
import {lm35Volts,LM35_HEADROOM} from '../apps/web/src/lab/sim/devices/lm35.js';

function fakeEnv(){
 const adc:{ch:number;v:number}[]=[];
 return {adc,env:{setPin:(_p:UnoPin,_l:boolean)=>undefined,setAdc:(ch:number,v:number)=>{adc.push({ch,v});},schedule:()=>undefined,now:()=>0}};
}
const circuit=(net:Partial<Record<string,BoardPin>>,props:Record<string,string|number|boolean>={}):Circuit=>({wires:[],parts:[{id:'lm351',kind:'lm35',net,props}]});

test('lm35: 10 mV per degree Celsius on the wired analog channel',()=>{
 const f=fakeEnv();
 const m=createModels(circuit({VS:'5V',OUT:'A0',GND:'GND'},{tempC:25}),f.env).get('lm351')!;
 assert.equal(f.adc.at(-1)!.ch,0);assert.ok(Math.abs(f.adc.at(-1)!.v-0.25)<1e-9);
 m.props.tempC=100;m.update({samples:{} as never,dtSec:0.01,cycles:1});
 assert.ok(Math.abs(f.adc.at(-1)!.v-1.0)<1e-9);
 assert.equal(m.analog!()!.adc,Math.round(1.0/5*1023));
 const s=m.state();assert.ok(s.kind==='ext');if(s.kind==='ext'){assert.equal(s.v.tempC,100);assert.equal(s.v.volts,1);assert.equal(s.v.adc,205);}
});
test('lm35: 0 degC is 0 V, never negative; range ends at 150 degC = 1.5 V',()=>{
 assert.equal(lm35Volts(0,5),0);assert.equal(lm35Volts(-20,5),0);assert.ok(Math.abs(lm35Volts(150,5)-1.5)<1e-9);assert.ok(Math.abs(lm35Volts(200,5)-1.5)<1e-9,'clamped to the 150 degC range');
});
test('lm35: the output cannot rise above supply minus headroom, and a dead supply gives 0 V',()=>{
 assert.ok(Math.abs(lm35Volts(150,2.5)-(2.5-LM35_HEADROOM))<1e-9);
 assert.equal(lm35Volts(25,0),0);assert.equal(lm35Volts(25,1.9),0);
});
test('lm35: OUT on A6 of a Nano works, and an unwired OUT drives nothing',()=>{
 const f=fakeEnv();
 const m=createModels({board:'nano',wires:[],parts:[{id:'lm351',kind:'lm35',net:{VS:'5V',OUT:'A6',GND:'GND'},props:{tempC:30}}]},f.env).get('lm351')!;
 assert.equal(m.analog!()!.pin,'A6');
 const g=fakeEnv();const n=createModels(circuit({VS:'5V',GND:'GND'}),g.env).get('lm351')!;
 assert.equal(g.adc.length,0);assert.equal(n.analog?.()??null,null);
});

// ---------- real firmware: analogRead on A0 ----------
import {readFileSync} from 'node:fs';
import type {FirmwareVariant} from '../apps/web/src/lab/contract.js';
import {createLabRunner} from '../apps/web/src/lab/sim/runner.js';
const fixture=():{toolchain:string;variant:FirmwareVariant}=>JSON.parse(readFileSync(new URL('./fixtures/firmware/thermo-analog.json',import.meta.url),'utf8'));
test('real firmware: analogRead of the LM35 gives the popover temperature within one ADC step',()=>{
 const fx=fixture(),r=createLabRunner();
 r.load(fx.variant,{},{wires:[],parts:[{id:'lm351',kind:'lm35',net:{VS:'5V',OUT:'A0',GND:'GND'},props:{tempC:25}}]},fx.toolchain);r.start();
 r.advance(400);
 assert.match(r.serialText(),/lm35=(24\.9|25\.1|25\.0|24\.8) /,r.serialText());
 r.setPartProps('lm351',{tempC:87});r.advance(400);
 const all=r.serialText().match(/lm35=([\d.]+)/g)!;
 const v=parseFloat(all.at(-1)!.slice(5));
 assert.ok(Math.abs(v-87)<0.5,`read ${v}`);
});
