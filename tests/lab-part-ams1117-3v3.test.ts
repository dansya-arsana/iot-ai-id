import test from 'node:test';
import assert from 'node:assert/strict';
import {createWorldModels,EMPTY} from '../apps/web/src/lab/sim/peripherals.js';

const env={setPin(){},setAdc(){},schedule(){},now:()=>0};
const run=(vin:'5V'|'3V3')=>{
 const r=createWorldModels({wires:[],parts:[{id:'reg',kind:'ams1117-3v3',net:{VIN:vin,GND:'GND'},props:{}}]},env);
 for(const m of r.models.values())m.update({samples:EMPTY(),dtSec:0.01,cycles:1});
 return r;
};

test('ams1117-3v3: 5 V in gives 3.3 V out',()=>{
 const r=run('5V');
 assert.equal(r.world.volts('reg','VOUT'),3.3);
 const s=r.models.get('reg')!.state();
 assert.ok(s.kind==='ext');if(s.kind==='ext'){assert.equal(s.v.vin,5);assert.equal(s.v.vout,3.3);assert.equal(s.v.regulating,true);}
});
test('ams1117-3v3: fed from 3.3 V it cannot regulate (dropout 1.1 V) and the lab warns',()=>{
 const r=run('3V3');
 assert.ok(Math.abs((r.world.volts('reg','VOUT')??9)-2.2)<0.001);
 assert.ok(r.world.notes().some(n=>n.code==='under'||n.code==='dropout'));
});
