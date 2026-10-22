/**
 * LED-BAR-10 (10-segment bar graph, protocol gpio): ten independent LEDs in one housing, each with its own anode A1..A10.
 * A real bar graph has ten separate cathode pins; here they are joined into one cathode pin K (a strap you would otherwise wire by hand)
 * so the part fits one breadboard row. A segment lights when its pin is HIGH and K is at ground; current = (5 V - Vf - Vk) / R averaged
 * over PWM duty, with a typical forward drop per colour. Written from public behaviour (generic 10-segment bar). Pair: scene/parts/led-bar-10.ts.
 */
import {defineDevice,num,round1} from './types';
import {duty} from './core/util';

export const BAR_SEGMENTS=10;
export const BAR_VF:Record<string,number>={red:2.0,green:2.2,yellow:2.1,blue:3.0};
/** Datasheet continuous current per segment is about 20-30 mA; above 20 mA the lab flags it. */
export const BAR_MAX_MA=20;
export const BAR_PINS=Array.from({length:BAR_SEGMENTS},(_,i)=>`A${i+1}`);

export type LedBar10State={
 s1:number;s2:number;s3:number;s4:number;s5:number;s6:number;s7:number;s8:number;s9:number;s10:number;
 lit:number;/** length of the unbroken bar from segment 1 */level:number;totalMa:number;over:boolean;
};

export const device=defineDevice<LedBar10State>({
 kind:'led-bar-10',protocol:'gpio',
 pins:[...BAR_PINS,'K'],holes:[0,1,2,3,4,5,6,7,8,9,10],bodyX:[-1.4,26.8],
 copy:{
  name:{en:'LED bar graph (10 segments)',id:'Bar graph LED (10 segmen)'},
  desc:{en:'Ten small LEDs in a row, each on its own pin. Drive pins A1 to A10 HIGH to fill the bar like a level meter.',id:'Sepuluh LED kecil berderet, masing-masing di pinnya sendiri. Beri HIGH pada pin A1 sampai A10 untuk mengisi batang seperti pengukur level.'},
  note:{en:'Joins all ten cathodes into one pin K: wire K to GND. Each segment needs its own resistor; the popover sets one shared value.',id:'Sepuluh katoda disatukan jadi satu pin K: sambungkan K ke GND. Tiap segmen butuh resistor sendiri; popover mengatur satu nilai bersama.'},
 },
 inputs:[
  {type:'choice',key:'color',label:{en:'LED colour',id:'Warna LED'},options:[{value:'red',label:{en:'Red',id:'Merah'}},{value:'green',label:{en:'Green',id:'Hijau'}},{value:'yellow',label:{en:'Yellow',id:'Kuning'}},{value:'blue',label:{en:'Blue',id:'Biru'}}],default:'green'},
  {type:'range',key:'seriesOhms',label:{en:'Resistor per segment',id:'Resistor per segmen'},min:68,max:2200,step:1,unit:'ohm',default:220},
 ],
 defaults:{color:'green',seriesOhms:220},
 create(ctx){
  let st=empty();
  return {
   state:()=>st,
   update(f){
    const sib=ctx.siblings().find(m=>m.spec.kind==='resistor'&&m.props.seriesWith===ctx.id);
    const R=Math.max(1,num(sib?.props.ohms,num(ctx.props.seriesOhms,220)));
    const vf=BAR_VF[String(ctx.props.color)]??2.2;
    const kNet=ctx.net('K');
    const vk=kNet==='GND'?0:kNet===undefined?5:5*duty(kNet,f);
    const out:Record<string,number>={};
    let lit=0,level=0,run=true,total=0,over=false;
    for(let i=1;i<=BAR_SEGMENTS;i++){
     const d=duty(ctx.net('A'+i),f);
     const ma=d*Math.max(0,(5-vf-vk)/R)*1000;
     total+=ma;if(ma>BAR_MAX_MA)over=true;
     const on=ma>0.3;
     if(on)lit++;
     if(run&&on)level=i;else run=false;
     out['s'+i]=Math.min(1,ma/10);
    }
    st={...(out as unknown as LedBar10State),lit,level,totalMa:round1(total),over};
   },
  };
 },
});

function empty():LedBar10State{
 return {s1:0,s2:0,s3:0,s4:0,s5:0,s6:0,s7:0,s8:0,s9:0,s10:0,lit:0,level:0,totalMa:0,over:false};
}
