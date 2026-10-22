/**
 * MPU6050 device (protocol 'i2c'): InvenSense 6-axis motion sensor on a GY-521 style breakout.
 * Written from the public datasheet and register map (PS-MPU-6000A, RM-MPU-6000A): I2C address 0x68 (AD0 low) or 0x69 (AD0 high),
 * WHO_AM_I (0x75) = 0x68 whatever AD0 says, PWR_MGMT_1 wakes from its 0x40 sleep default, accel 0x3B..0x40, temperature 0x41/0x42
 * (degC = raw/340 + 36.53), gyro 0x43..0x48, big-endian two's-complement words, full-scale selects with LSB sizes of the datasheet
 * (16384/8192/4096/2048 LSB/g, 131/65.5/32.8/16.4 LSB/dps), SMPLRT_DIV and DLPF decide the sample rate, INT pin with data ready.
 * The popover tilts the board (roll and pitch). Accel is gravity in the sensor frame, gyro is the true body angular rate of the
 * motion that the tilt change causes, plus an optional spin about the vertical. The tilt eases to its target with a 80 ms time
 * constant, like a hand turning the board, so a slider jump is not an impossible instant rotation.
 * Not modelled (stored only): FIFO, I2C master (XDA/XCL), motion detect, standby bits, self-test, offset registers.
 * Pair: scene/parts/mpu6050.ts (3D). Both are auto-discovered. Guide: docs/lab-extending.md
 */
import {defineDevice,clamp,num,us} from './types';
import {uno} from './core/util';

export type Mpu6050State={
 roll:number;pitch:number;spin:number;ax:number;ay:number;az:number;gx:number;gy:number;gz:number;temperature:number;
 asleep:boolean;address:number;sampleHz:number;int:boolean;reads:number;writes:number;
};

export const WHO_AM_I=0x68;
const G=1;
const RAD=Math.PI/180;
const ACC_LSB=[16384,8192,4096,2048] as const;
const GYR_LSB=[131,65.5,32.8,16.4] as const;
const TAU_MS=80;

/** Gravity (in g) in the sensor frame for roll phi (about X) and pitch theta (about Y), degrees. Z up when flat. */
export function gravity(rollDeg:number,pitchDeg:number):[number,number,number]{
 const f=rollDeg*RAD,t=pitchDeg*RAD;
 return [-Math.sin(t)*G,Math.sin(f)*Math.cos(t)*G,Math.cos(f)*Math.cos(t)*G];
}
/** Body angular rate (dps) of R=Ry(theta)Rx(phi) with rates in dps, plus spin about the world vertical. */
export function bodyRate(rollDeg:number,pitchDeg:number,dRoll:number,dPitch:number,spin:number):[number,number,number]{
 const f=rollDeg*RAD,t=pitchDeg*RAD;
 return [
  dRoll-spin*Math.sin(t),
  dPitch*Math.cos(f)+spin*Math.cos(t)*Math.sin(f),
  -dPitch*Math.sin(f)+spin*Math.cos(t)*Math.cos(f),
 ];
}
const i16=(v:number,lsb:number):number=>clamp(Math.round(v*lsb),-32768,32767);
const hi=(v:number):number=>(v>>8)&0xff;
const lo=(v:number):number=>v&0xff;

export const device=defineDevice<Mpu6050State>({
 kind:'mpu6050',protocol:'i2c',
 // GY-521 header order: VCC GND SCL SDA XDA XCL AD0 INT
 pins:['VCC','GND','SCL','SDA','XDA','XCL','AD0','INT'],holes:[0,1,2,3,4,5,6,7],bodyX:[-1.6,19.4],
 power:{rail:['VCC','GND'],min:3.3,max:5.5,ma:4},
 copy:{
  name:{en:'MPU6050 motion sensor (GY-521)',id:'Sensor gerak MPU6050 (GY-521)'},
  desc:{en:'Measures acceleration and rotation on three axes plus chip temperature over I2C. Tilt it in the popover and the registers follow the real gravity maths.',id:'Mengukur percepatan dan putaran di tiga sumbu plus suhu chip lewat I2C. Miringkan di popover dan registernya mengikuti hitungan gravitasi yang sebenarnya.'},
  note:{en:'Click it to tilt the board. The chip sleeps after power-up until the sketch clears PWR_MGMT_1. AD0 to 5V moves it to 0x69.',id:'Klik untuk memiringkan papan. Chip tidur setelah dinyalakan sampai sketsa menghapus PWR_MGMT_1. AD0 ke 5V memindahkannya ke 0x69.'},
 },
 inputs:[
  {type:'range',key:'roll',label:{en:'Roll (back edge up)',id:'Roll (sisi belakang naik)'},min:-90,max:90,step:1,unit:'°',default:0},
  {type:'range',key:'pitch',label:{en:'Pitch (right edge down)',id:'Pitch (sisi kanan turun)'},min:-90,max:90,step:1,unit:'°',default:0},
  {type:'range',key:'spin',label:{en:'Spin about vertical',id:'Putaran vertikal'},min:-250,max:250,step:5,unit:'°/s',default:0},
  {type:'range',key:'temperature',label:{en:'Chip temperature',id:'Suhu chip'},min:-40,max:85,step:0.5,unit:'°C',default:25},
 ],
 defaults:{roll:0,pitch:0,spin:0,temperature:25},
 create(ctx){
  const R={smplrt:0,config:0,gyroCfg:0,accelCfg:0,intPin:0,intEn:0,intStat:0,pwr1:0x40,pwr2:0,user:0};
  const data=new Uint8Array(14);          // shadow of 0x3B..0x48
  const extra=new Map<number,number>();   // stored but unmodelled registers (offsets, FIFO_EN, self-test...)
  let ptr=0,first=false,reads=0,writes=0;
  let roll=0,pitch=0,lastAt=0,lastSample=-1e12,epoch=0,intHigh=false;
  let rates:[number,number,number]=[0,0,0];
  const intPin=uno(ctx.net('INT'));
  const target=()=>({r:clamp(num(ctx.props.roll,0),-90,90),p:clamp(num(ctx.props.pitch,0),-90,90),s:clamp(num(ctx.props.spin,0),-250,250),t:clamp(num(ctx.props.temperature,25),-40,85)});
  const asleep=()=>(R.pwr1&0x40)!==0;
  const address=()=>{const n=ctx.net('AD0');return n==='5V'||n==='3V3'?0x69:0x68;};
  const dlpfOn=()=>{const c=R.config&7;return c!==0&&c!==7;};
  const sampleHz=()=>(dlpfOn()?1000:8000)/(1+R.smplrt);
  const periodCycles=()=>Math.round(16e6/sampleHz());
  const intActiveLow=()=>(R.intPin&0x80)!==0;
  const latched=()=>(R.intPin&0x20)!==0;
  const drivePin=(active:boolean)=>{
   intHigh=active;
   if(intPin)ctx.env.setPin(intPin,intActiveLow()?!active:active);
  };

  /** Move the (smoothed) orientation toward the popover target and derive the body rates of that motion. */
  function integrate(cycles:number){
   const tg=target();
   const dt=cycles/16e6;
   if(dt<=0){rates=bodyRate(roll,pitch,0,0,tg.s);return;}
   const k=1-Math.exp(-dt*1000/TAU_MS);
   const nr=roll+(tg.r-roll)*k,np=pitch+(tg.p-pitch)*k;
   const dR=(nr-roll)/dt,dP=(np-pitch)/dt;
   roll=nr;pitch=np;
   rates=bodyRate(roll,pitch,dR,dP,tg.s);
  }
  /** Latch one conversion result into the data registers (accel, temperature, gyro). */
  function sample(){
   const a=gravity(roll,pitch),afs=(R.accelCfg>>3)&3,gfs=(R.gyroCfg>>3)&3;
   const t=Math.round((target().t-36.53)*340);
   const w=[i16(a[0],ACC_LSB[afs]!),i16(a[1],ACC_LSB[afs]!),i16(a[2],ACC_LSB[afs]!),clamp(t,-32768,32767),
    i16(rates[0],GYR_LSB[gfs]!),i16(rates[1],GYR_LSB[gfs]!),i16(rates[2],GYR_LSB[gfs]!)];
   w.forEach((v,i)=>{data[i*2]=hi(v);data[i*2+1]=lo(v);});
   lastSample=ctx.env.now();
   R.intStat|=0x01;
  }
  /** A new sample is due when a full sample period passed since the last one (polling sketches see fresh data). */
  function refresh(){
   if(asleep())return;
   if(ctx.env.now()-lastSample>=periodCycles())sample();
  }
  function stopLoop(){epoch++;}
  function startLoop(){
   const my=++epoch;
   const step=()=>{
    if(my!==epoch||asleep()||(R.intEn&1)===0)return;
    sample();
    if(!latched()||!intHigh){
     drivePin(true);
     if(!latched())ctx.schedule(us(50),()=>{if(my===epoch)drivePin(false);});   // datasheet: 50 us pulse unless latched
    }
    ctx.schedule(periodCycles(),step);
   };
   ctx.schedule(periodCycles(),step);
  }
  function clearInt(){if(latched()&&intHigh)drivePin(false);}
  function resetRegs(){
   Object.assign(R,{smplrt:0,config:0,gyroCfg:0,accelCfg:0,intPin:0,intEn:0,intStat:0,pwr1:0x40,pwr2:0,user:0});
   extra.clear();data.fill(0);stopLoop();lastSample=-1e12;
   if(intHigh)drivePin(false);
  }
  function readReg(a:number):number{
   if(a>=0x3b&&a<=0x48)return data[a-0x3b]!;
   switch(a){
    case 0x19:return R.smplrt;
    case 0x1a:return R.config;
    case 0x1b:return R.gyroCfg;
    case 0x1c:return R.accelCfg;
    case 0x37:return R.intPin;
    case 0x38:return R.intEn;
    case 0x3a:{const v=R.intStat;R.intStat=0;clearInt();return v;}   // reading clears the status bits
    case 0x6a:return R.user;
    case 0x6b:return R.pwr1;
    case 0x6c:return R.pwr2;
    case 0x72:case 0x73:return 0;   // FIFO_COUNT
    case 0x75:return WHO_AM_I;
    default:return extra.get(a)??0;
   }
  }
  function writeReg(a:number,v:number){
   switch(a){
    case 0x19:R.smplrt=v;break;
    case 0x1a:R.config=v&0x3f;break;
    case 0x1b:R.gyroCfg=v&0xf8;break;
    case 0x1c:R.accelCfg=v&0xf8;break;
    case 0x37:R.intPin=v&0xfc;if(!latched())clearInt();break;
    case 0x38:R.intEn=v;stopLoop();if((v&1)&&!asleep())startLoop();break;
    case 0x6a:R.user=v&0x7d;if(v&0x01)resetSignalPath();break;
    case 0x6b:{
     if(v&0x80){resetRegs();break;}   // DEVICE_RESET, self-clearing, leaves PWR_MGMT_1 at its 0x40 sleep default
     const was=asleep();
     R.pwr1=v;
     if(was&&!asleep()){lastSample=-1e12;if(R.intEn&1)startLoop();}
     if(!was&&asleep())stopLoop();
     break;
    }
    case 0x6c:R.pwr2=v;break;
    case 0x75:case 0x3a:case 0x3b:break;    // read-only
    default:if(!(a>=0x3b&&a<=0x48))extra.set(a,v);
   }
  }
  function resetSignalPath(){data.fill(0);R.user&=~1;lastSample=-1e12;}
  return {
   state:()=>{
    const tg=target(),a=gravity(roll,pitch);
    return {
     roll:Math.round(roll*10)/10,pitch:Math.round(pitch*10)/10,spin:tg.s,
     ax:a[0],ay:a[1],az:a[2],gx:rates[0],gy:rates[1],gz:rates[2],temperature:tg.t,
     asleep:asleep(),address:address(),sampleHz:sampleHz(),int:intHigh,reads,writes,
    };
   },
   tick(cycles){
    const now=ctx.env.now();
    integrate(cycles||Math.max(0,now-lastAt));
    lastAt=now;
   },
   i2c:{
    get address(){return address();},
    onStart(_rep,write){if(write)first=true;refresh();},
    onWrite(byte){
     writes++;
     if(first){ptr=byte;first=false;return true;}
     writeReg(ptr,byte);ptr=(ptr+1)&0xff;return true;
    },
    onRead(){
     reads++;
     const v=readReg(ptr);
     // burst read inside the data block stays on the shadow registers; auto-increment like the chip
     ptr=(ptr+1)&0xff;
     if(R.intPin&0x10)clearInt();   // INT_RD_CLEAR: any read clears the interrupt
     return v;
    },
    onStop(){},
   },
  };
 },
});
