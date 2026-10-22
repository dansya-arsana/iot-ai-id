/**
 * HX711-LOADCELL (protocol 'twowire'): the 24-bit bridge amplifier board plus a strain-gauge load cell bar (the typical "50 kg" bar).
 * Datasheet behaviour (public, written by us), simulated at signal level on the two header wires:
 *  - DT (DOUT) is high while no result is ready. When a conversion finishes the chip pulls DT LOW; the master then clocks SCK.
 *  - Each SCK rising edge shifts out one bit, MSB first, 24 bits of two's complement. Bit 1 is on DT after the first rising edge (T3 <= 0.1 us).
 *  - Extra pulses after the 24th pick the NEXT conversion: 25 pulses = channel A gain 128, 26 = channel B gain 32, 27 = channel A gain 64.
 *    DT returns high on the 25th rising edge. Gain is read when the next conversion starts.
 *  - SCK high for more than 60 us powers the chip down (DT high). Back low, the chip resets (gain 128) and settles for 400 ms before the first result.
 *  - 10 results per second (the RATE pin of the module is tied low). The output holds until it is read; an unread result is replaced by a fresh one each
 *    100 ms as long as the master has not started clocking it.
 * Analog side: full scale code 0x7FFFFF at a differential input of +0.5 x AVDD / gain (19.5 mV at 5 V, gain 128). The load cell is a Wheatstone bridge
 * of 1.0 mV/V rated output at its capacity, excited from the module's AVDD (taken as VCC), so code = grams / capacity x 0.001 x gain x 2 x 8388607.
 * Channel B has no sensor on this module: it reads 0. Noise and zero drift are not simulated (the readings are exact; tare in your sketch).
 * Header (module order): GND, DT, SCK, VCC. The four screw terminals to the bar are drawn as wires on the 3D part, they are not pins.
 * Pair: scene/parts/hx711-loadcell.ts. Guide: docs/lab-extending.md
 */
import {defineDevice,clamp,num} from './types';
import {TwoWireSlave} from './core/bitbang';
import {ms,us} from './types';

export type Hx711LoadcellState={weight:number;capacityKg:number;raw:number;gain:number;channel:string;ready:boolean;reads:number;powered:boolean;poweredDown:boolean;vcc:number};

/** One conversion every 100 ms (10 SPS) and 400 ms to settle after power up or a reset. */
export const HX711_PERIOD_MS=100;
export const HX711_SETTLE_MS=400;
/** SCK high longer than this powers the chip down. */
export const HX711_PD_US=60;
export const HX711_FULL_SCALE=8388607;
/** Rated output of the bar at its capacity, millivolts per volt of excitation. */
export const LOADCELL_MV_PER_V=1;

/** Code the chip reports for a weight, supply, gain and bar capacity (pure; the tests use it). */
export function hx711Code(grams:number,capacityKg:number,vcc:number,gain:number):number{
 const diff=LOADCELL_MV_PER_V/1000*vcc*(grams/(capacityKg*1000));   // volts across the bridge output
 const fs=0.5*vcc/gain;
 return clamp(Math.round(diff/fs*HX711_FULL_SCALE),-HX711_FULL_SCALE-1,HX711_FULL_SCALE);
}

/** The 25-27 pulse selection: pulses after the 24 data bits. */
const SELECT:Record<number,{gain:number;channel:string}>={25:{gain:128,channel:'A'},26:{gain:32,channel:'B'},27:{gain:64,channel:'A'}};

export const device=defineDevice<Hx711LoadcellState>({
 kind:'hx711-loadcell',protocol:'twowire',
 pins:['GND','DT','SCK','VCC'],
 power:{rail:['VCC','GND'],min:2.6,max:5.5,ma:2},
 copy:{
  name:{en:'HX711 load cell amplifier + bar',id:'Penguat sel beban HX711 + batang'},
  desc:{en:'A 24-bit amplifier read over two wires, with the metal load cell bar it was made for. Put weight on the bar and the number you read changes.',id:'Penguat 24-bit yang dibaca lewat dua kabel, lengkap dengan batang sel beban logam yang dipasangkan. Beri beban pada batang dan angka bacaan berubah.'},
  note:{en:'DT goes low when a reading is ready, then pulse SCK 25 times: 24 bits out, one more for gain 128. Set the weight in grams in the popover and tare in your sketch.',id:'DT turun saat bacaan siap, lalu denyutkan SCK 25 kali: 24 bit keluar, satu lagi untuk gain 128. Atur berat dalam gram di popover dan lakukan tare di sketch.'},
 },
 inputs:[
  {type:'range',key:'weight',label:{en:'Weight on the bar',id:'Beban di batang'},min:0,max:10000,step:1,unit:'g',default:0},
  {type:'choice',key:'capacity',label:{en:'Bar capacity',id:'Kapasitas batang'},options:[{value:'1',label:{en:'1 kg',id:'1 kg'}},{value:'5',label:{en:'5 kg',id:'5 kg'}},{value:'10',label:{en:'10 kg',id:'10 kg'}},{value:'20',label:{en:'20 kg',id:'20 kg'}},{value:'50',label:{en:'50 kg',id:'50 kg'}}],default:'5'},
 ],
 defaults:{weight:0,capacity:'5'},
 create(ctx){
  const bus=new TwoWireSlave(ctx,{clk:'SCK',data:'DT',framing:'free'});
  const sck=ctx.pin('SCK');
  let gain=128,channel='A',pulses=0,ready=false,reads=0,raw=0;
  let gen=0,running=false,down=false,lastRise=-1,sckHigh=false;
  const capacity=():number=>{const n=Number(ctx.props.capacity);return n>0?n:5;};
  const weight=():number=>clamp(num(ctx.props.weight,0),0,10000);
  const vcc=():number|null=>{
   const v=ctx.volts('VCC');if(v===null)return null;
   const d=v-(ctx.volts('GND')??0);
   return d>=2.6?d:null;
  };
  const sample=():number=>{
   const s=vcc();if(s===null||channel==='B')return 0;   // channel B inputs are open on this module
   return hx711Code(weight(),capacity(),s,gain);
  };
  /** A conversion has finished: pick up the gain the last readout selected, then present a fresh result. */
  const present=():void=>{
   const sel=SELECT[pulses];if(sel){gain=sel.gain;channel=sel.channel;}
   pulses=0;
   raw=sample();
   const v=raw<0?raw+0x1000000:raw,bits:number[]=[];
   for(let i=23;i>=0;i--)bits.push((v>>i)&1);
   bus.cancelShift();bus.pull(true);ready=true;
   bus.shiftOut(bits,{on:'rising',done:()=>{bus.pull(false);ready=false;reads++;}});
  };
  const loop=(g:number):void=>{
   ctx.schedule(ms(HX711_PERIOD_MS),()=>{
    if(g!==gen||down)return;
    if(!(ready&&pulses>0))present();     // a readout in progress is never disturbed
    loop(g);
   });
  };
  const stop=():void=>{gen++;running=false;bus.pull(false);bus.cancelShift();ready=false;};
  /** Start (or restart) conversions after the settling time. */
  const start=():void=>{
   const g=++gen;running=true;
   ctx.schedule(ms(HX711_SETTLE_MS),()=>{if(g===gen&&!down){present();loop(g);}});
  };
  return {
   state:()=>({weight:Math.round(weight()),capacityKg:capacity(),raw,gain,channel,ready,reads,powered:vcc()!==null,poweredDown:down,vcc:Math.round((vcc()??0)*100)/100}),
   tick(){
    const on=vcc()!==null;
    if(on&&!running&&!down)start();
    else if(!on&&running){stop();gain=128;channel='A';pulses=0;}
   },
   onPinChange(pin,level,cycle){
    if(pin===sck){
     sckHigh=level===1;
     if(level===1){
      lastRise=cycle;
      if(!down)pulses++;
      // SCK high for more than 60 us powers the chip down
      const mark=cycle;
      ctx.schedule(us(HX711_PD_US),()=>{if(lastRise===mark&&sckHigh&&running&&!down){stop();down=true;pulses=0;gain=128;channel='A';}});
     }else if(down){
      // SCK low again: reset (gain 128) and 400 ms to settle
      down=false;
      if(vcc()!==null)start();
     }
    }
    bus.edge(pin,level,cycle);
   },
  };
 },
});
