/**
 * NEO-6M GPS receiver on a GY-GPS6MV2 style breakout (protocol 'uart'). The module only talks: once per second it sends NMEA 0183 sentences
 * on TX at 9600 baud, 8N1 (the receiver's factory setting). Written from the public NMEA 0183 sentence layouts; no vendor code:
 *  - $GPRMC,hhmmss.ss,A|V,ddmm.mmmmm,N|S,dddmm.mmmmm,E|W,speed knots,course,ddmmyy,,,A|N*hh
 *  - $GPVTG,course,T,,M,knots,N,km/h,K,A|N*hh
 *  - $GPGGA,hhmmss.ss,ddmm.mmmmm,N|S,dddmm.mmmmm,E|W,quality,sats,hdop,altitude,M,(geoid separation left empty),M,,*hh
 *  - $GPGLL,ddmm.mmmmm,N|S,dddmmm.mmmmm,E|W,hhmmss.ss,A|V,A|N*hh
 *  The checksum is the XOR of every character between '$' and '*', two upper-case hex digits. Without a fix the sentences are the empty
 *  forms the chip really sends ("$GPRMC,,V,,,,,,,,,,N*53", "$GPGGA,,,,,,0,00,99.99,,,,,,*48"). Satellite sentences (GSA, GSV) are not sent:
 *  their per-satellite data would be invented.
 *  Time is UTC, started at 2026-01-15 03:00:00 (10:00 in Jakarta) and counting with simulated time. Position comes from the popover (default
 *  Jakarta); with a speed above 0 it moves along the heading from there. The PPS LED blinks 100 ms per second while there is a fix.
 *  The receiver ignores what the sketch sends (u-blox configuration messages): the bytes are only counted.
 *  Pins: TX to the sketch on D0 (hardware serial) or any pin (software UART, cycle-exact frames); RX from D1 or any pin.
 * Pair: scene/parts/gps-neo6m.ts (3D). Both are auto-discovered. Guide: docs/lab-extending.md
 */
import {defineDevice,clamp,num,ms,type DeviceCtx,type DeviceModel} from './types';
import {UartLink} from './serial/uart-link';
import {SIM_CLOCK_HZ} from '../../contract';

export type GpsState={
 fix:boolean;lat:number;lon:number;altitude:number;speedKmh:number;heading:number;satellites:number;baud:number;utc:string;
 sentences:number;txBytes:number;rxBytes:number;pps:boolean;lastSentence:string;ioTx:string;powered:boolean;
};

/** Seconds since 1970 of the receiver's power-on time (UTC). */
export const START_UTC=Date.UTC(2026,0,15,3,0,0)/1000;
export const JAKARTA={lat:-6.2088,lon:106.8456};
const KNOT_KMH=1.852;

/** XOR checksum of the body between '$' and '*'. */
export function nmeaChecksum(body:string):string{
 let x=0;for(let i=0;i<body.length;i++)x^=body.charCodeAt(i);
 return x.toString(16).toUpperCase().padStart(2,'0');
}
export const sentence=(body:string):string=>`$${body}*${nmeaChecksum(body)}\r\n`;
/** Latitude as ddmm.mmmmm and hemisphere. */
export function nmeaLat(lat:number):[string,string]{
 const a=Math.abs(lat),d=Math.floor(a),m=(a-d)*60;
 let ms5=m.toFixed(5),dd=d;
 if(ms5.startsWith('60')){ms5='00.00000';dd+=1;}
 return [String(dd).padStart(2,'0')+ms5.padStart(8,'0'),lat<0?'S':'N'];
}
/** Longitude as dddmm.mmmmm and hemisphere. */
export function nmeaLon(lon:number):[string,string]{
 const a=Math.abs(lon),d=Math.floor(a),m=(a-d)*60;
 let ms5=m.toFixed(5),dd=d;
 if(ms5.startsWith('60')){ms5='00.00000';dd+=1;}
 return [String(dd).padStart(3,'0')+ms5.padStart(8,'0'),lon<0?'W':'E'];
}
const p2=(n:number):string=>String(n).padStart(2,'0');
const utcTime=(t:number):string=>{const d=new Date(t*1000);return `${p2(d.getUTCHours())}${p2(d.getUTCMinutes())}${p2(d.getUTCSeconds())}.00`;};
const utcDate=(t:number):string=>{const d=new Date(t*1000);return `${p2(d.getUTCDate())}${p2(d.getUTCMonth()+1)}${p2(d.getUTCFullYear()%100)}`;};

export interface Fix{valid:boolean;t:number;lat:number;lon:number;alt:number;kmh:number;course:number;sats:number}
/** The sentences of one epoch, in the order the chip sends them. */
export function epochSentences(f:Fix):string[]{
 if(!f.valid){
  return [sentence('GPRMC,,V,,,,,,,,,,N'),sentence('GPVTG,,T,,M,,N,,K,N'),sentence('GPGGA,,,,,,0,00,99.99,,,,,,'),sentence('GPGLL,,,,,,V,N')];
 }
 const [la,ns]=nmeaLat(f.lat),[lo,ew]=nmeaLon(f.lon),kn=f.kmh/KNOT_KMH,t=utcTime(f.t);
 const course=f.kmh>0?f.course.toFixed(2):'';
 return [
  sentence(`GPRMC,${t},A,${la},${ns},${lo},${ew},${kn.toFixed(2)},${course},${utcDate(f.t)},,,A`),
  sentence(`GPVTG,${course},T,,M,${kn.toFixed(2)},N,${f.kmh.toFixed(2)},K,A`),
  sentence(`GPGGA,${t},${la},${ns},${lo},${ew},1,${p2(f.sats)},${(f.sats>=8?1.0:f.sats>=6?1.4:2.2).toFixed(2)},${f.alt.toFixed(1)},M,,M,,`),
  sentence(`GPGLL,${la},${ns},${lo},${ew},${t},A,A`),
 ];
}

const BAUDS=['4800','9600','19200','38400','57600','115200'] as const;

export const device=defineDevice<GpsState>({
 kind:'gps-neo6m',protocol:'uart',
 // GY-GPS6MV2 header order: VCC RX TX GND (RX receives from the sketch, TX sends NMEA to the sketch)
 pins:['VCC','RX','TX','GND'],holes:[0,1,2,3],bodyX:[-8.7,16.3],
 copy:{
  name:{en:'NEO-6M GPS module',id:'Modul GPS NEO-6M'},
  desc:{en:'A GPS receiver that prints position, time and speed as NMEA text lines once per second at 9600 baud.',id:'Penerima GPS yang mencetak posisi, waktu, dan kecepatan sebagai baris teks NMEA setiap detik pada 9600 baud.'},
  note:{en:'Click it to set the position (Jakarta by default) and to switch the satellite fix on or off. Without a fix it sends empty sentences, as the real chip does indoors.',id:'Klik untuk mengatur posisi (bawaan Jakarta) dan menyalakan atau mematikan fix satelit. Tanpa fix ia mengirim kalimat kosong, seperti chip aslinya di dalam ruangan.'},
 },
 power:{rail:['VCC','GND'],min:3.3,max:5,ma:45},
 inputs:[
  {type:'toggle',key:'fix',label:{en:'Satellite fix',id:'Fix satelit'},default:true},
  {type:'range',key:'lat',label:{en:'Latitude',id:'Lintang'},min:-90,max:90,step:0.0001,unit:'°',default:-6.2088},
  {type:'range',key:'lon',label:{en:'Longitude',id:'Bujur'},min:-180,max:180,step:0.0001,unit:'°',default:106.8456},
  {type:'range',key:'altitude',label:{en:'Altitude',id:'Ketinggian'},min:-100,max:4000,step:1,unit:'m',default:8},
  {type:'range',key:'speedKmh',label:{en:'Speed',id:'Kecepatan'},min:0,max:200,step:1,unit:'km/h',default:0},
  {type:'range',key:'heading',label:{en:'Heading',id:'Arah'},min:0,max:359,step:1,unit:'°',default:90},
  {type:'range',key:'satellites',label:{en:'Satellites used',id:'Satelit dipakai'},min:3,max:12,step:1,default:8},
  {type:'choice',key:'baud',label:{en:'Receiver baud',id:'Baud penerima'},options:BAUDS.map(b=>({value:b,label:{en:b,id:b}})),default:'9600'},
 ],
 defaults:{fix:true,lat:-6.2088,lon:106.8456,altitude:8,speedKmh:0,heading:90,satellites:8,baud:'9600'},
 create(ctx:DeviceCtx):DeviceModel<GpsState>{
  let sentences=0,rxBytes=0,last='',dLat=0,dLon=0,ppsOn=false;
  const epoch=0;
  let seenLat=NaN,seenLon=NaN,lastEpochSecs=0;
  const baud=():number=>{const p=Number(ctx.props.baud);return Number.isFinite(p)&&p>0?p:9600;};
  const powered=():boolean=>{const v=ctx.supply();return v===null||v>=3.0;};
  const link=new UartLink({ctx,rx:'RX',tx:'TX',baud,onByte:()=>{rxBytes++;}});
  const now=():number=>START_UTC+Math.floor(ctx.env.now()/SIM_CLOCK_HZ);
  const hasFix=():boolean=>ctx.props.fix!==false&&powered();
  /** Position now: the popover point, moved along the heading by speed x elapsed time. */
  function position():Fix{
   const lat0=clamp(num(ctx.props.lat,JAKARTA.lat),-90,90),lon0=clamp(num(ctx.props.lon,JAKARTA.lon),-180,180);
   if(lat0!==seenLat||lon0!==seenLon){seenLat=lat0;seenLon=lon0;dLat=0;dLon=0;}
   const kmh=clamp(num(ctx.props.speedKmh,0),0,200),course=((num(ctx.props.heading,90)%360)+360)%360;
   const lat=clamp(lat0+dLat,-90,90),lon=lon0+dLon;
   return {valid:hasFix(),t:now(),lat,lon:((lon+540)%360)-180,alt:num(ctx.props.altitude,8),kmh,course,sats:Math.round(clamp(num(ctx.props.satellites,8),3,12))};
  }
  /** Advance the dead-reckoned offset by the whole seconds since the last epoch. */
  function advance(t:number):void{
   const dt=lastEpochSecs?t-lastEpochSecs:0;lastEpochSecs=t;
   const kmh=clamp(num(ctx.props.speedKmh,0),0,200);
   if(kmh<=0||dt<=0)return;
   const course=(num(ctx.props.heading,90)%360)*Math.PI/180,dKm=kmh*dt/3600;
   const lat0=seenLat+dLat;
   dLat+=dKm*Math.cos(course)/111.32;
   dLon+=dKm*Math.sin(course)/(111.32*Math.max(0.01,Math.cos(lat0*Math.PI/180)));
  }
  function emit(my:number):void{
   if(my!==epoch)return;
   ctx.schedule(SIM_CLOCK_HZ,()=>emit(my));
   if(!powered())return;
   if(link.pending>0)return;   // the previous burst is still on the wire (low baud): the chip would also fall behind
   const f=position();
   if(f.valid)advance(f.t);else lastEpochSecs=f.t;
   const list=epochSentences(f);
   sentences+=list.length;last=list[0]!.trim();
   link.send(Array.from(list.join(''),c=>c.charCodeAt(0)));
   if(f.valid){ppsOn=true;ctx.schedule(ms(100),()=>{ppsOn=false;});}
  }
  ctx.schedule(SIM_CLOCK_HZ,()=>emit(epoch));
  return {
   state:()=>{
    const f=position();
    const d=new Date(f.t*1000);
    return {
     fix:f.valid,lat:f.lat,lon:f.lon,altitude:f.alt,speedKmh:f.kmh,heading:f.course,satellites:f.valid?f.sats:0,baud:baud(),
     utc:`${p2(d.getUTCHours())}:${p2(d.getUTCMinutes())}:${p2(d.getUTCSeconds())}`,sentences,txBytes:link.bytesOut,rxBytes,pps:ppsOn&&f.valid,
     lastSentence:last,ioTx:link.modeTx(),powered:powered(),
    };
   },
   onPinChange(pin,level,cycle){link.edge(pin,level,cycle);},
   uart:link.tap(),
  };
 },
});
