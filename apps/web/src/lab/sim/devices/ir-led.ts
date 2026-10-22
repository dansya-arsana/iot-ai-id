/**
 * IR-LED (940 nm infrared emitter, 5 mm, protocol gpio): a diode that glows in light the eye cannot see. Forward drop about 1.3 V
 * (a visible LED is 2 V or more), so the current is (5 V - 1.3 V) / R averaged over the duty the sketch makes. The sketch usually
 * sends a 38 kHz carrier (tone() or PWM); the part reports the carrier frequency it sees. Radiant intensity is about 30 mW/sr at
 * 50 mA (datasheet class of a TSAL6200-style 940 nm part) and is linear in current, which is what a paired photodiode sees.
 * The emitted intensity is published in this part's own props as `emitMwSr` (a sibling channel, like lamp -> LDR) for photodiode.ts.
 * Written from public behaviour. Pair: scene/parts/ir-led.ts. Guide: docs/lab-extending.md
 */
import {defineDevice,num,round1} from './types';
import {duty,freq} from './core/util';

/** Typical radiant intensity at 50 mA, mW per steradian. */
export const IR_MW_SR_AT_50MA=30;
export const IR_VF=1.3;
export const IR_MAX_MA=100;

export type IrLedState={ma:number;duty:number;carrierHz:number;emitMwSr:number;over:boolean;pinOverload:boolean};

export const device=defineDevice<IrLedState>({
 kind:'ir-led',protocol:'gpio',
 pins:['A','C'],holes:[0,1],
 copy:{
  name:{en:'IR LED (940 nm)',id:'LED inframerah (940 nm)'},
  desc:{en:'An infrared emitter. It looks dark to your eyes but a phone camera sees it glow. A remote control blinks it at 38 kHz.',id:'Pemancar inframerah. Tampak gelap bagi mata, tetapi kamera ponsel melihatnya menyala. Remote mengedipkannya pada 38 kHz.'},
  note:{en:'Short leg to GND, long leg through a resistor to a pin. Pair it with a photodiode.',id:'Kaki pendek ke GND, kaki panjang lewat resistor ke sebuah pin. Pasangkan dengan fotodioda.'},
 },
 inputs:[{type:'range',key:'seriesOhms',label:{en:'Series resistor',id:'Resistor seri'},min:47,max:1000,step:1,unit:'ohm',default:150}],
 defaults:{seriesOhms:150},
 create(ctx){
  let st:IrLedState={ma:0,duty:0,carrierHz:0,emitMwSr:0,over:false,pinOverload:false};
  return {
   state:()=>st,
   update(f){
    const sib=ctx.siblings().find(m=>m.spec.kind==='resistor'&&m.props.seriesWith===ctx.id);
    const R=Math.max(1,num(sib?.props.ohms,num(ctx.props.seriesOhms,150)));
    const d=duty(ctx.net('A'),f);
    const peak=Math.max(0,(5-IR_VF)/R)*1000;     // mA while the pin is HIGH
    const ma=peak*d;
    const emit=IR_MW_SR_AT_50MA*(ma/50);
    st={ma:round1(ma),duty:Math.round(d*100)/100,carrierHz:Math.round(freq(ctx.net('A'),f)),emitMwSr:round1(emit),over:peak>IR_MAX_MA&&d>0,pinOverload:peak>40&&d>0};
    ctx.props.emitMwSr=emit;   // read by sibling photodiodes
   },
  };
 },
});
