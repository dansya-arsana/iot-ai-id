import {forwardRef,useImperativeHandle,useRef} from 'react';
import type {CubeFace,Projection} from './view-cube';
import {projectionLabel} from './view-cube';

const FACES:{f:CubeFace;label:string;t:string}[]=[
 {f:'front',label:'FRONT',t:'translateZ(var(--cube-h))'},
 {f:'back',label:'BACK',t:'rotateY(180deg) translateZ(var(--cube-h))'},
 {f:'right',label:'RIGHT',t:'rotateY(90deg) translateZ(var(--cube-h))'},
 {f:'left',label:'LEFT',t:'rotateY(-90deg) translateZ(var(--cube-h))'},
 {f:'top',label:'TOP',t:'rotateX(90deg) translateZ(var(--cube-h))'},
 {f:'bottom',label:'BOT',t:'rotateX(-90deg) translateZ(var(--cube-h))'},
];
export interface ViewCubeHandle{
 /** Column-major 3x3 rotation of the camera view matrix (three's matrixWorldInverse elements 0..10). */
 setRotation(e:ArrayLike<number>):void;
}
/** Click a face to snap the view. Home resets to iso. The caption shows the projection and toggles it. */
export const ViewCube=forwardRef<ViewCubeHandle,{projection:Projection;onFace(f:CubeFace):void;onHome():void;onToggleProjection():void}>(function ViewCube(p,ref){
 const el=useRef<HTMLDivElement>(null);
 useImperativeHandle(ref,()=>({
  setRotation(e){
   // M = S R S with S=diag(1,-1,1): CSS y points down, three y points up. matrix3d is column-major.
   const R=(r:number,c:number)=>e[c*4+r]!;
   const s=[1,-1,1];
   const m:number[]=[];
   for(let c=0;c<3;c++){for(let r=0;r<3;r++)m.push(s[r]!*R(r,c)*s[c]!);m.push(0);}
   m.push(0,0,0,1);
   if(el.current)el.current.style.transform=`matrix3d(${m.join(',')})`;
  },
 }),[]);
 return <div className="cad-cube" data-testid="cad-view-cube">
  <button type="button" className="cad-cube-home" aria-label="Home view (isometric)" title="Home" onClick={p.onHome}><svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round"><path d="M2 8 8 3l6 5M4 7v6h8V7"/></svg></button>
  <div className="cad-cube-scene"><div className="cad-cube-body" ref={el}>
   {FACES.map(x=><button key={x.f} type="button" className="cad-cube-face" style={{transform:x.t}} aria-label={`View from ${x.f}`} data-face={x.f} onClick={()=>p.onFace(x.f)}>{x.label}</button>)}
  </div></div>
  <button type="button" className="cad-cube-proj" onClick={p.onToggleProjection} title="Toggle projection (5)">{projectionLabel(p.projection)}</button>
 </div>;
});
