import {BoxGeometry,Group,InstancedMesh,Matrix4,Vector3} from 'three';
import {BB_CX,BB_COLS,BB_D,BB_ROWS,BB_TOP,BB_W,RAIL_Z,holeX,holeZ,railX} from './layout';
import {solid,toon,disposeObject} from './materials';
import * as C from './palette';

export interface BreadboardBuild{
 group:Group;
 holeAnchor(col:number,row:number):Vector3;
 railAnchor(rail:'5v-rail'|'gnd-rail',col:number):Vector3;
 dispose():void;
}

export function buildBreadboard():BreadboardBuild{
 const group=new Group();group.name='breadboard';group.userData.targetId='bb';
 group.add(solid(new BoxGeometry(BB_W,BB_TOP,BB_D),C.CREAM,{outline:0.5,pos:[BB_CX,BB_TOP/2,0]}));
 // centre channel
 group.add(solid(new BoxGeometry(BB_W-4,0.4,3.6),C.GROOVE,{pos:[BB_CX,BB_TOP+0.01,0],cast:false}));
 // rail stripes
 for(const z of [-1,1]){
  group.add(solid(new BoxGeometry(BB_W-8,0.12,0.5),C.RAIL_RED,{pos:[BB_CX,BB_TOP+0.07,z*24.4],cast:false}));
  group.add(solid(new BoxGeometry(BB_W-8,0.12,0.5),C.RAIL_BLUE,{pos:[BB_CX,BB_TOP+0.07,z*18.8],cast:false}));
 }
 const holeGeo=new BoxGeometry(1.3,0.3,1.3);
 const total=BB_COLS*BB_ROWS+4*BB_COLS;
 const holes=new InstancedMesh(holeGeo,toon(C.HOLE),total);
 const m=new Matrix4();let n=0;
 for(let c=0;c<BB_COLS;c++)for(let r=0;r<BB_ROWS;r++){m.setPosition(holeX(c),BB_TOP,holeZ(r));holes.setMatrixAt(n++,m);}
 for(const side of [-1,1])for(const z of [RAIL_Z['5v-rail'],RAIL_Z['gnd-rail']])for(let c=0;c<BB_COLS;c++){m.setPosition(railX(c),BB_TOP,side*z);holes.setMatrixAt(n++,m);}
 holes.userData.noPick=true;group.add(holes);
 return {
  group,
  holeAnchor:(col,row)=>new Vector3(holeX(col),BB_TOP,holeZ(row)),
  railAnchor:(r,col)=>new Vector3(railX(col),BB_TOP,RAIL_Z[r]),
  dispose(){disposeObject(group);},
 };
}
