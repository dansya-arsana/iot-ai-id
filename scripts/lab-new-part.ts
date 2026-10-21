/**
 * Scaffold a new lab component (kind): visual part + simulation device + unit test + docs stub, all auto-discovered.
 *
 * Usage: npm run lab:new-part -- <kind> --protocol gpio|adc|pwm|pulse|i2c|onewire|uart|switch [--desk] [--force]
 *   <kind>      kebab-case id, e.g. ds18b20 or tilt-switch
 *   --protocol  picks the device template (which hooks it uses); default gpio
 *   --desk      off-board prop (no breadboard legs), like the lamp or the obstacle
 *   --force     overwrite existing files
 *
 * Creates (no core file is edited, see docs/lab-extending.md):
 *   apps/web/src/lab/sim/devices/<kind>.ts   DeviceDef  (sim)
 *   apps/web/src/lab/scene/parts/<kind>.ts   PartModule (3D)
 *   tests/lab-part-<kind>.test.ts            unit test of the device
 *   docs/lab-parts/<kind>.md                 docs stub, and docs/lab-parts/README.md is regenerated (the gallery index)
 */
import {existsSync, mkdirSync, readdirSync, writeFileSync} from 'node:fs';
import {dirname, join, resolve} from 'node:path';
import {fileURLToPath} from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const PROTOCOLS = ['gpio', 'adc', 'pwm', 'pulse', 'i2c', 'onewire', 'uart', 'switch'] as const;
type Protocol = (typeof PROTOCOLS)[number];

interface Tpl {proto?: string; pins: string[]; state: string; stateInit: string; inputs: string; body: string; test: string; blurb: string}

const TEMPLATES: Record<Protocol, Tpl> = {
  switch: {
    proto: 'gpio',
    blurb: 'a sensor or switch that drives a pin the sketch reads (tilt, reed, PIR, flame): a popover toggle sets the level',
    pins: ['VCC', 'SIG', 'GND'],
    state: '{active:boolean}',
    stateInit: '{active:false}',
    inputs: `[{type:'toggle',key:'active',label:{en:'Active',id:'Aktif'},default:false}]`,
    body: `  // popover edits only mutate ctx.props (nothing is called), so poll in tick()/state() and drive the pin on change
  const sig=uno(ctx.net('SIG'));   // uno() turns the wired board pin into a UnoPin or null; ctx.env.setPin drives it
  let last:boolean|null=null;
  const sync=():boolean=>{const a=ctx.props.active===true;if(sig&&a!==last)ctx.env.setPin(sig,a);last=a;return a;};
  sync();
  return {
   state:()=>({active:sync()}),
   tick(){sync();},
  };`,
    test: `  const f=fakeEnv();
  // createModels copies the spec props: change the model's own m.props, not the circuit
  const m=createModels(circuit({SIG:'D4'}),f.env).get('__KIND__1')!;
  assert.equal(f.log.at(-1)?.level,false);
  m.props.active=true;m.update({samples:EMPTY(),dtSec:0.01,cycles:1});
  assert.equal(f.log.at(-1)?.level,true);
  const s=m.state();assert.ok(s.kind==='ext');if(s.kind==='ext')assert.equal(s.v.active,true);`,
  },
  gpio: {
    blurb: 'a digital input the sketch drives (an indicator): the device watches one pin',
    pins: ['VCC', 'SIG', 'GND'],
    state: '{high:boolean;/** edges seen since load */edges:number}',
    stateInit: '{high:false,edges:0}',
    inputs: '[]',
    body: `  const sig=ctx.pin('SIG');
  let high=false,edges=0;
  return {
   state:()=>({high,edges}),
   // every edge on a pin this device is wired to; cycle = CPU cycle of the edge
   onPinChange(pin,level){if(pin!==sig)return;high=level===1;edges++;},
  };`,
    test: `  const f=fakeEnv();
  const m=createModels(circuit({SIG:'D4'}),f.env).get('__KIND__1')!;
  m.onEdge!('D4',1,100);m.onEdge!('D4',0,200);
  const s=m.state();assert.ok(s.kind==='ext');
  if(s.kind==='ext'){assert.equal(s.v.edges,2);assert.equal(s.v.high,false);}`,
  },
  adc: {
    blurb: 'an analog sensor: the device puts a voltage on an ADC pin',
    pins: ['VCC', 'SIG', 'GND'],
    state: '{value:number;volts:number}',
    stateInit: '{value:512,volts:2.5}',
    inputs: `[{type:'range',key:'value',label:{en:'Reading',id:'Bacaan'},min:0,max:1023,step:1,default:512}]`,
    body: `  const sig=ctx.pin('SIG');
  const value=()=>clamp(Math.round(num(ctx.props.value,512)),0,1023);
  return {
   state:()=>({value:value(),volts:round1(value()/1023*5)}),
   // polled by the host after every slice and pushed to the ADC
   adc:()=>sig?{pin:sig,volts:value()/1023*5}:null,
  };`,
    test: `  const f=fakeEnv();
  const m=createModels(circuit({SIG:'A0'},{value:1023}),f.env).get('__KIND__1')!;
  assert.equal(f.adc.at(-1),5);
  m.props.value=0;m.update({samples:EMPTY(),dtSec:0.01,cycles:1});
  assert.equal(f.adc.at(-1),0);`,
  },
  pwm: {
    blurb: 'an actuator driven by PWM: the device reads duty and frequency of its pin',
    pins: ['VCC', 'SIG', 'GND'],
    state: '{duty:number;freqHz:number}',
    stateInit: '{duty:0,freqHz:0}',
    inputs: '[]',
    body: `  let duty=0,freqHz=0;
  return {
   state:()=>({duty:round1(duty*100)/100,freqHz:Math.round(freqHz)}),
   // once per simulated slice: samples hold duty, frequency and the last high pulse of every pin
   update(f){const p=ctx.pin('SIG');if(!p)return;const s=f.samples[p];duty=s.mode==='output'?s.duty:0;freqHz=s.freqHz;},
  };`,
    test: `  const f=fakeEnv();
  const m=createModels(circuit({SIG:'D9'}),f.env).get('__KIND__1')!;
  const samples=EMPTY();samples.D9={mode:'output',level:1,duty:0.5,freqHz:490,highUs:1020,analog:null};
  m.update({samples,dtSec:0.01,cycles:10});
  const s=m.state();assert.ok(s.kind==='ext');
  if(s.kind==='ext'){assert.equal(s.v.duty,0.5);assert.equal(s.v.freqHz,490);}`,
  },
  pulse: {
    blurb: 'a pulse-width sensor (like the HC-SR04): a trigger pulse in, a timed echo pulse out',
    pins: ['VCC', 'TRIG', 'ECHO', 'GND'],
    state: '{distanceCm:number;pings:number}',
    stateInit: '{distanceCm:50,pings:0}',
    inputs: `[{type:'range',key:'distanceCm',label:{en:'Distance',id:'Jarak'},min:3,max:300,step:1,unit:'cm',default:50}]`,
    body: `  const trig=ctx.pin('TRIG'),echo=ctx.pin('ECHO');
  let rise=0,busy=false,pings=0;
  const dist=()=>clamp(num(ctx.props.distanceCm,50),3,300);
  return {
   state:()=>({distanceCm:dist(),pings}),
   onPinChange(pin,level,cycle){
    if(pin!==trig||!echo)return;
    if(level===1){rise=cycle;return;}
    if(cycle-rise<us(8)||busy)return;       // needs a trigger pulse of about 10 us
    busy=true;pings++;
    // echo high for 58 us per cm, after a short delay; drive() schedules the edges in CPU cycles
    ctx.drive(echo,[{level:1,holdCycles:us(dist()*58)},{level:0,holdCycles:0}],{delayCycles:us(250),onDone:()=>{busy=false;}});
   },
  };`,
    test: `  const f=fakeEnv();
  const m=createModels(circuit({TRIG:'D7',ECHO:'D6'},{distanceCm:10}),f.env).get('__KIND__1')!;
  m.onEdge!('D7',1,0);m.onEdge!('D7',0,us(10));
  f.run(us(10)+us(250)+us(700));
  const up=f.log.find(e=>e.pin==='D6'&&e.level);const down=f.log.find(e=>e.pin==='D6'&&!e.level);
  assert.ok(up&&down);assert.equal(down.at-up.at,us(580),'58 us per cm');`,
  },
  i2c: {
    blurb: 'an I2C slave: the sketch talks to it with Wire (address 0x40, register 0 = value)',
    pins: ['VCC', 'SDA', 'SCL', 'GND'],
    state: '{value:number;reads:number;writes:number}',
    stateInit: '{value:0,reads:0,writes:0}',
    inputs: `[{type:'range',key:'value',label:{en:'Reading',id:'Bacaan'},min:0,max:255,step:1,default:42}]`,
    body: `  let pointer=0,reads=0,writes=0;
  const value=()=>clamp(Math.round(num(ctx.props.value,42)),0,255);
  return {
   state:()=>({value:value(),reads,writes}),
   // the TWI bus (avr8js AVRTWI) calls these; 7-bit address, ACK what you accept
   i2c:{
    address:0x40,
    onStart(){pointer=0;},
    onWrite(byte){writes++;pointer=byte;return true;},          // first byte after the address = register pointer
    onRead(){reads++;return pointer===0?value():0xff;},          // register 0 holds the reading
    onStop(){},
   },
  };`,
    test: `  const f=fakeEnv();
  const m=createModels(circuit({SDA:'A4',SCL:'A5'},{value:7}),f.env).get('__KIND__1')!;
  const bus=f.i2c[0]!;
  assert.equal(bus.address,0x40);
  bus.onStart!(false,true);assert.equal(bus.onWrite(0),true);
  bus.onStart!(true,false);assert.equal(bus.onRead(true),7);
  const s=m.state();assert.ok(s.kind==='ext');
  if(s.kind==='ext'){assert.equal(s.v.reads,1);assert.equal(s.v.writes,1);}`,
  },
  onewire: {
    blurb: 'a one-wire device (like the DHT22): the host pulls the shared line low, the device answers with timed pulses',
    pins: ['VCC', 'DATA', 'GND'],
    state: '{active:boolean;resets:number;value:number}',
    stateInit: '{active:false,resets:0,value:0}',
    inputs: `[{type:'range',key:'value',label:{en:'Value',id:'Nilai'},min:0,max:100,step:1,default:50}]`,
    body: `  const data=ctx.pin('DATA');
  let fall=0,active=false,resets=0;
  if(data)ctx.line(data,true);   // shared open-drain line, idle high through the pull-up
  return {
   state:()=>({active,resets,value:clamp(num(ctx.props.value,50),0,100)}),
   onPinChange(pin,level,cycle){
    if(pin!==data||active)return;          // ignore our own edges
    if(level===0){fall=cycle;return;}
    if(cycle-fall<us(480))return;           // a reset pulse is at least 480 us low
    resets++;active=true;
    // presence pulse: low for 120 us, 30 us after the host lets go; see sim/devices/dht22.ts for a full 40-bit protocol
    ctx.drive(data,[{level:0,holdCycles:us(120)},{level:1,holdCycles:0}],{delayCycles:us(30),onDone:()=>{active=false;}});
   },
  };`,
    test: `  const f=fakeEnv();
  const m=createModels(circuit({DATA:'D2'}),f.env).get('__KIND__1')!;
  f.log.length=0;
  f.at(0);m.onEdge!('D2',0,0);f.at(us(500));m.onEdge!('D2',1,us(500));f.run(us(500)+us(400));
  assert.equal(f.log[0]!.at-us(500),us(30));assert.equal(f.log[0]!.level,false);
  assert.equal(f.log[1]!.at-f.log[0]!.at,us(120));
  const s=m.state();assert.ok(s.kind==='ext');if(s.kind==='ext')assert.equal(s.v.resets,1);`,
  },
  uart: {
    blurb: 'a serial device: the device taps the bytes the sketch sends and can answer on RX',
    pins: ['VCC', 'TX', 'RX', 'GND'],
    state: '{rx:number;last:number;value:number}',
    stateInit: '{rx:0,last:0,value:0}',
    inputs: `[{type:'range',key:'value',label:{en:'Value',id:'Nilai'},min:0,max:255,step:1,default:65}]`,
    body: `  let rx=0,last=0;
  return {
   state:()=>({rx,last,value:clamp(Math.round(num(ctx.props.value,65)),0,255)}),
   // every byte the sketch sends with Serial.write/print arrives here
   uart:{onTx(byte){rx++;last=byte;if(byte===0x3f)ctx.uartSend(clamp(Math.round(num(ctx.props.value,65)),0,255));}},   // '?' asks for the value
  };`,
    test: `  const f=fakeEnv();
  const m=createModels(circuit({TX:'D1',RX:'D0'},{value:65}),f.env).get('__KIND__1')!;
  f.uart[0]!(0x3f,100);
  assert.deepEqual(f.sent,[65]);
  const s=m.state();assert.ok(s.kind==='ext');if(s.kind==='ext'){assert.equal(s.v.rx,1);assert.equal(s.v.last,0x3f);}`,
  },
};

const camel = (k: string): string => k.replace(/-([a-z0-9])/g, (_m, c: string) => c.toUpperCase());
const title = (k: string): string => k.toUpperCase();

function fill(src: string, v: Record<string, string>): string {
  return src.replace(/__([A-Z]+)__/g, (_m, k: string) => v[k] ?? `__${k}__`);
}

/** Helpers from devices/types a template body actually calls, as an import suffix. */
const helpers = (body: string): string => ['clamp', 'num', 'round1', 'us'].filter((n) => new RegExp(`\\b${n}\\(`).test(body)).map((n) => ',' + n).join('');

function deviceFile(kind: string, p: Protocol, t: Tpl, desk: boolean): string {
  const pins = desk ? [] : t.pins;
  return fill(`/**
 * __TITLE__ device (protocol '${p}'): ${t.blurb}.
 * Pair: scene/parts/__KIND__.ts (3D). Both are auto-discovered; nothing else to edit. Guide: docs/lab-extending.md
 */
import {defineDevice__HELPERS__} from './types';__UNO__

export type __PASCAL__State=${t.state};

export const device=defineDevice<__PASCAL__State>({
 kind:'__KIND__',protocol:'${t.proto??p}',
 // pins in physical order; this list becomes PART_PINS['__KIND__'] and must equal the part's pins
 pins:${JSON.stringify(pins).replace(/"/g, "'")},${desk ? '' : `holes:${JSON.stringify(pins.map((_x, i) => i))},`}
 copy:{
  name:{en:'__TITLE__',id:'__TITLE__'},
  desc:{en:'TODO one sentence about what __TITLE__ does.',id:'TODO satu kalimat tentang fungsi __TITLE__.'},
  note:{en:'Click it to change its values.',id:'Klik untuk mengubah nilainya.'},
 },
 // typed schema of the popover; the part's controls are generated from it
 inputs:${t.inputs},
 create(ctx){
${t.body}
 },
});
`, {KIND: kind, TITLE: title(kind), HELPERS: helpers(t.body), UNO: /\buno\(/.test(t.body) ? "\nimport {uno} from './core/util';" : '', PASCAL: camel(kind).replace(/^./, (c) => c.toUpperCase())});
}

function partFile(kind: string, p: Protocol, t: Tpl, desk: boolean): string {
  const pins = desk ? [] : t.pins;
  const def = pins.map((n, i) => {
    const type = /^(VCC|V)$/.test(n) ? 'power' : n === 'GND' ? 'ground' : /^(SIG|TRIG|SDA|SCL|RX)$/.test(n) ? 'input' : 'output';
    const lab = type === 'power' ? "'5V','5V'" : type === 'ground' ? "'Ground','Ground'" : `'${n}','${n}'`;
    return `${n}:pin([${i}*PITCH,0,0],'${type}',${lab})`;
  }).join(',');
  return fill(`/** __TITLE__ (${p}): placeholder body, restyle it. Pairs with sim/devices/__KIND__.ts. Guide: docs/lab-extending.md */
import {BoxGeometry,Color,Group,MeshStandardMaterial} from 'three';
import type {PartProps} from '../../contract';
import type {__PASCAL__State} from '../../sim/devices/__KIND__';
__PITCHIMP__import {solid} from '../materials';
import * as C from '../palette';
import {__LEG__definePart,extState,c,__PIN__callout,type Inner} from './kit';

function build__PASCAL__(_p:PartProps,g:Group):Inner{
 const w=${desk ? '12' : `Math.max(8,${Math.max(pins.length, 1)}*PITCH+4)`};
 ${desk ? '' : `for(let i=0;i<${pins.length};i++)g.add(leg(i*PITCH,3));`}
 const body=solid(new BoxGeometry(w,8,6),C.CHIP,{outline:true,edges:true,pos:[${desk ? '0' : `(${Math.max(pins.length, 1)}-1)*PITCH/2`},${desk ? '4' : '7'},0],own:true});
 g.add(body);
 const mat=body.material as MeshStandardMaterial;
 const idle=new Color(C.CHIP),live=new Color(C.LIVE);
 return {
  apply(s){
   const st=extState<__PASCAL__State>(s,'__KIND__');
   if(!st)return;
   // show the typed state: here the body glows green when any boolean is true or any number is non-zero
   const on=Object.values(st as Record<string,unknown>).some(v=>v===true||(typeof v==='number'&&v>0));
   mat.color.copy(on?live:idle);
  },
 };
}

export const __CAMEL__=definePart({
 kind:'__KIND__',name:c('__TITLE__','__TITLE__'),
 pins:{${def}},
 callouts:[callout('body',[0,12,0],'TODO what to look at','TODO apa yang dilihat')],
 make:build__PASCAL__,
});
`, {KIND: kind, TITLE: title(kind), PITCHIMP: pins.length ? "import {PITCH} from '../layout';\n" : '', LEG: desk ? '' : 'leg,', PIN: pins.length ? 'pin,' : '', PASCAL: camel(kind).replace(/^./, (c) => c.toUpperCase()), CAMEL: camel(kind)});
}

function testFile(kind: string, t: Tpl, desk: boolean): string {
  const pins = desk ? [] : t.pins;
  return fill(`import test from 'node:test';
import assert from 'node:assert/strict';
import type {BoardPin,Circuit,UnoPin} from '../apps/web/src/lab/contract.js';
import {__EMPTY__createModels} from '../apps/web/src/lab/sim/peripherals.js';
__USIMP__
import type {I2cSlave} from '../apps/web/src/lab/sim/devices/types.js';

/** Minimal board: a clock with scheduled callbacks, pin logs and the shared-line / I2C / UART hooks. */
function fakeEnv(){
 const events:{at:number;cb:()=>void}[]=[];
 let now=0;
 const adc:number[]=[],log:{pin:UnoPin;level:boolean;at:number}[]=[],i2c:I2cSlave[]=[],uart:((b:number,c:number)=>void)[]=[],sent:number[]=[];
 return {adc,log,i2c,uart,sent,
  env:{
   setPin:(p:UnoPin,l:boolean)=>{log.push({pin:p,level:l,at:now});},setAdc:(_c:number,v:number)=>{adc.push(v);},
   schedule:(c:number,cb:()=>void)=>{events.push({at:now+c,cb});events.sort((a,b)=>a.at-b.at);},now:()=>now,
   watchLine:()=>undefined,attachI2c:(s:I2cSlave)=>{i2c.push(s);},tapUart:(cb:(b:number,c:number)=>void)=>{uart.push(cb);},uartSend:(b:number)=>{sent.push(b);},
  },
  at:(n:number)=>{now=n;},
  run(to:number){while(events.length&&events[0]!.at<=to){const e=events.shift()!;now=e.at;e.cb();}now=to;},
 };
}
const circuit=(net:Partial<Record<string,BoardPin>>,props:Record<string,string|number|boolean>={}):Circuit=>({wires:[],parts:[{id:'__KIND__1',kind:'__KIND__',net,props}]});

test('__KIND__: device registers and answers its protocol',()=>{
${desk ? `  const f=fakeEnv();\n  assert.ok(createModels(circuit({}),f.env).get('__KIND__1'));` : t.test}
});
test('__KIND__: pins ${pins.join(' ') || '(desk prop)'}',()=>{
 const f=fakeEnv();
 const m=createModels(circuit({}),f.env).get('__KIND__1');
 assert.ok(m);assert.equal(m!.state().kind,'ext');   // add: one assertion per pin you wired (a wrong net must change the result)
});
`, {KIND: kind, TITLE: title(kind), EMPTY: !desk && /EMPTY\(/.test(t.test) ? 'EMPTY,' : '', USIMP: !desk && /\bus\(/.test(t.test) ? "import {us} from '../apps/web/src/lab/sim/devices/types.js';" : ''});
}

function docFile(kind: string, p: Protocol, t: Tpl, desk: boolean): string {
  return `# ${title(kind)}

Protocol: \`${p}\` (${t.blurb}).

- Device (simulation): \`apps/web/src/lab/sim/devices/${kind}.ts\`
- Part (3D): \`apps/web/src/lab/scene/parts/${kind}.ts\`
- Test: \`tests/lab-part-${kind}.test.ts\`
- Pins: ${desk ? 'none (desk prop)' : t.pins.join(', ')}

## TODO before you hand this in (delete this section when done)

0. The test asserts template placeholders (state fields like high, edges, active, and the part glows on any truthy field): replace them with the real behaviour.
1. Real behaviour in the device (cite the datasheet timing/registers in comments).
2. A real 3D body in the part (match the physical part; keep to the lab palette).
3. English and Indonesian copy in \`copy\` (device) and in the part callouts.
4. \`npx tsx --test tests/lab-parts-contract.test.ts tests/lab-part-${kind}.test.ts\`
5. Screenshot with \`docs/lab-extending.md\` section "Screenshots".

Write down here: where the model comes from (own work or a permissive source; never copy GPL or unlicensed art or code).
`;
}

function regenIndex(): void {
  const dir = join(ROOT, 'docs/lab-parts');
  const rows = readdirSync(dir).filter((f) => f.endsWith('.md') && f !== 'README.md').sort().map((f) => `- [${f.replace(/\.md$/, '')}](./${f})`);
  writeFileSync(join(dir, 'README.md'), `# Lab parts\n\nOne page per scaffolded kind (generated by \`npm run lab:new-part\`). The live list is the registry: \`registry.kinds()\` in \`scene/parts/index.ts\`.\n\n${rows.join('\n')}\n`);
}

function main(): void {
  const args = process.argv.slice(2);
  const kind = args.find((a) => !a.startsWith('--'));
  const pi = args.indexOf('--protocol');
  const protocol = (pi >= 0 ? args[pi + 1] : 'gpio') as Protocol;
  const desk = args.includes('--desk');
  const force = args.includes('--force');
  if (!kind || !/^[a-z][a-z0-9-]{1,23}$/.test(kind)) throw new Error('usage: npm run lab:new-part -- <kind> --protocol ' + PROTOCOLS.join('|') + ' [--desk] [--force]   (kind: kebab-case, 2-24 chars)');
  if (!PROTOCOLS.includes(protocol)) throw new Error(`unknown protocol '${protocol}', use ${PROTOCOLS.join('|')}`);
  const t = TEMPLATES[protocol];
  const files: [string, string][] = [
    [`apps/web/src/lab/sim/devices/${kind}.ts`, deviceFile(kind, protocol, t, desk)],
    [`apps/web/src/lab/scene/parts/${kind}.ts`, partFile(kind, protocol, t, desk)],
    [`tests/lab-part-${kind}.test.ts`, testFile(kind, t, desk)],
    [`docs/lab-parts/${kind}.md`, docFile(kind, protocol, t, desk)],
  ];
  for (const [rel] of files) if (existsSync(join(ROOT, rel)) && !force) throw new Error(`${rel} exists (use --force)`);
  for (const [rel, body] of files) {
    mkdirSync(dirname(join(ROOT, rel)), {recursive: true});
    writeFileSync(join(ROOT, rel), body);
    console.log('created', rel);
  }
  regenIndex();
  console.log('updated docs/lab-parts/README.md');
  console.log(`\nNext: npx tsx --test tests/lab-parts-contract.test.ts tests/lab-part-${kind}.test.ts   (the kind is already registered, no index to edit)`);
}
main();
