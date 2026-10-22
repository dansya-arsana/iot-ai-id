/**
 * Device registry with auto-discovery. Drop `sim/devices/<kind>.ts` exporting `device=defineDevice({...})` and it is registered:
 * no index to edit. Registering also publishes the kind's pins, footprint and copy into the shared tables the validator,
 * layout and HUD read (PART_PINS, PIN_COLS, BODY_X, PARTS_COPY), so a kind needs no core edit anywhere.
 */
import {PART_PINS} from '../../contract';
import type {PartProps,PartSpec} from '../../contract';
import {PARTS_COPY} from '../../parts-copy';
import {BODY_X,PIN_COLS} from '../../scene/layout';
import {nodeLoad,pick} from './core/discover';
import type {Mods} from './core/discover';
import {instantiate} from './core/host';
import type {WorldApi} from './core/host';
import type {DeviceDef,Env} from './types';
import type {PartModel} from '../peripherals';

export * from './types';
export {drivePulses,PulseMeter} from './core/pulses';
export {TwiBus} from './core/twi';
export {SpiBus} from './core/spi';
export {TwoWireSlave,Ws2812Decoder,WS2812} from './core/bitbang';
export type {TwoWireConfig,TwoWireHandlers,Ws2812Options,Ws2812Frame} from './core/bitbang';
export {instantiate} from './core/host';
export type {WorldApi} from './core/host';

const SKIP=['index.ts','types.ts'];
function load():Mods{
 try{return import.meta.glob(['./*.ts','!./index.ts','!./types.ts'],{eager:true}) as Mods;}
 catch{return nodeLoad(new URL('./',import.meta.url).href,SKIP);}
}

const DEVICES=new Map<string,DeviceDef>();
/** Register a device by hand (tests, or plugins living outside this folder). Idempotent per kind. */
export function registerDevice(d:DeviceDef):void{
 DEVICES.set(d.kind,d);
 PART_PINS[d.kind]=[...d.pins];
 if(d.holes&&d.holes.length)(PIN_COLS as Record<string,number[]>)[d.kind]=[...d.holes];
 if(d.bodyX)(BODY_X as Record<string,[number,number]>)[d.kind]=[d.bodyX[0],d.bodyX[1]];
 if(d.copy&&!PARTS_COPY[d.kind])PARTS_COPY[d.kind]=d.copy;
}
for(const d of pick<DeviceDef>(load(),'device'))registerDevice(d);

export const deviceRegistry={
 get:(kind:string):DeviceDef|undefined=>DEVICES.get(kind),
 has:(kind:string):boolean=>DEVICES.has(kind),
 kinds:():string[]=>[...DEVICES.keys()],
};

/** Build the PartModel of one spec from its registered device; unknown kinds become an inert passive part. */
export function createDevice(spec:PartSpec,props:PartProps,env:Env,all:()=>readonly PartModel[],world?:WorldApi):PartModel{
 const def=DEVICES.get(spec.kind);
 if(!def)return {spec,props,state:()=>({kind:'passive'}),update(){},setInput(){}};
 return instantiate(def,spec,props,env,all,world);
}
