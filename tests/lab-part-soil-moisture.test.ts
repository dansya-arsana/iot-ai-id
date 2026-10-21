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
const circuit=(net:Partial<Record<string,BoardPin>>,props:Record<string,string|number|boolean>={}):Circuit=>({wires:[],parts:[{id:'s1',kind:'soil-moisture',net,props}]});
const f1=(n:number)=>Math.round(n*1000)/1000;

test('soil-moisture: output is inversely related to wetness (2.8 V dry, 1.2 V wet)',()=>{
 const f=fakeEnv();
 const m=createModels(circuit({SIG:'A1'},{wetness:0}),f.env).get('s1')!;
 assert.equal(f1(f.adc.at(-1)!.v),2.8);
 assert.equal(f.adc.at(-1)!.c,1);
 m.props.wetness=100;m.update({samples:EMPTY(),dtSec:0.01,cycles:1});
 assert.equal(f1(f.adc.at(-1)!.v),1.2);
 m.props.wetness=50;m.update({samples:EMPTY(),dtSec:0.01,cycles:1});
 assert.equal(f1(f.adc.at(-1)!.v),2);
});
test('soil-moisture: unwired SIG pushes nothing; state exposes wetness',()=>{
 const f=fakeEnv();
 const m=createModels(circuit({},{wetness:30}),f.env).get('s1')!;
 assert.equal(f.adc.length,0);
 assert.equal(m.state().kind,'ext');
});
