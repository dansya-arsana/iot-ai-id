import {Group,Mesh,MeshBasicMaterial} from 'three';
import type {PartProps} from '../../contract';
import {PITCH} from '../layout';
import {addOutline,glowTexture,ownToon} from '../materials';
import * as C from '../palette';
import {domeGeo,sprite,leg,pool,ledBright,definePart,c,pin,callout,type Inner} from './kit';

function buildRgb(_p:PartProps,g:Group):Inner{
 const cx=1.5*PITCH;
 const mat=ownToon(C.LED_DIM.white,'epoxy');
 const dome=new Mesh(domeGeo(),mat);dome.position.x=cx;dome.castShadow=true;g.add(dome);addOutline(dome);
 for(let i=0;i<4;i++)g.add(leg(i*PITCH,[2.6,3.6,2.8,3.2][i]!));
 const halo=sprite(glowTexture(),C.WHITE,24,9,cx,false);g.add(halo);
 const pl=pool(C.WHITE,cx);g.add(pl);
 return {
  apply(s){
   if(s.kind!=='rgb-led')return;
   const r=ledBright(s.r),gg=ledBright(s.g),b=ledBright(s.b),m=Math.max(r,gg,b);
   // hue-preserving mix: normalise by the brightest channel and push saturation so tone mapping keeps the colour (no white-out)
   const k=m>0.001?1/m:0,sr=(r*k)**1.7,sg=(gg*k)**1.7,sb=(b*k)**1.7;
   if(m>0.001)mat.color.setRGB(0.1+0.75*sr*m,0.1+0.75*sg*m,0.1+0.75*sb*m);else mat.color.set(C.LED_DIM.white);
   mat.emissive.setRGB(sr*0.5,sg*0.5,sb*0.5);mat.emissiveIntensity=m>0.001?0.4+2.2*m:0;
   halo.material.color.setRGB(sr,sg,sb);halo.material.opacity=m*0.6;halo.scale.setScalar(10+22*m);
   (pl.material as MeshBasicMaterial).color.setRGB(sr,sg,sb);(pl.material as MeshBasicMaterial).opacity=0.45*m;
  },
 };
}


export const rgbLed=definePart({kind:'rgb-led',name:c('RGB LED','LED RGB'),pins:{R:pin([0,0,0],'anode','Red','Merah'),G:pin([PITCH,0,0],'anode','Green','Hijau'),B:pin([2*PITCH,0,0],'anode','Blue','Biru'),K:pin([3*PITCH,0,0],'cathode','Common ground','Ground bersama')},callouts:[callout('common',[3*PITCH,3.4,0],'Longest leg = common ground','Kaki terpanjang = ground bersama')],make:buildRgb});
