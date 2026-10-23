/** Test plan generator: bench, link, field and acceptance cases with stable ids (`test:<phase>:...`). */
import {PRO_LIMITS,type SystemSpec} from '../../pro-contract/system-spec.js';
import {boardProfile} from './common.js';
import {BANNER_PREFIX} from './config-block.js';
import {LINK_MARGIN} from '../data/radio.js';

export type TestSpec=Pick<SystemSpec,'fields'|'nodes'|'links'>;
export type TestCase=SystemSpec['tests'][number];
const cut=(s:string,n=120)=>s.length>n?s.slice(0,n-1)+'…':s;
const bi=(en:string,id:string)=>({en:cut(en),id:cut(id)});
const tid=(...p:string[])=>`test:${p.map(x=>x.toLowerCase().replace(/[^a-z0-9._-]+/g,'-').replace(/^-+|-+$/g,'')).filter(Boolean).join(':')}`.slice(0,125);

export function buildTestPlan(spec:TestSpec):TestCase[]{
 const out:TestCase[]=[];
 const seen=new Set<string>();
 const add=(t:TestCase)=>{if(seen.has(t.id))return;seen.add(t.id);out.push(t);};
 for(const n of spec.nodes){
  const logic=boardProfile(n.board).logicV;
  add({id:tid('bench',n.id,'power'),phase:'bench',nodeId:n.id,title:bi(`${n.id}: supply rail`,`${n.id}: rail suplai`),
   steps:[bi('Power the node from its real source','Nyalakan node dari sumber daya aslinya'),bi(`Measure the ${logic} V rail with a multimeter`,`Ukur rail ${logic} V dengan multimeter`)],
   expect:bi(`${logic} V within 0.1 V`,`${logic} V dalam 0,1 V`),measure:{quantity:'rail voltage',unit:'V',min:logic-0.1,max:logic+0.1}});
  add({id:tid('bench',n.id,'boot'),phase:'bench',nodeId:n.id,title:bi(`${n.id}: boot banner`,`${n.id}: banner boot`),
   steps:[bi('Open the serial monitor at 115200 baud','Buka serial monitor di 115200 baud'),bi('Reset the board','Reset board')],
   expect:bi(`A line starting with ${BANNER_PREFIX}:${n.id}`,`Satu baris diawali ${BANNER_PREFIX}:${n.id}`)});
  for(const p of n.parts){
   if(p.role!=='sensor')continue;
   const soil=/soil|moisture/.test(p.kind),temp=/ds18b20|dht|sht|bme/.test(p.kind);
   add({id:tid('bench',n.id,p.id),phase:'bench',nodeId:n.id,title:bi(`${p.id}: reads a plausible value`,`${p.id}: membaca nilai yang masuk akal`),
    steps:[bi('Wait for the first sample','Tunggu sampel pertama'),bi(soil?'Read the raw value in dry air, then in water':'Compare with a reference thermometer or meter',soil?'Baca nilai mentah di udara kering, lalu di air':'Bandingkan dengan termometer atau alat ukur referensi')],
    expect:bi(soil?'Raw value differs clearly between air and water':'Reading is within the sensor tolerance of the reference',soil?'Nilai mentah berbeda jelas antara udara dan air':'Pembacaan dalam toleransi sensor terhadap referensi'),
    ...(temp?{measure:{quantity:'temperature',unit:'C',min:-10,max:60}}:{})});
  }
  if(n.role!=='gateway'){
   const soil=n.parts.find(p=>/soil|moisture/.test(p.kind));
   if(soil)add({id:tid('field',n.id,soil.id,'dry-wet'),phase:'field',nodeId:n.id,title:bi(`${soil.id}: field dry/wet check`,`${soil.id}: cek kering/basah di lahan`),
    steps:[bi('Install the probe at root depth','Pasang probe di kedalaman akar'),bi('Record the reading before and after watering','Catat pembacaan sebelum dan sesudah penyiraman')],
    expect:bi('Reading rises after watering and falls as soil drains','Pembacaan naik setelah penyiraman dan turun saat tanah mengering')});
   add({id:tid('field',n.id,'enclosure'),phase:'field',nodeId:n.id,title:bi(`${n.id}: enclosure and glands`,`${n.id}: enclosure dan gland`),
    steps:[bi('Check glands, drip loops, vent and desiccant','Cek gland, drip loop, vent dan desiccant')],expect:bi('No gaps, loose glands or standing water','Tidak ada celah, gland longgar atau genangan air')});
  }
 }
 for(const l of spec.links){
  const lora=l.params.medium==='lora';
  add({id:tid('link',l.id),phase:'link',linkId:l.id,nodeId:l.from,title:bi(`${l.from} to ${l.to}: range test`,`${l.from} ke ${l.to}: uji jangkauan`),
   steps:[bi('Power the node and the gateway','Nyalakan node dan gateway'),bi(lora?'Read RSSI and SNR at the gateway from the node mounted at its final spot':'Send a test message from the node','Baca RSSI dan SNR di gateway dengan node di posisi akhir')].map((s,i)=>i===1&&!lora?bi('Send a test message from the node','Kirim pesan uji dari node'):s),
   expect:lora?bi(`RSSI above -115 dBm and SNR above -7 dB (estimate margin target ${LINK_MARGIN.okDb} dB)`,`RSSI di atas -115 dBm dan SNR di atas -7 dB (target margin estimasi ${LINK_MARGIN.okDb} dB)`):bi('Messages are received','Pesan diterima'),
   ...(lora?{measure:{quantity:'RSSI',unit:'dBm',min:-115}}:{})});
 }
 for(const n of spec.nodes){
  if(n.role!=='field'||!n.fieldId)continue;
  add({id:tid('acceptance',n.fieldId),phase:'acceptance',nodeId:n.id,title:bi(`${n.fieldId}: data reaches the gateway`,`${n.fieldId}: data sampai ke gateway`),
   steps:[bi('Leave the system running for one hour','Biarkan sistem berjalan satu jam'),bi('Check the readings at the gateway','Periksa pembacaan di gateway')],
   expect:bi('Readings arrive at every sample interval','Pembacaan masuk setiap interval sampel'),measure:{quantity:'delivery delay',unit:'s',max:n.sampleEveryS*2}});
 }
 if(spec.nodes.length>0)add({id:tid('acceptance','system'),phase:'acceptance',title:bi('All nodes report for 24 hours','Semua node melapor selama 24 jam'),
  steps:[bi('Run the full system for 24 hours','Jalankan seluruh sistem selama 24 jam'),bi('Count missed samples per node','Hitung sampel yang hilang per node')],expect:bi('No node misses more than 5% of samples','Tidak ada node yang kehilangan lebih dari 5% sampel')});
 return out.slice(0,PRO_LIMITS.testCases);
}
