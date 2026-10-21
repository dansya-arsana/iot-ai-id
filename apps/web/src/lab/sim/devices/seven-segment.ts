/**
 * SEVEN-SEGMENT (single digit, 0.56in, common cathode, protocol gpio): eight LEDs (a-g and the decimal point dp) share one
 * cathode pin COM. The sketch drives each anode through its own series resistor; a segment lights when its pin is HIGH and COM sits at ground.
 * Current per segment = (Vpin - Vf - Vcom) / R, averaged over PWM duty, with a typical forward drop per LED colour.
 * Written from public behaviour (generic 5161AS-style digit). Pair: scene/parts/seven-segment.ts. Guide: docs/lab-extending.md
 */
import {defineDevice,num,round1} from './types';
import {duty} from './core/util';

export const SEGMENTS=['a','b','c','d','e','f','g','dp'] as const;
export type Segment=(typeof SEGMENTS)[number];
/** Typical forward voltage per colour at ~10 mA (V). */
export const SEG_VF:Record<string,number>={red:2.0,green:2.2,yellow:2.1,blue:3.0};
/** Datasheet continuous current for a 0.56in digit is about 20 mA; above this the part is stressed. */
export const SEG_MAX_MA=20;

export type SevenSegmentState={
 a:number;b:number;c:number;d:number;e:number;f:number;g:number;dp:number;
 ma_a:number;ma_b:number;ma_c:number;ma_d:number;ma_e:number;ma_f:number;ma_g:number;ma_dp:number;
 totalMa:number;over:boolean;/** digit shown, '0'..'9' when the lit pattern matches a glyph, '' otherwise */glyph:string;
};

/** Glyph table: segments a..g as a bit string, index 0 = a. */
const GLYPHS:Record<string,string>={'0':'1111110','1':'0110000','2':'1101101','3':'1111001','4':'0110011','5':'1011011','6':'1011111','7':'1110000','8':'1111111','9':'1111011'};
const glyphOf=(lit:boolean[]):string=>{
 const bits=lit.slice(0,7).map(v=>v?'1':'0').join('');
 return Object.entries(GLYPHS).find(([,p])=>p===bits)?.[0]??'';
};

export const device=defineDevice<SevenSegmentState>({
 kind:'seven-segment',protocol:'gpio',
 pins:['a','b','c','d','e','f','g','dp','COM'],holes:[0,1,2,3,4,5,6,7,8],bodyX:[-1,21.3],
 copy:{
  name:{en:'7-segment digit (0.56 in, common cathode)',id:'Digit 7-segmen (0,56 in, katoda bersama)'},
  desc:{en:'One digit made of eight LEDs, a to g plus the decimal point. Tie COM to ground, add a resistor to each segment and drive a segment pin HIGH to light it.',id:'Satu digit dari delapan LED, a sampai g dan titik desimal. Hubungkan COM ke ground, beri resistor di tiap segmen, lalu beri HIGH pada pin segmen untuk menyalakannya.'},
  note:{en:'Each segment needs its own resistor. The pins lie in one row here; the real digit straddles the breadboard groove.',id:'Tiap segmen butuh resistornya sendiri. Di sini pin dalam satu baris; digit asli melintangi alur breadboard.'},
 },
 inputs:[
  {type:'choice',key:'color',label:{en:'LED colour',id:'Warna LED'},options:[{value:'red',label:{en:'Red',id:'Merah'}},{value:'green',label:{en:'Green',id:'Hijau'}},{value:'yellow',label:{en:'Yellow',id:'Kuning'}},{value:'blue',label:{en:'Blue',id:'Biru'}}],default:'red'},
  {type:'range',key:'seriesOhms',label:{en:'Resistor per segment',id:'Resistor per segmen'},min:68,max:2200,step:1,unit:'ohm',default:220},
 ],
 defaults:{color:'red',seriesOhms:220},
 create(ctx){
  let st:SevenSegmentState=emptyState();
  return {
   state:()=>st,
   update(f){
    const sib=ctx.siblings().find(m=>m.spec.kind==='resistor'&&m.props.seriesWith===ctx.id);
    const R=Math.max(1,num(sib?.props.ohms,num(ctx.props.seriesOhms,220)));
    const vf=SEG_VF[String(ctx.props.color)]??2.0;
    // COM: the ground rail, or a board pin that is an output (its voltage is 5 V times its duty)
    const comNet=ctx.net('COM');
    const vcom=comNet==='GND'?0:comNet===undefined?5:5*duty(comNet,f);
    const lit:boolean[]=[],out:Record<string,number>={};
    let total=0,over=false;
    for(const s of SEGMENTS){
     const d=duty(ctx.net(s),f);
     const i=d*Math.max(0,(5-vf-vcom)/R);
     const ma=round1(i*1000);
     lit.push(ma>0.3);total+=i*1000;
     if(i*1000>SEG_MAX_MA)over=true;
     out[s]=Math.min(1,i/0.010);out['ma_'+s]=ma;
    }
    st={...(out as unknown as SevenSegmentState),totalMa:round1(total),over,glyph:glyphOf(lit)};
   },
  };
 },
});

function emptyState():SevenSegmentState{
 return {a:0,b:0,c:0,d:0,e:0,f:0,g:0,dp:0,ma_a:0,ma_b:0,ma_c:0,ma_d:0,ma_e:0,ma_f:0,ma_g:0,ma_dp:0,totalMa:0,over:false,glyph:''};
}
