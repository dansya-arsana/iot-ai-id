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

import {GLAND_RANGES,ENCLOSURE_SIZES,cableFits,glandOf} from '../apps/web/src/lab/sim/devices/enclosure-ip65.js';
import {deviceRegistry} from '../apps/web/src/lab/sim/devices/index.js';

test('enclosure-ip65: model-only, no pins, honest state',()=>{
 assert.equal(deviceRegistry.get('enclosure-ip65')!.runtime,'not-emulated');
 assert.deepEqual([...deviceRegistry.get('enclosure-ip65')!.pins],[]);
 const s=run([{id:'e',kind:'enclosure-ip65',props:{size:'250x150x100',glands:4,glandSize:'m20'}}],[]).st('e');
 assert.equal(s.runtime,'not-emulated');assert.equal(s.lMm,250);assert.equal(s.glands,4);assert.equal(s.glandSize,'m20');
});
test('enclosure-ip65: sizes and gland clamping ranges',()=>{
 assert.equal(ENCLOSURE_SIZES.length,4);assert.equal(GLAND_RANGES.length,4);
 assert.equal(cableFits(glandOf({glandSize:'pg9'}),5),true);
 assert.equal(cableFits(glandOf({glandSize:'pg7'}),8),false,'8 mm cable does not fit PG7');
 assert.equal(cableFits(glandOf({glandSize:'m20'}),12.5),false);
});
