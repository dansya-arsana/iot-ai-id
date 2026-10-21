import {FLASH_WORDS} from '../contract';
import type {FirmwareParam,ParamValues} from '../contract';

export function decodeFlash(b64:string):Uint8Array{
 const bin=globalThis.atob(b64);
 const out=new Uint8Array(bin.length);
 for(let i=0;i<bin.length;i++)out[i]=bin.charCodeAt(i);
 return out;
}

const WIDTH:Record<FirmwareParam['ctype'],number>={uint8:1,int16:2,uint16:2,int32:4,uint32:4};

export function patchFlash(flash:Uint8Array,params:FirmwareParam[],values:ParamValues):{bytes:Uint8Array;patched:{name:string;value:number;offset:number}[]}{
 const known=new Set(params.map(p=>p.name));
 for(const k of Object.keys(values))if(!known.has(k))throw new RangeError(`unknown param "${k}"`);
 const bytes=new Uint8Array(flash);
 const patched:{name:string;value:number;offset:number}[]=[];
 for(const p of params){
  const value=values[p.name]??p.defaultValue;
  if(!Number.isInteger(value))throw new RangeError(`param "${p.name}" must be an integer`);
  if(value<p.min||value>p.max)throw new RangeError(`param "${p.name}" must be within ${p.min}..${p.max}`);
  const width=WIDTH[p.ctype];
  if(p.offset<0||p.offset+width>bytes.length)throw new RangeError(`param "${p.name}" offset outside flash`);
  let v=value<0?value+2**(8*width):value; // two's complement for signed
  for(let i=0;i<width;i++){bytes[p.offset+i]=v%256;v=Math.floor(v/256);}
  patched.push({name:p.name,value,offset:p.offset});
 }
 return {bytes,patched};
}

export function toProgramWords(bytes:Uint8Array):Uint16Array{
 if(bytes.length>FLASH_WORDS*2)throw new RangeError('firmware larger than 32 KiB');
 const words=new Uint16Array(FLASH_WORDS);
 for(let i=0;i+1<bytes.length;i+=2)words[i>>1]=bytes[i]|(bytes[i+1]<<8);
 if(bytes.length%2)words[bytes.length>>1]=bytes[bytes.length-1];
 return words;
}

export function buildLineIndex(lines:[number,number,number][]):Int32Array{
 const idx=new Int32Array(FLASH_WORDS);
 for(const [first,last,line] of lines){
  const a=Math.max(0,first),b=Math.min(FLASH_WORDS-1,last);
  for(let i=a;i<=b;i++)idx[i]=line;
 }
 return idx;
}
