/** /pro workspace shell: top bar, feature tree, centre slot (3D / site plan), dock, properties, status bar. */
import {useCallback,useEffect,useState,type ReactNode} from 'react';
import {proActions} from '../api/spec-store';
import {proApi,type ProProject,type RevisionMeta} from '../api/pro-api';
import {FeatureTree} from '../tree/FeatureTree';
import {PropertiesPanel} from '../properties/PropertiesPanel';
import {TopBar} from './TopBar';
import {Dock} from './Dock';
import {StatusBar} from './StatusBar';
import '../../design/tokens.css';
import './pro.css';

export interface WorkspaceProps{
 /** Project to load from the Pro API. Omit when the caller fills the store itself (dev fixture). */
 projectId?:string;
 /** Centre area (3D assembly, site plan). */
 canvas?:ReactNode;
 /** Replaces the default prompt handling (the chat agent). */
 onPrompt?:(text:string)=>void;promptBusy?:boolean;
 onBuildSheet?:()=>void;onProjectChange?:(id:string)=>void;
}
export function Workspace(p:WorkspaceProps){
 const [projects,setProjects]=useState<ProProject[]>([]),[revisions,setRevisions]=useState<RevisionMeta[]>([]);
 const load=useCallback(async(id:string,n?:number)=>{
  proActions.loading(id);
  try{
   if(n){const r=await proApi.revision(id,n);proActions.setSpec(id,r.revision,r.spec);}
   else{const d=await proApi.project(id);if(d.head)proActions.setSpec(id,d.head.revision,d.head.spec);else proActions.fail('This project has no design yet.');}
   setRevisions(await proApi.revisions(id).catch(()=>[]));
  }catch(e){proActions.fail(e instanceof Error?e.message:'Could not load the project');}
 },[]);
 useEffect(()=>{if(!p.projectId)return;const t=setTimeout(()=>void load(p.projectId!),0);return()=>clearTimeout(t);},[p.projectId,load]);
 useEffect(()=>{if(p.projectId)proApi.projects().then(setProjects).catch(()=>{});},[p.projectId]);
 return <div className="pro-app" data-testid="pro-workspace">
  <TopBar projects={projects} revisions={revisions} onPickProject={id=>p.onProjectChange?.(id)} onPickRevision={n=>p.projectId&&void load(p.projectId,n)} onPrompt={p.onPrompt} promptBusy={p.promptBusy} onBuildSheet={p.onBuildSheet}/>
  <FeatureTree/>
  <main className="pro-center"><div className="pro-canvas">{p.canvas??<div className="pro-canvas-empty"><span className="pro-eyebrow">3D assembly · Site plan</span><span className="pro-muted">The viewport mounts here.</span></div>}</div><Dock/></main>
  <PropertiesPanel/>
  <StatusBar/>
 </div>;
}
