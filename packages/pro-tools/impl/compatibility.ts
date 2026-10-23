/**
 * check_compatibility: voltage, logic level, bus, I2C address, current, and LoRa band between a board and parts.
 * Facts come from catalog leaves; a low-confidence leaf never produces an error on its own (grade clamp).
 */
import {boardProfile,currentOf,graded,hasError,kindOf,logicOf,mkIssue,ruleIssue,supplyOf,type PartLookup,type ToolIssue} from './common.js';
import {LORA_BAND,coversBand,isWrongBandId} from '../data/radio.js';
import type {ProNode} from '../../pro-contract/system-spec.js';

export type CompatInput={board:string;parts:{partId:string;qty?:number;props?:Record<string,string|number|boolean>}[];supplyV?:number};
const POWER_PART_RE=/battery|solar|psu|charger|supply|enclosure|cable|gland/;
const BUS_NEEDS:Record<string,string>={i2c:'i2c',spi:'spi',uart:'uart',analog:'analog'};

export function checkCompatibility(input:CompatInput,lookup:PartLookup):{ok:boolean;issues:ToolIssue[]}{
 const b=boardProfile(input.board),issues:ToolIssue[]=[];
 const addrs=new Map<number,string[]>();
 let peakMa=0;
 for(const use of input.parts){
  const rec=lookup(use.partId);
  if(!rec){issues.push(mkIssue('part.unknown','error',`Part ${use.partId} is not in the catalog.`,`Part ${use.partId} tidak ada di katalog.`,use.partId));continue;}
  const kind=kindOf(rec),qty=use.qty??1;
  if(kind==='board'||kind==='power'||POWER_PART_RE.test(kind)||POWER_PART_RE.test(use.partId))continue;
  // grade follows the leaf the finding rests on: a low or medium confidence leaf can only warn
  const gradeOf=(c:string)=>c==='high'?'B':'C';
  let grade=gradeOf(rec.electrical.supplyV.p.confidence);
  const sev=(s:'error'|'warning')=>graded(s,grade);
  const s=supplyOf(rec);
  // voltage: parts run from the board's logic rail unless the node supply is given for a rail part (5 V parts on VIN/5V)
  if(b.logicV<s.min-0.05||b.logicV>s.max+0.05){
   const v5=input.supplyV!==undefined?input.supplyV:5;
   const on5=s.min<=5.05&&s.max>=4.95&&b.rails['5V']!==undefined;
   if(on5&&v5>=s.min&&v5<=s.max)issues.push(mkIssue('voltage.rail5','info',`${use.partId} needs ${s.min}-${s.max} V: power it from the 5 V pin, not 3V3.`,`${use.partId} butuh ${s.min}-${s.max} V: ambil dari pin 5 V, bukan 3V3.`,use.partId,grade));
   else issues.push(mkIssue('voltage.supply',sev('error'),`${use.partId} needs ${s.min}-${s.max} V; ${b.label} offers ${b.logicV} V logic rail.`,`${use.partId} butuh ${s.min}-${s.max} V; ${b.label} menyediakan rail logika ${b.logicV} V.`,use.partId,grade));
  }
  // logic level
  const lv=logicOf(rec);
  if(lv!==undefined){
   grade=gradeOf(rec.electrical.logicLevelV!.p.confidence);
   if(lv<b.logicV-0.3)issues.push(mkIssue('logic.low',sev('warning'),`${use.partId} logic is ${lv} V; ${b.label} drives ${b.logicV} V. Add a level shifter.`,`Logika ${use.partId} ${lv} V; ${b.label} mengeluarkan ${b.logicV} V. Tambahkan level shifter.`,use.partId,grade));
   if(lv>b.logicV+0.3)issues.push(mkIssue('logic.high',sev('error'),`${use.partId} signals at ${lv} V on a ${b.logicV} V board. Add a level shifter or a divider.`,`${use.partId} bersinyal ${lv} V pada board ${b.logicV} V. Tambahkan level shifter atau pembagi tegangan.`,use.partId,grade));
  }
  // bus
  grade=gradeOf(rec.protocols.supported.p.confidence);
  for(const p of rec.protocols.supported.v){
   const need=BUS_NEEDS[p];
   if(need&&!b.buses.includes(need))issues.push(mkIssue('bus.unsupported',sev('error'),`${use.partId} needs ${p}, which ${b.label} does not provide.`,`${use.partId} butuh ${p} yang tidak disediakan ${b.label}.`,use.partId,grade));
  }
  if(rec.protocols.supported.v.includes('rs485')&&!b.buses.includes('uart'))issues.push(mkIssue('bus.unsupported',sev('error'),`${use.partId} needs a UART for RS-485.`,`${use.partId} butuh UART untuk RS-485.`,use.partId,grade));
  // I2C address
  const over=typeof use.props?.address==='number'?[use.props.address]:rec.protocols.i2cAddresses?.v??[];
  for(const a of over)for(let i=0;i<qty;i++){const l=addrs.get(a)??[];l.push(use.partId);addrs.set(a,l);}
  // current
  peakMa+=currentOf(rec).peak*qty;
  // LoRa band (founder: band is enforced; power and duty limits are info only)
  if(rec.protocols.supported.v.includes('lora')){
   const f=rec.protocols.freqMHz?.v;
   if(isWrongBandId(use.partId)||isWrongBandId(kind)||(f&&!coversBand(f)))
    issues.push(ruleIssue('NET-05',use.partId,{en:`${use.partId} (${f?`${f.min}-${f.max} MHz`:'433/868 MHz family'}) cannot cover ${LORA_BAND.minMHz}-${LORA_BAND.maxMHz} MHz. Use RFM95W, Ra-01H or SX1262 915.`,id:`${use.partId} (${f?`${f.min}-${f.max} MHz`:'keluarga 433/868 MHz'}) tidak mencakup ${LORA_BAND.minMHz}-${LORA_BAND.maxMHz} MHz. Gunakan RFM95W, Ra-01H atau SX1262 915.`}));
  }
 }
 for(const [a,who] of addrs)if(who.length>1)issues.push(mkIssue('i2c.address',graded('error','B'),`I2C address 0x${a.toString(16)} is used by ${who.join(' and ')}. Change the address or use a multiplexer.`,`Alamat I2C 0x${a.toString(16)} dipakai ${who.join(' dan ')}. Ubah alamat atau pakai multiplexer.`,`0x${a.toString(16)}`,'B'));
 if(peakMa>b.railMa)issues.push(mkIssue('current.rail','error',`Peak part current ${Math.round(peakMa)} mA exceeds the ${b.label} rail (${b.railMa} mA).`,`Arus puncak part ${Math.round(peakMa)} mA melebihi rail ${b.label} (${b.railMa} mA).`,undefined,'B'));
 else if(peakMa>b.railMa*0.8)issues.push(mkIssue('current.rail','warning',`Peak part current ${Math.round(peakMa)} mA is above 80% of the ${b.label} rail (${b.railMa} mA).`,`Arus puncak part ${Math.round(peakMa)} mA di atas 80% rail ${b.label} (${b.railMa} mA).`,undefined,'B'));
 if(input.supplyV!==undefined){
  const brec=lookup(input.board);const bs=brec&&supplyOf(brec);
  if(bs&&(input.supplyV<bs.min||input.supplyV>bs.max))issues.push(mkIssue('voltage.board','warning',`Supply ${input.supplyV} V is outside the ${b.label} range ${bs.min}-${bs.max} V.`,`Suplai ${input.supplyV} V di luar rentang ${b.label} ${bs.min}-${bs.max} V.`,input.board,'B'));
 }
 return {ok:!hasError(issues),issues:issues.slice(0,100)};
}

/** Gate adapter for a stored node. */
export function checkNodeCompat(node:ProNode,lookup:PartLookup):ToolIssue[]{
 const parts=node.parts.map(p=>({partId:p.kind,qty:p.qty}));
 if(parts.length===0)return [];
 return checkCompatibility({board:node.board,parts,supplyV:node.power.supplyV},lookup).issues;
}
