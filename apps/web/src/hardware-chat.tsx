import {HardwareLibraryBrowser} from './hardware-library';
import {useState} from 'react';
import {post} from './api';
import {useLang} from './i18n';
import {Button,Eyebrow,Input,Notice,Segmented,Select,Tag,Textarea} from './ui';
export function HardwareChat({project,onRefresh,blocked=false}:{project:any;onRefresh:()=>Promise<void>;blocked?:boolean}) {
 const {tr}=useLang();
 const [message,setMessage]=useState(''),[purpose,setPurpose]=useState<'design'|'debug'>('design'),[pending,setPending]=useState(false),[error,setError]=useState('');
 async function send(){if(!message.trim()||pending||project.busy||blocked)return;setPending(true);setError('');try{await post(`/projects/${project.id}/chat`,{message:message.trim(),purpose,expectedContractId:project.contractId??null,expectedDraftId:project.activeDesign?.id??null});setMessage('');}catch(e){setError((e as Error).message);}finally{await onRefresh();setPending(false);}}
 const locked=pending||project.busy||blocked;
 return <section className="hardware-chat">
  <header className="wb-chat-head"><Eyebrow as="span">{tr('AI hardware engineer','AI hardware engineer')}</Eyebrow><h2>{tr('Describe it, then we wire it.','Ngomong, lalu kita rangkai.')}</h2></header>
  <div className="chat-history" role="log" aria-live="polite">
   {!(project.chatMessages?.length)&&<p className="wb-chat-empty">{tr('Describe the device you want. For corrections, choose “Check results” so the AI uses the latest experiment evidence.','Ceritakan alat yang kamu mau. Untuk koreksi, pilih “Periksa hasil” agar AI memakai bukti eksperimen terbaru.')}</p>}
   {project.chatMessages?.map((m:any)=><div className={'chat-message '+m.role} key={m.id}><strong>{m.role==='user'?tr('You','Kamu'):tr('Hardware engineer','Hardware engineer')}</strong><p>{m.message}</p>{m.experimentId&&<small>{tr('Experiment evidence','Bukti eksperimen')} {m.experimentId.slice(0,8)}</small>}</div>)}
  </div>
  <form className="wb-composer" onSubmit={e=>{e.preventDefault();send();}}>
   <Select id="chat-purpose" label={tr('Conversation purpose','Tujuan percakapan')} value={purpose} disabled={locked} onChange={e=>setPurpose(e.target.value as 'design'|'debug')}><option value="design">{tr('Create / change the design','Buat / ubah rancangan')}</option><option value="debug">{tr('Check results & issues','Periksa hasil & keluhan')}</option></Select>
   <Textarea id="hardware-message" label={tr('Message for the hardware engineer','Pesan untuk hardware engineer')} value={message} maxLength={2000} rows={4} onChange={e=>setMessage(e.target.value)} placeholder={tr('Move SDA to GPIO18. Or: the sensor is not reading, please check the log.','Ganti SDA ke GPIO18. Atau: sensor belum terbaca, tolong periksa log.')}/>
   <small>{tr('Messages are processed by an AI provider to help the build. Chat history is stored locally and does not become shared memory automatically.','Pesan diproses provider AI untuk membantu build. Riwayat chat disimpan lokal, tidak otomatis jadi memory bersama.')}</small>
   <Button type="submit" size="sm" disabled={!message.trim()||locked}>{pending?tr('Drafting the design…','Menyusun rancangan…'):tr('Send message','Kirim pesan')}</Button>
   {error&&<Notice tone="error">{error}</Notice>}
  </form>
 </section>;
}
export function ComponentCatalog({catalog,project,onRefresh,blocked=false}:{catalog:any[];project:any;onRefresh:()=>Promise<void>;blocked?:boolean}) {
 const {tr}=useLang();
 const [tab,setTab]=useState<'parts'|'reference'>('parts');
 const [search,setSearch]=useState(''),[pending,setPending]=useState(false),[error,setError]=useState('');
 const selected:string[]=project.activeDesign?.componentIds??project.contracts.find((v:any)=>v.id===project.contractId)?.contract.components.map((c:any)=>c.manifest.id)??[];
 async function change(componentId:string,operation:'add'|'remove'){setPending(true);setError('');try{await post(`/projects/${project.id}/components`,{componentId,operation,expectedContractId:project.contractId??null,expectedDraftId:project.activeDesign?.id??null});}catch(e){setError((e as Error).message);}finally{await onRefresh();setPending(false);}}
 const locked=pending||project.busy||blocked;
 return <section className="catalog-library">
  <Segmented<'parts'|'reference'> size="sm" label={tr('Choose catalog','Pilih katalog')} value={tab} onChange={setTab} options={[{value:'parts',label:tr('Draft parts','Komponen draft')},{value:'reference',label:tr('IoT library','Pustaka IoT')}]}/>
  {tab==='reference'?<HardwareLibraryBrowser/>:<>
   <h3>{tr('All components','Semua komponen')}</h3>
   {blocked&&<Notice tone="warn">{tr('Apply or discard wiring edits before changing the catalog.','Terapkan atau buang edit kabel sebelum mengubah katalog.')}</Notice>}
   <Input id="catalog-search" label={tr('Search parts','Cari asset')} value={search} onChange={e=>setSearch(e.target.value)} placeholder={tr('Sensor, LED, button…','Sensor, LED, tombol…')} hint={tr('Drag a part onto the draft, or use Add.','Drag asset ke area draft, atau gunakan tombol Tambah.')}/>
   <div className="catalog-items">{catalog.filter(c=>(c.name+' '+c.id).toLowerCase().includes(search.toLowerCase())).map(c=><div className="catalog-item" key={c.id} draggable={!locked} onDragStart={e=>e.dataTransfer.setData('application/x-iot-component',c.id)}>
    <span className="catalog-category">{c.protocol==='i2c'?tr('I2C sensors & displays','Sensor & layar I2C'):tr('Digital input & output','Input & output digital')}</span>
    <strong>{c.name}</strong>
    <div className="wb-catalog-row"><Tag tone={c.support==='golden'?'ok':'neutral'}>{c.support==='golden'?tr('Executable recipe','Resep executable'):tr('Planning reference','Referensi perencanaan')}</Tag><Button size="sm" variant="secondary" disabled={locked} onClick={()=>change(c.id,selected.includes(c.id)?'remove':'add')}>{selected.includes(c.id)?tr('Remove','Hapus'):tr('Add','Tambah')}</Button></div>
   </div>)}</div>
   <div className="catalog-drop" onDragOver={e=>e.preventDefault()} onDrop={e=>{e.preventDefault();const cid=e.dataTransfer.getData('application/x-iot-component');if(!locked&&catalog.some(c=>c.id===cid))change(cid,'add');}}>
    <strong>{tr('Drop parts into the draft','Drop komponen untuk draft')}</strong>
    <p>{selected.map(cid=>catalog.find(c=>c.id===cid)?.name??cid).join(' + ')||tr('No parts yet','Belum ada komponen')}</p>
    <small>{tr('After choosing, ask the chat to redraft the wiring and firmware.','Setelah memilih, minta chat menyusun ulang wiring dan firmware.')}</small>
   </div>
   {error&&<Notice tone="error">{error}</Notice>}
  </>}
 </section>;
}
