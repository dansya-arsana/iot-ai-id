import {randomUUID} from 'node:crypto';
import {SiteSnapshotSchema,SiteUpdateSchema,type Site,type SiteSnapshot,type SiteView,type DeviceStatus} from '../../packages/site-contract/index.js';
import {Store} from './store.js';
import {validateContract} from '../../packages/validator/index.js';
export class RevisionConflict extends Error {}
export function projectDeviceStatus(store:Store,projectId:string|null):DeviceStatus {
 if(!projectId)return 'planning';
 const p=store.get('projects',projectId);if(!p)return 'blocked';
 const c=p.contractId?store.get('contracts',p.contractId):null;
 const draft=store.list('design_drafts',projectId).at(-1);
 if(!c)return 'planning';
 if(c.validation?.valid!==true||!validateContract(c.contract,{execution:true}).valid||draft&&(draft.status!=='executable'||draft.contractId!==c.id))return 'blocked';
 const e=store.list('experiments',projectId).at(-1);if(!e)return 'ready';
 if(e.contractId!==c.id||e.identity?.experimentId!==e.id||e.identity?.contractHash!==c.hash)return 'unverified';
 if(e.status==='running')return 'running';
 const v=store.list('verifications',projectId).filter(v=>v.experimentId===e.id).at(-1);
 if(['FAILED','ERROR'].includes(e.status))return 'failed';
 if(!v||v.mode!==e.mode||v.status!==e.status||v.passed!==true)return 'unverified';
 if(e.mode==='physical'&&e.status==='VERIFIED'&&v.physical===true)return 'physical_verified';
 if(e.mode==='simulation'&&e.status==='SIMULATED_VERIFIED'&&v.physical===false)return 'simulated_verified';
 return 'unverified';
}
export class SiteEngine {
 constructor(readonly store:Store){}
 list(){return this.store.list<Site>('sites').map(site=>this.view(site));}
 get(id:string){const site=this.store.get<Site>('sites',id);if(!site)throw new Error('Site not found');return this.view(site);}
 private validate(snapshot:SiteSnapshot,previous?:Site){
 const ids=[...snapshot.areas,...snapshot.devices,...snapshot.links].map(x=>x.id);if(new Set(ids).size!==ids.length)throw new Error('Duplicate site identifier');
 const areas=new Set(snapshot.areas.map(a=>a.id)),devices=new Set(snapshot.devices.map(d=>d.id));
 const projects=snapshot.devices.flatMap(d=>d.projectId?[d.projectId]:[]);if(new Set(projects).size!==projects.length)throw new Error('Project already attached in this site');
 for(const d of snapshot.devices){if(!areas.has(d.areaId))throw new Error('Device area not found');if(d.projectId&&!this.store.get('projects',d.projectId))throw new Error('Device project not found');}
 for(const l of snapshot.links)if(l.source===l.target||!devices.has(l.source)||!devices.has(l.target))throw new Error('Invalid logical link endpoints');
 if(previous)for(const area of previous.areas)if(!areas.has(area.id))for(const old of previous.devices.filter(d=>d.areaId===area.id)){const moved=snapshot.devices.find(d=>d.id===old.id);if(!moved||moved.areaId===area.id)throw new Error('Move every device explicitly before deleting an occupied area');}
 }
 create(input:unknown){const snapshot=SiteSnapshotSchema.parse(input);return this.store.transaction(()=>{this.validate(snapshot);const time=new Date().toISOString(),site:Site={...snapshot,id:randomUUID(),revision:0,createdAt:time,updatedAt:time};this.store.insert('sites',site.id,site);this.store.event(site.id,'site.created',{revision:0});return this.view(site);});}
 update(id:string,input:unknown){const {expectedRevision,snapshot}=SiteUpdateSchema.parse(input);return this.store.transaction(()=>{const previous=this.store.get<Site>('sites',id);if(!previous)throw new Error('Site not found');if(previous.revision!==expectedRevision)throw new RevisionConflict('Site revision conflict; reload before editing');this.validate(snapshot,previous);const site={...previous,...snapshot,revision:previous.revision+1,updatedAt:new Date().toISOString()};this.store.update('sites',site);this.store.event(id,'site.updated',{revision:site.revision});return this.view(site);});}
 view(site:Site):SiteView{const deviceStatuses=Object.fromEntries(site.devices.map(d=>[d.id,projectDeviceStatus(this.store,d.projectId)]));const aggregate=(devices:Site['devices'])=>{const required=devices.filter(d=>d.required);return required.length>0&&required.every(d=>deviceStatuses[d.id]==='physical_verified')?'physical_verified' as const:'unverified' as const;};return {...site,deviceStatuses,areaStatuses:Object.fromEntries(site.areas.map(a=>[a.id,aggregate(site.devices.filter(d=>d.areaId===a.id))])),status:aggregate(site.devices)};}
 memberships(projectId:string){if(!this.store.get('projects',projectId))throw new Error('Project not found');return this.list().flatMap(s=>s.devices.filter(d=>d.projectId===projectId).map(d=>({siteId:s.id,siteName:s.name,areaId:d.areaId,areaName:s.areas.find(a=>a.id===d.areaId)!.name,deviceId:d.id})));}
}
