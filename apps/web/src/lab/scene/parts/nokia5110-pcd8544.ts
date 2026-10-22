/** Nokia 5110 breakout: 43 x 43 mm red board, 8-pin header, 84 x 48 pixel PCD8544 glass (active area about 30 x 20 mm, chip-on-glass) with a white-blue backlight. The glass is drawn from the live DDRAM. Pairs with sim/devices/nokia5110-pcd8544.ts. */
import {BoxGeometry,Group,Mesh,MeshBasicMaterial,PlaneGeometry} from 'three';
import type {PartProps} from '../../contract';
import type {Nokia5110Pcd8544State} from '../../sim/devices/nokia5110-pcd8544';
import {canvasTexture,solid} from '../materials';
import * as C from '../palette';
import {MONO,PITCH,leg,definePart,extState,c,pin,callout,type Inner} from './kit';

const BOARD=0xb3262d; // ds-allow-hex  (red solder mask of the common breakout)
const GLASS=0xdfe3df; // ds-allow-hex  (clear LCD glass edge)
const SHELL=0x1c1d21; // ds-allow-hex  (black frame around the glass)
const PX=5;                                       // canvas pixels per LCD pixel
const OFF:[number,number,number]=[168,180,160];   // unlit glass (grey-green)
const LIT:[number,number,number]=[214,236,255];   // backlit glass (white-blue)
const INK_CSS='rgb(18,24,36)';

function buildNokia(_p:PartProps,g:Group):Inner{
 const W=43,H=43,TH=1.6,y0=3,cx=3.5*PITCH,zc=-TH/2;
 for(let i=0;i<8;i++)g.add(leg(i*PITCH,y0+0.4));
 g.add(solid(new BoxGeometry(W,H,TH),BOARD,{outline:true,edges:true,pos:[cx,y0+H/2,zc],own:true}));
 // glass stack: black frame, then the 38 x 30 mm glass plate; the PCD8544 chip bonds to the lower edge
 const gy=y0+H/2+3;
 g.add(solid(new BoxGeometry(41,33,2.2),SHELL,{outline:true,edges:true,pos:[cx,gy,TH/2+1.1+zc],own:true}));
 g.add(solid(new BoxGeometry(37.6,29,0.5),GLASS,{outline:true,pos:[cx,gy+0.4,TH/2+2.45+zc],own:true}));
 g.add(solid(new BoxGeometry(14,2.4,0.8),C.CHIP,{outline:true,pos:[cx,gy-14.1,TH/2+2.7+zc],own:true}));
 const cv=document.createElement('canvas');cv.width=84*PX;cv.height=48*PX;
 const ctx=cv.getContext('2d')!;
 const tex=canvasTexture(cv);
 const mat=new MeshBasicMaterial({map:tex,toneMapped:false});mat.userData.own=true;mat.userData.ownMap=true;
 // lift the window clear of the glass box (top face at +2.70) and bias its depth so the rows never z-fight
 mat.polygonOffset=true;mat.polygonOffsetFactor=-2;mat.polygonOffsetUnits=-2;
 const win=new Mesh(new PlaneGeometry(30.2,20.2),mat);win.position.set(cx,gy+2,TH/2+3.2+zc);win.userData.noPick=true;win.userData.noInk=true;g.add(win);
 const lcv=document.createElement('canvas');lcv.width=512;lcv.height=48;
 const lg=lcv.getContext('2d')!;lg.fillStyle=C.SILKSCREEN;lg.font=`600 24px ${MONO}`;lg.textAlign='center';lg.textBaseline='middle';
 lg.fillText('RST CE DC DIN CLK VCC LT GND',256,24);
 const lab=new Mesh(new PlaneGeometry(26,2.4),new MeshBasicMaterial({map:canvasTexture(lcv),transparent:true,toneMapped:false,depthWrite:false}));
 lab.material.userData.own=true;lab.material.userData.ownMap=true;
 lab.position.set(cx,y0+2.6,TH/2+0.03+zc);lab.userData.noPick=true;lab.userData.noInk=true;g.add(lab);
 let last='';
 const mix=(a:readonly number[],b:readonly number[],t:number):string=>`rgb(${[0,1,2].map(i=>Math.round(a[i]!+(b[i]!-a[i]!)*t)).join(',')})`;
 const draw=(st:Nokia5110Pcd8544State):void=>{
  const key=[st.fb,st.display,st.power,st.vlcd,st.light].join('|');
  if(key===last)return;last=key;
  const lit=Math.min(1,st.light);
  // contrast from Vlcd: invisible below about 5.8 V, strong near 7 V, glass darkens past about 7.6 V
  const a=st.power?Math.min(1,Math.max(0,(st.vlcd-5.8)/1.2)):0;
  const over=st.power?Math.min(1,Math.max(0,(st.vlcd-7.6)/1.0)):0;
  const bg=mix(OFF,LIT,lit);
  ctx.fillStyle=bg;ctx.fillRect(0,0,84*PX,48*PX);
  if(over>0){ctx.globalAlpha=0.75*over;ctx.fillStyle=INK_CSS;ctx.fillRect(0,0,84*PX,48*PX);}
  if(a>0&&st.display!=='blank'){
   ctx.fillStyle=INK_CSS;ctx.globalAlpha=0.15+0.85*a;
   const all=st.display==='on',inv=st.display==='inverse';
   for(let col=0;col<84;col++)for(let bank=0;bank<6;bank++){
    const byte=parseInt(st.fb.substr((bank*84+col)*2,2),16);
    for(let bit=0;bit<8;bit++){
     const v=((byte>>bit)&1)===1;
     if(all||(inv?!v:v))ctx.fillRect(col*PX,(bank*8+bit)*PX,PX-0.7,PX-0.7);
    }
   }
  }
  ctx.globalAlpha=1;tex.needsUpdate=true;
 };
 draw({fb:'00'.repeat(504),display:'blank',power:false,vop:0,vlcd:3.06,bias:0,tc:0,ext:false,vertical:false,x:0,y:0,light:0,selected:true,cmds:0,datas:0,invalid:0,badMode:0,resets:0,lastCmd:0});
 return {
  apply(s){
   const st=extState<Nokia5110Pcd8544State>(s,'nokia5110-pcd8544');
   if(st)draw(st);
  },
 };
}

const IN=(i:number)=>[i*PITCH,0,0] as const;
export const nokia5110Pcd8544=definePart({
 kind:'nokia5110-pcd8544',name:c('Nokia 5110 display (PCD8544)','Layar Nokia 5110 (PCD8544)'),
 pins:{
  RST:pin(IN(0),'input','RST (reset)','RST (reset)'),CE:pin(IN(1),'input','CE (chip select)','CE (pilih chip)'),DC:pin(IN(2),'input','DC (data / command)','DC (data / perintah)'),
  DIN:pin(IN(3),'input','DIN (SPI MOSI)','DIN (SPI MOSI)'),CLK:pin(IN(4),'input','CLK (SPI clock)','CLK (clock SPI)'),VCC:pin(IN(5),'power','3.3V','3,3V'),
  LIGHT:pin(IN(6),'input','LIGHT (backlight)','LIGHT (lampu latar)'),GND:pin(IN(7),'ground','Ground','Ground'),
 },
 callouts:[
  callout('glass',[3.5*PITCH,28,4],'84 x 48 pixels, drawn from the chip\'s display memory','84 x 48 piksel, digambar dari memori tampilan chip'),
  callout('header',[3.5*PITCH,3,0],'DC tells the chip whether a byte is a command or pixels','DC memberi tahu chip apakah byte itu perintah atau piksel'),
 ],
 make:buildNokia,
});
