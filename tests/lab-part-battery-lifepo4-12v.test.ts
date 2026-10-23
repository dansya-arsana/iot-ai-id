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

const one=(props:P)=>run([{id:'b',kind:'battery-lifepo4-12v',props}],[]).st('b');
test('battery-lifepo4-12v: 12.8 V class at mid charge, Wh from capacity',()=>{
 const s=one({ah:20,soc:60});
 assert.ok((s.volts as number)>13&&(s.volts as number)<13.5);assert.equal(s.wh,256);assert.equal(s.bms,'ok');
});
test('battery-lifepo4-12v: empty cuts the output, cold flags no-charge',()=>{
 assert.equal(one({soc:0}).volts,0);assert.equal(one({soc:50,tempC:-2}).bms,'cold-charge');
});
test('battery-lifepo4-12v: powers a linked controller',()=>{
 const {r}=run([{id:'b',kind:'battery-lifepo4-12v',props:{soc:80}},{id:'cc',kind:'solar-charge-pwm',props:{}}],[link('b','P+','cc','BAT+'),link('b','P-','cc','BAT-')]);
 assert.ok((r.world.volts('cc','BAT+')??0)>13);
});
