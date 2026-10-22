/**
 * DHT22 / AM2302 temperature and humidity sensor with the REAL single-wire timing (protocol 'onewire'):
 *   host: pulls DATA low >= 1 ms (datasheet: 1-10 ms, we send 18 ms), releases; the pull-up raises the line.
 *   sensor, 20-200 us later: low 80 us, high 80 us, then 40 bits, each = low 50 us + high 26-28 us (0) or 70 us (1), then low 50 us and release.
 *   40 bits = humidity x10 (16 bit), temperature x10 (16 bit, MSB = sign), checksum (low byte of the sum of the four bytes).
 */
import {defineDevice,clamp,num,us} from './types';
import type {Pulse} from './types';

export const DHT22_TEMP={min:-40,max:80};
export const DHT22_HUM={min:0,max:100};
/** Timings in microseconds. */
export const DHT22_US={hostLowMin:800,reply:30,ack:80,bitLow:50,zero:27,one:70,end:50};

/** The 40 data bits (MSB first) of one reading. */
export function dht22Frame(tempC:number,humidity:number):number[]{
 const h=Math.round(clamp(humidity,0,100)*10);
 const t=Math.round(Math.abs(clamp(tempC,-40,80))*10)|(tempC<0?0x8000:0);
 const b=[h>>8,h&0xff,t>>8,t&0xff];
 b.push((b[0]!+b[1]!+b[2]!+b[3]!)&0xff);
 const bits:number[]=[];
 for(const byte of b)for(let i=7;i>=0;i--)bits.push((byte>>i)&1);
 return bits;
}
/** Level changes the sensor makes after the host releases the line: [level, microseconds to hold]. */
export function dht22Response(tempC:number,humidity:number):{level:0|1;us:number}[]{
 const r:{level:0|1;us:number}[]=[{level:0,us:DHT22_US.ack},{level:1,us:DHT22_US.ack}];
 for(const bit of dht22Frame(tempC,humidity)){r.push({level:0,us:DHT22_US.bitLow},{level:1,us:bit?DHT22_US.one:DHT22_US.zero});}
 r.push({level:0,us:DHT22_US.end},{level:1,us:0});
 return r;
}

export type Dht22State={tempC:number;humidity:number;/** the sensor is talking on the wire right now */active:boolean;/** completed readings since load */reads:number;/** values of the last reading sent, null before the first */readT:number|null;readH:number|null};

export const device=defineDevice<Dht22State>({
 kind:'dht22',protocol:'onewire',
 pins:['VCC','DATA','NC','GND'],holes:[0,1,2,3],bodyX:[-4,11.5],
 copy:{
  name:{en:'DHT22 temperature and humidity sensor',id:'Sensor suhu dan kelembapan DHT22'},
  desc:{en:'Answers a start pulse with 40 bits on one wire: humidity, temperature and a checksum.',id:'Menjawab pulsa mulai dengan 40 bit lewat satu kabel: kelembapan, suhu, dan checksum.'},
  note:{en:'Slide the temperature and humidity; the sketch reads them over the wire.',id:'Geser suhu dan kelembapan; sketsa membacanya lewat kabel.'},
 },
 power:{rail:['VCC','GND'],min:3.3,max:6,ma:1.5},
 inputs:[
  {type:'range',key:'tempC',label:{en:'Temperature',id:'Suhu'},min:DHT22_TEMP.min,max:DHT22_TEMP.max,step:0.5,unit:'°C',default:24},
  {type:'range',key:'humidity',label:{en:'Humidity',id:'Kelembapan'},min:DHT22_HUM.min,max:DHT22_HUM.max,step:1,unit:'%',default:60},
 ],
 defaults:{tempC:24,humidity:60},
 create(ctx){
  const data=ctx.pin('DATA');
  let phase:'idle'|'host-low'|'reply'='idle';
  let fall=0,reads=0,readT:number|null=null,readH:number|null=null;
  if(data)ctx.line(data,true);
  const temp=()=>clamp(num(ctx.props.tempC,24),DHT22_TEMP.min,DHT22_TEMP.max);
  const hum=()=>clamp(num(ctx.props.humidity,60),DHT22_HUM.min,DHT22_HUM.max);
  const reply=():void=>{
   if(!data)return;
   phase='reply';
   const t=temp(),h=hum();
   const pulses:Pulse[]=dht22Response(t,h).map(s=>({level:s.level,holdCycles:us(s.us)}));
   ctx.drive(data,pulses,{delayCycles:us(DHT22_US.reply),onDone:()=>{phase='idle';reads++;readT=Math.round(t*10)/10;readH=Math.round(h);}});
  };
  return {
   state:()=>({tempC:temp(),humidity:hum(),active:phase==='reply',reads,readT,readH}),
   onPinChange(pin,level,cycle){
    if(pin!==data)return;
    if(phase==='reply')return; // our own edges
    if(level===0){phase='host-low';fall=cycle;return;}
    if(phase==='host-low'){
     if(cycle-fall>=us(DHT22_US.hostLowMin))reply();else phase='idle';
    }
   },
  };
 },
});
