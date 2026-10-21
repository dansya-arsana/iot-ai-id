/**
 * LOAD-LAMP (desk prop, protocol 'gpio'): a small 12 V bulb whose supply runs through the contact of a relay module.
 * It has no pins of its own. The relay it hangs on is named by `props.target`; the bulb shines when that relay is energised:
 * VCC of the module wired to 5 V, IN driven as an output, and its level matching the module's trigger (active low by default).
 * It reads the same signals the relay reads (the IN pin's duty) and applies the same operate/release delay, so the lamp and the relay click stay in step.
 * Pair: scene/parts/load-lamp.ts. Guide: docs/lab-extending.md
 */
import {defineDevice} from './types';
import {duty} from './core/util';
import {RELAY_OPERATE_MS,RELAY_RELEASE_MS} from './relay-module';

export type LoadLampState={on:boolean;/** a relay was found and its contact feeds this bulb */linked:boolean;/** watts drawn through the contact */watts:number};

export const LAMP_WATTS=5;

export const device=defineDevice<LoadLampState>({
 kind:'load-lamp',protocol:'gpio',
 pins:[],
 copy:{
  name:{en:'Lamp on the relay contact (12 V, 5 W)',id:'Lampu di kontak relay (12 V, 5 W)'},
  desc:{en:'A small bulb that is switched by the relay module it points at. It has no pins: its power comes through the relay contact (COM to NO), so it only lights while the relay is closed.',id:'Bohlam kecil yang disakelar modul relay yang ditunjuknya. Ia tidak punya pin: dayanya lewat kontak relay (COM ke NO), jadi hanya menyala saat relay menutup.'},
  note:{en:'The lamp has its own supply, separate from the Arduino. The sketch never touches it, only the relay.',id:'Lampu punya catu sendiri, terpisah dari Arduino. Sketsa tidak menyentuhnya, hanya relay.'},
 },
 inputs:[],
 create(ctx){
  let on=false,linked=false,pendingMs=0;
  return {
   state:()=>({on,linked,watts:on?LAMP_WATTS:0}),
   update(f){
    const relay=ctx.siblings().find(s=>s.spec.id===ctx.props.target&&s.spec.kind==='relay-module');
    linked=!!relay;
    if(!relay){on=false;return;}
    const inNet=relay.spec.net.IN;
    const powered=relay.spec.net.VCC==='5V';
    const driven=inNet==='5V'||inNet==='GND'||(typeof inNet==='string'&&f.samples[inNet as keyof typeof f.samples]?.mode==='output');
    const d=driven?duty(inNet,f):0;
    const activeLow=relay.props.trigger!=='high';
    const want=powered&&driven&&(activeLow?d<0.5:d>=0.5);
    if(want===on){pendingMs=0;return;}
    pendingMs+=f.dtSec*1000;
    if(pendingMs>=(want?RELAY_OPERATE_MS:RELAY_RELEASE_MS)){on=want;pendingMs=0;}
   },
  };
 },
});
