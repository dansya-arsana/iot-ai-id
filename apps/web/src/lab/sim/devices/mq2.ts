/**
 * MQ2 device (protocol 'adc'): gas sensor breakout with a SnO2 mesh sensor, heater, LM393 comparator and threshold trimmer.
 * Written from public datasheet behaviour:
 *  - Sensor resistance Rs falls as combustible gas rises. LPG curve (log-log line from the datasheet chart):
 *    ppm = 574.25 * (Rs/R0)^-2.222, so Rs/R0 = (ppm/574.25)^(-1/2.222). Clean air sits near Rs/R0 = 9.83.
 *  - The module divides 5 V between Rs and the load resistor RL (5 kohm): AO = 5 V * RL / (Rs + RL). AO rises with gas.
 *  - DO is the LM393 comparator: LOW while AO is above the trimmer threshold (active low), about 40 mV hysteresis.
 *  - The heater needs a warm-up (datasheet: preheat; a cold sensor reads high and drifts down). Modelled as a first-order
 *    settle of Rs from 30 % of its final value; the sensor counts as ready after `warmupS`.
 *  - The mesh responds with a lag (time constant about 1.5 s).
 * Pair: scene/parts/mq2.ts (3D). Guide: docs/lab-extending.md
 */
import {defineDevice,clamp,num,round1} from './types';
import {uno} from './core/util';
import {SIM_CLOCK_HZ} from '../../contract';

export type Mq2State={ppm:number;volts:number;value:number;doLow:boolean;heat:number;ready:boolean;ratio:number};

/** R0 chosen so clean air (Rs/R0 = 9.83) lands near 0.6 V on AO, like a typical calibrated module. */
export const R0_KOHM=3.5,RL_KOHM=5,CLEAN_RATIO=9.83;
export const ratioForPpm=(ppm:number):number=>Math.min(CLEAN_RATIO,Math.pow(Math.max(ppm,1)/574.25,-1/2.222));
export const aoVolts=(ratio:number):number=>5*RL_KOHM/(ratio*R0_KOHM+RL_KOHM);

export const device=defineDevice<Mq2State>({
 kind:'mq2',protocol:'adc',
 // physical order on the breakout: VCC, GND, DO, AO
 pins:['VCC','GND','DO','AO'],holes:[0,1,2,3],bodyX:[-8.4,16],
 copy:{
  name:{en:'Gas sensor (MQ-2)',id:'Sensor gas (MQ-2)'},
  desc:{en:'A heated tin-oxide mesh whose resistance drops in smoke and combustible gas. AO gives a voltage that rises with gas, DO flips LOW past the trimmer threshold.',id:'Mesh timah oksida yang dipanaskan; hambatannya turun saat ada asap dan gas mudah terbakar. AO memberi tegangan yang naik dengan gas, DO menjadi LOW melewati ambang trimmer.'},
  note:{en:'The heater needs time to warm up: readings are high and drift down at first.',id:'Pemanas butuh waktu untuk panas: awalnya bacaan tinggi lalu turun perlahan.'},
 },
 power:{rail:['VCC','GND'],min:4.5,max:5.5,ma:150},
 inputs:[
  {type:'range',key:'ppm',label:{en:'Gas (LPG equivalent)',id:'Gas (setara LPG)'},min:0,max:10000,step:10,unit:'ppm',default:0},
  {type:'range',key:'threshold',label:{en:'DO threshold (trimmer)',id:'Ambang DO (trimmer)'},min:0,max:1023,step:1,default:400},
  {type:'range',key:'warmupS',label:{en:'Heater warm-up',id:'Pemanasan'},min:1,max:60,step:1,unit:'s',default:20},
 ],
 defaults:{ppm:0,threshold:400,warmupS:20},
 create(ctx){
  const ao=ctx.analogPin('AO'),dout=uno(ctx.net('DO'));
  let t=0,smooth=ratioForPpm(num(ctx.props.ppm,0)),low:boolean|null=null;
  const warm=()=>clamp(num(ctx.props.warmupS,20),1,60);
  // 0 cold .. 1 hot; Rs scales from 30 % to 100 % of its final value (cold mesh reads high)
  const heat=()=>1-Math.exp(-3*t/warm());
  const ratio=()=>smooth*(0.3+0.7*heat());
  const volts=()=>aoVolts(ratio());
  const thr=()=>clamp(num(ctx.props.threshold,400),0,1023)/1023*5;
  const sync=():boolean=>{
   const v=volts(),h=low===true?0.04:0;
   const l=v>thr()-h;                       // LM393: output pulled LOW while AO is above the reference
   if(dout&&l!==low)ctx.env.setPin(dout,!l);
   low=l;return l;
  };
  sync();
  return {
   state:()=>{const v=volts();return {ppm:clamp(num(ctx.props.ppm,0),0,10000),volts:Math.round(v*100)/100,value:Math.round(v/5*1023),doLow:sync(),heat:round1(heat()*100)/100,ready:t>=warm(),ratio:Math.round(ratio()*100)/100};},
   tick(cycles){
    const dt=cycles/SIM_CLOCK_HZ;t+=dt;
    const target=ratioForPpm(num(ctx.props.ppm,0));
    smooth+=(target-smooth)*(1-Math.exp(-dt/1.5));
    sync();
   },
   adc:()=>ao?{pin:ao,volts:volts()}:null,
  };
 },
});
