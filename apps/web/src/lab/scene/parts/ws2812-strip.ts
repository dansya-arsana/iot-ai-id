/**
 * WS2812 LEDs: an 8 LED stick (51 x 10 mm, 5050 packages at 6.35 mm), a 16 LED ring (44.5 mm outside, 31.7 mm inside) and an 8x8
 * matrix (71 x 71 mm, 8.6 mm pitch) on a desk. One 3 wire pigtail with a plug carries VCC, DIN, GND. Proportions are typical of the
 * public board outlines; pixel numbering is row by row (matrix) and clockwise from 12 o'clock (ring). Pairs with sim/devices/ws2812-strip.ts.
 */
import {BoxGeometry,Color,CylinderGeometry,ExtrudeGeometry,Group,Mesh,MeshStandardMaterial,Shape,type Sprite} from 'three';
import type {PartProps} from '../../contract';
import type {Ws2812StripState,Ws2812Shape} from '../../sim/devices/ws2812-strip';
import {glowTexture,ownToon,solid} from '../materials';
import * as C from '../palette';
import {definePart,extState,sprite,c,pin,callout,type Inner} from './kit';

const PLUG_Z=44;
const SHAPES:Ws2812Shape[]=['strip','ring','matrix'];

/** LED centres (x,z) of each layout in chain order, plus the board edge z where the pigtail leaves. */
function layout(shape:Ws2812Shape):{pts:[number,number,number][];edge:number}{
 // each point is [x, z, rotation about y]
 if(shape==='strip')return {pts:Array.from({length:8},(_,i)=>[(i-3.5)*6.35,0,0] as [number,number,number]),edge:5};
 if(shape==='ring'){
  const r=19.05;
  return {pts:Array.from({length:16},(_,i)=>{const a=i/16*Math.PI*2;return [Math.sin(a)*r,-Math.cos(a)*r,-a] as [number,number,number];}),edge:22.25};
 }
 const P=8.6,pts:[number,number,number][]=[];
 for(let r=0;r<8;r++)for(let q=0;q<8;q++)pts.push([(q-3.5)*P,(r-3.5)*P,0]);
 return {pts,edge:35.5};
}

function board(shape:Ws2812Shape):Mesh{
 if(shape==='strip')return solid(new BoxGeometry(51,1.6,10),C.CHIP,{outline:true,edges:true,pos:[0,0.8,0]});
 if(shape==='matrix')return solid(new BoxGeometry(71,1.6,71),C.CHIP,{outline:true,edges:true,pos:[0,0.8,0]});
 const s=new Shape();s.absarc(0,0,22.25,0,Math.PI*2,false);
 const hole=new Shape();hole.absarc(0,0,15.85,0,Math.PI*2,true);s.holes.push(hole);
 const geo=new ExtrudeGeometry(s,{depth:1.6,bevelEnabled:false,curveSegments:48});
 geo.rotateX(-Math.PI/2);
 return solid(geo,C.CHIP,{outline:true,edges:true});
}

function buildWs(p:PartProps,g:Group):Inner{
 const mats:MeshStandardMaterial[]=[];
 const halos:Sprite[]=[];
 const groups=new Map<Ws2812Shape,{root:Group;n:number}>();
 for(const sh of SHAPES){
  const root=new Group();
  root.add(board(sh));
  const {pts,edge}=layout(sh);
  pts.forEach(pt=>{
   // white 5050 package, a round lens on top that carries the colour
   const led=new Group();led.position.set(pt[0],1.6,pt[1]);led.rotation.y=pt[2];
   led.add(solid(new BoxGeometry(5,1.4,5),C.CREAM,{outline:true,pos:[0,0.7,0],cast:false}));
   const m=ownToon(C.LED_DIM.white,'epoxy');
   const lens=new Mesh(new CylinderGeometry(1.9,1.9,0.5,20),m);lens.position.y=1.6;lens.userData.noInk=true;led.add(lens);
   const h=sprite(glowTexture(),C.WHITE,sh==='matrix'?10:12,2.2);h.position.set(0,2.4,0);led.add(h);
   root.add(led);
   mats.push(m);halos.push(h);
  });
  // pigtail: red, signal, black wires from the board edge to the plug
  for(const [k,x] of [[0,-3.8],[1,0],[2,3.8]] as const){
   const len=PLUG_Z-edge-2;
   root.add(solid(new BoxGeometry(0.9,0.9,len),[C.WIRE_COLOR.red,C.WIRE_COLOR.yellow,C.WIRE_COLOR.black][k],{pos:[x,0.8,edge+len/2],cast:false}));
  }
  g.add(root);groups.set(sh,{root,n:pts.length});
 }
 // JST style plug at the end of the pigtail; the three pin anchors sit on its face
 g.add(solid(new BoxGeometry(12,4.6,6),C.CREAM_DARK,{outline:true,pos:[0,2.3,PLUG_Z]}));
 for(const x of [-3.8,0,3.8])g.add(solid(new BoxGeometry(1.6,1.6,1),C.GOLD,{pos:[x,2.6,PLUG_Z+3.4],cast:false,finish:'gold'}));
 const offsets=new Map<Ws2812Shape,number>();let o=0;
 for(const sh of SHAPES){offsets.set(sh,o);o+=groups.get(sh)!.n;}
 const dim=new Color(C.LED_DIM.white);
 const first:Ws2812Shape=p.shape==='ring'||p.shape==='matrix'?p.shape:'strip';
 for(const sh of SHAPES)groups.get(sh)!.root.visible=sh===first;
 let lastKey='';
 const tmp=new Color();
 return {
  apply(s){
   const st=extState<Ws2812StripState>(s,'ws2812-strip');
   const shape:Ws2812Shape=st?.shape??first;
   for(const sh of SHAPES)groups.get(sh)!.root.visible=sh===shape;
   const leds=st?.leds??'';
   const key=shape+leds;
   if(key===lastKey)return;
   lastKey=key;
   const base=offsets.get(shape)!,n=groups.get(shape)!.n;
   for(let i=0;i<n;i++){
    const m=mats[base+i]!,h=halos[base+i]!;
    const hexv=leds.slice(i*6,i*6+6);
    const r=hexv?parseInt(hexv.slice(0,2),16)/255:0,gg=hexv?parseInt(hexv.slice(2,4),16)/255:0,b=hexv?parseInt(hexv.slice(4,6),16)/255:0;
    const mx=Math.max(r,gg,b);
    if(mx<0.004){m.color.copy(dim);m.emissive.setRGB(0,0,0);m.emissiveIntensity=0;h.material.opacity=0;continue;}
    // hue-preserving: normalise to the brightest channel, brightness carried by the emissive intensity
    tmp.setRGB(r/mx,gg/mx,b/mx);
    m.color.copy(tmp);m.emissive.copy(tmp);m.emissiveIntensity=0.5+2*Math.sqrt(mx);
    h.material.color.copy(tmp);h.material.opacity=0.75*Math.sqrt(mx);
   }
  },
 };
}

export const ws2812Strip=definePart({
 kind:'ws2812-strip',name:c('WS2812 LEDs (stick, ring, matrix)','LED WS2812 (stick, ring, matriks)'),
 pins:{VCC:pin([-3.8,2.6,PLUG_Z+3.4],'power','5V','5V'),DIN:pin([0,2.6,PLUG_Z+3.4],'input','Data in','Data masuk'),GND:pin([3.8,2.6,PLUG_Z+3.4],'ground','Ground','Ground')},
 callouts:[
  callout('leds',[0,9,0],'Each LED keeps 24 bits and passes the rest on','Tiap LED menyimpan 24 bit dan meneruskan sisanya'),
  callout('din',[0,9,PLUG_Z],'One data wire for every LED','Satu kabel data untuk semua LED'),
 ],
 deskMm:[72,96],
 make:buildWs,
});
