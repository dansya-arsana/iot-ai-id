import test from 'node:test';
import assert from 'node:assert/strict';
import type {Circuit} from '../apps/web/src/lab/contract.js';
import {createWorldModels,EMPTY} from '../apps/web/src/lab/sim/peripherals.js';

const env={setPin(){},setAdc(){},schedule(){},now:()=>0};
type P=Record<string,string|number|boolean>;
const link=(a:string,ap:string,b:string,bp:string)=>({a:{part:a,pin:ap},b:{part:b,pin:bp},color:'red' as const});
function run(parts:{id:string;kind:string;props:P}[],links:ReturnType<typeof link>[],steps=2){
 const c:Circuit={wires:[],parts:parts.map(p=>({...p,net:{}})),links};
 const r=createWorldModels(c,env);
 for(let i=0;i<steps;i++)for(const m of r.models.values())m.update({samples:EMPTY(),dtSec:0.01,cycles:1});
 const st=(id:string)=>{const s=r.models.get(id)!.state();return (s.kind==='ext'?s.v:{}) as Record<string,string|number|boolean>;};
 return {r,st};
}

const one=(props:P)=>run([{id:'pv',kind:'solar-panel',props}],[]).st('pv');
test('solar-panel: 20 W at full sun is about 21.6 V open-circuit, 1.23 A, 20 W',()=>{
 const s=one({watts:20,irradiance:1000});
 assert.equal(s.vocV,21.6);assert.equal(s.iscA,1.23);assert.equal(s.availableW,20);
});
test('solar-panel: current follows sunlight, voltage barely moves, night is 0 V',()=>{
 const s=one({watts:20,irradiance:200});
 assert.ok(Math.abs((s.iscA as number)-0.246)<0.001);assert.ok((s.vocV as number)>18&&(s.vocV as number)<21.6);
 assert.equal(one({irradiance:0}).vocV,0);
});
test('solar-panel: the 10 W model is smaller and weaker',()=>{
 const s=one({watts:10,irradiance:1000});assert.equal(s.availableW,10);assert.ok((s.iscA as number)<1);
});
test('solar-panel: a linked load sees the panel as a source (PV+ above PV-)',()=>{
 const {r}=run([{id:'pv',kind:'solar-panel',props:{watts:20,irradiance:1000}},{id:'cc',kind:'solar-charge-pwm',props:{}}],[link('pv','PV+','cc','PV+'),link('pv','PV-','cc','PV-')]);
 assert.equal(r.world.volts('cc','PV+'),21.6);
});
