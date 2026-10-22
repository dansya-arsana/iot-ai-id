import test from 'node:test';
import assert from 'node:assert/strict';
import type {Circuit} from '../apps/web/src/lab/contract.js';
import {createWorldModels} from '../apps/web/src/lab/sim/peripherals.js';
import {EMPTY} from '../apps/web/src/lab/sim/peripherals.js';

const env={setPin(){},setAdc(){},schedule(){},now:()=>0};
const circuit=(charge:number):Circuit=>({wires:[],parts:[
 {id:'bat',kind:'battery-9v',net:{},props:{charge}},{id:'reg',kind:'lm7805',net:{},props:{}},
],links:[{a:{part:'bat',pin:'PLUS'},b:{part:'reg',pin:'IN'},color:'red'},{a:{part:'bat',pin:'MINUS'},b:{part:'reg',pin:'GND'},color:'black'}]});
const state=(charge:number)=>{
 const r=createWorldModels(circuit(charge),env);
 for(const m of r.models.values())m.update({samples:EMPTY(),dtSec:0.01,cycles:1});
 const s=r.models.get('reg')!.state();
 return s.kind==='ext'?s.v:{};
};

test('lm7805: 9.6 V in gives 5.0 V out and the heat is the 4.6 V difference',()=>{
 const s=state(100);
 assert.equal(s.vin,9.6);assert.equal(s.vout,5);assert.equal(s.dropV,4.6);assert.equal(s.regulating,true);
});
test('lm7805: below about 7 V the output follows the input minus 2 V (dropout)',()=>{
 const s=state(10);   // 6.8 V cell: 4.8 V out
 assert.equal(s.vin,6.8);assert.equal(s.vout,4.8);
 assert.equal(state(0).vout,0,'an empty battery gives no output');
});
test('lm7805: pins are IN, GND, OUT on a 2.54 mm pitch',()=>{
 const r=createWorldModels({wires:[],parts:[{id:'reg',kind:'lm7805',net:{IN:'5V',GND:'GND'},props:{}}]},env);
 assert.ok(r.world.notes().some(n=>n.code==='under'),'5 V into a 7805 is too low and the lab says so');
});
