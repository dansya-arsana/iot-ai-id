/**
 * Nano-style board for the scene: the same ATmega328P as the Uno on a 43 x 18 mm module with two 15-pin rows (the model of parts/arduino-nano.ts),
 * exposing the interface of board-uno.ts so the scene can swap boards per circuit (Circuit.board === 'nano').
 * Pin map: D0-D13 and A0-A5 as on the Uno, plus A6 and A7 (analog input only). Power: 5V, 3V3, VIN and GND. No barrel jack.
 */
import {CylinderGeometry,Group,Vector3} from 'three';
import type {BoardFeatureId,BoardPin,SimSnapshot} from '../contract';
import {BOARD_FEATURES} from '../contract';
import {disposeObject,solid} from './materials';
import * as C from './palette';
import {NANO,NANO_ROW_BOTTOM,NANO_ROW_TOP,buildNanoBody} from './parts/arduino-nano';
import type {UnoBuild} from './board-uno';
import type {Object3D} from 'three';

export function buildNano():UnoBuild{
 const group=new Group();group.name='nano';
 const features:Partial<Record<BoardFeatureId,Group>>={};
 const feat=(id:BoardFeatureId):Group=>{
  let g=features[id];
  if(!g){g=new Group();g.name=id;g.userData.targetId=id;group.add(g);features[id]=g;}
  return g;
 };
 const body=buildNanoBody(group,feat);
 // anchors: top surface of each header pin (x along the board, z by row)
 const y=body.top+0.15;
 const anchors=new Map<string,Vector3>();
 NANO_ROW_TOP.forEach((n,i)=>{if(!anchors.has(n))anchors.set(n,new Vector3((i-7)*NANO.pitch,y,-NANO.rowZ));});
 NANO_ROW_BOTTOM.forEach((n,i)=>{if(!anchors.has(n))anchors.set(n,new Vector3((i-7)*NANO.pitch,y,NANO.rowZ));});
 // the three supply pins of the second row get a small gold collar so the power header reads as its own feature
 const power=feat('uno.power-header');
 for(const n of ['3V3','5V','VIN']){
  const a=anchors.get(n)!;
  power.add(solid(new CylinderGeometry(0.95,0.95,0.3,16),C.GOLD,{pos:[a.x,a.y-0.1,a.z],finish:'gold',cast:false}));
 }
 const on=body.power.material as unknown as {emissive:{set(c:number):void};emissiveIntensity:number};
 const lm=body.l.material as unknown as typeof on,tm=body.tx.material as unknown as typeof on;
 on.emissive.set(C.LED_ON_GREEN);lm.emissive.set(C.LED_L_ORANGE);tm.emissive.set(C.LED_TX_YELLOW);
 return {
  group,
  features:Object.fromEntries(BOARD_FEATURES.filter(id=>features[id]).map(id=>[id,features[id] as Object3D])) as Record<BoardFeatureId,Object3D>,
  pinAnchor(pin:BoardPin){const a=anchors.get(pin);return a?a.clone():new Vector3(0,y,0);},
  setLeds(s){on.emissiveIntensity=s.on?1.4:0;lm.emissiveIntensity=Math.min(1,s.l)*2.2;tm.emissiveIntensity=s.tx?2.2:0;},
  setUsedPins(){},
  setLive(_snap:SimSnapshot){},
  dispose(){disposeObject(group);},
 };
}
