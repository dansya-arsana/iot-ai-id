/**
 * BMP280 barometric pressure and temperature sensor (protocol 'i2c'), no humidity (that is the BME280's job).
 * Written from the public datasheet (BST-BMP280-DS001): chip id 0x58 at 0xD0, reset 0xE0 (0xB6), status 0xF3 (measuring bit 3, im_update bit 0),
 * ctrl_meas 0xF4 (osrs_t, osrs_p, mode), config 0xF5 (t_sb, filter), data 0xF7..0xFC (20-bit pressure then temperature, MSB first),
 * calibration 0x88..0x9F (T1..T3, P1..P9, little-endian; T1 and P1 unsigned), and the integer compensation formulas of section 3.11.3.
 * The popover shows physical values: they are turned into raw ADC words by inverting those same formulas against our fixed calibration set (bisection),
 * so a sketch that runs the standard Bosch formulas reads the popover values back to within one raw LSB.
 * Modes: sleep, forced (one conversion, back to sleep), normal (conversions separated by the t_standby of the config register).
 * IIR filter (config bits 4:2 = off, 2, 4, 8, 16) is applied to pressure and temperature: filtered = (filtered*(c-1) + new)/c; the first sample seeds it.
 * Address 0x76 when SDO is wired to GND or left open, 0x77 when SDO is wired to the supply (real board behaviour).
 * Pair: scene/parts/bmp280.ts. Both are auto-discovered. Guide: docs/lab-extending.md
 */
import {defineDevice,clamp,num,ms} from './types';

export type Bmp280State={temperature:number;pressure:number;mode:number;measuring:boolean;address:number;reads:number;writes:number;conversions:number;filter:number;/** raw 20-bit words of the last conversion */rawT:number;rawP:number};

/** Calibration set (the trim values of one chip; the sketch reads them from 0x88..0x9F). */
export const CAL={T1:28011,T2:26558,T3:-1000,P1:37284,P2:-10684,P3:3024,P4:6320,P5:-68,P6:-7,P7:15500,P8:-14600,P9:6000};

/** t_fine of datasheet 3.11.3 (32-bit integer). */
export function tFine(adcT:number):number{
 const v1=(((adcT>>3)-(CAL.T1<<1))*CAL.T2)>>11;
 const d=(adcT>>4)-CAL.T1;
 const v2=(((d*d>>12)*CAL.T3)>>14);
 return v1+v2;
}
/** Temperature in 0.01 degC. */
export const compT=(adcT:number):number=>(tFine(adcT)*5+128)>>8;
/** Pressure in Pa as Q24.8 (the 64-bit formula, BigInt keeps it exact). */
export function compP(adcP:number,tf:number):number{
 let v1=BigInt(tf)-128000n;
 let v2=v1*v1*BigInt(CAL.P6);
 v2=v2+((v1*BigInt(CAL.P5))<<17n);
 v2=v2+(BigInt(CAL.P4)<<35n);
 v1=((v1*v1*BigInt(CAL.P3))>>8n)+((v1*BigInt(CAL.P2))<<12n);
 v1=(((1n<<47n)+v1)*BigInt(CAL.P1))>>33n;
 if(v1===0n)return 0;
 let p=1048576n-BigInt(adcP);
 p=(((p<<31n)-v2)*3125n)/v1;
 v1=(BigInt(CAL.P9)*(p>>13n)*(p>>13n))>>25n;
 v2=(BigInt(CAL.P8)*p)>>19n;
 p=((p+v1+v2)>>8n)+(BigInt(CAL.P7)<<4n);
 return Number(p);
}

/** Find the raw word whose compensated value is closest to `target` (f monotonic on [0,max]). */
function invert(f:(raw:number)=>number,target:number,max:number):number{
 const up=f(max)>=f(0);
 let lo=0,hi=max;
 while(lo<hi){
  const mid=(lo+hi)>>1;
  const above=f(mid)>=target;
  if(above===up)hi=mid;else lo=mid+1;
 }
 if(lo>0&&Math.abs(f(lo-1)-target)<Math.abs(f(lo)-target))return lo-1;
 return lo;
}
/** Physical values to raw 20-bit words. Temperature is inverted first because pressure depends on t_fine. */
export function rawFromPhysical(tC:number,pPa:number):{t:number;p:number}{
 const t=invert(compT,Math.round(tC*100),(1<<20)-1);
 const tf=tFine(t);
 const p=invert(a=>compP(a,tf),Math.round(pPa*256),(1<<20)-1);
 return {t,p};
}

/** Calibration registers 0x88..0x9F exactly as the chip stores them. */
function calibrationBytes():Map<number,number>{
 const m=new Map<number,number>();
 const w16=(a:number,v:number)=>{m.set(a,v&0xff);m.set(a+1,(v>>8)&0xff);};
 w16(0x88,CAL.T1);w16(0x8a,CAL.T2);w16(0x8c,CAL.T3);
 w16(0x8e,CAL.P1);w16(0x90,CAL.P2);w16(0x92,CAL.P3);w16(0x94,CAL.P4);w16(0x96,CAL.P5);w16(0x98,CAL.P6);w16(0x9a,CAL.P7);w16(0x9c,CAL.P8);w16(0x9e,CAL.P9);
 return m;
}

const OSRS=[0,1,2,4,8,16,16,16];
/** Standby time in ms by t_sb (datasheet table 11). */
export const T_STANDBY=[0.5,62.5,125,250,500,1000,2000,4000];
export const FILTER_C=[1,2,4,8,16,16,16,16];
/** Maximum measurement time in ms (datasheet 3.8.1): 1.25 + 2.3*Tosr + 2.3*Posr + 0.575. */
export const measMs=(ot:number,op:number):number=>(ot?1.25+2.3*OSRS[ot]!:0)+(op?2.3*OSRS[op]!+0.575:0);
/** Bits kept for an oversampling setting: 16 bit at x1 up to 20 bit at x16 (without IIR the resolution follows osrs). */
const resBits=(o:number):number=>o===0?0:Math.min(20,15+o);

export const device=defineDevice<Bmp280State>({
 kind:'bmp280',protocol:'i2c',
 // GY-BMP280 header order: VCC GND SCL SDA CSB SDO (CSB high selects I2C; SDO picks the address)
 pins:['VCC','GND','SCL','SDA','CSB','SDO'],holes:[0,1,2,3,4,5],bodyX:[-1.2,13.9],
 copy:{
  name:{en:'BMP280 pressure sensor',id:'Sensor tekanan BMP280'},
  desc:{en:'Measures air pressure and temperature over I2C. Its chip id is 0x58, and a sketch turns the raw numbers into real units with the trim values stored in the chip.',id:'Mengukur tekanan udara dan suhu lewat I2C. Id chipnya 0x58, dan sketsa mengubah angka mentah menjadi satuan nyata memakai nilai trim yang tersimpan di chip.'},
  note:{en:'Click it to set the pressure and temperature it senses. SDO to 5V moves it to address 0x77. This is a 3.3 V module.',id:'Klik untuk mengatur tekanan dan suhu yang ia rasakan. SDO ke 5V memindahkannya ke alamat 0x77. Ini modul 3,3 V.'},
 },
 power:{rail:['VCC','GND'],min:1.71,max:3.6,ma:0.4},
 inputs:[
  {type:'range',key:'temperature',label:{en:'Temperature',id:'Suhu'},min:-40,max:85,step:0.5,unit:'°C',default:25},
  {type:'range',key:'pressure',label:{en:'Pressure',id:'Tekanan'},min:300,max:1100,step:1,unit:'hPa',default:1013},
 ],
 defaults:{temperature:25,pressure:1013},
 create(ctx){
  const cal=calibrationBytes();
  let ptr=0,first=false,reads=0,writes=0,conversions=0;
  let ctrlMeas=0,config=0,measuring=false,imUpdate=true,epoch=0,rawT=0,rawP=0;
  let filtT:number|null=null,filtP:number|null=null;
  const data=new Uint8Array(6),shadow=new Uint8Array(6);
  const physical=()=>({t:clamp(num(ctx.props.temperature,25),-40,85),p:clamp(num(ctx.props.pressure,1013),300,1100)});
  /** Power-on data registers hold the "skipped" value 0x80000 until a measurement happens. */
  const latchSkipped=():void=>{data.set([0x80,0,0,0x80,0,0]);rawT=0x80000;rawP=0x80000;};
  const reset=():void=>{ctrlMeas=0;config=0;measuring=false;epoch++;filtT=null;filtP=null;latchSkipped();imUpdate=true;ctx.schedule(ms(2),()=>{imUpdate=false;});};
  const mode=():number=>ctrlMeas&3;
  /** One conversion: new raw words, IIR filter, truncation to the oversampling resolution. */
  function latch():void{
   const ph=physical(),raw=rawFromPhysical(ph.t,ph.p*100);
   const ot=(ctrlMeas>>5)&7,op=(ctrlMeas>>2)&7;
   const c=FILTER_C[(config>>2)&7]!;
   filtT=filtT===null||c===1?raw.t:Math.round((filtT*(c-1)+raw.t)/c);
   filtP=filtP===null||c===1?raw.p:Math.round((filtP*(c-1)+raw.p)/c);
   const cut=(v:number,o:number):number=>{const b=resBits(o);return b===0?0x80000:(v>>(20-b))<<(20-b);};
   const P=cut(filtP,op),T=cut(filtT,ot);
   rawP=P;rawT=T;conversions++;
   data.set([P>>12&0xff,P>>4&0xff,(P&0xf)<<4,T>>12&0xff,T>>4&0xff,(T&0xf)<<4]);
  }
  function cycleOnce():void{
   const ot=(ctrlMeas>>5)&7,op=(ctrlMeas>>2)&7;
   if(ot===0&&op===0){
    measuring=false;
    if(mode()===1||mode()===2)ctrlMeas&=~3;
    return;
   }
   measuring=true;const my=++epoch;
   ctx.schedule(ms(measMs(ot,op)),()=>{
    if(my!==epoch)return;
    latch();measuring=false;
    if(mode()===1||mode()===2){ctrlMeas&=~3;return;}   // forced mode returns to sleep
    if(mode()===3){
     // normal mode: wait t_standby then convert again
     ctx.schedule(ms(T_STANDBY[(config>>5)&7]!),()=>{if(my===epoch&&mode()===3)cycleOnce();});
    }
   });
  }
  function readReg(a:number):number{
   if(cal.has(a))return cal.get(a)!;
   if(a>=0xf7&&a<=0xfc)return shadow[a-0xf7]!;
   switch(a){
    case 0xd0:return 0x58;
    case 0xf3:return (measuring?0x08:0)|(imUpdate?0x01:0);
    case 0xf4:return ctrlMeas;
    case 0xf5:return config;
    default:return 0x00;
   }
  }
  function writeReg(a:number,v:number):void{
   switch(a){
    case 0xe0:if(v===0xb6)reset();break;
    case 0xf4:{
     const was=mode();
     ctrlMeas=v;
     if(mode()===0){epoch++;measuring=false;}
     else if(mode()===3){if(was!==3){epoch++;cycleOnce();}}
     else if(!measuring)cycleOnce();      // forced: one conversion
     break;
    }
    case 0xf5:config=v&0xfd;break;         // bit 1 is reserved; spi3w_en (bit 0) is kept
    default:break;                         // calibration, id, status and data registers are read-only
   }
  }
  latchSkipped();shadow.set(data);
  ctx.schedule(ms(2),()=>{imUpdate=false;});   // NVM copy after power-on: status bit 0 stays 1 for about 2 ms
  const address=():number=>{const n=ctx.net('SDO');return n==='5V'||n==='3V3'?0x77:0x76;};
  return {
   state:()=>{const p=physical();return {temperature:p.t,pressure:p.p,mode:mode(),measuring,address:address(),reads,writes,conversions,filter:(config>>2)&7,rawT,rawP};},
   i2c:{
    get address(){return address();},
    onStart(_rep,write){if(write)first=true;else shadow.set(data);},   // a read transaction locks one consistent copy of the data registers
    onWrite(byte){
     writes++;
     if(first){ptr=byte;first=false;return true;}
     writeReg(ptr,byte);ptr=(ptr+1)&0xff;return true;
    },
    onRead(){reads++;const v=readReg(ptr);ptr=(ptr+1)&0xff;return v;},
    onStop(){},
   },
  };
 },
});
