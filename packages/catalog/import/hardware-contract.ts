/** packages/hardware-contract board manifests (ESP32 DevKit, via component-catalog) -> fragments: GPIO pins with capabilities, logic level. */
import {esp32Devkit} from '../../component-catalog/index.js';
import type {BoardManifest} from '../../hardware-contract/index.js';
import type {PinV,Fragment} from './common.js';
import {tag,pinName} from './common.js';

export function importHardwareContract(boards:readonly BoardManifest[]=[esp32Devkit]):Fragment[]{
 return boards.map(b=>{
  const src=b.sources[0]??'packages/hardware-contract';
  const pins=b.pins.map(p=>{
   const n=Number(p.name);
   const func:PinV['func']=[];
   if(p.capabilities.includes('input'))func.push('digital-in');
   if(p.capabilities.includes('output'))func.push('digital-out');
   if(p.capabilities.includes('analog'))func.push('adc');
   if(n===21)func.push('i2c-sda');
   if(n===22)func.push('i2c-scl');
   if(!func.length)func.push('nc');
   const note=p.reserved?'reserved (flash or serial)':p.strapping?'strapping pin':undefined;
   return tag({name:pinName(`GPIO${p.name}`),func:func.slice(0,6) as PinV['func'],...(note?{note}:{})},src,'high');
  });
  for(const [rail,v] of Object.entries(b.powerRails))pins.push(tag({name:pinName(rail),func:['power'] as PinV['func'],note:`${v} V rail`},src,'high'));
  pins.push(tag({name:'GND',func:['ground'] as PinV['func']},src,'high'));
  return{
   id:b.id,source:'hardware-contract' as const,
   name:tag(b.name.slice(0,80),src,'high'),kind:tag('board',src,'high'),
   logicLevelV:tag(b.logicVoltage,src,'high'),pins,
  };
 });
}
