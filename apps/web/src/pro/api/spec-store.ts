/**
 * Workspace state (frozen hooks for the other M5 agents): useProSpec, useSelection, useVisibility, registerDockTab.
 * A tiny external store: no dependency, selectors via useSyncExternalStore.
 */
import {useSyncExternalStore,type ReactNode} from 'react';
import type {SystemSpec} from '../../../../../packages/pro-contract/system-spec';
import {displayRefs,type DisplayRefs} from '../../../../../packages/pro-contract/refs';

export type SelectionKind='site'|'field'|'node'|'part'|'link';
export interface Selection{kind:SelectionKind;id:string;/** owning node for a part */nodeId?:string}
export interface ProState{
 projectId:string|null;revision:number|null;spec:SystemSpec|null;status:'idle'|'loading'|'ready'|'error';error?:string;
 selection:Selection|null;hidden:string[];isolated:string|null;
}
let state:ProState={projectId:null,revision:null,spec:null,status:'idle',selection:null,hidden:[],isolated:null};
const listeners=new Set<()=>void>();
const set=(patch:Partial<ProState>)=>{state={...state,...patch};listeners.forEach(l=>l());};
const subscribe=(l:()=>void)=>{listeners.add(l);return()=>{listeners.delete(l);};};
const useStore=<T,>(pick:(s:ProState)=>T):T=>useSyncExternalStore(subscribe,()=>pick(state));
export const getProState=()=>state;

/** Visibility keys: `node:<id>`, `field:<id>`, `part:<nodeId>/<partId>`, `links`. Isolate key is a node or part key. */
export const nodeKey=(id:string)=>`node:${id}`;
export const partKey=(nodeId:string,partId:string)=>`part:${nodeId}/${partId}`;
export const fieldKey=(id:string)=>`field:${id}`;

export const proActions={
 loading:(projectId:string)=>set({projectId,status:'loading',error:undefined}),
 setSpec:(projectId:string,revision:number,spec:SystemSpec)=>set({projectId,revision,spec,status:'ready',error:undefined,
  // keep selection only when it still exists
  selection:state.selection&&exists(spec,state.selection)?state.selection:null,
  hidden:state.hidden.filter(k=>keyExists(spec,k)),isolated:state.isolated&&keyExists(spec,state.isolated)?state.isolated:null}),
 fail:(message:string)=>set({status:'error',error:message}),
 select:(selection:Selection|null)=>set({selection}),
 toggleHidden:(key:string)=>set({hidden:state.hidden.includes(key)?state.hidden.filter(k=>k!==key):[...state.hidden,key]}),
 showAll:()=>set({hidden:[],isolated:null}),
 isolate:(key:string|null)=>set({isolated:key}),
};
function exists(spec:SystemSpec,s:Selection):boolean{
 if(s.kind==='site')return true;
 if(s.kind==='field')return spec.fields.some(f=>f.id===s.id);
 if(s.kind==='node')return spec.nodes.some(n=>n.id===s.id);
 if(s.kind==='link')return spec.links.some(l=>l.id===s.id);
 return spec.nodes.some(n=>n.id===s.nodeId&&n.parts.some(p=>p.id===s.id));
}
function keyExists(spec:SystemSpec,key:string):boolean{
 const [k,rest='']=key.split(':');
 if(k==='node')return spec.nodes.some(n=>n.id===rest);
 if(k==='field')return spec.fields.some(f=>f.id===rest);
 if(k==='part'){const [n,p]=rest.split('/');return spec.nodes.some(x=>x.id===n&&x.parts.some(y=>y.id===p));}
 return key==='links';
}

export const useProSpec=()=>{
 const spec=useStore(s=>s.spec),revision=useStore(s=>s.revision),projectId=useStore(s=>s.projectId),status=useStore(s=>s.status),error=useStore(s=>s.error);
 return{spec,revision,projectId,status,error,refs:spec?memoRefs(spec):null};
};
let refsFor:SystemSpec|null=null,refsVal:DisplayRefs|null=null;
function memoRefs(spec:SystemSpec):DisplayRefs{if(refsFor!==spec){refsFor=spec;refsVal=displayRefs(spec);}return refsVal!;}
export const useSelection=()=>({selection:useStore(s=>s.selection),select:proActions.select});
export const useVisibility=()=>{
 const hidden=useStore(s=>s.hidden),isolated=useStore(s=>s.isolated);
 return{hidden,isolated,isHidden:(key:string)=>hidden.includes(key),toggle:proActions.toggleHidden,isolate:proActions.isolate,showAll:proActions.showAll};
};

// ---------- dock tabs (bottom panel registry; M6 panels register here) ----------
export interface DockTab{id:string;label:string;/** small count or badge text */badge?:()=>string|undefined;order?:number;render:()=>ReactNode}
const tabs=new Map<string,DockTab>();let tabList:DockTab[]=[];const tabListeners=new Set<()=>void>();
export function registerDockTab(tab:DockTab):()=>void{
 tabs.set(tab.id,tab);tabList=[...tabs.values()].sort((a,b)=>(a.order??100)-(b.order??100));tabListeners.forEach(l=>l());
 return()=>{tabs.delete(tab.id);tabList=[...tabs.values()].sort((a,b)=>(a.order??100)-(b.order??100));tabListeners.forEach(l=>l());};
}
export const useDockTabs=()=>useSyncExternalStore(l=>{tabListeners.add(l);return()=>{tabListeners.delete(l);};},()=>tabList);
