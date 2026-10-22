/**
 * ULN2003-DRIVER (the common blue stepper driver board, protocol 'gpio'): a ULN2003A Darlington array with four inputs
 * (IN1-IN4) and a five-pin socket for the 28BYJ-48 plug. Each input switches the matching output (OUT1-OUT4) to ground
 * through a Darlington pair (datasheet: VCE(sat) about 0.9 V at 100-350 mA); an off channel is open (high impedance).
 * Pin 5 of the socket (COM) is the motor supply (the board's + pin), which the coils return to. The board LEDs A-D follow the outputs.
 * The outputs are real pins: wire OUT1-OUT4 and COM to the 28BYJ-48 and the net solver gives the motor its coil voltages.
 * In addition every input edge is time-stamped in CPU cycles on a small bus (coilBus) that a stepper wired to this board reads,
 * so a 1 ms step sequence is not lost between two simulation slices.
 * Pair: scene/parts/uln2003-driver.ts. Guide: docs/lab-extending.md
 */
import {defineDevice} from './types';
import type {PinDrive} from './types';
import {SIM_CLOCK_HZ} from '../../contract';
import type {UnoPin} from '../../contract';

/** Saturation voltage of one ULN2003A channel with a stepper coil on it (datasheet: 0.9 V typ at 100 mA). */
export const ULN_VCE_SAT=0.9;
/** Below this supply the Darlington pairs and the motor do nothing useful. */
export const ULN_MIN_SUPPLY=3.5;
const SIGNALS=['IN1','IN2','IN3','IN4'] as const;
const OUTS=['OUT1','OUT2','OUT3','OUT4'] as const;

/** One change of the output mask (bit k = OUT(k+1) conducts), stamped in seconds of simulated time. */
export interface CoilEvent{t:number;mask:number}
/** Event queue of one driver. A stepper that wires to it sets `listening`; it drains `queue` each slice. */
export interface CoilBus{queue:CoilEvent[];listening:boolean;/** events dropped because nobody drained the queue */dropped:number}
const BUSES=new WeakMap<object,Map<string,CoilBus>>();
/** The bus of driver `id` inside one board environment (created on first use, so creation order does not matter). */
export function coilBus(env:object,id:string):CoilBus{
 let m=BUSES.get(env);
 if(!m){m=new Map();BUSES.set(env,m);}
 let b=m.get(id);
 if(!b){b={queue:[],listening:false,dropped:0};m.set(id,b);}
 return b;
}
const QUEUE_MAX=8192;

export type Uln2003State={
 /** bit k = input INk+1 is high */inMask:number;
 /** bit k = output OUTk+1 pulls to ground (needs a powered board) */outMask:number;
 supplyV:number;powered:boolean;/** input edges seen */edges:number;
};

export const device=defineDevice<Uln2003State>({
 kind:'uln2003-driver',protocol:'gpio',
 // the six-pin header plugs into the breadboard; OUT1-OUT4 and COM are the five contacts of the motor socket (wires only)
 pins:['IN1','IN2','IN3','IN4','-','+','OUT1','OUT2','OUT3','OUT4','COM'],holes:[0,1,2,3,4,5],bodyX:[-3,35],
 power:{rail:['+','-'],min:4.5,max:12,ma:240},
 copy:{
  name:{en:'ULN2003 stepper driver board',id:'Papan driver stepper ULN2003'},
  desc:{en:'Four switches that sink the current of a stepper coil. A high on IN1-IN4 pulls the matching output to ground, and a LED shows which coil is on. The motor plug takes its power from the + pin.',id:'Empat saklar yang menyerap arus kumparan stepper. High pada IN1-IN4 menarik keluaran yang sesuai ke ground, dan LED menandai kumparan yang menyala. Colokan motor mendapat daya dari pin +.'},
  note:{en:'Wire + and - to a 5 V supply that can give 250 mA, then the five motor wires to the 28BYJ-48. The 4 inputs go to four free pins.',id:'Hubungkan + dan - ke catu 5 V yang kuat 250 mA, lalu lima kabel motor ke 28BYJ-48. Empat input ke empat pin yang bebas.'},
 },
 inputs:[],
 create(ctx){
  const bus=coilBus(ctx.env,ctx.id);
  const level=[false,false,false,false];
  const boardPin=SIGNALS.map(n=>ctx.pin(n));
  for(let k=0;k<4;k++){const p=boardPin[k];if(p)level[k]=ctx.pinLevel(p)===1;}
  let powered=false,supplyV=0,edges=0,vPlus:number|null=null,vMinus:number|null=null;
  const isHigh=(k:number):boolean=>{
   const n=ctx.net(SIGNALS[k]!);
   return n==='5V'||n==='VIN'?true:n==='GND'?false:level[k]!;
  };
  const inMask=():number=>[0,1,2,3].reduce((m,k)=>m|(isHigh(k)?1<<k:0),0);
  const outMask=():number=>powered?inMask():0;
  return {
   state:()=>({inMask:inMask(),outMask:outMask(),supplyV:Math.round(supplyV*100)/100,powered,edges}),
   onPinChange(pin:UnoPin,lv,cycle){
    let hit=false;
    for(let k=0;k<4;k++)if(boardPin[k]===pin){level[k]=lv===1;hit=true;}
    if(!hit)return;
    edges++;
    if(!bus.listening)return;
    if(bus.queue.length>=QUEUE_MAX){bus.queue.shift();bus.dropped++;}
    bus.queue.push({t:cycle/SIM_CLOCK_HZ,mask:outMask()});
   },
   output(pin):PinDrive|null{
    if(!powered||vMinus===null||vPlus===null)return null;
    if(pin==='COM')return {volts:vPlus,ohms:0.2};
    const k=(OUTS as readonly string[]).indexOf(pin);
    return k>=0&&isHigh(k)?{volts:vMinus+ULN_VCE_SAT,ohms:1}:null;
   },
   update(){
    vPlus=ctx.volts('+');vMinus=ctx.volts('-');
    supplyV=vPlus!==null&&vMinus!==null?vPlus-vMinus:0;
    const was=powered;
    powered=supplyV>=ULN_MIN_SUPPLY;
    // a supply that appears or vanishes changes the coils without an input edge: tell the bus
    if(was!==powered&&bus.listening)bus.queue.push({t:ctx.env.now()/SIM_CLOCK_HZ,mask:outMask()});
   },
  };
 },
});
