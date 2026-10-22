/**
 * ESP-01 (ESP8266 module, 2x4 header) with an AT-command shell on the UART. Written by us from the public
 * Espressif AT instruction set behaviour: a line ends with CR LF, the module echoes (ATE1 default), answers
 * "OK" / "ERROR", and AT+GMR prints version lines.
 * HONEST: there is NO Wi-Fi in the lab. AT+CWLAP lists nothing, AT+CWJAP always fails with code 3 (AP not found),
 * AT+CIFSR reports 0.0.0.0. The module only answers when VCC is 3.0-3.6 V and CH_PD is held high (a floating CH_PD
 * keeps the real chip off). Reply bytes are paced at the baud rate (10 bits per byte), not injected at once.
 * Pair: scene/parts/esp-01.ts. Guide: docs/lab-extending.md
 */
import {defineDevice} from './types';

export type Esp01State={powered:boolean;enabled:boolean;baud:number;mode:number;echo:boolean;commands:number;lastCmd:string;txBytes:number;rxBytes:number;wifi:'none'};

export const AT_VERSION='AT version:1.2.0.0 (lab model)';
const MODES=[1,2,3];

export const device=defineDevice<Esp01State>({
 kind:'esp-01',protocol:'uart',
 // datasheet header, looking at the pins with the antenna up: row A = GND GPIO2 GPIO0 RX, row B = TX CH_PD RST VCC.
 // All pins are wire-only terminals (a 2x4 header does not straddle the breadboard centre gap).
 pins:['VCC','TX','RX','GND','CH_PD','RST','GPIO0','GPIO2'],
 power:{rail:['VCC','GND'],min:3,max:3.6,ma:80},
 copy:{
  name:{en:'ESP-01 (ESP8266)',id:'ESP-01 (ESP8266)'},
  desc:{en:'Tiny Wi-Fi module with a serial AT-command shell. In the lab it answers AT, AT+GMR and AT+CWMODE like the real firmware, but there is no radio: no network is ever found.',id:'Modul Wi-Fi kecil dengan perintah AT lewat serial. Di lab ia menjawab AT, AT+GMR dan AT+CWMODE seperti firmware asli, tetapi tidak ada radio: jaringan tidak pernah ditemukan.'},
  note:{en:'Needs 3.3 V (not 5 V) and CH_PD high. No real Wi-Fi.',id:'Butuh 3,3 V (bukan 5 V) dan CH_PD high. Tidak ada Wi-Fi sungguhan.'},
 },
 inputs:[
  {type:'choice',key:'baud',label:{en:'Module baud rate',id:'Baud rate modul'},options:[{value:'9600',label:{en:'9600',id:'9600'}},{value:'115200',label:{en:'115200',id:'115200'}}],default:'9600'},
 ],
 create(ctx){
  let mode=1,echo=true,line='',cmds=0,last='',tx=0,rx=0,busy=0;   // busy: cycle when the TX line is free again
  const baud=():number=>Number(ctx.props.baud)===115200?115200:9600;
  const powered=():boolean=>{const v=ctx.supply();return v!==null&&v>=2.7&&v<=3.9;};
  const enabled=():boolean=>{const v=ctx.volts('CH_PD');return v!==null&&v>=1.5;};
  const alive=():boolean=>powered()&&enabled();
  /** queue bytes, one frame (start + 8 + stop = 10 bits) apart */
  const send=(s:string):void=>{
   const per=Math.round(10*16e6/baud());
   let at=Math.max(busy,ctx.env.now());
   for(const ch of s){
    at+=per;const b=ch.charCodeAt(0)&0xff;
    ctx.schedule(at-ctx.env.now(),()=>{ctx.uartSend(b);tx++;});
   }
   busy=at;
  };
  const ok='\r\nOK\r\n';
  function answer(cmd:string):string{
   const u=cmd.toUpperCase();
   if(u==='AT')return ok;
   if(u==='ATE0'){echo=false;return ok;}
   if(u==='ATE1'){echo=true;return ok;}
   if(u==='AT+GMR')return `\r\n${AT_VERSION}\r\nSDK version:2.0.0\r\nlab build\r\n`+'OK\r\n';
   if(u==='AT+CWMODE?'||u==='AT+CWMODE_CUR?'||u==='AT+CWMODE_DEF?')return `\r\n+${u.slice(3,-1)}:${mode}\r\n`+ok.slice(2);
   const m=/^AT\+CWMODE(?:_CUR|_DEF)?=(\d+)$/.exec(u);
   if(m){const n=Number(m[1]);if(MODES.includes(n)){mode=n;return ok;}return '\r\nERROR\r\n';}
   if(u==='AT+CWLAP')return ok;                       // radio absent: zero access points
   if(u.startsWith('AT+CWJAP='))return '\r\n+CWJAP:3\r\n\r\nFAIL\r\n';   // 3 = target AP not found
   if(u==='AT+CIFSR')return '\r\n+CIFSR:STAIP,"0.0.0.0"\r\n+CIFSR:STAMAC,"00:00:00:00:00:00"\r\n\r\nOK\r\n';
   if(u==='AT+RST'){mode=1;echo=true;return ok+'\r\nready\r\n';}
   return '\r\nERROR\r\n';
  }
  return {
   state:()=>({powered:powered(),enabled:enabled(),baud:baud(),mode,echo,commands:cmds,lastCmd:last,txBytes:tx,rxBytes:rx,wifi:'none' as const}),
   uart:{onTx(byte){
    if(!alive())return;
    rx++;
    if(byte===0x0a)return;   // LF closes the line the CR already ran
    if(byte===0x0d){
     if(!line){if(echo)send('\r\n');return;}
     const cmd=line;line='';cmds++;last=cmd;
     send((echo?'\r\r\n':'')+answer(cmd));   // real modules echo CR CR LF, then the answer
     return;
    }
    if(echo)send(String.fromCharCode(byte));
    if(line.length<127)line+=String.fromCharCode(byte);
   }},
  };
 },
});
