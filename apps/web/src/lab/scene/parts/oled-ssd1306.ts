/** OLED-SSD1306: 0.96in 128x64 I2C module (27.3 x 27.8 mm board). The screen is a CanvasTexture of the live frame buffer. Pairs with sim/devices/oled-ssd1306.ts. */
import {BoxGeometry,Color,Group,Mesh,MeshBasicMaterial,PlaneGeometry} from 'three';
import type {PartProps} from '../../contract';
import type {OledSsd1306State} from '../../sim/devices/oled-ssd1306';
import {PITCH} from '../layout';
import {canvasTexture,solid} from '../materials';
import * as C from '../palette';
import {MONO,leg,definePart,extState,c,pin,callout,type Inner} from './kit';

const BOARD=0x1b1d22; // ds-allow-hex  (black solder mask of the module)
const GLASS=0x050607; // ds-allow-hex  (dark OLED glass)
const PX_WHITE='#e9f1ff'; // ds-allow-hex
const PX_BLUE='#58b8ff'; // ds-allow-hex

function buildOled(_p:PartProps,g:Group):Inner{
 const cx=1.5*PITCH,BW=27.3,BH=27.8,T=1.2,y0=3;
 for(let i=0;i<4;i++)g.add(leg(i*PITCH,y0+0.4));
 const zc=-T/2;
 g.add(solid(new BoxGeometry(BW,BH,T),BOARD,{outline:true,edges:true,pos:[cx,y0+BH/2,zc],own:true}));
 // glass slab (26.7 x 19.26 mm panel) toward the top of the board
 const gy=y0+BH-2.2-9.6;
 g.add(solid(new BoxGeometry(26.7,19.3,0.5),GLASS,{outline:true,pos:[cx,gy,T/2+0.25+zc],own:true}));
 // active area 21.74 x 10.86 mm
 const cv=document.createElement('canvas');cv.width=128;cv.height=64;
 const ctx=cv.getContext('2d')!;
 ctx.fillStyle='#000';ctx.fillRect(0,0,128,64);
 const tex=canvasTexture(cv);
 tex.generateMipmaps=false;
 const screen=new Mesh(new PlaneGeometry(21.74,10.86),new MeshBasicMaterial({map:tex,toneMapped:false}));
 screen.material.userData.own=true;screen.material.userData.ownMap=true;
 screen.position.set(cx,gy+1,T/2+0.52+zc);screen.userData.noPick=true;screen.userData.noInk=true;g.add(screen);
 // soft glow halo around the lit pixels
 const gcv=document.createElement('canvas');gcv.width=64;gcv.height=32;
 const halo=new Mesh(new PlaneGeometry(25,14),new MeshBasicMaterial({map:canvasTexture(gcv),transparent:true,toneMapped:false,depthWrite:false,opacity:0}));
 halo.material.userData.own=true;halo.material.userData.ownMap=true;
 halo.position.set(cx,gy+1,T/2+0.54+zc);halo.userData.noPick=true;halo.userData.noInk=true;g.add(halo);
 // silkscreen labels on the lower board edge
 const lcv=document.createElement('canvas');lcv.width=256;lcv.height=48;
 const lg=lcv.getContext('2d')!;lg.fillStyle=C.SILKSCREEN;lg.font=`600 26px ${MONO}`;lg.textAlign='center';lg.textBaseline='middle';
 lg.fillText('VCC SDA SCL GND',128,24);
 const lab=new Mesh(new PlaneGeometry(14,2.6),new MeshBasicMaterial({map:canvasTexture(lcv),transparent:true,toneMapped:false,depthWrite:false}));
 lab.material.userData.own=true;lab.material.userData.ownMap=true;
 lab.position.set(cx,y0+3.2,T/2+0.03+zc);lab.userData.noPick=true;lab.userData.noInk=true;g.add(lab);

 let last='';let lastColor='';let lastContrast=-1;
 const px=new Uint8ClampedArray(128*64*4);
 const sc=new Color();
 return {
  apply(s){
   const st=extState<OledSsd1306State>(s,'oled-ssd1306');
   if(!st)return;
   if(st.fb!==last||st.color!==lastColor||st.contrast!==lastContrast){
    last=st.fb;lastColor=st.color;lastContrast=st.contrast;
    sc.set(st.color==='blue'?PX_BLUE:PX_WHITE);
    const k=0.35+0.65*(st.contrast/255);
    const r=sc.r*255*k,gg=sc.g*255*k,b=sc.b*255*k;
    let any=0;
    for(let i=0;i<1024;i++){
     const byte=parseInt(st.fb.substr(i*2,2),16);
     const pg=i>>7,x=i&127;
     for(let bit=0;bit<8;bit++){
      const o=((pg*8+bit)*128+x)*4,v=(byte>>bit)&1;
      px[o]=v?r:2;px[o+1]=v?gg:3;px[o+2]=v?b:4;px[o+3]=255;any+=v;
     }
    }
    if(typeof ImageData!=='undefined')ctx.putImageData(new ImageData(px,128,64),0,0); // absent only in headless tests
    tex.needsUpdate=true;
    (halo.material as MeshBasicMaterial).opacity=any>0?0.16*k:0;
   }
  },
 };
}

export const oledSsd1306=definePart({
 kind:'oled-ssd1306',name:c('OLED display 0.96" (SSD1306)','Layar OLED 0,96" (SSD1306)'),
 pins:{VCC:pin([0*PITCH,0,0],'power','5V','5V'),SDA:pin([1*PITCH,0,0],'input','SDA (I2C data)','SDA (data I2C)'),SCL:pin([2*PITCH,0,0],'input','SCL (I2C clock)','SCL (clock I2C)'),GND:pin([3*PITCH,0,0],'ground','Ground','Ground')},
 callouts:[callout('screen',[1.5*PITCH,18,1],'Each lit pixel is one bit the sketch sent','Setiap piksel menyala adalah satu bit kiriman sketch'),callout('pins',[1.5*PITCH,3,0],'Only four wires: power and the I2C pair','Hanya empat kabel: daya dan pasangan I2C')],
 make:buildOled,
});
