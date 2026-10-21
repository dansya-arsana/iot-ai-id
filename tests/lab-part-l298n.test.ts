import test from 'node:test';
import assert from 'node:assert/strict';
import type {BoardPin,Circuit} from '../apps/web/src/lab/contract.js';
import {EMPTY,createModels} from '../apps/web/src/lab/sim/peripherals.js';

const env={setPin(){},setAdc(){},schedule(){},now:()=>0};
const net:Record<string,BoardPin>={ENA:'D9',IN1:'D2',IN2:'D3',IN3:'D4',IN4:'D5',ENB:'D10',GND:'GND'};
const circuit=(props:Record<string,string|number|boolean>={}):Circuit=>({wires:[],parts:[{id:'dr',kind:'l298n',net,props}]});
const run=(duty:Record<string,number>,props={})=>{
 const m=createModels(circuit(props),env).get('dr')!;
 const samples=EMPTY();
 for(const [k,p] of Object.entries(net))if(p!=='GND'){const d=duty[k]??0;samples[p as 'D2']={mode:'output',level:d>0?1:0,duty:d,freqHz:490,highUs:0,analog:null};}
 m.update({samples,dtSec:0.01,cycles:1});
 const s=m.state();return s.kind==='ext'?s.v:{};
};

test('l298n: truth table (forward, reverse, brake, coast)',()=>{
 assert.equal(run({ENA:1,IN1:1,IN2:0}).modeA,'forward');
 assert.equal(run({ENA:1,IN1:0,IN2:1}).modeA,'reverse');
 assert.equal(run({ENA:1,IN1:1,IN2:1}).modeA,'brake');
 assert.equal(run({ENA:1,IN1:0,IN2:0}).modeA,'brake');
 assert.equal(run({ENA:0,IN1:1,IN2:0}).modeA,'coast');
});
test('l298n: ~2 V drop and PWM on EN scale the output voltage, bridges are independent',()=>{
 const v=run({ENA:1,IN1:1,IN2:0,ENB:0.5,IN3:0,IN4:1},{vs:9});
 assert.equal(v.outAV,7);assert.equal(v.dutyA,1);
 assert.equal(v.outBV,-3.5);assert.equal(v.modeB,'reverse');
 assert.equal(run({ENA:0.25,IN1:1,IN2:0},{vs:12}).outAV,2.5);
});
test('l298n: supply below 7 V is flagged',()=>{
 assert.equal(run({ENA:1,IN1:1},{vs:5}).supplyOk,false);
 assert.equal(run({ENA:1,IN1:1},{vs:9}).supplyOk,true);
});
