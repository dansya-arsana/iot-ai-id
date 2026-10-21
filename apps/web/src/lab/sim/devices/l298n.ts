/**
 * L298N (dual full H-bridge module, protocol pwm). ENA/ENB enable a bridge (PWM on them sets speed); IN1/IN2 and IN3/IN4 set direction.
 * Truth table per bridge (datasheet): EN low -> outputs off (free-running coast); EN high: IN=10 forward, IN=01 reverse, IN=00 or 11 -> fast brake (both low-side or high-side switches, no drive).
 * The bipolar output stage drops about 2 V in total (VCEsat of the source and the sink), so a 9 V supply gives about 7 V at the motor.
 * Duty on IN pins is also honoured (average output = EN duty * (IN_a duty - IN_b duty)). An unwired EN pin means the board jumper is fitted (enabled).
 * The platform has no part-to-part motor link, so the device exposes the output voltages in its state and the part draws them.
 * Pair: scene/parts/l298n.ts. Guide: docs/lab-extending.md
 */
import {defineDevice,num,round1} from './types';
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
 pins:['ENA','IN1','IN2','IN3','IN4','ENB','GND'],holes:[0,1,2,3,4,5,6],bodyX:[-14,29],
 copy:{
  name:{en:'L298N motor driver (dual H-bridge)',id:'Driver motor L298N (H-bridge ganda)'},
  desc:{en:'Drives two DC motors. IN pins pick the direction, EN pins switch each side on and PWM on EN sets the speed. It loses about 2 V as heat.',id:'Menggerakkan dua motor DC. Pin IN memilih arah, pin EN menyalakan tiap sisi dan PWM pada EN mengatur kecepatan. Sekitar 2 V terbuang sebagai panas.'},
  note:{en:'The scene has no motor link yet, so read the output voltage in the state. Remove the EN jumper to use PWM.',id:'Belum ada tautan motor di scene, jadi lihat tegangan keluaran pada state. Lepas jumper EN agar bisa PWM.'},
 },
 inputs:[{type:'range',key:'vs',label:{en:'Motor supply (VS)',id:'Catu motor (VS)'},min:5,max:35,step:0.5,unit:'V',default:9}],
 defaults:{vs:9},
 create(ctx){
  let st:L298nState={modeA:'coast',modeB:'coast',dutyA:0,dutyB:0,outAV:0,outBV:0,vs:9,supplyOk:true};
  const en=(n:string,f:Parameters<typeof duty>[1]):number=>ctx.net(n)===undefined?1:duty(ctx.net(n),f);
  return {
   state:()=>st,
   update(f){
    const vs=num(ctx.props.vs,9);
    const A=bridge(en('ENA',f),duty(ctx.net('IN1'),f),duty(ctx.net('IN2'),f),vs);
    const B=bridge(en('ENB',f),duty(ctx.net('IN3'),f),duty(ctx.net('IN4'),f),vs);
    st={modeA:A.mode,modeB:B.mode,dutyA:Math.round(A.mag*100)/100,dutyB:Math.round(B.mag*100)/100,outAV:round1(A.v),outBV:round1(B.v),vs,supplyOk:vs>=7&&vs<=35};
   },
  };
 },
});
