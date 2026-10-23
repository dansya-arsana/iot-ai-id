/**
 * estimate_link (agri-domain §3). Always an estimate. LoRa: log-distance path loss against SX127x sensitivity;
 * ok at >= 18 dB margin, warning 10 to 18, error under 10. Band is enforced (920-923 MHz; a 433/868 MHz module is an error);
 * the Kominfo power and duty limits are INFO only (founder decision: the company holds an official licence).
 */
import {mkIssue,ruleIssue,hasError,type PartLookup,type ToolIssue} from './common.js';
import {ANTENNA_DEFAULTS,KOMINFO_INFO,LINK_MARGIN,LORA_BAND,coversBand,isWrongBandId,loraAirtimeS,pathLossDb,sensitivityDbm,REGULATORY_NOTE,type Terrain} from '../data/radio.js';
import type {SystemSpec} from '../../pro-contract/system-spec.js';

export type LinkInput={medium:'lora'|'wifi'|'rs485';distanceM:number;terrain:'open'|'rural'|'dense'|'indoor';sf?:number;txDbm?:number;moduleId?:string};
export type LinkOutput={marginDb:number|null;status:'ok'|'warning'|'error';estimate:true;issues:ToolIssue[]};
export const LORA_DEFAULT_TX_DBM=14;
export const LORA_PAYLOAD_BYTES=20;
const r1=(n:number)=>Math.round(n*10)/10;

export function marginFor(distanceM:number,terrain:Terrain,sf:number,txDbm:number,fMHz=921.4,bwKHz=125):number{
 const eirp=txDbm+ANTENNA_DEFAULTS.nodeDbi-ANTENNA_DEFAULTS.cableLossDb;
 const rx=eirp+ANTENNA_DEFAULTS.gatewayDbi-pathLossDb(distanceM,terrain,fMHz);
 return rx-sensitivityDbm(sf,bwKHz);
}

export function estimateLink(input:LinkInput,lookup?:PartLookup):LinkOutput{
 const issues:ToolIssue[]=[];
 let margin:number|null=null;
 if(input.medium==='lora'){
  const tx=input.txDbm??LORA_DEFAULT_TX_DBM;
  // module band (founder: error in Pro)
  if(input.moduleId){
   const rec=lookup?.(input.moduleId);
   if(isWrongBandId(input.moduleId)||(rec?.protocols.freqMHz&&!coversBand(rec.protocols.freqMHz.v)))
    issues.push(ruleIssue('NET-05',input.moduleId,{en:`${input.moduleId} cannot run in ${LORA_BAND.minMHz}-${LORA_BAND.maxMHz} MHz. Use RFM95W, Ra-01H or SX1262 915.`,id:`${input.moduleId} tidak bisa bekerja di ${LORA_BAND.minMHz}-${LORA_BAND.maxMHz} MHz. Gunakan RFM95W, Ra-01H atau SX1262 915.`}));
  }
  let sf=input.sf;
  if(sf===undefined){
   sf=12;
   for(let s=7;s<=12;s++)if(marginFor(input.distanceM,input.terrain,s,tx)>=LINK_MARGIN.okDb){sf=s;break;}
   issues.push(mkIssue('link.sf-chosen','info',`No SF given; SF${sf} is the lowest spreading factor that reaches the margin target.`,`SF tidak diberikan; SF${sf} adalah spreading factor terendah yang mencapai target margin.`,undefined,'M'));
  }
  margin=r1(marginFor(input.distanceM,input.terrain,sf,tx));
  issues.push(mkIssue('link.estimate','info',`Estimate: log-distance path loss (${input.terrain}), SF${sf}, ${tx} dBm, antennas ${ANTENNA_DEFAULTS.nodeDbi}/${ANTENNA_DEFAULTS.gatewayDbi} dBi. Not a site survey.`,`Estimasi: path loss log-jarak (${input.terrain}), SF${sf}, ${tx} dBm, antena ${ANTENNA_DEFAULTS.nodeDbi}/${ANTENNA_DEFAULTS.gatewayDbi} dBi. Bukan survei lapangan.`,undefined,'M'));
  if(margin<LINK_MARGIN.warnDb)issues.push(mkIssue('link.margin','error',`Link margin ${margin} dB is under ${LINK_MARGIN.warnDb} dB. Raise the antenna, lower the distance, add a relay or raise SF.`,`Margin link ${margin} dB di bawah ${LINK_MARGIN.warnDb} dB. Naikkan antena, perpendek jarak, tambah relay atau naikkan SF.`,undefined,'M'));
  else if(margin<LINK_MARGIN.okDb)issues.push(mkIssue('link.margin','warning',`Link margin ${margin} dB is under ${LINK_MARGIN.okDb} dB. Plan a site RSSI survey.`,`Margin link ${margin} dB di bawah ${LINK_MARGIN.okDb} dB. Rencanakan survei RSSI lapangan.`,undefined,'M'));
  if((input.terrain==='dense'&&input.distanceM>1000)||input.distanceM>5000)issues.push(ruleIssue('NET-07'));
  // INFO only (licensed): EIRP, airtime and duty-cycle figures
  const eirp=tx+ANTENNA_DEFAULTS.nodeDbi-ANTENNA_DEFAULTS.cableLossDb;
  if(eirp>KOMINFO_INFO.endNodeEirpDbm)issues.push(ruleIssue('NET-02',undefined,{en:`Node EIRP ${eirp} dBm is above the 20 dBm (100 mW) class-licence figure. Information only.`,id:`EIRP node ${eirp} dBm di atas angka izin kelas 20 dBm (100 mW). Hanya informasi.`}));
  const air=loraAirtimeS(LORA_PAYLOAD_BYTES,sf);
  const perHour=Math.floor(3600*KOMINFO_INFO.uplinkDuty/air);
  issues.push(mkIssue('net-04','info',`Airtime for ${LORA_PAYLOAD_BYTES} B at SF${sf}: ${Math.round(air*1000)} ms; about ${perHour} uplinks per hour fit a 1% duty figure (information only).`,`Airtime ${LORA_PAYLOAD_BYTES} B pada SF${sf}: ${Math.round(air*1000)} ms; sekitar ${perHour} uplink per jam sesuai angka duty 1% (hanya informasi).`,undefined,'A'));
  issues.push(mkIssue('net-06','info',REGULATORY_NOTE.en,REGULATORY_NOTE.id,undefined,'A'));
 }else if(input.medium==='wifi'){
  if(input.distanceM>300)issues.push(mkIssue('link.margin','error',`Wi-Fi at ${input.distanceM} m is beyond even an outdoor CPE. Use LoRa.`,`Wi-Fi pada ${input.distanceM} m melebihi jangkauan CPE outdoor. Gunakan LoRa.`,undefined,'M'));
  else if(input.distanceM>80||input.terrain==='dense')issues.push(ruleIssue('NET-08'));
  issues.push(mkIssue('link.estimate','info','Estimate: 30-80 m outdoors with a PCB antenna, 150-300 m with an external antenna or CPE.','Estimasi: 30-80 m di luar ruangan dengan antena PCB, 150-300 m dengan antena eksternal atau CPE.',undefined,'M'));
 }else{
  if(input.distanceM>1200)issues.push(ruleIssue('NET-09',undefined,{en:`RS-485 at ${input.distanceM} m exceeds 1200 m at 9600 bps.`,id:`RS-485 pada ${input.distanceM} m melebihi 1200 m pada 9600 bps.`}));
  if(input.distanceM>30)issues.push(mkIssue('net-10','info',`RS-485 run over 30 m (${input.distanceM} m): fit surge protection or isolation at both ends, 120 ohm termination at both ends.`,`Jalur RS-485 lebih dari 30 m (${input.distanceM} m): pasang proteksi surja atau isolasi di kedua ujung, terminasi 120 ohm di kedua ujung.`,undefined,'M'));
 }
 const status:LinkOutput['status']=hasError(issues)?'error':issues.some(i=>i.severity==='warning')?'warning':'ok';
 return {marginDb:margin,status,estimate:true,issues:issues.slice(0,100)};
}

/** Gate adapter for a stored link. */
export function checkStoredLink(link:SystemSpec['links'][number],spec:Pick<SystemSpec,'nodes'|'fields'>,lookup?:PartLookup):{status:'ok'|'warning'|'error';issues:ToolIssue[]}{
 const p=link.params;
 const node=spec.nodes.find(n=>n.id===link.from);
 const terrain:Terrain='rural';
 if(p.medium==='lora'){
  const module=node?.parts.find(x=>x.role==='radio')?.kind;
  const base=estimateLink({medium:'lora',distanceM:Math.max(link.distanceM,1),terrain,sf:p.sf,txDbm:p.txPowerDbm,...(module?{moduleId:module}:{})},lookup);
  const issues=base.issues.filter(i=>i.code!=='link.estimate');
  const margin=marginFor(Math.max(link.distanceM,1),terrain,p.sf,p.txPowerDbm,p.freqMHz,p.bwKHz);
  const stored=link.estimate.marginDb;
  if(stored!==undefined&&Math.abs(stored-margin)>12)issues.push(mkIssue('link.estimate-drift','warning',`Stored margin ${stored} dB differs from the recomputed ${r1(margin)} dB.`,`Margin tersimpan ${stored} dB berbeda dari hasil hitung ulang ${r1(margin)} dB.`,link.id,'M'));
  if(p.freqMHz<LORA_BAND.minMHz||p.freqMHz>LORA_BAND.maxMHz||p.freqMHz-p.bwKHz/2000<LORA_BAND.minMHz||p.freqMHz+p.bwKHz/2000>LORA_BAND.maxMHz)issues.push(ruleIssue('NET-01',link.id));
  const status=hasError(issues)?'error':issues.some(i=>i.severity==='warning')?'warning':'ok';
  return {status,issues};
 }
 const medium=p.medium==='wifi'||p.medium==='rs485'?p.medium:undefined;
 if(!medium)return {status:'ok',issues:[]};
 const r=estimateLink({medium,distanceM:Math.max(link.distanceM,1),terrain:'open'},lookup);
 return {status:r.status,issues:r.issues.filter(i=>i.code!=='link.estimate')};
}
