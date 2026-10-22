/** DS3231 RTC on a ZS-042 style breakout: 22 x 38 mm board standing on a 6-pin header, SOIC-16W clock chip, SO-8 EEPROM, CR2032 holder. Pairs with sim/devices/ds3231-rtc.ts. */
import {BoxGeometry,CylinderGeometry,Group,Mesh,MeshBasicMaterial,MeshStandardMaterial,PlaneGeometry} from 'three';
import type {PartProps} from '../../contract';
import type {Ds3231State} from '../../sim/devices/ds3231-rtc';
import {PITCH} from '../layout';
import {canvasTexture,solid} from '../materials';
import * as C from '../palette';
import {MONO,leg,definePart,extState,c,pin,callout,type Inner} from './kit';

const CELL=0xc7ccd4; // ds-allow-hex  (stainless top of the CR2032 coin cell)
const HOLDER=0x23262c; // ds-allow-hex  (black plastic coin-cell holder)
const SMD=0xb8a27a; // ds-allow-hex  (tan SMD resistor / capacitor body)

const PINS=['32K','SQW','SCL','SDA','VCC','GND'];

function label(lines:readonly string[],w:number,h:number,px:number,color:string=C.SILKSCREEN):Mesh{
 const cv=document.createElement('canvas');cv.width=256;cv.height=Math.round(256*h/w);
 const g=cv.getContext('2d')!;g.fillStyle=color;g.textAlign='center';g.textBaseline='middle';g.font=`700 ${px}px ${MONO}`;
 lines.forEach((t,i)=>g.fillText(t,128,cv.height*(i+0.5)/lines.length));
 const m=new Mesh(new PlaneGeometry(w,h),new MeshBasicMaterial({map:canvasTexture(cv),transparent:true,toneMapped:false,depthWrite:false}));
 m.material.userData.own=true;m.material.userData.ownMap=true;m.userData.noPick=true;m.userData.noInk=true;
 return m;
}

function buildRtc(_p:PartProps,g:Group):Inner{
 const cx=2.5*PITCH,BW=22,BH=38,T=1.4,y0=3,zc=-T/2;
 for(let i=0;i<PINS.length;i++)g.add(leg(i*PITCH,y0+0.4));
 g.add(solid(new BoxGeometry(BW,BH,T),C.SONAR_PCB,{outline:true,edges:true,pos:[cx,y0+BH/2,zc],own:true}));
 const zf=T/2+zc;   // front face of the board
 // DS3231 SOIC-16W: 10.3 x 7.5 x 2.65 mm, long side across the board
 const chipY=y0+12,chipX=cx-2;
 g.add(solid(new BoxGeometry(10.3,7.5,2.4),C.CHIP,{outline:true,edges:true,pos:[chipX,chipY,zf+1.2],own:true}));
 const cl=label(['DS3231','SN'],9,4.4,52,C.CHIP_PRINT);cl.position.set(chipX,chipY,zf+2.43);g.add(cl);
 // AT24C32 EEPROM, SO-8 (4.9 x 3.9 x 1.5 mm)
 g.add(solid(new BoxGeometry(4.9,3.9,1.5),C.CHIP,{outline:true,pos:[cx+6.6,y0+12,zf+0.75],own:true}));
 const el=label(['24C32'],4.6,2,40,C.CHIP_PRINT);el.position.set(cx+6.6,y0+12,zf+1.52);g.add(el);
 // passives
 for(const [x,y] of [[-7.5,6.5],[-5.5,6.5],[3.5,6.5],[5.5,6.5],[-8.4,17]] as const)g.add(solid(new BoxGeometry(1.6,0.8,0.55),SMD,{pos:[cx+x,y0+y,zf+0.27],own:true}));
 // power LED (red) near the header
 const led=new MeshStandardMaterial({color:C.RED_ALERT,emissive:C.RED_ALERT,emissiveIntensity:0.9});led.userData.own=true;
 const lm=new Mesh(new BoxGeometry(1.6,0.8,0.7),led);lm.position.set(cx+8,y0+4,zf+0.35);lm.userData.noPick=true;g.add(lm);
 // coin-cell holder 20 mm and the CR2032 in it
 const cyl=(r:number,h:number,col:number,y:number,fin?:'metal'):Mesh=>{
  const m=solid(new CylinderGeometry(r,r,h,28),col,{outline:true,pos:[cx,y,zf+h/2],rot:[Math.PI/2,0,0],own:true,...(fin?{finish:fin}:{})});m.position.y=y;return m;
 };
 g.add(cyl(10.6,3.4,HOLDER,y0+BH-10.8));
 const cell=cyl(10,3.0,CELL,y0+BH-10.8,'metal');cell.position.z=zf+3.4+0.1;g.add(cell);
 const cellLabel=label(['CR2032','3V'],12,6,48,C.CHIP_PRINT);cellLabel.position.set(cx,y0+BH-10.8,zf+3.4+1.6+0.05);g.add(cellLabel);
 // silkscreen of the header pins
 const sl=label(['32K SQW SCL SDA VCC GND'],19,2.4,15);sl.position.set(cx,y0+2.4,zf+0.03);g.add(sl);
 return {
  apply(s){
   const st=extState<Ds3231State>(s,'ds3231-rtc');
   if(!st)return;
   // the power LED brightens while INT/SQW is pulled low by an alarm
   led.emissiveIntensity=st.intLow?2.2:0.9;
  },
 };
}

const P=(i:number):[number,number,number]=>[i*PITCH,0,0];
export const ds3231Rtc=definePart({
 kind:'ds3231-rtc',name:c('DS3231 clock (RTC)','Jam DS3231 (RTC)'),
 pins:{
  '32K':pin(P(0),'output','32K (32.768 kHz output)','32K (keluaran 32,768 kHz)'),SQW:pin(P(1),'output','SQW/INT (alarm or square wave)','SQW/INT (alarm atau gelombang kotak)'),
  SCL:pin(P(2),'input','SCL (I2C clock)','SCL (clock I2C)'),SDA:pin(P(3),'input','SDA (I2C data)','SDA (data I2C)'),
  VCC:pin(P(4),'power','Power 2.3V to 5.5V','Daya 2,3V sampai 5,5V'),GND:pin(P(5),'ground','Ground','Ground'),
 },
 callouts:[
  callout('chip',[2.5*PITCH-2,3+12+2,2.5],'The DS3231 counts seconds with a temperature-corrected crystal','DS3231 menghitung detik dengan kristal yang dikoreksi suhu'),
  callout('cell',[2.5*PITCH,3+38-11,6],'The coin cell keeps the time when power is off','Baterai koin menjaga waktu saat daya mati'),
  callout('eeprom',[2.5*PITCH+6.6,3+12+1.5,1.5],'The small chip is a 4 KB EEPROM at address 0x57','Chip kecil ini EEPROM 4 KB di alamat 0x57'),
 ],
 make:buildRtc,
});
