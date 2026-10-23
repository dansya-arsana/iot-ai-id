/** SOLAR-PANEL: 36-cell (4 x 9) mono panel, aluminium frame, rear junction box, two leads. Mm from the retail spec class (20 W: 470 x 345 x 20). Own work. */
import {BoxGeometry,CatmullRomCurve3,Group,TubeGeometry,Vector3} from 'three';
import type {PartProps} from '../../contract';
import {panelSpec,type SolarPanelState} from '../../sim/devices/solar-panel';
import {solid} from '../materials';
import * as C from '../palette';
import {addShadow,definePart,extState,c,pin,callout,type Inner} from './kit';

const CELL=0x1a2a5a; // ds-allow-hex  dark blue mono cell
const WIRE_RED=0xd23b32; // ds-allow-hex
const WIRE_BLACK=0x15171a; // ds-allow-hex
const TILT=-0.22;

function lead(g:Group,from:Vector3,tip:Vector3,color:number):void{
 const curve=new CatmullRomCurve3([from,new Vector3(from.x,from.y-8,from.z-14),new Vector3(tip.x,tip.y+10,tip.z+20),tip]);
 g.add(solid(new TubeGeometry(curve,20,1.1,8),color,{outline:true}));
}
function buildPanel(p:PartProps,g:Group):Inner{
 const s=panelSpec(p),{l,w,h}=s.dims;
 const t=new Group();t.rotation.x=TILT;t.position.set(0,52,0);g.add(t);
 t.add(solid(new BoxGeometry(l,h,w),C.SILVER,{outline:true,pos:[0,0,0],finish:'metal'}));
 t.add(solid(new BoxGeometry(l-8,1.2,w-8),C.CHIP,{pos:[0,h/2+0.1,0],cast:false}));
 const cols=9,rows=4,cw=(l-14)/cols,rh=(w-14)/rows;
 for(let i=0;i<cols;i++)for(let j=0;j<rows;j++)t.add(solid(new BoxGeometry(cw-1.6,0.6,rh-1.6),CELL,{pos:[-(l-14)/2+cw*(i+0.5),h/2+0.9,-(w-14)/2+rh*(j+0.5)],cast:false}));
 // rear junction box with two leads
 t.add(solid(new BoxGeometry(34,8,22),C.HEADER_BLACK,{outline:true,pos:[l/2-40,-h/2-4,-w/2+50]}));
 // two rear legs under the high (z+) edge
 for(const sx of [-1,1])g.add(solid(new BoxGeometry(6,76,6),C.SILVER_DARK,{pos:[sx*l/3,38,w/2-26],cast:false,finish:'metal'}));
 const bx=l/2-48;
 lead(g,new Vector3(bx,16,-w/2+55),TIP_P,WIRE_RED);lead(g,new Vector3(bx+6,16,-w/2+55),TIP_M,WIRE_BLACK);
 addShadow(g,l+20,w+20,0.28,6,0,0.03,0);
 return {apply(st){const x=extState<SolarPanelState>(st,'solar-panel');if(!x)return;g.scale.setScalar(1);}};
}
const TIP_P=new Vector3(150,6,-250),TIP_M=new Vector3(172,6,-250);

export const solarPanel=definePart({
 kind:'solar-panel',name:c('Solar panel','Panel surya'),deskMm:[480,360],
 pins:{'PV+':pin([TIP_P.x,TIP_P.y,TIP_P.z],'power','Red lead (PV+)','Kabel merah (PV+)'),'PV-':pin([TIP_M.x,TIP_M.y,TIP_M.z],'ground','Black lead (PV-)','Kabel hitam (PV-)')},
 callouts:[
  callout('voc',[0,60,0],'Open-circuit voltage is about 22 V: the controller PV input must be rated above it','Tegangan terbuka sekitar 22 V: masukan PV pengontrol harus berrating di atasnya'),
  callout('jbox',[150,20,-120],'Rear junction box with the two leads (MC4 plugs on real panels)','Kotak sambungan belakang dengan dua kabel (di panel asli ada konektor MC4)'),
  callout('tilt',[-200,40,0],'Tilt about 10-15 degrees so rain washes it; at 6 degrees south face north','Miringkan sekitar 10-15 derajat agar hujan membersihkan; di 6 derajat LS hadapkan ke utara'),
 ],
 make:buildPanel,
});
