import {BoxGeometry,CylinderGeometry,Group,Mesh,MeshBasicMaterial,PlaneGeometry,TorusGeometry} from 'three';
import type {CanvasTexture} from 'three';
import type {PartProps} from '../../contract';
import {PITCH,obstacleMm} from '../layout';
import {canvasTexture,solid} from '../materials';
import * as C from '../palette';
import {HALF_PI,hex,MONO,leg,definePart,c,pin,callout,type Inner} from './kit';

function grilleTex():CanvasTexture{
 const cv=document.createElement('canvas');cv.width=cv.height=256;
 const g=cv.getContext('2d')!;
 g.fillStyle=hex(C.CHIP);g.fillRect(0,0,256,256);
 g.strokeStyle='#3a3d44';g.lineWidth=2;
 for(let r=14;r<128;r+=12){g.beginPath();g.arc(128,128,r,0,Math.PI*2);g.stroke();}
 g.fillStyle=hex(C.SILVER);g.beginPath();g.arc(128,128,10,0,Math.PI*2);g.fill();
 return canvasTexture(cv);
}
function sonarPrint():CanvasTexture{
 const cv=document.createElement('canvas');cv.width=512;cv.height=256;
 const g=cv.getContext('2d')!;
 g.fillStyle='#ffffff';g.textAlign='center';g.textBaseline='middle';
 g.font=`600 60px ${MONO}`;g.fillText('HC-SR04',256,80);
 g.font=`500 40px ${MONO}`;
 ['VCC','TRIG','ECHO','GND'].forEach((t,i)=>g.fillText(t,64+i*128,210));
 return canvasTexture(cv);
}
function buildSonar(_p:PartProps,g:Group):Inner{
 const cx=1.5*PITCH,py=14.5;
 for(let i=0;i<4;i++)g.add(leg(i*PITCH,4.6));
 g.add(solid(new BoxGeometry(45,20,1.6),C.SONAR_PCB,{outline:true,edges:true,pos:[cx,py,0]}));
 const grille=grilleTex();
 for(const sx of [-1,1]){
  g.add(solid(new CylinderGeometry(8,8,12,40),C.SILVER,{outline:true,rot:[HALF_PI,0,0],pos:[cx+sx*12,py,6.8],finish:'metal'}));
  const face=new Mesh(new PlaneGeometry(12.4,12.4),new MeshBasicMaterial({map:grille,toneMapped:false}));
  face.material.userData.own=true;face.position.set(cx+sx*12,py,12.82);face.userData.noPick=true;face.userData.noInk=true;g.add(face);
 }
 const print=new Mesh(new PlaneGeometry(16,8),new MeshBasicMaterial({map:sonarPrint(),transparent:true,toneMapped:false,depthWrite:false}));
 print.material.userData.own=true;print.material.userData.ownMap=true;print.position.set(cx,py-2.6,0.83);print.userData.noPick=true;print.userData.noInk=true;g.add(print);
 g.add(solid(new BoxGeometry(6,4,2),C.SILVER_DARK,{pos:[cx,py+6.5,1.6],cast:false,finish:'metal'}));
 const rings=[0,1,2].map(()=>{
  const m=new Mesh(new TorusGeometry(9,0.55,6,32,Math.PI*1.1),new MeshBasicMaterial({color:C.LIVE,transparent:true,opacity:0,depthWrite:false}));
  m.material.userData.own=true;m.position.set(cx,py,13);m.rotation.z=Math.PI*0.45;m.userData.noPick=true;m.userData.noInk=true;m.visible=false;g.add(m);return m;
 });
 let t=0;
 return {
  apply(s,dt){
   if(s.kind!=='hcsr04')return;
   t+=dt;
   const reach=obstacleMm(s.echoCm??120);
   rings.forEach((r,i)=>{
    r.visible=s.pinging;
    if(!s.pinging)return;
    const ph=(t/900+i/3)%1;
    r.position.z=13+ph*reach;r.scale.setScalar(1+ph*1.1);r.material.opacity=0.85*(1-ph);
   });
  },
 };
}

export const hcsr04=definePart({kind:'hcsr04',name:c('HC-SR04 sensor','Sensor HC-SR04'),pins:{VCC:pin([0,0,0],'power','5V','5V'),TRIG:pin([PITCH,0,0],'input','Trigger','Pemicu'),ECHO:pin([2*PITCH,0,0],'output','Echo','Gema'),GND:pin([3*PITCH,0,0],'ground','Ground','Ground')},callouts:[callout('eyes',[1.5*PITCH,26,8],'Two eyes: one speaks, one listens','Dua mata: satu bicara, satu mendengar')],make:buildSonar});
