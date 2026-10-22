import type {AVRSPI} from 'avr8js';
import type {UnoPin} from '../../../contract';
import type {Level,SpiBinding} from '../types';

/**
 * Routes avr8js AVRSPI bytes to the slaves whose chip select is active. A slave without CS is always selected.
 * With no selected slave the bus floats high (0xFF is read), like a real MISO line with its pull-up.
 * Every selected slave receives the byte; if two are selected at once the first one registered answers (a real board would get a bus fight).
 */
export class SpiBus{
 private slaves:SpiBinding[]=[];
 /** Called once per byte with the transfer length in cycles, so the machine can show SCK activity on D13. */
 onActivity:((cycles:number)=>void)|null=null;
 /** Bytes seen, and bytes that no slave answered (nothing selected). */
 bytes=0;unanswered=0;
 constructor(private spi:AVRSPI,private csLevel:(pin:UnoPin)=>Level,private now:()=>number,private schedule:(cycles:number,cb:()=>void)=>void){
  spi.onByte=(value:number)=>this.byte(value);
 }
 attach(s:SpiBinding):void{this.slaves.push(s);}
 private byte(mosi:number):void{
  const {spi}=this;
  this.bytes++;
  let miso=0xff;
  if(spi.isMaster){
   const info={mode:spi.spiMode,lsbFirst:spi.dataOrder==='lsbFirst',clockHz:spi.spiFrequency,cycle:this.now()};
   const sel=this.slaves.filter(s=>s.csPin===null||this.csLevel(s.csPin)===(s.activeLow?0:1));
   if(sel.length){const r=sel.map(s=>s.transfer(mosi&0xff,info)&0xff);miso=r[0]!;}else this.unanswered++;
  }
  this.onActivity?.(spi.transferCycles);
  this.schedule(spi.transferCycles,()=>spi.completeTransfer(miso));
 }
}
