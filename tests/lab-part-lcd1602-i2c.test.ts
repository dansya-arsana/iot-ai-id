import test from 'node:test';
import assert from 'node:assert/strict';
import type {BoardPin,Circuit,UnoPin} from '../apps/web/src/lab/contract.js';
import {createModels} from '../apps/web/src/lab/sim/peripherals.js';

import type {Lcd1602I2cState} from '../apps/web/src/lab/sim/devices/lcd1602-i2c.js';
import type {I2cSlave} from '../apps/web/src/lab/sim/devices/types.js';

/** Minimal board: a clock with scheduled callbacks, pin logs and the shared-line / I2C / UART hooks. */
function fakeEnv(){
 const events:{at:number;cb:()=>void}[]=[];
 let now=0;
 const adc:number[]=[],log:{pin:UnoPin;level:boolean;at:number}[]=[],i2c:I2cSlave[]=[],uart:((b:number,c:number)=>void)[]=[],sent:number[]=[];
 return {adc,log,i2c,uart,sent,
  env:{
   setPin:(p:UnoPin,l:boolean)=>{log.push({pin:p,level:l,at:now});},setAdc:(_c:number,v:number)=>{adc.push(v);},
   schedule:(c:number,cb:()=>void)=>{events.push({at:now+c,cb});events.sort((a,b)=>a.at-b.at);},now:()=>now,
   watchLine:()=>undefined,attachI2c:(s:I2cSlave)=>{i2c.push(s);},tapUart:(cb:(b:number,c:number)=>void)=>{uart.push(cb);},uartSend:(b:number)=>{sent.push(b);},
  },
  at:(n:number)=>{now=n;},
  run(to:number){while(events.length&&events[0]!.at<=to){const e=events.shift()!;now=e.at;e.cb();}now=to;},
 };
}
const circuit=(net:Partial<Record<string,BoardPin>>,props:Record<string,string|number|boolean>={}):Circuit=>({wires:[],parts:[{id:'lcd1602-i2c1',kind:'lcd1602-i2c',net,props}]});


/** What LiquidCrystal_I2C does: each nibble is sent twice, E high then E low (the falling edge latches). */
function bench(){
 const f=fakeEnv();
 const m=createModels(circuit({SDA:'A4',SCL:'A5'}),f.env).get('lcd1602-i2c1')!;
 const bus=f.i2c[0]!;
 let bl=0x08;
 const put=(b:number)=>{bus.onStart!(false,true);bus.onWrite(b|bl);bus.onStop!();};
 const nib=(n:number,rs:number)=>{put((n<<4)|rs|4);put((n<<4)|rs);};
 const send=(b:number,rs:number)=>{nib(b>>4,rs);nib(b&15,rs);};
 const st=()=>{const s=m.state();assert.ok(s.kind==='ext');return (s as unknown as {v:Lcd1602I2cState}).v;};
 const init=()=>{nib(3,0);nib(3,0);nib(3,0);nib(2,0);send(0x28,0);send(0x0c,0);send(0x01,0);send(0x06,0);};
 const print=(t:string)=>{for(const ch of t)send(ch.charCodeAt(0),1);};
 return {bus,put,nib,send,st,init,print,setBl:(v:boolean)=>{bl=v?8:0;}};
}
test('lcd1602-i2c: answers at 0x27 and ACKs writes',()=>{
 const b=bench();assert.equal(b.bus.address,0x27);assert.equal(b.bus.onWrite(0),true);
});
test('lcd1602-i2c: blank until init, then prints through the real 4-bit protocol',()=>{
 const b=bench();
 b.print('X');assert.equal(b.st().line1,' '.repeat(16));   // controller still in 8-bit mode and display off
 const c=bench();c.init();
 assert.equal(c.st().display,true);
 c.print('Hello');
 assert.equal(c.st().line1,'Hello'.padEnd(16));
 c.send(0xc0,0);c.print('Row2');          // DDRAM 0x40
 assert.equal(c.st().line2,'Row2'.padEnd(16));
 assert.equal(c.st().chars,9);
});
test('lcd1602-i2c: clear, home, entry mode, DDRAM address',()=>{
 const b=bench();b.init();b.print('ABCD');
 b.send(0x02,0);b.print('z');assert.equal(b.st().line1.slice(0,4),'zBCD');   // home
 b.send(0x80|5,0);b.print('Q');assert.equal(b.st().line1[5],'Q');
 b.send(0x04,0);b.send(0x80|8,0);b.print('12');   // entry mode decrement: second char lands left
 assert.equal(b.st().line1.slice(7,9),'21');
 b.send(0x01,0);assert.equal(b.st().line1,' '.repeat(16));
});
test('lcd1602-i2c: backlight bit P3, cursor/blink flags, custom glyph',()=>{
 const b=bench();b.init();assert.equal(b.st().backlight,true);
 b.setBl(false);b.put(0);assert.equal(b.st().backlight,false);b.setBl(true);b.put(0);assert.equal(b.st().backlight,true);
 b.send(0x0f,0);assert.equal(b.st().cursor,true);assert.equal(b.st().blink,true);
 b.send(0x40,0);for(const r of [0,10,21,10,0,17,14,0])b.send(r,1);   // CGRAM glyph 0
 b.send(0x80,0);b.send(0,1);
 assert.equal(b.st().line1.charCodeAt(0),0);assert.equal(b.st().cg.slice(0,16),'000a150a00110e00');
});
test('lcd1602-i2c: read cycle returns address counter',()=>{
 const b=bench();b.init();b.print('abc');
 b.put(0x08|2|4);const hi=b.bus.onRead(true);b.put(0x08|2);b.put(0x08|2|4);const lo=b.bus.onRead(true);
 assert.equal(((hi>>4)<<4)|(lo>>4),3);
});
test('lcd1602-i2c: contrast and colour come from props',()=>{
 const f=fakeEnv();const m=createModels(circuit({SDA:'A4',SCL:'A5'},{color:'blue',contrast:30}),f.env).get('lcd1602-i2c1')!;
 const s=m.state();if(s.kind==='ext'){assert.equal(s.v.color,'blue');assert.equal(s.v.contrast,30);}
});

test('lcd1602-i2c: the backpack address is 0x27 by default and follows the popover to 0x3F, live',()=>{
 const f=fakeEnv();
 const m=createModels(circuit({SDA:'A4',SCL:'A5'}),f.env).get('lcd1602-i2c1')!;
 const bus=f.i2c[0]!;
 assert.equal(bus.address,0x27);
 m.props.address='0x3F';
 assert.equal(bus.address,0x3f,'the bus asks the device for its address at every START');
 const s=m.state();assert.ok(s.kind==='ext');if(s.kind==='ext')assert.equal(s.v.address,0x3f);
 m.props.address='0x27';assert.equal(bus.address,0x27);
});
test('lcd1602-i2c: the TWI bus matches the CURRENT address, so a sketch at the wrong address gets a NACK',async()=>{
 const {TwiBus}=await import('../apps/web/src/lab/sim/devices/core/twi.js');
 const calls:boolean[]=[];
 const twi={completeStart(){},completeStop(){},completeConnect:(ack:boolean)=>{calls.push(ack);},completeWrite(){},completeRead(){}};
 const bus=new TwiBus(twi as never);
 let addr=0x27;
 bus.attach({get address(){return addr;},onWrite:()=>true,onRead:()=>0});
 bus.connectToSlave(0x27,true);addr=0x3f;bus.connectToSlave(0x27,true);bus.connectToSlave(0x3f,true);
 assert.deepEqual(calls,[true,false,true]);
});
