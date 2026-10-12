/** Global home hero: an interactive Indonesia test map (docs/research/hero-map-spec.md). Inline SVG dots, no map library, no gesture zoom or pan, and no scroll hijacking. */
import {memo,useCallback,useEffect,useMemo,useRef,useState,type CSSProperties,type KeyboardEvent} from 'react';
import {Link} from 'react-router-dom';
import {ArrowDownIcon,ArrowRightIcon,ArrowUpRightIcon,XIcon} from '@phosphor-icons/react';
import {heroGrid} from '../hero-map-data';
import {useCompany} from '../use-company';
import {TEST_BUILDS,TEST_MONTHS,TEST_STRESSORS} from '../../../../packages/ops-contract/index';
import {BUILD_LABEL,KIND_LABEL,MONTH_LABEL,STRESS_LABEL,type Build,type Fact,type Hotspot,type Month,type Region,type RegionId,type Season,type Stressor} from './model';
import {REGION,REGIONS,UNKNOWNS} from './regions';
import {HOTSPOT,HOTSPOTS,isAccess} from './hotspots';
import {NATIONAL,density,regionSchools,spotSchools,type SchoolCount} from './schools';
import './hero-map.css';

const {cols:W,rows:H,lon0,lat1,step,grid}=heroGrid;
const CODE:Record<string,RegionId>=Object.fromEntries(REGIONS.filter(r=>r.code).map(r=>[r.code,r.id]));
const DOTS=(()=>{const d:Record<string,[number,number][]>={};grid.forEach((row,r)=>{for(let c=0;c<row.length;c++){const ch=row[c];if(ch!=='.')(d[ch]??=[]).push([c,r]);}});return d;})();
const NEIGHBOURS:[string,string,number,number][]=[['m','Malaysia',116.2,5.4],['b','Brunei',114.9,4.1],['p','Papua New Guinea',143,-6.6],['t','Timor-Leste',126,-9],['s','Singapore',102.4,2.5]];
const pct=(lon:number,lat:number):CSSProperties=>({left:`${(lon-lon0)/step/W*100}%`,top:`${(lat1-lat)/step/H*100}%`});
const SEASON_WORD:Record<Season,string>={wet:'wet',dry:'dry',haze:'haze risk',none:''};
const BADGE={H:'High',M:'Medium',L:'Low'} as const;
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

const RegionDots=memo(function RegionDots({code}:{code:string}){return <>{DOTS[code]?.map(([c,r])=><circle key={`${c}-${r}`} cx={c+.5} cy={r+.5} r=".34" data-region={CODE[code]}/>)}</>;});
const NeighbourDots=memo(function NeighbourDots({code}:{code:string}){return <path d={(DOTS[code]??[]).map(([c,r])=>`M${c+.5} ${r+.5}h0`).join('')}/>;});

type Lens={build:Build|null;stress:Stressor|null;month:Month|null;access:boolean;schools:boolean};
const NO_LENS:Lens={build:null,stress:null,month:null,access:false,schools:false};
const filtering=(l:Lens)=>!!(l.build||l.stress||l.access);
const hotspotMatches=(h:Hotspot,l:Lens)=>(!l.build||h.fit.includes(l.build))&&(!l.stress||h.stress.includes(l.stress))&&(!l.access||isAccess(h));
const regionLit=(r:Region,l:Lens,spots:Hotspot[])=>(!l.build||r.fit.includes(l.build))&&(!l.stress||r.stress.includes(l.stress))&&(!l.access||spots.some(isAccess));
const ctaHref=(l:Lens,region:RegionId,site?:string)=>{const q=new URLSearchParams({region});if(l.build)q.set('build',l.build);if(l.month)q.set('month',l.month);if(l.stress)q.set('stressor',l.stress);if(site)q.set('site',site);return `/partner?${q}`;};

function FactList({facts}:{facts:Fact[]}){return <ul className="hm-facts">{facts.map((f,i)=><li key={i}>{f.t}<sup><a href={f.url} target="_blank" rel="noopener noreferrer" aria-label={`Source: ${f.src}, ${f.year}`}>{short(f.src)}, {f.year}</a></sup></li>)}</ul>;}

export function GlobalHero(){
 const root=useRef<HTMLElement>(null),svg=useRef<SVGSVGElement>(null),dlg=useRef<HTMLDialogElement>(null),title=useRef<HTMLHeadingElement>(null);const[kb,setKb]=useState<HTMLElement|null>(null);
 const[lens,setLens]=useState<Lens>(NO_LENS);const[sel,setSel]=useState<{region:RegionId;spot?:string}|null>(null);const[hover,setHover]=useState<RegionId|null>(null);const[drawer,setDrawer]=useState(false);
 const company=useCompany();const reply=company('replyTime'),price=company('priceBand');
 const spotsOf=useMemo(()=>{const m:Record<string,Hotspot[]>={};for(const h of HOTSPOTS)(m[h.region]??=[]).push(h);return m;},[]);
 const set=<K extends keyof Lens>(k:K,v:Lens[K])=>setLens(l=>({...l,[k]:l[k]===v?NO_LENS[k]:v}));
 const choose=useCallback((region:RegionId,spot?:string,keyboard=false)=>{setKb(keyboard?document.activeElement as HTMLElement:null);setSel({region,spot});},[]);
 const close=useCallback(()=>{const o=kb;setKb(null);setSel(null);if(o?.isConnected)o.focus();},[kb]);
 useEffect(()=>{if(kb&&sel)title.current?.focus();},[kb,sel]);

 // Esc closes the pinned panel (the drawer is a native dialog and handles its own Esc).
 useEffect(()=>{const on=(e:globalThis.KeyboardEvent)=>{const a=document.activeElement;if(e.key==='Escape'&&!dlg.current?.open&&(!a||a===document.body||root.current?.contains(a)))close();};document.addEventListener('keydown',on);return()=>document.removeEventListener('keydown',on);},[close]);
 useEffect(()=>{const d=dlg.current;if(!d)return;if(drawer&&!d.open)d.showModal();if(!drawer&&d.open)d.close();},[drawer]);

 // One-shot scroll assist: passive listeners only (no preventDefault), only at the very top with the hero in view, never from inside a panel.
 useEffect(()=>{
  const el=root.current;if(!el)return;let done=false,y0=0,ignore=false;
  const off=()=>{done=true;window.removeEventListener('wheel',wheel);window.removeEventListener('touchstart',start);window.removeEventListener('touchmove',move);};
  const ready=()=>document.querySelector<HTMLElement>('.result-landing')?.dataset.ready==='true'&&window.scrollY<8&&!dlg.current?.open&&el.getBoundingClientRect().top>-8;
  const inside=(t:EventTarget|null)=>t instanceof Element&&!!t.closest('.hm-aside,.hm-drawer');
  const go=()=>{if(done)return;off();document.getElementById('gap')?.scrollIntoView({behavior:reducedMotion()?'auto':'smooth'});};
  function wheel(e:WheelEvent){if(e.deltaY>0&&!e.ctrlKey&&!inside(e.target)&&ready())go();}
  function start(e:TouchEvent){y0=e.touches[0].clientY;ignore=inside(e.target);}
  function move(e:TouchEvent){if(!ignore&&y0-e.touches[0].clientY>=40&&ready())go();}
  window.addEventListener('wheel',wheel,{passive:true});window.addEventListener('touchstart',start,{passive:true});window.addEventListener('touchmove',move,{passive:true});
  return off;
 },[]);

 const pick=(e:{clientX:number;clientY:number}):RegionId|null=>{
  const b=svg.current!.getBoundingClientRect(),x=(e.clientX-b.left)/b.width*W,y=(e.clientY-b.top)/b.height*H;if(x<0||y<0||x>=W||y>=H)return null;
  const c=Math.floor(x),r=Math.floor(y),own=grid[r]?.[c]??'.';if(own>='a'&&own<='z')return null;if(own!=='.')return CODE[own];
  let best:RegionId|null=null,bd=9;for(let dr=-2;dr<=2;dr++)for(let dc=-2;dc<=2;dc++){const ch=grid[r+dr]?.[c+dc];if(ch&&ch>='A'&&ch<='Z'){const d=Math.hypot(dr,dc);if(d<bd){bd=d;best=CODE[ch];}}}
  return best??'maritime';
 };
 const stateOf=(r:Region):string=>{
  if(sel?.region===r.id)return'sel';
  if(sel)return'dim';
  if(filtering(lens))return regionLit(r,lens,spotsOf[r.id]??[])?'lit':'dim';
  return hover===r.id?'hover':'base';
 };
 const seasonOf=(r:Region):Season=>lens.month?r.season[TEST_MONTHS.indexOf(lens.month)]:'none';
 const tip=hover?REGION[hover]:null;
 const region=sel?REGION[sel.region]:null,spot=sel?.spot?HOTSPOT[sel.spot]:null;
 const keyAct=(fn:()=>void)=>(e:KeyboardEvent)=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();fn();}};
 const regionLabelShown=(r:Region)=>sel?sel.region===r.id:hover===r.id||(filtering(lens)&&regionLit(r,lens,spotsOf[r.id]??[]))||(!!lens.month&&seasonOf(r)!=='none')||(lens.schools&&!!regionSchools(r.id))||(r.id!=='batam'&&r.id!=='maritime');
 const pinShown=(h:Hotspot)=>sel?(sel.region===h.region||(filtering(lens)?hotspotMatches(h,lens):!!h.pin)):filtering(lens)?hotspotMatches(h,lens):!!h.pin;
 const shownPins=HOTSPOTS.filter(pinShown);
 const goGap=(e:{preventDefault:()=>void})=>{e.preventDefault();document.getElementById('gap')?.scrollIntoView({behavior:reducedMotion()?'auto':'smooth'});history.replaceState(null,'','#gap');};
 const active=filtering(lens)||!!lens.month||lens.schools;const regionIds=REGIONS.map(r=>r.id); const schoolLine=(c:SchoolCount|undefined)=>c&&<p className="hm-schools" data-testid="schools-line"><b>{c.n.toLocaleString('en')}</b> vocational schools (SMK) in {c.area}<sup><a href={c.url} target="_blank" rel="noopener noreferrer">{short(c.src)}, {c.year}</a></sup>. Existing schools, not partners: Lab Mitra can train them into field-test labs. <Link to="/id">About Lab Mitra (Indonesian)</Link></p>;

 return <section ref={root} className="rl-hero hm" aria-labelledby="landing-title" data-testid="hero-map" data-focus={sel?.region??undefined}>
  <div className="hm-top">
   <div className="rl-hero-copy hm-copy" data-enter>
    <p className="rl-eyebrow">The real-world gateway for AI robotics in Indonesia</p>
    <h1 id="landing-title">Prove your robot where it actually breaks.</h1>
    <p className="hm-sub">Indonesia puts tropical heat, humidity above 80%, haze, monsoon floods, salt air and unstable power in one country. Pick what you build, and see where to test it.</p>
    <p className="hm-proof">National mean air temperature 27.5 °C in 2024 (BMKG) · relative humidity 70–100% (BMKG) · <button type="button" className="hm-link" onClick={()=>setDrawer(true)}>Sources</button></p>
   </div>
   <div className="hm-lenses" role="group" aria-label="Map lenses" data-enter>
    <div className="hm-row"><b>I build…</b><div className="hm-chips">{TEST_BUILDS.map(b=><button type="button" key={b} aria-pressed={lens.build===b} onClick={()=>set('build',b)}>{BUILD_LABEL[b]}</button>)}</div></div>
    <div className="hm-row"><b>Stressor</b><div className="hm-chips">{TEST_STRESSORS.map(s=><button type="button" key={s} aria-pressed={lens.stress===s} onClick={()=>set('stress',s)}>{STRESS_LABEL[s]}</button>)}</div></div>
    <div className="hm-row"><b>Month</b><div className="hm-chips hm-months">{TEST_MONTHS.map(m=><button type="button" key={m} aria-pressed={lens.month===m} onClick={()=>set('month',m)}>{MONTH_LABEL[m]}</button>)}</div></div>
    <div className="hm-row"><b>Access</b><div className="hm-chips"><button type="button" aria-pressed={lens.access} onClick={()=>set('access',true)}>Labs, free trade zone &amp; KEK zones</button></div></div>
    <div className="hm-row"><b>Schools</b><div className="hm-chips"><button type="button" aria-pressed={lens.schools} onClick={()=>set('schools',true)}>School reach (SMK)</button></div></div>
    <div className="hm-meta" aria-live="polite">{lens.month?<span>Month: typical pattern, BMKG; varies by zone and year.</span>:lens.schools?<span>{Math.floor(NATIONAL.n/1000).toLocaleString('en')},000+ vocational schools nationwide, existing schools (not partners): Lab Mitra trains them into field-test labs.</span>:<span>Lenses combine. General conditions in Indonesia, not test results.</span>}{active&&<button type="button" className="hm-link" onClick={()=>{setLens(NO_LENS);}}>Clear</button>}</div>
   </div>
  </div>
  <div className="hm-stage" data-testid="hero-map-stage">
   <div className="hm-map" onPointerLeave={()=>setHover(null)}>
    <svg ref={svg} viewBox={`0 0 ${W} ${H}`} role="group" aria-label="Dot map of Indonesia: choose a region to see its test conditions" preserveAspectRatio="xMidYMid meet"
     onPointerMove={e=>{if(e.pointerType==='mouse')setHover(pick(e));}} onClick={e=>{if(!(e.target as Element).closest('[data-pin]')){const r=pick(e);if(r)choose(r);}}}>
     <g role="button" tabIndex={0} aria-label="Maritime Indonesia: test conditions" aria-pressed={sel?.region==='maritime'} className="hm-sea" data-region="maritime" data-s={sel?.region==='maritime'?'sel':hover==='maritime'?'hover':'base'} onKeyDown={keyAct(()=>choose('maritime',undefined,true))} onFocus={()=>setHover('maritime')} onBlur={()=>setHover(null)}><rect x="0" y="0" width={W} height={H}/></g>
     <g className="hm-nb" aria-hidden="true">{NEIGHBOURS.map(([c])=><NeighbourDots key={c} code={c}/>)}</g>
     {REGIONS.filter(r=>r.code).map(r=>{const season=seasonOf(r);return <g key={r.id} className="hm-g" role="button" tabIndex={0} aria-label={`${r.name}: test conditions`} aria-pressed={sel?.region===r.id&&!sel.spot} data-region={r.id} data-s={stateOf(r)} data-season={season} data-dens={lens.schools?density(r.id,regionIds):undefined} onKeyDown={keyAct(()=>choose(r.id,undefined,true))} onFocus={()=>setHover(r.id)} onBlur={()=>setHover(null)}><RegionDots code={r.code}/></g>;})}
    </svg>
    <div className="hm-labels" aria-hidden="true">
     {NEIGHBOURS.map(([c,name,lon,lat])=><span key={c} className="hm-nb-label" style={pct(lon,lat)}>{name}</span>)}
     {REGIONS.filter(r=>r.code&&regionLabelShown(r)).map(r=>{const season=seasonOf(r);return <span key={r.id} className="hm-label" data-s={stateOf(r)} style={pct(...r.at)}>{r.id==='batam'?'Batam / Kepri':r.name}{season!=='none'&&<i> · {SEASON_WORD[season]}</i>}{lens.schools&&regionSchools(r.id)&&<em> · {regionSchools(r.id)!.n.toLocaleString('en')} SMK</em>}</span>;})}
    </div>
    {shownPins.map(h=>{const crowd=shownPins.filter(x=>x.region===h.region).length>3,show=sel?.spot===h.id||(!crowd&&(sel?.region===h.region||lens.access));const dim=!!sel&&sel.region!==h.region;return <button type="button" key={h.id} className="hm-pin" data-pin={h.id} data-kind={h.kind} data-planned={h.planned?'':undefined} data-label={show?'':undefined} data-dim={dim?'':undefined} data-on={sel?.spot===h.id?'':undefined} style={pct(h.lon,h.lat)} aria-label={`${h.name}${h.planned?' (planned lab)':''}: test conditions`} aria-pressed={sel?.spot===h.id} onClick={()=>choose(h.region,h.id,false)} onKeyDown={e=>{if(e.key==='Enter'){e.preventDefault();choose(h.region,h.id,true);}}}><i/><span>{h.short??h.name}{h.planned&&<small> PLANNED</small>}</span></button>;})}
    <p className="hm-tip" role="status">{tip?<><b>{tip.name}</b> {tip.identity}</>:'Hover or tap a region. The sea is Maritime Indonesia.'}</p>
   </div>
   <div className="hm-regionchips" role="group" aria-label="Regions">{REGIONS.map(r=><button type="button" key={r.id} aria-pressed={sel?.region===r.id} onClick={()=>choose(r.id)}>{r.id==='batam'?'Batam':r.name}</button>)}</div>
  </div>
  <aside className={`hm-aside${region?' is-open':''}`} aria-label="Region details" data-testid="hero-panel">
   {region?<div className="hm-panel">
    <div className="hm-panel-head"><div>{spot&&<button type="button" className="hm-link" onClick={()=>choose(region.id)}>← {region.name}</button>}<h2 ref={title} tabIndex={-1}>{spot?spot.name:region.name}</h2><p className="hm-identity">{spot?<>{KIND_LABEL[spot.kind]}{spot.planned&&<> · <b className="hm-planned">PLANNED LAB</b></>} · {spot.identity}</>:region.identity}</p></div><button type="button" className="hm-x" aria-label="Close details" onClick={close}><XIcon size={18}/></button></div>
    {(()=>{const facts=(spot?spot.facts:region.facts).filter(f=>f.hero&&f.conf!=='L').slice(0,3);return facts.length>0&&<FactList facts={facts}/>;})()}
    {schoolLine(spot?spotSchools(spot.id):regionSchools(region.id))}
    {!spot&&(spotsOf[region.id]?.length??0)>0&&<div className="hm-spots"><h3>Cities &amp; potential areas</h3><ul>{spotsOf[region.id].map(h=><li key={h.id}><button type="button" onClick={()=>choose(region.id,h.id)}>{h.name}{h.planned&&<small> PLANNED</small>}<span>{KIND_LABEL[h.kind]}</span></button></li>)}</ul></div>}
    <h3>Test scenarios</h3><ul className="hm-tests">{(spot?spot.tests:region.tests).map(t=><li key={t}>{t}</li>)}</ul>
    {spot?.planned&&<p className="hm-note">A planned AIoT lab city. No lab operates there yet.</p>}
    {!spot&&region.note&&<p className="hm-note">{region.note}</p>}
    <div className="hm-cta"><Link className="rl-button rl-button-dark" to={ctaHref(lens,region.id,spot?.id)} data-cta="hero-test-plan">Get a test plan · {spot?(spot.short??spot.name):region.cta} <ArrowRightIcon size={18}/></Link>{reply&&<small>{reply}</small>}{price&&<small>{price}</small>}<button type="button" className="hm-link" onClick={()=>setDrawer(true)}>Sources</button></div>
   </div>:<div className="hm-panel hm-idle">
    <h2>Where would it break?</h2><p>Pick what you build, then click a region or a pin. Esc closes a panel.</p>
    <div className="hm-cta"><Link className="rl-button rl-button-dark" to="/partner" data-cta="hero-partner">Partner with us <ArrowRightIcon size={18}/></Link>{reply&&<small>{reply}</small>}{price&&<small>{price}</small>}<button type="button" className="hm-link" onClick={()=>setDrawer(true)}>Sources &amp; confidence</button></div>
   </div>}
  </aside>
  <div className="hm-bottom"><a className="hm-scroll" href="#gap" onClick={goGap}>Scroll to the gap <ArrowDownIcon size={14}/></a><span>General conditions in Indonesia, not test results.</span></div>
  <ul className="hm-sr" aria-label="Regions and places, as a list">{REGIONS.map(r=><li key={r.id}><button type="button" onClick={()=>choose(r.id,undefined,true)}>{r.name}: {r.identity}</button>{(spotsOf[r.id]?.length??0)>0&&<ul>{spotsOf[r.id].map(h=><li key={h.id}><button type="button" onClick={()=>choose(r.id,h.id,true)}>{h.name}{h.planned?' (planned lab)':''}</button></li>)}</ul>}</li>)}</ul>
  <dialog ref={dlg} className="hm-drawer" aria-labelledby="hm-drawer-title" onClose={()=>setDrawer(false)} onClick={e=>{if(e.target===dlg.current)setDrawer(false);}}>
   {drawer&&<div className="hm-drawer-body">
    <div className="hm-panel-head"><h2 id="hm-drawer-title">Sources &amp; confidence</h2><button type="button" className="hm-x" aria-label="Close sources" onClick={()=>setDrawer(false)}><XIcon size={18}/></button></div>
    <p>Every figure on the map, with its source and year. H = high (official or primary source), M = medium (press or secondary report of an official figure), L = low (conflicting or undated; never shown on the map). The &quot;I build&quot; fit and the stressor tags are our editorial reading of the scenarios below, not measurements.</p>
    <DrawerGroup name="Indonesia, national" facts={NATIONAL_FACTS}/>
    {REGIONS.map(r=><DrawerGroup key={r.id} name={r.name} facts={[...r.facts,...schoolFacts(r.id,'The region'),...(spotsOf[r.id]??[]).flatMap(h=>[...schoolFacts(h.id,h.name,true),...h.facts].map(f=>({...f,t:f.t.startsWith(h.name)?f.t:`${h.name}: ${f.t}`})))]}/>)}
    <h3>What we don&apos;t know yet</h3><ul className="hm-facts">{UNKNOWNS.map(u=><li key={u}>{u}</li>)}</ul>
   </div>}
  </dialog>
 </section>;
}
const schoolFacts=(id:string,label:string,spot=false):Fact[]=>{const c=spot?spotSchools(id):regionSchools(id);return c?[{t:`${label}: ${c.n.toLocaleString('en')} vocational schools (SMK) in ${c.area}: existing schools and potential Lab Mitra reach, not partners.`,src:c.src,year:c.year,url:c.url,conf:c.conf}]:[];};
function DrawerGroup({name,facts}:{name:string;facts:Fact[]}){
 return <section className="hm-dg"><h3>{name}</h3><ul>{facts.map((f,i)=><li key={i}><span className="hm-conf" data-conf={f.conf} title={`${BADGE[f.conf]} confidence`}>{f.conf}<span className="hm-sr"> {BADGE[f.conf]} confidence</span></span><span>{f.t} <a href={f.url} target="_blank" rel="noopener noreferrer">{f.src}, {f.year} <ArrowUpRightIcon size={11} aria-hidden="true"/></a></span></li>)}</ul></section>;
}
/** Entry path and unknowns, shown after the gap section. */
export function EntryPath(){
 return <section className="rl-section hm-entry" aria-labelledby="hm-entry-title" data-reveal>
  <div><p className="rl-eyebrow">ENTRY PATH</p><h2 id="hm-entry-title">The steps we help you through.</h2><p className="hm-entry-note">Bringing hardware into Indonesia involves these official steps. AIoT helps you through them; the approvals themselves come from the authorities.</p></div>
  <ol>{ENTRY.map(([h,p,url],i)=><li key={h}><span>0{i+1}</span><h3>{h}</h3><p>{p}</p><a href={url} target="_blank" rel="noopener noreferrer">Official regulations <ArrowUpRightIcon size={12} aria-hidden="true"/></a></li>)}</ol>
  <div className="hm-unknown"><h3>What we don&apos;t know yet</h3><ul>{UNKNOWNS.map(u=><li key={u}>{u}</li>)}</ul></div>
 </section>;
}
