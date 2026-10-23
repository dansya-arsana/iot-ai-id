/** Pure power helpers. Everything shown is the stored node.power (server solve_power); only farm sums and rail grouping are derived here. */
import type {SystemSpec,ProNode} from '../../../../../packages/pro-contract/system-spec';

export interface RailGroup{key:string;source:ProNode['power']['source'];supplyV:number;nodeIds:string[];dailyWh:number;avgMa:number;peakMa:number}
/** A rail is one supply source and voltage; nodes on the same rail are listed together. */
export function rails(spec:SystemSpec):RailGroup[]{
 const m=new Map<string,RailGroup>();
 for(const n of spec.nodes){
  const k=`${n.power.source}@${n.power.supplyV}`;
  const g=m.get(k)??{key:k,source:n.power.source,supplyV:n.power.supplyV,nodeIds:[],dailyWh:0,avgMa:0,peakMa:0};
  g.nodeIds.push(n.id);g.dailyWh+=n.power.budget.dailyWh;g.avgMa+=n.power.budget.avgMa;g.peakMa+=n.power.budget.peakMa;
  m.set(k,g);
 }
 return [...m.values()].map(g=>({...g,dailyWh:round(g.dailyWh),avgMa:round(g.avgMa),peakMa:round(g.peakMa)}));
}
const round=(n:number)=>Math.round(n*100)/100;
export const farmDailyWh=(spec:SystemSpec)=>round(spec.nodes.reduce((a,n)=>a+n.power.budget.dailyWh,0));
export const SOURCE_LABEL:Record<string,string>={'solar-battery':'Solar + battery',mains:'Mains',battery:'Battery',usb:'USB'};
export const CHEM_LABEL:Record<string,string>={'li-ion-18650':'Li-ion 18650',lifepo4:'LiFePO4',sla:'Sealed lead-acid'};
/** Verification stamp of a node's power solve, if the gate wrote one. */
export const powerStamp=(spec:SystemSpec,nodeId:string)=>spec.verification[`/power/${nodeId}`];
/** Autonomy tone: below 2 days is a warning (display threshold only). */
export const autonomyTone=(days:number)=>days<2?'warn':'ok';
