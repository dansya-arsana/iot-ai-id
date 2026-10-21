import type {Env,Level,Pulse,PulsePlan} from '../types';
import type {UnoPin} from '../../../contract';

/** Scheduled pin drive: cycle-accurate pulse trains for echo pulses, one-wire responses, software UARTs. */
export function drivePulses(env:Env,pin:UnoPin,pulses:readonly Pulse[],o:{delayCycles?:number;onDone?:()=>void}={}):PulsePlan{
 let dead=false,done=false;
 let t=Math.max(0,o.delayCycles??0);
 const at=(delay:number,level:Level):void=>{
  const run=():void=>{if(!dead)env.setPin(pin,level===1);};
  if(delay<=0)run();else env.schedule(delay,run);
 };
 for(const p of pulses){at(t,p.level);t+=Math.max(0,p.holdCycles);}
 const finish=():void=>{if(dead)return;done=true;o.onDone?.();};
 if(t<=0)finish();else env.schedule(t,finish);
 return {cancel(){dead=true;},get active(){return !dead&&!done;}};
}

/** Measures the high pulses of one pin from onPinChange edges (servo, PWM input, echo). */
export class PulseMeter{
 private rise=-1;
 /** Width of the last complete high pulse in CPU cycles (0: none yet). */
 lastHigh=0;
 /** Time between the last two rising edges in cycles (0: unknown). */
 period=0;
 private lastRise=-1;
 edge(level:Level,cycle:number):void{
  if(level===1){if(this.lastRise>=0)this.period=cycle-this.lastRise;this.lastRise=cycle;this.rise=cycle;}
  else if(this.rise>=0){this.lastHigh=cycle-this.rise;this.rise=-1;}
 }
}
