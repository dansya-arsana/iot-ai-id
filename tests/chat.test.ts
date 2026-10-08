import test from 'node:test';
import assert from 'node:assert/strict';
import {Engine} from '../services/api/engine.js';
import {Store} from '../services/api/store.js';
import {episodeContentHash} from '../packages/episodes/index.js';
const plan={supported:true,recipe:'esp32-room-monitor' as const,buttonPin:27,ledPin:26,title:'Monitor',summary:'Pins revised',sda:21,scl:22,sensorAddress:118,displayAddress:60,steps:['Wire safely'],clarification:''};
const knowledge={retrieve:async()=>({status:'unavailable' as const,backend:'test',query:'',hits:[],error:'fixture'}),remember:async()=>({status:'unavailable' as const,backend:'test',error:'fixture'}),url:'test',request:async()=>({})};
function setup(){const store=new Store(':memory:');let context:any;const agent={plan:async()=>({plan,route:{fixture:true},provider:'fixture'}),revise:async(goal:string)=>({plan:{...plan,sda:18,supported:!goal.includes('distance'),clarification:'Distance recipe unavailable'},route:{fixture:true},provider:'fixture'}),diagnose:async(_goal:string,value:unknown)=>{context=value;return{diagnosis:{category:'unknown' as const,summary:'Inspect observed logs',checks:[],repair:'Power off before inspection',retryAllowed:false},route:{fixture:true},provider:'fixture'};}};return{store,engine:new Engine(store,agent,{...knowledge}),context:()=>context};}
test('chat creates immutable pin revision and stale revision is refused',async()=>{const {store,engine}=setup();const p=engine.create('ESP32 BME280 OLED');await engine.plan(p.id);await engine.run(p.id,'simulation');const before=engine.project(p.id),contractId=before.contractId,artifact=JSON.stringify(before.observations);await engine.chat(p.id,{message:'Move SDA to18',purpose:'design',expectedContractId:contractId,expectedDraftId:null});const after=engine.project(p.id);assert.equal(after.contracts.length,2);assert.equal(after.contracts[1].contract.connections.find((w:any)=>w.role==='sda').boardPin,'18');assert.equal(JSON.stringify(after.observations),artifact);assert.notEqual(episodeContentHash(before),episodeContentHash(after));await assert.rejects(engine.chat(p.id,{message:'stale',purpose:'design',expectedContractId:contractId,expectedDraftId:null}),/conflict/);assert.throws(()=>store.update('chat_messages',after.chatMessages[0]),/Immutable/);store.close();});
test('unsupported chat and catalog edits cannot execute existing golden contract',async()=>{const {store,engine}=setup();const p=engine.create('ESP32 BME280 OLED');await engine.plan(p.id);const cid=engine.project(p.id).contractId;await engine.chat(p.id,{message:'distance alarm',purpose:'design',expectedContractId:cid,expectedDraftId:null});assert.equal(engine.project(p.id).activeDesign.status,'planning_only');await assert.rejects(engine.run(p.id,'simulation'),/planning only/);await assert.rejects(engine.run(p.id,'physical','none','fake'),/planning only/);const draft=engine.changeComponent(p.id,{componentId:'led',operation:'add',expectedContractId:cid,expectedDraftId:engine.project(p.id).activeDesign.id});assert.ok(draft.componentIds.includes('led'));await assert.rejects(engine.run(p.id,'physical','none','fake'),/planning only/);assert.equal(engine.project(p.id).firmwareArtifacts.length,1);store.close();});
test('busy gate and invalid pin cannot create executable revisions',async()=>{const {store,engine}=setup();const p=engine.create('ESP32 BME280 OLED');await engine.plan(p.id);const cid=engine.project(p.id).contractId;engine.busy.add(p.id);await assert.rejects(engine.chat(p.id,{message:'change',purpose:'design',expectedContractId:cid,expectedDraftId:null}),/already running/);engine.busy.delete(p.id);engine.agent.revise=async()=>({plan:{...plan,sda:6},route:{},provider:'fixture'});await engine.chat(p.id,{message:'SDA6',purpose:'design',expectedContractId:cid,expectedDraftId:null});assert.equal(engine.project(p.id).activeDesign.status,'invalid');await assert.rejects(engine.run(p.id,'simulation'),/planning only/);store.close();});
test('debug complaint uses current experiment evidence without changing contract',async()=>{const {store,engine,context}=setup();const p=engine.create('ESP32 BME280 OLED');await engine.plan(p.id);await engine.run(p.id,'simulation');const before=engine.project(p.id);await engine.chat(p.id,{message:'Display looks blank',purpose:'debug',expectedContractId:before.contractId,expectedDraftId:null});assert.equal(context().latestExperiment.id,before.experiments[0].id);assert.equal(context().observations.length,6);assert.equal(context().complaint,'Display looks blank');assert.equal(engine.project(p.id).contracts.length,1);await engine.chat(p.id,{message:'SDA18',purpose:'design',expectedContractId:before.contractId,expectedDraftId:null});await assert.rejects(engine.chat(p.id,{message:'blank',purpose:'debug',expectedContractId:engine.project(p.id).contractId,expectedDraftId:engine.project(p.id).activeDesign.id}),/Current contract experiment/);store.close();});
test('inflight provider holds edit lock until revision finishes',async()=>{const {store,engine}=setup();const p=engine.create('ESP32 BME280 OLED');await engine.plan(p.id);const cid=engine.project(p.id).contractId;let release:()=>void=()=>{};engine.agent.revise=()=>new Promise(resolve=>{release=()=>resolve({plan,route:{},provider:'fixture'});});const pending=engine.chat(p.id,{message:'Change layout',purpose:'design',expectedContractId:cid,expectedDraftId:null});await assert.rejects(engine.chat(p.id,{message:'Concurrent edit',purpose:'design',expectedContractId:cid,expectedDraftId:null}),/already running/);assert.throws(()=>engine.changeComponent(p.id,{componentId:'led',operation:'add',expectedContractId:cid,expectedDraftId:null}),/already running/);release();await pending;assert.equal(engine.busy.size,0);store.close();});


test('fixture pin revisions honor the latest explicit request in conversation history',async()=>{
 const {FixtureAgent}=await import('../services/orchestrator/fixture.js');
 const result=await new FixtureAgent().revise('SDA GPIO21 SCL GPIO22\nLatest: use SDA GPIO25 SCL GPIO26');
 assert.equal(result.plan.sda,25);assert.equal(result.plan.scl,26);
});

test('chat retrieves catalog-only knowledge, records live/degraded context and never remembers',async()=>{
 const {store,engine}=setup();const p=engine.create('PRIVATE_GOAL BME280 OLED');await engine.plan(p.id);await engine.run(p.id,'simulation');
 const queries:string[]=[];let remembers=0;let providerContext:any;
 engine.knowledge.retrieve=async(query:string,scope?:string)=>{assert.equal(scope,'catalog');queries.push(query);return{status:'live',backend:'test',query,hits:[{uri:'curated',text:'I2C guidance'}]} as any;};
 engine.knowledge.remember=async()=>{remembers++;throw new Error('Chat must not share');};
 engine.agent.revise=async(_goal:string,value:unknown)=>{providerContext=value;return{plan,route:{},provider:'fixture',intent:{componentIds:['bme280','ssd1306'],desiredBehavior:'PRIVATE_BEHAVIOR',sizeConstraint:'PRIVATE_SIZE',unresolved:[]}};};
 const before=engine.project(p.id);await engine.chat(p.id,{message:'PRIVATE_CONVERSATION BME280',purpose:'design',expectedContractId:before.contractId,expectedDraftId:null});
 assert.equal(providerContext.knowledge.status,'live');assert.equal(providerContext.knowledge.hits[0].text,'I2C guidance');
 let current=engine.project(p.id);assert.equal(current.activeDesign.desiredBehavior,'PRIVATE_BEHAVIOR');assert.equal(current.activeDesign.sizeConstraint,'PRIVATE_SIZE');
 engine.agent.revise=async()=>({plan,route:{},provider:'fixture'});
 engine.knowledge.retrieve=async(query:string,scope?:string)=>{assert.equal(scope,'catalog');queries.push(query);throw new Error('PRIVATE_BACKEND_ERROR');};
 await engine.chat(p.id,{message:'PRIVATE_NEXT',purpose:'design',expectedContractId:current.contractId,expectedDraftId:current.activeDesign.id});
 current=engine.project(p.id);assert.equal(current.activeDesign.desiredBehavior,'PRIVATE_BEHAVIOR');assert.equal(current.activeDesign.sizeConstraint,'PRIVATE_SIZE');
 assert.equal(current.knowledge.at(-1).status,'unavailable');assert.deepEqual(current.knowledge.at(-1).hits,[]);
 // Debug after a design revision must stop before any external retrieval.
 const count=queries.length;await assert.rejects(engine.chat(p.id,{message:'PRIVATE_COMPLAINT',purpose:'debug',expectedContractId:current.contractId,expectedDraftId:current.activeDesign.id}),/Current contract experiment/);assert.equal(queries.length,count);
 assert.equal(queries.filter(query=>query!=='esp32-devkit bme280 ssd1306').length,0);assert.equal(remembers,0);
 engine.knowledge.remember=async()=>{remembers++;return{status:'unavailable',backend:'test',error:'fixture'};};
 await engine.run(p.id,'simulation');queries.length=0;remembers=0;
 engine.knowledge.retrieve=async(query:string,scope?:string)=>{assert.equal(scope,'catalog');queries.push(query);return{status:'unavailable',backend:'test',query,hits:[],error:'fixture'};};
 engine.agent.diagnose=async(_goal:string,value:unknown)=>{providerContext=value;return{diagnosis:{category:'unknown',summary:'Inspect',checks:[],repair:'Check power',retryAllowed:false},route:{},provider:'fixture'};};
 await engine.chat(p.id,{message:'PRIVATE_COMPLAINT',purpose:'debug',expectedContractId:current.contractId,expectedDraftId:current.activeDesign.id});
 assert.equal(providerContext.knowledge.status,'unavailable');assert.equal(providerContext.complaint,'PRIVATE_COMPLAINT');assert.equal(engine.project(p.id).knowledge.at(-1).operation,'retrieve_chat_debug');
 assert.equal(remembers,0);assert.equal(queries.filter(query=>query!=='esp32-devkit bme280 ssd1306').length,0);
 store.close();
});

test('unresolved requested capability remains planning-only even with a supported plan',async()=>{
 const {store,engine}=setup();const p=engine.create('BME280 OLED');await engine.plan(p.id);
 engine.agent.revise=async()=>({plan,route:{},provider:'fixture',intent:{componentIds:['bme280','ssd1306'],desiredBehavior:'Teleport readings',sizeConstraint:'2 cm',unresolved:['Teleportation is unsupported']}});
 await engine.chat(p.id,{message:'Teleport',purpose:'design',expectedContractId:engine.project(p.id).contractId,expectedDraftId:null});
 const draft=engine.project(p.id).activeDesign;assert.equal(draft.status,'planning_only');assert.equal(draft.desiredBehavior,'Teleport readings');assert.deepEqual(draft.unresolved,['Teleportation is unsupported']);await assert.rejects(engine.run(p.id,'simulation'),/planning only/);store.close();
});

test('awaited knowledge retrieval holds the design edit lock',async()=>{
 const {store,engine}=setup();const p=engine.create('ESP32 BME280 OLED');await engine.plan(p.id);const cid=engine.project(p.id).contractId;
 let release:()=>void=()=>{};engine.knowledge.retrieve=()=>new Promise(resolve=>{release=()=>resolve({status:'unavailable',backend:'test',query:'',hits:[],error:'fixture'});});
 const pending=engine.chat(p.id,{message:'Revise',purpose:'design',expectedContractId:cid,expectedDraftId:null});
 await assert.rejects(engine.chat(p.id,{message:'Concurrent',purpose:'design',expectedContractId:cid,expectedDraftId:null}),/already running/);
 assert.throws(()=>engine.changeComponent(p.id,{componentId:'led',operation:'add',expectedContractId:cid,expectedDraftId:null}),/already running/);
 release();await pending;assert.equal(engine.busy.size,0);store.close();
});


test('catalog retrieval targets the curated resource rather than workspace memories',async()=>{
 const {OpenVikingKnowledge}=await import('../services/knowledge/index.js');const adapter=new OpenVikingKnowledge();let target:string|undefined;
 adapter.request=async(_path:string,options:RequestInit={})=>{target=JSON.parse(String(options.body)).target_uri;return{resources:[{uri:'viking://resources/iot-ai-id/private-contract'}],memories:[{uri:'viking://memories/private'}]};};
 const catalog=await adapter.retrieve('esp32-devkit bme280','catalog');assert.deepEqual(catalog.hits,[]);assert.equal(target,'viking://resources/iot-ai-id/hardware-catalog');
 await adapter.retrieve('legacy operational query');assert.equal(target,'viking://resources/iot-ai-id');
});

test('corrected invalid wiring does not retain stale validation errors as requested intent',async()=>{
 const {store,engine}=setup();const p=engine.create('BME280 OLED');await engine.plan(p.id);
 engine.agent.revise=async()=>({plan:{...plan,sda:6},route:{},provider:'fixture'});
 await engine.chat(p.id,{message:'SDA6',purpose:'design',expectedContractId:engine.project(p.id).contractId,expectedDraftId:null});
 const before=engine.project(p.id),invalid=before.activeDesign;assert.equal(invalid.status,'invalid');assert.ok(invalid.unresolved.length);
 // Simulate a legacy invalid draft whose validation errors predate intentUnresolved.
 const project=engine.project.bind(engine);engine.project=(projectId:string)=>{const snapshot=project(projectId);if(snapshot.activeDesign?.status==='invalid')delete snapshot.activeDesign.intentUnresolved;return snapshot;};
 engine.agent.revise=async()=>({plan,route:{},provider:'fixture'});
 await engine.chat(p.id,{message:'Correct to SDA21',purpose:'design',expectedContractId:before.contractId,expectedDraftId:invalid.id});
 const after=engine.project(p.id);assert.equal(after.activeDesign.status,'executable');assert.deepEqual(after.activeDesign.unresolved,[]);assert.deepEqual(after.designDrafts[0],invalid);store.close();
});

test('catalog hit guard rejects normalized traversal and ambiguous resource URIs',async()=>{
 const {OpenVikingKnowledge}=await import('../services/knowledge/index.js');const adapter=new OpenVikingKnowledge();const base='viking://resources/iot-ai-id/hardware-catalog';const read:string[]=[];
 adapter.request=async(path:string)=>{if(path.includes('/search/'))return{resources:[base+'/../private',base+'/./private',base+'/%2e%2e/private',base+'/note?uri=private',base+'/note#private',base+'/note\\private',base+'/note%5cprivate',base+'/safe'].map(uri=>({uri}))};read.push(path);return{content:'curated'};};
 const result=await adapter.retrieve('bme280','catalog');assert.deepEqual(result.hits.map(hit=>hit.uri),[base+'/safe']);assert.equal(read.length,1);
});
