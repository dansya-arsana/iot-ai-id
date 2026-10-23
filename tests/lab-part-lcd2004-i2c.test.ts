import test from 'node:test';
import assert from 'node:assert/strict';
import type {BoardPin,Circuit,UnoPin} from '../apps/web/src/lab/contract.js';
import {readFileSync} from 'node:fs';
import type {FirmwareVariant,PartSpec} from '../apps/web/src/lab/contract.js';
import {createLabRunner} from '../apps/web/src/lab/sim/runner.js';
import {createModels} from '../apps/web/src/lab/sim/peripherals.js';

import type {I2cSlave,SpiBinding} from '../apps/web/src/lab/sim/devices/types.js';

/** Minimal board: a clock with scheduled callbacks, pin logs and the shared-line / I2C / UART hooks. */
function fakeEnv(){
 const events:{at:number;cb:()=>void}[]=[];
 let now=0;
 const adc:number[]=[],log:{pin:UnoPin;level:boolean;at:number}[]=[],i2c:I2cSlave[]=[],spi:SpiBinding[]=[],uart:((b:number,c:number)=>void)[]=[],sent:number[]=[];
 return {adc,log,i2c,spi,uart,sent,
  env:{
   setPin:(p:UnoPin,l:boolean)=>{log.push({pin:p,level:l,at:now});},setAdc:(_c:number,v:number)=>{adc.push(v);},
   schedule:(c:number,cb:()=>void)=>{events.push({at:now+c,cb});events.sort((a,b)=>a.at-b.at);},now:()=>now,
   watchLine:()=>undefined,attachI2c:(s:I2cSlave)=>{i2c.push(s);},attachSpi:(s:SpiBinding)=>{spi.push(s);},tapUart:(cb:(b:number,c:number)=>void)=>{uart.push(cb);},uartSend:(b:number)=>{sent.push(b);},
  },
  at:(n:number)=>{now=n;},
  run(to:number){while(events.length&&events[0]!.at<=to){const e=events.shift()!;now=e.at;e.cb();}now=to;},
 };
}
const circuit=(net:Partial<Record<string,BoardPin>>,props:Record<string,string|number|boolean>={}):Circuit=>({wires:[],parts:[{id:'lcd2004-i2c1',kind:'lcd2004-i2c',net,props}]});

const fixture=(n:string):{toolchain:string;variant:FirmwareVariant}=>JSON.parse(readFileSync(new URL(`./fixtures/firmware/${n}.json`,import.meta.url),'utf8'));
const part=(id:string,kind:string,net:Partial<Record<string,BoardPin>>,props:Record<string,string|number|boolean>={}):PartSpec=>({id,kind,net,props});
function boot(name:string,c:Circuit){
 const fx=fixture(name),r=createLabRunner();
 r.load(fx.variant,{},c,fx.toolchain);r.start();
 return r;
}
 
const ext=(s:{kind:string}|undefined):Record<string,any>=>{assert.ok(s&&s.kind==='ext');return (s as unknown as {v:Record<string,unknown>}).v;};

/** Host side of the PCF8574 backpack: every byte is an I2C write to the slave the board registered. */
function host(props:Record<string,string|number|boolean>={}){
 const f=fakeEnv();
 const m=createModels(circuit({SDA:'A4',SCL:'A5'},props),f.env).get('lcd2004-i2c1')!;
 const bus=f.i2c[0]!;
 const put=(v:number)=>{bus.onStart!(false,true);bus.onWrite(v);bus.onStop!();};
 const nib=(n:number,rs:number)=>{const v=(n<<4)|0x08|rs;put(v|4);put(v);};
 const send=(b:number,rs=0)=>{nib(b>>4,rs);nib(b&15,rs);};
 const init=()=>{nib(3,0);nib(3,0);nib(3,0);nib(2,0);send(0x28);send(0x08);send(0x01);send(0x06);};
 const text=(s:string)=>{for(const ch of s)send(ch.charCodeAt(0),1);};
 const st=()=>ext(m.state());
 return {f,m,bus,put,nib,send,init,text,st};
}

test('lcd2004-i2c: answers at 0x27 by default and moves with the address input (0x3F, 0x20, 0x38)',()=>{
 const h=host();
 assert.equal(h.bus.address,0x27);assert.equal(h.st().address,0x27);
 for(const a of ['0x3F','0x20','0x38','0x22']){
  const x=host({address:a});assert.equal(x.bus.address,parseInt(a,16));assert.equal(x.st().address,parseInt(a,16));
 }
 assert.equal(host({address:'0x99'}).bus.address,0x27,'an unknown value falls back to 0x27');
 const live=host();live.m.props.address='0x3F';assert.equal(live.bus.address,0x3f,'the popover edit applies at the next START');
});
test('lcd2004-i2c: the display stays blank until init and display-on; backlight is bit 3 of the port',()=>{
 const h=host();
 assert.equal(h.st().display,false);assert.equal(h.st().line1,' '.repeat(20));
 h.init();h.text('A');
 assert.equal(h.st().line1.trim(),'','display still off');
 h.send(0x0c);
 assert.equal(h.st().line1.slice(0,1),'A');assert.equal(h.st().lines,2);assert.equal(h.st().backlight,true);
 h.put(0x00);assert.equal(h.st().backlight,false);h.put(0x08);assert.equal(h.st().backlight,true);
});
test('lcd2004-i2c: four rows start at DDRAM 0x00, 0x40, 0x14 and 0x54, 20 characters wide',()=>{
 const h=host();h.init();h.send(0x0c);
 const w=(a:number,t:string)=>{h.send(0x80|a);h.text(t);};
 w(0x00,'row one');w(0x40,'row two');w(0x14,'row three');w(0x54,'row four');
 const s=h.st();
 assert.equal(s.line1,'row one'.padEnd(20));assert.equal(s.line2,'row two'.padEnd(20));
 assert.equal(s.line3,'row three'.padEnd(20));assert.equal(s.line4,'row four'.padEnd(20));
});
test('lcd2004-i2c: text that runs past column 20 continues on row 3, and row 2 continues on row 4',()=>{
 const h=host();h.init();h.send(0x0c);
 h.send(0x80);h.text('abcdefghijklmnopqrstUVWXY');           // 25 characters from 0x00
 h.send(0xc0);h.text('01234567890123456789zyxw');           // from 0x40
 const s=h.st();
 assert.equal(s.line1,'abcdefghijklmnopqrst');assert.equal(s.line3,'UVWXY'.padEnd(20));
 assert.equal(s.line2,'01234567890123456789');assert.equal(s.line4,'zyxw'.padEnd(20));
});
test('lcd2004-i2c: entry mode, clear and return home',()=>{
 const h=host();h.init();h.send(0x0c);
 h.send(0x80|0x13);h.text('ZY');                            // last cell of row 1, then 0x14 = first cell of row 3
 assert.equal(h.st().line1.slice(-1),'Z');assert.equal(h.st().line3.slice(0,1),'Y');
 h.send(0x01);assert.equal(h.st().line1,' '.repeat(20));assert.equal(h.st().line3,' '.repeat(20));
 h.text('q');assert.equal(h.st().line1.slice(0,1),'q','clear sends the cursor home');
 h.send(0x04);h.send(0x80|3);h.text('ab');                  // entry mode I/D = 0: the counter decrements
 assert.equal(h.st().line1.slice(2,4),'ba');
 h.send(0x06);h.send(0x02);assert.equal(h.st().col,0);assert.equal(h.st().row,0);
});
test('lcd2004-i2c: display shift moves all four windows over the two 40-character lines',()=>{
 const h=host();h.init();h.send(0x0c);
 h.send(0x80);h.text('0123456789ABCDEFGHIJklmnopqrstuvwxyz');   // row 1 = 0..J, row 3 = k..
 h.send(0x18);                                                 // shift display left by one
 const s=h.st();
 assert.equal(s.line1,'123456789ABCDEFGHIJk');assert.equal(s.line3,'lmnopqrstuvwxyz'+' '.repeat(4)+'0','row 3 wraps around the 40-character line into the first cell');
 h.send(0x1c);h.send(0x1c);                                    // two to the right
 assert.equal(h.st().line1,' 0123456789ABCDEFGHI','one blank cell comes in from the end of the 40-character line');
 h.send(0x02);assert.equal(h.st().line1,'0123456789ABCDEFGHIJ','return home also undoes the shift');
});
test('lcd2004-i2c: cursor and blink are reported on the right row and column, including rows 3 and 4',()=>{
 const h=host();h.init();h.send(0x0f);                         // display, cursor and blink on
 h.send(0x80|0x54+3);let s=h.st();
 assert.equal(s.cursor,true);assert.equal(s.blink,true);assert.equal(s.row,3);assert.equal(s.col,3);
 h.send(0x80|0x14+19);s=h.st();assert.equal(s.row,2);assert.equal(s.col,19);
 h.send(0x80|0x40+7);s=h.st();assert.equal(s.row,1);assert.equal(s.col,7);
 h.send(0x80|0x30);assert.equal(h.st().col,-1,'an address with no RAM behind it has no cursor cell');
});
test('lcd2004-i2c: CGRAM glyphs are stored and shown as codes 0..7',()=>{
 const h=host();h.init();h.send(0x0c);
 h.send(0x40|8);for(const r of [0x0e,0x11,0x11,0x1f,0x1b,0x1b,0x1f,0x00])h.text(String.fromCharCode(r));
 h.send(0x80);h.send(1,1);
 const s=h.st();assert.equal(String(s.cg).slice(16,32),'0e1111 1f1b1b1f00'.replace(' ',''));assert.equal(s.line1.charCodeAt(0),1);
});
test('lcd2004-i2c: a one-line function set (N=0) drives only the first row',()=>{
 const h=host();
 nibbleInit(h);
 h.text('line');
 const s=h.st();assert.equal(s.line1.slice(0,4),'line');assert.equal(s.lines,1);
 assert.equal(s.line2,' '.repeat(20));assert.equal(s.line3,' '.repeat(20));assert.equal(s.line4,' '.repeat(20));
});
function nibbleInit(h:ReturnType<typeof host>):void{h.nib(3,0);h.nib(3,0);h.nib(3,0);h.nib(2,0);h.send(0x20);h.send(0x0c);h.send(0x01);}
test('lcd2004-i2c: a data read returns the DDRAM byte, high nibble first, and steps the address',()=>{
 const h=host();h.init();h.send(0x0c);
 h.send(0x80|0x14);h.text('Rs');
 h.send(0x80|0x14);
 const rd=():number=>{
  h.put(0xff);h.put(0xff|4);const hi=h.bus.onRead(true)&0xf0;
  h.put(0xfb);h.put(0xff);const lo=h.bus.onRead(false)&0xf0;
  h.put(0xfb);return hi|(lo>>4);
 };
 assert.equal(rd(),0x52);assert.equal(rd(),0x73);
 assert.equal(h.st().reads,4);
});
test('lcd2004-i2c: real firmware writes four rows through Wire and reads a row-3 byte back',()=>{
 const r=boot('lcd2004-rows',{wires:[],parts:[part('l','lcd2004-i2c',{SDA:'A4',SCL:'A5'})]});
 r.advance(900);
 const s=ext(r.snapshot().parts.l);
 assert.equal(s.line1,'Row one: 20 columns ');assert.equal(s.line2,'Row two'.padEnd(20));
 assert.equal(s.line3,'Row three (0x14)'.padEnd(20));assert.equal(s.line4,'Row four (0x54)'.padEnd(20));
 assert.match(r.serialText(),/r3=0x52/,r.serialText());
 assert.equal(s.display,true);assert.equal(s.backlight,true);
});
test('lcd2004-i2c: with the jumpers set to 0x3F a sketch that calls 0x27 gets no ACK and the screen stays empty',()=>{
 const r=boot('lcd2004-rows',{wires:[],parts:[part('l','lcd2004-i2c',{SDA:'A4',SCL:'A5'},{address:'0x3F'})]});
 r.advance(900);
 const s=ext(r.snapshot().parts.l);
 assert.equal(s.chars,0);assert.equal(s.writes,0);assert.equal(s.display,false);
});
