import test from 'node:test';
import assert from 'node:assert/strict';
import type {Circuit} from '../apps/web/src/lab/contract.js';
import {createWorldModels,EMPTY} from '../apps/web/src/lab/sim/peripherals.js';

const env={setPin(){},setAdc(){},schedule(){},now:()=>0};
type P=Record<string,string|number|boolean>;
function run(parts:{id:string;kind:string;props:P}[],links:{a:{part:string;pin:string};b:{part:string;pin:string};color:'red'}[],steps=2){
 const c:Circuit={wires:[],parts:parts.map(p=>({...p,net:{}})),links};
 const r=createWorldModels(c,env);
 for(let i=0;i<steps;i++)for(const m of r.models.values())m.update({samples:EMPTY(),dtSec:0.01,cycles:1});
 const st=(id:string)=>{const s=r.models.get(id)!.state();return (s.kind==='ext'?s.v:{}) as Record<string,string|number|boolean>;};
 return {r,st};
}

const one=(props:P)=>run([{id:'b',kind:'battery-18650-pack',props}],[]).st('b');
test('battery-18650-pack: default is 4S LiFePO4, 12.8 V nominal, flat between 20 and 90 percent',()=>{
 const a=one({soc:30}),b=one({soc:80});
 assert.equal(a.chem,'lfp-4s');assert.equal(a.nominalV,12.8);
 assert.ok(Math.abs((b.volts as number)-(a.volts as number))<0.5,'LFP is flat');
});
test('battery-18650-pack: 3S Li-ion is 12.6 V full and swings with charge',()=>{
 assert.equal(one({chem:'liion-3s',soc:100}).volts,12.6);
 assert.ok((one({chem:'liion-3s',soc:20}).volts as number)<11);
});
test('battery-18650-pack: BMS opens the output when empty and blocks cold LFP charging',()=>{
 const e=one({soc:0});assert.equal(e.bms,'uvp');assert.equal(e.volts,0);
 assert.equal(one({soc:50,tempC:-5}).bms,'cold-charge');assert.equal(one({chem:'liion-3s',soc:50,tempC:-5}).bms,'ok');
});
test('battery-18650-pack: Wh = nominal V x Ah x parallel',()=>{
 assert.equal(one({chem:'lfp-4s',parallel:2}).wh,38.4);
});
