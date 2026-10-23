/** Heavy synthetic spec for overflow checks: a node with 14 parts, 24 pins/wires, long code and many BOM lines. Dev only. */
import type {SystemSpec} from '../../../../../../packages/pro-contract/system-spec';

export function stressSpec(base:SystemSpec):SystemSpec{
 const s=JSON.parse(JSON.stringify(base)) as SystemSpec;
 const n=s.nodes[0]!;
 const kinds=['soil-moisture-capacitive','ds18b20','bme280','dht22','bh1750','rain-gauge','relay-1ch','solenoid-valve-12v','buck-12-5','battery-18650-pack'];
 const roles=['sensor','sensor','sensor','sensor','sensor','sensor','actuator','actuator','power','power'] as const;
 n.parts=kinds.map((k,i)=>({id:`${k}-1`,kind:k,role:roles[i]!,qty:1+(i%2),purpose:{en:`Purpose of ${k}`,id:k},mount:i<6?'field':'enclosure',cableM:3}));
 n.pins=[];n.wires=[];
 for(let i=0;i<24;i++){const p=n.parts[i%n.parts.length]!;const g=[4,5,12,13,14,15,16,17,18,19,21,22,23,25,26,27,32,33,34,35,36,39,0,2][i]!;
  n.pins.push({boardPin:`GPIO${g}`,gpio:g,func:'digital-in',part:p.id,partPin:`P${i}`,symbol:`PIN_X${i}`});
  n.wires.push({id:`W${i+1}`,from:{part:p.id,pin:`P${i}`},to:{part:'board',pin:`GPIO${g}`},func:'signal',color:(['red','black','yellow','blue','green','orange','purple','white','brown','grey'] as const)[i%10]!,label:`W${i+1}`,lengthM:1.5,awg:22,cable:'3-core-shielded',connectors:{from:'screw-terminal',to:'header'},viaGland:i%3===0});}
 const code=s.code[0]!;code.content=Array.from({length:230},(_,i)=>`// line ${i+1} `+'x'.repeat(i%7===0?130:20)).join('\n');
 const line=s.bom.lines[0]!;
 s.bom.lines=Array.from({length:60},(_,i)=>({...line,key:`line-${i}`,kind:`line-${i}`,name:{en:`Part number ${i+1}`,id:'x'}}));
 s.tests=Array.from({length:20},(_,i)=>({id:`test:bench:${i}`,phase:'bench' as const,title:{en:`Test ${i+1}`,id:'x'},steps:[{en:'Do one thing',id:'x'},{en:'Do another',id:'x'}],expect:{en:'Passes',id:'x'}}));
 return s;
}
