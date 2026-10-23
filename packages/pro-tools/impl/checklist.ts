/**
 * Checklist generator. Ids come from ckId() and depend only on the physical action (never W-numbers or quantities), so ticks survive
 * regeneration. Titles may carry quantities; tickHashInput() makes the UI show "changed since you ticked" without clearing the tick.
 */
import {ckId,wireKey,PRO_LIMITS,type ChecklistItem,type ChecklistPhase,type SystemSpec} from '../../pro-contract/system-spec.js';
import {boardProfile} from './common.js';

export type ChecklistSpec=Pick<SystemSpec,'fields'|'nodes'|'links'|'code'|'bom'>;
const cut=(s:string,n=120)=>s.length>n?s.slice(0,n-1)+'…':s;
const bi=(en:string,id:string,n=120)=>({en:cut(en,n),id:cut(id,n)});

export function buildChecklist(spec:ChecklistSpec):ChecklistItem[]{
 const items:ChecklistItem[]=[];
 const seen=new Set<string>();
 const add=(phase:ChecklistPhase,parts:string[],title:{en:string;id:string},extra:Partial<Pick<ChecklistItem,'fieldId'|'nodeId'|'ref'|'detail'>>={})=>{
  const id=ckId(phase,...parts);
  if(seen.has(id))return;seen.add(id);
  items.push({id,phase,order:items.length,title,...extra});
 };
 // procure
 for(const l of spec.bom.lines)add('procure',[l.key],bi(`Buy ${l.name.en} (${l.qty} ${l.unit})`,`Beli ${l.name.id} (${l.qty} ${l.unit})`),{ref:{bomKey:l.key}});
 // flash
 for(const n of spec.nodes){
  const files=spec.code.filter(c=>c.nodeId===n.id);
  if(files.length===0)continue;
  add('flash',[n.id],bi(`Flash ${n.id}`,`Flash ${n.id}`),{nodeId:n.id,...(n.fieldId?{fieldId:n.fieldId}:{}),ref:{fileId:files[0]!.id}});
  add('flash',[n.id,'review-code'],bi(`Review the code of ${n.id} before flashing`,`Tinjau kode ${n.id} sebelum flash`),{nodeId:n.id,ref:{fileId:files[0]!.id}});
  if(files.some(f=>/YOUR_WIFI|YOUR_LORA/.test(f.content)))add('flash',[n.id,'secrets'],bi('Fill in the Wi-Fi/LoRa secrets on your machine; never paste them into the prompt','Isi rahasia Wi-Fi/LoRa di komputer Anda; jangan tempel ke prompt'),{nodeId:n.id});
 }
 // wire
 for(const n of spec.nodes){
  for(const w of n.wires){
   const part=w.from.part==='board'?w.to:w.from,boardEnd=w.from.part==='board'?w.from:w.to.part==='board'?w.to:undefined;
   const what=boardEnd?`${part.part}.${part.pin} to ${boardEnd.pin}`:`${w.from.part}.${w.from.pin} to ${w.to.part}.${w.to.pin}`;
   add('wire',[n.id,wireKey(w)],bi(`${n.id}: wire ${what}`,`${n.id}: sambungkan ${what}`),{nodeId:n.id,...(n.fieldId?{fieldId:n.fieldId}:{}),ref:{wireId:w.id,partId:part.part==='board'?undefined:part.part}});
  }
  if(n.enclosure.glands>0)add('wire',[n.id,'glands'],bi(`${n.id}: fit ${n.enclosure.glands} cable glands on the bottom face with drip loops`,`${n.id}: pasang ${n.enclosure.glands} kabel gland di sisi bawah dengan drip loop`),{nodeId:n.id});
 }
 // power-up
 for(const n of spec.nodes){
  const logic=boardProfile(n.board).logicV;
  add('power-up',[n.id,'rails'],bi(`${n.id}: measure the supply rail (${logic} V) before connecting parts`,`${n.id}: ukur rail suplai (${logic} V) sebelum menyambung part`),{nodeId:n.id});
  if(n.power.battery)add('power-up',[n.id,'battery'],bi(`${n.id}: check battery polarity and voltage`,`${n.id}: cek polaritas dan tegangan baterai`),{nodeId:n.id});
  if(n.power.solar)add('power-up',[n.id,'panel'],bi(`${n.id}: check panel open-circuit voltage and the controller chemistry setting`,`${n.id}: cek tegangan open-circuit panel dan pengaturan kimia controller`),{nodeId:n.id});
 }
 // install
 for(const n of spec.nodes){
  if(n.role==='gateway'){
   add('install',['gateway-mast',n.id],bi('Mount the gateway antenna on a 6-10 m mast, outside any metal structure','Pasang antena gateway di tiang 6-10 m, di luar struktur logam'),{nodeId:n.id});
   add('install',['gateway-earth',n.id],bi('Bond the mast earth electrode (5 ohm target) and fit the N-type coax arrester','Sambungkan elektroda grounding tiang (target 5 ohm) dan pasang arrester koaks tipe N'),{nodeId:n.id});
  }else add('install',[n.fieldId??n.id,n.id],bi(`Mount ${n.id} on its ${n.enclosure.mount} with a sun shield`,`Pasang ${n.id} di ${n.enclosure.mount} dengan pelindung matahari`),{nodeId:n.id,...(n.fieldId?{fieldId:n.fieldId}:{})});
 }
 // calibrate
 for(const n of spec.nodes)for(const p of n.parts)if(/soil|moisture/.test(p.kind))
  add('calibrate',[n.id,p.id,'dry-wet'],bi(`${n.id}: record raw_dry (air) and raw_fc (field capacity) for ${p.id}`,`${n.id}: catat raw_dry (udara) dan raw_fc (kapasitas lapang) untuk ${p.id}`),{nodeId:n.id,ref:{partId:p.id}});
 // commission
 for(const l of spec.links)add('commission',[l.id],bi(`Range test ${l.from} to ${l.to}`,`Uji jangkauan ${l.from} ke ${l.to}`),{ref:{linkId:l.id}});
 for(const n of spec.nodes)if(n.role==='field')add('commission',[n.id,'first-reading'],bi(`${n.id}: confirm the first reading reaches the gateway`,`${n.id}: pastikan pembacaan pertama sampai ke gateway`),{nodeId:n.id,...(n.fieldId?{fieldId:n.fieldId}:{})});
 return items.slice(0,PRO_LIMITS.checklistItems).map((it,i)=>({...it,order:i}));
}
