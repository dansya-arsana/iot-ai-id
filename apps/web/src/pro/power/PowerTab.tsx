import {useProSpec,useSelection} from '../api/spec-store';
import {autonomyTone,CHEM_LABEL,farmDailyWh,powerStamp,rails,SOURCE_LABEL} from './power-model';
import '../bom/bom.css';

export function PowerTab(){
 const {spec,refs}=useProSpec();
 const {select}=useSelection();
 if(!spec||!refs)return <div className="m6-empty">No design loaded.</div>;
 const total=farmDailyWh(spec),max=Math.max(...spec.nodes.map(n=>n.power.budget.dailyWh),0.0001);
 return <div className="m6" data-testid="power-tab">
  <div className="m6-bar"><span className="pro-eyebrow">Rails</span><span className="grow"/><span className="pro-mono pro-muted">Farm total {total} Wh/day · peak sun {spec.site.peakSunHours} h</span></div>
  <div className="m6-scroll">
  <table className="m6-table">
   <thead><tr><th>Rail</th><th>Nodes</th><th className="num">Avg mA</th><th className="num">Peak mA</th><th className="num">Wh/day</th></tr></thead>
   <tbody>{rails(spec).map(r=><tr key={r.key}><td>{SOURCE_LABEL[r.source]} · {r.supplyV} V</td><td>{r.nodeIds.map(id=>refs.nodes[id]).join(', ')}</td><td className="num">{r.avgMa}</td><td className="num">{r.peakMa}</td><td className="num">{r.dailyWh}</td></tr>)}</tbody>
  </table>
  <div className="m6-cards">{spec.nodes.map(n=>{
   const p=n.power,stamp=powerStamp(spec,n.id);
   return <article key={n.id} className="m6-card">
    <h4><button type="button" className="pro-link" onClick={()=>select({kind:'node',id:n.id})}>{refs.nodes[n.id]} · {n.id}</button><span className={'m6-tag '+(!p.ok?'error':stamp?.status==='verified'?'ok':'info')}>{!p.ok?'fails budget':stamp?.status==='verified'?'verified':'unverified'}</span></h4>
    <div className="m6-kv"><span>Source</span><span>{SOURCE_LABEL[p.source]} · {p.supplyV} V</span></div>
    <div className="m6-kv"><span>Daily energy</span><span>{p.budget.dailyWh} Wh</span></div>
    <div className="m6-bar-wh" aria-hidden><i style={{width:`${Math.max(4,p.budget.dailyWh/max*100)}%`}}/></div>
    <div className="m6-kv"><span>Avg / peak</span><span>{p.budget.avgMa} / {p.budget.peakMa} mA</span></div>
    {p.battery?<><div className="m6-kv"><span>Battery</span><span>{CHEM_LABEL[p.battery.chemistry]} {p.battery.series}S{p.battery.parallel}P</span></div>
     <div className="m6-kv"><span>Capacity</span><span>{p.battery.capacityWh} Wh</span></div>
     <div className="m6-kv"><span>Autonomy</span><span><span className={'m6-tag '+autonomyTone(p.battery.autonomyDays)}>{p.battery.autonomyDays} days</span></span></div></>
     :<div className="m6-kv"><span>Battery</span><span>none</span></div>}
    {p.solar?<div className="m6-kv"><span>Solar</span><span>{p.solar.panelW} W · {p.solar.controller.toUpperCase()}</span></div>:p.source==='solar-battery'&&<div className="m6-kv"><span>Solar</span><span>missing</span></div>}
    {!stamp&&<span className="m6-sub">No solve_power stamp: stored figures are not gate-verified.</span>}
    {stamp&&stamp.status!=='verified'&&<span className="m6-sub">{stamp.note??'Not verified'}</span>}
   </article>;})}</div>
  </div>
 </div>;
}
