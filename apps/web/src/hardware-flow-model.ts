import {validateContract,type ValidationResult} from '../../../packages/validator/index';
import type {HardwareContract} from '../../../packages/hardware-contract/index';
export type Wiring={componentId:string;pin:string;boardPin:string};
export type Layout={positions:Record<string,{x:number;y:number}>;viewport?:{x:number;y:number;zoom:number}};
export function canonicalBoardPin(pin:string){return ({RX2:'16',TX2:'17',RX0:'3',TX0:'1',VP:'36',VN:'39',VIN:'5V','GND.1':'GND','GND.2':'GND'} as Record<string,string>)[pin]??pin.replace(/^D(?=\d)/,'');}
export function wireId(w:Wiring){return `wire:${w.componentId}:${w.pin}`;}
export function wiringSignature(wires:Wiring[]){return JSON.stringify(wires.map(({componentId,pin,boardPin})=>({componentId,pin,boardPin})).sort((a,b)=>wireId(a).localeCompare(wireId(b))||a.boardPin.localeCompare(b.boardPin)));}
export function normalizeConnection(connection:{source:string|null;target:string|null;sourceHandle:string|null;targetHandle:string|null},boardId:string):Wiring|null{
 const {source,target,sourceHandle,targetHandle}=connection;
 if(!source||!target||!sourceHandle||!targetHandle||source===target)return null;
 if(source===boardId&&target!==boardId&&!target.includes('::'))return{componentId:target,pin:targetHandle,boardPin:sourceHandle};
 if(target===boardId&&source!==boardId&&!source.includes('::'))return{componentId:source,pin:sourceHandle,boardPin:targetHandle};
 return null;
}
export function replaceWire(wires:Wiring[],wire:Wiring){return [...wires.filter(w=>wireId(w)!==wireId(wire)),wire];}
export function graphParts(contract:HardwareContract|undefined,componentIds:string[]|undefined,catalog:any[]){
 const ids=componentIds??contract?.components.map(c=>c.manifest.id)??[];
 return ids.map(id=>contract?.components.find(c=>c.manifest.id===id)?.manifest??catalog.find(c=>c.id===id)).filter(Boolean);
}
export function defaultPosition(id:string,index:number,boardId:string){return id===boardId?{x:150,y:145}:{x:510+Math.floor(index/2)*300,y:100+(index%2)*280};}
export function readLayout(projectId:string):Layout{try{const parsed=JSON.parse(localStorage.getItem('iot-flow-layout:'+projectId)??'{}');return {positions:parsed.positions??{},viewport:parsed.viewport};}catch{return{positions:{}};}}
export function previewWiring(contract:HardwareContract,wires:Wiring[]):ValidationResult{
 const unknown:ValidationResult['errors']=[];
 const connections=wires.map(w=>{
  const component=contract.components.find(c=>c.instanceId===w.componentId);
  const pin=component?.manifest.pins.find(p=>p.name===w.pin);
  if(!component||!pin)unknown.push({code:component?'unknown_pin':'unknown_component',message:`Endpoint tidak dikenal: ${w.componentId} / ${w.pin}`,componentId:w.componentId,pin:w.pin});
  return {...w,role:pin?.role??'unknown',...(pin&&!['power','ground'].includes(pin.role)?{protocol:component!.manifest.protocol}:{})};
 });
 const result=validateContract({...contract,connections},{execution:true});
 return {...result,valid:result.valid&&!unknown.length,errors:[...unknown,...result.errors]};
}
export function wiringIssues(contract:HardwareContract,wires:Wiring[]){return previewWiring(contract,wires).errors.map(e=>e.message);}
export function boardPinLabel(pin:string){return /^\d+$/.test(pin)?`GPIO${pin}`:pin;}
