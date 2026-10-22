/**
 * HC-05 Bluetooth serial module on its 6-pin breakout (protocol 'uart'), with a fake phone terminal in the popover.
 * Behaviour written from the public module behaviour (SPP slave, data mode and AT command mode); no vendor code or text:
 *  - Data mode: a transparent serial pipe at the configured baud (default 9600, 8N1). Every byte the sketch sends goes to the phone transcript while
 *    the phone is connected; a phone line (popover or setInput {line}) goes out on TXD to the sketch, one real 10-bit frame per byte.
 *    With the phone not connected the module just drops both directions, as the real one does.
 *  - AT mode: EN (KEY) pin high. The module talks 38400 baud, commands end with CR LF and are upper case:
 *    AT, AT+VERSION?, AT+NAME?/=x, AT+ADDR?, AT+UART?/=baud,stop,parity, AT+PSWD?/=x, AT+ROLE?/=n, AT+CMODE?/=n, AT+STATE?, AT+ORGL, AT+RESET.
 *    Answers are "+KEY:value\r\nOK\r\n", "OK\r\n" or "ERROR:(0)\r\n". AT+UART= changes the baud used in data mode.
 *  - STATE pin: high while a phone is paired. Status LED: fast 2 Hz blink = waiting, 0.5 Hz slow blink = AT mode, double blink every 2 s = paired.
 *  - Pins: hardware serial (module RXD on D1, TXD on D0) or any other board pins with a software UART at the module baud, in each direction
 *    (see sim/devices/serial/uart-link.ts). A baud mismatch with a software sketch gives garbage on the wire, like the real thing.
 * Not simulated: radio, pairing handshake, the on-board 3.3 V level shifting (RXD is a 3.3 V input; a 5 V sketch needs a divider in real life).
 * Pair: scene/parts/hc05-bluetooth.ts (3D). Both are auto-discovered. Guide: docs/lab-extending.md
 */
import {defineDevice,type DeviceCtx,type DeviceModel} from './types';
import type {PartInput} from '../../contract';
import {UartLink} from './serial/uart-link';

export type Hc05State={
 atMode:boolean;connected:boolean;baud:number;led:boolean;name:string;rx:number;tx:number;framingErrors:number;
 transcript:string;lastLine:string;ioRx:string;ioTx:string;powered:boolean;state:boolean;
};

export const BAUDS=['1200','2400','4800','9600','19200','38400','57600','115200'] as const;
export const AT_BAUD=38400;
export const PHRASES=['LED ON','LED OFF','hello','F','B','L','R','S','1','0'] as const;
export const VERSION='2.0-20100601';
const ENDINGS:Record<string,string>={none:'',lf:'\n',crlf:'\r\n'};

const printable=(s:string):string=>s.replace(/[^\x20-\x7e]/g,'.');

export const device=defineDevice<Hc05State>({
 kind:'hc05-bluetooth',protocol:'uart',
 // breakout header order: STATE RXD TXD GND VCC EN (RXD = receives from the sketch, TXD = sends to the sketch)
 pins:['STATE','RXD','TXD','GND','VCC','EN'],holes:[0,1,2,3,4,5],bodyX:[-1.6,14.3],
 copy:{
  name:{en:'HC-05 Bluetooth module',id:'Modul Bluetooth HC-05'},
  desc:{en:'A serial-over-Bluetooth bridge: what your sketch prints appears on a phone, and what the phone types arrives on Serial.',id:'Jembatan serial lewat Bluetooth: yang dicetak sketch muncul di ponsel, dan yang diketik ponsel masuk ke Serial.'},
  note:{en:'Click it to use the phone: type a line in the terminal and press Send, or switch the phone off. EN to 5V enters AT mode at 38400 baud.',id:'Klik untuk memakai ponselnya: ketik satu baris di terminal lalu tekan Kirim, atau matikan ponselnya. EN ke 5V masuk mode AT pada 38400 baud.'},
 },
 // the breakout has a 3.3 V regulator behind VCC: 3.6 V to 6 V
 power:{rail:['VCC','GND'],min:3.6,max:6,ma:30},
 inputs:[
  {type:'toggle',key:'connected',label:{en:'Phone connected',id:'Ponsel terhubung'},default:true},
  // a real terminal: the phone types a line, the sketch's answers come back as lines
  {type:'terminal',key:'line',label:{en:'Phone terminal',id:'Terminal ponsel'},placeholder:{en:'Type a line and press Send',id:'Ketik satu baris lalu tekan Kirim'},input:'hc05-bluetooth',log:'transcript',ending:'ending'},
  {type:'choice',key:'baud',label:{en:'Module baud (data mode)',id:'Baud modul (mode data)'},options:BAUDS.map(b=>({value:b,label:{en:b,id:b}})),default:'9600'},
  {type:'choice',key:'phrase',label:{en:'Phone message',id:'Pesan ponsel'},options:PHRASES.map(b=>({value:b,label:{en:b,id:b}})),default:'LED ON',advanced:true},
  {type:'choice',key:'ending',label:{en:'Line ending the phone adds',id:'Akhir baris dari ponsel'},options:[
   {value:'lf',label:{en:'Newline (\\n)',id:'Baris baru (\\n)'}},{value:'crlf',label:{en:'CR + LF',id:'CR + LF'}},{value:'none',label:{en:'Nothing',id:'Tanpa'}}],default:'lf'},
  {type:'toggle',key:'send',label:{en:'Send the message now',id:'Kirim pesan sekarang'},default:false,advanced:true},
 ],
 defaults:{connected:true,baud:'9600',phrase:'LED ON',ending:'lf',send:false},
 create(ctx:DeviceCtx):DeviceModel<Hc05State>{
  let name='HC-05',pswd='1234',role=0,cmode=0,stop=0,parity=0,atLine='',line='',lastLine='';
  let nowC=0,rx=0,tx=0;
  const log:{dir:'<'|'>';text:string}[]=[];
  const push=(dir:'<'|'>',text:string):void=>{log.push({dir,text:printable(text)});if(log.length>6)log.shift();};
  const enNet=ctx.net('EN');
  const enPin=ctx.pin('EN');
  const atMode=():boolean=>enNet==='5V'||enNet==='3V3'||(enPin!==null&&ctx.pinLevel(enPin)===1);
  const powered=():boolean=>{const v=ctx.supply();return v===null||v>=3.3;};
  const dataBaud=():number=>{const p=Number(ctx.props.baud);return Number.isFinite(p)&&p>0?p:9600;};
  const baud=():number=>atMode()?AT_BAUD:dataBaud();
  const connected=():boolean=>powered()&&!atMode()&&ctx.props.connected!==false;
  const link=new UartLink({ctx,rx:'RXD',tx:'TXD',baud,onByte:(b)=>onSketchByte(b)});
  const reply=(s:string):void=>link.send(Array.from(s,c=>c.charCodeAt(0)&0xff));
  function atCommand(cmd:string):void{
   const eq=cmd.indexOf('='),q=eq<0&&cmd.endsWith('?');
   const key=eq>=0?cmd.slice(0,eq):q?cmd.slice(0,-1):cmd;
   const val=eq>=0?cmd.slice(eq+1):undefined;
   const ok='OK\r\n',val1=(k:string,v:string|number):void=>reply(`+${k}:${v}\r\n${ok}`);
   switch(key){
    case 'AT':reply(ok);break;
    case 'AT+VERSION':if(q)val1('VERSION',VERSION);else reply('ERROR:(0)\r\n');break;
    case 'AT+NAME':if(q)val1('NAME',name);else if(val!==undefined&&val.length>0&&val.length<=32){name=val;reply(ok);}else reply('ERROR:(0)\r\n');break;
    case 'AT+ADDR':if(q)val1('ADDR','98d3:31:fd5a21');else reply('ERROR:(0)\r\n');break;
    case 'AT+UART':
     if(q)val1('UART',`${dataBaud()},${stop},${parity}`);
     else{const p=(val??'').split(',').map(Number);
      if(p.length>=1&&Number.isFinite(p[0])&&p[0]!>=1200&&p[0]!<=1382400){stop=p[1]??0;parity=p[2]??0;ctx.props.baud=String(p[0]);reply(ok);}
      else reply('ERROR:(0)\r\n');}
     break;
    case 'AT+PSWD':case 'AT+PIN':if(q)val1(key==='AT+PIN'?'PIN':'PSWD',pswd);else if(val&&/^\d{1,16}$/.test(val)){pswd=val;reply(ok);}else reply('ERROR:(0)\r\n');break;
    case 'AT+ROLE':if(q)val1('ROLE',role);else if(val==='0'||val==='1'||val==='2'){role=Number(val);reply(ok);}else reply('ERROR:(0)\r\n');break;
    case 'AT+CMODE':if(q)val1('CMODE',cmode);else if(val==='0'||val==='1'||val==='2'){cmode=Number(val);reply(ok);}else reply('ERROR:(0)\r\n');break;
    case 'AT+STATE':if(q)val1('STATE',ctx.props.connected!==false?'CONNECTED':'INITIALIZED');else reply('ERROR:(0)\r\n');break;
    case 'AT+ORGL':name='HC-05';pswd='1234';role=0;cmode=0;stop=0;parity=0;ctx.props.baud='9600';reply(ok);break;
    case 'AT+RESET':reply(ok);break;
    default:reply('ERROR:(0)\r\n');
   }
  }
  function onSketchByte(b:number):void{
   if(!powered())return;
   rx++;
   if(atMode()){
    if(b===0x0a){const cmd=atLine.replace(/\r$/,'');atLine='';if(cmd.length)atCommand(cmd);else reply('ERROR:(0)\r\n');}
    else if(atLine.length<80)atLine+=String.fromCharCode(b);
    return;
   }
   if(!connected())return;
   if(b===0x0a){lastLine=line.replace(/\r$/,'');push('<',lastLine);line='';}
   else if(b!==0x0d&&line.length<120)line+=String.fromCharCode(b);
  }
  /** The phone types a line (popover or setInput). */
  function phoneSends(text:string,ending:string):void{
   if(!connected())return;
   push('>',text);
   const bytes=Array.from(text+ending,c=>c.charCodeAt(0)&0xff);
   tx+=bytes.length;
   link.send(bytes);
  }
  // STATE pin: high while paired
  const statePin=ctx.pin('STATE');
  let lastState:boolean|null=null;
  const syncState=():void=>{
   if(!statePin)return;
   const s=connected();
   if(s!==lastState){lastState=s;ctx.env.setPin(statePin,s);}
  };
  syncState();
  const ledAt=(c:number):boolean=>{
   const t=(c/16000)%2000;   // ms inside a 2 s cycle
   if(!powered())return false;
   if(atMode())return t<1000;                      // slow blink: 2 s period
   if(!connected())return (t%250)<125;             // waiting: 2 Hz
   return t<100||(t>=300&&t<400);                  // paired: double blink every 2 s
  };
  return {
   state:()=>({
    atMode:atMode(),connected:connected(),baud:baud(),led:ledAt(nowC),name,rx,tx,framingErrors:link.framingErrors,
    transcript:log.map(l=>`${l.dir} ${l.text}`).join('\n')+(line&&connected()?`${log.length?'\n':''}< ${printable(line)}_`:''),lastLine,
    ioRx:link.modeRx(),ioTx:link.modeTx(),powered:powered(),state:connected(),
   }),
   setInput(i:PartInput){
    if(i.kind!=='ext'||i.type!=='hc05-bluetooth')return;
    const t=i.v.line;
    if(typeof t==='string')phoneSends(t,typeof i.v.ending==='string'?ENDINGS[i.v.ending]??'':'\n');
   },
   tick(_c,now){
    nowC=now;
    syncState();
    if(ctx.props.send===true){
     ctx.props.send=false;   // momentary: the popover toggle acts as a button
     phoneSends(String(ctx.props.phrase??'LED ON'),ENDINGS[String(ctx.props.ending??'lf')]??'\n');
    }
   },
   onPinChange(pin,level,cycle){link.edge(pin,level,cycle);},
   uart:link.tap(),
  };
 },
});
