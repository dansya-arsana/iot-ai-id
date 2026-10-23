/** "Tested in lab" badge and its staff form. The form needs a Lab Mitra task id; the server verifies the task (ADR 010). */
import {useState,type FormEvent} from 'react';
import {Button,Input,Notice,Tag} from '../ui';
import {useLang} from '../i18n';

export type LabTested={schoolId:string;taskId:string;at:string;by:string};
export function LabTestedBadge({labTested}:{labTested?:LabTested}){
 const{tr}=useLang();
 if(!labTested)return null;
 return <Tag tone="ok" className="cat-lab-badge"><span title={`${labTested.schoolId} · ${labTested.taskId} · ${labTested.at.slice(0,10)}`}>{tr('Tested in lab','Teruji di lab')}</span></Tag>;
}
const TASK_ID=/^[A-Za-z0-9_-]{4,64}$/;
export function LabTestedForm({partId,onSubmit}:{partId:string;onSubmit:(taskId:string)=>Promise<boolean>}){
 const{tr}=useLang();const [taskId,setTaskId]=useState('');const [busy,setBusy]=useState(false);
 const trimmed=taskId.trim();const valid=TASK_ID.test(trimmed);
 const submit=async(e:FormEvent)=>{e.preventDefault();if(!valid||busy)return;setBusy(true);try{if(await onSubmit(trimmed))setTaskId('');}finally{setBusy(false);}};
 return <form className="cat-lab-form" onSubmit={e=>void submit(e)} aria-label={tr('Mark tested in lab','Tandai teruji di lab')}>
  <Input id={`lab-task-${partId}`} label={tr('Lab Mitra task id','ID tugas Lab Mitra')} hint={tr('Required. The task must be verified; the server checks it.','Wajib. Tugas harus terverifikasi; server memeriksanya.')} value={taskId} onChange={e=>setTaskId(e.target.value)} required/>
  <Button size="sm" type="submit" disabled={!valid||busy}>{tr('Mark tested in lab','Tandai teruji di lab')}</Button>
  {!trimmed&&<Notice tone="info">{tr('Without a verified task id the badge cannot be set.','Tanpa ID tugas terverifikasi, lencana tidak bisa dipasang.')}</Notice>}
 </form>;
}
