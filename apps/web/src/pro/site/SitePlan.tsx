import {useMemo,useState} from 'react';
import type {SystemSpec} from '../../../../../packages/pro-contract/system-spec';
import {fmtArea,layoutSitePlan,MARGIN_TARGET_DB} from './layout';
import {LinkPill} from './LinkPill';
import './site-plan.css';

export type SiteSelection={kind:'field'|'node'|'link'|'site';id:string}|null;
export type SiteLayers={links:boolean;coverage:boolean;satellite:boolean};
export type SitePlanProps={
 spec:Pick<SystemSpec,'site'|'fields'|'nodes'|'links'|'checks'>;
 selection?:SiteSelection;hover?:SiteSelection;
 onSelect?:(s:SiteSelection)=>void;onHover?:(s:SiteSelection)=>void;
 layers?:Partial<SiteLayers>;
 lang?:'en'|'id';
};
const TREES=new Set(['mango','banana','orchard-other','cocoa','oil-palm','coffee']);
const BEDS=new Set(['flowers','vegetables']);
const CROSS=new Set(['rice','other']);
const pattern=(crop:string)=>TREES.has(crop)?'sp-hatch-trees':BEDS.has(crop)?'sp-hatch-beds':CROSS.has(crop)?'sp-hatch-cross':'sp-hatch-rows';
const activate=(fn:()=>void)=>(e:React.KeyboardEvent)=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();fn();}};

export function SitePlan({spec,selection=null,hover=null,onSelect,onHover,layers,lang='en'}:SitePlanProps){
 const L=useMemo(()=>layoutSitePlan(spec,{width:1000}),[spec]);
 const own:SiteLayers={links:true,coverage:true,satellite:false};
 const lay={...own,...layers};
 const [ownHover,setOwnHover]=useState<SiteSelection>(null);
 const hv=hover??ownHover;
 const sel=(k:'field'|'node'|'link',id:string)=>selection?.kind===k&&selection.id===id;
 const hov=(k:'field'|'node'|'link',id:string)=>hv?.kind===k&&hv.id===id;
 const X=(x:number)=>(x-L.view.minX)*L.scale,Y=(y:number)=>(y-L.view.minY)*L.scale;
 const W=L.view.w*L.scale,H=L.view.h*L.scale;
 const wifiMax=Math.max(0,...L.links.filter(l=>l.medium==='wifi').map(l=>l.distanceM));
 const hasWifi=wifiMax>0;
 const pick=(s:SiteSelection)=>(e:{stopPropagation():void})=>{e.stopPropagation();onSelect?.(s);};
 const hoverTo=(s:SiteSelection)=>{setOwnHover(s);onHover?.(s);};
 const T=(en:string,id:string)=>lang==='id'?id:en;
 const gwPx={x:X(0),y:Y(0)};
 return <div className="sp-root" data-testid="site-plan">
  <svg className="sp-svg" viewBox={`0 0 ${W} ${H}`} role="group" aria-label={T('Site plan','Denah lokasi')} onClick={()=>onSelect?.(null)}>
   <defs>
    <pattern id="sp-hatch-trees" width="22" height="22" patternUnits="userSpaceOnUse"><circle cx="11" cy="11" r="5" className="sp-h-stroke"/><circle cx="11" cy="11" r="1.2" className="sp-h-fill"/></pattern>
    <pattern id="sp-hatch-rows" width="8" height="8" patternUnits="userSpaceOnUse"><path d="M0 4H8" className="sp-h-stroke"/></pattern>
    <pattern id="sp-hatch-beds" width="10" height="10" patternUnits="userSpaceOnUse" patternTransform="rotate(45)"><path d="M0 5H10" className="sp-h-stroke"/></pattern>
    <pattern id="sp-hatch-cross" width="10" height="10" patternUnits="userSpaceOnUse"><path d="M0 0L10 10M10 0L0 10" className="sp-h-stroke"/></pattern>
    <pattern id="sp-grid" width={L.gridM*L.scale} height={L.gridM*L.scale} patternUnits="userSpaceOnUse" x={X(0)} y={Y(0)}><path d={`M${L.gridM*L.scale} 0V${L.gridM*L.scale}M0 ${L.gridM*L.scale}H${L.gridM*L.scale}`} className="sp-grid-line"/></pattern>
   </defs>
   <rect width={W} height={H} className="sp-ground"/>
   <rect width={W} height={H} fill="url(#sp-grid)"/>
   {spec.site.plan&&<rect x={X(-spec.site.plan.widthM/2)} y={Y(-spec.site.plan.heightM/2)} width={spec.site.plan.widthM*L.scale} height={spec.site.plan.heightM*L.scale} className="sp-boundary"/>}
   {lay.satellite&&<text x={W/2} y={H/2} className="sp-note" textAnchor="middle">{T('Satellite imagery needs a licence','Citra satelit butuh lisensi')}</text>}
   {lay.coverage&&hasWifi&&<g className="sp-coverage" aria-hidden="true"><circle cx={gwPx.x} cy={gwPx.y} r={Math.max(60,wifiMax*1.1)*L.scale}/><text x={gwPx.x+8} y={gwPx.y-Math.max(60,wifiMax*1.1)*L.scale+14}>{T('Wi-Fi AP reach (est.)','Jangkauan Wi-Fi AP (perk.)')}</text></g>}

   {L.fields.map(f=>{
    const x=X(f.x),y=Y(f.y),w=f.w*L.scale,h=f.h*L.scale;
    const lab=`${f.letter}  ${f.name}`,area=fmtArea(f.areaM2),tw=(lab.length+area.length+2)*6.8+16;
    return <g key={f.id} className={`sp-field${sel('field',f.id)?' is-selected':''}${hov('field',f.id)?' is-hover':''}`} role="button" tabIndex={0} aria-pressed={sel('field',f.id)}
     aria-label={`${T('Field','Lahan')} ${f.letter} ${f.name}, ${f.crop}, ${area}`} data-field={f.id}
     onClick={pick({kind:'field',id:f.id})} onKeyDown={activate(()=>onSelect?.({kind:'field',id:f.id}))} onMouseEnter={()=>hoverTo({kind:'field',id:f.id})} onMouseLeave={()=>hoverTo(null)}>
     <rect x={x} y={y} width={w} height={h} className="sp-field-bg"/>
     <rect x={x} y={y} width={w} height={h} fill={`url(#${pattern(f.crop)})`} className="sp-field-hatch"/>
     <rect x={x} y={y} width={w} height={h} className="sp-field-edge"/>
     <g transform={`translate(${f.x+f.w/2<0?x+8:x+w-8-tw} ${f.y+f.h/2<0?y+8:y+h-30})`} className="sp-field-label"><rect width={tw} height={22} rx={3}/><text x={8} y={11} dominantBaseline="central"><tspan className="sp-letter">{f.letter}</tspan>{'  '}<tspan className="sp-name">{f.name}</tspan>{'  '}<tspan className="sp-area">{area}</tspan></text></g>
    </g>;
   })}

   {lay.links&&L.links.map(l=>{
    const dash=l.medium==='wifi'?'2 5':l.medium==='lora'?'8 5':undefined;
    return <line key={l.id} x1={X(l.a.x)} y1={Y(l.a.y)} x2={X(l.b.x)} y2={Y(l.b.y)} strokeDasharray={dash}
     className={`sp-link${l.low?' is-low':''}${sel('link',l.id)?' is-selected':''}${hov('link',l.id)?' is-hover':''}`} data-link-line={l.id}/>;
   })}

   <g className="sp-gw" role="button" tabIndex={0} aria-label={T('Gateway, pump house','Gateway, rumah pompa')} aria-pressed={sel('node','gateway')}
    onClick={pick({kind:'node',id:L.nodes.find(n=>n.role==='gateway')?.id??'gateway'})}
    onKeyDown={activate(()=>onSelect?.({kind:'node',id:L.nodes.find(n=>n.role==='gateway')?.id??'gateway'}))}>
    <rect x={gwPx.x-20} y={gwPx.y-14} width={40} height={28} className="sp-gw-box"/>
    <rect x={gwPx.x-6} y={gwPx.y-6} width={12} height={12} className="sp-gw-core"/>
    <text x={gwPx.x} y={gwPx.y+27} textAnchor="middle" className="sp-tiny">{T('PUMP HOUSE','RUMAH POMPA')}</text>
    <text x={gwPx.x-24} y={gwPx.y-20} textAnchor="end" className="sp-tag">GW</text>
   </g>

   {L.nodes.filter(n=>n.role!=='gateway').map(n=>{
    const cx=X(n.at.x),cy=Y(n.at.y),s=sel('node',n.id);
    return <g key={n.id} className={`sp-node${n.warn?' is-warn':''}${s?' is-selected':''}${hov('node',n.id)?' is-hover':''}`} role="button" tabIndex={0} aria-pressed={s}
     aria-label={`${T('Node','Node')} ${n.tag}${n.warn?` (${T('warning','peringatan')})`:''}`} data-node={n.id}
     onClick={pick({kind:'node',id:n.id})} onKeyDown={activate(()=>onSelect?.({kind:'node',id:n.id}))} onMouseEnter={()=>hoverTo({kind:'node',id:n.id})} onMouseLeave={()=>hoverTo(null)}>
     <circle cx={cx} cy={cy} r={14} className="sp-node-ring"/><circle cx={cx} cy={cy} r={5} className="sp-node-core"/>
     <text x={cx+20} y={cy} dominantBaseline="central" className="sp-tag">{n.tag}</text>
    </g>;
   })}

   {lay.links&&L.links.map(l=><LinkPill key={l.id} link={l} x={X(l.mid.x)} y={Y(l.mid.y)} selected={sel('link',l.id)} hover={hov('link',l.id)}
     onSelect={id=>onSelect?.({kind:'link',id})} onHover={id=>hoverTo(id?{kind:'link',id}:null)}/>)}

   <g className="sp-scale" transform={`translate(${W-L.bar.len-40} ${H-34})`} aria-hidden="true">
    <rect width={L.bar.len} height={4}/><rect width={L.bar.len/2} height={4} className="sp-scale-half"/>
    <text y={-6}>0</text><text x={L.bar.len/2} y={-6}>{L.bar.m/2}</text><text x={L.bar.len} y={-6}>{L.bar.m} m</text>
   </g>
   <g className="sp-north" transform={`translate(${W-34} 34)`} aria-hidden="true"><circle r={14}/><path d="M0 -8L5 6L0 3L-5 6Z"/><text y={-20} textAnchor="middle">N</text></g>
  </svg>

  <div className="sp-legend" aria-hidden="true">
   <span><i className="sp-k sp-k-lora"/>LoRa</span><span><i className="sp-k sp-k-wifi"/>Wi-Fi</span>
   <span><i className="sp-k sp-k-low"/>&lt; {MARGIN_TARGET_DB} dB</span><span><i className="sp-k sp-k-node"/>Node</span>
  </div>
  <div className="sp-prov">{T('Sketched from your prompt · not surveyed','Disketsa dari prompt Anda · belum disurvei')} · {T('distances','jarak')} ±10%</div>
 </div>;
}
