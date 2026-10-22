/**
 * SOUND-KY038 device (protocol 'adc'): electret microphone module. Written from public datasheet behaviour.
 *  - An electret capsule feeds an amplifier (LM358 class). AO is the AC audio signal riding on a bias of about half the
 *    supply, so silence reads near 512 and sound swings above and below it. The sketch measures loudness as the
 *    peak-to-peak span over a short window (about 50 ms), exactly like on real hardware.
 *  - DO is the LM393 comparator: it compares the instantaneous AO with the trimmer reference. While AO is above the
 *    reference DO is HIGH (indicator LED on), so a tone makes a pulse train at the tone frequency whose duty grows with
 *    loudness. (Boards differ in polarity; this model uses HIGH on sound.)
 *  - Loudness sets a steady tone amplitude; the clap button adds a burst that peaks at once and dies with a time constant
 *    of about 60 ms. Gain: full scale (100 %) is a 2.2 V amplitude, clipped inside the rails.
 * The waveform is a pure function of simulated time, so the same run always gives the same samples.
 * Pair: scene/parts/sound-ky038.ts (3D). Guide: docs/lab-extending.md
 */
import {defineDevice,clamp,num,round1} from './types';
import {uno} from './core/util';
import {SIM_CLOCK_HZ} from '../../contract';

export type SoundKy038State={value:number;volts:number;level:number;doHigh:boolean;clap:boolean;toneHz:number;thresholdVolts:number;powered:boolean};

export const FULL_SCALE_V=2.2,CLAP_TAU_S=0.06,CLAP_HOLD_S=0.002,MAX_EDGES=2000;
/** Envelope 0..1 of a clap that happened `ageCycles` ago (negative age = not yet). */
export const clapEnv=(ageCycles:number):number=>{
 if(ageCycles<0)return 0;
 const s=ageCycles/SIM_CLOCK_HZ;
 return s<CLAP_HOLD_S?1:Math.exp(-(s-CLAP_HOLD_S)/CLAP_TAU_S);
};

export const device=defineDevice<SoundKy038State>({
 kind:'sound-ky038',protocol:'adc',
 // physical order on the module header: AO, GND, VCC (+), DO
 pins:['AO','GND','VCC','DO'],holes:[0,1,2,3],bodyX:[-5,14],
 copy:{
  name:{en:'Sound sensor (KY-038)',id:'Sensor suara (KY-038)'},
  desc:{en:'A microphone module. AO carries the audio wave around half the supply, so measure its swing over a short window. DO goes HIGH while the wave is above the trimmer level.',id:'Modul mikrofon. AO membawa gelombang suara di sekitar setengah tegangan suplai, jadi ukur simpangannya dalam jendela waktu singkat. DO menjadi HIGH selama gelombang di atas level trimmer.'},
  note:{en:'Set the loudness or press Clap. Silence reads about 512; sound swings above and below it.',id:'Atur kerasnya suara atau tekan Tepuk. Hening terbaca sekitar 512; suara berayun di atas dan di bawahnya.'},
 },
 power:{rail:['VCC','GND'],min:3.3,max:5.5,ma:5},
 inputs:[
  {type:'range',key:'loudness',label:{en:'Loudness',id:'Kerasnya suara'},min:0,max:100,step:1,unit:'%',default:0},
  {type:'toggle',key:'clap',label:{en:'Clap',id:'Tepuk'},default:false},
  {type:'range',key:'threshold',label:{en:'DO level (trimmer)',id:'Level DO (trimmer)'},min:0,max:1023,step:1,default:640},
  {type:'range',key:'toneHz',label:{en:'Tone',id:'Nada'},min:100,max:2000,step:10,unit:'Hz',default:700},
 ],
 defaults:{loudness:0,clap:false,threshold:640,toneHz:700},
 create(ctx){
  const ao=ctx.analogPin('AO'),dout=uno(ctx.net('DO'));
  let clapAt=-1,last:boolean|null=null;
  const vcc=():number=>ctx.supply()??5;
  const powered=():boolean=>vcc()>=2.7;
  const tone=():number=>clamp(num(ctx.props.toneHz,700),100,2000);
  const thr=():number=>clamp(num(ctx.props.threshold,640),0,1023)/1023*vcc();
  const takeClap=(now:number):void=>{if(ctx.props.clap===true){clapAt=now;ctx.props.clap=false;}};
  const env=(now:number):number=>Math.max(clamp(num(ctx.props.loudness,0),0,100)/100,clapAt<0?0:clapEnv(now-clapAt));
  const amp=(now:number):number=>env(now)*FULL_SCALE_V;
  const wave=(now:number):number=>{
   if(!powered())return 0;
   const v=vcc(),a=amp(now),ph=2*Math.PI*((now*tone()/SIM_CLOCK_HZ)%1);
   return clamp(v/2+a*Math.sin(ph),0.05,v-0.05);       // amplifier output stays inside its rails
  };
  const drive=(level:boolean):void=>{if(level===last)return;last=level;if(dout)ctx.env.setPin(dout,level);};
  const plan=(from:number,len:number):void=>{
   const level=powered()&&wave(from)>thr();
   drive(level);
   if(!dout||!powered())return;
   const a=amp(from),d=thr()-vcc()/2;
   if(a<=Math.abs(d))return;                              // the wave never reaches the reference, or never drops below it
   const P=SIM_CLOCK_HZ/tone(),p1=Math.asin(d/a)/(2*Math.PI),p2=(Math.PI-Math.asin(d/a))/(2*Math.PI);
   const edges:{t:number;level:boolean}[]=[];
   for(let k=Math.floor(from/P)-1;edges.length<MAX_EDGES;k++){
    const tr=(k+p1)*P,tf=(k+p2)*P;
    if(tr>from+len&&tf>from+len)break;
    if(tr>from&&tr<=from+len)edges.push({t:tr,level:true});
    if(tf>from&&tf<=from+len)edges.push({t:tf,level:false});
   }
   edges.sort((x,y)=>x.t-y.t);
   for(const e of edges)ctx.env.schedule(Math.max(0,Math.round(e.t-from)),()=>drive(e.level));
  };
  const snap=():SoundKy038State=>{
   const now=ctx.env.now(),v=wave(now);
   return {value:Math.round(v/5*1023),volts:Math.round(v*100)/100,level:round1(env(now)*100),doHigh:last===true,clap:clapAt>=0&&clapEnv(now-clapAt)>0.05,toneHz:tone(),thresholdVolts:Math.round(thr()*100)/100,powered:powered()};
  };
  drive(false);
  return {
   state:()=>{takeClap(ctx.env.now());return snap();},
   setInput(i){if(i.kind==='ext'&&i.type==='sound-ky038'&&i.v.clap===true)clapAt=ctx.env.now();},
   tick(cycles){const now=ctx.env.now();takeClap(now);plan(now,cycles);},
   adc:()=>ao?{pin:ao,volts:wave(ctx.env.now())}:null,
  };
 },
});
