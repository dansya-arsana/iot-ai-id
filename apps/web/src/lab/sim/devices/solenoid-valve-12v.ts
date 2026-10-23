/**
 * SOLENOID-VALVE-12V device (protocol 'gpio', desk prop): 12 V DC normally closed solenoid valve, 1/2" (Adafruit 997 class, https://www.adafruit.com/product/997).
 * Datasheet figures used: 12 V DC, about 320 mA at 12 V (160 mA at 6 V, so the coil is a 37.5 ohm resistor), works down to about 6 V (slower),
 * working pressure 0.02-0.8 MPa (20-800 kPa; it needs about 3 PSI to seal, so it is not for gravity-fed tanks without a direct-acting valve),
 * opens in 0.15 s or less and closes in 0.3 s or less, one flow direction, water only.
 * Assumptions (ours, not on the sheet): the opening time scales as 0.15 s x 12 V / v, so about 0.3 s at 6 V; the coil drops out below 3 V and the valve
 * closes 300 ms later; between 3 V and 6 V the valve keeps its state. Below 20 kPa the coil is energised but the valve cannot lift, so nothing flows.
 * Model: v = volts(+) - volts(-) from the net solver (a floating end is an open circuit). Wire + and - part to part (a relay COM/NO and a 12 V source).
 * Flyback: the coil is inductive. A diode across it (anode on -, cathode on +) clamps the turn-off spike; `flyback` reports whether one is wired,
 * and the note says to add a 1N4007 when it is not.
 * Pair: scene/parts/solenoid-valve-12v.ts. Guide: docs/lab-extending.md
 */
import {defineDevice,clamp,num} from './types';

export const VALVE_RATED_V=12;
export const VALVE_COIL_OHMS=37.5;       // 12 V / 0.32 A
export const VALVE_PULL_IN_V=6;
export const VALVE_DROP_OUT_V=3;
export const VALVE_OPEN_S=0.15;          // at 12 V
export const VALVE_CLOSE_S=0.3;
export const VALVE_MIN_KPA=20;

export type SolenoidValveState={volts:number;/** the plunger is lifted */open:boolean;/** coil current in mA */ma:number;/** water is moving */flowing:boolean;
 /** '' | 'low-voltage' | 'low-pressure' | 'opening' | 'closing' */reason:string;/** a diode spans the coil */flyback:boolean};

export const device=defineDevice<SolenoidValveState>({
 kind:'solenoid-valve-12v',protocol:'gpio',
 pins:['+','-'],
 power:{rail:['+','-'],min:10.8,max:13.2,ma:320,external:true},
 copy:{
  name:{en:'Solenoid valve 12 V (normally closed, 1/2")',id:'Katup solenoid 12 V (normally closed, 1/2")'},
  desc:{en:'A water valve that is closed until its coil gets 12 V. It needs some line pressure to open and seal, and only passes water one way (follow the arrow).',id:'Katup air yang tertutup sampai koilnya mendapat 12 V. Ia butuh tekanan jalur agar membuka dan menutup rapat, dan hanya mengalirkan air satu arah (ikuti panah).'},
  note:{en:'Coil draws about 320 mA: switch it with a relay or MOSFET, never a pin. Put a flyback diode (1N4007) across the coil. Needs at least about 20 kPa (3 PSI): a gravity tank gives only about 10 kPa per metre of head, so under about 2 m it will not seal.',id:'Koil menarik sekitar 320 mA: sakelar dengan relay atau MOSFET, jangan pin. Pasang dioda flyback (1N4007) pada koil. Butuh minimal sekitar 20 kPa (3 PSI): tangki gravitasi hanya memberi sekitar 10 kPa per meter tinggi, jadi di bawah sekitar 2 m katup tidak menutup rapat.'},
 },
 inputs:[{type:'range',key:'pressureKpa',label:{en:'Line pressure',id:'Tekanan jalur'},min:0,max:800,step:10,unit:'kPa',default:200}],
 defaults:{pressureKpa:200},
 create(ctx){
  let open=false,t=0,closing=false;   // t: seconds the current command has been pending
  let st:SolenoidValveState={volts:0,open:false,ma:0,flowing:false,reason:'',flyback:false};
  const flyback=():boolean=>{
   const plus=ctx.peers('+').filter(p=>p.kind==='diode'&&p.pin==='K').map(p=>p.part);
   return ctx.peers('-').some(p=>p.kind==='diode'&&p.pin==='A'&&plus.includes(p.part));
  };
  return {
   state:()=>st,
   update(f){
    const a=ctx.volts('+'),b=ctx.volts('-');
    const v=a!==null&&b!==null?Math.max(0,a-b):0;
    const kpa=clamp(num(ctx.props.pressureKpa,200),0,800);
    const energised=v>=VALVE_PULL_IN_V,dropped=v<VALVE_DROP_OUT_V;
    const openS=VALVE_OPEN_S*VALVE_RATED_V/Math.max(v,VALVE_PULL_IN_V);
    if(!open&&energised&&kpa>=VALVE_MIN_KPA){t+=f.dtSec;if(t>=openS){open=true;t=0;}}
    else if(open&&dropped){t+=f.dtSec;if(t>=VALVE_CLOSE_S){open=false;t=0;}}
    else if(open&&energised&&kpa<VALVE_MIN_KPA){open=false;t=0;}   // no pressure: the plunger cannot hold the seat open
    else t=0;
    closing=open&&dropped;
    const reason=v<VALVE_PULL_IN_V&&!open?(v>0?'low-voltage':''):energised&&kpa<VALVE_MIN_KPA?'low-pressure':energised&&!open?'opening':closing?'closing':'';
    st={volts:Math.round(v*100)/100,open,ma:Math.round(v/VALVE_COIL_OHMS*1000),flowing:open&&kpa>=VALVE_MIN_KPA,reason,flyback:flyback()};
   },
  };
 },
});
