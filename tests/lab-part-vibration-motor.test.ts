/** Coin vibration motor: voltage across its leads sets speed, with a start voltage, run-down hysteresis, a lag and reverse. */
import test from 'node:test';
import assert from 'node:assert/strict';
import type {BoardPin,Circuit,PartLink,PartSpec,PinSample,UnoPin} from '../apps/web/src/lab/contract.js';
import {EMPTY,createWorldModels} from '../apps/web/src/lab/sim/peripherals.js';

const env={setPin(){},setAdc(){},schedule(){},now:()=>0};
const part=(id:string,kind:string,net:Partial<Record<string,BoardPin>>={},props:Record<string,string|number|boolean>={}):PartSpec=>({id,kind,net,props});
const link=(a:string,b:string):PartLink=>{const [pa,pp]=a.split('.'),[qa,qp]=b.split('.');return {a:{part:pa!,pin:pp!},b:{part:qa!,pin:qp!},color:'orange'};};
const out=(duty:number):PinSample=>({mode:'output',level:duty>0.5?1:0,duty,freqHz:490,highUs:0,analog:null});
const bridge=():Circuit=>({wires:[],parts:[part('drv','l298n',{ENA:'D9',IN1:'D7',IN2:'D8',GND:'GND'},{vs:9}),part('v1','vibration-motor')],links:[link('drv.OUT1','v1.+'),link('drv.OUT2','v1.-')]});
function run(c:Circuit,seq:{duties:Partial<Record<UnoPin,number>>;ms:number}[]){
 const r=createWorldModels(c,env);
 for(const {duties,ms} of seq){
  const samples=EMPTY();
  for(const [p,d] of Object.entries(duties))samples[p as UnoPin]=out(d!);
  for(let t=0;t<ms;t+=10)for(const m of r.models.values())m.update({samples,dtSec:0.01,cycles:0});
 }
 const s=r.models.get('v1')!.state();assert.equal(s.kind,'ext');
 return (s.kind==='ext'?s.v:{}) as {volts:number;rpm:number;hz:number;shake:number};
}

test('vibration-motor: about 3 V across the leads reaches rated speed (12000 rpm, 200 Hz)',()=>{
 // bridge from 9 V loses 2 V, 3 V needs duty 3/7
 const v=run(bridge(),[{duties:{D9:3/7,D7:1,D8:0},ms:3000}]);
 assert.ok(Math.abs(v.volts-3)<0.05,`volts ${v.volts}`);
 assert.ok(Math.abs(v.rpm-12000)<150,`rpm ${v.rpm}`);
 assert.ok(Math.abs(v.hz-200)<3,`hz ${v.hz}`);
 assert.ok(Math.abs(v.shake-1)<0.03,`shake ${v.shake}`);
});
test('vibration-motor: below the 2 V start voltage it stays still; once spinning it runs on down to 1 V',()=>{
 const low=run(bridge(),[{duties:{D9:1.5/7,D7:1,D8:0},ms:2000}]);
 assert.equal(low.rpm,0);
 const kept=run(bridge(),[{duties:{D9:3/7,D7:1,D8:0},ms:1500},{duties:{D9:1.5/7,D7:1,D8:0},ms:3000}]);
 assert.ok(kept.rpm>5000&&kept.rpm<7000,`1.5 V keeps turning, rpm ${kept.rpm}`);
 const stopped=run(bridge(),[{duties:{D9:3/7,D7:1,D8:0},ms:1500},{duties:{D9:0.7/7,D7:1,D8:0},ms:3000}]);
 assert.equal(stopped.rpm,0);
});
test('vibration-motor: spin-up has a lag (about 80 ms) and reverse polarity reverses the shaft, shake stays positive',()=>{
 const early=run(bridge(),[{duties:{D9:3/7,D7:1,D8:0},ms:80}]);
 assert.ok(early.rpm>3000&&early.rpm<10000,`mid spin-up ${early.rpm}`);
 const rev=run(bridge(),[{duties:{D9:3/7,D7:0,D8:1},ms:3000}]);
 assert.ok(rev.rpm<-11000,`rpm ${rev.rpm}`);assert.ok(rev.shake>0.9);
});
test('vibration-motor: unwired it is still; straight on a pin the power check warns about an external load',()=>{
 assert.equal(run({wires:[],parts:[part('v1','vibration-motor')]},[{duties:{},ms:500}]).rpm,0);
 const direct:Circuit={wires:[],parts:[part('v1','vibration-motor',{'+':'D9','-':'GND'})]};
 const r=createWorldModels(direct,env);
 r.models.get('v1')!.update({samples:(()=>{const s=EMPTY();s.D9=out(1);return s;})(),dtSec:0.01,cycles:0});
 assert.ok(r.world.notes().some(n=>n.code==='external'&&n.part==='v1'),JSON.stringify(r.world.notes()));
});
