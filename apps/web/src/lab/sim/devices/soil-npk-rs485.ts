/**
 * SOIL-NPK-RS485: RS-485 soil NPK / EC / pH / moisture / temperature probe, MODEL ONLY (runtime 'not-emulated').
 * The platform has no device-to-device byte link (ctx.peers gives pins, not models), so this probe cannot answer a MAX485 request
 * from its own state. It shows wiring, the register maps and a pure reply builder (`npkReadResponse`) that Pro's code generator and tests use.
 * Protocol [U]: Modbus RTU, default address 0x01, 4800 8N1 (some units 9600), function 0x03. Register maps are vendor specific and unconfirmed:
 * confirm on your unit. Sources: embdev.net 7-in-1 soil sensor datasheet, sigmanortec 7-in-1 listing (see docs/lab-parts/soil-npk-rs485.md).
 * Pair: scene/parts/soil-npk-rs485.ts (3D). Auto-discovered. Guide: docs/lab-extending.md
 */
import {defineDevice,clamp,num,type Copy} from './types';
import {modbusFrame} from './max485';

export interface SoilNpkPin{key:string;silk:string;kind:'power'|'ground'|'bus';wire:string;levelV:number|null;note:Copy}
/** Cable pins. Colours vary by vendor ([U]): the part says "check the label". */
export const SOIL_NPK_PINS:readonly SoilNpkPin[]=[
 {key:'VCC',silk:'V+',kind:'power',wire:'brown',levelV:null,note:{en:'Supply 5-30 V DC (some units 12-24 V). Brown on most units: check the label.',id:'Catu 5-30 V DC (sebagian unit 12-24 V). Cokelat di kebanyakan unit: cek label.'}},
 {key:'GND',silk:'V-',kind:'ground',wire:'black',levelV:0,note:{en:'Ground. Black on most units.',id:'Ground. Hitam di kebanyakan unit.'}},
 {key:'A',silk:'A+',kind:'bus',wire:'yellow',levelV:null,note:{en:'RS-485 A (D+). Yellow on most units.',id:'RS-485 A (D+). Kuning di kebanyakan unit.'}},
 {key:'B',silk:'B-',kind:'bus',wire:'blue',levelV:null,note:{en:'RS-485 B (D-). Blue on most units.',id:'RS-485 B (D-). Biru di kebanyakan unit.'}},
];
/** Typical 7-in-1 body: ABS cylinder about 45 x 75 mm, needles about 3 x 60 mm, 2-5 m cable [U]. */
export const SOIL_NPK_DIMS={l:75,w:45,h:45,mm:true as const,needleLenMm:60,needleDiaMm:3};

export type NpkQuantity='moisture'|'temperature'|'ec'|'ph'|'n'|'p'|'k';
export interface NpkRegister{reg:number;scale:number}
export interface NpkRegisterMap{id:string;label:string;baud:number;address:number;registers:Record<NpkQuantity,NpkRegister>;source:string;status:'unconfirmed'}
/** Vendor register maps, all [U]: scale = raw counts per unit (pH x100 means raw 650 = pH 6.50). */
export const NPK_REGISTER_MAPS:Record<'jxct-7in1'|'cwt-thcph',NpkRegisterMap>={
 'jxct-7in1':{id:'jxct-7in1',label:'JXCT-style 7-in-1',baud:4800,address:1,source:'https://embdev.net/attachment/640888/7_in_Soil_Sensor_Datasheet.pdf',status:'unconfirmed',
  registers:{ph:{reg:0x0006,scale:100},moisture:{reg:0x0012,scale:10},temperature:{reg:0x0013,scale:10},ec:{reg:0x0015,scale:1},n:{reg:0x001e,scale:1},p:{reg:0x001f,scale:1},k:{reg:0x0020,scale:1}}},
 'cwt-thcph':{id:'cwt-thcph',label:'CWT-style THC-pH',baud:4800,address:1,source:'https://sigmanortec.ro/en/7-in-1-soil-sensor-n-p-k-ph-ec-moisture-temperature-rs485-530v',status:'unconfirmed',
  registers:{moisture:{reg:0x0000,scale:10},temperature:{reg:0x0001,scale:10},ec:{reg:0x0002,scale:1},ph:{reg:0x0003,scale:10},n:{reg:0x0004,scale:1},p:{reg:0x0005,scale:1},k:{reg:0x0006,scale:1}}},
};
/** Request for N, P, K (3 registers from 0x001E) on the jxct map, address 1: `01 03 00 1E 00 03 65 CD`. */
export const NPK_EXAMPLE_REQUEST:readonly number[]=[0x01,0x03,0x00,0x1e,0x00,0x03,0x65,0xcd];

export interface NpkValues{moisture:number;temperature:number;ec:number;ph:number;n:number;p:number;k:number}
export const NPK_DEFAULTS:NpkValues={moisture:32.5,temperature:24.8,ec:620,ph:6.4,n:48,p:22,k:130};

const REAL_MAPS=NPK_REGISTER_MAPS;
/** The raw 16-bit register value of a quantity (negative temperature as two's complement). */
export function npkRaw(map:NpkRegisterMap,q:NpkQuantity,v:NpkValues):number{
 const r=Math.round(v[q]*map.registers[q].scale);
 return (r<0?r+0x10000:r)&0xffff;
}
/** Pure reply to a function 0x03 request addressed to this probe: address, 0x03, byte count, registers (MSB first), CRC. Null when not for us. */
export function npkReadResponse(map:NpkRegisterMap,values:NpkValues,address:number,req:readonly number[]):number[]|null{
 if(req.length<8||req[0]!==address||req[1]!==0x03)return null;
 const reg=(req[2]!<<8)|req[3]!,count=(req[4]!<<8)|req[5]!;
 if(count<1||count>125)return null;
 const byReg=new Map<number,number>();
 for(const q of Object.keys(map.registers) as NpkQuantity[])byReg.set(map.registers[q].reg,npkRaw(map,q,values));
 const body=[address,0x03,count*2];
 for(let i=0;i<count;i++){const w=byReg.get(reg+i)??0;body.push(w>>8,w&0xff);}
 return modbusFrame(body);
}

export type SoilNpkRs485State={runtime:string;map:string;address:number;baud:number;moisture:number;temperature:number;ec:number;ph:number;n:number;p:number;k:number};

export const device=defineDevice<SoilNpkRs485State>({
 kind:'soil-npk-rs485',protocol:'uart',runtime:'not-emulated',
 pins:SOIL_NPK_PINS.map(p=>p.key),
 power:{rail:['VCC','GND'],min:5,max:30,ma:40},
 defaults:{map:'jxct-7in1',address:1,baud:4800,moisture:NPK_DEFAULTS.moisture,temperature:NPK_DEFAULTS.temperature,ec:NPK_DEFAULTS.ec,ph:NPK_DEFAULTS.ph,n:NPK_DEFAULTS.n,p:NPK_DEFAULTS.p,k:NPK_DEFAULTS.k},
 copy:{
  name:{en:'Soil NPK / EC / pH probe (RS-485)',id:'Probe tanah NPK / EC / pH (RS-485)'},
  desc:{en:'A 7-in-1 soil probe with stainless needles and a 4-core cable: moisture, temperature, EC, pH and N, P, K over Modbus RTU on RS-485. It needs a MAX485 module and its own 5-30 V supply.',id:'Probe tanah 7-in-1 dengan jarum stainless dan kabel 4 inti: kelembapan, suhu, EC, pH, serta N, P, K lewat Modbus RTU di RS-485. Butuh modul MAX485 dan catu 5-30 V sendiri.'},
  note:{en:'Model only: the reading comes over RS-485 through a MAX485. Pro writes the Modbus code; it is not run here. NPK from EC is an estimate: calibrate against a lab soil test.',id:'Hanya model: pembacaan datang lewat RS-485 melalui MAX485. Pro menulis kode Modbus-nya; tidak dijalankan di sini. NPK dari EC hanyalah perkiraan: kalibrasi dengan uji tanah laboratorium.'},
 },
 inputs:[
  {type:'choice',key:'map',label:{en:'Register map',id:'Peta register'},options:[{value:'jxct-7in1',label:{en:'JXCT-style',id:'Gaya JXCT'}},{value:'cwt-thcph',label:{en:'CWT-style',id:'Gaya CWT'}}],default:'jxct-7in1'},
  {type:'range',key:'moisture',label:{en:'Moisture (%)',id:'Kelembapan (%)'},min:0,max:100,step:0.5,default:NPK_DEFAULTS.moisture},
  {type:'range',key:'temperature',label:{en:'Temperature (C)',id:'Suhu (C)'},min:-10,max:60,step:0.5,default:NPK_DEFAULTS.temperature},
  {type:'range',key:'ec',label:{en:'EC (uS/cm)',id:'EC (uS/cm)'},min:0,max:5000,step:10,default:NPK_DEFAULTS.ec},
  {type:'range',key:'ph',label:{en:'pH',id:'pH'},min:3,max:9,step:0.1,default:NPK_DEFAULTS.ph},
  {type:'range',key:'n',label:{en:'N (mg/kg)',id:'N (mg/kg)'},min:0,max:1999,step:1,default:NPK_DEFAULTS.n},
  {type:'range',key:'p',label:{en:'P (mg/kg)',id:'P (mg/kg)'},min:0,max:1999,step:1,default:NPK_DEFAULTS.p},
  {type:'range',key:'k',label:{en:'K (mg/kg)',id:'K (mg/kg)'},min:0,max:1999,step:1,default:NPK_DEFAULTS.k},
 ],
 create(ctx){
  return {state:()=>({
   runtime:'not-emulated',map:String(ctx.props.map??'jxct-7in1')in REAL_MAPS?String(ctx.props.map):'jxct-7in1',
   address:clamp(Math.round(num(ctx.props.address,1)),1,247),baud:num(ctx.props.baud,4800),
   moisture:num(ctx.props.moisture,NPK_DEFAULTS.moisture),temperature:num(ctx.props.temperature,NPK_DEFAULTS.temperature),ec:num(ctx.props.ec,NPK_DEFAULTS.ec),
   ph:num(ctx.props.ph,NPK_DEFAULTS.ph),n:num(ctx.props.n,NPK_DEFAULTS.n),p:num(ctx.props.p,NPK_DEFAULTS.p),k:num(ctx.props.k,NPK_DEFAULTS.k),
  })};
 },
});
