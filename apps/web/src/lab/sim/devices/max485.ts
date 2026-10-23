/**
 * MAX485 TTL <-> RS-485 module (protocol 'uart'), emulated TX side.
 * Datasheet (Maxim MAX1487-MAX491): 4.75-5.25 V, half-duplex, DE high enables the driver, RE low enables the receiver, 2.5 Mbit/s, 32 unit loads.
 * The sketch's Serial TX (DI) reaches the bus only while DE is high; bytes sent with DE low are counted as "driver off" (the classic bug).
 * Bytes are grouped into Modbus RTU frames by a silence of 3.5 characters (11 bits each) at the `baud` prop, and checked with CRC-16
 * (poly 0xA001, init 0xFFFF, low byte first). No bus partner is emulated: the platform has no device-to-device byte link
 * (ctx.peers gives pins, not models), so a reply only exists when the popover terminal injects one (hex), sent on RO with real UART timing.
 * Pair: scene/parts/max485.ts (3D). Auto-discovered. Guide: docs/lab-extending.md
 */
import type {PartInput} from '../../contract';
import {defineDevice,extInput,type Copy,type Level} from './types';

/** CRC-16/MODBUS (poly 0xA001 reflected, init 0xFFFF). The frame carries it low byte first. */
export function modbusCrc16(bytes:readonly number[]):number{
 let crc=0xffff;
 for(const b of bytes){crc^=b&0xff;for(let i=0;i<8;i++)crc=crc&1?(crc>>1)^0xa001:crc>>1;}
 return crc&0xffff;
}
/** Append the CRC (low byte first) to a PDU that starts with the slave address. */
export const modbusFrame=(body:readonly number[]):number[]=>{const c=modbusCrc16(body);return [...body,c&0xff,c>>8];};
export interface ModbusFrame{addr:number;fn:number;reg:number;count:number;crcOk:boolean;length:number}
/** Decode a frame as a master request (function 3/4: start register and count follow the function). */
export function decodeModbus(b:readonly number[]):ModbusFrame|null{
 if(b.length<4)return null;
 const body=b.slice(0,-2),crc=modbusCrc16(body);
 const crcOk=(b[b.length-2]!|(b[b.length-1]!<<8))===crc;
 const req=b.length>=8;
 return {addr:b[0]!,fn:b[1]!,reg:req?(b[2]!<<8)|b[3]!:0,count:req?(b[4]!<<8)|b[5]!:0,crcOk,length:b.length};
}

/** The pin table (Pro M5 reads it). `kind` is the electrical role; level is the logic level the pin swings to. */
export interface Max485Pin{key:string;no:number;silk:string;kind:'power'|'ground'|'io'|'bus'|'terminal';levelV:number|null;note:Copy}
export const MAX485_PINS:readonly Max485Pin[]=[
 {key:'RO',no:1,silk:'RO',kind:'io',levelV:5,note:{en:'Receiver output (to MCU RX). Swings to VCC: 5 V into a 3.3 V pin needs a divider, or use a MAX3485 module.',id:'Keluaran penerima (ke RX MCU). Naik sampai VCC: 5 V ke pin 3,3 V butuh pembagi tegangan, atau pakai modul MAX3485.'}},
 {key:'RE',no:2,silk:'RE',kind:'io',levelV:5,note:{en:'Receiver enable, active low. Usually bridged to DE.',id:'Enable penerima, aktif low. Biasanya dijumper ke DE.'}},
 {key:'DE',no:3,silk:'DE',kind:'io',levelV:5,note:{en:'Driver enable, active high: high = transmit.',id:'Enable pengirim, aktif high: high = mengirim.'}},
 {key:'DI',no:4,silk:'DI',kind:'io',levelV:5,note:{en:'Driver input (from MCU TX).',id:'Masukan pengirim (dari TX MCU).'}},
 {key:'VCC',no:5,silk:'VCC',kind:'power',levelV:5,note:{en:'5 V supply (4.75-5.25 V).',id:'Catu 5 V (4,75-5,25 V).'}},
 {key:'B',no:6,silk:'B',kind:'bus',levelV:null,note:{en:'Bus line B (inverting, D-). Same net as the B screw terminal.',id:'Jalur bus B (membalik, D-). Satu net dengan terminal sekrup B.'}},
 {key:'A',no:7,silk:'A',kind:'bus',levelV:null,note:{en:'Bus line A (non-inverting, D+). Same net as the A screw terminal.',id:'Jalur bus A (tidak membalik, D+). Satu net dengan terminal sekrup A.'}},
 {key:'GND',no:8,silk:'GND',kind:'ground',levelV:0,note:{en:'Ground.',id:'Ground.'}},
 {key:'A_T',no:9,silk:'A',kind:'terminal',levelV:null,note:{en:'Screw terminal A (wires only).',id:'Terminal sekrup A (hanya kabel).'}},
 {key:'B_T',no:10,silk:'B',kind:'terminal',levelV:null,note:{en:'Screw terminal B (wires only).',id:'Terminal sekrup B (hanya kabel).'}},
];
/** Body size in mm (vendors list 44x13 to 45x20: we model 44 x 14). */
export const MAX485_DIMS={l:44,w:14,h:12,mm:true as const};

export type Max485State={
 driverOn:boolean;receiverOn:boolean;baud:number;busBytes:number;driverOffBytes:number;frames:number;
 lastAddr:number;lastFn:number;lastReg:number;lastCount:number;crcOk:boolean;lastHex:string;roBytes:number;partner:string;transcript:string;
};

const hex2=(b:number):string=>b.toString(16).padStart(2,'0').toUpperCase();
/** Parse "01 03 00 1E 00 03 65 CD" (or 0x-prefixed, or comma separated) into bytes; null when invalid. */
export function parseHex(s:string):number[]|null{
 const t=s.replace(/0x/gi,' ').split(/[\s,]+/).filter(Boolean);
 if(!t.length)return null;
 const out:number[]=[];
 for(const x of t){if(!/^[0-9a-f]{1,2}$/i.test(x))return null;out.push(parseInt(x,16));}
 return out;
}

export const device=defineDevice<Max485State>({
 kind:'max485',protocol:'uart',
 pins:MAX485_PINS.map(p=>p.key),holes:[0,1,2,3],bodyX:[-3,43],
 power:{rail:['VCC','GND'],min:4.75,max:5.25,ma:10},
 defaults:{baud:9600},
 copy:{
  name:{en:'MAX485 RS-485 module',id:'Modul RS-485 MAX485'},
  desc:{en:'Turns the 5 V serial of a microcontroller into a half-duplex RS-485 bus (A/B pair) for long cables and Modbus sensors. The driver only sends while DE is high.',id:'Mengubah serial 5 V mikrokontroler menjadi bus RS-485 half-duplex (pasangan A/B) untuk kabel panjang dan sensor Modbus. Pengirim hanya aktif saat DE high.'},
  note:{en:'Emulated on the transmit side: the lab decodes your Modbus frames and checks the CRC. No bus partner is emulated; paste a reply as hex to feed RO.',id:'Diemulasi di sisi kirim: lab membaca frame Modbus dan memeriksa CRC. Tidak ada perangkat di bus; tempel balasan dalam hex untuk mengisi RO.'},
 },
 inputs:[
  {type:'choice',key:'baud',label:{en:'Baud rate',id:'Baud rate'},options:[{value:'4800',label:{en:'4800',id:'4800'}},{value:'9600',label:{en:'9600',id:'9600'}},{value:'19200',label:{en:'19200',id:'19200'}}],default:'9600'},
  {type:'terminal',key:'reply',label:{en:'Inject a reply (hex)',id:'Suntik balasan (hex)'},placeholder:{en:'01 03 06 ... CRC',id:'01 03 06 ... CRC'},input:'max485',log:'transcript'},
 ],
 create(ctx){
  const baud=():number=>{const b=Number(ctx.props.baud);return b>=1200&&b<=115200?b:9600;};
  const silence=():number=>Math.round(3.5*11/baud()*16e6);   // 3.5 characters of 11 bits, in CPU cycles
  const level=(name:string):Level|null=>{
   const n=ctx.net(name);
   if(n==='5V')return 1;
   if(n==='GND')return 0;
   const p=ctx.pin(name);
   return p?ctx.pinLevel(p):null;
  };
  let cur:number[]=[],lastAt=0,busBytes=0,off=0,frames=0,roBytes=0;
  let fr:ModbusFrame|null=null,lastHex='';
  const log:string[]=[];
  const push=(s:string):void=>{log.push(s);if(log.length>6)log.shift();};
  const close=():void=>{
   if(!cur.length)return;
   frames++;lastHex=cur.map(hex2).join(' ');fr=decodeModbus(cur);
   push(`> ${lastHex}${fr?fr.crcOk?'':' (bad CRC)':' (short)'}`);
   cur=[];
  };
  const driver=():boolean=>level('DE')===1;
  const receiver=():boolean=>level('RE')===0;
  return {
   state:()=>({
    driverOn:driver(),receiverOn:receiver(),baud:baud(),busBytes,driverOffBytes:off,frames,
    lastAddr:fr?.addr??0,lastFn:fr?.fn??0,lastReg:fr?.reg??0,lastCount:fr?.count??0,crcOk:fr?.crcOk??false,lastHex,roBytes,
    partner:'no bus partner emulated',transcript:log.join('\n'),
   }),
   tick(_c,now){if(cur.length&&now-lastAt>silence())close();},
   uart:{onTx(byte,cycle){
    if(!driver()){off++;if(off===1)push('! sent with the driver off (DE low)');return;}
    if(cur.length&&cycle-lastAt>silence())close();
    cur.push(byte&0xff);busBytes++;lastAt=cycle;
   }},
   setInput(i:PartInput){
    if(i.kind!=='ext'||i.type!=='max485')return;
    const line=i.v.line;
    if(typeof line!=='string')return;
    const b=parseHex(line);
    if(!b){push('! not hex: '+line.slice(0,24));return;}
    if(!receiver()){push('! RE is high: the receiver is off, RO stays idle');return;}
    push('< '+b.map(hex2).join(' '));
    b.forEach((x,k)=>ctx.schedule(k*Math.round(10/baud()*16e6),()=>{roBytes++;ctx.uartSend(x);}));   // one 10-bit 8N1 frame per byte
   },
  };
 },
});
export const max485Reply=(hex:string)=>extInput('max485',{line:hex});
