/**
 * Shared 3D body of the Raspberry Pi 4 Model B and Pi 5 (parts/rpi-4b.ts, parts/rpi-5.ts). Our own simplified model, no logo:
 * 85 x 56 mm board, 4 x M2.5 holes on a 58 x 49 mm rectangle 3.5 mm in from the header-side corner, 2x20 header at 2.54 mm pitch.
 * Connector positions are approximate [U]: read them off the official mechanical drawing before trusting them.
 * Axes: x along the long edge (header runs along it), z toward the viewer; the header is on the z- edge, pin 1 at the -x end.
 * A helper lives here, not in parts/, because every file in parts/ is auto-discovered as a part.
 */
import {BoxGeometry,CylinderGeometry,Group,Mesh,MeshBasicMaterial,PlaneGeometry} from 'three';
import {canvasTexture,solid} from './materials';
import * as C from './palette';
import {HALF_PI,MONO} from './parts/kit';

export const PI_PCB_GREEN=0x1f7a3d; // ds-allow-hex Pi green PCB
export const PI_L=85,PI_W=56,PI_BY=3,PI_TH=1.4,PI_P=2.54;
export const PI_TOP=PI_BY+PI_TH;
export const PI_HDR_H=8.5;                                   // header height above the board
const HX0=-10-24.13;                                         // x of pin 1 (header centred 32.5 mm from the left edge)
const HZ=-PI_W/2+3.5;                                        // header centre line, 3.5 mm from the edge
export const piPin=(phys:number):[number,number,number]=>[HX0+Math.floor((phys-1)/2)*PI_P,PI_TOP+PI_HDR_H,HZ+(phys%2===1?1.27:-1.27)];

function silk(model:string):Mesh{
 const S=24,cv=document.createElement('canvas');cv.width=PI_L*S;cv.height=PI_W*S;
 const g=cv.getContext('2d')!;
 g.fillStyle=C.SILKSCREEN;g.textBaseline='middle';g.textAlign='left';
 const X=(x:number):number=>(x+PI_L/2)*S,Z=(z:number):number=>(z+PI_W/2)*S;
 g.font=`700 ${Math.round(1.6*S)}px ${MONO}`;
 g.fillText('1',X(HX0-1.2),Z(HZ+1.27+2.2));g.fillText('2',X(HX0-1.2),Z(HZ-1.27-2.2));
 g.fillText('39',X(HX0+19*PI_P-1.4),Z(HZ+1.27+2.2));g.fillText('40',X(HX0+19*PI_P-1.4),Z(HZ-1.27-2.2));
 g.font=`600 ${Math.round(2.2*S)}px ${MONO}`;g.fillText(model,X(-10),Z(6));
 g.strokeStyle=C.SILKSCREEN;g.lineWidth=3;g.strokeRect(X(HX0-1.9),Z(HZ-3.4),(19*PI_P+3.8)*S,6.8*S);
 const m=new Mesh(new PlaneGeometry(PI_L,PI_W),new MeshBasicMaterial({map:canvasTexture(cv),transparent:true,toneMapped:false,depthWrite:false}));
 m.material.userData.own=true;m.material.userData.ownMap=true;
 m.rotation.x=-HALF_PI;m.position.set(0,PI_TOP+0.02,0);m.userData.noPick=true;m.userData.noInk=true;return m;
}

export interface PiOpts{model:'4'|'5'}
/** x of the SoC, so a callout can point at it */
export const PI_SOC_X=-8;
export function buildPi(g:Group,o:PiOpts):void{
 const p5=o.model==='5';
 g.add(solid(new BoxGeometry(PI_L,PI_TH,PI_W),PI_PCB_GREEN,{outline:true,edges:true,pos:[0,PI_BY+PI_TH/2,0],cast:true,finish:'pcb'}));
 // mounting holes
 for(const x of [-42.5+3.5,-42.5+61.5])for(const z of [HZ,HZ+49])
  g.add(solid(new CylinderGeometry(1.35,1.35,PI_TH+0.1,16),C.HOLE,{pos:[x,PI_BY+PI_TH/2,z],cast:false}));
 g.add(silk(p5?'Raspberry Pi 5':'Raspberry Pi 4B'));
 // 2x20 header, black body, gold pins; pin 1 square pad marker is the silk "1"
 g.add(solid(new BoxGeometry(20*PI_P,2.5,2*PI_P),C.HEADER_BLACK,{pos:[HX0+9.5*PI_P,PI_TOP+1.25,HZ],cast:false}));
 for(let i=0;i<40;i++){
  const [x,,z]=piPin(i+1);
  g.add(solid(new BoxGeometry(0.64,PI_HDR_H-2.5+0.5,0.64),C.GOLD,{pos:[x,PI_TOP+2.5+(PI_HDR_H-2.5)/2-0.25,z],cast:false,finish:'metal'}));
 }
 // SoC with a metal lid
 g.add(solid(new BoxGeometry(p5?15:14,1.1,p5?15:14),C.SILVER,{outline:true,edges:true,pos:[PI_SOC_X,PI_TOP+0.55,3],finish:'metal'}));
 // RAM, PMIC, USB hub / RP1
 g.add(solid(new BoxGeometry(11,1,8),C.CHIP,{pos:[-24,PI_TOP+0.5,3],cast:false}));
 g.add(solid(new BoxGeometry(p5?9:7,1,p5?9:7),C.CHIP,{pos:[p5?26:20,PI_TOP+0.5,-3],cast:false}));
 // microSD slot under the board, on the -x end
 g.add(solid(new BoxGeometry(12,1.4,11.5),C.SILVER_DARK,{pos:[-PI_L/2+6.5,PI_BY-0.7,3],cast:false,finish:'metal'}));
 // long edge (z+): USB-C, 2 micro-HDMI, and the 3.5 mm AV jack (Pi 4 only)
 const ez=PI_W/2;
 g.add(solid(new BoxGeometry(9,3.3,7.5),C.SILVER,{outline:true,pos:[-31.3,PI_TOP+1.65,ez-3.2],finish:'metal'}));
 for(const x of p5?[-17,-4]:[-16.5,-3])g.add(solid(new BoxGeometry(6.6,3.2,7),C.SILVER,{outline:true,pos:[x,PI_TOP+1.6,ez-3.2],finish:'metal'}));
 if(!p5){g.add(solid(new BoxGeometry(7,6,12),C.CHIP,{outline:true,pos:[11,PI_TOP+3,ez-5.5]}));}
 // short edge (+x): Ethernet and two USB stacks. Positions differ between Pi 4 and Pi 5 [U].
 const ex=PI_L/2-8,ethZ=p5?-17:17,usbZ=p5?[0,17]:[-17,0];
 g.add(solid(new BoxGeometry(21,13.5,16),C.SILVER,{outline:true,edges:true,pos:[ex-2.5,PI_TOP+6.75,ethZ],finish:'metal'}));
 usbZ.forEach((z,i)=>{
  g.add(solid(new BoxGeometry(17,15.3,13.2),C.SILVER,{outline:true,edges:true,pos:[PI_L/2-8.5,PI_TOP+7.65,z],finish:'metal'}));
  g.add(solid(new BoxGeometry(1,2.4,10),i===0?C.POT_BLUE:C.CHIP,{pos:[PI_L/2+0.05,PI_TOP+11,z],cast:false}));   // USB3 blue tongue, USB2 black
  g.add(solid(new BoxGeometry(1,2.4,10),i===0?C.POT_BLUE:C.CHIP,{pos:[PI_L/2+0.05,PI_TOP+4,z],cast:false}));
 });
 // CSI and DSI FFC slots
 for(const [x,z] of [[18,-ez+4.5],[3,ez-4.2]] as const)g.add(solid(new BoxGeometry(2.2,1.6,p5?11:12),C.CREAM_DARK,{pos:[x,PI_TOP+0.8,z],cast:false}));
 if(p5){
  g.add(solid(new BoxGeometry(2.2,1.6,11),C.CREAM_DARK,{pos:[30,PI_TOP+0.8,-12],cast:false}));          // PCIe FFC
  g.add(solid(new CylinderGeometry(1.7,1.7,1.6,14),C.CHIP,{pos:[-30,PI_TOP+0.8,-16],cast:false}));        // power button
  g.add(solid(new BoxGeometry(5.6,2.6,3),C.HEADER_BLACK,{pos:[2,PI_TOP+1.3,-20],cast:false}));            // fan header
 }
 g.add(solid(new BoxGeometry(1.8,0.7,1),C.RED_ALERT,{pos:[-34,PI_TOP+0.35,ez-6.2],cast:false}));          // PWR LED
 g.add(solid(new BoxGeometry(1.8,0.7,1),C.LED_ON_GREEN,{pos:[-34,PI_TOP+0.35,ez-8],cast:false}));         // ACT LED
}
