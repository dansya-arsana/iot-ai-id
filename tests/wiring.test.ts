import test from 'node:test';
import assert from 'node:assert/strict';
import {Engine} from '../services/api/engine.js';
import {Store} from '../services/api/store.js';
import {FixtureAgent} from '../services/orchestrator/fixture.js';
import {WiringChangeSchema} from '../packages/agent-tools/index.js';
const knowledge={retrieve:async()=>({status:'unavailable' as const,backend:'test',query:'',hits:[],error:'fixture'}),remember:async()=>({status:'unavailable' as const,backend:'test',error:'fixture'}),url:'test',request:async()=>({})};
async function setup(goal='BME280 OLED room monitor'){const store=new Store(':memory:'),engine=new Engine(store,new FixtureAgent(),knowledge),project=engine.create(goal);await engine.plan(project.id);return{store,engine,pid:project.id};}
function snapshot(engine:Engine,pid:string){const p=engine.project(pid),record=p.contracts.find((record:any)=>record.id===p.contractId);return{expectedContractId:p.contractId,expectedDraftId:p.activeDesign?.id??null,connections:record.contract.connections.map(({componentId,pin,boardPin}:any)=>({componentId,pin,boardPin}))};}
test('safe shared I2C wiring appends immutable contract and firmware without changing evidence',async()=>{
 const {engine,store,pid}=await setup();await engine.run(pid,'simulation');const before=engine.project(pid),original=JSON.stringify(before.contracts[0]),evidence=JSON.stringify(before.observations),input=snapshot(engine,pid);
 for(const wire of input.connections){if(wire.pin==='SDA')wire.boardPin='19';if(wire.pin==='SCL')wire.boardPin='18';}
 const draft=engine.reviseWiring(pid,input),after=engine.project(pid);assert.equal(draft.status,'executable');assert.equal(draft.source,'wiring');assert.equal(after.contracts.length,2);assert.equal(JSON.stringify(after.contracts[0]),original);assert.equal(JSON.stringify(after.observations),evidence);assert.match(after.firmwareArtifacts.at(-1).source,/Wire.begin\(19, 18\)/);assert.throws(()=>store.update('contracts',after.contracts[0]),/Immutable/);store.close();
});
test('electrical mistakes append blocked revisions, preserve snapshot and permit repair',async()=>{
 for(const kind of ['missing','split','reserved','strapping','rail','duplicate']){
  const {engine,store,pid}=await setup(),input=snapshot(engine,pid),good=structuredClone(input.connections);
  const sda=input.connections.find((wire:any)=>wire.pin==='SDA')!;
  if(kind==='missing')input.connections=input.connections.filter((wire:any)=>wire!==sda);
  if(kind==='split')sda.boardPin='19';if(kind==='reserved')sda.boardPin='6';if(kind==='strapping')sda.boardPin='0';
  if(kind==='rail')input.connections.find((wire:any)=>wire.pin==='VCC')!.boardPin='5V';
  if(kind==='duplicate')input.connections.push({...sda});
  const draft=engine.reviseWiring(pid,input);assert.equal(draft.status,'invalid',kind);assert.deepEqual(draft.connections,input.connections);assert.equal(engine.project(pid).firmwareArtifacts.length,1);await assert.rejects(engine.run(pid,'simulation'),/planning only/);
  const repaired=engine.reviseWiring(pid,{...snapshot(engine,pid),connections:good});assert.equal(repaired.status,'executable',kind);assert.equal(engine.project(pid).contracts.length,3);assert.equal(engine.project(pid).firmwareArtifacts.length,2);store.close();
 }
});
test('strict malformed unknown stale busy snapshots leave project unchanged',async()=>{
 const {engine,store,pid}=await setup(),input=snapshot(engine,pid),before=JSON.stringify(engine.project(pid));
 for(const mutate of [(v:any)=>{v.connections[0].role='power';},(v:any)=>{v.connections[0].componentId='unknown';},(v:any)=>{v.connections[0].pin='R1.1';},(v:any)=>{v.connections[0].boardPin='999';},(v:any)=>{v.expectedContractId=null;},(v:any)=>{v.expectedDraftId='00000000-0000-4000-8000-000000000000';},(v:any)=>{v.manifest={};},(v:any)=>{v.connections=Array(101).fill(v.connections[0]);}]){const value=structuredClone(input);mutate(value);assert.throws(()=>engine.reviseWiring(pid,value));assert.equal(JSON.stringify(engine.project(pid)),before);}
 engine.busy.add(pid);assert.throws(()=>engine.reviseWiring(pid,input),/already running/);engine.busy.delete(pid);assert.equal(JSON.stringify(engine.project(pid)),before);
 engine.reviseWiring(pid,input);const after=JSON.stringify(engine.project(pid));assert.throws(()=>engine.reviseWiring(pid,input),/conflict/);assert.equal(JSON.stringify(engine.project(pid)),after);assert.equal(WiringChangeSchema.safeParse({...input,recipe:{id:'other'}}).success,false);store.close();
});
test('catalog planning and unresolved intent cannot bypass regeneration through wiring',async()=>{
 const {engine,store,pid}=await setup();const revision=snapshot(engine,pid);engine.changeComponent(pid,{componentId:'led',operation:'add',expectedContractId:revision.expectedContractId,expectedDraftId:revision.expectedDraftId});assert.throws(()=>engine.reviseWiring(pid,snapshot(engine,pid)),/planning only/);store.close();
 const second=await setup(),original=second.engine.project.bind(second.engine);second.engine.project=(id:string)=>{const p=original(id);p.activeDesign={id:'00000000-0000-4000-8000-000000000000',status:'invalid',contractId:p.contractId,componentIds:['bme280','ssd1306'],intentUnresolved:['Unsupported requested behavior']};return p;};assert.throws(()=>second.engine.reviseWiring(second.pid,snapshot(second.engine,second.pid)),/unresolved intent/);second.store.close();
});
test('legacy invalid errors do not become intent; button internal pins and assembly stay trusted',async()=>{
 const {engine,store,pid}=await setup(),input=snapshot(engine,pid);input.connections.pop();engine.reviseWiring(pid,input);const original=engine.project.bind(engine);engine.project=(id:string)=>{const p=original(id);delete p.activeDesign.intentUnresolved;return p;};const repair=snapshot(engine,pid);repair.connections.push({componentId:'ssd1306',pin:'SCL',boardPin:'22'});assert.equal(engine.reviseWiring(pid,repair).status,'executable');store.close();
 const button=await setup('ESP32 button controls LED'),before=button.engine.project(button.pid),value=snapshot(button.engine,button.pid);assert.equal(button.engine.reviseWiring(button.pid,value).status,'executable');const after=button.engine.project(button.pid);assert.deepEqual(after.contracts.at(-1).contract.components,before.contracts[0].contract.components);value.connections[0].pin='R1.1';assert.throws(()=>button.engine.reviseWiring(button.pid,{...value,...snapshot(button.engine,button.pid),connections:value.connections}),/Unknown wiring component pin/);button.store.close();
});
