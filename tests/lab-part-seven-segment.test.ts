import test from 'node:test';
import assert from 'node:assert/strict';
import type {BoardPin,Circuit} from '../apps/web/src/lab/contract.js';
import {EMPTY,createModels} from '../apps/web/src/lab/sim/peripherals.js';

const env={setPin(){},setAdc(){},schedule(){},now:()=>0};
const net:Record<string,BoardPin>={a:'D2',b:'D3',c:'D4',d:'D5',e:'D6',f:'D7',g:'D8',dp:'D9',COM:'GND'};
const circuit=(props:Record<string,string|number|boolean>={}):Circuit=>({wires:[],parts:[{id:'ss1',kind:'seven-segment',net,props}]});
const drive=(m:ReturnType<typeof createModels> extends Map<string,infer M>?M:never,hi:string[],dutyFor:Record<string,number>={})=>{
 const samples=EMPTY();
 for(const [k,p] of Object.entries(net))if(p!=='GND')samples[p as 'D2']={mode:'output',level:hi.includes(k)?1:0,duty:dutyFor[k]??(hi.includes(k)?1:0),freqHz:0,highUs:0,analog:null};
 m.update({samples,dtSec:0.01,cycles:1000});
 const s=m.state();assert.equal(s.kind,'ext');return s.kind==='ext'?s.v:{};
};

test('seven-segment: pattern 0b1111110 shows a 0 with exact current per segment',()=>{
 const m=createModels(circuit({seriesOhms:330,color:'red'}),env).get('ss1')!;
 const v=drive(m,['a','b','c','d','e','f']);
 assert.equal(v.glyph,'0');
 assert.equal(v.ma_a,round((5-2.0)/330*1000));
 assert.equal(v.ma_g,0);assert.equal(v.g,0);
 assert.equal(v.dp,0);
 assert.ok(Math.abs(Number(v.totalMa)-6*9.1)<0.6);
});
test('seven-segment: 8 with dp, wrong COM and 2 segments disagree with a 7',()=>{
 const m=createModels(circuit(),env).get('ss1')!;
 assert.equal(drive(m,['a','b','c','d','e','f','g','dp']).glyph,'8');
 assert.equal(drive(m,['a','b','c']).glyph,'7');
 assert.equal(drive(m,['a','b','d']).glyph,'');
});
test('seven-segment: PWM duty scales current, small resistor flags over-current, blue needs 3 V of headroom',()=>{
 const m=createModels(circuit({seriesOhms:100}),env).get('ss1')!;
 const v=drive(m,['a']);assert.equal(v.over,true);
 const half=drive(m,['a'],{a:0.5});assert.equal(half.ma_a,round(0.5*(5-2.0)/100*1000));
 const b=createModels(circuit({seriesOhms:220,color:'blue'}),env).get('ss1')!;
 assert.equal(drive(b,['a']).ma_a,round((5-3.0)/220*1000));
});
test('seven-segment: COM tied to 5 V (wrong wiring) lights nothing',()=>{
 const c2:Circuit={wires:[],parts:[{id:'ss1',kind:'seven-segment',net:{...net,COM:'5V'},props:{}}]};
 const m=createModels(c2,env).get('ss1')!;
 assert.equal(drive(m,['a','b']).totalMa,0);
});
function round(x:number):number{return Math.round(x*10)/10;}
