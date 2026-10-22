import test from 'node:test';
import assert from 'node:assert/strict';
import type {BoardPin,Circuit,UnoPin} from '../apps/web/src/lab/contract.js';
import {createModels} from '../apps/web/src/lab/sim/peripherals.js';
import {ntcOhms,ntcTempC,ntcVolts} from '../apps/web/src/lab/sim/devices/ntc-thermistor.js';

function fakeEnv(){
 const adc:{ch:number;v:number}[]=[];
 return {adc,env:{setPin:(_p:UnoPin,_l:boolean)=>undefined,setAdc:(ch:number,v:number)=>{adc.push({ch,v});},schedule:()=>undefined,now:()=>0}};
}
const circuit=(net:Partial<Record<string,BoardPin>>,props:Record<string,string|number|boolean>={}):Circuit=>({wires:[],parts:[{id:'ntc1',kind:'ntc-thermistor',net,props}]});

test('ntc: 10k at 25 degC, beta curve at known points (B3950)',()=>{
 assert.ok(Math.abs(ntcOhms(25)-10000)<1e-6);
 assert.ok(Math.abs(ntcOhms(0)-10000*Math.exp(3950*(1/273.15-1/298.15)))<1e-6);
 assert.ok(Math.abs(ntcOhms(0)-33621)<60,'about 33.6k at 0 degC');
 assert.ok(Math.abs(ntcOhms(50)-3588)<30,'about 3.6k at 50 degC');
 assert.ok(ntcOhms(100)<ntcOhms(50)&&ntcOhms(50)<ntcOhms(25)&&ntcOhms(25)<ntcOhms(0),'monotonic: warmer, lower resistance');
 for(const t of [-30,0,25,60,110])assert.ok(Math.abs(ntcTempC(ntcOhms(t))-t)<1e-9);
});
test('ntc: divider is NTC on top, series resistor to GND: 2.5 V at 25 degC with 10k, rising with temperature',()=>{
 assert.ok(Math.abs(ntcVolts(5,25,10000)-2.5)<1e-9);
 assert.ok(ntcVolts(5,50,10000)>ntcVolts(5,25,10000));
 assert.ok(Math.abs(ntcVolts(3.3,25,10000)-1.65)<1e-9);
});
test('ntc: the model drives the wired analog channel from its popover values; the series resistor shifts the voltage',()=>{
 const f=fakeEnv();
 const m=createModels(circuit({VCC:'5V',SIG:'A1',GND:'GND'},{tempC:25}),f.env).get('ntc1')!;
 assert.equal(f.adc.at(-1)!.ch,1);assert.ok(Math.abs(f.adc.at(-1)!.v-2.5)<1e-9);
 m.props.tempC=50;m.update({samples:{} as never,dtSec:0.01,cycles:1});
 assert.ok(Math.abs(f.adc.at(-1)!.v-ntcVolts(5,50,10000))<1e-9);
 m.props.seriesOhms=1000;m.update({samples:{} as never,dtSec:0.01,cycles:1});
 assert.ok(Math.abs(f.adc.at(-1)!.v-ntcVolts(5,50,1000))<1e-9);
 const s=m.state();assert.ok(s.kind==='ext');
 if(s.kind==='ext'){assert.equal(s.v.ohms,Math.round(ntcOhms(50)));assert.equal(s.v.adc,Math.round(ntcVolts(5,50,1000)/5*1023));}
});
test('ntc: SIG not wired drives nothing; SIG on another channel changes the channel',()=>{
 const g=fakeEnv();createModels(circuit({VCC:'5V',GND:'GND'}),g.env);assert.equal(g.adc.length,0);
 const h=fakeEnv();createModels(circuit({VCC:'5V',SIG:'A3',GND:'GND'}),h.env);assert.equal(h.adc.at(-1)!.ch,3);
});

// ---------- real firmware: the beta equation on A1 ----------
import {readFileSync} from 'node:fs';
import type {FirmwareVariant} from '../apps/web/src/lab/contract.js';
import {createLabRunner} from '../apps/web/src/lab/sim/runner.js';
const fixture=():{toolchain:string;variant:FirmwareVariant}=>JSON.parse(readFileSync(new URL('./fixtures/firmware/thermo-analog.json',import.meta.url),'utf8'));
test('real firmware: the sketch inverts the divider with the beta equation and recovers the temperature',()=>{
 const fx=fixture(),r=createLabRunner();
 r.load(fx.variant,{},{wires:[],parts:[{id:'ntc1',kind:'ntc-thermistor',net:{VCC:'5V',SIG:'A1',GND:'GND'},props:{tempC:25}}]},fx.toolchain);r.start();
 r.advance(400);
 const last=(re:RegExp):number=>parseFloat(r.serialText().match(re)!.at(-1)!.split('=')[1]!);
 assert.ok(Math.abs(last(/ntc=-?[\d.]+/g)-25)<0.6,r.serialText());
 assert.ok(Math.abs(last(/a1=\d+/g)-512)<=1);
 r.setPartProps('ntc1',{tempC:60});r.advance(400);
 assert.ok(Math.abs(last(/ntc=-?[\d.]+/g)-60)<1.0,r.serialText());
 r.setPartProps('ntc1',{tempC:-10});r.advance(400);
 assert.ok(Math.abs(last(/ntc=-?[\d.]+/g)+10)<2.5,'at -10 degC one ADC count is worth about 1.5 degC');
});
