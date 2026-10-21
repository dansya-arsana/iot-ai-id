import test from 'node:test';
import assert from 'node:assert/strict';
import type {BoardPin,Circuit} from '../apps/web/src/lab/contract.js';
import {EMPTY,createModels} from '../apps/web/src/lab/sim/peripherals.js';

const env={setPin(){},setAdc(){},schedule(){},now:()=>0};
const circuit=(props:Record<string,string|number|boolean>={},vcc:BoardPin='5V'):Circuit=>({wires:[],parts:[{id:'r1',kind:'relay-module',net:{VCC:vcc,GND:'GND',IN:'D7'},props}]});
const step=(m:ReturnType<typeof createModels> extends Map<string,infer M>?M:never,level:0|1|null,ms:number)=>{
 const samples=EMPTY();
 samples.D7={mode:level===null?'input':'output',level:level??0,duty:level??0,freqHz:0,highUs:0,analog:null};
 m.update({samples,dtSec:ms/1000,cycles:1});
 const s=m.state();return s.kind==='ext'?s.v:{};
};

test('relay-module: active-low, operates after 10 ms and releases after 5 ms',()=>{
 const m=createModels(circuit(),env).get('r1')!;
 assert.equal(step(m,1,20).comTo,'NC');                 // HIGH = off
 let v=step(m,0,9);assert.equal(v.commanded,true);assert.equal(v.energized,false);assert.equal(v.comTo,'NC');
 v=step(m,0,1.5);assert.equal(v.energized,true);assert.equal(v.comTo,'NO');assert.equal(v.ledOn,true);assert.equal(v.coilMa,71);assert.equal(v.clicks,1);
 v=step(m,1,4);assert.equal(v.energized,true);
 v=step(m,1,1.5);assert.equal(v.energized,false);assert.equal(v.comTo,'NC');assert.equal(v.clicks,2);
});
test('relay-module: floating IN and an unpowered VCC do not switch; active-high reverses',()=>{
 const m=createModels(circuit(),env).get('r1')!;
 assert.equal(step(m,null,50).energized,false);
 const u=createModels(circuit({},'D3'),env).get('r1')!;
 assert.equal(step(u,0,50).energized,false);
 const h=createModels(circuit({trigger:'high'}),env).get('r1')!;
 assert.equal(step(h,0,50).energized,false);assert.equal(step(h,1,50).energized,true);
});
