import {BoxGeometry,CanvasTexture,Color,MeshToonMaterial,CylinderGeometry,Group,InstancedMesh,LinearFilter,Matrix4,Mesh,MeshBasicMaterial,PlaneGeometry,SRGBColorSpace,Vector3,type Object3D} from 'three';
import type {BoardFeatureId,BoardPin} from '../contract';
import {PWM_PINS} from '../contract';
import {UNO_W,UNO_D,PCB_T,HEADER_H,PITCH} from './layout';
import {solid,ownToon,toon,disposeObject} from './materials';
import * as C from './palette';

const HX=UNO_W/2,HZ=UNO_D/2;
const mil=(x:number)=>x*0.0254-HX;
const TOP_Z=-24.13,BOT_Z=24.13;

type PinPos={x:number;z:number};
/** Pin positions on the headers (x from mils, z by edge). */
function pinTable():Record<string,PinPos>{
 const t:Record<string,PinPos>={};
 for(let i=0;i<=7;i++)t['D'+i]={x:mil(2000-i*100),z:TOP_Z};
 for(let i=0;i<=5;i++)t['D'+(8+i)]={x:mil(1140-i*100),z:TOP_Z};
 const power:[string,number][]=[['NC',1000],['IOREF',1100],['RESET',1200],['3V3',1300],['5V',1400],['GND',1500],['GND2',1600],['VIN',1700]];
 for(const [n,x] of power)t[n]={x:mil(x),z:BOT_Z};
 for(let i=0;i<=5;i++)t['A'+i]={x:mil(1900+i*100),z:BOT_Z};
 t.GND3={x:mil(640-100),z:TOP_Z};t.AREF={x:mil(440),z:TOP_Z};t.SDA={x:mil(340),z:TOP_Z};t.SCL={x:mil(240),z:TOP_Z};
 return t;
}

export interface UnoBuild{
 group:Group;features:Record<BoardFeatureId,Object3D>;
 pinAnchor(pin:BoardPin):Vector3;
 setLeds(s:{l:number;tx:boolean;on:boolean}):void;
 dispose():void;
}

function silkscreen(pins:Record<string,PinPos>):{tex:CanvasTexture;redraw():void}{
 const S=16,w=Math.round(UNO_W*S),h=Math.round(UNO_D*S);
 const cv=document.createElement('canvas');cv.width=w;cv.height=h;
 const g=cv.getContext('2d')!;
 const px=(x:number)=>(x+HX)*S,pz=(z:number)=>(z+HZ)*S;
 const redraw=():void=>{
 g.clearRect(0,0,w,h);
 g.fillStyle=C.SILKSCREEN;g.strokeStyle=C.SILKSCREEN;g.textAlign='center';g.textBaseline='middle';
 const label=(txt:string,x:number,z:number,size=22)=>{g.font=`bold ${size}px "JetBrains Mono", ui-monospace, monospace`;g.fillText(txt,px(x),pz(z));};
 for(let i=0;i<=13;i++){const p=pins['D'+i]!;label((PWM_PINS as readonly string[]).includes('D'+i)?'~'+i:String(i),p.x,p.z+4.6,i>9?24:26);}
 label('AREF',pins.AREF!.x,TOP_Z+4.6,16);label('GND',pins.GND3!.x,TOP_Z+4.6,16);label('SDA',pins.SDA!.x,TOP_Z+4.6,16);label('SCL',pins.SCL!.x,TOP_Z+4.6,16);
 for(const n of ['IOREF','RESET','3V3','5V','VIN'])label(n,pins[n]!.x,BOT_Z-4.6,n.length>3?15:18);
 label('GND',pins.GND!.x,BOT_Z-4.6,16);label('GND',pins.GND2!.x,BOT_Z-4.6,16);
 for(let i=0;i<=5;i++)label('A'+i,pins['A'+i]!.x,BOT_Z-4.6,20);
 g.textAlign='left';g.font='bold 54px "Barlow Semi Condensed", system-ui, sans-serif';g.fillText('UNO R3',px(-14),pz(-5.5));
 g.font='bold 30px "JetBrains Mono", ui-monospace, monospace';g.fillText('ATmega328P',px(-5),pz(8.4));
 g.font='bold 18px "JetBrains Mono", ui-monospace, monospace';g.textAlign='center';
 g.fillText('DIGITAL (PWM~)',px(18),pz(-16.4));g.fillText('ANALOG IN',px(15.5),pz(15.8));
 g.font='bold 16px "JetBrains Mono", ui-monospace, monospace';
 g.fillText('ON',px(10),pz(13.6));g.fillText('L',px(1.2),pz(-11.5));g.fillText('TX',px(-4.4),pz(17.2));g.fillText('RX',px(-1.4),pz(17.2));
 };
 redraw();
 const tex=new CanvasTexture(cv);tex.colorSpace=SRGBColorSpace;tex.anisotropy=4;tex.minFilter=LinearFilter;tex.generateMipmaps=false;
 return {tex,redraw};
}

export function buildUno():UnoBuild{
 const group=new Group();group.name='uno';
 const pins=pinTable();
 // PCB
 const pcb=solid(new BoxGeometry(UNO_W,PCB_T,UNO_D),C.PCB,{outline:0.5,pos:[0,PCB_T/2,0]});
 group.add(pcb);
 const silk=silkscreen(pins);
 const sil=new Mesh(new PlaneGeometry(UNO_W,UNO_D),new MeshBasicMaterial({map:silk.tex,transparent:true,depthWrite:false}));
 let alive=true;
 if(typeof document!=='undefined'&&document.fonts)void Promise.all(['bold 20px "JetBrains Mono"','bold 20px "Barlow Semi Condensed"'].map(f=>document.fonts.load(f))).then(()=>{if(alive){silk.redraw();silk.tex.needsUpdate=true;}}).catch(()=>undefined);
 sil.material.userData.own=true;sil.material.userData.ownMap=true;sil.rotation.x=-Math.PI/2;sil.position.y=PCB_T+0.03;sil.userData.noPick=true;sil.renderOrder=1;
 group.add(sil);
 // mounting holes
 const hole=new CylinderGeometry(1.6,1.6,0.2,16),ring=new CylinderGeometry(2.7,2.7,0.15,20);
 for(const [x,z] of [[14,26.67-2.5],[15.3,26.67-50.7],[66.1,26.67-7.6],[66.1,26.67-35.5]] as [number,number][]){
  group.add(solid(ring,C.SILVER,{pos:[x-HX,PCB_T+0.05,z],cast:false}));
  group.add(solid(hole,C.HOLE,{pos:[x-HX,PCB_T+0.12,z],cast:false}));
 }
 const f:Record<string,Object3D>={};
 const feat=(id:BoardFeatureId):Group=>{const g=new Group();g.name=id;g.userData.targetId=id;group.add(g);f[id]=g;return g;};

 // headers
 const holeGeo=new BoxGeometry(1.25,0.2,1.25);
 const fillHeader=(g:Group,names:string[]):void=>{
  const xs=names.map(n=>pins[n]!.x),z=pins[names[0]!]!.z;
  const x0=Math.min(...xs),x1=Math.max(...xs);
  g.add(solid(new BoxGeometry(x1-x0+PITCH,HEADER_H,PITCH),C.HEADER_BLACK,{outline:0.4,pos:[(x0+x1)/2,PCB_T+HEADER_H/2,z]}));
  const holes=new InstancedMesh(holeGeo,toon(C.HOLE),names.length);
  const m=new Matrix4();
  names.forEach((n,i)=>{m.setPosition(pins[n]!.x,PCB_T+HEADER_H+0.08,z);holes.setMatrixAt(i,m);});
  holes.userData.noPick=true;g.add(holes);
 };
 const dig=feat('uno.digital-header');
 fillHeader(dig,['D0','D1','D2','D3','D4','D5','D6','D7']);
 fillHeader(dig,['D8','D9','D10','D11','D12','D13','GND3','AREF','SDA','SCL']);
 fillHeader(feat('uno.power-header'),['NC','IOREF','RESET','3V3','5V','GND','GND2','VIN']);
 fillHeader(feat('uno.analog-header'),['A0','A1','A2','A3','A4','A5']);

 // USB-B and DC jack
 const usb=feat('uno.usb');
 usb.add(solid(new BoxGeometry(16,11,12),C.SILVER,{outline:0.45,pos:[-HX-2+8,PCB_T+5.5,-11.4]}));
 usb.add(solid(new BoxGeometry(0.4,6,8),C.HOLE,{pos:[-HX-2.02,PCB_T+5.5,-11.4],cast:false}));
 const jack=feat('uno.power-jack');
 jack.add(solid(new BoxGeometry(14,11,9),C.HEADER_BLACK,{outline:0.45,pos:[-HX-2+7,PCB_T+5.5,19.2]}));
 jack.add(solid(new CylinderGeometry(2.7,2.7,0.4,16),C.HOLE,{rot:[0,0,Math.PI/2],pos:[-HX-2.1,PCB_T+5.5,19.2],cast:false}));
 // MCU DIP-28
 const mcu=feat('uno.mcu');
 mcu.add(solid(new BoxGeometry(35,4.4,7.4),C.CHIP,{outline:0.4,pos:[8,PCB_T+2.2+0.9,0.5]}));
 mcu.add(solid(new BoxGeometry(35.6,1.8,8.2),C.HEADER_BLACK,{pos:[8,PCB_T+0.9,0.5],cast:false}));
 mcu.add(solid(new CylinderGeometry(1.1,1.1,0.2,16),C.SILVER_DARK,{pos:[-8.5,PCB_T+4.7,0.5],cast:false}));
 const legGeo=new BoxGeometry(0.6,0.5,1.4);const legs=new InstancedMesh(legGeo,toon(C.SILVER),28);
 const lm=new Matrix4();
 for(let i=0;i<14;i++){for(const s of [-1,1]){lm.setPosition(8-16.5+i*2.54,PCB_T+1.4,0.5+s*4.2);legs.setMatrixAt(i*2+(s<0?0:1)+0,lm);}}
legs.userData.noPick=true;mcu.add(legs);
 // USB chip, crystal
 const chip=feat('uno.usb-chip');
 chip.add(solid(new BoxGeometry(6,1,6),C.CHIP,{outline:0.3,pos:[-20,PCB_T+0.5,-8]}));
 const xtal=feat('uno.crystal');
 const oval=new CylinderGeometry(1.9,1.9,10,20);oval.scale(1,1,1);
 xtal.add(solid(oval,C.SILVER,{outline:0.35,rot:[0,0,Math.PI/2],pos:[-14,PCB_T+1.9,6]}));
 // reset button
 const reset=feat('uno.reset');
 reset.add(solid(new BoxGeometry(6.2,3.2,6.2),C.SILVER_DARK,{outline:0.35,pos:[-12,PCB_T+1.6,-14]}));
 reset.add(solid(new CylinderGeometry(1.8,1.8,1.6,16),C.RED_ALERT,{pos:[-12,PCB_T+4,-14]}));
 // ICSP
 const icsp=feat('uno.icsp');
 icsp.add(solid(new BoxGeometry(2*PITCH+0.6,2.5,3*PITCH),C.HEADER_BLACK,{outline:0.35,pos:[27,PCB_T+1.25,6]}));
 const pinGeo=new BoxGeometry(0.64,6,0.64);
 for(let i=0;i<3;i++)for(let j=0;j<2;j++)icsp.add(solid(pinGeo,C.GOLD,{pos:[27+(j-0.5)*PITCH,PCB_T+3.5,6+(i-1)*PITCH],cast:false}));
 // status LEDs (SMD)
 const smd=new BoxGeometry(3,0.9,1.6);
 const mk=(on:number,off:number,x:number,z:number):Mesh=>{const m=new Mesh(smd,ownToon(off));void on;m.position.set(x,PCB_T+0.45,z);m.receiveShadow=true;group.add(m);return m;};
 const ledOn=mk(C.LED_ON_GREEN,C.LED_SMD_OFF,10,15),ledL=mk(C.LED_L_ORANGE,C.LED_SMD_OFF,1.2,-13),ledTx=mk(C.LED_TX_YELLOW,C.LED_SMD_OFF,-4.4,15),ledRx=mk(C.LED_TX_YELLOW,C.LED_SMD_OFF,-1.4,15);
 const fOn=feat('uno.led-on');fOn.add(ledOn);const fL=feat('uno.led-l');fL.add(ledL);const fTx=feat('uno.led-txrx');fTx.add(ledTx,ledRx);

 const anchors=new Map<string,Vector3>();
 for(const [n,p] of Object.entries(pins))anchors.set(n,new Vector3(p.x,PCB_T+HEADER_H,p.z));
 const tmpOn=new Color();
 const setLed=(m:Mesh,k:number,on:number,off:number):void=>{
  const mat=m.material as MeshToonMaterial;
  mat.color.setHex(off).lerp(tmpOn.setHex(on),k);mat.emissive.setHex(on).multiplyScalar(k*0.9);
 };
 
 return {
  group,features:f as Record<BoardFeatureId,Object3D>,
  pinAnchor(pin){const a=anchors.get(pin);return a?a.clone():new Vector3(0,PCB_T,0);},
  setLeds(s){
   setLed(ledOn,s.on?1:0,C.LED_ON_GREEN,C.LED_SMD_OFF);
   setLed(ledL,Math.max(0,Math.min(1,s.l)),C.LED_L_ORANGE,C.LED_SMD_OFF);
   setLed(ledTx,s.tx?1:0,C.LED_TX_YELLOW,C.LED_SMD_OFF);setLed(ledRx,0,C.LED_TX_YELLOW,C.LED_SMD_OFF);
  },
  dispose(){alive=false;disposeObject(group);},
 };
}
