/**
 * VIBRATION-MOTOR device (protocol 'pwm'): a coin (pancake) vibration motor, 10 mm across and 2.7 mm thick, rated 3 V, about 75 mA,
 * roughly 12000 rpm at 3 V. A small weight sits off centre on the shaft, so the spin shakes the whole disc.
 * It has two flying leads. Speed follows the voltage across + and -, found by the net solver (a driver output, a transistor, a pin).
 * It starts to turn above about 2.0 V and keeps turning down to about 1.0 V once it spins (static friction). The shake grows with
 * the square of the speed (centripetal force of the weight) and its frequency is the rotation frequency (rpm / 60).
 * Wired straight to an I/O pin it is an external-load warning: use a transistor and a diode. Written from public behaviour.
 * Pair: scene/parts/vibration-motor.ts (3D). Guide: docs/lab-extending.md
 */
import {defineDevice} from './types';

export type VibrationMotorState={
 /** voltage across the leads (average of the PWM), signed */
 volts:number;
 /** shaft speed, signed (negative = reverse) */
 rpm:number;
 /** vibration frequency in Hz (|rpm| / 60) */
 hz:number;
 /** relative shake: (rpm / rated rpm) squared, 1 = shake at 3 V */
 shake:number;
};

export const COIN_RATED_V=3;
export const COIN_RATED_RPM=12000;
export const COIN_START_V=2;
export const COIN_STOP_V=1;
const TAU_S=0.08;

export const device=defineDevice<VibrationMotorState>({
 kind:'vibration-motor',protocol:'pwm',
 pins:['+','-'],
 power:{rail:['+','-'],min:2,max:3.8,ma:75,external:true},
 copy:{
  name:{en:'Coin vibration motor',id:'Motor getar koin'},
  desc:{en:'A flat 10 mm motor with an off-centre weight. It shakes whatever it is stuck to; more voltage means a faster, stronger buzz.',id:'Motor pipih 10 mm dengan beban tidak di tengah. Ia menggetarkan benda tempatnya menempel; makin besar tegangan, makin cepat dan kuat getarannya.'},
  note:{en:'Needs a driver: 75 mA is too much for a pin. The shake shown is slowed so you can see it.',id:'Perlu driver: 75 mA terlalu besar untuk satu pin. Getaran yang digambar diperlambat agar terlihat.'},
 },
 inputs:[],
 create(ctx){
  let volts=0,rpm=0,spinning=false;
  return {
   state:()=>({volts:Math.round(volts*100)/100,rpm:Math.round(rpm),hz:Math.round(Math.abs(rpm)/6)/10,shake:Math.round((rpm/COIN_RATED_RPM)**2*100)/100}),
   update(f){
    volts=(ctx.volts('+')??0)-(ctx.volts('-')??0);
    const a=Math.abs(volts);
    spinning=a>=(spinning?COIN_STOP_V:COIN_START_V);
    const target=spinning?Math.sign(volts)*COIN_RATED_RPM*Math.min(1.3,a/COIN_RATED_V):0;
    rpm+=(target-rpm)*(1-Math.exp(-f.dtSec/TAU_S));
    if(Math.abs(rpm)<1)rpm=0;
   },
  };
 },
});
