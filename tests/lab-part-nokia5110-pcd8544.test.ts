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
const circuit=(net:Partial<Record<string,BoardPin>>,props:Record<string,string|number|boolean>={}):Circuit=>({wires:[],parts:[{id:'nokia5110-pcd85441',kind:'nokia5110-pcd8544',net,props}]});

const fixture=(n:string):{toolchain:string;variant:FirmwareVariant}=>JSON.parse(readFileSync(new URL(`./fixtures/firmware/${n}.json`,import.meta.url),'utf8'));
const part=(id:string,kind:string,net:Partial<Record<string,BoardPin>>,props:Record<string,string|number|boolean>={}):PartSpec=>({id,kind,net,props});
 
const ext=(s:{kind:string}|undefined):Record<string,any>=>{assert.ok(s&&s.kind==='ext');return (s as unknown as {v:Record<string,unknown>}).v;};
const NET={CE:'D10',DC:'D9',RST:'D8',CLK:'D13',DIN:'D11'} as const;

/** Host side: DC and CE are driven like a sketch does (edges to the model), the byte goes through the SPI binding the board registered. */
function host(net:Partial<Record<string,BoardPin>>=NET,props:Record<string,string|number|boolean>={}){
 const f=fakeEnv();
 const m=createModels(circuit(net,props),f.env).get('nokia5110-pcd85441')!;
 const spi=f.spi[0]!;
 let t=0;
 const info=(mode:0|1|2|3=0,lsb=false)=>({mode,lsbFirst:lsb,clockHz:4_000_000,cycle:t});
 const xfer=(dc:0|1,b:number,mode:0|1|2|3=0,lsb=false)=>{
  m.onEdge!('D9',dc,t+=100);m.onEdge!('D10',0,t+=100);
  spi.transfer(b,info(mode,lsb));
  m.onEdge!('D10',1,t+=100);
 };
 const cmd=(b:number)=>xfer(0,b),dat=(b:number)=>xfer(1,b);
 const st=()=>ext(m.state());
 const ram=(bank:number,x:number):number=>parseInt(String(st().fb).substr((bank*84+x)*2,2),16);
 const init=()=>{cmd(0x21);cmd(0xbf);cmd(0x04);cmd(0x14);cmd(0x20);cmd(0x0c);};
 const clear=()=>{cmd(0x40);cmd(0x80);for(let i=0;i<504;i++)dat(0);};
 return {f,m,spi,xfer,cmd,dat,st,ram,init,clear,edge:(pin:'D8'|'D9'|'D10',l:0|1)=>m.onEdge!(pin,l,t+=100)};
}

test('nokia5110-pcd8544: powers up in power-down with a blank display, zero contrast and noise in the RAM',()=>{
 const h=host();
 const s=h.st();
 assert.equal(s.power,false);assert.equal(s.display,'blank');assert.equal(s.vop,0);assert.equal(s.vlcd,3.06);
 assert.notEqual(s.fb,'00'.repeat(504),'the RAM is undefined at power up');
 assert.equal(String(s.fb).length,1008);
});
test('nokia5110-pcd8544: the usual init (extended set, Vop, TC, bias, basic set, normal mode) lands in the right registers',()=>{
 const h=host();h.init();
 const s=h.st();
 assert.equal(s.vop,0x3f);assert.equal(s.vlcd,6.84);assert.equal(s.bias,4);assert.equal(s.tc,0);
 assert.equal(s.power,true);assert.equal(s.ext,false);assert.equal(s.vertical,false);assert.equal(s.display,'normal');
 assert.equal(s.cmds,6);assert.equal(s.invalid,0);
 h.cmd(0x21);h.cmd(0x80|0x7f);h.cmd(0x07);h.cmd(0x17);
 assert.equal(h.st().vop,127);assert.equal(h.st().tc,3);assert.equal(h.st().bias,7);assert.equal(h.st().ext,true);
});
test('nokia5110-pcd8544: the same opcode means different things in the basic and the extended set',()=>{
 const h=host();h.cmd(0x20);
 h.cmd(0x80|10);h.cmd(0x40|3);
 assert.equal(h.st().x,10);assert.equal(h.st().y,3);assert.equal(h.st().vop,0,'H=0: 0x80|n is the column');
 h.cmd(0x21);h.cmd(0x80|40);
 assert.equal(h.st().x,10);assert.equal(h.st().vop,40,'H=1: 0x80|n is Vop');
 h.cmd(0x40|1);assert.equal(h.st().y,3,'bank commands are ignored in the extended set');assert.equal(h.st().invalid,1);
 h.cmd(0x00);assert.equal(h.st().invalid,1,'NOP is fine in both sets');
});
test('nokia5110-pcd8544: out-of-range addresses are rejected',()=>{
 const h=host();h.cmd(0x20);
 h.cmd(0x80|84);h.cmd(0x40|6);h.cmd(0x40|7);
 assert.equal(h.st().invalid,3);assert.equal(h.st().x,0);assert.equal(h.st().y,0);
 h.cmd(0x80|83);h.cmd(0x40|5);assert.equal(h.st().x,83);assert.equal(h.st().y,5);
});
test('nokia5110-pcd8544: DC high writes display data; DC low is a command; data bytes land at X,Y and X advances',()=>{
 const h=host();h.init();h.clear();
 h.cmd(0x40|2);h.cmd(0x80|5);
 h.dat(0xa5);h.dat(0x3c);
 assert.equal(h.ram(2,5),0xa5);assert.equal(h.ram(2,6),0x3c);assert.equal(h.st().x,7);assert.equal(h.st().y,2);
 assert.equal(h.st().datas,504+2);
 h.xfer(0,0x40|4);assert.equal(h.st().y,4,'DC low: command');
});
test('nokia5110-pcd8544: horizontal addressing wraps at column 83 into the next bank and bank 5 back to bank 0',()=>{
 const h=host();h.init();
 h.cmd(0x40|1);h.cmd(0x80|82);h.dat(1);h.dat(2);
 assert.equal(h.st().x,0);assert.equal(h.st().y,2);assert.equal(h.ram(1,82),1);assert.equal(h.ram(1,83),2);
 h.cmd(0x40|5);h.cmd(0x80|83);h.dat(9);
 assert.equal(h.st().x,0);assert.equal(h.st().y,0,'bank 5 wraps to bank 0');
});
test('nokia5110-pcd8544: vertical addressing walks down the banks, then to the next column; column 83 wraps to 0',()=>{
 const h=host();h.init();h.cmd(0x22);
 h.cmd(0x40);h.cmd(0x80|4);
 for(let i=0;i<7;i++)h.dat(0x10+i);
 for(let b=0;b<6;b++)assert.equal(h.ram(b,4),0x10+b);
 assert.equal(h.ram(0,5),0x16);assert.equal(h.st().x,5);assert.equal(h.st().y,1);assert.equal(h.st().vertical,true);
 h.cmd(0x40|5);h.cmd(0x80|83);h.dat(7);
 assert.equal(h.st().x,0);assert.equal(h.st().y,0);
});
test('nokia5110-pcd8544: display control bits: blank 0x08, all on 0x09, normal 0x0C, inverse 0x0D',()=>{
 const h=host();h.cmd(0x20);
 for(const [c,n] of [[0x08,'blank'],[0x09,'on'],[0x0c,'normal'],[0x0d,'inverse']] as const){h.cmd(c);assert.equal(h.st().display,n);}
});
test('nokia5110-pcd8544: power down keeps the RAM; reset (RST low) returns to power-down with Vop 0 and does not clear the RAM',()=>{
 const h=host();h.init();h.cmd(0x40);h.cmd(0x80);h.dat(0x7e);
 h.cmd(0x24);assert.equal(h.st().power,false);assert.equal(h.ram(0,0),0x7e);
 h.cmd(0x20);assert.equal(h.st().power,true);
 h.edge('D8',0);
 const s=h.st();assert.equal(s.power,false);assert.equal(s.vop,0);assert.equal(s.display,'blank');assert.equal(s.resets,1);assert.equal(h.ram(0,0),0x7e);
 h.xfer(0,0x20);assert.equal(h.st().power,false,'ignored while RST is low');
 h.edge('D8',1);h.xfer(0,0x20);assert.equal(h.st().power,true);
});
test('nokia5110-pcd8544: while RST is held low the interface is dead',()=>{
 const h=host();h.edge('D8',0);
 const before=h.st().cmds;h.cmd(0x20);h.cmd(0x0c);
 assert.equal(h.st().cmds,before);assert.equal(h.st().power,false);
});
test('nokia5110-pcd8544: only SPI modes 0 and 3 are understood, MSB first',()=>{
 const h=host();
 h.xfer(0,0x0c,1);h.xfer(0,0x0c,2);
 assert.equal(h.st().badMode,2);assert.equal(h.st().cmds,0);
 h.xfer(0,0x20);h.xfer(0,0x0c,3);assert.equal(h.st().display,'normal');
 h.xfer(0,0x80|1,0,true);                                   // LSB first: 0x81 arrives as 0x81 reversed = 0x81; use an asymmetric one
 h.xfer(0,0x03,0,true);                                     // LSB first: 0x03 -> 0xC0 = column 64
 assert.equal(h.st().x,64);
});
test('nokia5110-pcd8544: with CE wired to GND the chip is always selected; a floating DC reads as a command',()=>{
 const h=host({RST:'D8',DC:'D9',CE:'GND',DIN:'D11',CLK:'D13'});
 h.cmd(0x20);h.cmd(0x0c);assert.equal(h.st().display,'normal');
});
test('nokia5110-pcd8544: the backlight follows LIGHT (active low by default) and the polarity input',()=>{
 const low=host({...NET,LIGHT:'GND'});assert.equal(low.st().light,1);
 const lowHigh=host({...NET,LIGHT:'5V'});assert.equal(lowHigh.st().light,0);
 const hi=host({...NET,LIGHT:'3V3'},{lightMode:'high'});assert.equal(hi.st().light,1);
 const hiGnd=host({...NET,LIGHT:'GND'},{lightMode:'high'});assert.equal(hiGnd.st().light,0);
 assert.equal(host().st().light,0,'LIGHT unwired: off');
});
test('nokia5110-pcd8544: real firmware initialises over hardware SPI, clears the RAM and draws text and a vertical line',()=>{
 const fx=fixture('pcd8544-hello'),r=createLabRunner();
 r.load(fx.variant,{},{wires:[],parts:[part('n','nokia5110-pcd8544',{RST:'D8',CE:'D10',DC:'D9',DIN:'D11',CLK:'D13'})]},fx.toolchain);r.start();
 r.advance(300);
 assert.match(r.serialText(),/ready/);
 const s=ext(r.snapshot().parts.n);
 const ram=(bank:number,x:number):number=>parseInt(String(s.fb).substr((bank*84+x)*2,2),16);
 assert.equal(s.vop,0x3f);assert.equal(s.bias,4);assert.equal(s.power,true);assert.equal(s.display,'normal');assert.equal(s.invalid,0);assert.equal(s.badMode,0);
 assert.equal(s.resets,1);
 // "HI 42" starts at bank 2, column 10; each glyph is 5 columns plus a blank
 assert.deepEqual([0,1,2,3,4].map(i=>ram(2,10+i)),[0x7f,0x08,0x08,0x08,0x7f]);
 assert.deepEqual([0,1,2,3,4].map(i=>ram(2,16+i)),[0x00,0x41,0x7f,0x41,0x00]);
 assert.deepEqual([0,1,2,3,4].map(i=>ram(2,24+i)),[0x18,0x14,0x12,0x7f,0x10]);
assert.deepEqual([0,1,2,3,4].map(i=>ram(2,30+i)),[0x42,0x61,0x51,0x49,0x46]);
 for(let b=0;b<6;b++)assert.equal(ram(b,83),0xff,'vertical addressing line');
 assert.equal(ram(0,5),0,'the RAM was cleared first (it starts as noise)');
 assert.equal(s.vertical,false);
});
test('nokia5110-pcd8544: a part on other pins than the sketch uses never gets a byte',()=>{
 const fx=fixture('pcd8544-hello'),r=createLabRunner();
 r.load(fx.variant,{},{wires:[],parts:[part('n','nokia5110-pcd8544',{RST:'D2',CE:'D3',DC:'D4',DIN:'D11',CLK:'D13'})]},fx.toolchain);r.start();
 r.advance(300);
 const s=ext(r.snapshot().parts.n);
 assert.equal(s.cmds,0);assert.equal(s.datas,0);assert.equal(s.power,false);
});
