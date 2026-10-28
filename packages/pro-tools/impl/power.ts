/**
 * solve_power (agri-domain §4). Method: E = sum(current x V x hours); /eta; battery = E x autonomy / DoD;
 * PV = E / (PSH x derate) x 1.3. Defaults: 3.5 peak sun hours (wet-season month, D3), autonomy 3 days, derate 0.6 (PWM) or 0.7 (MPPT).
 * Currents come from the catalog (typ, peak, sleepUa) referred to the battery side; a DevKit board gets a 10 mA sleep floor (PWR-02).
 */
import {currentOf,kindOf,mkIssue,ruleIssue,type PartLookup,type ToolIssue} from './common.js';
import type {ProNode,SystemSpec} from '../../pro-contract/system-spec.js';

export type PowerInput={loads:{partId:string;dutyCycle?:number}[];source:'solar'|'battery'|'mains';chemistry?:'li-ion-18650'|'lifepo4'|'sla';site?:{peakSunHours?:number;autonomyDays?:number}};
export type PowerOutput={avgMa:number;peakMa:number;whPerDay:number;batteryWh:number|null;panelW:number|null;controller:'pwm'|'mppt'|'none';issues:ToolIssue[]};

export const POWER_DEFAULTS={peakSunHours:3.5,autonomyDays:3,recovery:1.3,etaRegulator:0.8,mainsV:5,devkitSleepMa:10,mpptAboveWhPerDay:5} as const;
export const CHEMISTRY={'li-ion-18650':{nominalV:3.7,dod:0.7},'lifepo4':{nominalV:12.8,dod:0.8},'sla':{nominalV:12,dod:0.5}} as const;
const DEVKIT_RE=/devkit|nodemcu/;
const r2=(n:number)=>Math.round(n*100)/100;

export function solvePower(input:PowerInput,lookup:PartLookup):PowerOutput{
 const issues:ToolIssue[]=[];
 const chem=input.chemistry??'li-ion-18650';
 const chemInfo=CHEMISTRY[chem];
 const mains=input.source==='mains';
 const V=mains?POWER_DEFAULTS.mainsV:chemInfo.nominalV;
 const psh=input.site?.peakSunHours??POWER_DEFAULTS.peakSunHours;
 const days=input.site?.autonomyDays??POWER_DEFAULTS.autonomyDays;
 let avg=0,peak=0;
 for(const l of input.loads){
  const rec=lookup(l.partId);
  if(!rec){issues.push(mkIssue('part.unknown','error',`Part ${l.partId} is not in the catalog.`,`Part ${l.partId} tidak ada di katalog.`,l.partId));continue;}
  const c=currentOf(rec),d=l.dutyCycle??1;
  let sleepMa=(c.sleepUa??0)/1000;
  if(DEVKIT_RE.test(l.partId)||DEVKIT_RE.test(kindOf(rec))){
   if(!mains){issues.push(ruleIssue('PWR-02',l.partId));sleepMa=Math.max(sleepMa,POWER_DEFAULTS.devkitSleepMa);}
  }
  avg+=c.typ*d+sleepMa*(1-d);peak+=c.peak;
 }
 if(!mains&&input.source==='battery'&&!input.chemistry)issues.push(mkIssue('pwr.chemistry-default','info','No chemistry given; sized for a Li-ion 18650 pack.','Kimia baterai tidak diberikan; dihitung untuk paket Li-ion 18650.',undefined,'M'));
 const eta=mains?1:POWER_DEFAULTS.etaRegulator;
 const whPerDay=(avg*V*24/1000)/eta;
 let batteryWh:number|null=null,panelW:number|null=null,controller:PowerOutput['controller']='none';
 if(input.source!=='mains'){
  batteryWh=whPerDay*days/chemInfo.dod;
  if(days<3)issues.push(ruleIssue('PWR-06',undefined,{en:`Autonomy ${days} days is below the 3-day minimum (5 days for highland or rainy-season sites).`,id:`Otonomi ${days} hari di bawah minimum 3 hari (5 hari untuk dataran tinggi atau musim hujan).`}));
 }
 if(input.source==='solar'){
  controller=whPerDay<POWER_DEFAULTS.mpptAboveWhPerDay?'pwm':'mppt';
  const derate=controller==='mppt'?0.7:0.6;
  panelW=whPerDay/(psh*derate)*POWER_DEFAULTS.recovery;
  issues.push(ruleIssue('PWR-03'));
  issues[issues.length-1]!.severity='info';
  if(psh>4)issues.push(ruleIssue('PWR-07'));
 }
 return {avgMa:r2(avg),peakMa:r2(peak),whPerDay:r2(whPerDay),batteryWh:batteryWh===null?null:r2(batteryWh),panelW:panelW===null?null:r2(panelW),controller,issues:issues.slice(0,100)};
}

const SOURCE_MAP={'solar-battery':'solar','battery':'battery','mains':'mains','usb':'mains','vehicle-12v':'mains'} as const; // vehicle 12 V: continuous supply while the engine runs
/** Gate adapter: compare the stored design of a node with what the method requires. Issues only. */
export function checkNodePower(node:ProNode,spec:Pick<SystemSpec,'site'>,lookup:PartLookup):ToolIssue[]{
 const loads=[{partId:node.board},...node.parts.flatMap(p=>Array.from({length:p.qty},()=>({partId:p.kind})))];
 const known=loads.filter(l=>lookup(l.partId));
 const source=SOURCE_MAP[node.power.source];
 const need=solvePower({loads:known,source,...(node.power.battery?{chemistry:node.power.battery.chemistry}:{}),site:{peakSunHours:spec.site.peakSunHours,...(node.power.battery?{autonomyDays:node.power.battery.autonomyDays}:{})}},lookup);
 const issues=need.issues.filter(i=>i.code!=='part.unknown'&&i.code!=='pwr-03');
 const loc=node.id;
 if(source!=='mains'&&!node.power.battery)issues.push(mkIssue('pwr-01','warning',`${loc} runs on ${node.power.source} but defines no battery.`,`${loc} memakai ${node.power.source} tetapi belum mendefinisikan baterai.`,loc,'M'));
 if(node.power.battery&&need.batteryWh!==null){
  const have=node.power.battery.capacityWh,want=need.batteryWh;
  if(have<want*0.9)issues.push(ruleIssue('PWR-01',loc,{en:`Battery ${r2(have)} Wh is below the ${r2(want)} Wh the method needs for ${node.power.battery.autonomyDays} days.`,id:`Baterai ${r2(have)} Wh di bawah ${r2(want)} Wh yang dibutuhkan metode untuk ${node.power.battery.autonomyDays} hari.`}));
 }
 if(source==='solar'){
  if(!node.power.solar)issues.push(ruleIssue('PWR-01',loc,{en:`${loc} is solar-powered but has no panel.`,id:`${loc} bertenaga surya tetapi tidak punya panel.`}));
  else if(need.panelW!==null&&node.power.solar.panelW<need.panelW*0.9)issues.push(ruleIssue('PWR-01',loc,{en:`Panel ${node.power.solar.panelW} W is below the ${r2(need.panelW)} W the method needs (${spec.site.peakSunHours} peak sun hours).`,id:`Panel ${node.power.solar.panelW} W di bawah ${r2(need.panelW)} W yang dibutuhkan (${spec.site.peakSunHours} jam puncak).`}));
 }
 if(node.power.budget.avgMa<need.avgMa*0.5&&need.avgMa>0)issues.push(mkIssue('pwr.budget','warning',`Declared average ${node.power.budget.avgMa} mA is far below the catalog estimate ${need.avgMa} mA.`,`Rata-rata yang dinyatakan ${node.power.budget.avgMa} mA jauh di bawah perkiraan katalog ${need.avgMa} mA.`,loc,'M'));
 return issues;
}
