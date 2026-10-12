/** Global home hero: an interactive Indonesia test map (docs/research/hero-map-spec.md, docs/research/hero-map-v2-plan.md). One path of dots per region, a CSS-transform camera that zooms to the selected region (click, tap or Enter only: no wheel, pinch or pan), and a fixed-size card inside the map frame so selecting never changes page layout. */
import {memo,startTransition,useCallback,useEffect,useLayoutEffect,useMemo,useRef,useState,type CSSProperties,type KeyboardEvent as RKeyEvent} from 'react';
import {Link} from 'react-router-dom';
import {ArrowDownIcon,ArrowRightIcon,ArrowUpRightIcon,CaretDownIcon,CaretRightIcon,InfoIcon,XIcon} from '@phosphor-icons/react';
import {useCompany} from '../use-company';
import {TEST_BUILDS,TEST_MONTHS,TEST_STRESSORS} from '../../../../packages/ops-contract/index';
import {BUILD_LABEL,KIND_LABEL,MONTH_LABEL,STRESS_LABEL,type Build,type Fact,type Hotspot,type Month,type Region,type RegionId,type Season,type Stressor} from './model';
import {REGION,REGIONS,UNKNOWNS} from './regions';
import {HOTSPOT,HOTSPOTS,isAccess} from './hotspots';
import {NATIONAL,density,regionSchools,spotSchools,type SchoolCount} from './schools';
import {BBOX,H,IDENTITY,PATH,W,camFor,cellOf,grid,placeLabels,textWidth,toCell,toScreen,unit,type Cam,type Cand,type Frame,type Placed,type Rect} from './layout';
import './hero-map.css';

const CODE:Record<string,RegionId>=Object.fromEntries(REGIONS.filter(r=>r.code).map(r=>[r.code,r.id]));
const NEIGHBOURS:[string,string,number,number][]=[['m','Malaysia',116.2,5.4],['b','Brunei',114.9,4.1],['p','Papua New Guinea',143,-6.6],['t','Timor-Leste',126,-9],['s','Singapore',102.4,2.5]];
const SEASON_WORD:Record<Season,string>={wet:'wet',dry:'dry',haze:'haze risk',none:''};
const BADGE={H:'High',M:'Medium',L:'Low'} as const;
const MONTH_NAME:Record<Month,string>={jan:'Jan',feb:'Feb',mar:'Mar',apr:'Apr',may:'May',jun:'Jun',jul:'Jul',aug:'Aug',sep:'Sep',oct:'Oct',nov:'Nov',dec:'Dec'};
const KIND_ORDER=['industrial','city','special-zone','agri','marine','energy-mining'];
const short=(s:string)=>s.split(/,| via | \(/)[0];
const reducedMotion=()=>window.matchMedia('(prefers-reduced-motion: reduce)').matches;
const NATIONAL_FACTS:Fact[]=[
 {t:'National mean air temperature 27.5 °C in 2024.',src:'BMKG',year:'2024',url:'https://www.bmkg.go.id/iklim/anomali-suhu-udara/anomali-suhu-udara-rata-rata-tahun-2024',conf:'H'},
 {t:'Relative humidity 70–100% (about 70–90% average in April 2025; above 80% across most of Indonesia in May 2020).',src:'BMKG',year:'2020–2025',url:'https://www.bmkg.go.id/siaran-pers/udara-terasa-panas-dan-gerah-fenomena-biasa-musim-kemarau-bmkg-himbau-masyarakat-ikuti-tips-dari-bmkg',conf:'H'},
];
const ENTRY:[string,string,string][]=[
 ['Type approval','Komdigi (formerly Kominfo/SDPPI), Permenkominfo 3/2024','https://peraturan.go.id/'],
 ['Importer ID','API-U or API-P, under Permendag 16/2025 and 21/2025','https://peraturan.go.id/'],
 ['SNI standards','Checked per HS code of your product','https://peraturan.go.id/'],
 ['Data protection','The PDP Law, UU 27/2022','https://peraturan.go.id/'],
];

type Lens={build:Build|null;stress:Stressor|null;month:Month|null;access:boolean;schools:boolean};
const NO_LENS:Lens={build:null,stress:null,month:null,access:false,schools:false};
const filtering=(l:Lens)=>!!(l.build||l.stress||l.access);
const hotspotMatches=(h:Hotspot,l:Lens)=>(!l.build||h.fit.includes(l.build))&&(!l.stress||h.stress.includes(l.stress))&&(!l.access||isAccess(h));
const regionLit=(r:Region,l:Lens,spots:Hotspot[])=>(!l.build||r.fit.includes(l.build))&&(!l.stress||r.stress.includes(l.stress))&&(!l.access||spots.some(isAccess));
const ctaHref=(l:Lens,region:RegionId,site?:string)=>{const q=new URLSearchParams({region});if(l.build)q.set('build',l.build);if(l.month)q.set('month',l.month);if(l.stress)q.set('stressor',l.stress);if(site)q.set('site',site);return `/partner?${q}`;};
const seasonOf=(r:Region,l:Lens):Season=>l.month?r.season[TEST_MONTHS.indexOf(l.month)]:'none';
/** "Haze Jul–Oct" or "Wet Jun–Aug", read off the region's own 12-month regime (only haze belts and Maluku have one worth a chip). */
const seasonChip=(r:Region)=>{const w:Season=r.season.includes('haze')?'haze':r.id==='maluku'?'wet':'none';if(w==='none')return null;const a=r.season.indexOf(w),b=r.season.lastIndexOf(w),n=(i:number)=>MONTH_NAME[TEST_MONTHS[i]];return `${w==='haze'?'Haze':'Wet'} ${n(a)}–${n(b)}`;};
const DESKTOP_MIN=900;

/** One `<path>` of dots per region. Only the `<g>` data attributes change with the lens and the selection, so the browser restyles 8 elements instead of 4,659 circles. */
const DotLayer=memo(function DotLayer({sel,lens,onKey}:{sel:RegionId|null;lens:Lens;onKey:(id:RegionId,e:RKeyEvent)=>void}){
 const spots=useMemo(()=>{const m:Record<string,Hotspot[]>={};for(const h of HOTSPOTS)(m[h.region]??=[]).push(h);return m;},[]);
 const ids=REGIONS.map(r=>r.id);
 const stateOf=(r:Region)=>sel===r.id?'sel':sel?'dim':filtering(lens)?(regionLit(r,lens,spots[r.id]??[])?'lit':'dim'):'base';
 return <>
  <g role="button" tabIndex={0} aria-label="Maritime Indonesia: test conditions" aria-pressed={sel==='maritime'} className="hm-sea" data-region="maritime" data-s={sel==='maritime'?'sel':'base'} onKeyDown={e=>onKey('maritime',e)}><rect x="0" y="0" width={W} height={H}/></g>
  <g className="hm-nb" aria-hidden="true">{NEIGHBOURS.map(([c])=><path key={c} d={PATH[c]??''}/>)}</g>
  {REGIONS.filter(r=>r.code).map(r=><g key={r.id} className="hm-g" role="button" tabIndex={0} aria-label={`${r.name}: test conditions`} aria-pressed={sel===r.id} data-region={r.id} data-s={stateOf(r)} data-season={seasonOf(r,lens)} data-dens={lens.schools?density(r.id,ids):undefined} onKeyDown={e=>onKey(r.id,e)}><path d={PATH[r.code]}/></g>)}
 </>;
});

type Sel={region:RegionId;spot?:string};
type Tab='tests'|'sites'|'why';
type PopId='build'|'stress'|'month';
type MFrame=Frame&{vis:number};
const cardWidth=(f:Frame)=>f.w>=1700?400:380;
const sideOf=(id:RegionId,f:Frame):'left'|'right'=>{const code=REGION[id]?.code,b=code?BBOX[code]:null;if(!b||!f.w)return'right';const{u,ox}=unit(f);return (ox+(b.x0+b.x1)/2*u)/f.w>.55?'left':'right';};
const factId=(owner:string,i:number)=>`fact-${owner}-${i}`;

function Tile({f,id,onSrc}:{f:Fact;id:string;onSrc:(id:string)=>void}){
 const label=`${f.t} Source: ${f.src}, ${f.year}.`;
 return <li className={`hm-stat${f.stat?'':' hm-stat-t'}`} title={f.t}>{f.stat?<><b>{f.stat.v}</b><span>{f.stat.l}</span></>:<span>{f.t}</span>}<sup><button type="button" className="hm-src" aria-label={`${label} Open in sources.`} onClick={()=>onSrc(id)}><span>{short(f.src)}</span> <span>{f.year}</span></button></sup></li>;
}

export function GlobalHero(){
 const root=useRef<HTMLElement>(null),stage=useRef<HTMLDivElement>(null),svg=useRef<SVGSVGElement>(null),dlg=useRef<HTMLDialogElement>(null),title=useRef<HTMLHeadingElement>(null),tip=useRef<HTMLParagraphElement>(null),cam$=useRef<HTMLDivElement>(null);
 const[kb,setKb]=useState<HTMLElement|null>(null);
 const[lens,setLens]=useState<Lens>(NO_LENS);const[sel,setSel]=useState<Sel|null>(null);const[drawer,setDrawer]=useState(false),[anchor,setAnchor]=useState<string|null>(null);
 const uiKey=`${sel?.region??''}/${sel?.spot??''}`;const[ui0,setUi]=useState<{key:string;tab:Tab;open:string|null;full:boolean}>({key:'',tab:'tests',open:null,full:false});
 const ui=ui0.key===uiKey?ui0:{key:uiKey,tab:'tests' as Tab,open:null,full:false},tab=ui.tab,open=ui.open,full=ui.full;
 const setTab=(t:Tab)=>setUi({...ui,tab:t}),setOpen=(f:(o:string|null)=>string|null)=>setUi({...ui,open:f(ui.open)}),setFull=(f:boolean|((b:boolean)=>boolean))=>setUi({...ui,full:typeof f==='function'?f(ui.full):f});
 const[pop,setPop]=useState<{id:PopId;x:number;y:number}|null>(null);
 const[frame,setFrame]=useState<MFrame>({w:0,h:0,vis:0}),[zooming,setZooming]=useState(false);
 const[mobile,setMobile]=useState(()=>typeof window!=='undefined'&&window.innerWidth<DESKTOP_MIN);
 const company=useCompany();const reply=company('replyTime'),price=company('priceBand');
 const spotsOf=useMemo(()=>{const m:Record<string,Hotspot[]>={};for(const h of HOTSPOTS)(m[h.region]??=[]).push(h);return m;},[]);
 const selRef=useRef(sel),fullRef=useRef(full),popRef=useRef(pop);useEffect(()=>{selRef.current=sel;fullRef.current=full;popRef.current=pop;});

 const set=<K extends keyof Lens>(k:K,v:Lens[K])=>startTransition(()=>setLens(l=>({...l,[k]:l[k]===v?NO_LENS[k]:v})));
 const measure=useCallback(()=>{const el=stage.current;if(!el)return;const t=el.getBoundingClientRect().top,vis=Math.min(el.clientHeight,window.innerHeight-Math.min(232,window.innerHeight*.34)-t);setFrame(f=>f.w===el.clientWidth&&f.h===el.clientHeight&&f.vis===vis?f:{w:el.clientWidth,h:el.clientHeight,vis});},[]);
 const kick=(from:RegionId|undefined,to:RegionId|undefined)=>{const z=(r?:RegionId)=>!!r&&r!=='maritime';if(from!==to&&(z(from)||z(to))&&!reducedMotion())setZooming(true);};
 const choose=useCallback((region:RegionId,spot?:string,keyboard=false)=>{measure();kick(selRef.current?.region,region);setKb(keyboard?document.activeElement as HTMLElement:null);setSel({region,spot});},[measure]);
 const close=useCallback(()=>{const o=kb;kick(selRef.current?.region,undefined);setKb(null);setSel(null);if(o?.isConnected)o.focus({preventScroll:true});},[kb]);
 const keyAct=useCallback((id:RegionId,e:RKeyEvent)=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();choose(id,undefined,true);}},[choose]);
 useEffect(()=>{if(kb&&sel)title.current?.focus({preventScroll:true});},[kb,sel]);

 // Esc order: popover (handled in the popover) > expanded sheet > selected site > selected region. The drawer is a native dialog and handles its own Esc.
 useEffect(()=>{const on=(e:globalThis.KeyboardEvent)=>{const a=document.activeElement;if(e.key!=='Escape'||dlg.current?.open||popRef.current||!(!a||a===document.body||root.current?.contains(a)))return;
  if(fullRef.current){setUi(u=>({...u,full:false}));return;}
  const s=selRef.current;if(s?.spot){setSel({region:s.region});return;}
  close();};document.addEventListener('keydown',on);return()=>document.removeEventListener('keydown',on);},[close]);
 useEffect(()=>{const d=dlg.current;if(!d)return;if(drawer&&!d.open)d.showModal();if(!drawer&&d.open)d.close();},[drawer]);
 useEffect(()=>{if(!drawer||!anchor)return;const d=dlg.current;requestAnimationFrame(()=>d?.querySelector(`[id="${anchor}"]`)?.scrollIntoView({block:'center'}));},[drawer,anchor]);
 useEffect(()=>{const mq=window.matchMedia(`(max-width:${DESKTOP_MIN-1}px)`),on=()=>setMobile(mq.matches);on();mq.addEventListener('change',on);return()=>mq.removeEventListener('change',on);},[]);

 // The one-shot scroll assist (founder request: one scroll at the top goes to section 2). Passive listeners only, and only when ALL hold: the event did not start over the map frame (which contains the card) or the drawer, scrollY < 8, and no card is open. A wheel over the map scrolls the page normally and never zooms.
 useEffect(()=>{
  const el=root.current;if(!el)return;let done=false,y0=0,ignore=false,atTop=false;
  const off=()=>{done=true;window.removeEventListener('wheel',wheel);window.removeEventListener('touchstart',start);window.removeEventListener('touchmove',move);};
  // `slack`: the compositor may already have applied this wheel tick before the main thread sees the event, so scrollY can read one tick ahead.
  const ready=(slack:number)=>document.querySelector<HTMLElement>('.result-landing')?.dataset.ready==='true'&&window.scrollY<8+slack&&!selRef.current&&!dlg.current?.open&&el.getBoundingClientRect().top>-8-slack;
  const inside=(t:EventTarget|null)=>t instanceof Element&&!!t.closest('.hm-stage,.hm-aside,.hm-drawer,.hm-pop');
  const go=()=>{if(done)return;off();document.getElementById('gap')?.scrollIntoView({behavior:reducedMotion()?'auto':'smooth'});};
  function wheel(e:WheelEvent){if(e.deltaY>0&&!e.ctrlKey&&!inside(e.target)&&ready(e.deltaY*(e.deltaMode===0?1:40)))go();}
  function start(e:TouchEvent){y0=e.touches[0].clientY;ignore=inside(e.target);atTop=window.scrollY<8;}
  function move(e:TouchEvent){if(!ignore&&atTop&&y0-e.touches[0].clientY>=40&&ready(1e4))go();}
  window.addEventListener('wheel',wheel,{passive:true});window.addEventListener('touchstart',start,{passive:true});window.addEventListener('touchmove',move,{passive:true});
  return off;
 },[]);

 // Frame size.
 useLayoutEffect(()=>{const el=stage.current;if(!el)return;measure();const ro=new ResizeObserver(measure);ro.observe(el);return()=>ro.disconnect();},[measure]);

 // Camera: zoom to the selected region inside the part of the frame the card does not cover.
 const region=sel?REGION[sel.region]:null,spot=sel?.spot?HOTSPOT[sel.spot]:null;
 const side=sel?sideOf(sel.region,frame):'right';
 const cw=cardWidth(frame),cardH=mobile?0:Math.min(frame.h-32,560);
 const cam=useMemo<Cam>(()=>{
  if(!frame.w||!sel||sel.region==='maritime')return IDENTITY;
  const box=BBOX[REGION[sel.region].code];if(!box)return IDENTITY;
  let safe:Rect;
  if(mobile)safe={x:0,y:0,w:frame.w,h:Math.max(90,frame.vis)};
  else{const g=cw+16+24;safe=side==='right'?{x:0,y:0,w:frame.w-g,h:frame.h}:{x:g,y:0,w:frame.w-g,h:frame.h};}
  return camFor(box,frame,safe,sel.region==='batam'?2:mobile?4:2.6);
 },[sel,frame,mobile,side,cw]);
 useEffect(()=>{if(!zooming)return;const t=window.setTimeout(()=>setZooming(false),620);return()=>window.clearTimeout(t);},[zooming]);

 // Hit testing. The svg rect already includes the camera transform; the meet-fit offset is undone with unit().
 const pickAt=(x:number,y:number,sea:boolean):{id:RegionId|null;c:number;r:number}=>{
  const el=svg.current;if(!el||!frame.w)return{id:null,c:-1,r:-1};
  const b=el.getBoundingClientRect(),{u,ox,oy}=unit(frame),c0=((x-b.left)/b.width*frame.w-ox)/u,r0=((y-b.top)/b.height*frame.h-oy)/u;
  if(c0<0||r0<0||c0>=W||r0>=H)return{id:null,c:c0,r:r0};
  const c=Math.floor(c0),r=Math.floor(r0),own=grid[r]?.[c]??'.';
  if(own>='a'&&own<='z')return{id:null,c,r};if(own!=='.')return{id:CODE[own],c,r};
  let best:RegionId|null=null,bd=9;for(let dr=-2;dr<=2;dr++)for(let dc=-2;dc<=2;dc++){const ch=grid[r+dr]?.[c+dc];if(ch&&ch>='A'&&ch<='Z'){const d=Math.hypot(dr,dc);if(d<bd){bd=d;best=CODE[ch];}}}
  return{id:best??(sea?'maritime':null),c,r};
 };
 const nearCode=(c:number,r:number,code:string,rad:number)=>{for(let dr=-rad;dr<=rad;dr++)for(let dc=-rad;dc<=rad;dc++)if(grid[r+dr]?.[c+dc]===code&&Math.hypot(dr,dc)<=rad)return true;return false;};

 // Hover never touches React state: one rAF reads the latest pointer, applies hysteresis and writes DOM attributes plus the tooltip transform.
 const hv=useRef({x:0,y:0,raf:0,cur:null as RegionId|null,cand:null as RegionId|null,frames:0,sea:0,over:false,widths:{} as Record<string,number>,step:(_ts:number)=>{}});
 const queued=(ts:number)=>hv.current.step(ts);
 const apply=(id:RegionId|null)=>{
  const h=hv.current,st=stage.current,t=tip.current;if(!st||!t)return;
  st.querySelector('.hm-g[data-h]')?.removeAttribute('data-h');
  if(id&&id!=='maritime')st.querySelector(`.hm-g[data-region="${id}"]`)?.setAttribute('data-h','');
  h.cur=id;
  if(!id){t.dataset.on='0';return;}
  const r=REGION[id];t.textContent=`${r.name} · ${r.identity}`;t.dataset.on='1';h.widths[id]??=t.offsetWidth;
 };
 const moveTip=()=>{const h=hv.current,st=stage.current,t=tip.current;if(!st||!t||!h.cur)return;const b=st.getBoundingClientRect(),w=h.widths[h.cur]??200;let x=h.x-b.left+14,y=h.y-b.top+14;if(x+w>b.width-4)x=h.x-b.left-14-w;if(y+30>b.height)y=h.y-b.top-14-30;t.style.transform=`translate(${Math.max(4,x)}px,${Math.max(4,y)}px)`;};
 const step=(ts:number)=>{
  const h=hv.current;h.raf=0;
  if(h.over||selRef.current){if(h.cur)apply(null);return;}
  const p=pickAt(h.x,h.y,false);let again=false;
  if(p.id===h.cur){h.cand=null;h.sea=0;}
  else if(p.id){
   const far=!h.cur||!nearCode(p.c,p.r,REGION[h.cur].code,3);
   if(far)apply(p.id);else if(h.cand===p.id){if(++h.frames>=2){apply(p.id);h.cand=null;}else again=true;}else{h.cand=p.id;h.frames=1;again=true;}
   h.sea=0;
  }else{
   h.cand=null;
   if(h.cur&&nearCode(p.c,p.r,REGION[h.cur].code,3))h.sea=0;
   else{const now=ts;if(!h.sea)h.sea=now;if(now-h.sea>=120){apply(null);h.sea=0;}else again=true;}
  }
  moveTip();if(again)h.raf=requestAnimationFrame(queued);
 };
 // Queued frames call the latest `step` (fresh frame and camera), never a stale closure.
 useLayoutEffect(()=>{hv.current.step=step;});
 useEffect(()=>()=>{const h=hv.current;if(h.raf)cancelAnimationFrame(h.raf);h.raf=0;},[]);
 const onMove=(e:React.PointerEvent)=>{if(e.pointerType!=='mouse')return;const h=hv.current;h.x=e.clientX;h.y=e.clientY;h.over=!!(e.target as Element).closest('.hm-aside');if(!h.raf)h.raf=requestAnimationFrame(queued);};
 const onLeave=()=>{const h=hv.current;if(h.raf)cancelAnimationFrame(h.raf);h.raf=0;h.sea=0;h.cand=null;if(h.cur)apply(null);};
 useEffect(()=>{if(sel)onLeave();},[sel]);// eslint-disable-line react-hooks/exhaustive-deps
 const onMapClick=(e:React.MouseEvent)=>{
  if(zooming||(e.target as Element).closest('[data-pin]'))return;
  const p=pickAt(e.clientX,e.clientY,true);
  if(!p.id||(p.id==='maritime'&&sel&&sel.region!=='maritime'))return;
  choose(p.id);
 };

 // Pins, labels and their collision placement (screen pixels, recomputed only on selection, lens, camera or size changes).
 const lensOn=filtering(lens);
 const pins=useMemo(()=>sel?(spotsOf[sel.region]??[]):lensOn?HOTSPOTS.filter(h=>hotspotMatches(h,lens)):HOTSPOTS.filter(h=>h.pin),[sel?.region,lens,lensOn,spotsOf]);// eslint-disable-line react-hooks/exhaustive-deps
 const regionLabelShown=(r:Region)=>sel?sel.region===r.id:(lensOn&&regionLit(r,lens,spotsOf[r.id]??[]))||(!!lens.month&&seasonOf(r,lens)!=='none')||(lens.schools&&!!regionSchools(r.id))||(r.id!=='batam'&&r.id!=='maritime');
 const regionLabelText=(r:Region)=>{const s=seasonOf(r,lens),n=lens.schools&&regionSchools(r.id);return `${r.id==='batam'?'Batam / Kepri':r.name}${s!=='none'?` · ${SEASON_WORD[s]}`:''}${n?` · ${n.n.toLocaleString('en')} SMK`:''}`;};
 const layout=useMemo(()=>{
  if(!frame.w)return{labels:new Map<string,Placed>(),pos:{} as Record<string,[number,number]>,hit:{} as Record<string,number>,more:{} as Record<string,number>,cands:[] as Cand[]};
  const at=(lon:number,lat:number)=>{const[c,r]=cellOf(lon,lat);return toScreen(frame,cam,c,r);};
  const pos:Record<string,[number,number]>={};for(const h of pins)pos[h.id]=at(h.lon,h.lat);
  const rank=(h:Hotspot)=>(h.planned?0:hotspotMatches(h,lens)&&lensOn?1:2)*10+KIND_ORDER.indexOf(h.kind);
  const ordered=[...pins].sort((a,b)=>rank(a)-rank(b));
  const labelled=sel?(mobile?[...(sel.spot?[HOTSPOT[sel.spot]]:[]),...ordered.filter(h=>h.id!==sel.spot)].slice(0,sel.spot?4:3):[...(sel.spot?[HOTSPOT[sel.spot]]:[]),...ordered.filter(h=>h.id!==sel.spot)]):lens.access?ordered:[];
  const cands:Cand[]=labelled.map(h=>({id:h.id,kind:'pin',x:pos[h.id][0],y:pos[h.id][1],w:textWidth(h.short??h.name)+12+(h.planned?textWidth(' PLANNED',8)+4:0)+14,h:19}));
  if(!mobile){
   if(!sel)for(const r of REGIONS)if(r.code&&regionLabelShown(r)){const[x,y]=at(...r.at),t=regionLabelText(r);cands.push({id:`r-${r.id}`,kind:'region',x,y,w:textWidth(t)+10,h:16,centre:true});}
   for(const[c,name,lon,lat]of NEIGHBOURS){const[x,y]=at(lon,lat);cands.push({id:`n-${c}`,kind:'nb',x,y,w:textWidth(name,9)+4,h:14,centre:true});}
  }
  const obs:Rect[]=[];
  if(mobile){if(sel)obs.push({x:0,y:Math.max(0,frame.vis),w:frame.w,h:frame.h});}
  else if(sel)obs.push({x:side==='right'?frame.w-cw-16:16,y:Math.max(16,(frame.h-cardH)/2),w:cw,h:cardH});
  else obs.push({x:16,y:frame.h-16-200,w:260,h:200});
  const code=sel?REGION[sel.region].code:'';
  const dots=(r:Rect)=>{if(!code)return 0;let n=0;for(let x=r.x;x<r.x+r.w;x+=6)for(let y=r.y;y<r.y+r.h;y+=6){const[c,rr]=toCell(frame,cam,x,y);if(grid[Math.floor(rr)]?.[Math.floor(c)]===code)n++;}return n;};
  const labels=placeLabels(cands,obs,pins.map(h=>({id:h.id,x:pos[h.id][0],y:pos[h.id][1]})),frame,dots);
  // Pins whose label did not fit join their nearest labelled neighbour as a "+n" badge.
  const more:Record<string,number>={};
  if(sel){const placed=pins.filter(h=>labels.has(h.id));if(placed.length)for(const h of pins)if(!labels.has(h.id)){let best=placed[0],bd=1e9;for(const p of placed){const d=Math.hypot(pos[p.id][0]-pos[h.id][0],pos[p.id][1]-pos[h.id][1]);if(d<bd){bd=d;best=p;}}more[best.id]=(more[best.id]??0)+1;}}
  // Hit area: 20px, shrunk so two close pins never share one (the nearest neighbour is always reachable at its own centre).
  const hit:Record<string,number>={};for(const h of pins){let d=20;for(const o of pins)if(o!==h)d=Math.min(d,Math.hypot(pos[o.id][0]-pos[h.id][0],pos[o.id][1]-pos[h.id][1]));hit[h.id]=Math.max(10,Math.floor(d));}
  return{labels,pos,hit,more,cands};
 },[pins,sel,lens,frame,cam,mobile,side,cw,cardH]);// eslint-disable-line react-hooks/exhaustive-deps

 // Popovers: positioned from the trigger when opened; Esc or an outside press closes and returns focus to the trigger.
 const openPop=(id:PopId,el:HTMLElement)=>{if(pop?.id===id){setPop(null);return;}const b=el.getBoundingClientRect();setPop({id,x:Math.min(b.left,window.innerWidth-260),y:b.bottom+4});};
 const closePop=useCallback((refocus=true)=>{const p=popRef.current;setPop(null);if(refocus&&p)document.querySelector<HTMLElement>(`[data-pop="${p.id}"]`)?.focus({preventScroll:true});},[]);
 useEffect(()=>{if(!pop)return;
  const down=(e:PointerEvent)=>{const t=e.target as Element;if(!t.closest('.hm-pop,[data-pop]'))setPop(null);};const away=()=>setPop(null);
  document.addEventListener('pointerdown',down);window.addEventListener('scroll',away,{passive:true});window.addEventListener('resize',away);
  requestAnimationFrame(()=>(document.querySelector<HTMLElement>('.hm-pop [aria-pressed=true]')??document.querySelector<HTMLElement>('.hm-pop button'))?.focus({preventScroll:true}));
  return()=>{document.removeEventListener('pointerdown',down);window.removeEventListener('scroll',away);window.removeEventListener('resize',away);};},[pop?.id]);// eslint-disable-line react-hooks/exhaustive-deps
 const stepMonth=(d:number)=>{const list:(Month|null)[]=[null,...TEST_MONTHS],i=list.indexOf(lens.month);startTransition(()=>setLens(l=>({...l,month:list[(i+d+list.length)%list.length]})));};

 const goGap=(e:{preventDefault:()=>void})=>{e.preventDefault();document.getElementById('gap')?.scrollIntoView({behavior:reducedMotion()?'auto':'smooth'});history.replaceState(null,'','#gap');};
 const active=lensOn||!!lens.month||lens.schools;
 const matches=useMemo(()=>lensOn?{r:REGIONS.filter(r=>r.code&&regionLit(r,lens,spotsOf[r.id]??[])).length,s:HOTSPOTS.filter(h=>hotspotMatches(h,lens)).length}:null,[lens,lensOn,spotsOf]);
 const lensName=[lens.build&&BUILD_LABEL[lens.build],lens.stress&&STRESS_LABEL[lens.stress],lens.access&&'Access'].filter(Boolean).join(' + ');
 const regionTotal=REGIONS.filter(r=>r.code).length;
 const result=matches?`${lensName}: ${matches.r} of ${regionTotal} regions, ${matches.s} sites.`:'';
 const openSrc=(id:string)=>{setAnchor(id);setDrawer(true);};
 const hot=(id:string,on:boolean,what:'pin'|'chip')=>{const sel2=what==='pin'?`[data-pin="${id}"]`:`[data-chip="${id}"]`;root.current?.querySelectorAll(sel2).forEach(n=>on?n.setAttribute('data-hot',''):n.removeAttribute('data-hot'));};
 const onTabKey=(tabs:Tab[])=>(e:RKeyEvent)=>{const i=tabs.indexOf(tab);let n=-1;if(e.key==='ArrowRight')n=(i+1)%tabs.length;else if(e.key==='ArrowLeft')n=(i-1+tabs.length)%tabs.length;else if(e.key==='Home')n=0;else if(e.key==='End')n=tabs.length-1;if(n<0)return;e.preventDefault();setTab(tabs[n]);document.getElementById(`hm-tab-${tabs[n]}`)?.focus({preventScroll:true});};

 const schoolCount:SchoolCount|undefined=region?(spot?spotSchools(spot.id):regionSchools(region.id)):undefined;
 const owner=spot?spot.id:region?.id??'';
 const factsAll=spot?spot.facts:region?.facts??[];
 const tiles=factsAll.map((f,i)=>({f,i})).filter(({f})=>f.hero&&f.conf!=='L').slice(0,3);
 const tabs:Tab[]=region?[ 'tests',...(!spot&&(spotsOf[region.id]?.length??0)>0?['sites' as Tab]:[]),'why']:[];
 const tests=spot?spot.tests:region?.tests??[];

 const ctaLabel=spot?(spot.short??spot.name):region?.cta;
 const hide=zooming;
 const pinNode=(h:Hotspot)=>{
  const[px,py]=layout.pos[h.id]??[0,0],pl=layout.labels.get(h.id),interactive=!!sel||!!pl,more=layout.more[h.id],hit=layout.hit[h.id]??20,o=hit/2;
  const style:CSSProperties={width:hit,height:hit,transform:`translate(${px-o}px,${py-o}px)`};
  const spanStyle:CSSProperties|undefined=pl?{left:pl.x-(px-o),top:pl.y-(py-o)}:undefined;
  return <button type="button" key={h.id} className="hm-pin" data-pin={h.id} data-kind={h.kind} data-planned={h.planned?'':undefined} data-label={pl?'':undefined} data-i={interactive?'':undefined} data-on={sel?.spot===h.id?'':undefined} style={style} tabIndex={interactive?0:-1} aria-hidden={interactive?undefined:true} aria-label={`${h.name}${h.planned?' (planned lab)':''}: test conditions`} aria-pressed={sel?.spot===h.id} onClick={()=>choose(h.region,h.id,false)} onKeyDown={e=>{if(e.key==='Enter'){e.preventDefault();choose(h.region,h.id,true);}}} onPointerEnter={()=>hot(h.id,true,'chip')} onPointerLeave={()=>hot(h.id,false,'chip')}><i/><span style={spanStyle}>{h.short??h.name}{h.planned&&<small> PLANNED</small>}{more?<b> +{more}</b>:null}</span></button>;
 };
 const leaders=pins.map(h=>{const p=layout.labels.get(h.id);return p?.leader?`M${p.leader[0]} ${p.leader[1]}L${p.leader[2]} ${p.leader[3]}`:'';}).join('');
 const popBody=(id:PopId)=>{
  const choice=(label:string,on:boolean,fn:()=>void)=><button type="button" key={label} aria-pressed={on} onClick={()=>{fn();closePop();}}>{label}</button>;
  return id==='build'?TEST_BUILDS.map(b=>choice(BUILD_LABEL[b],lens.build===b,()=>set('build',b))):id==='stress'?TEST_STRESSORS.map(s=>choice(STRESS_LABEL[s],lens.stress===s,()=>set('stress',s))):TEST_MONTHS.map(m=>choice(MONTH_LABEL[m],lens.month===m,()=>set('month',m)));
 };
 const trig=(id:PopId,label:string,value:string|null)=><button type="button" data-pop={id} className="hm-trig" aria-expanded={pop?.id===id} aria-controls={`hm-pop-${id}`} data-set={value?'':undefined} onClick={e=>openPop(id,e.currentTarget)}>{label}: {value??'Any'}<CaretDownIcon size={11} aria-hidden="true"/></button>;
 const schoolLine=(c:SchoolCount|undefined)=>c&&<p className="hm-schools" data-testid="schools-line"><span className="hm-sm-a"><b>{c.n.toLocaleString('en')}</b> SMK in {c.area}</span><span className="hm-sm-b">· potential reach, not partners</span><button type="button" className="hm-info" aria-label="About these school counts" onClick={()=>setTab('why')}><InfoIcon size={14}/></button></p>;
 const stress=region&&<div className="hm-stress">{(spot?spot.stress:region.stress).slice(0,3).map(s=><span key={s}>{STRESS_LABEL[s]}</span>)}{!spot&&seasonChip(region)&&<span data-k="season">{seasonChip(region)}</span>}{lens.build&&<em>{(spot?spot.fit:region.fit).includes(lens.build)?`Our read: fits ${BUILD_LABEL[lens.build]}`:`Not a typical ${BUILD_LABEL[lens.build]} site`}</em>}</div>;
 const cta=(label:string,href:string,testid:string)=><div className="hm-cta"><Link className="rl-button rl-button-dark" to={href} data-cta={testid}>{label} <ArrowRightIcon size={16}/></Link><div className="hm-cta-meta">{reply&&<small>{reply}</small>}{price&&<small>{price}</small>}<button type="button" className="hm-link" onClick={()=>{setAnchor(null);setDrawer(true);}}>Sources</button></div></div>;

 return <section ref={root} className="rl-hero hm" aria-labelledby="landing-title" data-testid="hero-map" data-focus={sel?.region??undefined}>
  <div className="hm-top">
   <div className="rl-hero-copy hm-copy" data-enter>
    <p className="rl-eyebrow">The real-world gateway for AI robotics in Indonesia</p>
    <h1 id="landing-title">Prove your robot where it actually breaks.</h1>
   </div>
   <div className="hm-lead" data-enter>
    <p className="hm-sub">Indonesia puts tropical heat, humidity above 80%, haze, monsoon floods, salt air and unstable power in one country. Pick what you build, and see where to test it.</p>
    <p className="hm-proof">National mean air temperature 27.5 °C in 2024 (BMKG) · relative humidity 70–100% (BMKG) · <button type="button" className="hm-link" onClick={()=>{setAnchor(null);setDrawer(true);}}>Sources</button></p>
   </div>
  </div>
  <div className="hm-lenses" role="group" aria-label="Map lenses" data-enter>
   <div className="hm-chips">
    {trig('build','I build',lens.build&&BUILD_LABEL[lens.build])}{trig('stress','Stressor',lens.stress&&STRESS_LABEL[lens.stress])}
    <span className="hm-month" role="group" aria-label="Month"><button type="button" aria-label="Previous month" onClick={()=>stepMonth(-1)}>◂</button>{trig('month','Month',lens.month&&MONTH_LABEL[lens.month])}<button type="button" aria-label="Next month" onClick={()=>stepMonth(1)}>▸</button></span>
    <button type="button" className="hm-tog" aria-pressed={lens.access} aria-label="Labs, free trade zone & KEK zones" title="Labs, free trade zone & KEK zones" onClick={()=>set('access',true)}>Access</button>
    <button type="button" className="hm-tog" aria-pressed={lens.schools} aria-label="School reach (SMK)" title="School reach (SMK): existing vocational schools" onClick={()=>set('schools',true)}>SMK reach</button>
   </div>
   <div className="hm-meta" aria-live="polite">{matches&&<b>{lensName} · {matches.r}/{regionTotal} regions · {matches.s} sites</b>}{lens.month?<span>Month: typical pattern, BMKG; varies by zone and year.</span>:lens.schools?<span>{Math.floor(NATIONAL.n/1000).toLocaleString('en')},000+ vocational schools nationwide, existing schools (not partners): Lab Mitra trains them into field-test labs.</span>:!matches&&<span>Lenses combine. General conditions in Indonesia, not test results.</span>}{active&&<button type="button" className="hm-link" onClick={()=>startTransition(()=>setLens(NO_LENS))}>Clear</button>}</div>
  </div>
  <div ref={stage} className="hm-stage" data-testid="hero-map-stage" data-zoom={sel&&cam.k>1?sel.region:undefined} data-zooming={zooming?'':undefined} style={{'--k':cam.k} as CSSProperties} onPointerMove={onMove} onPointerLeave={onLeave}>
   <div ref={cam$} className="hm-cam" style={{transform:`translate(${cam.tx}px,${cam.ty}px) scale(${cam.k})`}} onTransitionEnd={e=>{if(e.target===e.currentTarget)setZooming(false);}}>
    <svg ref={svg} className="hm-map" viewBox={`0 0 ${W} ${H}`} role="group" aria-label="Dot map of Indonesia: choose a region to see its test conditions" preserveAspectRatio="xMidYMid meet" onClick={onMapClick}>
     <DotLayer sel={sel?.region??null} lens={lens} onKey={keyAct}/>
    </svg>
   </div>
   <div className="hm-ov" data-hide={hide?'':undefined}>
    {leaders&&<svg className="hm-leaders" aria-hidden="true"><path d={leaders}/></svg>}
    {layout.cands.filter(c=>layout.labels.has(c.id)&&c.kind!=='pin').map(c=>{const p=layout.labels.get(c.id)!;const st:CSSProperties={transform:`translate(${p.x}px,${p.y}px)`};
     if(c.kind==='nb')return <span key={c.id} className="hm-nb-label" aria-hidden="true" style={st}>{NEIGHBOURS.find(n=>`n-${n[0]}`===c.id)![1]}</span>;
     const r=REGION[c.id.slice(2)],s=seasonOf(r,lens),n=lens.schools&&regionSchools(r.id);
     return <span key={c.id} className="hm-label" aria-hidden="true" data-s={sel?(sel.region===r.id?'sel':'dim'):lensOn?(regionLit(r,lens,spotsOf[r.id]??[])?'lit':'dim'):'base'} style={st}>{r.id==='batam'?'Batam / Kepri':r.name}{s!=='none'&&<i> · {SEASON_WORD[s]}</i>}{n&&<em> · {n.n.toLocaleString('en')} SMK</em>}</span>;})}
    {frame.w>0&&pins.map(pinNode)}
   </div>
   <p ref={tip} className="hm-tip" aria-hidden="true" data-on="0"/>
   <aside className={`hm-aside${region?' is-open':' hm-idle'}`} aria-label="Region details" data-testid="hero-panel" data-side={region?side:'left'} data-full={full?'':undefined}>
    {region?<div className="hm-panel">
     <button type="button" className="hm-handle" aria-expanded={full} onClick={()=>setFull(f=>!f)}><span className="hm-sr">{full?'Fewer details':'More details'}</span></button>
     <div className="hm-crumb"><nav aria-label="Breadcrumb"><button type="button" onClick={close}>Indonesia</button><CaretRightIcon size={10} aria-hidden="true"/>{spot?<button type="button" onClick={()=>choose(region.id)}>{region.id==='batam'?'Batam':region.name}</button>:<span aria-current="page">{region.id==='batam'?'Batam':region.name}</span>}{spot&&<><CaretRightIcon size={10} aria-hidden="true"/><span aria-current="page">{spot.short??spot.name}</span></>}</nav><button type="button" className="hm-x" aria-label="Close details" onClick={close}><XIcon size={16}/></button></div>
     <div className="hm-head"><h2 ref={title} tabIndex={-1}>{spot?spot.name:region.name}{spot?.planned&&<b className="hm-planned"> PLANNED LAB</b>}</h2><p className="hm-identity">{spot?<>{KIND_LABEL[spot.kind]} · {spot.identity}</>:region.identity}</p></div>
     <div className="hm-body">
     {tiles.length>0&&<ul className="hm-stats" data-n={tiles.length}>{tiles.map(({f,i})=><Tile key={i} f={f} id={factId(owner,i)} onSrc={openSrc}/>)}</ul>}
     {stress}
     {schoolLine(schoolCount)}
     <div className="hm-tabwrap">
      <div className="hm-tabs" role="tablist" aria-label="Card sections" onKeyDown={onTabKey(tabs)}>{tabs.map(t=><button type="button" key={t} role="tab" id={`hm-tab-${t}`} aria-selected={tab===t} aria-controls={`hm-panel-${t}`} tabIndex={tab===t?0:-1} onClick={()=>setTab(t)}>{t==='tests'?'Tests':t==='sites'?`Sites ${spotsOf[region.id].length}`:'Why'}</button>)}</div>
      <div className="hm-tabbody" role="tabpanel" id={`hm-panel-${tab}`} aria-labelledby={`hm-tab-${tab}`} tabIndex={-1}>
       {tab==='tests'&&<ul className="hm-tests">{tests.map((t,i)=>{const k=`${owner}-${i}`,ti=short(t),rest=t.slice(ti.length).replace(/^[,\s]+/,'');return <li key={k}><button type="button" aria-expanded={open===k} onClick={()=>setOpen(o=>o===k?null:k)}><b>{ti}</b>{rest&&<span data-open={open===k?'':undefined}>{rest}</span>}</button></li>;})}</ul>}
       {tab==='sites'&&!spot&&<ul className="hm-sites">{spotsOf[region.id].map(h=><li key={h.id}><button type="button" data-chip={h.id} onClick={()=>choose(region.id,h.id)} onPointerEnter={()=>hot(h.id,true,'pin')} onPointerLeave={()=>hot(h.id,false,'pin')} onFocus={()=>hot(h.id,true,'pin')} onBlur={()=>hot(h.id,false,'pin')}><i data-kind={h.kind}/>{h.short??h.name}{h.planned&&<small> PLANNED</small>}</button></li>)}</ul>}
       {tab==='why'&&<div className="hm-why">
        <ul className="hm-facts">{factsAll.filter(f=>f.hero&&f.conf!=='L').slice(0,3).map((f,i)=><li key={i}>{f.t}<sup><a href={f.url} target="_blank" rel="noopener noreferrer" aria-label={`Source: ${f.src}, ${f.year}`}>{short(f.src)}, {f.year}</a></sup></li>)}</ul>
        {spot?.planned&&<p className="hm-note">A planned AIoT lab city. No lab operates there yet.</p>}
        {!spot&&region.note&&<p className="hm-note">{region.note}</p>}
        {schoolCount&&<p className="hm-schools-full" data-testid="schools-full"><b>{schoolCount.n.toLocaleString('en')}</b> vocational schools (SMK) in {schoolCount.area}<sup><a href={schoolCount.url} target="_blank" rel="noopener noreferrer">{short(schoolCount.src)}, {schoolCount.year}</a></sup>. Existing schools, not partners: Lab Mitra can train them into field-test labs. <Link to="/id">About Lab Mitra (Indonesian)</Link></p>}
       </div>}
      </div>
     </div>
     </div>
     {cta(`Get a test plan · ${ctaLabel}`,ctaHref(lens,region.id,spot?.id),'hero-test-plan')}
    </div>:<div className="hm-panel hm-idlecard">
     <h2>Where would it break?</h2>
     <p>{result||'Click a region or the sea to zoom.'}</p>
     <div className="hm-cta"><Link className="rl-button rl-button-dark" to="/partner" data-cta="hero-partner">Partner with us <ArrowRightIcon size={16}/></Link><div className="hm-cta-meta">{reply&&<small>{reply}</small>}{price&&<small>{price}</small>}<button type="button" className="hm-link" onClick={()=>{setAnchor(null);setDrawer(true);}}>Sources</button></div></div>
    </div>}
   </aside>
  </div>
  <div className="hm-regionchips" role="group" aria-label="Regions">{REGIONS.map(r=><button type="button" key={r.id} aria-pressed={sel?.region===r.id} onClick={()=>choose(r.id)}>{r.id==='batam'?'Batam':r.name}</button>)}</div>
  <div className="hm-bottom"><a className="hm-scroll" href="#gap" onClick={goGap}>Scroll to the gap <ArrowDownIcon size={14}/></a><span>General conditions in Indonesia, not test results.</span></div>
  {pop&&<div id={`hm-pop-${pop.id}`} className="hm-pop" role="group" aria-label={pop.id==='build'?'I build':pop.id==='stress'?'Stressor':'Month'} data-kind={pop.id} style={{left:pop.x,top:pop.y}} onKeyDown={e=>{if(e.key==='Escape'){e.stopPropagation();closePop();}}}>{popBody(pop.id)}</div>}
  <ul className="hm-sr" aria-label="Regions and places, as a list">{REGIONS.map(r=><li key={r.id}><button type="button" onClick={()=>choose(r.id,undefined,true)}>{r.name}: {r.identity}</button>{(spotsOf[r.id]?.length??0)>0&&<ul>{spotsOf[r.id].map(h=><li key={h.id}><button type="button" onClick={()=>choose(r.id,h.id,true)}>{h.name}{h.planned?' (planned lab)':''}</button></li>)}</ul>}</li>)}</ul>
  <dialog ref={dlg} className="hm-drawer" aria-labelledby="hm-drawer-title" onClose={()=>setDrawer(false)} onClick={e=>{if(e.target===dlg.current)setDrawer(false);}}>
   {drawer&&<div className="hm-drawer-body">
    <div className="hm-panel-head"><h2 id="hm-drawer-title">Sources &amp; confidence</h2><button type="button" className="hm-x" aria-label="Close sources" onClick={()=>setDrawer(false)}><XIcon size={18}/></button></div>
    <p>Every figure on the map, with its source and year. H = high (official or primary source), M = medium (press or secondary report of an official figure), L = low (conflicting or undated; never shown on the map). The &quot;I build&quot; fit and the stressor tags are our editorial reading of the scenarios below, not measurements.</p>
    <DrawerGroup name="Indonesia, national" items={NATIONAL_FACTS.map(f=>({f}))}/>
    {REGIONS.map(r=><DrawerGroup key={r.id} name={r.name} items={[...r.facts.map((f,i)=>({f,id:factId(r.id,i)})),...schoolFacts(r.id,'The region').map(f=>({f})),...(spotsOf[r.id]??[]).flatMap(h=>[...schoolFacts(h.id,h.name,true).map(f=>({f,id:undefined as string|undefined})),...h.facts.map((f,i)=>({f,id:factId(h.id,i)}))].map(({f,id})=>({f:{...f,t:f.t.startsWith(h.name)?f.t:`${h.name}: ${f.t}`},id})))]}/>)}
    <h3>What we don&apos;t know yet</h3><ul className="hm-facts">{UNKNOWNS.map(u=><li key={u}>{u}</li>)}</ul>
   </div>}
  </dialog>
 </section>;
}
const schoolFacts=(id:string,label:string,spot=false):Fact[]=>{const c=spot?spotSchools(id):regionSchools(id);return c?[{t:`${label}: ${c.n.toLocaleString('en')} vocational schools (SMK) in ${c.area}: existing schools and potential Lab Mitra reach, not partners.`,src:c.src,year:c.year,url:c.url,conf:c.conf}]:[];};
function DrawerGroup({name,items}:{name:string;items:{f:Fact;id?:string}[]}){
 return <section className="hm-dg"><h3>{name}</h3><ul>{items.map(({f,id},i)=><li key={i} id={id}><span className="hm-conf" data-conf={f.conf} title={`${BADGE[f.conf]} confidence`}>{f.conf}<span className="hm-sr"> {BADGE[f.conf]} confidence</span></span><span>{f.t} <a href={f.url} target="_blank" rel="noopener noreferrer">{f.src}, {f.year} <ArrowUpRightIcon size={11} aria-hidden="true"/></a></span></li>)}</ul></section>;
}

/** Entry path and unknowns, shown after the gap section. */
export function EntryPath(){
 return <section className="rl-section hm-entry" aria-labelledby="hm-entry-title" data-reveal>
  <div><p className="rl-eyebrow">ENTRY PATH</p><h2 id="hm-entry-title">The steps we help you through.</h2><p className="hm-entry-note">Bringing hardware into Indonesia involves these official steps. AIoT helps you through them; the approvals themselves come from the authorities.</p></div>
  <ol>{ENTRY.map(([h,p,url],i)=><li key={h}><span>0{i+1}</span><h3>{h}</h3><p>{p}</p><a href={url} target="_blank" rel="noopener noreferrer">Official regulations <ArrowUpRightIcon size={12} aria-hidden="true"/></a></li>)}</ol>
  <div className="hm-unknown"><h3>What we don&apos;t know yet</h3><ul>{UNKNOWNS.map(u=><li key={u}>{u}</li>)}</ul></div>
 </section>;
}
