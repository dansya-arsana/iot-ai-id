import {ChatInputSchema,ComponentChangeSchema,WiringChangeSchema,type ChatInput,type ComponentChange,type WiringChange} from '../../packages/agent-tools/index.js';
import {z} from 'zod';
import {CHECKS} from '../../packages/hardware-contract/index.js';
import {randomUUID} from 'node:crypto';
import {createGoldenContract,createButtonLedContract,components,mentionedComponentIds} from '../../packages/component-catalog/index.js';
import type {HardwareContract} from '../../packages/hardware-contract/index.js';
import {generateFirmware} from '../../packages/hardware-contract/firmware.js';
import {contractHash,hashText,canonicalJson,verifyEvidence,type RunIdentity,type Evidence} from '../../packages/evidence/index.js';
import {validateContract} from '../../packages/validator/index.js';
import {recipes} from '../../packages/recipe-registry/index.js';
import {Store} from './store.js';
import {JevProvider,type AgentProvider} from '../orchestrator/provider.js';
import {OpenVikingKnowledge} from '../knowledge/index.js';
import {LocalRuntimeClient} from '../../packages/runtime-client/index.js';
import {ProjectMetadataSchema,HumanActionSchema,EnvironmentRecordSchema,RightsRecordSchema,assembleEpisode,episodeContentHash,ExportPurposeSchema,type ExportPurpose,type ProjectMetadata,type HumanActionInput,type EnvironmentInput,type RightsInput} from '../../packages/episodes/index.js';
import {TemplateSimulationAdapter,WokwiCliAdapter,type SimulationAdapter,type SimulationBackend} from '../../packages/simulator-client/index.js';
const RuntimeOutputSchema=z.object({source:z.enum(['physical','simulation']),checks:z.array(z.object({check:z.enum(CHECKS),passed:z.boolean(),data:z.record(z.string(),z.unknown())})).max(6),rawSerial:z.array(z.string()).max(200).optional(),simulated:z.boolean().optional(),runtimeError:z.string().optional()}).passthrough();
export const now=()=>new Date().toISOString();
export const id=()=>randomUUID();
export class Engine {
 busy=new Set<string>();
 ports=new Set<string>();
 constructor(readonly store:Store,readonly agent:AgentProvider=new JevProvider(),readonly knowledge=new OpenVikingKnowledge(),readonly runtime=new LocalRuntimeClient(),readonly simulator:SimulationAdapter=new TemplateSimulationAdapter()){
 for(const experiment of store.list('experiments'))if(experiment.status==='running'){store.update('experiments',{...experiment,status:'ERROR',completedAt:now(),error:'Runtime interrupted by API restart'});const project=store.list('projects').find(p=>store.list('experiments',p.id).some(e=>e.id===experiment.id));if(project){store.insert('failures',project.id,{id:id(),experimentId:experiment.id,category:'unknown',errors:['Runtime interrupted by API restart'],createdAt:now()});store.event(project.id,'experiment.interrupted',{experimentId:experiment.id});}}
 for(const project of store.list('projects'))if(['planning','running'].includes(project.status)){this.change(project.id,{status:'error',error:'Operation interrupted by API restart'});store.event(project.id,'operation.interrupted',{previousStatus:project.status});}
 }
 project(projectId:string){const project=this.store.get('projects',projectId);if(!project)throw new Error('Project not found');return{...project,entryPoint:project.entryPoint??'build',chatMessages:this.store.list('chat_messages',projectId),designDrafts:this.store.list('design_drafts',projectId),activeDesign:this.store.list('design_drafts',projectId).at(-1)??null,humanActions:this.store.list('human_actions',projectId),environmentRecords:this.store.list('environment_records',projectId),rightsRecords:this.store.list('rights_records',projectId),contracts:this.store.list('contracts',projectId),agentRuns:this.store.list('agent_runs',projectId),firmwareArtifacts:this.store.list('firmware_artifacts',projectId),experiments:this.store.list('experiments',projectId),observations:this.store.list('observations',projectId),failures:this.store.list('failures',projectId),repairs:this.store.list('repairs',projectId),verifications:this.store.list('verifications',projectId),knowledge:this.store.list('knowledge_receipts',projectId),events:this.store.events(projectId),busy:this.busy.has(projectId)};}
 change(projectId:string,patch:Record<string,unknown>){const p=this.store.get('projects',projectId);this.store.update('projects',{...p,...patch,updatedAt:now()});}
 receipt(projectId:string,operation:string,value:unknown){this.store.insert('knowledge_receipts',projectId,{id:id(),operation,...value as object,createdAt:now()});}
 create(goal:string,metadata:Partial<ProjectMetadata>={}){const entry=ProjectMetadataSchema.parse(metadata);const project={id:id(),goal,...entry,title:'New hardware build',status:'planning',createdAt:now(),updatedAt:now()};this.store.insert('projects',project.id,project);this.store.event(project.id,'project.created',{goal,...entry});return project;}
 references(projectId:string,input:{experimentId?:string;contractId?:string}) {
  if(!this.store.get('projects',projectId))throw new Error('Project not found');
  for(const [key,table] of [['experimentId','experiments'],['contractId','contracts']] as const) {
   if(input[key]&&!this.store.list(table,projectId).some(row=>row.id===input[key])) {
    throw new Error('Artifact reference does not belong to this project');
   }
  }
 }
 recordAction(projectId:string,value:HumanActionInput) {
  const input=HumanActionSchema.parse(value);
  this.references(projectId,input);
  const record={id:id(),...input,actorId:input.provenance==='test_fixture'?'test-fixture':'local-operator',source:input.provenance,createdAt:now()};
  this.store.transaction(()=>{
   this.store.insert('human_actions',projectId,record);
   this.store.event(projectId,'human.action',{actionId:record.id,...input});
  });
  return record;
 }
 recordEnvironment(projectId:string,value:EnvironmentInput) {
  const input=EnvironmentRecordSchema.parse(value);
  this.references(projectId,input);
  const record={id:id(),...input,actorId:input.provenance==='test_fixture'?'test-fixture':'local-operator',createdAt:now()};
  this.store.transaction(()=>{
   this.store.insert('environment_records',projectId,record);
   this.store.event(projectId,'environment.reported',{environmentId:record.id,...input});
  });
  return record;
 }
 recordRights(projectId:string,value:RightsInput) {
  const input=RightsRecordSchema.parse(value);
  this.references(projectId,{});
  const record={id:id(),...input,reviewedContentHash:input.reviewed?episodeContentHash(this.project(projectId)):undefined,policyVersion:'episode-rights-v1',source:'local operator attestation; authority and consent not independently verified',createdAt:now()};
  this.store.transaction(()=>{
   this.store.insert('rights_records',projectId,record);
   this.store.event(projectId,'rights.recorded',{rightsId:record.id,purpose:record.purpose,withdrawn:record.withdrawn});
  });
  return record;
 }
 episode(projectId:string,purpose:ExportPurpose='local') {
  this.references(projectId,{});
  return assembleEpisode(this.project(projectId),ExportPurposeSchema.parse(purpose),now());
 }
 async simulationCapabilities() {
  return [await this.simulator.capabilities(),await new WokwiCliAdapter().capabilities()];
 }
 async selectedSimulator(backend:SimulationBackend) {
  const selected=backend==='wokwi-cli'?new WokwiCliAdapter():this.simulator;
  const capability=await selected.capabilities();
  if(capability.backend!==backend||!capability.available||!capability.supported) {
   throw new Error('Simulator unavailable: '+capability.reason);
  }
  return selected;
 }
 assertRevision(projectId:string,input:{expectedContractId:string|null;expectedDraftId?:string|null}) {
  const project=this.project(projectId);
  if(this.busy.has(projectId))throw new Error('Project operation already running');
  if((project.contractId??null)!==input.expectedContractId||(input.expectedDraftId!==undefined&&(project.activeDesign?.id??null)!==input.expectedDraftId))throw new Error('Design version conflict; refresh before editing');
  return project;
 }
 assertExecutable(projectId:string) {
  const project=this.project(projectId);
  if(project.activeDesign&&project.activeDesign.status!=='executable')throw new Error('Active design is planning only; execution unsupported');
  return project;
 }
 async chat(projectId:string,value:ChatInput) {
  const input=ChatInputSchema.parse(value),project=this.assertRevision(projectId,input);
  this.busy.add(projectId);
  const message={id:id(),role:'user',purpose:input.purpose,message:input.message,contractId:project.contractId??null,createdAt:now()};
  this.store.insert('chat_messages',projectId,message);
  try {
   const latest=project.experiments.at(-1);
   const conversation=this.store.list('chat_messages',projectId).filter(m=>m.role==='user'&&m.purpose!=='debug').map(m=>m.message).slice(-12);
   const goal=project.goal+'\nRequested revisions in order (latest supersedes earlier conflicting values):\n'+conversation.join('\n');
   const currentContract=project.contracts.find((c:any)=>c.id===project.contractId)?.contract;
   if(input.purpose==='debug'&&(!latest||latest.contractId!==project.contractId||project.activeDesign&&project.activeDesign.status!=='executable'))throw new Error('Current contract experiment required for grounded debugging');
   // Only catalog identifiers and fixed verifier names may cross the knowledge boundary.
   const catalogIds=new Set(components.map(c=>c.id));
   const selectedIds=[...new Set([...(project.activeDesign?.componentIds??[]),...(currentContract?.components.map((c:any)=>c.manifest.id)??[]),...mentionedComponentIds(goal)])].filter(cid=>catalogIds.has(cid)).sort();
   const checkNames=new Set(recipes.flatMap(recipe=>recipe.checks));
   const failedChecks=input.purpose==='debug'?project.observations.filter((o:any)=>o.evidence.experimentId===latest?.id&&!o.evidence.passed&&checkNames.has(o.evidence.check)).map((o:any)=>o.evidence.check):[];
   const query=['esp32-devkit',...selectedIds,...new Set(failedChecks)].join(' ');
   let knowledgeContext;
   try{knowledgeContext=await this.knowledge.retrieve(query,'catalog');}catch{knowledgeContext={status:'unavailable' as const,backend:'OpenViking',query,hits:[],error:'Knowledge unavailable'};}
   this.receipt(projectId,'retrieve_chat_'+input.purpose,knowledgeContext);
   const context={knowledge:knowledgeContext,currentContractRecordId:project.contractId,currentContractHash:project.contracts.find((c:any)=>c.id===project.contractId)?.hash,currentEvidenceIdentityMatches:latest?.contractId===project.contractId,currentContract:project.contracts.find((c:any)=>c.id===project.contractId)?.contract,currentDraft:project.activeDesign,latestExperiment:latest,observations:project.observations.filter((o:any)=>o.evidence.experimentId===latest?.id).map((o:any)=>o.evidence),catalog:components.map(c=>({id:c.id,name:c.name,support:c.support})),conversation};
   if(input.purpose==='debug'){
    const result=await this.agent.diagnose(project.goal,{...context,complaint:input.message,mode:latest.mode});
    const reply={id:id(),role:'assistant',message:result.diagnosis.summary+'\n'+result.diagnosis.repair,experimentId:latest.id,contractId:project.contractId,createdAt:now()};
    this.store.insert('agent_runs',projectId,{id:id(),kind:'chat_diagnosis',experimentId:latest.id,...result,createdAt:now()});
    this.store.insert('chat_messages',projectId,reply);
    this.store.event(projectId,'chat.diagnosed',{experimentId:latest.id,messageId:reply.id});
    return{message:reply,design:project.activeDesign,diagnosis:result.diagnosis};
   }
   const result:{plan:import('../orchestrator/provider.js').Plan;route:unknown;provider:string;intent?:{componentIds:string[];desiredBehavior:string;sizeConstraint:string;unresolved:string[]}}=await(this.agent.revise?.(goal,context)??this.agent.plan(goal,context));
   this.store.insert('agent_runs',projectId,{id:id(),kind:'revision',...result,createdAt:now()});
   let draft:any;
   const selection=result.intent?.componentIds??project.activeDesign?.componentIds;
   const executableSelections:string[][]=[['bme280','ssd1306'],['button-pullup-10k','led-series-330']];
   if(selection&&!(selection.length===2&&executableSelections.some(pair=>pair.every(cid=>selection.includes(cid))))){result.plan={...result.plan,supported:false,clarification:'Selected catalog components do not have an executable recipe.'};}
   const desiredBehavior=result.intent?.desiredBehavior??project.activeDesign?.desiredBehavior??input.message;
   const sizeConstraint=result.intent?.sizeConstraint??project.activeDesign?.sizeConstraint??'';
   const unresolved=result.intent?.unresolved??project.activeDesign?.intentUnresolved??(project.activeDesign?.status==='invalid'?[]:project.activeDesign?.unresolved)??[];
   if(unresolved.length)result.plan={...result.plan,supported:false,clarification:result.plan.clarification||unresolved.join('; ')};
   if(result.plan.supported){
    const version=Math.max(0,...project.contracts.map((c:any)=>c.version))+1;
    const contract=result.plan.recipe==='esp32-button-led'?createButtonLedContract(projectId,version):createGoldenContract(projectId,version);
    contract.goal=project.goal;
    for(const wire of contract.connections){if(wire.role==='sda')wire.boardPin=String(result.plan.sda);if(wire.role==='scl')wire.boardPin=String(result.plan.scl);}
    for(const c of contract.components)c.address=c.manifest.id==='bme280'?result.plan.sensorAddress:result.plan.displayAddress;
    for(const d of contract.expected.devices)d.address=d.componentId==='bme280'?result.plan.sensorAddress:result.plan.displayAddress;
    if(result.plan.recipe==='esp32-button-led'){for(const wire of contract.connections){if(wire.role==='output'&&wire.componentId==='button-pullup-10k')wire.boardPin=String(result.plan.buttonPin);if(wire.role==='input'&&wire.componentId==='led-series-330')wire.boardPin=String(result.plan.ledPin);}}
    const validation=validateContract(contract),artifact=generateFirmwareIfValid(contract,validation.valid),record={id:id(),version,contract,hash:contractHash(contract),validation,createdAt:now()};
    draft={id:id(),version:project.designDrafts.length+1,status:validation.valid?'executable':'invalid',componentIds:contract.components.map(c=>c.manifest.id),desiredBehavior,sizeConstraint,intentUnresolved:unresolved,unresolved:[...unresolved,...validation.errors.map(e=>e.message)],contractId:record.id,reason:validation.valid?'Golden recipe executable':'Deterministic validation refused this revision',createdAt:now()};
    this.store.transaction(()=>{this.store.insert('contracts',projectId,record);if(artifact)this.store.insert('firmware_artifacts',projectId,{id:id(),...artifact,mode:'planned',createdAt:now()});this.store.insert('design_drafts',projectId,draft);this.change(projectId,{contractId:record.id,title:result.plan.title,summary:result.plan.summary,steps:result.plan.steps,status:validation.valid?'ready':'invalid'});});
   }else{
    const mentioned=result.intent?.componentIds.filter(cid=>components.some(c=>c.id===cid))??mentionedComponentIds(goal);
    draft={id:id(),version:project.designDrafts.length+1,status:'planning_only',componentIds:mentioned,desiredBehavior,sizeConstraint,intentUnresolved:unresolved,unresolved:unresolved.length?unresolved:[result.plan.clarification||'Requested behavior lacks an executable recipe'],contractId:null,reason:result.plan.clarification||'Unsupported executable design',createdAt:now()};
    this.store.insert('design_drafts',projectId,draft);this.change(projectId,{status:'clarification',clarification:draft.reason});
   }
   const reply={id:id(),role:'assistant',message:result.plan.supported?result.plan.summary:draft.reason,draftId:draft.id,contractId:draft.contractId,createdAt:now()};
   this.store.insert('chat_messages',projectId,reply);this.store.event(projectId,'design.revised',{draftId:draft.id,contractId:draft.contractId,status:draft.status});
   return{message:reply,design:draft};
  }catch(error){this.store.insert('chat_messages',projectId,{id:id(),role:'assistant',message:safeError(error),error:true,createdAt:now()});throw error;}finally{this.busy.delete(projectId);}
 }
 changeComponent(projectId:string,value:ComponentChange) {
  const input=ComponentChangeSchema.parse(value),project=this.assertRevision(projectId,input);
  if(!components.some(c=>c.id===input.componentId))throw new Error('Unknown catalog component');
  const current=project.activeDesign?.componentIds??project.contracts.find((c:any)=>c.id===project.contractId)?.contract.components.map((c:any)=>c.manifest.id)??[];
  const selected=new Set<string>(current);if(input.operation==='add'&&selected.has(input.componentId)||input.operation==='remove'&&!selected.has(input.componentId))throw new Error('Catalog selection already unchanged');if(input.operation==='add')selected.add(input.componentId);else selected.delete(input.componentId);
  const draft={id:id(),version:project.designDrafts.length+1,status:'planning_only',componentIds:[...selected],desiredBehavior:project.activeDesign?.desiredBehavior??project.goal,sizeConstraint:project.activeDesign?.sizeConstraint??'',unresolved:['Ask the hardware engineer to regenerate and validate this component selection.'],contractId:null,reason:'Catalog selection changed; wiring and firmware require a new validated recipe.',createdAt:now()};
  this.store.transaction(()=>{this.store.insert('design_drafts',projectId,draft);this.store.insert('chat_messages',projectId,{id:id(),role:'user',message:`${input.operation} catalog component ${input.componentId}`,draftId:draft.id,createdAt:now()});this.change(projectId,{status:'clarification',clarification:draft.reason});this.store.event(projectId,'design.revised',{draftId:draft.id,status:draft.status});});
  return draft;
 }
 reviseWiring(projectId:string,value:WiringChange) {
  const input=WiringChangeSchema.parse(value),project=this.assertRevision(projectId,input);
  const current=project.contracts.find((record:any)=>record.id===project.contractId);
  if(!current)throw new Error('Current hardware contract required');
  const active=project.activeDesign;
  const intentUnresolved=active?.intentUnresolved??(active?.status==='invalid'?[]:active?.unresolved)??[];
  const selected=current.contract.components.map((component:any)=>component.manifest.id);
  if(active&&(active.status==='planning_only'||active.contractId!==current.id||active.componentIds.length!==selected.length||!selected.every((cid:string)=>active.componentIds.includes(cid)))||intentUnresolved.length)throw new Error('Active design is planning only or has unresolved intent; regenerate through chat');
  const contract:HardwareContract=structuredClone(current.contract);
  // The snapshot can change only external connections. Derive electrical metadata from trusted manifests.
  contract.connections=input.connections.map(wire=>{
   const component=contract.components.find(component=>component.instanceId===wire.componentId);
   if(!component)throw new Error('Unknown wiring component');
   const pin=component.manifest.pins.find(pin=>pin.name===wire.pin);
   if(!pin)throw new Error('Unknown wiring component pin');
   if(wire.boardPin!=='GND'&&!Object.hasOwn(contract.board.powerRails,wire.boardPin)&&!contract.board.pins.some(pin=>pin.name===wire.boardPin))throw new Error('Unknown wiring board pin');
   return{...wire,role:pin.role,...(!['power','ground'].includes(pin.role)?{protocol:component.manifest.protocol}:{})};
  });
  const version=Math.max(0,...project.contracts.map((record:any)=>record.version))+1;
  contract.version=version;
  const validation=validateContract(contract,{execution:true}),artifact=generateFirmwareIfValid(contract,validation.valid);
  const record={id:id(),version,contract,hash:contractHash(contract),validation,source:'wiring',createdAt:now()};
  const draft={id:id(),version:project.designDrafts.length+1,status:validation.valid?'executable':'invalid',source:'wiring',componentIds:selected,desiredBehavior:active?.desiredBehavior??project.goal,sizeConstraint:active?.sizeConstraint??'',intentUnresolved,unresolved:[...intentUnresolved,...validation.errors.map(error=>error.message)],connections:input.connections,contractId:record.id,reason:validation.valid?'Wiring validated for trusted recipe':'Deterministic validation refused this wiring revision',createdAt:now()};
  this.store.transaction(()=>{
   this.store.insert('contracts',projectId,record);
   if(artifact)this.store.insert('firmware_artifacts',projectId,{id:id(),...artifact,mode:'planned',createdAt:now()});
   this.store.insert('design_drafts',projectId,draft);
   this.change(projectId,{contractId:record.id,status:validation.valid?'ready':'invalid'});
   this.store.event(projectId,'design.revised',{draftId:draft.id,contractId:record.id,status:draft.status,source:'wiring'});
  });
  return draft;
 }
 async plan(projectId:string){if(this.project(projectId).activeDesign)throw new Error('Use chat to revise the active design');if(this.busy.has(projectId))throw new Error('Project operation already running');this.busy.add(projectId);try{const project=this.store.get('projects',projectId);const context=await this.knowledge.retrieve(project.goal);this.receipt(projectId,'retrieve',context);this.store.event(projectId,'plan.started',{message:'Planning components and expected physical state'});const result=await this.agent.plan(project.goal,context);this.store.insert('agent_runs',projectId,{id:id(),kind:'plan',...result,createdAt:now()});if(!result.plan.supported){this.change(projectId,{title:result.plan.title,status:'clarification',clarification:result.plan.clarification||'This build requires components or firmware outside the supported recipe.'});this.store.insert('design_drafts',projectId,{id:id(),version:1,status:'planning_only',componentIds:mentionedComponentIds(project.goal),desiredBehavior:project.goal,sizeConstraint:'Unresolved',unresolved:[result.plan.clarification],contractId:null,reason:result.plan.clarification,createdAt:now()});this.store.event(projectId,'plan.clarification',result.plan);return;}
 const nextVersion=Math.max(0,...this.store.list('contracts',projectId).map(c=>c.version))+1;const contract=result.plan.recipe==='esp32-button-led'?createButtonLedContract(projectId,nextVersion):createGoldenContract(projectId,nextVersion);contract.goal=project.goal;for(const wire of contract.connections){if(wire.role==='sda')wire.boardPin=String(result.plan.sda);if(wire.role==='scl')wire.boardPin=String(result.plan.scl);}for(const c of contract.components)c.address=c.manifest.id==='bme280'?result.plan.sensorAddress:result.plan.displayAddress;for(const d of contract.expected.devices)d.address=d.componentId==='bme280'?result.plan.sensorAddress:result.plan.displayAddress;if(result.plan.recipe==='esp32-button-led'){for(const wire of contract.connections){if(wire.role==='output'&&wire.componentId==='button-pullup-10k')wire.boardPin=String(result.plan.buttonPin);if(wire.role==='input'&&wire.componentId==='led-series-330')wire.boardPin=String(result.plan.ledPin);}}const validation=validateContract(contract);const artifact=generateFirmwareIfValid(contract,validation.valid);const version={id:id(),version:nextVersion,contract,hash:contractHash(contract),validation,createdAt:now()};this.store.transaction(()=>{this.store.insert('contracts',projectId,version);if(artifact)this.store.insert('firmware_artifacts',projectId,{id:id(),...artifact,mode:'planned',createdAt:now()});this.change(projectId,{title:result.plan.title,summary:result.plan.summary,steps:result.plan.steps,status:validation.valid?'ready':'invalid',contractId:version.id});this.store.event(projectId,'contract.created',{hash:version.hash,valid:validation.valid,errors:validation.errors});});this.receipt(projectId,'ingest_contract',await this.knowledge.remember('contract-'+version.id,`# ${result.plan.title}\n${result.plan.summary}\n\n${JSON.stringify(contract,null,2)}`));
 }catch(error){this.change(projectId,{status:'error',error:safeError(error)});this.store.event(projectId,'plan.failed',{error:safeError(error)});}finally{this.busy.delete(projectId);}}
 async run(projectId:string,mode:'simulation'|'physical',fault:'none'|'sda'='none',port?:string,parentId?:string,backend:SimulationBackend='template-model'){if(this.busy.has(projectId))throw new Error('Project operation already running');const p=this.assertExecutable(projectId);if(parentId&&!p.experiments.some((e:any)=>e.id===parentId&&e.contractId===p.contractId))throw new Error('Recovery requires current contract evidence');if(p.status==='planning'||!p.contractId)throw new Error('Validated plan required');const version=this.store.get('contracts',p.contractId);const contract:HardwareContract=version.contract;const validation=validateContract(contract,{execution:true});if(!validation.valid)throw new Error('Electrical validation failed');const simulator=mode==='simulation'?await this.selectedSimulator(backend):undefined;if(this.busy.has(projectId))throw new Error('Project operation already running');if(mode==='physical'&&fault!=='none')throw new Error('Physical faults must be introduced manually with power off');const experimentId=id(),nonce=id(),firmware=generateFirmware(contract,{experimentId,nonce}),identity:RunIdentity={experimentId,nonce,contractHash:contractHash(contract),firmwareHash:firmware.hash};const experiment={id:experimentId,mode,backend:mode==='simulation'?backend:'arduino-mcp-server',fault,parentId:parentId??null,identity,contractId:version.id,status:'running',createdAt:now()};if(mode==='physical'){if(!port)throw new Error('Physical port required');if(this.ports.has(port))throw new Error('Physical port already in use');this.ports.add(port);}this.busy.add(projectId);try{this.store.transaction(()=>{this.store.insert('experiments',projectId,experiment);this.store.insert('firmware_artifacts',projectId,{id:id(),...firmware,mode,createdAt:now()});this.change(projectId,{status:'running'});this.store.event(projectId,'experiment.started',{experimentId,mode,fault,backend:experiment.backend,parentId:parentId??null});});
 const output=RuntimeOutputSchema.parse(mode==='simulation'?await simulator!.run(contract,fault,firmware):await this.runtime.invoke({action:'run',authorized:true,port:port??'',...identity,source:firmware.source,fqbn:'esp32:esp32:esp32',safetyContext:{board:'esp32-devkit-v1',fqbn:'esp32:esp32:esp32',wiring:contract.connections.filter(w=>!['3V3','GND'].includes(w.boardPin)).map(w=>({pin:'GPIO'+w.boardPin,direction:'bidirectional',signalType:w.protocol??'other',voltage:3.3})),power:{supplyVoltage:3.3,totalCurrentMa:contract.components.reduce((sum,c)=>sum+c.manifest.currentMa,0),supplyThrough:'3v3_pin'}}}));if((mode==='simulation'&&output.backend!==backend)||output.source!==mode||(mode==='physical'&&(output.simulated===true||(output.checks??[]).some((c:any)=>c.data?.simulated===true))))throw new Error('Runtime evidence provenance mismatch');const rows:Evidence[]=[];for(const raw of output.checks??[]){const artifactId=id(),payload={identity,source:mode,timestamp:now(),check:raw.check,passed:raw.passed,data:raw.data,rawSerial:mode==='physical'?output.rawSerial:undefined};const artifactHash=hashText(canonicalJson(payload));const evidence:Evidence={...identity,id:artifactId,source:mode,timestamp:payload.timestamp,check:raw.check,passed:raw.passed,artifactHash,artifactId,data:raw.data};rows.push(evidence);this.store.insert('observations',projectId,{id:artifactId,evidence,artifact:{hash:artifactHash,body:payload},createdAt:now()});this.store.event(projectId,'check.observed',{experimentId,check:raw.check,passed:raw.passed,data:raw.data,source:mode,artifactHash});}
 const result=this.verifyStored(projectId,contract,identity,rows);const verification={id:id(),experimentId,...result,mode,evidenceIds:rows.map(r=>r.id),createdAt:now()};this.store.transaction(()=>{this.store.insert('verifications',projectId,verification);this.store.update('experiments',{...experiment,status:result.status,completedAt:now(),runtime:output});this.change(projectId,{status:result.status,lastExperimentId:experimentId});this.store.event(projectId,'verification.completed',verification);if(!result.passed)this.store.insert('failures',projectId,{id:id(),experimentId,category:output.runtimeError??'component_not_detected',expected:contract.expected,observed:rows.map(r=>({check:r.check,passed:r.passed,data:r.data})),errors:result.errors,createdAt:now()});});
 this.receipt(projectId,'ingest_experiment',await this.knowledge.remember('experiment-'+experimentId,`# Hardware experiment ${experimentId}\nMode: ${mode}. Not physical evidence when simulated.\n${JSON.stringify({contractHash:identity.contractHash,result,observed:rows},null,2)}`));if(!result.passed){this.store.event(projectId,'diagnosis.started',{experimentId});try{const context=await this.knowledge.retrieve('ESP32 BME280 missing I2C device sensor SDA SCL wiring repair');this.receipt(projectId,'retrieve_diagnosis',context);const diagnosed=await this.agent.diagnose(contract.goal,{expected:contract.expected,observed:rows.map(r=>({check:r.check,data:r.data,passed:r.passed})),mode,context});this.store.insert('agent_runs',projectId,{id:id(),kind:'diagnosis',experimentId,...diagnosed,createdAt:now()});const repair={id:id(),experimentId,...diagnosed.diagnosis,status:'proposed',createdAt:now()};this.store.insert('repairs',projectId,repair);this.store.event(projectId,'repair.proposed',repair);this.receipt(projectId,'ingest_repair',await this.knowledge.remember('repair-'+repair.id,JSON.stringify(repair,null,2)));}catch(error){this.store.event(projectId,'diagnosis.failed',{error:safeError(error)});this.change(projectId,{diagnosisError:safeError(error)});}}
 return verification;
 }catch(error){this.store.update('experiments',{...experiment,status:'ERROR',completedAt:now(),error:safeError(error)});this.store.insert('failures',projectId,{id:id(),experimentId,category:'unknown',errors:[safeError(error)],createdAt:now()});this.change(projectId,{status:'error',error:safeError(error),lastExperimentId:experimentId});this.store.event(projectId,'experiment.failed',{experimentId,error:safeError(error)});throw error;}finally{this.busy.delete(projectId);if(mode==='physical'&&port)this.ports.delete(port);}}
 verifyStored(projectId:string,contract:HardwareContract,identity:RunIdentity,rows:Evidence[]){const result=verifyEvidence(contract,identity,rows);for(const row of rows){const record=this.store.get('observations',row.artifactId);if(!record||record.evidence.id!==row.id||canonicalJson(record.evidence)!==canonicalJson(row)||record.artifact.hash!==row.artifactHash||hashText(canonicalJson(record.artifact.body))!==row.artifactHash){result.passed=false;result.physical=false;result.status='FAILED';result.errors.push('Missing or tampered evidence artifact');}}
 const artifacts=this.store.list('firmware_artifacts',projectId);if(!artifacts.some(f=>f.hash===identity.firmwareHash&&hashText(f.source)===identity.firmwareHash&&f.experimentId===identity.experimentId&&f.nonce===identity.nonce)){result.passed=false;result.physical=false;result.status='FAILED';result.errors.push('Missing matched firmware artifact');}return result;}
}
function generateFirmwareIfValid(contract:HardwareContract,valid:boolean){return valid?generateFirmware(contract,{experimentId:'planned',nonce:'planned'}):null;}
export function safeError(error:unknown){return(error instanceof Error?error.message:'Operation failed').replace(/(?:Bearer\s+|sk-)[\w.-]+/g,'[redacted]').slice(0,600);}
export async function simulate(contract:HardwareContract,fault:'none'|'sda'){return new TemplateSimulationAdapter().run(contract,fault);}
