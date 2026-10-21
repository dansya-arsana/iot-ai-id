import {ADC_CHANNEL,SIM_CLOCK_HZ,UNO_PINS} from '../../../contract';
import type {BoardPin,PartInput,PartProps,PartSpec,PartState,UnoPin} from '../../../contract';
import type {PartModel} from '../../peripherals';
import {drivePulses} from './pulses';
import type {DeviceCtx,DeviceDef,DeviceModel,DeviceState,Env,Frame,Level} from '../types';

const UNO=new Set<string>(UNO_PINS);
const uno=(p:BoardPin|undefined):UnoPin|null=>p&&UNO.has(p)?p as UnoPin:null;

/** Adapt one DeviceDef + spec into the PartModel the runner drives. */
export function instantiate(def:DeviceDef,spec:PartSpec,props:PartProps,env:Env,all:()=>readonly PartModel[]):PartModel{
 for(const [k,v] of Object.entries(def.defaults??{}))if(props[k]===undefined)props[k]=v;
 const wired=new Set<UnoPin>();
 for(const n of def.pins){const p=uno(spec.net[n]);if(p)wired.add(p);}
 const ctx:DeviceCtx={
  id:spec.id,kind:spec.kind,spec,props,env,
  pin:n=>uno(spec.net[n]),
  net:n=>spec.net[n],
  siblings:()=>all().filter(m=>m.spec.id!==spec.id),
  pinLevel:p=>env.pinLevel?env.pinLevel(p):0,
  hostDrives:p=>env.pinMode?.(p)==='output',
  line:(p,idleHigh=true)=>{env.watchLine?.(p);env.setPin(p,idleHigh);},
  drive:(p,pulses,o)=>drivePulses(env,p,pulses,o),
  schedule:(c,cb)=>env.schedule(c,cb),
  uartSend:b=>env.uartSend?.(b),
 };
 const dev:DeviceModel=def.create(ctx);
 if(dev.i2c)env.attachI2c?.(dev.i2c);
 const tap=dev.uart;
 if(tap)env.tapUart?.((b,cy)=>tap.onTx(b,cy));
 const pushAdc=():void=>{
  const a=dev.adc?.();if(!a)return;
  const ch=ADC_CHANNEL[a.pin];if(ch!==undefined)env.setAdc(ch,a.volts);
 };
 pushAdc();
 const m:PartModel={
  spec,props,
  state:()=>{
   const s=dev.state();
   return def.legacyState?s as PartState:{kind:'ext',type:spec.kind,v:s as DeviceState} as PartState;
  },
  update(f:Frame){dev.update?.(f);dev.tick?.(Math.round(f.dtSec*SIM_CLOCK_HZ),f.cycles);pushAdc();},
  setInput(i:PartInput){dev.setInput?.(i);pushAdc();},
 };
 if(dev.onPinChange){
  const h=dev.onPinChange.bind(dev);
  m.onEdge=(pin:UnoPin,level:Level,cycle:number)=>{if(wired.has(pin))h(pin,level,cycle);};
 }
 if(dev.adc)m.analog=()=>{const a=dev.adc!();return a?{pin:a.pin,adc:Math.round(a.volts/5*1023)}:null;};
 return m;
}
