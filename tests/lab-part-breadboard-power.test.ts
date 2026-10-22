import test from 'node:test';
import assert from 'node:assert/strict';
import {createWorldModels,EMPTY} from '../apps/web/src/lab/sim/peripherals.js';

const env={setPin(){},setAdc(){},schedule(){},now:()=>0};
const run=(props:Record<string,string|number|boolean>,charge=100)=>{
 const r=createWorldModels({wires:[],parts:[
  {id:'bat',kind:'battery-9v',net:{},props:{charge}},{id:'pw',kind:'breadboard-power',net:{},props},
 ],links:[{a:{part:'bat',pin:'PLUS'},b:{part:'pw',pin:'VIN'},color:'red'},{a:{part:'bat',pin:'MINUS'},b:{part:'pw',pin:'GND'},color:'black'}]},env);
 for(const m of r.models.values())m.update({samples:EMPTY(),dtSec:0.01,cycles:1});
 const s=r.models.get('pw')!.state();
 return {r,v:s.kind==='ext'?s.v:{}};
};

test('breadboard-power: both rails 5 V by default, a jumper moves a rail to 3.3 V',()=>{
 const a=run({});
 assert.equal(a.v.leftV,5);assert.equal(a.v.rightV,5);assert.equal(a.v.vin,9.6);
 const b=run({left:'5',right:'3.3'});
 assert.equal(b.v.leftV,5);assert.equal(b.v.rightV,3.3);
});
test('breadboard-power: the switch cuts both rails; a weak battery makes the rail sag',()=>{
 assert.equal(run({on:false}).v.leftV,null);
 const weak=run({},0);   // a flat battery gives 0 V: the rails sit at 0 V
 assert.equal(weak.v.leftV,0);
 const low=run({},10);   // 6.8 V in: 5 V rail needs 6.3 V, ok
 assert.equal(low.v.leftV,5);
});
