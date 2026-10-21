/**
 * CAPACITOR device (protocol 'adc'): a two-lead capacitor, electrolytic radial or ceramic disc.
 * Wire POS to a board pin (through the series resistor R that the popover models) and NEG to GND.
 * Behaviour: first-order RC. While the MCU drives POS as an output, V moves toward 0 V or 5 V with
 * tau = R*C (V += (Vt-V)*(1-exp(-dt/tau))). While POS is an input, the cap holds its charge and only leaks
 * (electrolytic leakage is far higher than ceramic). On an analog pin the voltage is shown to analogRead;
 * on a digital pin digitalRead sees it with a 2.5 V threshold and 0.5 V hysteresis.
 * Own work from the textbook RC equation; no vendor model.
 */
import {defineDevice,clamp,num,round1} from './types';

export type CapacitorState={variant:string;uF:number;rOhms:number;volts:number;charge:number;tauMs:number};

const VARIANTS=['electrolytic','ceramic'];
/** Leakage time constant in seconds when the pin is released. Ceramic is practically ideal. */
const LEAK_S:Record<string,number>={electrolytic:40,ceramic:5000};

export const device=defineDevice<CapacitorState>({
 kind:'capacitor',protocol:'adc',
 pins:['POS','NEG'],holes:[0,1],
 copy:{
  name:{en:'Capacitor',id:'Kapasitor'},
  desc:{en:'Stores charge. Wire POS through a resistor to a pin and NEG to GND: the pin charges it in R x C seconds and you can read the voltage back.',id:'Menyimpan muatan. Hubungkan POS lewat resistor ke sebuah pin dan NEG ke GND: pin mengisinya dalam R x C detik, lalu tegangannya bisa dibaca.'},
  note:{en:'Electrolytic has a stripe on the minus lead (keep it toward GND). The ceramic disc has no polarity.',id:'Elco punya garis di kaki minus (arahkan ke GND). Kapasitor keramik tidak punya polaritas.'},
 },
 inputs:[
  {type:'choice',key:'variant',label:{en:'Type',id:'Jenis'},options:[{value:'electrolytic',label:{en:'Electrolytic radial',id:'Elco radial'}},{value:'ceramic',label:{en:'Ceramic disc',id:'Keramik cakram'}}],default:'electrolytic'},
  {type:'range',key:'uF',label:{en:'Capacitance',id:'Kapasitansi'},min:0.1,max:1000,step:0.1,unit:'uF',default:100},
  {type:'range',key:'rOhms',label:{en:'Series resistor',id:'Resistor seri'},min:100,max:100000,step:100,unit:'ohm',default:10000},
 ],
 defaults:{variant:'electrolytic',uF:100,rOhms:10000},
 create(ctx){
  let v=0,last:boolean|null=null;
  const pos=ctx.pin('POS');
  const variant=()=>{const s=ctx.props.variant;return typeof s==='string'&&VARIANTS.includes(s)?s:'electrolytic';};
  const uF=()=>clamp(num(ctx.props.uF,100),0.1,1000);
  const r=()=>clamp(num(ctx.props.rOhms,10000),100,100000);
  const tau=()=>r()*uF()*1e-6;
  return {
   state:()=>({variant:variant(),uF:uF(),rOhms:r(),volts:Math.round(v*100)/100,charge:clamp(v/5,0,1),tauMs:round1(tau()*1000)}),
   tick(cycles){
    if(!pos)return;
    const dt=cycles/16e6;
    if(ctx.hostDrives(pos)){
     const target=ctx.pinLevel(pos)?5:0;
     v+=(target-v)*(1-Math.exp(-dt/tau()));
     last=null;
    }else{
     v*=Math.exp(-dt/LEAK_S[variant()]!);
     if(!pos.startsWith('A')){
      const hi=last===null?v>2.5:last?v>2.0:v>3.0;
      if(hi!==last){last=hi;ctx.env.setPin(pos,hi);}
     }
    }
    v=clamp(v,0,5);
   },
   adc:()=>pos&&pos.startsWith('A')?{pin:pos,volts:v}:null,
  };
 },
});
