/**
 * BH1750 device (protocol 'i2c'): ROHM BH1750FVI ambient light sensor on a GY-302 style module.
 * Written from the ROHM datasheet (https://www.mouser.com/datasheet/2/348/bh1750fvi-e-186247.pdf).
 *  - Address 0x23 with ADDR low or floating, 0x5C with ADDR at or above 0.7 x VCC (read from the ADDR net, lazily, on every bus lookup).
 *  - Opcodes: 0x00 power down, 0x01 power on, 0x07 reset (data register only, ignored while powered down),
 *    0x10/0x11/0x13 continuous H-res / H-res2 / L-res, 0x20/0x21/0x23 one-time (then power down back to the idle state),
 *    MTreg high 0b01000_hhh (0x40-0x47) and low 0b011_lllll (0x60-0x7F); MTreg 31..254, default 69.
 *  - Measurement time: H and H2 120 ms typical (180 max), L 16 ms typical (24 max), both scaled by MTreg/69. We use the typical figure.
 *  - Data: two bytes, MSB first. count = lux x 1.2 x (MTreg/69); H2 mode resolves 0.5 lx so its count is doubled. 0..65535 (H mode clips at 54612 lx at MTreg 69).
 *    L mode uses the same scale (4 lx resolution is not modelled: we do not quantise).
 *  - Until the first conversion completes the data register holds its previous value (0 after power-on or reset).
 * Pair: scene/parts/bh1750.ts (3D). Both are auto-discovered; nothing else to edit. Guide: docs/lab-extending.md
 */
import {defineDevice,clamp,num,ms} from './types';

export type Bh1750State={
 /** lux at the sensor window (the popover value) */lux:number;/** 'down' | 'idle' | 'H' | 'H2' | 'L', with '-once' appended for one-time modes */mode:string;
 mtreg:number;address:number;/** a conversion result is latched (false until the first one completes after power-on or reset) */ready:boolean;
 /** the 16-bit word a read returns now */count:number;/** the true count would exceed 65535 */clipped:boolean;powered:boolean;reads:number;writes:number;
};

export const BH1750_ADDR_LOW=0x23;
export const BH1750_ADDR_HIGH=0x5c;
export const BH1750_MTREG_DEFAULT=69;
/** Typical measurement time in ms at MTreg 69 (datasheet: H 120 typ / 180 max, L 16 typ / 24 max). */
export const BH1750_T_H_MS=120;
export const BH1750_T_L_MS=16;

type Res='H'|'H2'|'L';
export const countFor=(lux:number,mt:number,res:Res):{count:number;clipped:boolean}=>{
 const raw=lux*1.2*(mt/BH1750_MTREG_DEFAULT)*(res==='H2'?2:1);
 return {count:clamp(Math.round(raw),0,65535),clipped:raw>65535};
};

export const device=defineDevice<Bh1750State>({
 kind:'bh1750',protocol:'i2c',
 // GY-302 header order from the brief: VCC GND SCL SDA ADDR
 pins:['VCC','GND','SCL','SDA','ADDR'],holes:[0,1,2,3,4],bodyX:[-1.5,11.5],
 // the module has a 3.3 V LDO and I2C pull-ups, so it takes 3-5.5 V (the bare chip is 2.4-3.6 V)
 power:{rail:['VCC','GND'],min:3,max:5.5,ma:0.2},
 copy:{
  name:{en:'BH1750 light sensor (GY-302)',id:'Sensor cahaya BH1750 (GY-302)'},
  desc:{en:'Measures ambient light in lux over I2C. It answers the standard BH1750 commands, so a normal library reads the lux value you set.',id:'Mengukur cahaya sekitar dalam lux lewat I2C. Ia menjawab perintah BH1750 standar, jadi library biasa membaca nilai lux yang Anda atur.'},
  note:{en:'ADDR low or open = 0x23, ADDR to VCC = 0x5C. Full sun is about 100,000 lux: in H mode at the default MTreg the count clips at 54,612 lux, so lower MTreg for outdoor use.',id:'ADDR low atau terbuka = 0x23, ADDR ke VCC = 0x5C. Matahari penuh sekitar 100.000 lux: pada mode H dengan MTreg bawaan hitungan terpotong di 54.612 lux, jadi turunkan MTreg untuk di luar ruangan.'},
 },
 inputs:[{type:'range',key:'lux',label:{en:'Light',id:'Cahaya'},min:0,max:100000,step:10,unit:'lx',default:300}],
 defaults:{lux:300},
 create(ctx){
  const env=ctx.env;
  let powered=false,mt=BH1750_MTREG_DEFAULT,res:Res='H',continuous=false,measuring=false,endAt=0,data=0,ready=false,clipped=false;
  let reads=0,writes=0,mtHigh=BH1750_MTREG_DEFAULT>>5,mtLow=BH1750_MTREG_DEFAULT&31;
  const lux=()=>clamp(num(ctx.props.lux,300),0,100000);
  const dur=()=>Math.round((res==='L'?BH1750_T_L_MS:BH1750_T_H_MS)*mt/BH1750_MTREG_DEFAULT*10)/10;
  const start=(from:number)=>{measuring=true;endAt=from+ms(dur());};
  /** Finish every conversion that has elapsed. A continuous mode restarts back to back. */
  const refresh=()=>{
   const now=env.now();
   while(measuring&&now>=endAt){
    const r=countFor(lux(),mt,res);data=r.count;clipped=r.clipped;ready=true;
    if(continuous)start(endAt);else{measuring=false;powered=false;}   // one-time: power down after the result
   }
  };
  const setMt=()=>{mt=clamp((mtHigh<<5)|mtLow,31,254);};
  const command=(op:number):void=>{
   refresh();
   if(op===0x00){powered=false;measuring=false;continuous=false;}
   else if(op===0x01){powered=true;}
   else if(op===0x07){if(powered){data=0;ready=false;clipped=false;}}
   else if(op===0x10||op===0x11||op===0x13||op===0x20||op===0x21||op===0x23){
    powered=true;continuous=op<0x20;res=(op&0x03)===0x00?'H':(op&0x03)===0x01?'H2':'L';start(env.now());
   }
   else if((op&0xf8)===0x40){mtHigh=op&0x07;setMt();}
   else if((op&0xe0)===0x60){mtLow=op&0x1f;setMt();}
   // anything else is ignored by the chip
  };
  let byteIdx=0;
  const mode=():string=>!powered&&!measuring?'down':!measuring?'idle':continuous?res:`${res}-once`;
  const addr=():number=>{const a=ctx.volts('ADDR'),v=ctx.volts('VCC')??5;return a!==null&&a>=0.7*v?BH1750_ADDR_HIGH:BH1750_ADDR_LOW;};
  return {
   state:()=>{refresh();return {lux:lux(),mode:mode(),mtreg:mt,address:addr(),ready,count:data,clipped,powered,reads,writes};},
   tick(){refresh();},
   i2c:{
    get address(){return addr();},
    onStart(_rep,write){if(!write)byteIdx=0;},
    onWrite(byte){writes++;command(byte);return true;},
    onRead(){reads++;refresh();const b=byteIdx===0?data>>8:data&0xff;byteIdx=(byteIdx+1)%2;return b;},
    onStop(){},
   },
  };
 },
});
