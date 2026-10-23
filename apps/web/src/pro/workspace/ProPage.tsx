/** /pro and /pro/dev: the workspace with the 3D assembly, the site plan and the chat mounted into it. */
import {useEffect,useMemo,useState} from 'react';
import {useNavigate,useParams} from 'react-router-dom';
import {Workspace} from './Workspace';
import {proApi} from '../api/pro-api';
import {loadDevFixture} from './dev-fixture';
import {getProState,proActions,useProSpec,useSelection,useVisibility} from '../api/spec-store';
import {CadViewport} from '../cad/CadViewport';
import {SitePlan,type SiteSelection} from '../site/SitePlan';
import {ChatPanel} from '../chat/ChatPanel';
import {fixtureTransport,opsTransport} from '../chat/transport';
import type {VisibilityState} from '../cad/isolate';

function Canvas({fixture}:{fixture:boolean}){
 const {spec}=useProSpec(),{selection,select}=useSelection(),vis=useVisibility();
 const [tab,setTab]=useState<'3d'|'site'>('3d');
 const node=useMemo(()=>{
  if(!spec)return null;
  const id=selection?.kind==='part'||selection?.kind==='node'?(selection.nodeId??selection.id):null;
  return spec.nodes.find(n=>n.id===id)??spec.nodes[0]??null;
 },[spec,selection]);
 const ids=spec?spec.nodes.map(n=>n.id):[];
 const visibility:VisibilityState={hidden:new Set(vis.hidden.filter(k=>k.startsWith('part:'+(node?.id??'')+'/')).map(k=>k.split('/')[1])),isolated:null};
 const siteSel:SiteSelection=selection&&selection.kind!=='part'?{kind:selection.kind,id:selection.id}:null;
 if(!spec)return <div className="pro-canvas-empty"><span className="pro-muted">{getProState().error??'Loading the design…'}</span></div>;
 return <div style={{display:'flex',flexDirection:'column',height:'100%',minHeight:0}}>
  <div role="tablist" style={{display:'flex',gap:16,padding:'8px 16px',borderBottom:'1px solid var(--ds-line)'}}>
   {(['3d','site'] as const).map(t=><button key={t} type="button" role="tab" aria-selected={tab===t} data-testid={'pro-tab-'+t} className={tab===t?'is-active':''} onClick={()=>setTab(t)}>{t==='3d'?'3D assembly':'Site plan'}</button>)}
  </div>
  <div style={{flex:1,minHeight:0,position:'relative'}}>
   {tab==='3d'&&node&&<CadViewport key={node.id} node={node} contextLabel={'N'+(ids.indexOf(node.id)+1)}
    selectedId={selection?.kind==='part'&&selection.nodeId===node.id?selection.id:null}
    onSelect={id=>select(id?{kind:'part',id,nodeId:node.id}:{kind:'node',id:node.id})}
    visibility={visibility}/>}
   {tab==='site'&&<SitePlan spec={spec} selection={siteSel} onSelect={s=>select(s)}/>}
  </div>
  <span hidden data-testid="pro-mode">{fixture?'fixture':'live'}</span>
 </div>;
}

export function ProPage({dev=false}:{dev?:boolean}){
 const {projectId}=useParams(),nav=useNavigate();
 useEffect(()=>{if(dev)loadDevFixture();},[dev]);
 const transport=useMemo(()=>dev||!projectId?fixtureTransport(60):opsTransport(projectId),[dev,projectId]);
 const [chat,setChat]=useState<{text:string;n:number}|null>(null);
 return <div className="pro-shell" data-chat={chat?'open':'closed'}>
  <Workspace projectId={dev?undefined:projectId} onProjectChange={id=>nav('/pro/'+id)} canvas={<Canvas fixture={dev||!projectId}/>}
   onPrompt={text=>setChat(c=>({text,n:(c?.n??0)+1}))}/>
  {chat&&<aside aria-label="Chat" className="pro-chat-drawer" data-testid="pro-chat">
   <button type="button" className="pro-chat-close" aria-label="Close chat" onClick={()=>setChat(null)}>×</button>
   <ChatPanel key={chat.n} transport={transport} initialMessage={chat.text} onEvent={e=>{if(e.type==='revision_saved'&&projectId&&!dev)void proApi.project(projectId).then(d=>{if(d.head)proActions.setSpec(projectId,d.head.revision,d.head.spec);});}}/>
  </aside>}
 </div>;
}
export default ProPage;
