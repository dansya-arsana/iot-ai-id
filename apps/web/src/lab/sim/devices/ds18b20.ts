/**
 * DS18B20 digital thermometer (protocol 'onewire') with the real 1-Wire signalling, written from the public datasheet behaviour:
 *   reset:     master holds DQ low >= 480 us; the device answers 15-60 us after the release with a presence pulse of 60-240 us (we use 30 us / 120 us).
 *   slots:     every bit is one time slot started by the master pulling DQ low. Write 1: low 1-15 us. Write 0: low >= 60 us (we decide at 30 us).
 *              Read slot: master low >= 1 us then releases; a device sending 0 keeps DQ low for 30 us from the falling edge, sending 1 stays released.
 *   ROM:       64 bits, LSB first: family 0x28, 48-bit serial, CRC8 (x^8+x^5+x^4+1). Commands 0x33 READ ROM, 0x55 MATCH ROM, 0xCC SKIP ROM,
 *              0xF0 SEARCH ROM (bit, complement bit, master direction bit, per ROM bit), 0xEC ALARM SEARCH.
 *   function:  0x44 CONVERT T (93.75 / 187.5 / 375 / 750 ms for 9..12 bit; read slots return 0 while busy, 1 when done), 0xBE READ SCRATCHPAD (9 bytes, the last is CRC8),
 *              0x4E WRITE SCRATCHPAD (TH, TL, config), 0x48 COPY SCRATCHPAD (10 ms), 0xB8 RECALL E2, 0xB4 READ POWER SUPPLY.
 *   data:      temperature = signed 16 bit, 1/16 degC per LSB; 9/10/11 bit resolution zeroes the 3/2/1 low bits. Power-on value is +85 degC (0x0550).
 * Several sensors may share one wire: the line is wired-AND (any device pulling low keeps it low), which is what makes SEARCH ROM work.
 * The 4.7k pull-up that real wiring needs on DQ is assumed present (ctx.line idles the wire high).
 * Simplifications: the sensor is treated as externally powered (VDD wired, or tied to GND = parasitic mode only changes READ POWER SUPPLY); no strong-pullup timing.
 * Pair: scene/parts/ds18b20.ts. Both are auto-discovered. Guide: docs/lab-extending.md
 */
import type {UnoPin} from '../../contract';
import {defineDevice,clamp,num,us,ms} from './types';
import type {Env,Level} from './types';

export const DS18B20_TEMP={min:-55,max:125};
/** Datasheet timings in microseconds. */
export const DS18B20_US={resetMin:400,presenceDelay:30,presence:120,writeSample:30,readHold:30};
/** Conversion time in ms by resolution bits (datasheet table 2). */
export const DS18B20_CONVERT_MS:Record<number,number>={9:93.75,10:187.5,11:375,12:750};
export const DS18B20_COPY_MS=10;

/** Dallas/Maxim CRC8, polynomial x^8+x^5+x^4+1 (0x8C reflected), initial value 0. */
export function crc8(bytes:readonly number[]):number{
 let crc=0;
 for(let b of bytes){
  for(let i=0;i<8;i++){
   const mix=(crc^b)&1;
   crc>>=1;
   if(mix)crc^=0x8c;
   b>>=1;
  }
 }
 return crc;
}
/** The 64-bit ROM code as 8 bytes (family, serial x6, crc) for a 48-bit serial. */
export function romBytes(serial:readonly number[]):number[]{
 const b=[0x28,...serial.slice(0,6)];
 b.push(crc8(b));
 return b;
}
/** A stable 48-bit serial from a part id (so two sensors on one wire have different ROMs). */
export function serialFromId(id:string):number[]{
 let h=0x811c9dc5;
 const out:number[]=[];
 for(let k=0;k<6;k++){
  for(let i=0;i<id.length;i++){h^=id.charCodeAt(i)+k;h=Math.imul(h,0x01000193)>>>0;}
  h^=h>>>13;h=Math.imul(h,0x5bd1e995)>>>0;
  out.push(h&0xff);
 }
 return out;
}
/** Signed 16 bit temperature word for a temperature, truncated to the resolution (9..12 bits). */
export function tempWord(tempC:number,bits:number):number{
 const t=clamp(tempC,DS18B20_TEMP.min,DS18B20_TEMP.max);
 const raw=Math.round(t*16);
 const drop=12-clamp(bits,9,12);
 return ((raw>>drop)<<drop)&0xffff;
}
export const wordToC=(w:number):number=>((w&0x8000)?w-0x10000:w)/16;

// ---------- wired-AND line shared by every sensor of one env + pin ----------
interface Line{pullers:Set<object>;own:number}
const LINES=new WeakMap<object,Map<string,Line>>();
function lineOf(env:Env,pin:UnoPin):Line{
 let m=LINES.get(env);
 if(!m){m=new Map();LINES.set(env,m);}
 let l=m.get(pin);
 if(!l){l={pullers:new Set(),own:0};m.set(pin,l);}
 return l;
}

export type Ds18b20State={
 tempC:number;
 /** last converted temperature word (signed, 1/16 degC) */
 raw:number;
 /** resolution in bits (9..12) from the config register */
 resolution:number;
 converting:boolean;
 conversions:number;
 resets:number;
 /** protocol state the device is in (for the scene and the tests) */
 mode:string;
 /** the device holds DQ low right now */
 active:boolean;
 alarm:boolean;
 th:number;tl:number;
 /** ROM code as 16 hex digits, family first */
 rom:string;
 /** last ROM command and function command seen */
 romCmd:number;funcCmd:number;
 form:string;
};

type Mode='idle'|'rom-cmd'|'match'|'func-cmd'|'tx'|'poll'|'write-sp'|'search-dir';

export const device=defineDevice<Ds18b20State>({
 kind:'ds18b20',protocol:'onewire',
 // TO-92 seen from the flat face: 1 GND, 2 DQ, 3 VDD. The waterproof probe cable is black, yellow, red in the same order.
 pins:['GND','DQ','VDD'],holes:[0,1,2],bodyX:[-2.5,5.5],
 copy:{
  name:{en:'DS18B20 digital thermometer',id:'Termometer digital DS18B20'},
  desc:{en:'A one-wire thermometer with a unique 64-bit address. Many can share one wire; it answers a reset, ROM commands and temperature commands bit by bit.',id:'Termometer satu kabel dengan alamat unik 64 bit. Banyak sensor bisa berbagi satu kabel; ia menjawab reset, perintah ROM, dan perintah suhu bit demi bit.'},
  note:{en:'Slide the temperature. The sketch must send Convert T and wait before it reads the scratchpad. Real wiring needs a 4.7k pull-up from DQ to VDD; the simulator supplies it.',id:'Geser suhunya. Sketsa harus mengirim Convert T dan menunggu sebelum membaca scratchpad. Kabel nyata butuh pull-up 4,7k dari DQ ke VDD; simulator menyediakannya.'},
 },
 power:{rail:['VDD','GND'],min:3,max:5.5,ma:1.5},
 inputs:[
  {type:'range',key:'tempC',label:{en:'Temperature',id:'Suhu'},min:DS18B20_TEMP.min,max:DS18B20_TEMP.max,step:0.5,unit:'°C',default:24},
  {type:'choice',key:'form',label:{en:'Package',id:'Kemasan'},options:[{value:'to92',label:{en:'TO-92 chip',id:'Chip TO-92'}},{value:'probe',label:{en:'Waterproof probe',id:'Probe tahan air'}}],default:'to92'},
 ],
 defaults:{tempC:24,form:'to92'},
 create(ctx){
  const dq=ctx.pin('DQ');
  const who={};
  const line=dq?lineOf(ctx.env,dq):null;
  const rom=romBytes(serialFromId(ctx.id));
  const romBit=(i:number):number=>(rom[i>>3]!>>(i&7))&1;
  // scratchpad: 0,1 temperature, 2 TH, 3 TL, 4 config, 5..7 reserved, 8 CRC (computed on read)
  const eeprom={th:0x4b,tl:0x46,cfg:0x7f};
  const sp=new Uint8Array(8);
  const loadFromEeprom=():void=>{sp[2]=eeprom.th;sp[3]=eeprom.tl;sp[4]=eeprom.cfg;};
  sp[0]=0x50;sp[1]=0x05;sp[5]=0xff;sp[6]=0x0c;sp[7]=0x10;loadFromEeprom();   // power-on: +85 degC
  const resBits=():number=>9+((sp[4]!>>5)&3);
  const spBytes=():number[]=>{const b=Array.from(sp);b.push(crc8(b));return b;};

  let mode:Mode='idle';
  let readIsOpen=false,fallAt=-1,resets=0,conversions=0,romCmd=0,funcCmd=0;
  let converting=false,busy=false,alarm=false,holding=false,epoch=0;
  let rx:number[]=[],txq:number[]=[],afterTx:(()=>void)|null=null;
  let searchIdx=0,wspIdx=0,matchIdx=0;
  const powered=():boolean=>ctx.net('VDD')!=='GND';

  const pull=(low:boolean):void=>{
   if(!line||!dq)return;
   const was=line.pullers.size>0;
   if(low)line.pullers.add(who);else line.pullers.delete(who);
   const now=line.pullers.size>0;
   holding=low;
   if(was!==now){line.own++;try{ctx.env.setPin(dq,!now);}finally{line.own--;}}
  };
  const hold=(micro:number):void=>{
   pull(true);const my=++epoch;
   ctx.schedule(us(micro),()=>{if(my===epoch)pull(false);});
  };
  if(dq)ctx.line(dq,true);

  const intTemp=():number=>Math.floor(wordToC((sp[1]!<<8)|sp[0]!));   // bits 11..4: the integer part, rounded down
  const s8=(v:number):number=>v>127?v-256:v;
  const evalAlarm=():void=>{const t=intTemp();alarm=t>=s8(sp[2]!)||t<=s8(sp[3]!);};

  const toTx=(bits:number[],then:(()=>void)|null):void=>{txq=bits;afterTx=then;mode='tx';if(!bits.length){mode='idle';then?.();}};
  const bytesToBits=(b:readonly number[]):number[]=>{const o:number[]=[];for(const v of b)for(let i=0;i<8;i++)o.push((v>>i)&1);return o;};
  const toIdle=():void=>{mode='idle';txq=[];afterTx=null;rx=[];};
  const byteOf=(bits:number[]):number=>bits.reduce((a,b,i)=>a|(b<<i),0);

  function reset():void{
   resets++;toIdle();
   mode='rom-cmd';rx=[];
   ctx.schedule(us(DS18B20_US.presenceDelay),()=>{hold(DS18B20_US.presence);});
  }
  function startSearch():void{
   searchIdx=0;mode='tx';
   searchStep();
  }
  function searchStep():void{
   const b=romBit(searchIdx);
   toTx([b,b^1],()=>{mode='search-dir';rx=[];});
  }
  function romCommand(cmd:number):void{
   romCmd=cmd;rx=[];
   switch(cmd){
    case 0x33:toTx(bytesToBits(rom),()=>{mode='func-cmd';});break;
    case 0x55:mode='match';matchIdx=0;break;
    case 0xcc:mode='func-cmd';break;
    case 0xf0:startSearch();break;
    case 0xec:if(alarm)startSearch();else toIdle();break;
    default:toIdle();   // unknown ROM command: ignore until the next reset
   }
  }
  function startConvert():void{
   if(converting)return;
   converting=true;const bits=resBits();
   ctx.schedule(ms(DS18B20_CONVERT_MS[bits]!),()=>{
    const w=tempWord(num(ctx.props.tempC,24),resBits());
    sp[0]=w&0xff;sp[1]=w>>8;converting=false;conversions++;evalAlarm();
   });
  }
  function funcCommand(cmd:number):void{
   funcCmd=cmd;rx=[];
   switch(cmd){
    case 0x44:startConvert();mode='poll';break;
    case 0xbe:toTx(bytesToBits(spBytes()),()=>{mode='idle';});break;
    case 0x4e:mode='write-sp';wspIdx=0;break;
    case 0x48:busy=true;mode='poll';ctx.schedule(ms(DS18B20_COPY_MS),()=>{eeprom.th=sp[2]!;eeprom.tl=sp[3]!;eeprom.cfg=sp[4]!;busy=false;});break;
    case 0xb8:loadFromEeprom();mode='poll';break;
    case 0xb4:toTx([powered()?1:0],()=>{mode='idle';});break;
    default:toIdle();
   }
  }
  /** a write slot decoded from the low time */
  function writeBit(bit:number):void{
   switch(mode){
    case 'rom-cmd':rx.push(bit);if(rx.length===8)romCommand(byteOf(rx));break;
    case 'func-cmd':rx.push(bit);if(rx.length===8)funcCommand(byteOf(rx));break;
    case 'match':
     if(bit!==romBit(matchIdx)){toIdle();break;}
     matchIdx++;if(matchIdx===64){mode='func-cmd';rx=[];}
     break;
    case 'write-sp':{
     rx.push(bit);
     if(rx.length===8){
      const v=byteOf(rx);rx=[];
      if(wspIdx===0)sp[2]=v;else if(wspIdx===1)sp[3]=v;else if(wspIdx===2)sp[4]=(v&0x60)|0x1f;
      wspIdx++;
      if(wspIdx===3)toIdle();
     }
     break;
    }
    case 'search-dir':
     if(bit!==romBit(searchIdx)){toIdle();break;}   // this device is not on the master's branch
     searchIdx++;
     if(searchIdx===64){mode='func-cmd';rx=[];}else searchStep();
     break;
    default:break;
   }
  }
  /** a read slot started by the master's falling edge */
  function readSlot():boolean{
   if(mode==='tx'){
    const bit=txq.shift()!;
    if(bit===0)hold(DS18B20_US.readHold);
    if(!txq.length){const f=afterTx;afterTx=null;if(mode==='tx')mode='idle';f?.();}
    return true;
   }
   if(mode==='poll'){
    const done=!(converting||busy);
    if(!done)hold(DS18B20_US.readHold);
    return true;
   }
   return false;
  }
  const modeName=():string=>mode;
  return {
   state:()=>{
    const w=(sp[1]!<<8)|sp[0]!;
    return {
     tempC:clamp(num(ctx.props.tempC,24),DS18B20_TEMP.min,DS18B20_TEMP.max),raw:w>0x7fff?w-0x10000:w,resolution:resBits(),converting,conversions,resets,
     mode:modeName(),active:holding,alarm,th:s8(sp[2]!),tl:s8(sp[3]!),
     rom:rom.map(b=>b.toString(16).padStart(2,'0')).join(''),romCmd,funcCmd,form:String(ctx.props.form??'to92'),
    };
   },
   onPinChange(pin:UnoPin,level:Level,cycle:number){
    if(pin!==dq||!line||line.own>0)return;
    if(level===0){fallAt=cycle;readIsOpen=readSlot();return;}
    if(fallAt<0||readIsOpen&&cycle-fallAt<us(DS18B20_US.resetMin))return;   // the rise that ends a read slot is not a write
    const low=cycle-fallAt;
    if(low>=us(DS18B20_US.resetMin)){reset();return;}
    if(mode==='tx'||mode==='poll'||mode==='idle')return;
    writeBit(low<us(DS18B20_US.writeSample)?1:0);
   },
  };
 },
});
