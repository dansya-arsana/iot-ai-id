/**
 * Procedural three.js model of an electronic package from dimensions: a body box plus pins. No files, no vendor models.
 * Units are mm, z up (same as node-assembly). Pure geometry; the caller owns disposal (disposeObject).
 */
import {BoxGeometry,Group,Mesh,MeshStandardMaterial} from 'three';
export type PackagePins={style:'dual'|'quad'|'sip'|'none';count:number;pitchMm:number};
export type PackageSpec={sizeMm:{w:number;h:number;d:number};pins?:PackagePins};
const BODY=0x1b1b1f,PIN=0xc9c9cf;
const clamp=(n:number,lo:number,hi:number)=>Math.min(hi,Math.max(lo,Number.isFinite(n)?n:lo));
/** Pin centre positions [x,y] around a body of w x h for the pin style. Pure, testable without WebGL. */
export function pinPositions(w:number,h:number,pins:PackagePins):[number,number][]{
 const n=clamp(Math.round(pins.count),0,200),p=clamp(pins.pitchMm,0.2,5.08),out:[number,number][]=[];
 if(pins.style==='none'||!n)return out;
 const row=(k:number,y:number)=>{for(let i=0;i<k;i++)out.push([(i-(k-1)/2)*p,y]);};
 const col=(k:number,x:number)=>{for(let i=0;i<k;i++)out.push([x,(i-(k-1)/2)*p]);};
 if(pins.style==='sip')row(n,0);
 else if(pins.style==='dual'){const a=Math.ceil(n/2);row(a,h/2);row(n-a,-h/2);}
 else{const q=Math.ceil(n/4);row(q,h/2);row(Math.min(q,n-q),-h/2);col(Math.min(q,Math.max(0,n-2*q)),-w/2);col(Math.max(0,n-3*q),w/2);}
 return out;
}
export function buildPackageModel(spec:PackageSpec):Group{
 const w=clamp(spec.sizeMm.w,0.4,200),h=clamp(spec.sizeMm.h,0.4,200),d=clamp(spec.sizeMm.d,0.2,60),g=new Group();g.name='package-model';
 const body=new Mesh(new BoxGeometry(w,h,d),new MeshStandardMaterial({color:BODY,roughness:0.7}));body.position.z=d/2;body.name='body';g.add(body);
 const pins=spec.pins;
 if(pins){
  const pitch=clamp(pins.pitchMm,0.2,5.08),pw=Math.min(pitch*0.5,1),geo=new BoxGeometry(pw,pw,Math.max(d*0.3,0.3)),mat=new MeshStandardMaterial({color:PIN,metalness:0.8,roughness:0.3});
  for(const [x,y] of pinPositions(w,h,pins)){const m=new Mesh(geo,mat);m.position.set(x,y,geo.parameters.depth/2);m.name='pin';g.add(m);}
 }
 return g;
}
