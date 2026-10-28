/** Fab outputs (pure): JLC-format BOM and CPL CSV from the carrier placement. No I/O. */
export type Placement={ref:string;value:string;footprint:string;x:number;y:number;rot?:number;side?:'top'|'bottom';lcsc?:string};
const q=(s:string)=>`"${s.replace(/^([=+\-@])/,"'$1").replace(/"/g,'""')}"`;
const n=(v:number)=>`${(Math.round(v*1000)/1000).toFixed(3)}mm`;
const byRef=(a:Placement,b:Placement)=>a.ref.localeCompare(b.ref,'en',{numeric:true});
/** JLC BOM: Comment,Designator,Footprint,LCSC Part # (grouped by value+footprint+lcsc). */
export function jlcBom(ps:Placement[]):string{
 const g=new Map<string,Placement[]>();
 for(const p of [...ps].sort(byRef)){const k=[p.value,p.footprint,p.lcsc??''].join('\u0000');g.set(k,[...(g.get(k)??[]),p]);}
 const rows=[...g.values()].map(l=>[q(l[0]!.value),q(l.map(p=>p.ref).join(',')),q(l[0]!.footprint),q(l[0]!.lcsc??'')].join(','));
 return ['Comment,Designator,Footprint,LCSC Part #',...rows].join('\n')+'\n';
}
/** JLC CPL: Designator,Mid X,Mid Y,Layer,Rotation. */
export function jlcCpl(ps:Placement[]):string{
 const rows=[...ps].sort(byRef).map(p=>[q(p.ref),n(p.x),n(p.y),(p.side??'top')==='top'?'Top':'Bottom',String(((Math.round(p.rot??0)%360)+360)%360)].join(','));
 return ['Designator,Mid X,Mid Y,Layer,Rotation',...rows].join('\n')+'\n';
}
