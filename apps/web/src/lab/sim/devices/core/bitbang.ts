/**
 * Bit-bang helpers for buses that have no hardware peripheral in the ATmega328P: custom clocked two-wire buses (TM1637 key/segment
 * driver, HX711 load cell amplifier, 74HC595 style shifters) and the timing-critical single-wire WS2812 stream.
 * Both work from cycle-stamped pin edges, so they see exactly what a sketch's digitalWrite / port writes produce.
 * Pure: no DOM. Time is CPU cycles (16 per microsecond).
 */
import type {UnoPin} from '../../../contract';
import {us} from '../types';
import type {DeviceCtx,Level} from '../types';

// ---------- two-wire clocked bus (CLK from the MCU, one bidirectional open-drain data line) ----------
export interface TwoWireConfig{
 /** Part pin that carries the clock (always driven by the MCU). */
 clk:string;
 /** Part pin that carries data. Open drain: the slave only pulls it low or releases it (pull-up on the module). */
 data:string;
 /** Bit order of a byte on the wire. TM1637: LSB first (default true). HX711 data is MSB first but it is shifted OUT, see shiftOut(). */
 lsbFirst?:boolean;
 /** Bits per byte (default 8). */
 bits?:number;
 /**
  * 'start-stop' (default): framed like TM1637 and I2C. DATA falling while CLK is high is START, DATA rising while CLK is high is STOP;
  * bytes are only taken inside a frame.  'free': no framing, every `bits` rising clock edges form a byte (shift registers).
  */
 framing?:'start-stop'|'free';
 /** Drive the ACK low pulse on the 9th clock after each byte (TM1637 does; default false). */
 ack?:boolean;
}
export interface TwoWireHandlers{
 onStart?(cycle:number):void;
 /** A whole byte arrived. Return false to NACK (only used when `ack` is on). */
 onByte?(byte:number,cycle:number):boolean|void;
 onStop?(cycle:number):void;
}

/**
 * Slave side of a custom two-wire bus. Feed it every edge of the two wired pins from the device's `onPinChange`:
 *
 *   const bus=new TwoWireSlave(ctx,{clk:'CLK',data:'DIO',ack:true},{onByte:b=>{...}});
 *   return {state:()=>..., onPinChange:(p,l,c)=>bus.edge(p,l,c)};
 *
 * Reading from the slave (HX711 data, TM1637 key scan): arm `bus.shiftOut(bits,{on:'rising'})` and the next clock edges present the bits.
 */
export class TwoWireSlave{
 readonly clkPin:UnoPin|null;readonly dataPin:UnoPin|null;
 private clk:Level=0;private data:Level=1;
 private inFrame=false;
 private acc=0;private n=0;
 private ackPending=false;private ackHeld=false;
 private self=false;
 private out:{bits:readonly number[];i:number;on:'rising'|'falling';done?:(cycle:number)=>void}|null=null;
 private pulled=false;
 /** Counters a test or a state() can show. */
 starts=0;stops=0;bytes=0;clockEdges=0;
 constructor(private ctx:DeviceCtx,private cfg:TwoWireConfig,private h:TwoWireHandlers={}){
  this.clkPin=ctx.pin(cfg.clk);this.dataPin=ctx.pin(cfg.data);
  if(this.dataPin){ctx.line(this.dataPin,true);this.data=1;}
  this.inFrame=cfg.framing==='free';
 }
 /** True while the slave itself holds the data line low. */
 get holdingLow():boolean{return this.pulled||this.ackHeld;}
 private drive(level:Level):void{
  if(!this.dataPin)return;
  this.self=true;
  try{this.ctx.env.setPin(this.dataPin,level===1);}finally{this.self=false;}
  this.data=level;
 }
 /** Pull the data line low (true) or release it (false). HX711: low means "conversion ready". */
 pull(low:boolean):void{this.pulled=low;if(!this.ackHeld&&!this.out)this.drive(low?0:1);}
 /**
  * Present `bits` on the data line, one per clock edge of kind `on` (first bit at the first such edge), then release the line at the
  * next edge. `done` fires on that release edge. Bits are the exact levels (0/1), first bit first.
  */
 shiftOut(bits:readonly number[],o:{on?:'rising'|'falling';done?:(cycle:number)=>void}={}):void{
  this.out={bits,i:0,on:o.on??'rising',...(o.done?{done:o.done}:{})};
 }
 /** Stop a pending shiftOut and release the line. */
 cancelShift():void{this.out=null;if(!this.holdingLow)this.drive(1);}

 edge(pin:UnoPin,level:Level,cycle:number):void{
  if(pin===this.clkPin)this.onClock(level,cycle);
  else if(pin===this.dataPin&&!this.self)this.onData(level,cycle);
 }
 private onData(level:Level,cycle:number):void{
  const was=this.data;this.data=level;
  if(this.cfg.framing==='free'||this.clk!==1||was===level)return;
  if(level===0){this.inFrame=true;this.acc=0;this.n=0;this.ackPending=false;this.starts++;this.h.onStart?.(cycle);}
  else if(this.inFrame){this.inFrame=false;this.ackPending=false;this.stops++;this.h.onStop?.(cycle);}
 }
 private onClock(level:Level,cycle:number):void{
  if(this.clk===level)return;
  this.clk=level;this.clockEdges++;
  const kind=level===1?'rising':'falling';
  // slave to master: bits change on the configured edge
  const o=this.out;
  if(o&&o.on===kind&&!this.ackHeld){
   if(o.i<o.bits.length)this.drive(o.bits[o.i++]!==0?1:0);
   else{this.out=null;this.drive(this.pulled?0:1);o.done?.(cycle);}
  }
  if(!this.inFrame)return;
  const width=this.cfg.bits??8;
  if(level===1){
   if(this.ackPending)return;                  // 9th clock high: the ACK is on the line, the master only looks
   if(this.out)return;                         // the master is reading, not writing
   const bit=this.data;
   if(this.cfg.lsbFirst===false)this.acc=((this.acc<<1)|bit)&0xffff;else this.acc|=bit<<this.n;
   this.n++;
   if(this.n>=width){
    const byte=this.acc&((1<<width)-1);
    this.acc=0;this.n=0;this.bytes++;
    const ok=this.h.onByte?.(byte,cycle)!==false;
    if(this.cfg.ack)this.ackPending=ok;
   }
  }else if(this.ackPending){
   if(!this.ackHeld){this.ackHeld=true;this.drive(0);}      // falling edge of the 8th clock: ACK low
   else{this.ackHeld=false;this.ackPending=false;this.drive(this.pulled?0:1);}  // falling edge of the 9th clock: release
  }
 }
}

// ---------- WS2812 single-wire stream ----------
/** Datasheet timing of the WS2812B (nanoseconds). A bit is a high of T0H or T1H followed by the rest of a 1.25 us period; >50 us low latches. */
export const WS2812={T0H_NS:400,T1H_NS:800,TOLERANCE_NS:150,PERIOD_NS:1250,RESET_US:50,RESET_US_V5:280} as const;

export interface Ws2812Frame{
 /** one [r,g,b] (0-255) per LED, in chain order (the first LED took the first 24 bits) */
 pixels:[number,number,number][];
 /** bits received in the frame (24 per LED, and any partial trailing bits) */
 bits:number;
 /** high pulses outside both datasheet windows (T0H/T1H +-150 ns) */
 timingErrors:number;
 /** CPU cycle of the latch (the start of the reset gap) */
 cycle:number;
}
export interface Ws2812Options{
 /** LEDs in the chain; bits beyond 24 x count are dropped like the end of a real strip (default: keep everything). */
 count?:number;
 /** Low time that latches the frame, in microseconds (default 50; the newer V5 parts need 280). */
 resetUs?:number;
 /** Colour order of the 24 bits (default 'GRB', the WS2812B order). */
 order?:'GRB'|'RGB'|'BRG';
 /** Run `cb` after `cycles` CPU cycles (ctx.schedule). */
 schedule(cycles:number,cb:()=>void):void;
 onFrame(f:Ws2812Frame):void;
}

/**
 * Decodes a WS2812 data line from cycle-stamped edges. Feed it every edge of DIN (device `onPinChange`).
 * A bit is read from the width of the high pulse: shorter than 0.6 us is a 0, longer a 1. A low of at least `resetUs`
 * ends the frame; a frame is also latched when the line stays low after the last bit (nothing follows).
 */
export class Ws2812Decoder{
 private level:Level=0;
 private rise=-1;private fall=-1;
 private bits:number[]=[];
 private errors=0;
 /** Totals over the life of the decoder. */
 frames=0;totalBits=0;totalErrors=0;
 private readonly resetCycles:number;
 constructor(private o:Ws2812Options){this.resetCycles=us(o.resetUs??WS2812.RESET_US);}
 edge(level:Level,cycle:number):void{
  if(level===this.level)return;
  this.level=level;
  if(level===1){
   // a long enough low before this rising edge means the previous frame ended (when the scheduled check has not fired yet)
   if(this.fall>=0&&cycle-this.fall>=this.resetCycles)this.latch(this.fall);
   this.rise=cycle;
  }else if(this.rise>=0){
   const highNs=(cycle-this.rise)/us(1)*1000;
   const one=highNs>(WS2812.T0H_NS+WS2812.T1H_NS)/2;
   const nominal=one?WS2812.T1H_NS:WS2812.T0H_NS;
   if(Math.abs(highNs-nominal)>WS2812.TOLERANCE_NS)this.errors++;
   this.bits.push(one?1:0);
   this.fall=cycle;
   const mark=cycle;
   this.o.schedule(this.resetCycles,()=>{if(this.level===0&&this.fall===mark)this.latch(mark);});
  }
 }
 private latch(cycle:number):void{
  if(this.bits.length===0)return;
  const bits=this.bits,errors=this.errors;
  this.bits=[];this.errors=0;this.fall=-1;
  const leds=Math.floor(bits.length/24),keep=this.o.count===undefined?leds:Math.min(leds,this.o.count);
  const order=this.o.order??'GRB';
  const px:[number,number,number][]=[];
  for(let i=0;i<keep;i++){
   let a=0,b=0,c=0;
   for(let k=0;k<8;k++){a=(a<<1)|bits[i*24+k]!;b=(b<<1)|bits[i*24+8+k]!;c=(c<<1)|bits[i*24+16+k]!;}
   px.push(order==='GRB'?[b,a,c]:order==='RGB'?[a,b,c]:[b,c,a]);
  }
  this.frames++;this.totalBits+=bits.length;this.totalErrors+=errors;
  this.o.onFrame({pixels:px,bits:bits.length,timingErrors:errors,cycle});
 }
}
