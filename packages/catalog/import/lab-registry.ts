/**
 * Lab device registry (apps/web/src/lab/sim/devices) -> fragments: pins, supply window and current from `power`, protocol, copy.
 * Devices are pure (no DOM, no three.js). Scene parts are only listed by file name to flag a 3D model.
 */
import {readdirSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import {deviceRegistry} from '../../../apps/web/src/lab/sim/devices/index.js';
import type {DeviceDef} from '../../../apps/web/src/lab/sim/devices/index.js';
import type {PinV,Fragment} from './common.js';
import {tag,pinName} from './common.js';
import type {PartRecord} from '../schema.js';

const SRC='apps/web/src/lab/sim/devices';
/** Lab kind -> catalog id where the older packages use a different name for the same part. */
export const LAB_ID_ALIAS:Record<string,string>={'oled-ssd1306':'ssd1306','ds3231-rtc':'ds3231','esp32-devkit':'esp32-devkit'};
const PROTO:Record<string,PartRecord['protocols']['supported']['v']>={gpio:['digital'],adc:['analog'],pwm:['pwm'],pulse:['digital'],i2c:['i2c'],onewire:['onewire'],uart:['uart'],switch:['digital'],spi:['spi'],twowire:['digital'],ws2812:['digital']};

/** Pin function from a pin name plus the device protocol. Heuristic, so the confidence is medium. */
export function pinFunc(name:string,protocol:string):PinV['func']{
 const n=name.toUpperCase();
 if(/^(VCC|VIN|VDD|V\+|5V|3V3|3\.3V|\+|V)$/.test(n))return['power'];
 if(n==='GND'||n==='GROUND'||n==='-')return['ground'];
 if(n==='SDA')return['i2c-sda'];
 if(n==='SCL')return['i2c-scl'];
 if(/^(SCK|CLK)$/.test(n)&&protocol==='spi')return['spi-sck'];
 if(n==='MOSI'||n==='DIN')return['spi-mosi'];
 if(n==='MISO')return['spi-miso'];
 if(/^(CS|SS|CSN)$/.test(n))return['spi-cs'];
 if(n==='TX'||n==='TXD')return['uart-tx'];
 if(n==='RX'||n==='RXD')return['uart-rx'];
 if(/^(AO|AOUT|A0|SIG|OUT)$/.test(n)&&protocol==='adc')return['adc'];
 if(/^(PWM)$/.test(n))return['pwm'];
 if(/^(RST|RESET)$/.test(n))return['reset'];
 if(/^(IRQ|INT)$/.test(n))return['irq'];
 if(n==='NC')return['nc'];
 return['digital-in','digital-out'];
}

export function sceneFileKinds():Set<string>{
 try{
  const dir=fileURLToPath(new URL('../../../apps/web/src/lab/scene/parts/',import.meta.url));
  return new Set(readdirSync(dir).filter(f=>f.endsWith('.ts')&&!['types.ts','index.ts','demo.ts'].includes(f)).map(f=>f.slice(0,-3)));
 }catch{return new Set();}
}

export function importLabRegistry(kinds:readonly string[]=deviceRegistry.kinds().sort(),get:(k:string)=>DeviceDef|undefined=deviceRegistry.get):Fragment[]{
 const scene=sceneFileKinds();
 const out:Fragment[]=[];
 for(const k of kinds){
  const d=get(k);if(!d)continue;
  const id=LAB_ID_ALIAS[k]??k;
  const f:Fragment={id,source:'lab-registry'};
  if(d.copy)f.name=tag(d.copy.name.en.slice(0,80),SRC,'medium');
  if(d.copy)f.summary=tag({en:d.copy.desc.en.slice(0,300),id:d.copy.desc.id.slice(0,300)},SRC,'medium');
  f.pins=d.pins.map(p=>tag({name:pinName(p),func:pinFunc(p,d.protocol)},SRC,'medium'));
  f.protocols=tag(PROTO[d.protocol]??['digital'],SRC,'medium');
  if(d.power){
   f.supplyV=tag({min:d.power.min,max:d.power.max},SRC,'medium');
   if(typeof d.power.ma==='number')f.currentMa=tag({typ:d.power.ma,peak:d.power.ma},SRC,'medium');
  }
  if(scene.has(k))f.model3d={kind:tag('procedural' as const,'apps/web/src/lab/scene/parts','medium'),status:tag('draft' as const,'apps/web/src/lab/scene/parts','medium')};
  out.push(f);
 }
 return out;
}
