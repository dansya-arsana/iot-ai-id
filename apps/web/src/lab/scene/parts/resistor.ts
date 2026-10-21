import {CapsuleGeometry,Group,Mesh} from 'three';
import type {CanvasTexture} from 'three';
import type {PartProps} from '../../contract';
import {PITCH,resistorBands} from '../layout';
import {addOutline,canvasTexture,ownToon} from '../materials';
import * as C from '../palette';
import {noop,HALF_PI,hex,leg,num,definePart,c,pin,callout,type Inner} from './kit';

function bandTexture(bands:number[]):CanvasTexture{
 const cv=document.createElement('canvas');cv.width=32;cv.height=256;
 const g=cv.getContext('2d')!;
 g.fillStyle=hex(C.RESISTOR_BODY);g.fillRect(0,0,32,256);
 const at=[0.28,0.4,0.52,0.74];
 bands.forEach((b,i)=>{g.fillStyle=hex(C.BAND[b]!);g.fillRect(0,at[i]!*256-9,32,18);});
 return canvasTexture(cv);
}
function buildResistor(props:PartProps,g:Group):Inner{
 const ohms=num(props.ohms,220);
 const bands=resistorBands(ohms);
 const span=3*PITCH,cx=span/2,y=4.3;
 g.add(leg(0,y),leg(span,y));
 const mat=ownToon(C.RESISTOR_BODY);mat.map=bandTexture(bands);mat.userData.ownMap=true;
 const body=new Mesh(new CapsuleGeometry(2.3,span-1.2,8,28),mat);
 body.rotation.z=HALF_PI;body.position.set(cx,y,0);body.castShadow=true;body.receiveShadow=true;
 g.add(body);addOutline(body);
 return {apply:noop};
}

export const resistor=definePart({kind:'resistor',name:c('Resistor','Resistor'),pins:{'1':pin([0,0,0],'passive'),'2':pin([3*PITCH,0,0],'passive')},callouts:[callout('bands',[3*PITCH/2,7,0],'Colour bands tell the ohms','Pita warna menunjukkan ohm')],make:buildResistor});
