/** PHOTODIODE: BPW34-class 5 mm black daylight-filter photodiode on a small 3-pin module board with a load resistor. Pairs with sim/devices/photodiode.ts. */
import {BoxGeometry,Color,Group,MeshStandardMaterial} from 'three';
import type {PartProps} from '../../contract';
import type {PhotodiodeState} from '../../sim/devices/photodiode';
import {PITCH} from '../layout';
import {ownToon,solid} from '../materials';
import * as C from '../palette';
import {domeGeo,leg,definePart,extState,c,pin,callout,type Inner} from './kit';

const PD_BLACK=0x15161a; // ds-allow-hex  (black epoxy that blocks visible light)

function buildPhotodiode(_p:PartProps,g:Group):Inner{
 const cx=PITCH;
 for(let i=0;i<3;i++)g.add(leg(i*PITCH,3));
 // 14 x 11 mm module board, resistor and a level bar showing the signal
 g.add(solid(new BoxGeometry(3*PITCH+3,1.2,11),C.PCB,{outline:true,pos:[cx,3.6,0]}));
 g.add(solid(new BoxGeometry(3.2,0.8,1.6),C.RESISTOR_BODY,{outline:true,pos:[cx+3.6,4.6,-4.3]}));
 const bar=ownToon(C.LED_SMD_OFF);
 const barMesh=solid(new BoxGeometry(5,0.5,1),C.LED_SMD_OFF,{cast:false,pos:[cx-1.5,4.4,4.4]});barMesh.material=bar;g.add(barMesh);
 const dome=solid(domeGeo(),PD_BLACK,{outline:true,pos:[cx,2.0,0],finish:'epoxy'});
 dome.scale.set(0.8,0.5,0.8);g.add(dome);
 const dim=new Color(C.LED_SMD_OFF),live=new Color(C.LIVE);
 return {
  apply(s){
   const st=extState<PhotodiodeState>(s,'photodiode');
   if(!st)return;
   const b=Math.min(1,st.adc/1023);
   (bar as MeshStandardMaterial).color.copy(dim).lerp(live,b);bar.emissive.copy(live);bar.emissiveIntensity=b>0.02?0.2+0.8*b:0;
   barMesh.scale.x=0.2+0.8*b;
  },
 };
}

export const photodiode=definePart({
 kind:'photodiode',name:c('Photodiode module','Modul fotodioda'),
 pins:{VCC:pin([0,0,0],'power','5V','5V'),SIG:pin([PITCH,0,0],'output','SIG (analog)','SIG (analog)'),GND:pin([2*PITCH,0,0],'ground','Ground','Ground')},
 callouts:[callout('lens',[PITCH,9,0],'The black dome only passes infrared; more light, more current','Kubah hitam hanya meneruskan inframerah; makin banyak cahaya, makin besar arus')],
 make:buildPhotodiode,
});
