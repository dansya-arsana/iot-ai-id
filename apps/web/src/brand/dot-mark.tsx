import type {CSSProperties} from 'react';
import './dot-mark.css';

/**
 * Dot-matrix Indonesia mark. Indonesia (Natural Earth 1:50m) sampled on a 1.9° grid: 67 dots, one live dot on Java.
 * `animated` plays the scan → lock → pulse sequence used by the loader.
 */
const DOTS:[number,number][]=[[1,1],[2,1],[11,1],[12,1],[1,2],[2,2],[3,2],[11,2],[12,2],[2,3],[3,3],[4,3],[8,3],[9,3],[10,3],[11,3],[12,3],[14,3],[15,3],[17,3],[18,3],[3,4],[4,4],[5,4],[8,4],[9,4],[10,4],[11,4],[13,4],[14,4],[15,4],[19,4],[20,4],[23,4],[4,5],[5,5],[6,5],[9,5],[10,5],[11,5],[13,5],[14,5],[18,5],[20,5],[21,5],[22,5],[23,5],[24,5],[5,6],[6,6],[13,6],[15,6],[22,6],[23,6],[24,6],[6,7],[7,7],[8,7],[9,7],[10,7],[23,7],[24,7],[11,8],[12,8],[13,8],[15,8],[16,8]];
const LIVE=[8,7] as const;
const SCAN_START=120,SCAN_MS=900,COLS=25;

export function DotMark({animated=false,className,label='AIoT'}:{animated?:boolean;className?:string;label?:string}){
 return <svg className={['dm',animated&&'dm--animated',className].filter(Boolean).join(' ')} viewBox="0 0.2 25.6 9.4" {...(label?{role:'img','aria-label':label}:{'aria-hidden':true})}>
  {animated&&<rect className="dm-scan" x="0" y="0.3" width="0.08" height="9.2"/>}
  <g className="dm-dots">{DOTS.filter(([c,r])=>c!==LIVE[0]||r!==LIVE[1]).map(([c,r])=><circle key={`${c}-${r}`} cx={c+.5} cy={r+.5} r=".34" style={{'--d':`${Math.round(SCAN_START+(c/COLS)*SCAN_MS-230+r*6)}ms`} as CSSProperties}/>)}</g>
  <g className="dm-live" transform={`translate(${LIVE[0]+.5} ${LIVE[1]+.5})`}>
   {animated&&<circle className="dm-ring" r=".52"/>}
   <circle className="dm-core" r=".52"/>
  </g>
 </svg>;
}
