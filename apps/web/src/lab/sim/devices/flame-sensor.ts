/**
 * FLAME-SENSOR device (protocol 'adc'): infrared flame module (phototransistor + LM393). Written from public behaviour.
 *  - The black 5 mm phototransistor is sensitive to 760 to 1100 nm light, where a flame is bright. It sits in a divider
 *    with a 10 kohm pull-up, so more infrared pulls AO DOWN: AO = VCC / (1 + gain * ir), ir in 0..1, gain 15.
 *  - DO is the LM393 comparator: LOW while AO is below the trimmer reference (indicator LED on), HIGH otherwise.
 *  - A flame flickers (a few hertz, with a slower wander); the model multiplies the flame by a fixed, repeatable
 *    flicker, so a threshold near the signal makes DO chatter like the real module does.
 *  - Strength: a candle-size flame saturates the sensor at 20 cm and falls off with the square of distance (model
 *    assumption). Sunlight or a bulb adds ambient infrared, set with `ambient`.
 * Pair: scene/parts/flame-sensor.ts (3D). Guide: docs/lab-extending.md
 */
import {defineDevice,clamp,num} from './types';
import {uno} from './core/util';
import {SIM_CLOCK_HZ} from '../../contract';

export type FlameSensorState={ir:number;value:number;volts:number;doLow:boolean;lit:boolean;thresholdVolts:number;powered:boolean};

export const GAIN=15,REF_CM=20;
/** Steady infrared level 0..1 from a flame at `cm`, before flicker. */
export const flameIr=(cm:number):number=>clamp((REF_CM/Math.max(cm,1))**2,0,1);
/** Repeatable flicker factor around 1 (time in seconds): two slow sines, about +-15 %. */
export const flicker=(t:number):number=>1+0.1*Math.sin(2*Math.PI*7.3*t)+0.05*Math.sin(2*Math.PI*2.9*t+1.3);
export const aoVolts=(vcc:number,ir:number):number=>vcc/(1+GAIN*clamp(ir,0,1));

export const device=defineDevice<FlameSensorState>({
 kind:'flame-sensor',protocol:'adc',
 // physical order on the module header: AO, GND, VCC, DO
 pins:['AO','GND','VCC','DO'],holes:[0,1,2,3],bodyX:[-6,15],
 copy:{
  name:{en:'Flame sensor (IR)',id:'Sensor api (IR)'},
  desc:{en:'A phototransistor that sees the infrared of a flame. AO falls as the flame gets closer or stronger; DO goes LOW past the trimmer level.',id:'Fototransistor yang melihat inframerah api. AO turun saat api makin dekat atau kuat; DO menjadi LOW melewati level trimmer.'},
  note:{en:'Light the flame and move it. Sunlight also adds infrared, so test indoors.',id:'Nyalakan api dan geser jaraknya. Sinar matahari juga menambah inframerah, jadi uji di dalam ruangan.'},
 },
 power:{rail:['VCC','GND'],min:3.3,max:5.5,ma:15},
 inputs:[
  {type:'toggle',key:'lit',label:{en:'Flame lit',id:'Api menyala'},default:false},
  {type:'range',key:'distanceCm',label:{en:'Flame distance',id:'Jarak api'},min:5,max:100,step:1,unit:'cm',default:40},
  {type:'range',key:'ambient',label:{en:'Ambient infrared (sunlight)',id:'Inframerah sekitar (matahari)'},min:0,max:100,step:1,unit:'%',default:0},
  {type:'range',key:'threshold',label:{en:'DO level (trimmer)',id:'Level DO (trimmer)'},min:0,max:1023,step:1,default:500},
 ],
 defaults:{lit:false,distanceCm:40,ambient:0,threshold:500},
 create(ctx){
  const ao=ctx.analogPin('AO'),dout=uno(ctx.net('DO'));
  let low:boolean|null=null;
  const vcc=():number=>ctx.supply()??5;
  const powered=():boolean=>vcc()>=2.7;
  const thr=():number=>clamp(num(ctx.props.threshold,500),0,1023)/1023*vcc();
  const ir=(now:number):number=>{
   const flame=ctx.props.lit===true?flameIr(num(ctx.props.distanceCm,40))*flicker(now/SIM_CLOCK_HZ):0;
   return clamp(flame+clamp(num(ctx.props.ambient,0),0,100)/100,0,1);
  };
  const volts=(now:number):number=>powered()?aoVolts(vcc(),ir(now)):0;
  const sync=(now:number):boolean=>{
   const l=powered()&&volts(now)<thr();
   if(dout&&l!==low)ctx.env.setPin(dout,!l);
   low=l;return l;
  };
  sync(ctx.env.now());
  return {
   state:()=>{const now=ctx.env.now(),v=volts(now);return {ir:Math.round(ir(now)*100),value:Math.round(v/5*1023),volts:Math.round(v*100)/100,doLow:sync(now),lit:ctx.props.lit===true,thresholdVolts:Math.round(thr()*100)/100,powered:powered()};},
   tick(){sync(ctx.env.now());},
   adc:()=>ao?{pin:ao,volts:volts(ctx.env.now())}:null,
  };
 },
});
