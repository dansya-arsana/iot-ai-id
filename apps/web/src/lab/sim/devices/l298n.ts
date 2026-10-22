/**
 * L298N (dual full H-bridge module, protocol pwm). ENA/ENB enable a bridge (PWM on them sets speed); IN1/IN2 and IN3/IN4 set direction.
 * Truth table per bridge (datasheet): EN low -> outputs off (free-running coast); EN high: IN=10 forward, IN=01 reverse, IN=00 or 11 -> fast brake (both low-side or high-side switches, no drive).
 * The bipolar output stage drops about 2 V in total (VCEsat of the source and the sink), so a 9 V supply gives about 7 V at the motor.
 * Duty on IN pins is also honoured (average output = EN duty * (IN_a duty - IN_b duty)). An unwired EN pin means the board jumper is fitted (enabled).
 * Part-to-part wires: OUT1..OUT4 are real pins. Wire OUT1/OUT2 to a motor and the net solver gives the motor the average voltage the bridge drives
 * (EN duty x IN duty x (VS - 2 V)); EN low floats the outputs (coast), both inputs equal short them together (brake). VS comes from the VS pin when it is wired.
 * Pair: scene/parts/l298n.ts. Guide: docs/lab-extending.md
 */
import {defineDevice,num,round1} from './types';
import type {PinDrive} from './types';
import {duty} from './core/util';

export const L298N_DROP_V=2;
export type BridgeMode='forward'|'reverse'|'brake'|'coast';

export type L298nState={
 modeA:string;modeB:string;dutyA:number;dutyB:number;
 /** average voltage across OUT1-OUT2 / OUT3-OUT4, signed (+ = forward) */
 outAV:number;outBV:number;vs:number;
 /** motor supply is too low for the 5 V regulator/logic or outside 5-35 V */supplyOk:boolean;
};

function bridge(en:number,a:number,b:number,vs:number):{mode:BridgeMode;v:number;mag:number}{
 if(en<0.02)return {mode:'coast',v:0,mag:0};
 const diff=a-b;
 if(Math.abs(diff)<0.02)return {mode:'brake',v:0,mag:0};
 const eff=Math.max(0,vs-L298N_DROP_V);
 const mag=Math.min(1,en*Math.abs(diff));
 return {mode:diff>0?'forward':'reverse',v:Math.sign(diff)*eff*mag,mag};
}

export const device=defineDevice<L298nState>({
 kind:'l298n',protocol:'pwm',
 // the first seven pins are the logic header (they plug into the breadboard); OUT1-4, VS and V5 are screw terminals (wires only)
 pins:['ENA','IN1','IN2','IN3','IN4','ENB','GND','OUT1','OUT2','OUT3','OUT4','VS','V5'],holes:[0,1,2,3,4,5,6],bodyX:[-14,29],
 power:{rail:['VS','GND'],min:5,max:35,ma:2000,external:true},
 copy:{
  name:{en:'L298N motor driver (dual H-bridge)',id:'Driver motor L298N (H-bridge ganda)'},
  desc:{en:'Drives two DC motors. IN pins pick the direction, EN pins switch each side on and PWM on EN sets the speed. It loses about 2 V as heat.',id:'Menggerakkan dua motor DC. Pin IN memilih arah, pin EN menyalakan tiap sisi dan PWM pada EN mengatur kecepatan. Sekitar 2 V terbuang sebagai panas.'},
  note:{en:'Wire OUT1 and OUT2 to a DC motor and give VS its own supply (a battery). Remove the EN jumper to use PWM.',id:'Kabelkan OUT1 dan OUT2 ke motor DC dan beri VS catu sendiri (baterai). Lepas jumper EN agar bisa PWM.'},
 },
 inputs:[{type:'range',key:'vs',label:{en:'Motor supply (VS)',id:'Catu motor (VS)'},min:5,max:35,step:0.5,unit:'V',default:9}],
 defaults:{vs:9},
 create(ctx){
  let st:L298nState={modeA:'coast',modeB:'coast',dutyA:0,dutyB:0,outAV:0,outBV:0,vs:9,supplyOk:true};
  const en=(n:string,f:Parameters<typeof duty>[1]):number=>ctx.net(n)===undefined?1:duty(ctx.net(n),f);
  // average voltage on each output pin, null = floating (EN low)
  const out:Record<string,number|null>={OUT1:null,OUT2:null,OUT3:null,OUT4:null};
  const pin=(e:number,a:number,eff:number):number|null=>e<0.02?null:e*a*eff;
  return {
   state:()=>st,
   output:(p):PinDrive|null=>{const v=out[p];return v===undefined||v===null?null:{volts:v,ohms:2};},
   update(f){
    // VS: the wired supply when there is one, else the popover value
    const vsNet=ctx.volts('VS');
    const vs=vsNet!==null?vsNet-(ctx.volts('GND')??0):num(ctx.props.vs,9);
    const eA=en('ENA',f),eB=en('ENB',f),a1=duty(ctx.net('IN1'),f),a2=duty(ctx.net('IN2'),f),b1=duty(ctx.net('IN3'),f),b2=duty(ctx.net('IN4'),f);
    const A=bridge(eA,a1,a2,vs);
    const B=bridge(eB,b1,b2,vs);
    const eff=Math.max(0,vs-L298N_DROP_V);
    out.OUT1=pin(eA,a1,eff);out.OUT2=pin(eA,a2,eff);out.OUT3=pin(eB,b1,eff);out.OUT4=pin(eB,b2,eff);
    st={modeA:A.mode,modeB:B.mode,dutyA:Math.round(A.mag*100)/100,dutyB:Math.round(B.mag*100)/100,outAV:round1(A.v),outBV:round1(B.v),vs,supplyOk:vs>=7&&vs<=35};
   },
  };
 },
});
