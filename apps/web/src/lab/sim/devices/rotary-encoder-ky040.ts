/**
 * ROTARY-ENCODER-KY040 (protocol switch): incremental rotary encoder (EC11 class, 20 detents per turn) with a push switch, on the
 * common 5-pin module that carries 10 kohm pull-ups on CLK, DT and SW. Written from the public behaviour of this part.
 * Quadrature, one detent = one full Gray cycle. At rest CLK (A) and DT (B) are both HIGH (contacts open, pulled up).
 *  - Clockwise:        CLK falls, DT falls, CLK rises, DT rises   (A leads B, so on a CLK edge DT differs from CLK).
 *  - Counter-clockwise: DT falls, CLK falls, DT rises, CLK rises   (B leads A).
 * SW is a contact to GND: LOW while the shaft is pushed. Optional contact bounce adds a short glitch after the first edge of each track.
 * The shaft is turned from the popover (position in detents; a change plays every detent between the old and the new value in order,
 * each detent taking about 10 ms of transitions plus a short gap) and pushed by clicking the knob (a momentary button input).
 * Pair: scene/parts/rotary-encoder-ky040.ts (3D). Guide: docs/lab-extending.md
 */
import {defineDevice,clamp,num,us} from './types';
import {uno} from './core/util';

export type RotaryEncoderKy040State={position:number;angle:number;clk:boolean;dt:boolean;sw:boolean;pressed:boolean;moving:boolean;steps:number;detents:number};
export const ENCODER={detents:20,transitionUs:2500,gapUs:5000,bounceUs:[40,90] as const,maxPos:60} as const;

export const device=defineDevice<RotaryEncoderKy040State>({
 kind:'rotary-encoder-ky040',protocol:'switch',
 // module header order: CLK, DT, SW, +, GND
 pins:['CLK','DT','SW','+','GND'],holes:[0,1,2,3,4],bodyX:[-10,20.2],
 copy:{
  name:{en:'Rotary encoder (KY-040)',id:'Rotary encoder (KY-040)'},
  desc:{en:'A knob that clicks through 20 detents per turn. CLK and DT make two square waves a quarter cycle apart; which one leads tells you the direction. Pushing the knob closes SW.',id:'Kenop yang berklik melewati 20 detent per putaran. CLK dan DT membuat dua gelombang kotak berselisih seperempat siklus; siapa yang mendahului menunjukkan arah. Menekan kenop menutup SW.'},
  note:{en:'Click the knob to push it. Change the position in the panel to turn it.',id:'Klik kenop untuk menekannya. Ubah posisi di panel untuk memutarnya.'},
 },
 power:{rail:['+','GND'],min:3,max:5.5,ma:1},
 inputs:[
  {type:'range',key:'position',label:{en:'Shaft position (detents, 20 = one turn)',id:'Posisi poros (detent, 20 = satu putaran)'},min:0,max:ENCODER.maxPos,step:1,default:0},
  {type:'toggle',key:'pressed',label:{en:'Knob pushed (SW)',id:'Kenop ditekan (SW)'},default:false},
  {type:'toggle',key:'bounce',label:{en:'Contact bounce',id:'Pantulan kontak'},default:false},
 ],
 defaults:{position:0,pressed:false,bounce:false},
 create(ctx){
  const clk=uno(ctx.net('CLK')),dt=uno(ctx.net('DT')),swp=uno(ctx.net('SW'));
  let pos=clamp(Math.round(num(ctx.props.position,0)),0,ENCODER.maxPos);
  let a=true,b=true,swLevel:boolean|null=null,held=false,busy=false,dir=0,done=0,steps=0;
  const set=(pin:typeof clk,lv:boolean):void=>{if(pin)ctx.env.setPin(pin,lv);};
  const bounce=():boolean=>ctx.props.bounce===true;
  const edge=(which:'a'|'b',lv:boolean):void=>{
   if(which==='a')a=lv;else b=lv;
   const pin=which==='a'?clk:dt;
   set(pin,lv);
   if(bounce()){ // the wiper skips back for a moment, then lands
    ctx.schedule(us(ENCODER.bounceUs[0]),()=>set(pin,!lv));
    ctx.schedule(us(ENCODER.bounceUs[1]),()=>set(pin,lv));
   }
  };
  const syncSw=():boolean=>{
   const down=held||ctx.props.pressed===true;
   if(down!==swLevel){set(swp,!down);swLevel=down;}
   return down;
  };
  set(clk,true);set(dt,true);syncSw();
  const target=():number=>clamp(Math.round(num(ctx.props.position,pos)),0,ENCODER.maxPos);
  // CW order A,B,A,B ; CCW order B,A,B,A. Levels follow 11 -> 01 -> 00 -> 10 -> 11 (CW).
  const SEQ:{cw:readonly ['a'|'b',boolean][]}={cw:[['a',false],['b',false],['a',true],['b',true]]};
  const startStep=():void=>{
   const d=target()-pos;
   if(busy||d===0)return;
   busy=true;dir=d>0?1:-1;done=0;
   const seq=SEQ.cw.map(([w,l])=>[dir>0?w:(w==='a'?'b':'a'),l] as ['a'|'b',boolean]);
   seq.forEach(([w,l],i)=>{
    ctx.schedule(us(ENCODER.transitionUs)*i,()=>{
     edge(w,l);done=i+1;
     if(i===3){pos+=dir;steps++;ctx.schedule(us(ENCODER.gapUs),()=>{busy=false;dir=0;done=0;startStep();});}
    });
   });
  };
  const poll=():void=>{syncSw();startStep();};
  return {
   state:()=>{
    const down=syncSw();
    const frac=busy?(Math.min(done,4)/4)*dir:0;
    return {position:pos,angle:Math.round((pos+frac)*(360/ENCODER.detents)*100)/100,clk:a,dt:b,sw:!down,pressed:down,moving:busy,steps,detents:ENCODER.detents};
   },
   setInput(i){if(i.kind==='button'){held=i.pressed;syncSw();}},
   tick(){poll();},
  };
 },
});
