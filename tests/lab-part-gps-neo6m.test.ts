import test from 'node:test';
import assert from 'node:assert/strict';
import type {BoardPin,Circuit,UnoPin} from '../apps/web/src/lab/contract.js';
import {createModels} from '../apps/web/src/lab/sim/peripherals.js';
import {epochSentences,nmeaChecksum,nmeaLat,nmeaLon,sentence,START_UTC} from '../apps/web/src/lab/sim/devices/gps-neo6m.js';

function fakeEnv(){
 const events:{at:number;cb:()=>void}[]=[];
 let now=0;
 const log:{pin:UnoPin;level:boolean;at:number}[]=[],sent:{b:number;at:number}[]=[],uart:((b:number,c:number)=>void)[]=[];
 return {log,sent,uart,
  env:{
   setPin:(p:UnoPin,l:boolean)=>{log.push({pin:p,level:l,at:now});},setAdc:()=>undefined,
   schedule:(c:number,cb:()=>void)=>{events.push({at:now+c,cb});events.sort((a,b)=>a.at-b.at);},now:()=>now,
   watchLine:()=>undefined,tapUart:(cb:(b:number,c:number)=>void)=>{uart.push(cb);},uartSend:(b:number)=>{sent.push({b,at:now});},
  },
  run(to:number){while(events.length&&events[0]!.at<=to){const e=events.shift()!;now=e.at;e.cb();}now=to;},
 };
}
const circuit=(net:Partial<Record<string,BoardPin>>,props:Record<string,string|number|boolean>={}):Circuit=>({wires:[],parts:[{id:'gps',kind:'gps-neo6m',net,props}]});
const HW:Partial<Record<string,BoardPin>>={TX:'D0',RX:'D1',VCC:'5V',GND:'GND'};
const SEC=16_000_000;
const lines=(bs:{b:number}[]):string[]=>String.fromCharCode(...bs.map(x=>x.b)).split('\r\n').filter(Boolean);
const valid=(l:string):boolean=>{const m=/^\$([^*]+)\*([0-9A-F]{2})$/.exec(l);return !!m&&nmeaChecksum(m[1]!)===m[2];};
const v=(m:{state():{kind:string}}):Record<string,string|number|boolean|null>=>{const s=m.state() as {kind:string;v?:Record<string,string|number|boolean|null>};assert.equal(s.kind,'ext');return s.v!;};

test('gps-neo6m: checksum and empty sentences match the chip',()=>{
 assert.equal(nmeaChecksum('GPRMC,,V,,,,,,,,,,N'),'53');
 assert.equal(nmeaChecksum('GPGGA,,,,,,0,00,99.99,,,,,,'),'48');
 assert.equal(sentence('GPGLL,,,,,,V,N'),'$GPGLL,,,,,,V,N*'+nmeaChecksum('GPGLL,,,,,,V,N')+'\r\n');
});
test('gps-neo6m: degrees to ddmm.mmmmm',()=>{
 assert.deepEqual(nmeaLat(-6.2088),['0612.52800','S']);
 assert.deepEqual(nmeaLon(106.8456),['10650.73600','E']);
 assert.deepEqual(nmeaLat(51.5),['5130.00000','N']);
 assert.deepEqual(nmeaLon(-0.1),['00006.00000','W']);
});
test('gps-neo6m: one second after power-on the receiver sends RMC, VTG, GGA, GLL for Jakarta at 9600 baud',()=>{
 const f=fakeEnv();const m=createModels(circuit(HW),f.env).get('gps')!;
 f.run(SEC-1);assert.equal(f.sent.length,0);
 f.run(SEC+3*SEC/10);
 const L=lines(f.sent);
 assert.equal(L.length,4);
 assert.ok(L.every(valid));
 assert.equal(L[0],'$GPRMC,030001.00,A,0612.52800,S,10650.73600,E,0.00,,150126,,,A*'+L[0]!.split('*')[1]);
 assert.match(L[2]!,/^\$GPGGA,030001\.00,0612\.52800,S,10650\.73600,E,1,08,1\.00,8\.0,M,,M,,\*/);
 // bytes leave one 10-bit frame apart (9600 baud) starting exactly at the epoch
 assert.equal(f.sent[0]!.at,SEC);
 assert.equal(f.sent[1]!.at-f.sent[0]!.at,Math.round(16e6/9600)*10+16);
 assert.equal(v(m).utc,'03:00:01');assert.equal(v(m).fix,true);assert.equal(v(m).satellites,8);
 assert.equal(START_UTC,Date.UTC(2026,0,15,3,0,0)/1000);
});
test('gps-neo6m: no fix gives the empty sentences',()=>{
 const f=fakeEnv();const m=createModels(circuit(HW,{fix:false}),f.env).get('gps')!;
 f.run(SEC+SEC/2);
 const L=lines(f.sent);
 assert.deepEqual(L.slice(0,3),['$GPRMC,,V,,,,,,,,,,N*53','$GPVTG,,T,,M,,N,,K,N*'+nmeaChecksum('GPVTG,,T,,M,,N,,K,N'),'$GPGGA,,,,,,0,00,99.99,,,,,,*48']);
 assert.equal(v(m).fix,false);assert.equal(v(m).satellites,0);
 m.props.fix=true;f.sent.length=0;f.run(2*SEC+SEC/2);
 assert.match(lines(f.sent)[0]!,/^\$GPRMC,030002\.00,A,/);
});
test('gps-neo6m: popover position, altitude and speed feed the sentences; speed moves the receiver',()=>{
 const f=fakeEnv();const m=createModels(circuit(HW,{lat:51.5,lon:-0.1,altitude:35,speedKmh:18.52,heading:90,satellites:5}),f.env).get('gps')!;
 f.run(SEC+SEC/2);
 const L=lines(f.sent);
 assert.match(L[0]!,/^\$GPRMC,030001\.00,A,5130\.00000,N,00006\.00000,W,10\.00,90\.00,150126,,,A\*/);
 assert.match(L[1]!,/^\$GPVTG,90\.00,T,,M,10\.00,N,18\.52,K,A\*/);
 assert.match(L[2]!,/,1,05,2\.20,35\.0,M,,M,,\*/);
 // 60 s at 18.52 km/h due east = 0.3087 km = ~0.00444 deg of longitude at 51.5N
 f.run(61*SEC+SEC/2);
 const lon=v(m).lon as number;
 assert.ok(lon>-0.1+0.0043&&lon<-0.1+0.0048,String(lon));
 assert.ok(Math.abs((v(m).lat as number)-51.5)<1e-6);
});
test('gps-neo6m: software UART on any pin, exact 9600 baud frames, and a different baud shifts the bit time',()=>{
 const f=fakeEnv();createModels(circuit({TX:'D4',RX:'D3',VCC:'5V',GND:'GND'}),f.env);
 f.run(SEC+SEC/50);
 const d4=f.log.filter(l=>l.pin==='D4');
 assert.equal(d4[0]!.level,true);              // idles high
 const bit=Math.round(16e6/9600);
 // '$' = 0x24 = 00100100: start 0, bits LSB first 0,0,1,0,0,1,0,0, stop 1
 const t0=SEC,rel=d4.filter(l=>l.at>=t0).slice(0,6).map(l=>[l.level,(l.at-t0)/bit]);
 assert.deepEqual(rel,[[false,0],[true,3],[false,4],[true,6],[false,7],[true,9]]);
 const g=fakeEnv();createModels(circuit({TX:'D4',RX:'D3'},{baud:'4800'}),g.env);
 g.run(SEC+SEC/20);
 const first=g.log.filter(l=>l.pin==='D4'&&l.at>=SEC).slice(0,2);
 assert.equal((first[1]!.at-first[0]!.at),3*Math.round(16e6/4800));
});
test('gps-neo6m: bytes from the sketch are counted and ignored',()=>{
 const f=fakeEnv();const m=createModels(circuit(HW),f.env).get('gps')!;
 f.uart[0]!(0xb5,10);f.uart[0]!(0x62,20);
 assert.equal(v(m).rxBytes,2);
});
test('gps-neo6m: epochSentences are all checksum-valid',()=>{
 for(const valid_ of [true,false])assert.ok(epochSentences({valid:valid_,t:START_UTC,lat:1,lon:2,alt:3,kmh:4,course:5,sats:6}).every(s=>valid(s.trim())));
});
