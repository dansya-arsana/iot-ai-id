/** Shared helpers for the pure Pro tool implementations: issues, catalog lookup, board profiles. No I/O. */
import type {PartRecord} from '../../catalog/schema.js';
import {effectiveSeverity,rule,type Rule} from '../data/rules.js';

export type Severity='error'|'warning'|'info';
export type ToolIssue={code:string;severity:Severity;en:string;id:string;ref?:string;grade?:string};
export type PartLookup=(id:string)=>PartRecord|undefined;

export const mkIssue=(code:string,severity:Severity,en:string,id:string,ref?:string,grade?:string):ToolIssue=>({code,severity,en:en.slice(0,300),id:id.slice(0,300),...(ref?{ref:ref.slice(0,60)}:{}),...(grade?{grade}:{})});
/** Build an issue from a rule row (severity clamped by grade). */
export const ruleIssue=(ruleId:string,ref?:string,extra?:{en?:string;id?:string}):ToolIssue=>{
 const r:Rule=rule(ruleId);
 return mkIssue(ruleId.toLowerCase(),effectiveSeverity(r),extra?.en??r.en,extra?.id??r.idn,ref,r.grade);
};
/** Clamp an ad-hoc issue: grade C/M never errors. */
export const graded=(severity:Severity,grade:string):Severity=>severity==='error'&&(grade==='C'||grade==='M')?'warning':severity;
export const hasError=(issues:ToolIssue[]):boolean=>issues.some(i=>i.severity==='error');

// ---- part accessors ----
export const supplyOf=(p:PartRecord)=>p.electrical.supplyV.v;
export const logicOf=(p:PartRecord)=>p.electrical.logicLevelV?.v;
export const currentOf=(p:PartRecord)=>p.electrical.currentMa.v;
export const kindOf=(p:PartRecord)=>p.identity.kind.v;
export const pinDefs=(p:PartRecord)=>p.pins.map(x=>x.v);
export const lowestConfidence=(p:PartRecord):'high'|'medium'|'low'=>{
 const order=['low','medium','high'] as const;let lo=2;
 const walk=(x:unknown)=>{if(!x||typeof x!=='object')return;const o=x as Record<string,unknown>;
  if('v' in o&&'p' in o&&o.p&&typeof o.p==='object'){lo=Math.min(lo,order.indexOf((o.p as {confidence:'high'|'medium'|'low'}).confidence));return;}
  for(const v of Object.values(o))walk(v);};
 walk(p);return order[lo]!;
};
/** Part ids in a node are `kind-n`; strip the trailing -n for the kind. */
export const kindFromRef=(ref:string):string=>ref.replace(/-\d+$/,'');
export const refIndex=(ref:string):number=>{const m=/-(\d+)$/.exec(ref);return m?Number(m[1]):1;};

// ---- board profiles ----
export type BoardPin={name:string;gpio:number|null;out:boolean;adc?:1|2;strap?:boolean;flash?:boolean;reserved?:string};
export type BoardProfile={
 id:string;family:'esp32'|'esp32s3'|'rp2040'|'rpi'|'avr';label:string;logicV:number;railMa:number;wifi:boolean;
 buses:readonly string[];rails:Record<string,number>;gnd:readonly string[];pins:Record<string,BoardPin>;
 alloc:{i2c:{sda:string;scl:string};onewire:string;adc:string[];out:string[];inp:string[];spi:{sck:string;miso:string;mosi:string;cs:string[]};rst:string[];irq:string[];uart:{tx:string;rx:string}};
};
const mkPins=(spec:Record<string,Partial<BoardPin>>,prefix:string):Record<string,BoardPin>=>Object.fromEntries(Object.entries(spec).map(([n,p])=>{
 const name=`${prefix}${n}`;return [name,{name,gpio:Number(n),out:true,...p}];
}));
const nums=(a:number,b:number)=>Array.from({length:b-a+1},(_,i)=>a+i);
const esp32Spec:Record<string,Partial<BoardPin>>={};
for(const n of [0,1,2,3,4,5,12,13,14,15,16,17,18,19,21,22,23,25,26,27,32,33,34,35,36,39])esp32Spec[n]={};
for(const n of [0,2,12,15])esp32Spec[n]={strap:true};
for(const n of [1,3])esp32Spec[n]={reserved:'UART0 (USB serial)'};
for(const n of nums(6,11))esp32Spec[n]={flash:true,out:false};
for(const n of [34,35,36,39])esp32Spec[n]={out:false};
for(const n of [32,33,34,35,36,39])esp32Spec[n]={...esp32Spec[n],adc:1};
for(const n of [0,2,4,12,13,14,15,25,26,27])esp32Spec[n]={...esp32Spec[n],adc:2};
const gp=(n:number)=>`GPIO${n}`;
const ESP32:BoardProfile={id:'esp32-devkitc',family:'esp32',label:'ESP32 DevKitC',logicV:3.3,railMa:500,wifi:true,buses:['i2c','spi','uart','analog','wifi','ble'],
 rails:{'3V3':3.3,'5V':5,'VIN':5},gnd:['GND'],pins:mkPins(esp32Spec,'GPIO'),
 alloc:{i2c:{sda:gp(21),scl:gp(22)},onewire:gp(4),adc:[34,35,32,33,36,39].map(gp),out:[25,27,13,32,33].map(gp),inp:[39,36,35,34].map(gp),spi:{sck:gp(18),miso:gp(19),mosi:gp(23),cs:[5,32,33].map(gp)},rst:[gp(14)],irq:[gp(26)],uart:{tx:gp(17),rx:gp(16)}}};
const s3Spec:Record<string,Partial<BoardPin>>={};
for(const n of [...nums(1,18),21,...nums(38,42)])s3Spec[n]={};
for(const n of [0,3,45,46,19,20])s3Spec[n]={strap:true};
for(const n of nums(26,32))s3Spec[n]={flash:true,out:false};
for(const n of nums(1,10))s3Spec[n]={...s3Spec[n],adc:1};
for(const n of nums(11,18))s3Spec[n]={...s3Spec[n],adc:2};
const ESP32S3:BoardProfile={...ESP32,id:'esp32-s3-devkitc',family:'esp32s3',label:'ESP32-S3 DevKitC',pins:mkPins(s3Spec,'GPIO'),
 alloc:{i2c:{sda:gp(8),scl:gp(9)},onewire:gp(4),adc:[1,2,5,6,7].map(gp),out:[16,21,38,39,40,41].map(gp),inp:[42,41].map(gp),spi:{sck:gp(12),miso:gp(13),mosi:gp(11),cs:[10,38,39].map(gp)},rst:[gp(14)],irq:[gp(15)],uart:{tx:gp(17),rx:gp(18)}}};
const picoSpec:Record<string,Partial<BoardPin>>={};
for(const n of [...nums(0,22),26,27,28])picoSpec[n]={};
for(const n of [26,27,28])picoSpec[n]={adc:1};
const PICO:BoardProfile={id:'pico-w',family:'rp2040',label:'Raspberry Pi Pico W',logicV:3.3,railMa:300,wifi:true,buses:['i2c','spi','uart','analog','wifi'],rails:{'3V3':3.3,'VSYS':5,'VBUS':5},gnd:['GND'],pins:mkPins(picoSpec,'GP'),
 alloc:{i2c:{sda:'GP4',scl:'GP5'},onewire:'GP2',adc:['GP26','GP27','GP28'],out:[6,7,8,9,10,11,12,13,14,15,22].map(n=>`GP${n}`),inp:['GP6','GP7','GP8'],spi:{sck:'GP18',miso:'GP16',mosi:'GP19',cs:['GP17','GP13','GP14']},rst:['GP20'],irq:['GP21'],uart:{tx:'GP0',rx:'GP1'}}};
const rpiSpec:Record<string,Partial<BoardPin>>={};
for(const n of nums(2,27))rpiSpec[n]={};
const rpi=(id:string,label:string):BoardProfile=>({id,family:'rpi',label,logicV:3.3,railMa:500,wifi:true,buses:['i2c','spi','uart','wifi','ble'],rails:{'3V3':3.3,'5V':5},gnd:['GND'],pins:mkPins(rpiSpec,'BCM'),
 alloc:{i2c:{sda:'BCM2',scl:'BCM3'},onewire:'BCM4',adc:[],out:[5,6,12,13,16,19,20,26,17,27,22,23].map(n=>`BCM${n}`),inp:[5,6,12,13,16].map(n=>`BCM${n}`),spi:{sck:'BCM11',miso:'BCM9',mosi:'BCM10',cs:['BCM8','BCM7','BCM18']},rst:['BCM25'],irq:['BCM24'],uart:{tx:'BCM14',rx:'BCM15'}}});
const avrPins=(analog:number):Record<string,BoardPin>=>{
 const o:Record<string,BoardPin>={};
 for(const n of nums(0,13))o[`D${n}`]={name:`D${n}`,gpio:n,out:true,...(n<2?{reserved:'USB serial'}:{})};
 for(let i=0;i<analog;i++)o[`A${i}`]={name:`A${i}`,gpio:14+i,out:i<6,adc:1};
 return o;
};
const avr=(id:string,label:string,analog:number):BoardProfile=>({id,family:'avr',label,logicV:5,railMa:400,wifi:false,buses:['i2c','spi','uart','analog'],rails:{'3V3':3.3,'5V':5,'VIN':7},gnd:['GND'],pins:avrPins(analog),
 alloc:{i2c:{sda:'A4',scl:'A5'},onewire:'D4',adc:['A0','A1','A2','A3',...(analog>6?['A6','A7']:[])],out:['D3','D5','D6','D7','D8'],inp:['D3','D5','D6'],spi:{sck:'D13',miso:'D12',mosi:'D11',cs:['D10','D9']},rst:['D9'],irq:['D2'],uart:{tx:'D7',rx:'D8'}}});
export const BOARD_PROFILES:Record<string,BoardProfile>={
 'esp32-devkitc':ESP32,'esp32-s3-devkitc':ESP32S3,'pico-w':PICO,'rpi-4b':rpi('rpi-4b','Raspberry Pi 4B'),'rpi-5':rpi('rpi-5','Raspberry Pi 5'),
 'uno':avr('uno','Arduino Uno',6),'nano':avr('nano','Arduino Nano',8),
};
export const boardProfile=(board:string):BoardProfile=>{const p=BOARD_PROFILES[board];if(!p)throw new Error(`unknown board ${board}`);return p;};
/** Case-insensitive board pin lookup. Returns undefined for rails and ground. */
export const findBoardPin=(b:BoardProfile,name:string):BoardPin|undefined=>b.pins[name.trim().toUpperCase().replace(/^IO(\d+)$/,'GPIO$1')]??b.pins[name.trim()];
export const railOf=(b:BoardProfile,name:string):number|undefined=>b.rails[name.trim().toUpperCase()];
export const isGround=(b:BoardProfile,name:string):boolean=>b.gnd.includes(name.trim().toUpperCase());
/** Board family key used by the catalog drivers. */
export const catalogFamily=(b:BoardProfile):'esp32'|'esp32s3'|'avr'|'rp2040'|'rpi'=>b.family;
