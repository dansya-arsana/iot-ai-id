import type {PlanLink} from './layout';

export type LinkPillProps={link:PlanLink;x:number;y:number;selected?:boolean;hover?:boolean;onSelect?:(id:string)=>void;onHover?:(id:string|null)=>void};

/** SVG pill `L3 · 496 m · +14 dB`. Amber under the margin target, inverse when selected. */
export function LinkPill({link,x,y,selected,hover,onSelect,onHover}:LinkPillProps){
 const w=link.text.length*6.6+16,h=18;
 const cls=['sp-pill',link.low?'is-low':'',selected?'is-selected':'',hover?'is-hover':''].filter(Boolean).join(' ');
 return <g className={cls} transform={`translate(${x} ${y}) rotate(${link.angleDeg})`} role="button" tabIndex={0} aria-pressed={!!selected} aria-label={link.text}
  data-link={link.id} onClick={e=>{e.stopPropagation();onSelect?.(link.id);}}
  onKeyDown={e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();onSelect?.(link.id);}}}
  onMouseEnter={()=>onHover?.(link.id)} onMouseLeave={()=>onHover?.(null)}>
  <rect x={-w/2} y={-h/2} width={w} height={h} rx={h/2}/>
  <text textAnchor="middle" dominantBaseline="central">{link.text}</text>
 </g>;
}
