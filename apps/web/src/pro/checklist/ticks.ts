/** Tick persistence over the member Pro API (cookie session + CSRF header).
 *  GET  /projects/:id/ticks            -> {ticks:Tick[]}
 *  PUT  /projects/:id/ticks/:itemId    {state:'ticked'|'open'} -> {tick:Tick}   (the server stamps by='human' and keeps evidence rows)
 *  When the route is missing (404, dev farm fixture) ticks fall back to this device's localStorage and the UI says so. */
import {useCallback,useEffect,useRef,useState} from 'react';
import type {Tick,TickMap} from './model';

export type SaveState='loading'|'saved'|'saving'|'local'|'offline'|'error';
const base=(p:string)=>`/ops/v1/member/pro/projects/${encodeURIComponent(p)}/ticks`;
const hdr={'Content-Type':'application/json','X-AIoT-Member':'1'};
const lsKey=(p:string)=>`pro-ticks:${p}`;
const readLocal=(p:string):TickMap=>{try{return JSON.parse(localStorage.getItem(lsKey(p))??'{}') as TickMap;}catch{return {};}};
const writeLocal=(p:string,m:TickMap)=>{try{localStorage.setItem(lsKey(p),JSON.stringify(m));}catch{/* private mode */}};

export const toMap=(ticks:Tick[]):TickMap=>Object.fromEntries(ticks.map(t=>[t.itemId,t]));

export function useTicks(projectId:string|null){
 const [ticks,setTicks]=useState<TickMap>({});
 const [save,setSave]=useState<SaveState>('loading');
 const [error,setError]=useState<string>();
 const local=useRef(false);
 const [online,setOnline]=useState(()=>typeof navigator==='undefined'||navigator.onLine!==false);
 useEffect(()=>{const on=()=>setOnline(true),off=()=>setOnline(false);addEventListener('online',on);addEventListener('offline',off);return()=>{removeEventListener('online',on);removeEventListener('offline',off);};},[]);
 useEffect(()=>{
  if(!projectId)return;let live=true;local.current=false;setSave('loading');setError(undefined);
  fetch(base(projectId),{credentials:'same-origin',cache:'no-store',headers:hdr}).then(async r=>{
   const d0=r.status===404?null:await r.clone().json().catch(()=>null);
   // 404, or a non-JSON answer (dev server fallback page): the route is not there, keep ticks on this device
   if(r.status===404||!d0||(r.ok&&!Array.isArray(d0.ticks))){local.current=true;if(live){setTicks(readLocal(projectId));setSave('local');}return;}
   const d=d0 as {ticks?:Tick[];error?:string};if(!r.ok)throw new Error(d.error??'Could not load ticks');
   if(live){setTicks(toMap(d.ticks??[]));setSave('saved');}
  }).catch(e=>{if(live){local.current=true;setTicks(readLocal(projectId));setSave('local');setError(String(e.message??e));}});
  return()=>{live=false;};
 },[projectId]);
 /** Optimistic; a failed save puts the previous row back and shows the error. */
 const set=useCallback(async(itemId:string,ticked:boolean)=>{
  if(!projectId||!online)return;
  const prev=ticks[itemId];
  const next:Tick={itemId,state:ticked?'ticked':'open',by:'human',at:new Date().toISOString()};
  setTicks(t=>({...t,[itemId]:next}));
  if(local.current){setTicks(t=>{writeLocal(projectId,t);return t;});setSave('local');return;}
  setSave('saving');
  try{
   const r=await fetch(`${base(projectId)}/${encodeURIComponent(itemId)}`,{method:'PUT',credentials:'same-origin',headers:hdr,body:JSON.stringify({state:next.state})});
   const d=await r.json().catch(()=>({}));
   if(!r.ok)throw new Error(d.error??'Could not save');
   setTicks(t=>({...t,[itemId]:d.tick??next}));setSave('saved');setError(undefined);
  }catch(e){
   setTicks(t=>{const c={...t};if(prev)c[itemId]=prev;else delete c[itemId];return c;});setSave('error');setError(String((e as Error).message));
  }
 },[projectId,online,ticks]);
 return{ticks,save:online?save:'offline' as SaveState,error,set,online};
}
