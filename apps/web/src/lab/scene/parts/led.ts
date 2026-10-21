import {BoxGeometry,Color,Group,Mesh,MeshBasicMaterial} from 'three';
import type {LedColor,PartProps} from '../../contract';
import {PITCH} from '../layout';
import {addOutline,glowTexture,ownToon,solid} from '../materials';
import * as C from '../palette';
import {domeGeo,ledBright,sprite,leg,pool,definePart,c,pin,callout,type Inner} from './kit';

function buildLed(props:PartProps,g:Group):Inner{
 const color=(typeof props.color==='string'&&props.color in C.LED_COLOR?props.color:'red') as LedColor;
 const full=new Color(C.LED_COLOR[color]),dim=new Color(C.LED_DIM[color]);
 const cx=PITCH/2;
 const mat=ownToon(C.LED_DIM[color],'epoxy');
 const dome=new Mesh(domeGeo(),mat);dome.position.x=cx;dome.castShadow=true;
 g.add(dome);addOutline(dome);
 const die=solid(new BoxGeometry(1.6,1.4,1.6),C.SILVER_DARK,{pos:[cx,5.2,0],cast:false,finish:'metal'});g.add(die);
 g.add(leg(0,3.2),leg(PITCH,2.6));
 const halo=sprite(glowTexture(),C.LED_COLOR[color],24,9,cx,false);
 const warn=sprite(glowTexture(),C.RED_ALERT,14,10,cx);
 const pl=pool(C.LED_COLOR[color],cx);
 g.add(halo,warn,pl);
 let t=0;
 return {
  apply(s,dt){
   if(s.kind!=='led')return;
   t+=dt;
   const b=s.on?ledBright(s.brightness):0;
   mat.color.copy(dim).lerp(full,b);mat.emissive.copy(full);mat.emissiveIntensity=b>0.001?0.4+2.2*b:0;
   halo.material.opacity=b*0.7;halo.scale.setScalar(10+22*b);
   (pl.material as MeshBasicMaterial).opacity=0.45*b;
   warn.material.opacity=s.overCurrent?0.35+0.45*Math.sin(t*0.02):0;
  },
 };
}


export const led=definePart({kind:'led',name:c('LED','LED'),pins:{A:pin([0,0,0],'anode','Anode (+, long leg)','Anoda (+, kaki panjang)'),C:pin([PITCH,0,0],'cathode','Cathode (-, short leg)','Katoda (-, kaki pendek)')},callouts:[callout('anode',[0,3.4,0],'Long leg = plus','Kaki panjang = plus')],make:buildLed});
