/** View cube presets (pure). A face, edge or corner is a unit direction from the target toward the camera. */
import type {Vec3} from './plan';

export type CubeFace='front'|'back'|'left'|'right'|'top'|'bottom';
export const FACE_DIR:Record<CubeFace,Vec3>={front:[0,0,1],back:[0,0,-1],left:[-1,0,0],right:[1,0,0],top:[0,1,0],bottom:[0,-1,0]};
export const ISO_DIR:Vec3=norm([1,0.8,1.15]);
export type Projection='persp'|'ortho';
export const projectionLabel=(p:Projection):string=>p==='ortho'?'Ortho':'Iso · persp.';
export const toggleProjection=(p:Projection):Projection=>p==='ortho'?'persp':'ortho';
function norm(v:Vec3):Vec3{const l=Math.hypot(...v)||1;return [v[0]/l,v[1]/l,v[2]/l];}
/** An edge is two faces; a corner is three. */
export const combine=(faces:CubeFace[]):Vec3=>norm(faces.reduce<Vec3>((a,f)=>[a[0]+FACE_DIR[f][0],a[1]+FACE_DIR[f][1],a[2]+FACE_DIR[f][2]],[0,0,0]));
/** Up vector for a view direction (avoids the degenerate case looking straight up or down). */
export const upFor=(d:Vec3):Vec3=>Math.abs(d[1])>0.99?[0,0,-Math.sign(d[1])]:[0,1,0];
/** Current camera direction to the nearest named face, for the cube highlight. */
export function nearestFace(d:Vec3):CubeFace{
 let best:CubeFace='front',bs=-Infinity;
 for(const f of Object.keys(FACE_DIR) as CubeFace[]){const v=FACE_DIR[f];const s=v[0]*d[0]+v[1]*d[1]+v[2]*d[2];if(s>bs){bs=s;best=f;}}
 return best;
}
