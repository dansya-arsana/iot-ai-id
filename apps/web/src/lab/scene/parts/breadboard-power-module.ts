/** BREADBOARD-POWER-MODULE: MB102 style board about 53 x 34 mm with barrel jack, USB port, slide switch, two regulators, two rail jumpers and a power LED. Pairs with sim/devices/breadboard-power-module.ts. */
import {BoxGeometry,CylinderGeometry,Group,Mesh,MeshBasicMaterial,PlaneGeometry} from 'three';
import type {PartProps} from '../../contract';
import type {BreadboardPowerModuleState} from '../../sim/devices/breadboard-power-module';
import {canvasTexture,ownToon,solid} from '../materials';
import * as C from '../palette';
import {HALF_PI,MONO,definePart,extState,c,pin,callout,type Inner} from './kit';

const GREEN_PCB=0x17613f; // ds-allow-hex  (module PCB)
const OFF_LED=0x1f3a2a; // ds-allow-hex  (unlit green LED)

function label(g:Group,text:string,w:number,h:number,x:number,y:number,z:number):void{
 const cv=document.createElement('canvas');cv.width=256;cv.height=Math.max(16,Math.round(256*h/w));
 const k=cv.getContext('2d')!;
 k.fillStyle='#f7f4ea';k.textAlign='center';k.textBaseline='middle';k.font=`600 ${Math.round(cv.height*0.7)}px ${MONO}`;k.fillText(text,128,cv.height/2);
 const m=new Mesh(new PlaneGeometry(w,h),new MeshBasicMaterial({map:canvasTexture(cv),transparent:true,toneMapped:false,depthWrite:false}));
 m.material.userData.own=true;m.material.userData.ownMap=true;m.position.set(x,y,z);m.rotation.x=-HALF_PI;m.userData.noPick=true;m.userData.noInk=true;g.add(m);
}

function buildMb(props:PartProps,g:Group):Inner{
 const w=53,d=34,y=2;
 g.add(solid(new BoxGeometry(w,1.6,d),GREEN_PCB,{outline:true,edges:true,pos:[0,y,0]}));
 // DC barrel jack on the left edge (5.5/2.1 mm) and a USB-B style port on the back edge
 g.add(solid(new BoxGeometry(14,10.5,9),C.HEADER_BLACK,{outline:true,pos:[-w/2+4,y+6.4,5]}));
 g.add(solid(new CylinderGeometry(2.7,2.7,10,18),C.CHIP,{rot:[0,0,HALF_PI],pos:[-w/2-2.5,y+6.4,5],cast:false}));
 g.add(solid(new BoxGeometry(12,10.8,11),C.SILVER,{outline:true,pos:[-w/2+9,y+6,-d/2+6],finish:'metal'}));
 g.add(solid(new BoxGeometry(7,5,0.4),C.HOLE,{pos:[-w/2+9,y+6,-d/2+0.6],cast:false}));
 // slide switch
 g.add(solid(new BoxGeometry(8,3.4,4.4),C.SILVER_DARK,{outline:true,pos:[-w/2+10,y+2.5,-4],finish:'metal'}));
 g.add(solid(new BoxGeometry(3,2.4,2.4),C.CREAM,{pos:[-w/2+10,y+5.2,-4],cast:false}));
 // jumper blocks, one per rail: the cap sits on the 5 V side or the 3.3 V side
 const caps:Group[]=[];
 for(const [i,sz] of [[0,-1],[1,1]] as const){
  g.add(solid(new BoxGeometry(8,2.4,2.6),C.HEADER_BLACK,{outline:true,pos:[w/2-14,y+2,sz*9]}));
  const cap=new Group();cap.position.set(w/2-14,y+4,sz*9);cap.add(solid(new BoxGeometry(5,3,2.6),C.CREAM_DARK,{outline:true}));caps[i]=cap;g.add(cap);
 }
 label(g,'3V3  5V',8,1.6,w/2-14,y+0.9,-12.6);label(g,'3V3  5V',8,1.6,w/2-14,y+0.9,12.6);
 // two SOT-223 regulators, two electrolytic capacitors
 for(const sz of [-1,1])g.add(solid(new BoxGeometry(6.5,1.7,3.5),C.CHIP,{pos:[w/2-30,y+2.6,sz*8],cast:false}));
 for(const sx of [-4,4])g.add(solid(new CylinderGeometry(3,3,7,18),0x1b2230,{outline:true,pos:[sx,y+4.3,3]})); // ds-allow-hex  (electrolytic sleeve)
 const ledMat=ownToon(OFF_LED);
 const led=new Mesh(new BoxGeometry(2.6,1.2,1.4),ledMat);led.position.set(-4,y+1.4,-11);g.add(led);
 // wire terminals along the front edge: VIN, GND, LEFT rail, RIGHT rail
 for(let i=0;i<4;i++)g.add(solid(new BoxGeometry(2.4,6,2.4),C.HEADER_BLACK,{pos:[-18+i*12,y+4.4,d/2-2],cast:false}));
 label(g,'VIN  GND  LEFT  RIGHT',34,2,0,y+0.9,d/2-6);
 void props;
 return {
  apply(s){
   const st=extState<BreadboardPowerModuleState>(s,'breadboard-power-module');
   if(!st)return;
   caps[0]!.position.x=w/2-14+(st.left===3.3?-1.5:1.5);caps[1]!.position.x=w/2-14+(st.right===3.3?-1.5:1.5);
   ledMat.color.setHex(st.live?C.LED_ON_GREEN:OFF_LED);ledMat.emissive.setHex(C.LED_ON_GREEN);ledMat.emissiveIntensity=st.live?2.2:0;
  },
 };
}

export const breadboardPowerModule=definePart({
 kind:'breadboard-power-module',name:c('MB102 power module (jack or USB)','Modul daya MB102 (jack atau USB)'),
 pins:{VIN:pin([-18,8,15],'power','VIN (jack, 6.5-12 V)','VIN (jack, 6,5-12 V)'),GND:pin([-6,8,15],'ground','Ground','Ground'),LEFT:pin([6,8,15],'output','Left rail','Jalur kiri'),RIGHT:pin([18,8,15],'output','Right rail','Jalur kanan')},
 callouts:[
  callout('jumper',[53/2-14,10,9],'Jumper: 5 V or 3.3 V for this rail','Jumper: 5 V atau 3,3 V untuk jalur ini'),
  callout('jack',[-26,12,5],'Barrel jack: 6.5-12 V in (or use USB)','Jack baterai: masuk 6,5-12 V (atau pakai USB)'),
 ],
 deskMm:[53,34],
 make:buildMb,
});
