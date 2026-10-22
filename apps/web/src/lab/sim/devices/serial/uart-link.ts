/**
 * UartLink: the serial side of a module (HC-05, NEO-6M) on a board. Pure; shared by the uart parts only (not a device, not discovered).
 * Two ways to meet the sketch, chosen per direction from the wiring:
 *  - hardware: module RX on D1 / TX on D0. Bytes the sketch writes arrive from the USART tap; bytes to the sketch go to the USART RX
 *    (the avr8js USART shifts them at the sketch's own baud; we only pace the queue at the module's baud, one 10-bit frame each).
 *    The pin D0 rests HIGH and the same frame is drawn on it, so the pin monitor and analyzer show real start, data and stop bits.
 *  - software (SoftwareSerial style): any other board pin. Module RX decodes 8N1 from edges at the module's baud (so a wrong baud gives
 *    garbage, like a real bus); module TX drives the pin as start bit, 8 data bits LSB first, stop bit, cycle-exact.
 */
import type {DeviceCtx,Level,Pulse,UartTap} from '../types';
import {SIM_CLOCK_HZ} from '../../../contract';
import type {UnoPin} from '../../../contract';

export interface UartLinkCfg{
 ctx:DeviceCtx;
 /** Part pin names, from the MODULE's point of view: `rx` receives what the sketch sends, `tx` sends to the sketch. */
 rx:string;tx:string;
 /** Current module baud (read lazily). */
 baud:()=>number;
 /** A byte the sketch sent. */
 onByte:(byte:number,cycle:number)=>void;
}

export class UartLink{
 bytesIn=0;bytesOut=0;framingErrors=0;
 private readonly queue:number[]=[];
 private busy=false;
 private readonly edges:{c:number;l:Level}[]=[];
 private decoding=false;
 constructor(private readonly o:UartLinkCfg){
  const tx=this.txPin();
  // idle high on the line the module drives into the sketch (a UART line rests high)
  if(tx)o.ctx.env.setPin(tx,true);
 }
 private rxPin():UnoPin|null{return this.o.ctx.pin(this.o.rx);}
 private txPin():UnoPin|null{return this.o.ctx.pin(this.o.tx);}
 hwRx():boolean{return this.rxPin()==='D1';}
 hwTx():boolean{return this.txPin()==='D0';}
 /** 'hardware' | 'software' | 'none' for a direction. */
 modeRx():'hardware'|'software'|'none'{return this.hwRx()?'hardware':this.rxPin()?'software':'none';}
 modeTx():'hardware'|'software'|'none'{return this.hwTx()?'hardware':this.txPin()?'software':'none';}
 bitCycles():number{return Math.max(1,Math.round(SIM_CLOCK_HZ/Math.max(300,this.o.baud())));}
 /** Wire this to the model's `uart` hook. */
 tap():UartTap{return {onTx:(b,c)=>{if(this.hwRx()){this.bytesIn++;this.o.onByte(b&0xff,c);}}};}
 /** Wire this to the model's onPinChange (all pins; only the module RX pin matters, in software mode). */
 edge(pin:UnoPin,level:Level,cycle:number):void{
  if(pin!==this.rxPin()||this.hwRx())return;
  this.edges.push({c:cycle,l:level});
  if(this.edges.length>64)this.edges.splice(0,this.edges.length-64);
  if(!this.decoding&&level===0)this.startDecode(cycle);
 }
 private levelAt(t:number):Level{
  let l:Level=1;
  for(const e of this.edges){if(e.c<=t)l=e.l;else break;}
  return l;
 }
 private startDecode(t0:number):void{
  this.decoding=true;
  const bit=this.bitCycles();
  // judge the whole frame at the middle of the stop bit, from the recorded edges (exact even if the sketch toggles faster than the slice)
  this.o.ctx.schedule(Math.round(9.5*bit),()=>{
   let v=0;
   for(let i=0;i<8;i++)if(this.levelAt(t0+Math.round((1.5+i)*bit))===1)v|=1<<i;
   const stop=this.levelAt(t0+Math.round(9.5*bit));
   this.decoding=false;
   if(this.levelAt(t0+Math.round(0.5*bit))!==0||stop!==1){this.framingErrors++;this.resync(t0+Math.round(9.5*bit));return;}
   this.bytesIn++;this.o.onByte(v,t0+10*bit);
   this.resync(t0+Math.round(9.5*bit));
  });
 }
 /** After a frame, a falling edge already seen inside the stop bit starts the next one. */
 private resync(t:number):void{
  const next=this.edges.find(e=>e.c>t&&e.l===0);
  if(next&&!this.decoding)this.startDecode(next.c);
 }
 /** Queue bytes for the sketch (one frame at a time at the module's baud). */
 send(bytes:ArrayLike<number>):void{
  for(let i=0;i<bytes.length;i++)this.queue.push(bytes[i]!&0xff);
  this.pump();
 }
 get pending():number{return this.queue.length+(this.busy?1:0);}
 clear():void{this.queue.length=0;}
 private pump():void{
  if(this.busy)return;
  const b=this.queue.shift();
  if(b===undefined)return;
  this.busy=true;
  const bit=this.bitCycles(),frame=10*bit;
  const done=():void=>{this.busy=false;this.bytesOut++;this.pump();};
  const pin=this.txPin();
  // hardware mode: the byte goes straight into the USART (the sketch's own baud shifts it), and the same frame is also drawn on D0 so the pin monitor shows the real start, data and stop bits
  if(this.hwTx())this.o.ctx.uartSend(b);
  if(!pin){this.o.ctx.schedule(frame,done);return;}
  const bits:Level[]=[0];
  for(let i=0;i<8;i++)bits.push(((b>>i)&1)as Level);
  bits.push(1);
  const pulses:Pulse[]=[];
  for(const l of bits){
   const last=pulses[pulses.length-1];
   if(last&&last.level===l)last.holdCycles+=bit;else pulses.push({level:l,holdCycles:bit});
  }
  this.o.ctx.drive(pin,pulses,{onDone:this.hwTx()?()=>this.o.ctx.schedule(16,done):done});
 }
}
