/**
 * Pin allocator (plan D1, arch §3.5). Deterministic by board profile: I2C 21/22, 1-Wire 4, ADC1 only, LoRa SPI 18/19/23 with CS 5,
 * RST 14, DIO0 26, UART2 16/17. Never strap, flash or input-only pins for outputs. The model may propose other pins; validate_netlist decides.
 */
import type {z} from 'zod';
import type {PinRowSchema} from '../spec-reexports.js';
import {boardProfile,kindOf,mkIssue,pinDefs,refIndex,kindFromRef,type PartLookup,type ToolIssue,type BoardProfile} from './common.js';

export type PinRow=z.infer<typeof PinRowSchema>;
export type AllocPart={ref:string;partId:string};
export type AllocResult={pins:PinRow[];issues:ToolIssue[]};

const ACTUATOR_RE=/relay|valve|pump|fan|mosfet|lamp|led|buzzer|motor|ssr/i;
const FUNC_PRIORITY=['i2c-sda','i2c-scl','spi-sck','spi-mosi','spi-miso','spi-cs','uart-tx','uart-rx','onewire','adc','reset','irq','rs485-de','pwm','digital-out','digital-in'] as const;
type Func=typeof FUNC_PRIORITY[number];
const SHARED:ReadonlySet<Func>=new Set(['i2c-sda','i2c-scl','spi-sck','spi-mosi','spi-miso','onewire']);
const BUS_NOTE:Partial<Record<Func,{en:string;id:string}>>={
 'i2c-sda':{en:'Shared I2C bus',id:'Bus I2C bersama'},'i2c-scl':{en:'Shared I2C bus',id:'Bus I2C bersama'},
 'spi-sck':{en:'Shared SPI bus',id:'Bus SPI bersama'},'spi-mosi':{en:'Shared SPI bus',id:'Bus SPI bersama'},'spi-miso':{en:'Shared SPI bus',id:'Bus SPI bersama'},
 onewire:{en:'Shared 1-Wire bus',id:'Bus 1-Wire bersama'},adc:{en:'ADC1 pin (works with Wi-Fi on)',id:'Pin ADC1 (aman saat Wi-Fi aktif)'},
};
const SYMBOL_BASE=(ref:string)=>kindFromRef(ref).toUpperCase().replace(/[^A-Z0-9]+/g,'_').replace(/^_+|_+$/g,'')||'PART';
const shortSym=(s:string)=>s.slice(0,32);

/** Pick the primary function of a part pin, or undefined for power, ground and nc. */
export function primaryFunc(funcs:readonly string[],kind:string):Func|undefined{
 for(const f of FUNC_PRIORITY){
  if(f==='digital-in'||f==='digital-out')continue;
  if(funcs.includes(f))return f;
 }
 if(funcs.includes('digital-out')||funcs.includes('digital-in')){
  if(funcs.includes('digital-out')&&(!funcs.includes('digital-in')||ACTUATOR_RE.test(kind)))return 'digital-out';
  return 'digital-in';
 }
 return undefined;
}

export function allocatePins(input:{board:string;parts:AllocPart[]},lookup:PartLookup):AllocResult{
 const b:BoardProfile=boardProfile(input.board);
 const a=b.alloc,issues:ToolIssue[]=[],pins:PinRow[]=[];
 const used=new Set<string>();
 const shared=new Map<string,string>();           // bus func -> board pin
 const symbols=new Set<string>();
 const take=(pool:string[],func:Func):string|undefined=>{
  for(const p of pool){
   const def=b.pins[p];
   if(!def||used.has(p)||def.strap||def.flash||def.reserved)continue;
   if(func!=='digital-in'&&func!=='adc'&&func!=='irq'&&!def.out)continue;
   if(func==='adc'&&!def.adc)continue;
   if(func==='adc'&&def.adc===2&&b.wifi)continue;           // ADC2 is unusable with Wi-Fi on
   return p;
  }
  return undefined;
 };
 const fixedPool=(f:Func):string[]=>{
  switch(f){
   case 'i2c-sda':return [a.i2c.sda];case 'i2c-scl':return [a.i2c.scl];
   case 'spi-sck':return [a.spi.sck];case 'spi-mosi':return [a.spi.mosi];case 'spi-miso':return [a.spi.miso];
   case 'onewire':return [a.onewire,...a.out];
   case 'spi-cs':return [...a.spi.cs,...a.out];
   case 'reset':return [...a.rst,...a.out];
   case 'irq':return [...a.irq,...a.inp,...a.out];
   case 'uart-tx':return [a.uart.rx];                      // part TX goes to board RX
   case 'uart-rx':return [a.uart.tx];
   case 'adc':return a.adc;
   case 'digital-in':return [...a.inp,...a.out];
   default:return a.out;
  }
 };
 for(const part of input.parts){
  const rec=lookup(part.partId);
  if(!rec){issues.push(mkIssue('part.unknown','error',`Part ${part.partId} is not in the catalog.`,`Part ${part.partId} tidak ada di katalog.`,part.ref));continue;}
  const kind=kindOf(rec);
  const n=refIndex(part.ref);
  const sigPins=pinDefs(rec).filter(p=>primaryFunc(p.func,kind));
  for(const def of sigPins){
   const f=primaryFunc(def.func,kind)!;
   let board:string|undefined;
   if(SHARED.has(f)&&shared.has(f)){board=shared.get(f);}
   else{
    board=take(fixedPool(f),f);
    if(board)used.add(board);
    if(board&&SHARED.has(f))shared.set(f,board);
   }
   if(!board){
    issues.push(mkIssue('alloc.no-pin','error',`No free ${f} pin on ${b.label} for ${part.ref}.${def.name}.`,`Tidak ada pin ${f} bebas di ${b.label} untuk ${part.ref}.${def.name}.`,part.ref,'B'));
    continue;
   }
   const bp=b.pins[board]!;
   const single=sigPins.length===1;
   let sym=shortSym(`PIN_${SYMBOL_BASE(part.ref)}_${single?n:`${n}_${def.name.toUpperCase().replace(/[^A-Z0-9]+/g,'_')}`}`);
   for(let k=2;symbols.has(sym);k++)sym=shortSym(sym.replace(/_\d+$/,'')+`_${k}`);
   symbols.add(sym);
   const note=BUS_NOTE[f];
   pins.push({boardPin:board,gpio:bp.gpio,func:f,part:part.ref,partPin:def.name.slice(0,12),symbol:sym,...(note?{note}:{})});
  }
 }
 // gpio sanity for AVR analog pins used as digital is allowed; nothing else to check here.
 return {pins,issues};
}
