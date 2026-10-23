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

import {chargeModel,loadClosed} from '../apps/web/src/lab/sim/devices/solar-charge-pwm.js';

const rig=(o:{irr?:number;soc?:number;chem?:string;ctrl?:string;bat?:string;loadOn?:boolean}={})=>{
 const bat=o.bat??'battery-lifepo4-12v';
 const {st,r}=run([
  {id:'pv',kind:'solar-panel',props:{watts:20,irradiance:o.irr??1000}},
  {id:'b',kind:bat,props:{soc:o.soc??50,...(o.chem?{chem:o.chem}:{})}},
  {id:'cc',kind:'solar-charge-pwm',props:{battery:o.ctrl??'lfp',loadOn:o.loadOn??true}},
  {id:'ld',kind:'load-lamp',props:{}},
 ],[link('pv','PV+','cc','PV+'),link('pv','PV-','cc','PV-'),link('b','P+','cc','BAT+'),link('b','P-','cc','BAT-')],4);
 return {s:st('cc'),r};
};
test('solar-charge-pwm: charge model stages',()=>{
 assert.equal(chargeModel({pvV:20,batV:12.8,iscA:1.23,battery:'lfp'}).stage,'bulk');
 assert.equal(chargeModel({pvV:20,batV:12.8,iscA:1.23,battery:'lfp'}).chargeA,1.23);
 assert.equal(chargeModel({pvV:20,batV:14.3,iscA:1.23,battery:'lfp'}).stage,'absorb');
 assert.equal(chargeModel({pvV:20,batV:14.5,iscA:1.23,battery:'lfp'}).stage,'float');
 assert.equal(chargeModel({pvV:0,batV:12.8,iscA:0,battery:'lfp'}).stage,'night');
 assert.equal(chargeModel({pvV:30,batV:12.8,iscA:25,battery:'lfp'}).chargeA,10,'capped at 10 A');
});
test('solar-charge-pwm: sun charges the battery, night does not',()=>{
 const day=rig().s,night=rig({irr:0}).s;
 assert.equal(day.stage,'bulk');assert.ok((day.chargeA as number)>1);assert.ok((day.batV as number)>12);
 assert.equal(night.stage,'night');assert.equal(night.chargeA,0);
});
test('solar-charge-pwm: low-voltage disconnect with hysteresis',()=>{
 assert.equal(loadClosed(true,10.9,'lfp',true),false);
 assert.equal(loadClosed(false,12.0,'lfp',true),false,'stays off until LVR');
 assert.equal(loadClosed(false,13.0,'lfp',true),true);
 assert.equal(loadClosed(true,13.0,'lfp',false),false,'loadOn toggle');
 assert.equal(rig({soc:60}).s.loadConnected,true);
 assert.equal(rig({soc:0}).s.loadConnected,false);
});
test('solar-charge-pwm: chemistry issue for 3S Li-ion or an LFP pack with the wrong mode',()=>{
 assert.equal(rig({bat:'battery-18650-pack',chem:'liion-3s'}).s.issue,'chemistry');
 assert.equal(rig({bat:'battery-18650-pack',chem:'lfp-4s'}).s.issue,'');
 assert.equal(rig({ctrl:'agm'}).s.issue,'chemistry');
 assert.equal(rig({ctrl:'lfp'}).s.issue,'');
});
