import test from 'node:test';
import assert from 'node:assert/strict';
import type {BoardPin,Circuit,UnoPin} from '../apps/web/src/lab/contract.js';
import {createModels} from '../apps/web/src/lab/sim/peripherals.js';

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
const circuit=(net:Partial<Record<string,BoardPin>>,props:Record<string,string|number|boolean>={}):Circuit=>({wires:[],parts:[{id:'oled-ssd13061',kind:'oled-ssd1306',net,props}]});

function setup(props:Record<string,string|number|boolean>={}){
 const f=fakeEnv();
 const m=createModels(circuit({SDA:'A4',SCL:'A5'},props),f.env).get('oled-ssd13061')!;
 const bus=f.i2c[0]!;
 const send=(ctl:number,bytes:number[])=>{bus.onStart!(false,true);bus.onWrite(ctl);for(const b of bytes)bus.onWrite(b);bus.onStop!();};
 const cmd=(...b:number[])=>send(0x00,b);
 const fb=()=>{const s=m.state();if(s.kind!=='ext')throw new Error('state');return s.v.fb as string;};
 const px=(x:number,y:number)=>(parseInt(fb().substr(((y>>3)*128+x)*2,2),16)>>(y&7))&1;
 cmd(0xa1,0xc8);   // the standard init: upright orientation of the module glass
 return {bus,send,cmd,fb,px,m};
}
test('oled-ssd1306: address 0x3C, dark until display-on',()=>{
 const o=setup();
 assert.equal(o.bus.address,0x3c);
 o.cmd(0x20,0x00,0x21,0,127,0x22,0,7);
 o.send(0x40,[0xff]);
 assert.equal(o.px(0,0),0);
 o.cmd(0xaf);
 assert.equal(o.px(0,0),1);assert.equal(o.px(0,7),1);assert.equal(o.px(0,8),0);
});
test('oled-ssd1306: horizontal mode wraps column then page, window honoured',()=>{
 const o=setup();
 o.cmd(0xaf,0x20,0x00,0x21,10,11,0x22,1,2);
 o.send(0x40,[1,2,3,4,5]);   // (10,p1) (11,p1) (10,p2) (11,p2) then wraps to (10,p1)
 assert.equal(o.px(10,8),1);assert.equal(o.px(10,9),0);assert.equal(o.px(10,10),1);   // byte 5 (0b101) overwrote byte 1 at (10,p1)
 assert.equal(o.px(11,9),1);                                        // byte 2 = 0b10
 assert.equal(o.px(10,16),1);assert.equal(o.px(10,17),1);          // byte 3 = 0b11
});
test('oled-ssd1306: page mode with set page and column nibbles; vertical mode',()=>{
 const o=setup();
 o.cmd(0xaf,0xb3,0x05,0x11);   // page 3, column 0x15
 o.send(0x40,[0x01]);
 assert.equal(o.px(0x15,24),1);
 const v=setup();
 v.cmd(0xaf,0x20,0x01,0x21,0,1,0x22,0,1);
 v.send(0x40,[0x01,0x01,0x01]);   // (0,p0) (0,p1) (1,p0)
 assert.equal(v.px(0,0),1);assert.equal(v.px(0,8),1);assert.equal(v.px(1,0),1);assert.equal(v.px(1,8),0);
});
test('oled-ssd1306: Co=1 control bytes interleave commands and data; invert, off, contrast, remap',()=>{
 const o=setup();
 o.bus.onStart!(false,true);
 o.bus.onWrite(0x80);o.bus.onWrite(0xaf);   // Co=1 command
 o.bus.onWrite(0xc0);o.bus.onWrite(0x00);   // Co=1 data? no: control 0xc0 = Co,D/C -> one data byte
 o.bus.onStop!();
 assert.equal(o.px(0,0),0);                  // data byte 0x00 written at (0,0)
 o.send(0x40,[0x01]);assert.equal(o.px(1,0),1);
 o.cmd(0xa7);assert.equal(o.px(1,0),0);assert.equal(o.px(0,0),1);assert.equal(o.px(5,5),1);
 o.cmd(0xa6,0xa0);assert.equal(o.px(126,0),1);assert.equal(o.px(1,0),0);   // A0: mirrored left-right
 o.cmd(0x81,0x10);const s=o.m.state();if(s.kind==='ext')assert.equal(s.v.contrast,0x10);
 o.cmd(0xa5);assert.equal(o.px(60,30),1);
 o.cmd(0xae);assert.equal(o.px(60,30),0);
});
test('oled-ssd1306: args of multi-byte commands are not mistaken for commands; status read',()=>{
 const o=setup();
 o.cmd(0xaf,0xd5,0xaf,0xa8,0x3f);   // 0xaf as an argument must not toggle anything weird
 o.cmd(0xae);
 assert.equal(o.bus.onRead(true),0x40);
 o.cmd(0xaf);assert.equal(o.bus.onRead(true),0x00);
});
test('oled-ssd1306: start line and COM reverse move rows',()=>{
 const o=setup();
 o.cmd(0xaf,0x20,0x00,0x21,0,0,0x22,0,0);
 o.send(0x40,[0x01]);          // RAM row 0
 assert.equal(o.px(0,0),1);assert.equal(o.px(0,63),0);
 o.cmd(0xc0);assert.equal(o.px(0,63),1);assert.equal(o.px(0,0),0);   // C0 flips top-bottom
 o.cmd(0xc8,0x41);assert.equal(o.px(0,63),1);assert.equal(o.px(0,0),0);   // start line 1: RAM row 0 appears at row 63
});
test('oled-ssd1306: panel colour input is reflected in state',()=>{
 const o=setup({color:'blue'});
 const s=o.m.state();if(s.kind==='ext')assert.equal(s.v.color,'blue');
});
