import {UNO_PINS} from '../contract';
import type {Circuit,PartInput,PartProps,PartSpec,PartState,PinSample,UnoPin} from '../contract';
import {createDevice} from './devices';
import type {Env as DeviceEnv,Frame as DeviceFrame} from './devices';

/** Hooks a part model uses to act on the board (see devices/types for the optional shared-line, I2C and UART members). */
export type Env=DeviceEnv;
export type Frame=DeviceFrame;
/** What the runner drives. Every PartModel is the adapter of one registered device (sim/devices/<kind>.ts). */
export interface PartModel{
 readonly spec:PartSpec;
 props:PartProps;
 state():PartState;
 update(f:Frame):void;
 onEdge?(pin:UnoPin,level:0|1,cycle:number):void;
 setInput(i:PartInput):void;
 analog?():{pin:UnoPin;adc:number}|null;
}

export {LED_VF} from './devices/led';

export function createModels(circuit:Circuit,env:Env):Map<string,PartModel>{
 const models=new Map<string,PartModel>();
 const all=()=>[...models.values()];
 for(const spec of circuit.parts){
  const props:PartProps={...spec.props};
  models.set(spec.id,createDevice(spec,props,env,all));
 }
 for(const m of models.values())m.update({samples:EMPTY(),dtSec:0,cycles:env.now()});
 return models;
}

/** A frame sample set with every pin idle; used for initial settling. */
export function EMPTY():Record<UnoPin,PinSample>{
 const o={} as Record<UnoPin,PinSample>;
 for(const p of UNO_PINS)o[p]={mode:'input',level:0,duty:0,freqHz:0,highUs:0,analog:null};
 return o;
}
