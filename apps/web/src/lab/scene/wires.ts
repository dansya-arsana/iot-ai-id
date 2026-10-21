import {BoxGeometry,CatmullRomCurve3,Group,Mesh,TubeGeometry,Vector3} from 'three';
import type {Wire} from '../contract';
import {wireCurve} from './layout';
import {solid,toon} from './materials';
import * as C from './palette';

const END=7;
const dupont=new BoxGeometry(2.4,END,2.4);

/** Builds jumper wires. `end` resolves the part-side anchor (world mm) or null to skip. */
export function buildWires(wires:Wire[],unoAnchor:(w:Wire)=>Vector3,end:(w:Wire,railIndex:number)=>Vector3|null):Group{
 const g=new Group();g.name='wires';
 const rails:Record<string,number>={};
 for(const w of wires){
  const railKey=w.componentId==='bb'?w.pin:'';
  const idx=railKey?(rails[railKey]=(rails[railKey]??-1)+1):0;
  const b=end(w,idx);
  if(!b)continue;
  const a=unoAnchor(w);
  const color=C.WIRE_COLOR[w.color];
  for(const p of [a,b]){
   const blk=solid(dupont,C.DUPONT,{pos:[p.x,p.y+END/2,p.z],outline:0.2,cast:true});
   g.add(blk);
   const tip=solid(new BoxGeometry(2.46,1.4,2.46),color,{pos:[p.x,p.y+END-0.7,p.z],cast:false});
   g.add(tip);
  }
  const pts=wireCurve([a.x,a.y+END,a.z],[b.x,b.y+END,b.z]).map(p=>new Vector3(p[0],p[1],p[2]));
  const tube=new Mesh(new TubeGeometry(new CatmullRomCurve3(pts),64,0.55,8,false),toon(color));
  tube.castShadow=true;tube.userData.targetId=`wire:${w.componentId}.${w.pin}`;
  g.add(tube);
 }
 return g;
}
