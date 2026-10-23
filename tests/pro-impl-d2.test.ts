import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {PartRecordSchema,type PartRecord} from '../packages/catalog/schema.js';
import {SystemSpecSchema,CHECKLIST_ID_RE,ChecklistItemSchema,TestCaseSchema,CheckSchema,BomLineSchema,ckId,wireKey} from '../packages/pro-contract/system-spec.js';
import {solvePower,checkNodePower} from '../packages/pro-tools/impl/power.js';
import {estimateLink,checkStoredLink,marginFor} from '../packages/pro-tools/impl/link.js';
import {priceBom,buildBom} from '../packages/pro-tools/impl/bom.js';
import {siteClimate,ClimateError} from '../packages/pro-tools/impl/climate.js';
import {runChecks} from '../packages/pro-tools/impl/checks.js';
import {buildChecklist} from '../packages/pro-tools/impl/checklist.js';
import {buildTestPlan} from '../packages/pro-tools/impl/testplan.js';
import {loraAirtimeS,isWrongBandId,KOMINFO_INFO,DEFAULT_LORA_MODULE} from '../packages/pro-tools/data/radio.js';
import {RULES,effectiveSeverity} from '../packages/pro-tools/data/rules.js';
import {CROP_PROFILES,cropProfile} from '../packages/pro-tools/data/crops.js';
import {PRICES,PRICE_DISCLAIMER} from '../packages/pro-tools/data/prices.js';
import {getTool} from '../packages/pro-tools/registry.js';

const cat=JSON.parse(readFileSync(new URL('../packages/catalog/fixtures/farm-parts.json',import.meta.url),'utf8')) as {parts:unknown[]};
const parts=new Map((cat.parts as PartRecord[]).map(p=>[PartRecordSchema.parse(p).identity.id,p]));
const lookup=(id:string)=>parts.get(id);
const spec=SystemSpecSchema.parse(JSON.parse(readFileSync(new URL('../packages/pro-contract/fixtures/farm-4-fields/spec.r1.json',import.meta.url),'utf8')));
const out=(name:string,v:unknown)=>assert.ok(getTool(name)!.output.safeParse(v).success,`${name} output matches the registry schema`);

test('radio data: band, default module, airtime and wrong-band detection',()=>{
 assert.equal(DEFAULT_LORA_MODULE,'lora-rfm95w');
 for(const id of ['lora-ra02','ra-02','lora-sx1278','lora-433','lora-rfm95w-868'])assert.ok(isWrongBandId(id),id);
 for(const id of ['lora-rfm95w','lora-ra01h','esp32-devkitc','soil-moisture-capacitive'])assert.ok(!isWrongBandId(id),id);
 const sf7=loraAirtimeS(20,7),sf10=loraAirtimeS(20,10),sf12=loraAirtimeS(20,12);
 assert.ok(sf7>0.04&&sf7<0.08,String(sf7));assert.ok(sf10>0.25&&sf10<0.5,String(sf10));assert.ok(sf12>0.9&&sf12<1.8,String(sf12));
});
test('rules: C and M grades never error; Kominfo limits are info; RA-02 band rule is an error',()=>{
 for(const r of Object.values(RULES)){if(r.grade==='C'||r.grade==='M')assert.notEqual(effectiveSeverity(r),'error',r.id);}
 for(const id of ['NET-02','NET-03','NET-04','NET-06'])assert.equal(effectiveSeverity(RULES[id]!),'info',id);
 assert.equal(effectiveSeverity(RULES['NET-01']!),'error');assert.equal(effectiveSeverity(RULES['NET-05']!),'error');
 assert.equal(KOMINFO_INFO.endNodeEirpDbm,20);
 for(const r of Object.values(RULES)){assert.ok(r.en.length<300&&r.idn.length<300,r.id);}
});
test('solve_power: matches the agri §4 method and the registry schema',()=>{
 const r=solvePower({loads:[{partId:'soil-moisture-capacitive',dutyCycle:0.01},{partId:'lora-rfm95w',dutyCycle:0.01}],source:'solar',chemistry:'li-ion-18650'},lookup);
 out('solve_power',r);
 // avg = 5*.01 + 12*.01 = 0.17 mA @3.7 V, /0.8
 assert.ok(Math.abs(r.avgMa-0.17)<0.01);
 const wh=0.17*3.7*24/1000/0.8;assert.ok(Math.abs(r.whPerDay-wh)<0.01);
 assert.ok(Math.abs(r.batteryWh!-wh*3/0.7)<0.02);
 assert.equal(r.controller,'pwm');
 assert.ok(Math.abs(r.panelW!-wh/(3.5*0.6)*1.3)<0.02,'3.5 PSH, 0.6 derate, 1.3 recovery');
 const big=solvePower({loads:[{partId:'esp32-devkitc'}],source:'solar',chemistry:'lifepo4'},lookup);
 assert.equal(big.controller,'mppt');assert.ok(big.issues.some(i=>i.code==='pwr-02'),'DevKit sleep warning');
 assert.ok(big.issues.some(i=>i.code==='pwr-02'&&i.severity==='warning'));
 const mains=solvePower({loads:[{partId:'esp32-devkitc'}],source:'mains'},lookup);
 assert.equal(mains.batteryWh,null);assert.equal(mains.panelW,null);assert.equal(mains.controller,'none');
 assert.ok(solvePower({loads:[{partId:'ghost'}],source:'mains'},lookup).issues.some(i=>i.code==='part.unknown'));
 assert.ok(solvePower({loads:[{partId:'ds18b20'}],source:'solar',site:{peakSunHours:4.8}},lookup).issues.some(i=>i.code==='pwr-07'));
 assert.ok(solvePower({loads:[{partId:'ds18b20'}],source:'battery',site:{autonomyDays:1}},lookup).issues.some(i=>i.code==='pwr-06'));
});
test('check_node_power compares the stored design with the method',()=>{
 const n=structuredClone(spec.nodes[0]!);
 const fine=checkNodePower(n,spec,lookup);assert.ok(fine.every(i=>i.severity!=='error'));
 n.power.source='solar-battery';n.power.solar=undefined;
 assert.ok(checkNodePower(n,spec,lookup).some(i=>i.code==='pwr-01'));
 n.power.solar={panelW:0.5,controller:'pwm'};
 assert.ok(checkNodePower(n,spec,lookup).some(i=>i.code==='pwr-01'));
});
test('estimate_link: LoRa margins, SF choice, band, and Kominfo limits as info only',()=>{
 const a=estimateLink({medium:'lora',distanceM:400,terrain:'rural',sf:8,txDbm:14});
 out('estimate_link',a);assert.equal(a.status,'ok');assert.equal(a.estimate,true);assert.ok(a.marginDb!>=18);
 const far=estimateLink({medium:'lora',distanceM:15000,terrain:'dense',sf:12,txDbm:20});
 assert.equal(far.status,'error');assert.ok(far.marginDb!<10);
 const mid=estimateLink({medium:'lora',distanceM:1400,terrain:'dense',sf:7,txDbm:10});
 assert.ok(['warning','error'].includes(mid.status));
 assert.ok(marginFor(1000,'open',12,14)>marginFor(1000,'open',7,14));
 const auto=estimateLink({medium:'lora',distanceM:800,terrain:'rural'});
 assert.ok(auto.issues.some(i=>i.code==='link.sf-chosen'));
 // module: RA-02 is an error; RFM95W is fine
 assert.equal(estimateLink({medium:'lora',distanceM:300,terrain:'open',moduleId:'lora-ra02'}).status,'error');
 assert.notEqual(estimateLink({medium:'lora',distanceM:300,terrain:'open',moduleId:'lora-rfm95w'},lookup).status,'error');
 // founder: power and duty limits are info, never warning or error
 const hot=estimateLink({medium:'lora',distanceM:300,terrain:'open',sf:9,txDbm:20});
 for(const i of hot.issues.filter(x=>/^net-0[2346]$/.test(x.code)))assert.equal(i.severity,'info',i.code);
 assert.ok(hot.issues.some(i=>i.code==='net-02'),'EIRP info is present');
 assert.equal(hot.status,'ok');
 assert.equal(estimateLink({medium:'wifi',distanceM:30,terrain:'open'}).status,'ok');
 assert.equal(estimateLink({medium:'wifi',distanceM:120,terrain:'open'}).status,'warning');
 assert.equal(estimateLink({medium:'wifi',distanceM:400,terrain:'open'}).status,'error');
 assert.equal(estimateLink({medium:'rs485',distanceM:600,terrain:'open'}).status,'ok');
 assert.equal(estimateLink({medium:'rs485',distanceM:1300,terrain:'open'}).status,'error');
 assert.equal(estimateLink({medium:'wifi',distanceM:30,terrain:'open'}).marginDb,null);
});
test('stored links of the fixture check out; a channel edge outside the band is flagged',()=>{
 for(const l of spec.links){const r=checkStoredLink(l,spec,lookup);assert.notEqual(r.status,'error',l.id+JSON.stringify(r.issues));}
 const l=structuredClone(spec.links.find(x=>x.params.medium==='lora')!);
 if(l.params.medium==='lora')(l.params as {freqMHz:number}).freqMHz=922.99;
 assert.equal(checkStoredLink(l,spec,lookup).issues.some(i=>i.code==='net-01'),true,'bw edge leaves the band');
});
test('price_bom: dated table, catalog fallback, missing list',()=>{
 const r=priceBom({lines:[{partId:'lora-rfm95w',qty:2},{partId:'ds18b20',qty:3},{partId:'unobtainium',qty:1}]},lookup);
 out('price_bom',r);assert.deepEqual(r.missing,['unobtainium']);
 assert.equal(r.lines[0]!.minIdr,200_000);assert.equal(r.lines[0]!.maxIdr,300_000);
 assert.equal(r.totals.minIdr,r.lines.reduce((a,l)=>a+l.minIdr,0));
 assert.match(r.lines[0]!.checkedAt,/^\d{4}-\d{2}-\d{2}$/);
 const viaCatalog=priceBom({lines:[{partId:'battery-18650-pack',qty:1}]},id=>id==='battery-18650-pack'?lookup(id):undefined);
 assert.equal(viaCatalog.missing.length,0);
 assert.deepEqual(priceBom({lines:[{partId:'esp32-s3-devkitc-x',qty:1}]}).missing,['esp32-s3-devkitc-x']);
 for(const [k,p] of Object.entries(PRICES)){assert.ok(p.minIdr<=p.maxIdr,k);assert.match(k,/^[a-z][a-z0-9.-]{0,47}$/);}
 assert.match(PRICE_DISCLAIMER.en,/Indicative prices/);
});
test('buildBom: sums over nodes, cables by metre, totals match, lines validate',()=>{
 const b=buildBom(spec,lookup);
 for(const l of b.lines)BomLineSchema.parse(l);
 const esp=b.lines.find(l=>l.key==='esp32-devkitc')!;
 assert.equal(esp.qty,spec.nodes.filter(n=>n.board==='esp32-devkitc').length);
 assert.equal(esp.perNode.reduce((a,p)=>a+p.qty,0),esp.qty);
 assert.equal(b.totalIdr.min,b.lines.reduce((a,l)=>a+l.priceIdr.total.min,0));
 assert.ok(b.totalIdr.max>=b.totalIdr.min&&b.totalIdr.min>0);
 const cable=b.lines.find(l=>l.key.startsWith('cable-')&&l.unit==='m');if(cable)assert.ok(Number.isInteger(cable.qty));
 assert.ok(b.issues.every(i=>i.severity!=='error'),'a missing price never blocks');
});
test('site_climate: region, alias, lat/lon rounding, honest low confidence, design PSH',()=>{
 const r=siteClimate({regionId:'jatim'});
 out('site_climate',r);assert.equal(r.peakSunHours,3.5);assert.equal(r.confidence,'low');assert.equal(r.rainMmByMonth.length,12);
 assert.equal(r.rainMmByMonth.reduce((a,b)=>a+b,0),2000);
 const maluku=siteClimate({regionId:'maluku'}).rainMmByMonth;assert.ok(maluku[6]!>maluku[0]!,'Maluku is wet in Jun-Aug');
 assert.ok(siteClimate({regionId:'java'}).rainMmByMonth[0]!>siteClimate({regionId:'java'}).rainMmByMonth[7]!);
 assert.match(siteClimate({lat:-7.7012,lon:110.2049}).source,/java/);
 assert.match(siteClimate({lat:-7.7012,lon:110.2049}).source,/-7\.70,110\.20/);
 assert.throws(()=>siteClimate({regionId:'atlantis'}),(e:unknown)=>e instanceof ClimateError&&e.code==='unknown_region');
 assert.throws(()=>siteClimate({}),ClimateError);
});
test('crops data follows agri §1.5',()=>{
 assert.deepEqual(CROP_PROFILES.banana!.tensionKPa,[12,25]);assert.equal(CROP_PROFILES.mango!.pDepletion,0.5);
 assert.equal(cropProfile('flowers')!.key,'chrysanthemum');assert.equal(cropProfile('rice'),undefined);
});
test('runChecks: fixture is free of errors; failing designs are flagged and shapes validate',()=>{
 const base=runChecks(spec,lookup);
 for(const c of base)CheckSchema.parse(c);
 assert.equal(base.filter(c=>c.severity==='error').length,0,JSON.stringify(base.filter(c=>c.severity==='error')));
 const bad=structuredClone(spec);
 const n=bad.nodes[0]!;n.parts[2]!.kind='lora-ra02';
 assert.ok(runChecks(bad,lookup).some(c=>c.code==='net-05'&&c.severity==='error'),'433 MHz module is an error');
 const bad2=structuredClone(spec);bad2.links=bad2.links.filter(l=>l.from!=='node-melon');
 assert.ok(runChecks(bad2,lookup).some(c=>c.code==='link.missing'&&c.severity==='error'));
 const bad3=structuredClone(spec);bad3.code[0]!.pinsReferenced=[{symbol:'PIN_NOPE',pin:'GPIO1',lines:[1]}];
 assert.ok(runChecks(bad3,lookup).some(c=>c.code==='code.pin-unknown'));
 const bad4=structuredClone(spec);bad4.nodes[0]!.enclosure.ip='IP54';
 assert.ok(runChecks(bad4,lookup).some(c=>c.code==='enc-01'&&c.severity==='warning'),'grade M can only warn');
 const bad5=structuredClone(spec);bad5.fields[0]!.crop='melon';
 assert.ok(runChecks(bad5,lookup).some(c=>c.code==='crop-03'));
 // Kominfo items never above info
 for(const c of base.filter(x=>/^net-0[2346]$/.test(x.code)))assert.equal(c.severity,'info');
});
test('checklist: stable ids from physical actions; ids and items validate',()=>{
 const list=buildChecklist({...spec,bom:buildBom(spec,lookup)});
 assert.ok(list.length>10);
 for(const i of list){ChecklistItemSchema.parse(i);assert.match(i.id,CHECKLIST_ID_RE);}
 assert.equal(new Set(list.map(i=>i.id)).size,list.length);
 assert.deepEqual(list.map(i=>i.order),list.map((_,i)=>i));
 const phases=list.map(i=>i.phase);const order=['procure','flash','wire','power-up','install','calibrate','commission'];
 assert.deepEqual(phases,[...phases].sort((a,b)=>order.indexOf(a)-order.indexOf(b)));
 const w=spec.nodes[0]!.wires[0]!;
 assert.ok(list.some(i=>i.id===ckId('wire',spec.nodes[0]!.id,wireKey(w))));
 // W-number changes and quantity bumps do not change ids
 const s2=structuredClone(spec);s2.nodes[0]!.wires.forEach(x=>{x.id=x.id.replace('W','W9');});s2.nodes[0]!.parts.reverse();
 const b2=buildBom(s2,lookup);b2.lines[0]!.qty+=3;
 const ids1=new Set(list.map(i=>i.id)),ids2=new Set(buildChecklist({...s2,bom:b2}).map(i=>i.id));
 assert.deepEqual([...ids1].sort(),[...ids2].sort());
 // a changed pin changes the wire item id
 const s3=structuredClone(spec);s3.nodes[0]!.wires[0]!.to.pin='GPIO32';
 assert.notDeepEqual([...new Set(buildChecklist({...s3,bom:buildBom(s3,lookup)}).map(i=>i.id))].sort(),[...ids1].sort());
});
test('test plan: bench, link, field and acceptance cases validate with stable ids',()=>{
 const plan=buildTestPlan(spec);
 for(const t of plan)TestCaseSchema.parse(t);
 assert.equal(new Set(plan.map(t=>t.id)).size,plan.length);
 const phases=new Set(plan.map(t=>t.phase));for(const p of ['bench','link','field','acceptance'])assert.ok(phases.has(p as 'bench'),p);
 assert.ok(plan.some(t=>t.id==='test:link:link-node-melon-gateway'));
 assert.ok(plan.find(t=>t.phase==='link')!.measure);
 assert.deepEqual(buildTestPlan(spec).map(t=>t.id),plan.map(t=>t.id));
});
