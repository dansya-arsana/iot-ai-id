import {recipeContractErrors} from '../recipe-registry/index.js';
import {esp32Devkit,getComponent} from '../../packages/component-catalog/index.js';
import { HardwareContractSchema,type HardwareContract } from '../../packages/hardware-contract/index.js';
export interface ValidationIssue {code:string;message:string;componentId?:string;pin?:string}
export interface ValidationResult {valid:boolean;errors:ValidationIssue[];warnings:ValidationIssue[]}
export function validateContract(input:unknown,options:{execution?:boolean}={}):ValidationResult{
 const parsed=HardwareContractSchema.safeParse(input); if(!parsed.success)return{valid:false,errors:[{code:'schema',message:parsed.error.message}],warnings:[]};
 const c:HardwareContract=parsed.data,errors:ValidationIssue[]=[],warnings:ValidationIssue[]=[];
 const fail=(code:string,message:string,componentId?:string,pin?:string)=>errors.push({code,message,componentId,pin});
 // Generic drafts retain electrical validation; golden and explicit recipes also enforce trusted metadata.
 const goldenComponents=c.components.length===2&&['bme280','ssd1306'].every(id=>c.components.some(component=>component.manifest.id===id));
 if(options.execution||c.recipe||goldenComponents)for(const message of recipeContractErrors(c))fail('recipe',message);
 if(JSON.stringify(c.board)!==JSON.stringify(esp32Devkit))fail('manifest_integrity','Board must match the authoritative reviewed manifest.');
 const ids=c.components.map(x=>x.instanceId); if(new Set(ids).size!==ids.length)fail('duplicate_component','Component instance identifiers must be unique.');
 if(c.components.reduce((a,x)=>a+x.manifest.currentMa,0)>c.board.maxPeripheralCurrentMa)fail('voltage_current_power','Peripheral current exceeds documented conservative power budget.');
 for(const x of c.components){
  const authoritative=getComponent(x.manifest.id);if(!authoritative||JSON.stringify(authoritative)!==JSON.stringify(x.manifest))fail('manifest_integrity','Component must match the authoritative reviewed manifest.',x.instanceId);
  const m=x.manifest, wires=c.connections.filter(w=>w.componentId===x.instanceId);
  if(m.logicVoltage>c.board.logicVoltage)fail('voltage_current_power','Peripheral signal voltage exceeds board logic voltage.',x.instanceId);
  for(const p of m.pins.filter(p=>p.required))if(wires.filter(w=>w.pin===p.name).length!==1)fail('required_pin',`Exactly one connection required for ${p.name}.`,x.instanceId,p.name);
  for(const lib of m.libraries)if(!c.firmware.libraries.includes(lib))fail('library',`Required library absent: ${lib}`,x.instanceId);
  if(m.protocol==='i2c'&&(!m.addresses.includes(x.address??-1)||!c.expected.devices.some(d=>d.componentId===x.instanceId&&d.address===x.address)))fail('address','Address not supported or expected address mismatches.',x.instanceId);
  for(const w of wires){const p=m.pins.find(p=>p.name===w.pin);if(!p){fail('unknown_pin','Unknown component pin.',x.instanceId,w.pin);continue;}if(w.role!==p.role)fail('role','Connection role differs from manifest.',x.instanceId,w.pin);
   if(p.role==='power'){const v=c.board.powerRails[w.boardPin];if(v===undefined||v<m.voltage[0]||v>m.voltage[1])fail('voltage_current_power','Unsupported supply voltage.',x.instanceId,w.pin);continue;}
   if(p.role==='ground'){if(w.boardPin!=='GND')fail('ground','Component requires common ground.',x.instanceId,w.pin);continue;}
   const bp=c.board.pins.find(p=>p.name===w.boardPin);if(!bp){fail('pin_capability','Unknown board GPIO.',x.instanceId,w.pin);continue;}
   if(bp.reserved)fail('reserved_pin','GPIO is reserved for flash or programming serial.',x.instanceId,w.pin);
   if(bp.strapping)fail('strapping_pin','Boot strapping pin requires an explicitly reviewed circuit; unsupported in v1.',x.instanceId,w.pin);
   const cap=p.role==='analog'?'analog':p.role==='output'?'input':p.role==='sda'||p.role==='scl'?'i2c':p.role==='spi'?'spi':p.role==='uart'?'uart':'output';if(!bp.capabilities.includes(cap))fail('pin_capability',`GPIO lacks ${cap} capability.`,x.instanceId,w.pin);
   if(w.protocol!==m.protocol)fail('protocol','Signal protocol mismatches manifest.',x.instanceId,w.pin);
  }
 }
 for(const w of c.connections)if(!ids.includes(w.componentId))fail('unknown_component','Connection targets unknown component.',w.componentId);
 const signals=c.connections.filter(w=>!['power','ground'].includes(w.role));for(const pin of new Set(signals.map(w=>w.boardPin))){const group=signals.filter(w=>w.boardPin===pin);if(group.length>1&&!(group.every(w=>w.protocol==='i2c')&&new Set(group.map(w=>w.role)).size===1))fail('pin_conflict',`Incompatible signals share GPIO ${pin}.`);}
 const buses=c.components.filter(x=>x.manifest.protocol==='i2c').map(x=>({x,sda:c.connections.find(w=>w.componentId===x.instanceId&&w.role==='sda')?.boardPin,scl:c.connections.find(w=>w.componentId===x.instanceId&&w.role==='scl')?.boardPin}));
 for(let i=0;i<buses.length;i++)for(let j=i+1;j<buses.length;j++){const a=buses[i],b=buses[j];if(a.sda===b.sda&&a.scl===b.scl&&a.x.address===b.x.address)fail('address_conflict','Devices on shared I2C bus have the same address.');if((a.sda===b.sda)!==(a.scl===b.scl))fail('bus_conflict','Shared I2C requires matching SDA and SCL.');}
 return{valid:errors.length===0,errors,warnings};
}
