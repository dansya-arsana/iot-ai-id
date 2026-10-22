import type {AVRTWI,TWIEventHandler} from 'avr8js';
import type {I2cSlave} from '../types';

/** Routes avr8js TWI events to registered I2cSlave devices (ACKs only an address that exists). */
export class TwiBus implements TWIEventHandler{
 private slaves:I2cSlave[]=[];
 private cur:I2cSlave|null=null;
 private repeated=false;
 /** Called once per bus event so the machine can show clock and data activity on A4/A5 (the bus itself is transaction-level). */
 onActivity:(()=>void)|null=null;
 /** Counters for the Test Record: completed transactions, addresses addressed, address NACKs. */
 transactions=0;nacks=0;readonly addresses=new Set<number>();
 constructor(private twi:AVRTWI){}
 /** Slaves are matched by their CURRENT address at every START, so a device whose address follows a popover or a wire (BME280 SDO, LCD jumpers) moves live. */
 attach(s:I2cSlave):void{this.slaves.push(s);}
 start(repeated:boolean):void{this.onActivity?.();this.repeated=repeated;if(!repeated)this.cur=null;this.twi.completeStart();}
 stop():void{this.onActivity?.();this.transactions++;this.cur?.onStop?.();this.cur=null;this.twi.completeStop();}
 connectToSlave(addr:number,write:boolean):void{
  this.onActivity?.();
  const s=this.slaves.find(x=>(x.address&0x7f)===(addr&0x7f))??null;
  this.cur=s;
  this.addresses.add(addr&0x7f);if(!s)this.nacks++;
  if(s)s.onStart?.(this.repeated,write);
  this.twi.completeConnect(!!s);
 }
 writeByte(value:number):void{this.onActivity?.();this.twi.completeWrite(this.cur?this.cur.onWrite(value):false);}
 readByte(ack:boolean):void{this.onActivity?.();this.twi.completeRead(this.cur?this.cur.onRead(ack)&0xff:0xff);}
}
