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

test('din-rail-terminals: each block passes current A to B',()=>{
 const {r}=run([{id:'b',kind:'battery-9v',props:{charge:100}},{id:'t',kind:'din-rail-terminals',props:{}}],[link('b','PLUS','t','T1A'),link('b','MINUS','t','T6A')]);
 assert.equal(r.world.volts('t','T1B'),9.6,'B side follows the A side');
 assert.equal(r.world.volts('t','T2A'),null,'a different block is a different net');
});
test('din-rail-terminals: the jumper bar makes a shared rail',()=>{
 const circ=(bridge:string)=>run([{id:'b',kind:'battery-9v',props:{charge:100}},{id:'t',kind:'din-rail-terminals',props:{bridge}}],[link('b','PLUS','t','T1A'),link('b','MINUS','t','T6A')]);
 assert.equal(circ('1-3').r.world.volts('t','T3B'),9.6);
 assert.equal(circ('1-3').r.world.volts('t','T4A'),null);
 assert.equal(circ('1-3').st('t').bridgedBlocks,3);
});
