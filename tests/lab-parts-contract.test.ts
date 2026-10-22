/**
 * Contract every registered part kind must satisfy (visual PartModule + sim DeviceDef + copy).
 * Iterates the auto-discovered registries, so a new part or device file is checked the moment it exists.
 */
import test from 'node:test';
import assert from 'node:assert/strict';

// minimal DOM so canvas-textured parts build headless
const ctx2d=new Proxy({},{get:(_t,k)=>k==='canvas'?{}:k==='measureText'?()=>({width:10}):()=>ctx2d,set:()=>true});
const g=globalThis as unknown as {document?:unknown};
g.document??={createElement:()=>({width:0,height:0,getContext:()=>ctx2d,style:{}})};

const {registry,partModule}=await import('../apps/web/src/lab/scene/parts/index.js');
const {deviceRegistry,createDevice}=await import('../apps/web/src/lab/sim/devices/index.js');
const {partCopy,PARTS_COPY}=await import('../apps/web/src/lab/parts-copy.js');
const {PART_PINS,UNO_PINS}=await import('../apps/web/src/lab/contract.js');
const {PIN_COLS}=await import('../apps/web/src/lab/scene/layout.js');
const {DEFAULT_CATALOG}=await import('../apps/web/src/lab/circuit-spec.js');
const {disposeObject}=await import('../apps/web/src/lab/scene/materials.js');
const {EMPTY}=await import('../apps/web/src/lab/sim/peripherals.js');
import type {BoardPin,PartSpec,PartState,UnoPin} from '../apps/web/src/lab/contract.js';
import type {DeviceDef,Env} from '../apps/web/src/lab/sim/devices/index.js';

const PROTOCOLS=['gpio','adc','pwm','pulse','i2c','onewire','uart','switch','spi','twowire','ws2812'];
const text=(c:{en:string;id:string}|undefined):boolean=>!!c&&typeof c.en==='string'&&typeof c.id==='string'&&c.en.trim().length>0&&c.id.trim().length>0;
const finite3=(a:readonly number[]):boolean=>a.length===3&&a.every(Number.isFinite);
const kinds=[...new Set([...registry.kinds(),...deviceRegistry.kinds()])].sort();

function fakeEnv():Env{
 const events:{at:number;cb:()=>void}[]=[];
 return {setPin(){},setAdc(){},now:()=>0,schedule:(c,cb)=>{events.push({at:c,cb});},
  pinLevel:()=>0,pinMode:()=>'input',watchLine(){},attachI2c(){},attachSpi(){},tapUart(){},uartSend(){}};
}
/** Wire each pin of a part to a plausible board pin by its electrical role. */
function wire(kind:string,def:DeviceDef):PartSpec{
 const mod=partModule(kind);
 const net:Partial<Record<string,BoardPin>>={};
 let d=2,a=0;
 for(const p of def.pins){
  const t=mod.pins[p]?.type;
  net[p]=t==='power'?'5V':t==='ground'?'GND':t==='analog-out'?(`A${a++%6}` as UnoPin):(`D${d++}` as UnoPin);
 }
 const props:Record<string,string|number|boolean>={};
 for(const i of def.inputs)if(i.type!=='terminal')props[i.key]=i.default;
 return {id:kind+'1',kind,net,props:{...def.defaults,...props}};
}

test('registries are not empty and cover the builtin kinds',()=>{
 for(const k of ['led','hcsr04','servo','dht22'])assert.ok(kinds.includes(k),k);
});

for(const kind of kinds){
 test(`kind ${kind}: part and device are both registered and linked by kind id`,()=>{
  assert.ok(registry.has(kind),`parts/${kind}.ts must export a PartModule with kind '${kind}'`);
  assert.ok(deviceRegistry.has(kind),`sim/devices/${kind}.ts must export device=defineDevice({kind:'${kind}'})`);
  assert.deepEqual(PART_PINS[kind],[...deviceRegistry.get(kind)!.pins],'PART_PINS filled from the device');
  assert.ok(DEFAULT_CATALOG.kinds.includes(kind),'validator knows the kind');
 });
 test(`kind ${kind}: pins match between PartModule and DeviceModel, anchors are finite`,()=>{
  const mod=partModule(kind),def=deviceRegistry.get(kind)!;
  assert.deepEqual(Object.keys(mod.pins),[...def.pins],'pin names and order');
  for(const [n,p] of Object.entries(mod.pins)){assert.ok(finite3(p.at),`pin ${n} anchor`);assert.ok(typeof p.type==='string');}
  for(const c of mod.callouts)assert.ok(finite3(c.at),`callout ${c.id} anchor`);
  if(def.holes){
   // pins beyond the holes are terminals (screw blocks, pads) that never sit in the breadboard: they can only take wires
   assert.ok(def.holes.length<=def.pins.length&&def.holes.length>0,'at most one hole column per pin');
   assert.deepEqual([...mod.footprint.holes],[...def.holes]);assert.equal(mod.footprint.onBoard,true);
   assert.deepEqual(PIN_COLS[kind],[...def.holes]);
  }else assert.equal(mod.footprint.onBoard,kind in PIN_COLS);
  assert.ok(PROTOCOLS.includes(def.protocol),`protocol ${def.protocol}`);
 });
 test(`kind ${kind}: build() works headless and apply() accepts the device state`,()=>{
  const mod=partModule(kind),def=deviceRegistry.get(kind)!;
  const spec=wire(kind,def);
  const group=mod.build({...spec.props},{reducedMotion:false});
  assert.ok(group&&typeof group.add==='function');
  const models=new Map<string,ReturnType<typeof createDevice>>();
  const m=createDevice(spec,{...spec.props},fakeEnv(),()=>[...models.values()]);
  models.set(spec.id,m);
  m.update({samples:EMPTY(),dtSec:0.016,cycles:1000});
  const st:PartState=m.state();
  if(!def.legacyState){
   assert.equal(st.kind,'ext');
   if(st.kind==='ext'){assert.equal(st.type,kind);for(const [k,v] of Object.entries(st.v))assert.ok(v===null||['number','boolean','string'].includes(typeof v),`state.${k} is a scalar`);}
  }
  assert.doesNotThrow(()=>{mod.apply(group,st,0);mod.apply(group,st,16);},'apply(state)');
  assert.doesNotThrow(()=>mod.apply(group,{kind:'passive'},16),'apply ignores foreign states');
  const edge=m.onEdge;
  if(edge)assert.doesNotThrow(()=>{for(const p of UNO_PINS){edge(p,1,10);edge(p,0,20);}},'onEdge on any pin');
  disposeObject(group);
 });
 test(`kind ${kind}: copy and callouts exist in English and Indonesian`,()=>{
  const mod=partModule(kind);
  assert.ok(text(mod.name),'module name');
  const copy=PARTS_COPY[kind];
  assert.ok(copy,`PARTS_COPY (or the device's copy) has an entry for ${kind}`);
  assert.ok(text(copy.name)&&text(copy.desc),'copy name/desc en+id');
  assert.notEqual(partCopy(kind).desc.en,'Part of the board.');
  for(const c of mod.callouts){assert.ok(c.id);assert.ok(text(c.text),`callout ${c.id}`);}
  for(const p of Object.values(mod.pins))if(p.label)assert.ok(text(p.label));
 });
 test(`kind ${kind}: inputs schema is valid and matches the popover`,()=>{
  const mod=partModule(kind),def=deviceRegistry.get(kind)!;
  const keys=new Set<string>();
  for(const i of def.inputs){
   assert.ok(/^[A-Za-z][A-Za-z0-9]*$/.test(i.key),`key ${i.key}`);
   assert.ok(!keys.has(i.key),`duplicate key ${i.key}`);keys.add(i.key);
   assert.ok(text(i.label),`${i.key} label`);
   if(i.type==='range'){assert.ok(i.min<i.max&&i.step>0&&i.default>=i.min&&i.default<=i.max,`${i.key} range`);}
   else if(i.type==='terminal'){assert.ok(i.input&&i.log&&text(i.placeholder),`${i.key} terminal`);}
   else if(i.type==='toggle')assert.equal(typeof i.default,'boolean');
   else{assert.ok(i.options.length>0&&i.options.some(o=>o.value===i.default),`${i.key} choice`);for(const o of i.options)assert.ok(text(o.label));}
  }
  if(!def.legacyState)for(const c of mod.interact?.controls??[])if(c.type!=='action')assert.ok(keys.has(c.key),`popover control ${c.key} is declared in device.inputs`);
  if(!def.legacyState&&def.inputs.length)assert.ok((mod.interact?.controls??[]).some(c=>c.type!=='action'),'inputs reach the popover');
 });
 test(`kind ${kind}: part-to-part pins, supply declarations and bus pins refer to real pins`,()=>{
  const def=deviceRegistry.get(kind)!;
  const has=(p:string,what:string):void=>{assert.ok(def.pins.includes(p),`${what} names pin '${p}', but ${kind} has ${def.pins.join(', ')||'no pins'}`);};
  if(def.power){
   for(const p of def.power.rail)has(p,'power.rail');
   assert.ok(def.power.min<def.power.max&&def.power.min>=0,'power.min < power.max');
  }
  for(const s of def.supplies?.({...def.defaults})??[]){has(s.pos,'supply.pos');has(s.neg,'supply.neg');assert.ok(Number.isFinite(s.volts)&&s.volts>=0,'supply volts');}
  for(const r of def.regulators?.({...def.defaults})??[]){has(r.in,'regulator.in');has(r.out,'regulator.out');has(r.gnd,'regulator.gnd');assert.ok(r.volts>0&&r.dropout>=0);}
  const spec=wire(kind,def);
  const spis:{csPin:UnoPin|null}[]=[];
  const env={...fakeEnv(),attachSpi:(b:{csPin:UnoPin|null})=>{spis.push(b);}};
  const m=createDevice(spec,{...spec.props},env,()=>[]);
  for(const sw of m.switches?.()??[]){has(sw.a,'switches()');has(sw.b,'switches()');}
  for(const p of def.pins){const d=m.output?.(p);if(d)assert.ok(Number.isFinite(d.volts),`output(${p}) volts`);}
  if(def.protocol==='spi')assert.ok(spis.length>0,'an spi device must expose model.spi (attached to the SPI bus)');
 });
}
