/**
 * price_bom and the spec BOM builder. Prices come from the dated table (data/prices.ts), with the catalog price as a fallback;
 * a kind with neither is listed as missing (never invented). Quantities are summed over all nodes; cable is sold by the metre.
 * Line minIdr/maxIdr in price_bom are LINE TOTALS (unit x qty).
 */
import type {z} from 'zod';
import type {BomLineSchema,ProNode,SystemSpec} from '../../pro-contract/system-spec.js';
import {mkIssue,type PartLookup,type ToolIssue} from './common.js';
import {PRICE_CHECKED_AT,PRICE_SOURCE,PRICE_TABLE_NAME,priceRow} from '../data/prices.js';

export type BomLine=z.infer<typeof BomLineSchema>;
export type PriceBomInput={lines:{partId:string;qty:number}[]};
export type PriceBomOutput={lines:{partId:string;qty:number;minIdr:number;maxIdr:number;checkedAt:string;source:string}[];totals:{minIdr:number;maxIdr:number};missing:string[]};

type Unit={minIdr:number;maxIdr:number;checkedAt:string;table:string;source:string};
export function unitPrice(kind:string,lookup?:PartLookup):Unit|undefined{
 const t=priceRow(kind);
 if(t)return {minIdr:t.minIdr,maxIdr:t.maxIdr,checkedAt:PRICE_CHECKED_AT,table:PRICE_TABLE_NAME,source:PRICE_SOURCE};
 const c=lookup?.(kind)?.price?.v;
 if(c)return {minIdr:c.minIdr,maxIdr:c.maxIdr,checkedAt:c.checkedAt,table:'catalog',source:`catalog price (${lookup!(kind)!.price!.p.source})`.slice(0,120)};
 return undefined;
}
export function priceBom(input:PriceBomInput,lookup?:PartLookup):PriceBomOutput{
 const lines:PriceBomOutput['lines']=[],missing:string[]=[];
 let min=0,max=0;
 for(const l of input.lines){
  const u=unitPrice(l.partId,lookup);
  if(!u){if(!missing.includes(l.partId))missing.push(l.partId);continue;}
  const a=Math.round(u.minIdr*l.qty),b=Math.round(u.maxIdr*l.qty);
  lines.push({partId:l.partId,qty:l.qty,minIdr:a,maxIdr:b,checkedAt:u.checkedAt,source:u.source});
  min+=a;max+=b;
 }
 return {lines,totals:{minIdr:min,maxIdr:max},missing};
}

// ---- spec BOM ----
const DERIVED_NAMES:Record<string,{en:string;id:string}>={
 'enclosure-ip65':{en:'IP65 enclosure',id:'Enclosure IP65'},'cable-gland':{en:'Cable gland PG9',id:'Kabel gland PG9'},
 'cable-3-core-shielded':{en:'3-core shielded cable (per m)',id:'Kabel 3 inti berpelindung (per m)'},'cable-4-core-shielded':{en:'4-core shielded cable (per m)',id:'Kabel 4 inti berpelindung (per m)'},
 'cable-power-2x0.75':{en:'Power cable 2x0.75 (per m)',id:'Kabel daya 2x0,75 (per m)'},'cable-2-core':{en:'2-core cable (per m)',id:'Kabel 2 inti (per m)'},
 'solar-panel-2w':{en:'Solar panel 2 W',id:'Panel surya 2 W'},'solar-panel-20w':{en:'Solar panel 20 W',id:'Panel surya 20 W'},'solar-panel-50w':{en:'Solar panel 50 W',id:'Panel surya 50 W'},
 'charge-controller-pwm':{en:'PWM charge controller',id:'Charge controller PWM'},'charge-controller-mppt':{en:'MPPT charge controller',id:'Charge controller MPPT'},
 'lifepo4-12v-15ah':{en:'LiFePO4 12.8 V 15 Ah battery',id:'Baterai LiFePO4 12,8 V 15 Ah'},'battery-18650-pack':{en:'18650 Li-ion cell',id:'Sel Li-ion 18650'},
};
const PCS='pcs' as const;
export type BomBuild={lines:BomLine[];totalIdr:{min:number;max:number};issues:ToolIssue[]};
const slugKey=(s:string)=>s.toLowerCase().replace(/[^a-z0-9.-]+/g,'-').replace(/^[^a-z]+/,'x').slice(0,48);

export function buildBom(spec:Pick<SystemSpec,'nodes'>,lookup?:PartLookup):BomBuild{
 const acc=new Map<string,{kind:string;unit:'pcs'|'m'|'set';qty:number;per:Map<string,number>}>();
 const add=(key:string,kind:string,unit:'pcs'|'m'|'set',nodeId:string,qty:number)=>{
  if(qty<=0)return;
  const e=acc.get(key)??{kind,unit,qty:0,per:new Map()};e.qty+=qty;e.per.set(nodeId,(e.per.get(nodeId)??0)+qty);acc.set(key,e);
 };
 for(const n of spec.nodes as ProNode[]){
  add(slugKey(n.board),slugKey(n.board),PCS,n.id,1);
  for(const p of n.parts)add(slugKey(p.kind),slugKey(p.kind),PCS,n.id,p.qty);
  add('enclosure-ip65','enclosure-ip65',PCS,n.id,1);
  add('cable-gland','cable-gland',PCS,n.id,n.enclosure.glands);
  const hasBattery=n.parts.some(p=>/battery/.test(p.kind)),hasPanel=n.parts.some(p=>/solar-panel/.test(p.kind));
  if(n.power.battery&&!hasBattery){
   if(n.power.battery.chemistry==='lifepo4')add('lifepo4-12v-15ah','lifepo4-12v-15ah',PCS,n.id,Math.max(1,Math.ceil(n.power.battery.capacityWh/192)));
   else add('battery-18650-pack','battery-18650-pack',PCS,n.id,n.power.battery.series*n.power.battery.parallel);
  }
  if(n.power.solar){
   if(!hasPanel){const w=n.power.solar.panelW,k=w<=3?'solar-panel-2w':w<=25?'solar-panel-20w':'solar-panel-50w';add(k,k,PCS,n.id,1);}
   const c=`charge-controller-${n.power.solar.controller}`;add(c,c,PCS,n.id,1);
  }
  const metres=new Map<string,number>();
  for(const w of n.wires)if(w.cable!=='dupont'&&w.viaGland)metres.set(w.cable,(metres.get(w.cable)??0)+w.lengthM);
  for(const [cable,m] of metres){const k=slugKey(`cable-${cable}`);add(k,k,'m',n.id,Math.ceil(m*1.1));}
 }
 const issues:ToolIssue[]=[],lines:BomLine[]=[];
 let min=0,max=0;
 for(const [key,e] of acc){
  const u=unitPrice(key,lookup);
  if(!u)issues.push(mkIssue('bom.price-missing','warning',`No price for ${key}; the line is priced 0 and excluded from the total.`,`Tidak ada harga untuk ${key}; baris dihargai 0 dan tidak masuk total.`,key,'C'));
  const rec=lookup?.(key);const nm=rec?.identity.name.v;
  const name=DERIVED_NAMES[key]??(nm?{en:nm.slice(0,120),id:nm.slice(0,120)}:{en:key,id:key});
  const unit={min:u?.minIdr??0,max:u?.maxIdr??0};
  const total={min:Math.round(unit.min*e.qty),max:Math.round(unit.max*e.qty)};
  min+=total.min;max+=total.max;
  lines.push({key,kind:slugKey(e.kind),name,unit:e.unit,qty:e.qty,perNode:[...e.per].map(([nodeId,qty])=>({nodeId,qty})),priceIdr:{unit,total},
   priceSource:{table:u?.table??PRICE_TABLE_NAME,checkedAt:u?.checkedAt??PRICE_CHECKED_AT},optional:false});
 }
 return {lines,totalIdr:{min,max},issues};
}
