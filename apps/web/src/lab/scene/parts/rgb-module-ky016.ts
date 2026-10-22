/** RGB-MODULE-KY016: a small board with a 5 mm RGB LED, three 150 ohm resistors and a 4 pin header. Pairs with sim/devices/rgb-module-ky016.ts. */
import {BoxGeometry,Group,Mesh,MeshBasicMaterial} from 'three';
import type {PartProps} from '../../contract';
import type {RgbModuleKy016State} from '../../sim/devices/rgb-module-ky016';
import {PITCH} from '../layout';
import {addOutline,glowTexture,ownToon,solid} from '../materials';
import * as C from '../palette';
import {domeGeo,sprite,leg,pool,ledBright,definePart,extState,c,pin,callout,type Inner} from './kit';

function buildKy016(_p:PartProps,g:Group):Inner{
 const cx=1.5*PITCH;
 for(let i=0;i<4;i++)g.add(leg(i*PITCH,3));
 // 18 x 15 mm board on the header; resistors in a row behind the LED, one per colour
 g.add(solid(new BoxGeometry(18,1.2,15),C.PCB,{outline:true,edges:true,pos:[cx,3.6,-5.5]}));
 for(let i=0;i<3;i++)g.add(solid(new BoxGeometry(1.6,0.9,3.2),C.RESISTOR_BODY,{pos:[cx-4+i*4,4.6,0.2],cast:false}));
 const mat=ownToon(C.LED_DIM.white,'epoxy');
 const dome=new Mesh(domeGeo(),mat);dome.position.set(cx,2.2,-4);dome.castShadow=true;g.add(dome);addOutline(dome);
 const halo=sprite(glowTexture(),C.WHITE,24,14,cx,false);halo.position.z=-4;g.add(halo);
 const pl=pool(C.WHITE,cx);pl.position.z=-4;g.add(pl);
 return {
  apply(s){
   const st=extState<RgbModuleKy016State>(s,'rgb-module-ky016');
   if(!st)return;
   const r=ledBright(st.r),gg=ledBright(st.g),b=ledBright(st.b),m=Math.max(r,gg,b);
   // hue-preserving mix, same as the plain RGB LED
   const k=m>0.001?1/m:0,sr=(r*k)**1.7,sg=(gg*k)**1.7,sb=(b*k)**1.7;
   if(m>0.001)mat.color.setRGB(0.1+0.75*sr*m,0.1+0.75*sg*m,0.1+0.75*sb*m);else mat.color.set(C.LED_DIM.white);
   mat.emissive.setRGB(sr*0.5,sg*0.5,sb*0.5);mat.emissiveIntensity=m>0.001?0.4+2.2*m:0;
   halo.material.color.setRGB(sr,sg,sb);halo.material.opacity=m*0.6;halo.scale.setScalar(10+22*m);
   (pl.material as MeshBasicMaterial).color.setRGB(sr,sg,sb);(pl.material as MeshBasicMaterial).opacity=0.45*m;
  },
 };
}

export const rgbModuleKy016=definePart({
 kind:'rgb-module-ky016',name:c('RGB LED module (KY-016)','Modul LED RGB (KY-016)'),
 pins:{R:pin([0,0,0],'input','Red','Merah'),G:pin([PITCH,0,0],'input','Green','Hijau'),B:pin([2*PITCH,0,0],'input','Blue','Biru'),GND:pin([3*PITCH,0,0],'ground','Minus','Minus')},
 callouts:[callout('led',[1.5*PITCH,18,-4],'Mix the colours with PWM on R, G, B','Campur warna dengan PWM di R, G, B'),callout('res',[1.5*PITCH,8,0.2],'One 150 ohm resistor per colour is built in','Satu resistor 150 ohm per warna sudah ada')],
 make:buildKy016,
});
