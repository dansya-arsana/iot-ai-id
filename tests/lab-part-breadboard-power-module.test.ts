import test from 'node:test';
import assert from 'node:assert/strict';
import type {BoardPin,Circuit,UnoPin} from '../apps/web/src/lab/contract.js';
import {EMPTY,createModels,createWorldModels} from '../apps/web/src/lab/sim/peripherals.js';

import type {I2cSlave,SpiBinding} from '../apps/web/src/lab/sim/devices/types.js';

/** Minimal board: a clock with scheduled callbacks, pin logs and the shared-line / I2C / UART hooks. */
function fakeEnv(){
 const events:{at:number;cb:()=>void}[]=[];
 let now=0;
 const adc:number[]=[],log:{pin:UnoPin;level:boolean;at:number}[]=[],i2c:I2cSlave[]=[],spi:SpiBinding[]=[],uart:((b:number,c:number)=>void)[]=[],sent:number[]=[];
 return {adc,log,i2c,spi,uart,sent,
  env:{
   setPin:(p:UnoPin,l:boolean)=>{log.push({pin:p,level:l,at:now});},setAdc:(_c:number,v:number)=>{adc.push(v);},
   schedule:(c:number,cb:()=>void)=>{events.push({at:now+c,cb});events.sort((a,b)=>a.at-b.at);},now:()=>now,
   watchLine:()=>undefined,attachI2c:(s:I2cSlave)=>{i2c.push(s);},attachSpi:(s:SpiBinding)=>{spi.push(s);},tapUart:(cb:(b:number,c:number)=>void)=>{uart.push(cb);},uartSend:(b:number)=>{sent.push(b);},
  },
  at:(n:number)=>{now=n;},
  run(to:number){while(events.length&&events[0]!.at<=to){const e=events.shift()!;now=e.at;e.cb();}now=to;},
 };
}
const circuit=(net:Partial<Record<string,BoardPin>>,props:Record<string,string|number|boolean>={}):Circuit=>({wires:[],parts:[{id:'mb',kind:'breadboard-power-module',net,props}]});
import type {PartSpec} from '../apps/web/src/lab/contract.js';
const mk=(props:Record<string,string|number|boolean>,charge=100,extra:PartSpec[]=[],links:NonNullable<Circuit['links']>=[]):Circuit=>({wires:[],parts:[
 {id:'bat',kind:'battery-9v',net:{},props:{charge}},{id:'mb',kind:'breadboard-power-module',net:{},props},...extra,
],links:[{a:{part:'bat',pin:'PLUS'},b:{part:'mb',pin:'VIN'},color:'red'},{a:{part:'bat',pin:'MINUS'},b:{part:'mb',pin:'GND'},color:'black'},...links]});
const solve=(c:Circuit)=>{
 const f=fakeEnv(),r=createWorldModels(c,f.env);
 for(const m of r.models.values())m.update({samples:EMPTY(),dtSec:0.001,cycles:1});
 const s=r.models.get('mb')!.state();
 return {v:(s.kind==='ext'?s.v:{}) as Record<string,unknown>,world:r.world};
};

test('breadboard-power-module: jack in, both jumpers on 5 V: each rail is a 5 V regulator off the battery',()=>{
 const {v}=solve(mk({}));
 assert.equal(v.vin,9.6);assert.equal(v.leftV,5);assert.equal(v.rightV,5);assert.equal(v.live,true);assert.equal(v.source,'jack');
});
test('breadboard-power-module: a jumper on 3.3 V gives that rail 3.3 V while the other stays 5 V',()=>{
 const {v}=solve(mk({left:'5',right:'3.3'}));
 assert.equal(v.leftV,5);assert.equal(v.rightV,3.3);
});
test('breadboard-power-module: a nearly flat battery drops out (rail follows VIN minus the regulator dropout)',()=>{
 const {v}=solve(mk({},10));   // 6.8 V cell
 assert.equal(v.leftV,5);
 const low=solve(mk({},0));
 assert.ok(Number(low.v.leftV??0)<=0.1,'an empty battery gives no rail');
});
test('breadboard-power-module: USB source needs no battery and gives 5 V / 3.3 V stiff rails',()=>{
 const c:Circuit={wires:[],parts:[{id:'mb',kind:'breadboard-power-module',net:{GND:'GND'},props:{source:'usb',right:'3.3'}}]};
 const {v}=solve(c);
 assert.equal(v.source,'usb');assert.equal(v.leftV,5);assert.equal(v.rightV,3.3);
});
test('breadboard-power-module: the power switch kills both rails',()=>{
 const {v}=solve(mk({on:false}));
 assert.ok(Number(v.leftV??0)<0.5&&Number(v.rightV??0)<0.5,`${v.leftV} ${v.rightV}`);assert.equal(v.live,false);
});
test('breadboard-power-module: a 3.3 V part on a 5 V rail is reported, on a 3.3 V rail it is not',()=>{
 const bme:PartSpec={id:'s',kind:'bme280',net:{},props:{}};
 const links=(pin:string):NonNullable<Circuit['links']>=>[{a:{part:'mb',pin},b:{part:'s',pin:'VCC'},color:'red'},{a:{part:'mb',pin:'GND'},b:{part:'s',pin:'GND'},color:'black'}];
 const bad=solve(mk({left:'5'},100,[bme],links('LEFT')));
 assert.ok(bad.world.notes().some(n=>n.part==='s'&&n.code==='over'),JSON.stringify(bad.world.notes()));
 const ok=solve(mk({left:'3.3'},100,[bme],links('LEFT')));
 assert.ok(!ok.world.notes().some(n=>n.part==='s'),JSON.stringify(ok.world.notes()));
});
test('breadboard-power-module: pins VIN, GND, LEFT, RIGHT and a 6.5-12 V input rating',()=>{
 const f=fakeEnv();
 const m=createModels(circuit({}),f.env).get('mb')!;
 assert.equal(m.state().kind,'ext');
 const p=m.power;assert.deepEqual([p?.rail[0],p?.rail[1],p?.min,p?.max],['VIN','GND',6.5,12]);
 assert.deepEqual(m.regulators?.().map(r=>r.out),['LEFT','RIGHT']);
 const u=createModels(circuit({},{source:'usb'}),f.env).get('mb')!;
 assert.equal(u.regulators?.().length,0);assert.equal(u.supplies?.().length,2);
});
