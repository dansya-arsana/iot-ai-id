import {useEffect,useId,useRef,useState,type ReactNode} from 'react';
import {Link} from 'react-router-dom';
import {ArrowRightIcon,ArrowUpRightIcon,ListIcon,MagnifyingGlassIcon,SquaresFourIcon,WarningIcon,XIcon} from '@phosphor-icons/react';
import {api} from './api';
import {BuildProgressionGuide} from './build-progression-guide';
import {useLang} from './i18n';
import {Button,EmptyState,Eyebrow,IconButton,Input,Notice,SectionHeader,Segmented,Select,SpecList,Spinner,Tag,TagList,TextLink} from './ui';
import type {HardwareReference} from '../../../packages/hardware-library/index';
import './hardware-library.css';

type Tr=(en:string,id:string)=>string;
const pad=(n:number)=>String(n).padStart(2,'0');
const host=(url:string)=>{try{return new URL(url).hostname.replace(/^www\./,'');}catch{return url;}};
function hardwareKindLabel(kind:HardwareReference['kind'],tr:Tr){return kind==='board'?tr('Board','Board'):kind==='sensor'?tr('Sensor','Sensor'):tr('Module','Modul');}

type Variant='catalog'|'sheet';
/**
 * Hardware reference catalog. `catalog` (default) shows filters, a card grid and an inline spec sheet for the selected card;
 * `sheet` shows the full spec sheet for `initialId` followed by the catalog as links to other references.
 */
export function HardwareLibraryBrowser({initialId='',variant='catalog',linkSheets=false,onSelected}:{initialId?:string;variant?:Variant;linkSheets?:boolean;onSelected?:(record:HardwareReference|undefined)=>void}={}){
 const {tr}=useLang();const uid=useId();
 const [records,setRecords]=useState<HardwareReference[]>([]),[error,setError]=useState(''),[loading,setLoading]=useState(true),[search,setSearch]=useState(''),[kind,setKind]=useState(''),[category,setCategory]=useState(''),[family,setFamily]=useState(''),[protocol,setProtocol]=useState(''),[selectedId,setSelectedId]=useState(initialId);
 const [view,setView]=useState<'grid'|'list'>('grid');
 const detailRef=useRef<HTMLDivElement>(null),scrollOnSelect=useRef(false);
 useEffect(()=>{let active=true;const bundled=()=>import('../../../packages/hardware-library/index').then(module=>module.hardwareLibrary);const request=window.location.hostname==='iot.ai.id'?bundled():api('/hardware').then(data=>data.catalog as HardwareReference[]);request.then(catalog=>{if(active)setRecords(catalog);}).catch(async()=>{const catalog=await bundled();if(active){setRecords(catalog);setError('Mode referensi offline. Katalog bawaan tersedia; data proyek tidak dimuat.');}}).finally(()=>{if(active)setLoading(false);});return()=>{active=false;};},[]);
 const visible=records.filter(r=>(!kind||r.kind===kind)&&(!category||r.category===category)&&(!family||r.family===family)&&(!protocol||r.protocols.includes(protocol))&&JSON.stringify(r).toLowerCase().includes(search.toLowerCase()));const selected=records.find(r=>r.id===selectedId);
 useEffect(()=>{onSelected?.(selected);},[selected,onSelected]);
 useEffect(()=>{
  if(!scrollOnSelect.current||!detailRef.current)return;scrollOnSelect.current=false;
  const box=detailRef.current.getBoundingClientRect();
  if(box.top<0||box.top>window.innerHeight*.6)detailRef.current.scrollIntoView({block:'start',behavior:window.matchMedia('(prefers-reduced-motion: reduce)').matches?'auto':'smooth'});
 },[selectedId]);
 const filtered=!!(search||kind||category||family||protocol);
 const resetFilters=()=>{setSearch('');setKind('');setCategory('');setFamily('');setProtocol('');};
 const select=(id:string)=>{scrollOnSelect.current=true;setSelectedId(id);};
 const all=tr('All','Semua');

 const toolbar=<div className="hwl-toolbar">
  <div className="hwl-search">
   <Input id="reference-search" label={tr('Search devices or aliases','Cari perangkat atau alias')} type="search" value={search} onChange={e=>setSearch(e.target.value)} placeholder={tr('Raspy, Arduino, CO2, soil…','Raspy, Arduino, CO2, tanah…')} autoComplete="off"/>
   <MagnifyingGlassIcon className="hwl-search-icon" aria-hidden="true"/>
  </div>
  <div className="hwl-filters">
   <Select id={`${uid}-kind`} label={tr('Kind','Jenis')} value={kind} onChange={e=>setKind(e.target.value)}><option value="">{all}</option><option value="board">{hardwareKindLabel('board',tr)}</option><option value="sensor">{hardwareKindLabel('sensor',tr)}</option><option value="module">{hardwareKindLabel('module',tr)}</option></Select>
   {[{key:'category',label:tr('Category','Kategori'),value:category,set:setCategory,values:records.map(r=>r.category)},{key:'family',label:tr('Family','Keluarga'),value:family,set:setFamily,values:records.map(r=>r.family)},{key:'protocol',label:tr('Protocol','Protokol'),value:protocol,set:setProtocol,values:records.flatMap(r=>r.protocols)}].map(f=><Select key={f.key} id={`${uid}-${f.key}`} label={f.label} value={f.value} onChange={e=>f.set(e.target.value)}><option value="">{all}</option>{[...new Set(f.values)].sort().map(v=><option key={v} value={v}>{v}</option>)}</Select>)}
  </div>
  <div className="hwl-meta">
   <p className="hwl-count" aria-live="polite"><strong>{visible.length}</strong> {tr(`of ${records.length} references`,`dari ${records.length} referensi`)}</p>
   <div className="hwl-meta-actions">
    {filtered&&<Button variant="ghost" size="sm" onClick={resetFilters}>{tr('Reset filters','Atur ulang filter')}</Button>}
    <Segmented<'grid'|'list'> size="sm" label={tr('Result layout','Tata letak hasil')} value={view} onChange={setView} options={[{value:'grid',label:<><SquaresFourIcon aria-hidden="true"/><span className="ds-sr-only">{tr('Grid','Kisi')}</span></>},{value:'list',label:<><ListIcon aria-hidden="true"/><span className="ds-sr-only">{tr('List','Daftar')}</span></>}]}/>
   </div>
  </div>
 </div>;

 const cardBody=(r:HardwareReference)=><>
  <span className="hwl-card-top"><Tag>{hardwareKindLabel(r.kind,tr)}</Tag><span className="hwl-card-category">{r.category}</span></span>
  <span className="hwl-card-text"><strong className="hwl-card-name">{r.name}</strong><span className="hwl-card-summary">{r.summary}</span></span>
  <span className="hwl-card-foot"><span className="hwl-card-tags">{r.protocols.map(p=><Tag key={p}>{p}</Tag>)}{r.support==='recipe_available'&&<Tag tone="ok">{tr('ESP32 recipe','Resep ESP32')}</Tag>}</span><code className="hwl-card-id">{r.id}</code></span>
 </>;
 const cardClass=(active:boolean)=>`reference-result hwl-card ds-card ds-card--interactive${active?' hwl-card--active ds-brackets':''}`;
 const results=<>
  {loading&&<div className="hwl-loading"><Spinner label={tr('Loading library','Memuat pustaka')}/><span aria-hidden="true">{tr('Loading library…','Memuat pustaka…')}</span></div>}
  {!!visible.length&&<ul className={`reference-results hwl-results hwl-results--${view}`}>
   {visible.map(r=><li key={r.id}>{variant==='sheet'
    ?<Link to={`/hardware/${r.id}`} className={cardClass(r.id===selectedId)} aria-current={r.id===selectedId?'page':undefined}>{cardBody(r)}</Link>
    :<button type="button" className={cardClass(selectedId===r.id)} aria-pressed={selectedId===r.id} onClick={()=>select(r.id)}>{cardBody(r)}</button>}</li>)}
  </ul>}
  {!loading&&!visible.length&&<EmptyState eyebrow={tr('NO MATCHES','TIDAK ADA HASIL')} title={tr('No hardware matches these filters.','Tidak ada perangkat yang cocok.')} action={filtered?<Button variant="secondary" size="sm" onClick={resetFilters}>{tr('Reset filters','Atur ulang filter')}</Button>:undefined}>{tr('Try an alias such as “raspy” or “CO2”, or clear the filters.','Coba alias seperti “raspy” atau “CO2”, atau hapus filter.')}</EmptyState>}
 </>;
 const offline=error&&<Notice tone="info" title={tr('Offline reference mode','Mode referensi offline')}>{tr('The bundled catalog is available; project data is not loaded.','Katalog bawaan tersedia; data proyek tidak dimuat.')}</Notice>;
 const notFound=selectedId&&!loading&&!selected&&<Notice tone="error" title={tr('Hardware reference not found.','Referensi perangkat tidak ditemukan.')} action={variant==='sheet'?<TextLink to="/hardware">{tr('Back to library','Kembali ke pustaka')}</TextLink>:undefined}>{tr(`No reference with the ID “${selectedId}” exists in the library.`,`Tidak ada referensi dengan ID “${selectedId}” di pustaka.`)}</Notice>;

 if(variant==='sheet')return <section className="hwl hwl--sheet" aria-label={tr('Hardware reference','Referensi hardware')}>
  {offline}{notFound}
  {loading&&!selected&&<div className="hwl-loading"><Spinner label={tr('Loading reference','Memuat referensi')}/><span aria-hidden="true">{tr('Loading reference…','Memuat referensi…')}</span></div>}
  {selected&&<ReferenceSheet record={selected} mode="page" tr={tr}/>}
  <section className="hwl-browse" aria-label={tr('Browse the hardware library','Jelajahi pustaka hardware')}>
   <SectionHeader eyebrow={tr('LIBRARY / ALL REFERENCES','PUSTAKA / SEMUA REFERENSI')} title={tr('Browse other hardware.','Jelajahi perangkat lain.')}/>
   {toolbar}<div className="hwl-body">{results}</div>
  </section>
  <BuildProgressionGuide/>
 </section>;

 return <section className="hwl" aria-label={tr('Hardware reference library','Pustaka referensi hardware')}>
  {toolbar}
  <p className="hwl-disclaimer">{tr('Specification data only; physical evidence comes from experiments.','Data spesifikasi; bukti fisik mengikuti eksperimen.')}</p>
  {offline}{notFound}
  <div className={`hwl-body${selected?' hwl-body--split':''}`}>
   <div className="hwl-main">{results}</div>
   {selected&&<div className="hwl-aside" ref={detailRef}><ReferenceSheet record={selected} mode="inline" tr={tr} onClose={()=>setSelectedId('')} sheetHref={linkSheets?`/hardware/${selected.id}`:undefined}/></div>}
  </div>
  <BuildProgressionGuide/>
 </section>;
}

function ReferenceSheet({record,mode,tr,onClose,sheetHref}:{record:HardwareReference;mode:'inline'|'page';tr:Tr;onClose?:()=>void;sheetHref?:string}){
 const uid=useId();const H=mode==='page'?'h2':'h3';
 const recipe=record.support==='recipe_available';
 const list=(items:string[])=><ul className="hwl-list">{items.map(text=><li key={text}>{text}</li>)}</ul>;
 const sections:{key:string;title:string;body:ReactNode;show:boolean}[]=[
  {key:'specs',title:tr('Specifications','Spesifikasi'),body:<SpecList rows={record.specifications.map(s=>[s.label,s.value] as [ReactNode,ReactNode])}/>,show:true},
  {key:'electrical',title:tr('Electrical','Daya & logika'),body:list(record.electrical),show:true},
  {key:'pinout',title:tr('Pinout','Pinout'),body:list(record.pinout),show:true},
  {key:'software',title:tr('Software','Software'),body:<TagList items={record.software}/>,show:record.software.length>0},
  {key:'uses',title:tr('Use cases','Contoh penggunaan'),body:list(record.useCases),show:true},
  {key:'limits',title:tr('Limitations','Batasan & perhatian'),body:<div className="hwl-limits"><WarningIcon size={18} weight="bold" aria-hidden="true"/>{list(record.limitations)}</div>,show:true},
  {key:'sources',title:tr('Sources','Sumber produsen'),body:<ul className="hwl-sources">{record.sources.map(s=><li key={s.url}><a href={s.url} target="_blank" rel="noopener noreferrer"><span><span className="hwl-source-title">{s.title}</span><span className="hwl-source-host">{host(s.url)}</span></span><ArrowUpRightIcon aria-hidden="true"/><span className="ds-sr-only"> {tr('(opens in a new tab)','(membuka tab baru)')}</span></a></li>)}</ul>,show:true},
 ];
 return <article className={`reference-detail hwl-sheet hwl-sheet--${mode}`} aria-labelledby={mode==='inline'?`${uid}-name`:undefined} aria-label={mode==='page'?tr(`${record.name} spec sheet`,`Lembar spesifikasi ${record.name}`):undefined}>
  {mode==='inline'&&<header className="hwl-sheet-head">
   <div className="hwl-sheet-title"><Eyebrow>{hardwareKindLabel(record.kind,tr)} / {record.family}</Eyebrow><h2 id={`${uid}-name`}>{record.name}</h2><p>{record.summary}</p></div>
   {onClose&&<IconButton label={tr('Close details','Tutup detail')} onClick={onClose}><XIcon aria-hidden="true"/></IconButton>}
  </header>}
  <div className="hwl-sheet-grid">
   <aside className="hwl-sheet-meta" aria-label={tr('Reference status','Status referensi')}>
    <div className="hwl-status">
     <span className="hwl-label">{tr('Status','Status')}</span>
     <p>{recipe?tr('Available in a registered ESP32 recipe','Tersedia dalam resep ESP32 yang terdaftar'):tr('Planning reference — not yet runnable','Referensi perencanaan; belum dapat dijalankan')}</p>
     <span className="hwl-tags"><Tag tone={recipe?'ok':'neutral'}>{recipe?tr('Recipe available','Resep tersedia'):tr('Planning only','Hanya perencanaan')}</Tag><Tag>{tr('Specification only','Hanya spesifikasi')}</Tag></span>
    </div>
    <SpecList className="hwl-facts" rows={[
     [tr('ID','ID'),<code key="id" className="hwl-code">{record.id}</code>],
     [tr('Kind','Jenis'),hardwareKindLabel(record.kind,tr)],
     [tr('Category','Kategori'),record.category],
     [tr('Family','Keluarga'),record.family],
     [tr('Protocols','Protokol'),<span key="p" className="hwl-tags">{record.protocols.map(p=><Tag key={p}>{p}</Tag>)}</span>],
     ...(record.aliases.length?[[tr('Aliases','Alias'),record.aliases.join(', ')] as [ReactNode,ReactNode]]:[]),
     [tr('Version','Versi'),`v${record.version}`],
    ]}/>
   </aside>
   <div className="hwl-sheet-main">
    {sections.filter(s=>s.show).map((s,i)=><section key={s.key} className={`hwl-section hwl-section--${s.key}`} aria-labelledby={`${uid}-${s.key}`}>
     <div className="hwl-section-head"><span className="hwl-section-index" aria-hidden="true">{pad(i+1)}</span><H id={`${uid}-${s.key}`}>{s.title}</H></div>
     {s.body}
    </section>)}
   </div>
  </div>
  <footer className="hwl-sheet-foot">
   <p>{tr(`Version ${record.version}. The module variant must match the source. No physical testing is claimed.`,`Versi ${record.version}. Varian modul harus sesuai sumber. Tidak ada klaim pengujian fisik.`)}</p>
   {sheetHref&&<TextLink to={sheetHref}>{tr('Open full spec sheet','Buka lembar spesifikasi')}<ArrowRightIcon aria-hidden="true"/></TextLink>}
  </footer>
 </article>;
}
