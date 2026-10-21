import test from 'node:test';
import assert from 'node:assert/strict';
import type {BoardPin,Circuit,UnoPin} from '../apps/web/src/lab/contract.js';
import {EMPTY,createModels} from '../apps/web/src/lab/sim/peripherals.js';
import type {I2cSlave} from '../apps/web/src/lab/sim/devices/types.js';

function fakeEnv(){
 const adc:{c:number;v:number}[]=[];
 return {adc,env:{
  setPin:(_p:UnoPin,_l:boolean)=>undefined,setAdc:(c:number,v:number)=>{adc.push({c,v});},
  schedule:()=>undefined,now:()=>0,watchLine:()=>undefined,attachI2c:(_s:I2cSlave)=>undefined,tapUart:()=>undefined,uartSend:()=>undefined,
 }};
}
const circuit=(net:Partial<Record<string,BoardPin>>,props:Record<string,string|number|boolean>={}):Circuit=>({wires:[],parts:[{id:'w1',kind:'water-level',net,props}]});

test('water-level: voltage rises with depth, 0 V dry, 2.4 V fully covered',()=>{
 const f=fakeEnv();
 const m=createModels(circuit({SIG:'A2'},{depth:0}),f.env).get('w1')!;
 assert.equal(f.adc.at(-1)!.v,0);
 assert.equal(f.adc.at(-1)!.c,2);
 let prev=0;
 for(const d of [5,10,20,30,40]){
  m.props.depth=d;m.update({samples:EMPTY(),dtSec:0.01,cycles:1});
  const v=f.adc.at(-1)!.v;assert.ok(v>prev,`depth ${d}`);prev=v;
 }
 assert.ok(Math.abs(prev-2.4)<1e-9);
 m.props.depth=999;m.update({samples:EMPTY(),dtSec:0.01,cycles:1});
 assert.ok(Math.abs(f.adc.at(-1)!.v-2.4)<1e-9);
});
test('water-level: unwired SIG pushes nothing',()=>{
 const f=fakeEnv();
 createModels(circuit({},{depth:10}),f.env);
 assert.equal(f.adc.length,0);
});
