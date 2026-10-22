/** IR-LED: 5 mm 940 nm emitter, water-clear dome 5.8 mm head / 8.7 mm tall, flat on one side, two legs. Pairs with sim/devices/ir-led.ts. */
import {Color,Group,Mesh} from 'three';
import type {PartProps} from '../../contract';
import type {IrLedState} from '../../sim/devices/ir-led';
import {PITCH} from '../layout';
import {addOutline,glowTexture,ownToon} from '../materials';
import {domeGeo,leg,sprite,definePart,extState,c,pin,callout,type Inner} from './kit';

const IR_DOME=0x4b4658; // ds-allow-hex  (smoky-violet clear epoxy of an IR emitter)
const IR_GLOW=0xd36bff; // ds-allow-hex  (how a phone camera shows 940 nm light, not visible to the eye)

function buildIrLed(_p:PartProps,g:Group):Inner{
 const cx=PITCH/2;
 const mat=ownToon(IR_DOME,'epoxy');
 const dome=new Mesh(domeGeo(),mat);dome.position.x=cx;dome.castShadow=true;
 g.add(dome);addOutline(dome);
 g.add(leg(0,3.2),leg(PITCH,2.6));
 const halo=sprite(glowTexture(),IR_GLOW,24,9,cx,false);
 g.add(halo);
 const idle=new Color(IR_DOME),hot=new Color(IR_GLOW);
 return {
  apply(s){
   const st=extState<IrLedState>(s,'ir-led');
   if(!st)return;
   // invisible light: only a faint violet "camera view" glow, scaled by emitted intensity
   const b=Math.min(1,Math.sqrt(st.emitMwSr/30));
   mat.color.copy(idle).lerp(hot,b*0.35);
   halo.material.opacity=b*0.45;halo.scale.setScalar(8+14*b);
  },
 };
}

export const irLed=definePart({
 kind:'ir-led',name:c('IR LED (940 nm)','LED inframerah (940 nm)'),
 pins:{A:pin([0,0,0],'anode','Anode (+, long leg)','Anoda (+, kaki panjang)'),C:pin([PITCH,0,0],'cathode','Cathode (-, short leg)','Katoda (-, kaki pendek)')},
 callouts:[callout('dome',[PITCH/2,12,0],'Invisible light: a phone camera shows it as a faint violet glow','Cahaya tak tampak: kamera ponsel menampilkannya sebagai cahaya ungu samar')],
 make:buildIrLed,
});
