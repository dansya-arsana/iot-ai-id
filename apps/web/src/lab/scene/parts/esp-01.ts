/** ESP-01: 24.75 x 14.5 mm module (public ESP8266 module drawing, modelled by us): shield can, 8-pin flash, PCB-trace antenna, two LEDs, 2x4 header. Pairs with sim/devices/esp-01.ts. */
import {BoxGeometry,Group,Mesh,MeshBasicMaterial,PlaneGeometry} from 'three';
import type {PartProps} from '../../contract';
import type {Esp01State} from '../../sim/devices/esp-01';
import {canvasTexture,ownToon,solid} from '../materials';
import * as C from '../palette';
import {HALF_PI,MONO,definePart,extState,c,pin,callout,type Inner} from './kit';
import type {PinDef} from './types';

const L=24.75,W=14.5,BY=3,TH=1.0,TOP=BY+TH,P=2.54;
const HX=-L/2+1.5;                       // header row A x (the second row is one pitch further in)
const LED_OFF=0x3a3e45; // ds-allow-hex  (unlit indicator)
const ROW_A=['GND','GPIO2','GPIO0','RX'] as const,ROW_B=['TX','CH_PD','RST','VCC'] as const;
const colZ=(i:number):number=>(i-1.5)*P;
const TIP=TOP+2.5+4;

function print(g:Group,text:string,w:number,h:number,x:number,z:number,rot=0,y=TOP+0.03):void{
 const cv=document.createElement('canvas');cv.width=256;cv.height=Math.max(16,Math.round(256*h/w));
 const k=cv.getContext('2d')!;
 k.fillStyle='#f7f4ea';k.textAlign='center';k.textBaseline='middle';k.font=`600 ${Math.round(cv.height*0.7)}px ${MONO}`;k.fillText(text,128,cv.height/2);
 const m=new Mesh(new PlaneGeometry(w,h),new MeshBasicMaterial({map:canvasTexture(cv),transparent:true,toneMapped:false,depthWrite:false}));
 m.material.userData.own=true;m.material.userData.ownMap=true;m.rotation.set(-HALF_PI,0,rot);m.position.set(x,y,z);m.userData.noPick=true;m.userData.noInk=true;g.add(m);
}

function buildEsp01(_p:PartProps,g:Group):Inner{
 // PCB (module board, dark blue) and the antenna end with a gold meander trace
 g.add(solid(new BoxGeometry(L,TH,W),C.SONAR_PCB,{outline:true,edges:true,pos:[0,BY+TH/2,0]}));
 for(let i=0;i<5;i++)g.add(solid(new BoxGeometry(3.2,0.08,0.6),C.GOLD,{pos:[L/2-2.4,TOP+0.04,-4.4+i*2.2],cast:false,finish:'metal'}));
 for(let i=0;i<4;i++)g.add(solid(new BoxGeometry(0.6,0.08,1.7),C.GOLD,{pos:[L/2-(i%2?3.9:0.9),TOP+0.04,-3.3+i*2.2],cast:false,finish:'metal'}));
 // ESP8266EX shield can (about 12 x 12 mm, 1.2 tall) and the 8-pin SPI flash
 g.add(solid(new BoxGeometry(9,1.2,11),C.SILVER,{outline:true,edges:true,pos:[-1,TOP+0.6,0],finish:'metal'}));
 g.add(solid(new BoxGeometry(5,1.1,4.1),C.CHIP,{outline:true,pos:[6.2,TOP+0.55,-3.6]}));
 for(const sz of [-1,1])for(let i=0;i<4;i++)g.add(solid(new BoxGeometry(0.45,0.25,0.9),C.SILVER,{pos:[4.7+i*1.0,TOP+0.15,-3.6+sz*2.3],cast:false,finish:'metal'}));
 print(g,'ESP-01',4,1.0,-1,0,Math.PI,TOP+1.25);
 // LEDs: red power (steady) and blue serial activity
 const pwr=ownToon(LED_OFF),txm=ownToon(LED_OFF);
 const lp=new Mesh(new BoxGeometry(1.6,0.6,0.9),pwr);lp.position.set(5.0,TOP+0.3,5.6);g.add(lp);
 const lt=new Mesh(new BoxGeometry(1.6,0.6,0.9),txm);lt.position.set(7.3,TOP+0.3,5.6);g.add(lt);
 for(const x of [3.4])g.add(solid(new BoxGeometry(1.0,0.4,0.5),C.CREAM_DARK,{pos:[x,TOP+0.2,5.6],cast:false}));
 // 2x4 header, pins standing up
 g.add(solid(new BoxGeometry(2*P,2.5,4*P),C.HEADER_BLACK,{pos:[HX+P/2,TOP+1.25,0],outline:true}));
 for(const dx of [0,P])for(let i=0;i<4;i++)g.add(solid(new BoxGeometry(0.64,5.5,0.64),C.GOLD,{pos:[HX+dx,TOP+1.25+0.5,colZ(i)],cast:false,finish:'metal'}));
 print(g,ROW_A.join(' '),9.8,1.0,HX,0,HALF_PI,TOP+0.03);print(g,ROW_B.join(' '),9.8,1.0,HX+P+1.8,0,HALF_PI,TOP+0.03);
 let lastTx=0,flash=0;
 return {
  apply(s,dt){
   const st=extState<Esp01State>(s,'esp-01');
   if(!st)return;
   const on=st.powered&&st.enabled;
   pwr.color.setHex(st.powered?C.RED_ALERT:LED_OFF);pwr.emissive.setHex(C.RED_ALERT);pwr.emissiveIntensity=st.powered?1.4:0;
   if(st.txBytes!==lastTx){lastTx=st.txBytes;flash=0.12;}else flash=Math.max(0,flash-dt);
   const lit=on&&flash>0;
   txm.color.setHex(lit?C.BUTTON_CAP:LED_OFF);txm.emissive.setHex(C.BUTTON_CAP);txm.emissiveIntensity=lit?1.8:0;
  },
 };
}

const pins:Record<string,PinDef>={};
const T=(k:string,t:PinDef['type'],en:string,idn:string,dx:number,i:number):void=>{pins[k]=pin([HX+dx,TIP,colZ(i)],t,en,idn);};
ROW_A.forEach((k,i)=>{
 if(k==='GND')T(k,'ground','GND: ground','GND: ground',0,i);
 else if(k==='RX')T(k,'input','RX: serial in, 3.3 V logic only','RX: masuk serial, hanya logika 3,3 V',0,i);
 else T(k,'input',`${k}: boot-mode pin (leave high or floating for normal boot)`,`${k}: pin mode boot (biarkan high atau mengambang untuk boot normal)`,0,i);
});
ROW_B.forEach((k,i)=>{
 if(k==='VCC')T(k,'power','VCC: 3.3 V only, never 5 V','VCC: hanya 3,3 V, jangan 5 V',P,i);
 else if(k==='TX')T(k,'output','TX: serial out, 3.3 V','TX: keluar serial, 3,3 V',P,i);
 else if(k==='CH_PD')T(k,'input','CH_PD (EN): must be high or the chip stays off','CH_PD (EN): harus high atau chip mati',P,i);
 else T(k,'input','RST: pull low to reset','RST: tarik ke low untuk reset',P,i);
});

const ordered:Record<string,PinDef>={};
for(const k of ['VCC','TX','RX','GND','CH_PD','RST','GPIO0','GPIO2'])ordered[k]=pins[k]!;   // device pin order

export const esp01=definePart({
 kind:'esp-01',name:c('ESP-01 (ESP8266)','ESP-01 (ESP8266)'),
 pins:ordered,deskMm:[25,15],
 callouts:[
  callout('can',[-1,TOP+2,0],'Metal can over the ESP8266 chip','Penutup logam di atas chip ESP8266'),
  callout('antenna',[L/2-3,TOP+1.2,0],'Printed antenna: no radio signal exists in the lab','Antena tercetak: di lab tidak ada sinyal radio'),
  callout('header',[HX+P/2,TOP+4,0],'2 x 4 header: power it from 3.3 V and tie CH_PD high','Header 2 x 4: beri daya 3,3 V dan ikat CH_PD ke high'),
  callout('leds',[6,TOP+1.6,5.6],'Red = powered, blue flashes on serial replies','Merah = menyala, biru berkedip saat membalas serial'),
 ],
 make:buildEsp01,
});
