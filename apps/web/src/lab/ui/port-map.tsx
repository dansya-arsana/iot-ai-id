import {PIN_PORT,UNO_PINS} from '../contract';
import type {AvrPort,PinSample,UnoPin} from '../contract';

const GROUPS:{port:AvrPort;bits:number[]}[]=[
 {port:'D',bits:[7,6,5,4,3,2,1,0]},{port:'B',bits:[5,4,3,2,1,0]},{port:'C',bits:[5,4,3,2,1,0]},
];
const pinOf=(port:AvrPort,bit:number):UnoPin=>UNO_PINS.find(p=>PIN_PORT[p].port===port&&PIN_PORT[p].bit===bit)!;

/** Real ATmega328P port state: one 8x12 cell per pin, grouped PORTD | PORTB | PORTC. */
export function PortMap({pins}:{pins:Record<string,PinSample>|null}){
 return (
  <div className="lab-portmap" role="group" aria-label="ATmega328P ports">
   {GROUPS.map(g=>(
    <div key={g.port} className="lab-portgrp"><span className="lab-portname">{g.port}</span>
     {g.bits.map(b=>{
      const pin=pinOf(g.port,b),s=pins?.[pin];
      const pwm=!!s&&s.mode==='output'&&s.duty>0.01&&s.duty<0.99;
      const state=!s?'off':pwm?'pwm':s.mode==='output'?(s.level?'high':'low'):'in';
      return <i key={pin} className="lab-portcell" data-port-pin={pin} data-state={state} data-level={s?s.level:0} title={`${pin} · ${s?s.mode:'-'}`} style={pwm?{opacity:0.35+0.65*s.duty}:undefined}/>;
     })}
    </div>
   ))}
  </div>
 );
}
