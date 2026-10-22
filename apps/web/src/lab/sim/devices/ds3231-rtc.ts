/**
 * DS3231 real-time clock on a ZS-042 style breakout (protocol 'i2c'), with the AT24C32 EEPROM that sits on the same board.
 * Written from the public datasheets (DS3231 / AT24C32 behaviour; no vendor code):
 *  - I2C 0x68: registers 0x00-0x06 are BCD seconds, minutes, hours (24 h, or 12 h with AM/PM when bit 6 is set), day of week (1-7, user defined,
 *    counts up by itself at midnight), date, month (+ century bit 7), year. They keep real time: one second of simulated time (16e6 CPU cycles)
 *    is one second of the clock. On every START the chip freezes a copy of the time for the transfer, so a burst read never tears.
 *    Writing the time registers sets the clock when the transfer ends and restarts the sub-second divider.
 *  - 0x07-0x0A alarm 1 (seconds resolution) and 0x0B-0x0D alarm 2 (minutes resolution): A1Mx / A2Mx mask bits (bit 7), DY/DT (bit 6 of the day
 *    byte: 1 = day of week, 0 = date). Alarm 1 is compared every second, alarm 2 when seconds roll to 00. A match sets A1F / A2F in the status
 *    register; they only clear by writing 0. With INTCN = 1 and AxIE = 1 the INT/SQW pin goes low until the flag is cleared (open drain, pulled up).
 *  - 0x0E control (power-up 0x1C: INTCN = 1, RS = 11), 0x0F status (OSF "oscillator stopped" until software clears it; power-up 0x88 after a
 *    battery loss, 0x08 otherwise; BSY reads 0), 0x10 aging offset (stored), 0x11-0x12 temperature (signed integer + 0.25 degC steps).
 *  - With INTCN = 0 the INT/SQW pin outputs a square wave: RS 00 = 1 Hz, 01 = 1.024 kHz, 10 = 4.096 kHz, 11 = 8.192 kHz.
 *  - The 32K pin idles high; the 32.768 kHz wave itself is not generated (65 000 edges per second are not worth the CPU time).
 *  - AT24C32 at 0x57 (all address pads open): 4096 bytes, 12-bit address sent as two bytes (high first), 32-byte pages that wrap inside the page,
 *    erased state 0xFF, sequential reads wrap at the end, and after a write transfer ends the chip is busy for tWR = 5 ms and does not ACK its address
 *    (so ACK polling works). A transfer that only sets the address (no data) starts no write cycle.
 * Both start at 2026-01-15 10:00:00 (a Thursday) when powered; the sketch usually sets the time itself.
 * Pair: scene/parts/ds3231-rtc.ts (3D). Both are auto-discovered. Guide: docs/lab-extending.md
 */
import {defineDevice,clamp,num,ms,type I2cSlave,type DeviceCtx} from './types';
import {SIM_CLOCK_HZ} from '../../contract';

export type Ds3231State={
 hour:number;minute:number;second:number;year:number;month:number;date:number;dayOfWeek:number;
 time:string;mode12:boolean;alarm1:boolean;alarm2:boolean;intLow:boolean;osf:boolean;temperature:number;
 control:number;status:number;sqwHz:number;reads:number;writes:number;eepromWrites:number;eepromBusy:boolean;eepromReads:number;address:number;
};

export const RTC_ADDRESS=0x68;
export const EEPROM_ADDRESS=0x57;
export const EEPROM_SIZE=4096;
export const EEPROM_PAGE=32;
/** AT24C32 write cycle (datasheet: 10 ms max; the simulation uses 5 ms, a typical value). */
export const EEPROM_TWR_MS=5;
/** Time the clock shows at power-up (UTC-agnostic wall time, seconds since 1970 of that wall time). */
export const START_SECONDS=Date.UTC(2026,0,15,10,0,0)/1000;

const bcd=(n:number):number=>((Math.floor(n/10)%10)<<4)|(n%10);
const unbcd=(b:number):number=>((b>>4)&0xf)*10+(b&0xf);
const DAY=86400;
const dayOfWeekOf=(secs:number):number=>((new Date(secs*1000).getUTCDay()+6)%7)+1;   // 1 = Monday ... 7 = Sunday

export const device=defineDevice<Ds3231State>({
 kind:'ds3231-rtc',protocol:'i2c',
 // ZS-042 header order: 32K SQW SCL SDA VCC GND
 pins:['32K','SQW','SCL','SDA','VCC','GND'],holes:[0,1,2,3,4,5],bodyX:[-4.7,17.4],
 copy:{
  name:{en:'DS3231 clock (RTC)',id:'Jam DS3231 (RTC)'},
  desc:{en:'A battery-backed real-time clock with two alarms and a 4 KB EEPROM, both reached over I2C (0x68 and 0x57).',id:'Jam waktu nyata dengan baterai cadangan, dua alarm, dan EEPROM 4 KB, keduanya lewat I2C (0x68 dan 0x57).'},
  note:{en:'Its clock runs on simulated time. Click it to set the temperature it reports or to pretend the backup battery died (the OSF flag).',id:'Jamnya berjalan mengikuti waktu simulasi. Klik untuk mengatur suhu yang dilaporkan atau berpura-pura baterai cadangannya habis (flag OSF).'},
 },
 power:{rail:['VCC','GND'],min:2.3,max:5.5,ma:0.2},
 inputs:[
  {type:'range',key:'temperature',label:{en:'Chip temperature',id:'Suhu chip'},min:-40,max:85,step:0.25,unit:'°C',default:27},
  {type:'toggle',key:'lostPower',label:{en:'Backup battery was empty (OSF set at power-up)',id:'Baterai cadangan sempat habis (OSF aktif saat nyala)'},default:true},
 ],
 defaults:{temperature:27,lostPower:true},
 create(ctx:DeviceCtx){
  const r=new Uint8Array(0x13);
  const nowCyc=():number=>ctx.env.now();
  let baseSecs=START_SECONDS,baseCyc=0,dowBase=dayOfWeekOf(START_SECONDS),mode12=false,reads=0,writes=0;
  const shadow=new Uint8Array(7);
  let dirty=false,first=false,ptr=0,epoch=0;
  r[0x0e]=0x1c;
  r[0x0f]=ctx.props.lostPower===false?0x08:0x88;
  const secs=():number=>baseSecs+Math.floor(Math.max(0,nowCyc()-baseCyc)/SIM_CLOCK_HZ);
  const dowAt=(t:number):number=>((dowBase-1+Math.floor(t/DAY)-Math.floor(baseSecs/DAY))%7+7)%7+1;
  /** BCD image of registers 0-6 for a time. */
  function encode(t:number):number[]{
   const d=new Date(t*1000);
   const h=d.getUTCHours();
   let hb:number;
   if(mode12){const pm=h>=12,h12=h%12===0?12:h%12;hb=0x40|(pm?0x20:0)|bcd(h12);}else hb=bcd(h);
   const y=d.getUTCFullYear()-2000;
   return [bcd(d.getUTCSeconds()),bcd(d.getUTCMinutes()),hb,dowAt(t),bcd(d.getUTCDate()),bcd(d.getUTCMonth()+1)|(y>=100?0x80:0),bcd(((y%100)+100)%100)];
  }
  /** Apply the (written) registers 0-6 as the new time. */
  function applyTime():void{
   const s=unbcd(shadow[0]!&0x7f),mi=unbcd(shadow[1]!&0x7f);
   let h:number;
   const hb=shadow[2]!;
   if(hb&0x40){mode12=true;h=(unbcd(hb&0x1f)%12)+(hb&0x20?12:0);}else{mode12=false;h=unbcd(hb&0x3f);}
   const date=unbcd(shadow[4]!&0x3f),mon=unbcd(shadow[5]!&0x1f),yr=2000+(shadow[5]!&0x80?100:0)+unbcd(shadow[6]!);
   const t=Date.UTC(yr,Math.max(0,mon-1),Math.max(1,date),h,mi,s)/1000;
   if(Number.isFinite(t)){
    baseSecs=t;baseCyc=nowCyc();dowBase=clamp(shadow[3]!&7,1,7);epoch++;scheduleSecond();
   }
   dirty=false;
  }
  const flush=():void=>{if(dirty)applyTime();};
  const freeze=():void=>{const e=encode(secs());for(let i=0;i<7;i++)shadow[i]=e[i]!;};

  // ---------- alarms and INT/SQW ----------
  const sqwPin=ctx.pin('SQW');
  const k32Pin=ctx.pin('32K');
  let intLevelHigh=true,sqEpoch=0,sqHz=0,sqLevel=true;
  const drivePin=(high:boolean):void=>{if(sqwPin)ctx.env.setPin(sqwPin,high);};
  function alarmHour(b:number):number{return b&0x40?(unbcd(b&0x1f)%12)+(b&0x20?12:0):unbcd(b&0x3f);}
  function alarm1Match(t:number):boolean{
   const d=new Date(t*1000),a=[r[7]!,r[8]!,r[9]!,r[10]!];
   if(!(a[0]!&0x80)&&unbcd(a[0]!&0x7f)!==d.getUTCSeconds())return false;
   if(!(a[1]!&0x80)&&unbcd(a[1]!&0x7f)!==d.getUTCMinutes())return false;
   if(!(a[2]!&0x80)&&alarmHour(a[2]!)!==d.getUTCHours())return false;
   if(!(a[3]!&0x80)){
    if(a[3]!&0x40){if((a[3]!&0x0f)!==dowAt(t))return false;}
    else if(unbcd(a[3]!&0x3f)!==d.getUTCDate())return false;
   }
   return true;
  }
  function alarm2Match(t:number):boolean{
   const d=new Date(t*1000),a=[r[0x0b]!,r[0x0c]!,r[0x0d]!];
   if(d.getUTCSeconds()!==0)return false;
   if(!(a[0]!&0x80)&&unbcd(a[0]!&0x7f)!==d.getUTCMinutes())return false;
   if(!(a[1]!&0x80)&&alarmHour(a[1]!)!==d.getUTCHours())return false;
   if(!(a[2]!&0x80)){
    if(a[2]!&0x40){if((a[2]!&0x0f)!==dowAt(t))return false;}
    else if(unbcd(a[2]!&0x3f)!==d.getUTCDate())return false;
   }
   return true;
  }
  const intAsserted=():boolean=>!!(r[0x0e]!&0x04)&&(((r[0x0e]!&1)&&(r[0x0f]!&1))!==0||((r[0x0e]!&2)&&(r[0x0f]!&2))!==0);
  const sqwFreq=():number=>[1,1024,4096,8192][(r[0x0e]!>>3)&3]!;
  function squareWave(my:number):void{
   if(my!==sqEpoch||!sqwPin)return;
   sqLevel=!sqLevel;drivePin(sqLevel);
   ctx.schedule(Math.round(SIM_CLOCK_HZ/(2*sqHz)),()=>squareWave(my));
  }
  /** Re-evaluate the INT/SQW pin after a flag or control change. */
  function updatePin():void{
   if(!(r[0x0e]!&0x04)){
    const f=sqwFreq();
    if(sqHz!==f){sqHz=f;const my=++sqEpoch;sqLevel=true;drivePin(true);ctx.schedule(Math.round(SIM_CLOCK_HZ/(2*f)),()=>squareWave(my));}
    return;
   }
   if(sqHz!==0){sqHz=0;sqEpoch++;intLevelHigh=sqLevel;}
   const high=!intAsserted();
   if(high!==intLevelHigh){intLevelHigh=high;drivePin(high);}
  }
  /** One tick of the clock (every whole simulated second). */
  function secondTick(my:number):void{
   if(my!==epoch)return;
   const t=secs();
   if(alarm1Match(t))r[0x0f]=r[0x0f]!|1;
   if(alarm2Match(t))r[0x0f]=r[0x0f]!|2;
   updatePin();
   scheduleSecond();
  }
  function scheduleSecond():void{
   const my=epoch;
   const into=Math.max(0,nowCyc()-baseCyc)%SIM_CLOCK_HZ;
   ctx.schedule(SIM_CLOCK_HZ-into,()=>secondTick(my));
  }
  scheduleSecond();
  if(sqwPin)drivePin(true);
  if(k32Pin)ctx.env.setPin(k32Pin,true);

  function readReg(a:number):number{
   if(a<7)return shadow[a]!;
   if(a===0x11||a===0x12){
    const q=Math.round(clamp(num(ctx.props.temperature,27),-40,85)*4);   // 0.25 degC steps, two's complement 10 bit
    const raw=q&0x3ff;
    return a===0x11?(raw>>2)&0xff:(raw&3)<<6;
   }
   return r[a]!;
  }
  function writeReg(a:number,v:number):void{
   if(a<7){shadow[a]=v;dirty=true;return;}
   if(a===0x0f){r[0x0f]=((r[0x0f]!&v&0x83)|(v&0x08)|(r[0x0f]!&0x04))&0xff;updatePin();return;}   // A1F/A2F/OSF only clear; EN32kHz is R/W; BSY is read only
   if(a===0x11||a===0x12)return;                                                                      // temperature is read only
   r[a]=v;
   if(a===0x0e)updatePin();
  }

  const rtc:I2cSlave={
   address:RTC_ADDRESS,
   onStart(_rep,write){flush();freeze();if(write)first=true;},
   onWrite(byte){
    writes++;
    if(first){ptr=byte%0x13;first=false;return true;}
    writeReg(ptr,byte);ptr=(ptr+1)%0x13;return true;
   },
   onRead(){reads++;const v=readReg(ptr);ptr=(ptr+1)%0x13;return v;},
   onStop(){flush();},
  };

  // ---------- AT24C32 ----------
  const mem=new Uint8Array(EEPROM_SIZE).fill(0xff);
  let eAddr=0,eIdx=0,eWriting=false,eBusy=false,ePending:{a:number;v:number}[]=[],eWrites=0,eReads=0,eEpoch=0;
  const eeprom:I2cSlave={
   // while a write cycle runs the chip does not answer its address (ACK polling)
   get address(){return eBusy?0x7f:EEPROM_ADDRESS;},
   onStart(_rep,write){eWriting=write;eIdx=0;ePending=[];},
   onWrite(byte){
    if(eIdx===0){eAddr=((byte&0x0f)<<8)|(eAddr&0xff);eIdx=1;return true;}
    if(eIdx===1){eAddr=(eAddr&0xf00)|byte;eIdx=2;return true;}
    const page=eAddr&~(EEPROM_PAGE-1);
    ePending.push({a:eAddr,v:byte});
    eAddr=page|((eAddr+1)&(EEPROM_PAGE-1));   // page write: the pointer wraps inside the 32-byte page
    eIdx++;
    return true;
   },
   onRead(){eReads++;const v=mem[eAddr]!;eAddr=(eAddr+1)%EEPROM_SIZE;return v;},
   onStop(){
    if(eWriting&&ePending.length){
     for(const w of ePending)mem[w.a]=w.v;
     eWrites+=ePending.length;ePending=[];
     eBusy=true;const my=++eEpoch;
     ctx.schedule(ms(EEPROM_TWR_MS),()=>{if(my===eEpoch)eBusy=false;});
    }
    eWriting=false;
   },
  };
  ctx.env.attachI2c?.(eeprom);

  return {
   state:()=>{
    const t=secs(),d=new Date(t*1000);
    const q=Math.round(clamp(num(ctx.props.temperature,27),-40,85)*4)/4;
    const p2=(n:number):string=>String(n).padStart(2,'0');
    return {
     hour:d.getUTCHours(),minute:d.getUTCMinutes(),second:d.getUTCSeconds(),year:d.getUTCFullYear(),month:d.getUTCMonth()+1,date:d.getUTCDate(),dayOfWeek:dowAt(t),
     time:`${d.getUTCFullYear()}-${p2(d.getUTCMonth()+1)}-${p2(d.getUTCDate())} ${p2(d.getUTCHours())}:${p2(d.getUTCMinutes())}:${p2(d.getUTCSeconds())}`,
     mode12,alarm1:!!(r[0x0f]!&1),alarm2:!!(r[0x0f]!&2),intLow:!intLevelHigh,osf:!!(r[0x0f]!&0x80),temperature:q,
     control:r[0x0e]!,status:r[0x0f]!,sqwHz:sqHz,reads,writes,eepromWrites:eWrites,eepromBusy:eBusy,eepromReads:eReads,address:RTC_ADDRESS,
    };
   },
   i2c:rtc,
  };
 },
});
