/** LASER-KY008: a 650 nm red laser dongle. A small board on a 3 pin header, a brass barrel with the diode inside and a thin red beam when lit. Pairs with sim/devices/laser-ky008.ts. */
import {BoxGeometry,CylinderGeometry,Group,Mesh,MeshBasicMaterial} from 'three';
import type {PartProps} from '../../contract';
import type {LaserKy008State} from '../../sim/devices/laser-ky008';
import {PITCH} from '../layout';
import {glowTexture,ownToon,solid} from '../materials';
import * as C from '../palette';
import {HALF_PI,leg,definePart,extState,sprite,c,pin,callout,type Inner} from './kit';

const BEAM_MM=90;

function buildLaser(_p:PartProps,g:Group):Inner{
 const cx=PITCH;
 for(let i=0;i<3;i++)g.add(leg(i*PITCH,3));
 // 10 x 14 mm board lying on the header, the barrel pointing away from the viewer
 g.add(solid(new BoxGeometry(10,1.2,14),C.PCB,{outline:true,edges:true,pos:[cx,3.6,-5]}));
 // current limit resistor and the diode legs
 g.add(solid(new BoxGeometry(3.2,1,1.6),C.RESISTOR_BODY,{pos:[cx,4.7,-1.2],cast:false}));
 // brass barrel (6 mm across, 10 mm long) with a dark lens ring at the front
 g.add(solid(new CylinderGeometry(3,3,10,24),C.GOLD,{outline:true,rot:[HALF_PI,0,0],pos:[cx,7.6,-9],finish:'gold'}));
 g.add(solid(new CylinderGeometry(3.2,3.2,1.2,24),C.SILVER_DARK,{rot:[HALF_PI,0,0],pos:[cx,7.6,-3.4],cast:false,finish:'metal'}));
 const lensMat=ownToon(C.HEADER_BLACK,'epoxy');
 const lens=new Mesh(new CylinderGeometry(1.6,1.6,0.4,18),lensMat);lens.rotation.x=HALF_PI;lens.position.set(cx,7.6,-14.1);lens.userData.noInk=true;g.add(lens);
 // the beam: a thin additive cylinder, brighter with duty
 const beamMat=new MeshBasicMaterial({color:0xff2a1c,transparent:true,opacity:0,depthWrite:false,toneMapped:false}); // ds-allow-hex  650 nm red beam
 beamMat.userData.own=true;
 const beam=new Mesh(new CylinderGeometry(0.28,0.28,BEAM_MM,8),beamMat);
 beam.rotation.x=HALF_PI;beam.position.set(cx,7.6,-14.3-BEAM_MM/2);beam.userData.noPick=true;beam.userData.noInk=true;beam.visible=false;g.add(beam);
 const halo=sprite(glowTexture(),0xff3b2e,9,7.6,cx); // ds-allow-hex  laser glow
 halo.position.z=-14.6;g.add(halo);
 return {
  apply(s){
   const st=extState<LaserKy008State>(s,'laser-ky008');
   if(!st)return;
   beam.visible=st.on;beamMat.opacity=0.25+0.7*st.duty;
   halo.material.opacity=st.on?0.4+0.5*st.duty:0;
   lensMat.emissive.setRGB(st.on?1:0,0,0);lensMat.emissiveIntensity=st.on?2*st.duty:0;
  },
 };
}

export const laserKy008=definePart({
 kind:'laser-ky008',name:c('Laser diode dongle (KY-008)','Dongle dioda laser (KY-008)'),
 pins:{SIG:pin([0,0,0],'input','S (signal)','S (sinyal)'),VCC:pin([PITCH,0,0],'power','5V','5V'),GND:pin([2*PITCH,0,0],'ground','Minus','Minus')},
 callouts:[callout('barrel',[PITCH,12,-9],'HIGH on S lights the diode','HIGH di S menyalakan dioda'),callout('beam',[PITCH,9,-40],'Never aim a real laser at eyes','Jangan arahkan laser asli ke mata')],
 make:buildLaser,
});
