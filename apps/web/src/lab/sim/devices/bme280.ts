/**
 * BME280 device (protocol 'i2c'): Bosch humidity/pressure/temperature sensor on GY-BME280 style breakouts.
 * Written from the public datasheet (BST-BME280-DS002): register map, 20-bit/16-bit raw data, forced/normal/sleep modes,
 * oversampling resolution, and the integer compensation formulas of section 4.2.3. The popover physical values are turned
 * into raw ADC words by inverting those same formulas against a fixed calibration set (monotonic bisection), so a
 * standard Bosch-formula sketch reads the popover values back (within one LSB of the compensation).
 * Address: 0x76 when SDO is wired to GND or left open, 0x77 when SDO is wired to 5V (the board's real behaviour).
 * Pair: scene/parts/bme280.ts (3D). Both are auto-discovered. Guide: docs/lab-extending.md
 */
import {defineDevice,clamp,num,ms} from './types';

export type Bme280State={temperature:number;humidity:number;pressure:number;mode:number;measuring:boolean;address:number;reads:number;writes:number};

/** Calibration set (fixed trim values of a typical part; the sketch reads them from 0x88.. and 0xE1..). */
export const CAL={T1:27504,T2:26435,T3:-1000,P1:36477,P2:-10685,P3:3024,P4:2855,P5:140,P6:-7,P7:15500,P8:-14600,P9:6000,H1:75,H2:370,H3:0,H4:316,H5:50,H6:30};

/** Datasheet 4.2.3 integer formulas. */
export function tFine(adcT:number):number{
 const v1=(((adcT>>3)-(CAL.T1<<1))*CAL.T2)>>11;
 const d=(adcT>>4)-CAL.T1;
 const v2=(((d*d>>12)*CAL.T3)>>14);
 return v1+v2;
}
/** Temperature in 0.01 degC. */
export const compT=(adcT:number):number=>(tFine(adcT)*5+128)>>8;
/** Pressure in Pa, Q24.8 (64-bit formula, BigInt keeps it exact). */
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
/** Humidity in %RH, Q22.10. */
export function compH(adcH:number,tf:number):number{
 let v=tf-76800;
 v=(((((adcH<<14)-(CAL.H4<<20)-(CAL.H5*v))+16384)>>15)*(((((((v*CAL.H6)>>10)*(((v*CAL.H3)>>11)+32768))>>10)+2097152)*CAL.H2+8192)>>14));
 v=v-(((((v>>15)*(v>>15))>>7)*CAL.H1)>>4);
 v=v<0?0:v;v=v>419430400?419430400:v;
 return v>>12;
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
 // pick the closer of lo-1 and lo
 if(lo>0&&Math.abs(f(lo-1)-target)<Math.abs(f(lo)-target))return lo-1;
 return lo;
}
/** Physical values to raw ADC words (20-bit T, 20-bit P, 16-bit H). */
export function rawFromPhysical(tC:number,rh:number,pPa:number):{t:number;p:number;h:number}{
 const t=invert(compT,Math.round(tC*100),(1<<20)-1);
 const tf=tFine(t);
 const p=invert(a=>compP(a,tf),Math.round(pPa*256),(1<<20)-1);
 const h=invert(a=>compH(a,tf),Math.round(rh*1024),65535);
 return {t,p,h};
}

/** Calibration registers 0x88..0xA1, 0xE1..0xE7 as the chip stores them. */
function calibrationBytes():Map<number,number>{
 const m=new Map<number,number>();
 const w16=(a:number,v:number)=>{m.set(a,v&0xff);m.set(a+1,(v>>8)&0xff);};
 w16(0x88,CAL.T1);w16(0x8a,CAL.T2);w16(0x8c,CAL.T3);
 w16(0x8e,CAL.P1);w16(0x90,CAL.P2);w16(0x92,CAL.P3);w16(0x94,CAL.P4);w16(0x96,CAL.P5);w16(0x98,CAL.P6);w16(0x9a,CAL.P7);w16(0x9c,CAL.P8);w16(0x9e,CAL.P9);
 m.set(0xa1,CAL.H1);
 w16(0xe1,CAL.H2);m.set(0xe3,CAL.H3);
 m.set(0xe4,(CAL.H4>>4)&0xff);m.set(0xe5,((CAL.H4&0x0f)|((CAL.H5&0x0f)<<4)));m.set(0xe6,(CAL.H5>>4)&0xff);
 m.set(0xe7,CAL.H6&0xff);
 return m;
}

const OSRS=[0,1,2,4,8,16,16,16];
/** Max measurement time in ms (datasheet 9.1). */
const measMs=(ot:number,op:number,oh:number):number=>1.25+2.3*OSRS[ot]!+(op?2.3*OSRS[op]!+0.575:0)+(oh?2.3*OSRS[oh]!+0.575:0);

export const device=defineDevice<Bme280State>({
 kind:'bme280',protocol:'i2c',
 // GY-BME280 header order: VCC GND SCL SDA CSB SDO (CSB high selects I2C; SDO picks the address)
 pins:['VCC','GND','SCL','SDA','CSB','SDO'],holes:[0,1,2,3,4,5],bodyX:[-1.2,13.9],
 copy:{
  name:{en:'BME280 sensor',id:'Sensor BME280'},
  desc:{en:'Reads temperature, humidity and air pressure over I2C; its registers answer real Wire reads and writes.',id:'Membaca suhu, kelembapan, dan tekanan udara lewat I2C; registernya menjawab baca/tulis Wire yang sebenarnya.'},
  note:{en:'Click it to set the temperature, humidity and pressure it senses. SDO to 5V moves it to address 0x77.',id:'Klik untuk mengatur suhu, kelembapan, dan tekanan yang ia rasakan. SDO ke 5V memindahkannya ke alamat 0x77.'},
 },
 inputs:[
  {type:'range',key:'temperature',label:{en:'Temperature',id:'Suhu'},min:-40,max:85,step:0.5,unit:'°C',default:25},
  {type:'range',key:'humidity',label:{en:'Humidity',id:'Kelembapan'},min:0,max:100,step:1,unit:'%',default:50},
  {type:'range',key:'pressure',label:{en:'Pressure',id:'Tekanan'},min:300,max:1100,step:1,unit:'hPa',default:1013},
 ],
 defaults:{temperature:25,humidity:50,pressure:1013},
 create(ctx){
  const cal=calibrationBytes();
  let ptr=0,first=false,reads=0,writes=0;
  let ctrlHum=0,ctrlMeas=0,config=0,measuring=false,epoch=0;
  const data=new Uint8Array(8);
  const physical=()=>({t:clamp(num(ctx.props.temperature,25),-40,85),h:clamp(num(ctx.props.humidity,50),0,100),p:clamp(num(ctx.props.pressure,1013),300,1100)});
  const reset=()=>{ctrlHum=0;ctrlMeas=0;config=0;measuring=false;epoch++;latchSkipped();};
  /** Power-on data registers hold the "skipped" value 0x8000(0) until a measurement happens. */
  function latchSkipped(){data.set([0x80,0,0,0x80,0,0,0x80,0]);}
  /** Run one conversion and store raw words, truncating to the oversampling resolution (16..20 bit). */
  function latch(){
   const ph=physical(),raw=rawFromPhysical(ph.t,ph.h,ph.p*100);
   const ot=(ctrlMeas>>5)&7,op=(ctrlMeas>>2)&7,oh=ctrlHum&7;
   const res=(o:number)=>o===0?0:Math.min(20,15+o);   // osrs 1..5+ -> 16..20 bit
   const cut=(v:number,o:number)=>{const b=res(o);return b===0?0x80000:(v>>(20-b))<<(20-b);};
   const P=op?cut(raw.p,op):0x80000,T=ot?cut(raw.t,ot):0x80000,H=oh?raw.h:0x8000;
   data.set([P>>12&0xff,P>>4&0xff,(P&0xf)<<4,T>>12&0xff,T>>4&0xff,(T&0xf)<<4,H>>8&0xff,H&0xff]);
  }
  const mode=()=>ctrlMeas&3;
  const address=()=>ctx.net('SDO')==='5V'?0x77:0x76;
  function startMeasure(){
   const ot=(ctrlMeas>>5)&7,op=(ctrlMeas>>2)&7,oh=ctrlHum&7;
   if(ot===0&&op===0&&oh===0){ctrlMeas&=~3;return;}
   measuring=true;const my=++epoch;
   ctx.schedule(ms(measMs(ot,op,oh)),()=>{
    if(my!==epoch)return;
    latch();measuring=false;
    if(mode()===1||mode()===2)ctrlMeas&=~3;   // forced mode returns to sleep
   });
  }
  function readReg(a:number):number{
   if(cal.has(a))return cal.get(a)!;
   if(a>=0xf7&&a<=0xfe){
    // normal mode keeps converting: refresh a consistent shadow copy at the start of each burst
    return data[a-0xf7]!;
   }
   switch(a){
    case 0xd0:return 0x60;
    case 0xf2:return ctrlHum;
    case 0xf3:return measuring?0x08:0x00;
    case 0xf4:return ctrlMeas;
    case 0xf5:return config;
    default:return 0x00;
   }
  }
  function writeReg(a:number,v:number){
   switch(a){
    case 0xe0:if(v===0xb6)reset();break;
    case 0xf2:ctrlHum=v&7;break;                     // takes effect after the next write to ctrl_meas
    case 0xf4:{
     ctrlMeas=v;
     if(mode()===3){measuring=false;latch();epoch++;}
     else if(mode()!==0&&!measuring)startMeasure();
     break;
    }
    case 0xf5:config=v&0xfc;break;                   // writes in normal mode are not blocked in simulation
    default:break;                                   // calibration, id and data registers are read-only
   }
  }
  latchSkipped();
  return {
   state:()=>{const p=physical();return {temperature:p.t,humidity:p.h,pressure:p.p,mode:mode(),measuring,address:address(),reads,writes};},
   // keep normal mode fresh with the popover values (one conversion per slice is plenty)
   tick(){if(mode()===3)latch();},
   i2c:{
    get address(){return address();},
    onStart(_rep,write){if(write)first=true;},
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
