/** RC522 RFID reader: the common blue 60 x 39 mm MFRC522 module, 8-pin header on the short edge, printed antenna coil. Pairs with sim/devices/rc522-rfid.ts. Guide: docs/lab-extending.md */
import {BoxGeometry,CylinderGeometry,Group,Mesh,MeshBasicMaterial,PlaneGeometry,RingGeometry} from 'three';
import type {PartProps} from '../../contract';
import type {Rc522RfidState} from '../../sim/devices/rc522-rfid';
import {canvasTexture,glowTexture,solid} from '../materials';
import * as C from '../palette';
import {HALF_PI,MONO,definePart,extState,c,pin,callout,type Inner} from './kit';

const L=60,W=39,BY=1.4,TH=1.2,TOP=BY+TH,P=2.54;          // board length, width, underside y, thickness, top y, pitch
const BOARD=0x1c62bd; // ds-allow-hex  (blue solder mask of the module)
const HX=-27.2;                                             // header column (short edge, x)
const pz=(i:number):number=>(3.5-i)*P;                      // pin i along z, SDA at the front
const PINS=['SDA','SCK','MOSI','MISO','IRQ','GND','RST','3V3'];
const TIP=TOP+8;

/** Silkscreen and the printed antenna coil in one texture (16 px per mm). */
function boardTex():ReturnType<typeof canvasTexture>{
 const S=16,cv=document.createElement('canvas');cv.width=L*S;cv.height=W*S;
 const g=cv.getContext('2d')!;
 const X=(x:number):number=>(x+L/2)*S,Z=(z:number):number=>(z+W/2)*S;
 // antenna: four turns of a rectangular spiral, 0.6 mm trace
 g.strokeStyle='#d9b75f';g.lineWidth=0.7*S;g.lineJoin='round'; // ds-allow-hex  (gold-finish copper trace)
 for(let k=0;k<4;k++){const m=k*1.7;g.strokeRect(X(-14+m),Z(-15.6+m),(43-2*m)*S,(31.2-2*m)*S);}
 // silkscreen
 g.fillStyle=C.SILKSCREEN;g.textBaseline='middle';
 g.font=`700 ${Math.round(2.6*S)}px ${MONO}`;g.textAlign='left';g.fillText('RC522',X(-22.5),Z(-14.2));
 g.font=`600 ${Math.round(1.25*S)}px ${MONO}`;
 for(let i=0;i<8;i++){g.save();g.translate(X(HX+3.0),Z(pz(i)));g.textAlign='left';g.fillText(PINS[i]!,0,0);g.restore();}
 g.font=`600 ${Math.round(1.1*S)}px ${MONO}`;g.fillText('13.56 MHz',X(-22.5),Z(-11.4));
 return canvasTexture(cv);
}

function flat(w:number,h:number,tex:ReturnType<typeof canvasTexture>,x:number,y:number,z:number):Mesh{
 const m=new Mesh(new PlaneGeometry(w,h),new MeshBasicMaterial({map:tex,transparent:true,toneMapped:false,depthWrite:false}));
 m.material.userData.own=true;m.material.userData.ownMap=true;
 m.rotation.x=-HALF_PI;m.position.set(x,y,z);m.userData.noPick=true;m.userData.noInk=true;return m;
}

function buildRc522(_p:PartProps,g:Group):Inner{
 g.add(solid(new BoxGeometry(L,TH,W),BOARD,{outline:true,edges:true,pos:[0,BY+TH/2,0],own:true,finish:'pcb'}));
 g.add(flat(L,W,boardTex(),0,TOP+0.03,0));
 // solder stand-offs under the board so it sits a little above the desk
 for(const [x,z] of [[-28,-17.5],[-28,17.5],[28,-17.5],[28,17.5]] as const)g.add(solid(new CylinderGeometry(1.2,1.2,BY,12),C.SILVER_DARK,{pos:[x,BY/2,z],cast:false,finish:'metal'}));
 // 8-pin header
 g.add(solid(new BoxGeometry(2.54,2.5,8*P),C.HEADER_BLACK,{outline:true,pos:[HX,TOP+1.25,0]}));
 for(let i=0;i<8;i++)g.add(solid(new BoxGeometry(0.64,TIP-TOP-1.0,0.64),C.GOLD,{pos:[HX,(TIP+TOP+1.0)/2,pz(i)],cast:false,finish:'metal'}));
 // MFRC522 (QFN32 5 x 5 x 0.85 mm), 27.12 MHz crystal, a few 0603 parts
 g.add(solid(new BoxGeometry(5,0.85,5),C.CHIP,{outline:true,edges:true,pos:[-17.8,TOP+0.43,0],own:true}));
 g.add(solid(new CylinderGeometry(0.3,0.3,0.05,10),C.SILVER,{pos:[-19.5,TOP+0.87,-1.8],cast:false}));
 g.add(solid(new BoxGeometry(3.2,0.8,2.5),C.SILVER,{outline:true,pos:[-17.8,TOP+0.4,-6.8],finish:'metal'}));
 for(const [x,z] of [[-23,-17.2],[-20.5,-17.2],[-23,17.2],[-20.5,17.2],[-14,17.2],[-11.5,17.2]] as const)g.add(solid(new BoxGeometry(1.6,0.5,0.8),C.CREAM_DARK,{pos:[x,TOP+0.25,z],cast:false}));
 // field indicator: a soft glow over the coil while the antenna is switched on
 const field=new Mesh(new PlaneGeometry(50,38),new MeshBasicMaterial({map:glowTexture(),color:C.LIVE,transparent:true,opacity:0,depthWrite:false,toneMapped:false}));
 field.material.userData.own=true;field.rotation.x=-HALF_PI;field.position.set(7.5,TOP+0.1,0);field.userData.noPick=true;field.userData.noInk=true;g.add(field);

 // the cards, held 12 mm above the coil
 const hold=new Group();hold.position.set(7.5,TOP+17,0);g.add(hold);
 // a held card is drawn as a see-through slab with ink edges, so the coil and chip stay visible under it
 const mk=(geo:BoxGeometry|CylinderGeometry,color:number,y:number):Mesh=>{
  const m=solid(geo,color,{edges:true,pos:[0,y,0],own:true});
  const mat=new MeshBasicMaterial({color,transparent:true,opacity:0.3,depthWrite:false,toneMapped:false});mat.userData.own=true;
  m.material=mat;m.castShadow=false;return m;
 };
 const card1=new Group();
 card1.add(mk(new BoxGeometry(85.6,0.8,54),C.CREAM,0.4));
 card1.add(mk(new BoxGeometry(85.6,0.2,10),C.BUTTON_CAP,0.85));
 const fobGeo=new CylinderGeometry(15,15,5,32);fobGeo.scale(1,1,1.32);
 const card2=new Group();
 card2.add(mk(fobGeo,C.BUTTON_CAP,2.5));
 card2.add(solid(new CylinderGeometry(3.2,3.2,0.2,16),C.HOLE,{pos:[0,5.1,-14.5],cast:false}));   // key-ring hole
 const card3=new Group();
 card3.add(mk(new CylinderGeometry(12.5,12.5,0.5,40),C.WHITE,0.25));
 for(const r of [10,8,6,4]){
  const ring=new Mesh(new RingGeometry(r-0.3,r,40),new MeshBasicMaterial({color:C.SILVER_DARK,toneMapped:false}));
  ring.material.userData.own=true;ring.rotation.x=-HALF_PI;ring.position.y=0.53;ring.userData.noPick=true;ring.userData.noInk=true;card3.add(ring);
 }
 const cards:Record<string,Group>={card1,card2,card3};
 for(const k of Object.keys(cards)){cards[k]!.visible=false;hold.add(cards[k]!);}
 // card halo: amber while the card is awake, green once the reader selected it
 const halo=new Mesh(new PlaneGeometry(40,40),new MeshBasicMaterial({map:glowTexture(),color:C.LIVE,transparent:true,opacity:0,depthWrite:false,toneMapped:false}));
 halo.material.userData.own=true;halo.rotation.x=-HALF_PI;halo.position.set(0,-0.6,0);halo.userData.noPick=true;halo.userData.noInk=true;hold.add(halo);
 return {
  apply(s){
   const st=extState<Rc522RfidState>(s,'rc522-rfid');
   if(!st)return;
   for(const [k,v] of Object.entries(cards))v.visible=st.card===k;
   (field.material as MeshBasicMaterial).opacity=st.antenna&&st.powered?0.32:0;
   const hm=halo.material as MeshBasicMaterial;
   hm.color.set(st.cardState==='active'?C.LIVE:C.PWM);
   hm.opacity=st.card==='none'||st.cardState==='idle'?0:st.cardState==='halt'?0.12:0.4;
  },
 };
}

export const rc522Rfid=definePart({
 kind:'rc522-rfid',name:c('RC522 RFID reader','Pembaca RFID RC522'),deskMm:[60,39],
 pins:{
  SDA:pin([HX,TIP,pz(0)],'input','SDA: SPI chip select (SS)','SDA: chip select SPI (SS)'),
  SCK:pin([HX,TIP,pz(1)],'input','SCK (SPI clock, D13)','SCK (clock SPI, D13)'),
  MOSI:pin([HX,TIP,pz(2)],'input','MOSI (data in, D11)','MOSI (data masuk, D11)'),
  MISO:pin([HX,TIP,pz(3)],'output','MISO (data out, D12)','MISO (data keluar, D12)'),
  IRQ:pin([HX,TIP,pz(4)],'output','IRQ (interrupt, optional)','IRQ (interupsi, opsional)'),
  GND:pin([HX,TIP,pz(5)],'ground','Ground','Ground'),
  RST:pin([HX,TIP,pz(6)],'input','RST (reset, optional)','RST (reset, opsional)'),
  '3V3':pin([HX,TIP,pz(7)],'power','3.3 V only: 5 V damages the chip','Hanya 3,3 V: 5 V merusak chip'),
 },
 callouts:[
  callout('chip',[-17.8,TOP+3,0],'The MFRC522 chip generates the 13.56 MHz field and speaks the card protocol','Chip MFRC522 membuat medan 13,56 MHz dan bicara protokol kartu'),
  callout('coil',[8,TOP+1.5,0],'The printed coil is the antenna: hold the card flat over it','Kumparan tercetak ini antenanya: tahan kartu rata di atasnya'),
  callout('sda',[HX,TIP+1,pz(0)],'SDA here is the SPI chip select, not I2C','SDA di sini adalah chip select SPI, bukan I2C'),
  callout('v33',[HX,TIP+1,pz(7)],'Power it from 3.3 V: the chip is not 5 V tolerant','Beri daya dari 3,3 V: chip tidak tahan 5 V'),
 ],
 make:buildRc522,
});
