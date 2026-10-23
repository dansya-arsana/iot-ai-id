/** packages/component-catalog manifests -> fragments: supply, logic level, current, pins, I2C addresses, libraries, quirks. */
import {components} from '../../component-catalog/index.js';
import type {ComponentManifest} from '../../hardware-contract/index.js';
import type {PinV,Fragment} from './common.js';
import {tag,pinName} from './common.js';
import type {PartRecord} from '../schema.js';

const ROLE_FUNC:Record<string,PinV['func']>={power:['power'],ground:['ground'],sda:['i2c-sda'],scl:['i2c-scl'],input:['digital-in'],output:['digital-out'],analog:['adc'],spi:['spi-sck','spi-mosi','spi-miso','spi-cs'],uart:['uart-tx','uart-rx']};
const PROTO:Record<string,PartRecord['protocols']['supported']['v']>={i2c:['i2c'],digital:['digital'],analog:['analog'],spi:['spi'],uart:['uart']};
const FAMILY_LIBS='esp32' as const;

export function importComponentCatalog(list:readonly ComponentManifest[]=components):Fragment[]{
 return list.map(c=>{
  const src=c.sources[0]??'packages/component-catalog';
  const conf=c.support==='golden'?'high' as const:'medium' as const;
  const f:Fragment={
   id:c.id,source:'component-catalog',
   name:tag(c.name.slice(0,80),src,conf),
   supplyV:tag({min:c.voltage[0],max:c.voltage[1]},src,conf),
   logicLevelV:tag(c.logicVoltage,src,conf),
   currentMa:tag({typ:c.currentMa,peak:c.currentMa},src,conf),
   pins:c.pins.map(p=>tag({name:pinName(p.name),func:ROLE_FUNC[p.role]??['digital-in','digital-out']},src,conf)),
   protocols:tag(PROTO[c.protocol]??['digital'],src,conf),
   drivers:c.libraries.map(lib=>tag({boardFamily:FAMILY_LIBS,lib:lib.slice(0,80),snippet:'',verify:c.support==='golden'?'compiled' as const:'untested' as const},'packages/component-catalog',conf)),
   pitfalls:c.quirks.map(q=>tag({en:q.slice(0,300),id:q.slice(0,300)},src,conf)),
  };
  if(c.addresses.length)f.i2cAddresses=tag([...c.addresses],src,conf);
  return f;
 });
}
