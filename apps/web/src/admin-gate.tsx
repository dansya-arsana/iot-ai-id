/** admin.iot.ai.id root: staff session check. Signed out shows the landing and login; signed in shows the backoffice. Any later 401 (session ended) returns to the landing. */
import {useCallback,useEffect,useState} from 'react';
import {useLang} from './i18n';
import {SESSION_ENDED} from './api';
import {Backoffice} from './backoffice';
import {AdminLanding} from './pages/admin-landing';
import {OpsError,staffAuth,type StaffMe} from './ops-client';
import {Button,EmptyState,Spinner} from './ui';

type State={kind:'loading'}|{kind:'out';ended:boolean}|{kind:'in';me:StaffMe}|{kind:'error'};
export function AdminGate(){
 const{tr}=useLang();const [state,setState]=useState<State>({kind:'loading'});
 const check=useCallback((quiet=false)=>staffAuth.me().then(me=>setState({kind:'in',me}),e=>{
  if(e instanceof OpsError&&e.status===401)setState(s=>({kind:'out',ended:s.kind==='in'||(s.kind==='out'&&s.ended)}));
  else if(!quiet)setState({kind:'error'});// A flaky refresh while signed in must not log anyone out.
 }),[]);
 useEffect(()=>{void check();},[check]);
 useEffect(()=>{
  const ended=()=>setState({kind:'out',ended:true});
  const recheck=()=>{if(document.visibilityState==='visible')void check(true);};
  window.addEventListener(SESSION_ENDED,ended);window.addEventListener('focus',recheck);document.addEventListener('visibilitychange',recheck);
  return()=>{window.removeEventListener(SESSION_ENDED,ended);window.removeEventListener('focus',recheck);document.removeEventListener('visibilitychange',recheck);};
 },[check]);
 useEffect(()=>{if(state.kind==='in')document.title='Backoffice | AIoT';},[state.kind]);
 const signOut=()=>{void staffAuth.logout().catch(()=>undefined).finally(()=>setState({kind:'out',ended:false}));};
 if(state.kind==='loading')return <div className="route-loading"><Spinner label={tr('Loading','Memuat')}/></div>;
 if(state.kind==='error')return <main className="bo-empty"><EmptyState eyebrow={tr('Admin','Admin')} title={tr('Could not reach the server','Tidak dapat menghubungi server')} action={<Button onClick={()=>{setState({kind:'loading'});void check();}}>{tr('Retry','Coba lagi')}</Button>}>{tr('Check your connection and try again.','Periksa koneksi lalu coba lagi.')}</EmptyState></main>;
 if(state.kind==='out')return <AdminLanding ended={state.ended} onSignedIn={me=>setState({kind:'in',me})}/>;
 return <Backoffice staff={{me:state.me,onSignOut:signOut}}/>;
}
