/** /pro/print/:projectId/:revision (the integrator mounts the route and the grant gate). Loads one saved revision and prints it. */
import {useEffect,useState} from 'react';
import {useParams} from 'react-router-dom';
import {proApi,type RevisionMeta} from '../api/pro-api';
import {DEV_PROJECT_ID,devSpec} from '../workspace/dev-fixture';
import {BuildSheet,type BuildSheetProps} from './BuildSheet';

type Loaded=Pick<BuildSheetProps,'spec'|'projectId'|'revision'|'projectName'|'savedAt'|'revisions'>;
type Result={key:string}&({ok:true;data:Loaded}|{ok:false;message:string});

export function PrintPage(){
 const {projectId='',revision=''}=useParams();
 const rev=Number(revision),key=`${projectId}/${revision}`;
 const fixture=projectId===DEV_PROJECT_ID,valid=Boolean(projectId)&&Number.isInteger(rev)&&rev>=1;
 const [res,setRes]=useState<Result|null>(null);
 useEffect(()=>{
  if(fixture||!valid)return;
  let live=true;
  Promise.all([proApi.revision(projectId,rev),proApi.project(projectId).catch(()=>null),proApi.revisions(projectId).catch(()=>[] as RevisionMeta[])])
   .then(([r,p,all])=>{if(live)setRes({key,ok:true,data:{spec:r.spec,projectId,revision:r.revision,projectName:p?.project.name,savedAt:r.at,revisions:all.filter(x=>x.revision<=r.revision).map(x=>({revision:x.revision,reason:x.reason,by:x.by,at:x.at}))}});})
   .catch(e=>{if(live)setRes({key,ok:false,message:e instanceof Error?e.message:'The Build Sheet could not be loaded.'});});
  return()=>{live=false;};
 },[fixture,valid,projectId,rev,key]);
 // staff fixture: the farm SystemSpec from the contract package, saved at its own generation time (no fetch)
 const current:Result|null=fixture?{key,ok:true,data:{spec:devSpec,projectId,revision:valid?rev:1,savedAt:devSpec.meta.generatedAt,revisions:[]}}
  :!valid?{key,ok:false,message:'This print link is not valid.'}:res&&res.key===key?res:null;
 return <div className="bs-shell">
  <div className="bs-bar" data-testid="bs-bar">
   <span>Build Sheet · EN · A4 · saved revisions only (drafts are not printed)</span>
   <button type="button" className="bs-print" onClick={()=>window.print()} disabled={!current?.ok} data-testid="bs-print">Print / Save as PDF</button>
  </div>
  {!current&&<p className="bs-msg" role="status">Loading the Build Sheet…</p>}
  {current&&!current.ok&&<p className="bs-msg" role="alert">{current.message}</p>}
  {current?.ok&&<BuildSheet {...current.data}/>}
 </div>;
}
export default PrintPage;
