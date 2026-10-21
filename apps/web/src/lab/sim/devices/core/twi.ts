import type {AVRTWI,TWIEventHandler} from 'avr8js';
import type {I2cSlave} from '../types';

/** Routes avr8js TWI events to registered I2cSlave devices (ACKs only an address that exists). */
export class TwiBus implements TWIEventHandler{
 private slaves=new Map<number,I2cSlave>();
 private cur:I2cSlave|null=null;
 private repeated=false;
 constructor(private twi:AVRTWI){}
 attach(s:I2cSlave):void{this.slaves.set(s.address&0x7f,s);}
 start(repeated:boolean):void{this.repeated=repeated;if(!repeated)this.cur=null;this.twi.completeStart();}
 stop():void{this.cur?.onStop?.();this.cur=null;this.twi.completeStop();}
 connectToSlave(addr:number,write:boolean):void{
  const s=this.slaves.get(addr&0x7f)??null;
  this.cur=s;
  if(s)s.onStart?.(this.repeated,write);
  this.twi.completeConnect(!!s);
 }
 writeByte(value:number):void{this.twi.completeWrite(this.cur?this.cur.onWrite(value):false);}
 readByte(ack:boolean):void{this.twi.completeRead(this.cur?this.cur.onRead(ack)&0xff:0xff);}
}
