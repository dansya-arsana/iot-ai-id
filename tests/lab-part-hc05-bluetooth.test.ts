import test from 'node:test';
import assert from 'node:assert/strict';
import type {BoardPin,Circuit,UnoPin} from '../apps/web/src/lab/contract.js';
import {createModels} from '../apps/web/src/lab/sim/peripherals.js';
import {extInput} from '../apps/web/src/lab/sim/devices/types.js';

/** Minimal board: a clock with scheduled callbacks, pin logs, the UART tap and RX injection. */
function fakeEnv(){
 const events:{at:number;cb:()=>void}[]=[];
 let now=0;
 const log:{pin:UnoPin;level:boolean;at:number}[]=[],uart:((b:number,c:number)=>void)[]=[],sent:{b:number;at:number}[]=[];
 const levels=new Map<UnoPin,boolean>();
 return {log,uart,sent,
  env:{
   setPin:(p:UnoPin,l:boolean)=>{levels.set(p,l);log.push({pin:p,level:l,at:now});},setAdc:()=>undefined,
   schedule:(c:number,cb:()=>void)=>{events.push({at:now+c,cb});events.sort((a,b)=>a.at-b.at);},now:()=>now,
   pinLevel:(p:UnoPin)=>(levels.get(p)?1:0) as 0|1,
   watchLine:()=>undefined,tapUart:(cb:(b:number,c:number)=>void)=>{uart.push(cb);},uartSend:(b:number)=>{sent.push({b,at:now});},
  },
  at:(n:number)=>{now=n;},
  run(to:number){while(events.length&&events[0]!.at<=to){const e=events.shift()!;now=e.at;e.cb();}now=to;},
 };
}
const circuit=(net:Partial<Record<string,BoardPin>>,props:Record<string,string|number|boolean>={}):Circuit=>({wires:[],parts:[{id:'bt',kind:'hc05-bluetooth',net,props}]});
const HW:Partial<Record<string,BoardPin>>={RXD:'D1',TXD:'D0',VCC:'5V',GND:'GND'};
const BIT9600=Math.round(16e6/9600);
const text=(bs:{b:number}[]):string=>String.fromCharCode(...bs.map(x=>x.b));
const v=(m:{state():{kind:string}}):Record<string,string|number|boolean|null>=>{const s=m.state() as {kind:string;v?:Record<string,string|number|boolean|null>};assert.equal(s.kind,'ext');return s.v!;};
/** Send a whole string from the sketch into the module's hardware tap. */
const sketchSays=(f:ReturnType<typeof fakeEnv>,s:string):void=>{for(const ch of s)f.uart[0]!(ch.charCodeAt(0),0);};

test('hc05-bluetooth: sketch text reaches the phone transcript and phone lines come back one real frame per byte',()=>{
 const f=fakeEnv();const m=createModels(circuit(HW),f.env).get('bt')!;
 sketchSays(f,'temp=24\r\n');
 assert.equal(v(m).lastLine,'temp=24');assert.equal(v(m).transcript,'< temp=24');
 m.setInput!(extInput('hc05-bluetooth',{line:'LED ON',ending:'lf'}));
 f.run(100*BIT9600);
 assert.equal(text(f.sent),'LED ON\n');
 // one 10-bit frame per byte at 9600 baud (plus a 16-cycle guard)
 assert.equal(f.sent[1]!.at-f.sent[0]!.at,10*BIT9600+16);
 assert.equal(v(m).tx,7);assert.equal(v(m).rx,9);
 assert.match(String(v(m).transcript),/> LED ON/);
});
test('hc05-bluetooth: the popover message and send toggle act as a button',()=>{
 const f=fakeEnv();const model=createModels(circuit(HW,{phrase:'hello',ending:'crlf'}),f.env).get('bt')!;
 model.props.send=true;
 model.update({samples:{} as never,dtSec:0.001,cycles:16000});
 f.run(200*BIT9600);
 assert.equal(text(f.sent),'hello\r\n');
 assert.equal(model.props.send,false);
});
test('hc05-bluetooth: phone off drops both directions and STATE follows the pairing',()=>{
 const f=fakeEnv();const m=createModels(circuit({...HW,STATE:'D7'},{connected:false}),f.env).get('bt')!;
 m.update({samples:{} as never,dtSec:0.001,cycles:16000});
 assert.equal(f.log.filter(l=>l.pin==='D7').pop()!.level,false);
 sketchSays(f,'x\n');m.setInput!(extInput('hc05-bluetooth',{line:'hi'}));f.run(1e6);
 assert.equal(f.sent.length,0);assert.equal(v(m).transcript,'');
 m.props.connected=true;m.update({samples:{} as never,dtSec:0.001,cycles:16000});
 assert.equal(f.log.filter(l=>l.pin==='D7').pop()!.level,true);
});
test('hc05-bluetooth: EN high is AT mode at 38400 baud with real replies',()=>{
 const f=fakeEnv();const m=createModels(circuit({...HW,EN:'5V'}),f.env).get('bt')!;
 assert.equal(v(m).atMode,true);assert.equal(v(m).baud,38400);
 sketchSays(f,'AT\r\n');f.run(1e6);
 assert.equal(text(f.sent),'OK\r\n');
 f.sent.length=0;
 sketchSays(f,'AT+VERSION?\r\n');f.run(5e6);
 assert.equal(text(f.sent),'+VERSION:2.0-20100601\r\nOK\r\n');
 f.sent.length=0;
 sketchSays(f,'AT+NAME=Robot\r\n');sketchSays(f,'AT+NAME?\r\n');f.run(2e7);
 assert.equal(text(f.sent),'OK\r\n+NAME:Robot\r\nOK\r\n');
 f.sent.length=0;
 sketchSays(f,'AT+UART=115200,0,0\r\n');sketchSays(f,'AT+BOGUS\r\n');f.run(4e7);
 assert.equal(text(f.sent),'OK\r\nERROR:(0)\r\n');
 assert.equal(m.props.baud,'115200');
 assert.equal(f.sent[1]!.at-f.sent[0]!.at,Math.round(16e6/38400)*10+16);   // the reply is still sent at the AT-mode baud
 // AT mode: no phone data
 assert.equal(v(m).connected,false);
});
test('hc05-bluetooth: software serial pins, 8N1 frames at the module baud in both directions',()=>{
 const f=fakeEnv();const m=createModels(circuit({RXD:'D10',TXD:'D11',VCC:'5V',GND:'GND'},{baud:'9600'}),f.env).get('bt')!;
 assert.equal(v(m).ioRx,'software');assert.equal(v(m).ioTx,'software');
 assert.equal(f.log.find(l=>l.pin==='D11')!.level,true);   // TXD idles high
 // sketch bit-bangs 'A' (0x41) on D10: start, 8 data bits LSB first, stop
 const send=(t0:number,byte:number,bit:number):void=>{
  const edge=(l:number,t:number)=>{f.run(t);m.onEdge!('D10',l as 0|1,t);};
  edge(1,t0-bit);
  let t=t0;edge(0,t);
  let level=0;
  for(let i=0;i<8;i++){t+=bit;const b=(byte>>i)&1;if(b!==level){level=b;edge(b,t);}}
  t+=bit;if(level!==1)edge(1,t);
 };
 send(1000,0x41,BIT9600);
 for(const ch of 'BC\n')send(1000+(12+('BC\n'.indexOf(ch)*10))*BIT9600,ch.charCodeAt(0),BIT9600);
 f.run(1000+60*BIT9600);
 assert.equal(v(m).rx,4);assert.equal(v(m).framingErrors,0);
 assert.equal(v(m).lastLine,'ABC');
 // module -> sketch: 'Z' (0x5A = 01011010) on D11 at the exact 9600 baud timing
 f.log.length=0;f.at(5e6);
 m.setInput!(extInput('hc05-bluetooth',{line:'Z',ending:'none'}));
 f.run(5e6+20*BIT9600);
 const d11=f.log.filter(l=>l.pin==='D11');
 // start(0) bit0(0) bit1(1) bit2(0) bit3(1) bit4(1) bit5(0) bit6(1) bit7(0) stop(1)
 assert.deepEqual(d11.map(l=>[l.level,(l.at-5e6)/BIT9600]),[[false,0],[true,2],[false,3],[true,4],[false,6],[true,7],[false,8],[true,9]]);
});
test('hc05-bluetooth: a wrong software baud decodes garbage, as on a real bus',()=>{
 const f=fakeEnv();const m=createModels(circuit({RXD:'D10',TXD:'D11',VCC:'5V',GND:'GND'},{baud:'4800'}),f.env).get('bt')!;
 const bit=BIT9600;   // the sketch talks 9600
 const edge=(l:number,t:number)=>{f.run(t);m.onEdge!('D10',l as 0|1,t);};
 edge(1,100);edge(0,1000);   // start
 let t=1000,level=0;
 for(let i=0;i<8;i++){t+=bit;const b=(0x41>>i)&1;if(b!==level){level=b;edge(b,t);}}
 t+=bit;if(level!==1)edge(1,t);
 f.run(t+40*bit);
 assert.notEqual(v(m).lastLine,'A');
 assert.equal(Number(v(m).rx)<=1,true);
});
test('hc05-bluetooth: pins STATE RXD TXD GND VCC EN',()=>{
 const f=fakeEnv();
 const m=createModels(circuit({}),f.env).get('bt')!;
 assert.equal(v(m).ioRx,'none');
 const wired=createModels(circuit({RXD:'D4'}),fakeEnv().env).get('bt')!;
 assert.equal(v(wired).ioRx,'software');assert.equal(v(wired).ioTx,'none');
});
