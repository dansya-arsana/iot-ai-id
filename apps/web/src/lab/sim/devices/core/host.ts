import {ADC_CHANNEL,ANALOG_ONLY_PINS,SIM_CLOCK_HZ,UNO_PINS} from '../../../contract';
import type {AnalogOnlyPin,BoardPin,PartInput,PartProps,PartSpec,PartState,UnoPin} from '../../../contract';
import type {PartModel} from '../../peripherals';
import {drivePulses} from './pulses';
import type {DeviceCtx,DeviceDef,DeviceModel,DeviceState,Env,Frame,Level,PeerRef} from '../types';

const UNO=new Set<string>(UNO_PINS);
const uno=(p:BoardPin|undefined):UnoPin|null=>p&&UNO.has(p)?p as UnoPin:null;

/** What a device may ask of the circuit around it (implemented by sim/world.ts; tests may pass a stub). */
export interface WorldApi{
 peers(part:string,pin:string):PeerRef[];
 volts(part:string,pin:string):number|null;
 supply(part:string):number|null;
 setFrame(f:Frame):void;
 invalidate():void;
}
const RAIL_VOLTS:Partial<Record<string,number>>={'5V':5,'3V3':3.3,GND:0};

/** Adapt one DeviceDef + spec into the PartModel the runner drives. */
export function instantiate(def:DeviceDef,spec:PartSpec,props:PartProps,env:Env,all:()=>readonly PartModel[],world?:WorldApi):PartModel{
 for(const [k,v] of Object.entries(def.defaults??{}))if(props[k]===undefined)props[k]=v;
 const wired=new Set<UnoPin>();
 for(const n of def.pins){const p=uno(spec.net[n]);if(p)wired.add(p);}
 const ctx:DeviceCtx={
  id:spec.id,kind:spec.kind,spec,props,env,
  pin:n=>uno(spec.net[n]),
  analogPin:n=>{const b=spec.net[n];return uno(b)??(b&&(ANALOG_ONLY_PINS as readonly string[]).includes(b)?b as AnalogOnlyPin:null);},
  net:n=>spec.net[n],
  siblings:()=>all().filter(m=>m.spec.id!==spec.id),
  pinLevel:p=>env.pinLevel?env.pinLevel(p):0,
  hostDrives:p=>env.pinMode?.(p)==='output',
  line:(p,idleHigh=true)=>{env.watchLine?.(p);env.setPin(p,idleHigh);},
  drive:(p,pulses,o)=>drivePulses(env,p,pulses,o),
  schedule:(c,cb)=>env.schedule(c,cb),
  uartSend:b=>env.uartSend?.(b),
  peers:n=>world?.peers(spec.id,n)??[],
  volts:n=>world?world.volts(spec.id,n):(RAIL_VOLTS[spec.net[n]??'']??null),
  supply:()=>world?world.supply(spec.id):null,
 };
 const dev:DeviceModel=def.create(ctx);
 if(dev.i2c)env.attachI2c?.(dev.i2c);
 // SPI: resolve the CS part pin to a board pin; the bus asks the board for its level, the adapter reports CS edges and counts bytes per selection
 const spiDef=dev.spi;
 const csPin=spiDef?.cs?uno(spec.net[spiDef.cs]):null;
 const csActive:Level=spiDef?.activeLow===false?1:0;
 let spiIndex=0;
 if(spiDef){
  spiIndex=0;
  env.attachSpi?.({csPin,activeLow:spiDef.activeLow!==false,transfer:(mosi,info)=>spiDef.onTransfer(mosi,{...info,index:spiIndex++})});
 }
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
  update(f:Frame){world?.setFrame(f);dev.update?.(f);dev.tick?.(Math.round(f.dtSec*SIM_CLOCK_HZ),f.cycles);pushAdc();world?.invalidate();},
  setInput(i:PartInput){dev.setInput?.(i);pushAdc();},
 };
 if(dev.onPinChange||(spiDef&&csPin)){
  const h=dev.onPinChange?.bind(dev);
  m.onEdge=(pin:UnoPin,level:Level,cycle:number)=>{
   if(!wired.has(pin))return;
   if(spiDef&&csPin&&pin===csPin){spiIndex=0;spiDef.onSelect?.(level===csActive,cycle);}
   h?.(pin,level,cycle);
  };
 }
 if(dev.output)m.output=pin=>dev.output!(pin);
 if(dev.switches)m.switches=()=>dev.switches!();
 if(def.supplies)m.supplies=()=>def.supplies!(props);
 if(def.regulators)m.regulators=()=>def.regulators!(props);
 if(def.power)m.power=def.power;
 if(dev.adc)m.analog=()=>{const a=dev.adc!();return a?{pin:a.pin,adc:Math.round(a.volts/5*1023)}:null;};
 return m;
}
