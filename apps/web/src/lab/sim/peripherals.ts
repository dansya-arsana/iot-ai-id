import {UNO_PINS} from '../contract';
import type {AnalogOnlyPin,Circuit,PartInput,PartProps,PartSpec,PartState,PinSample,UnoPin} from '../contract';
import {createDevice} from './devices';
import type {Env as DeviceEnv,Frame as DeviceFrame,PinDrive,PowerSpec,RegulatorDecl,SupplyDecl,SwitchDecl} from './devices';
import {World} from './world';

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
 analog?():{pin:UnoPin|AnalogOnlyPin;adc:number}|null;
 /** Net solver hooks (see devices/types DeviceModel): what the part drives, which contacts are closed, which supplies and regulators it holds. */
 output?(pin:string):PinDrive|null;
 switches?():readonly SwitchDecl[];
 supplies?():readonly SupplyDecl[];
 regulators?():readonly RegulatorDecl[];
 power?:PowerSpec;
}

export {LED_VF} from './devices/led';

/** Models plus the World (part-to-part nets, voltages, power notes) of a circuit. */
export function createWorldModels(circuit:Circuit,env:Env):{models:Map<string,PartModel>;world:World}{
 const models=new Map<string,PartModel>();
 const all=()=>[...models.values()];
 const world=new World(circuit,all);
 for(const spec of circuit.parts){
  const props:PartProps={...spec.props};
  models.set(spec.id,createDevice(spec,props,env,all,world));
 }
 for(const m of models.values())m.update({samples:EMPTY(),dtSec:0,cycles:env.now()});
 return {models,world};
}
export function createModels(circuit:Circuit,env:Env):Map<string,PartModel>{return createWorldModels(circuit,env).models;}

/** A frame sample set with every pin idle; used for initial settling. */
export function EMPTY():Record<UnoPin,PinSample>{
 const o={} as Record<UnoPin,PinSample>;
 for(const p of UNO_PINS)o[p]={mode:'input',level:0,duty:0,freqHz:0,highUs:0,analog:null};
 return o;
}
