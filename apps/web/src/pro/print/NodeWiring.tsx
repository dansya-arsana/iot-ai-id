/** Print wiring diagram: renders layoutWiring. Wire colours are encoded by token hue plus a dash code (the cable list names the colour). */
import {useMemo} from 'react';
import type {ProNode} from '../../../../../packages/pro-contract/system-spec';
import {FONT,layoutWiring,HEAD} from './wiring-layout';

/** colour -> [token, dash]. Only red/green/yellow/orange/black exist as tokens; the rest are told apart by dash and the list. */
const WIRE:Record<string,[string,string|undefined]>={
 red:['var(--lab-stop)',undefined],black:['var(--ds-ink)',undefined],yellow:['var(--lab-pwm)',undefined],green:['var(--lab-live-ink)',undefined],orange:['var(--lab-pwm-ink)',undefined],
 blue:['var(--ds-ink-2)','7 3'],purple:['var(--ds-ink)','2 3'],white:['var(--ds-ink-3)','7 3'],brown:['var(--lab-syn-str)',undefined],grey:['var(--ds-ink-3)',undefined]};

export function NodeWiring({node,des,partLabel}:{node:ProNode;des:Record<string,string>;partLabel:(id:string)=>string}){
 const L=useMemo(()=>layoutWiring(node,des,partLabel),[node,des,partLabel]);
 const mono={fontFamily:'var(--ds-mono)',fontSize:FONT};
 return <svg className="bs-wiring" viewBox={`0 0 ${L.width} ${L.height}`} role="img" aria-label={`Wiring diagram of ${node.id}: ${node.wires.length} wires`}>
  <rect x={L.board.x} y={L.board.y} width={L.board.w} height={L.board.h} className="bs-w-board"/>
  <text x={L.board.x+8} y={L.board.y+14} className="bs-w-title" style={{fontSize:FONT+1}}>{L.board.label}</text>
  {[...L.board.left.map(p=>({...p,s:'L'})),...L.board.right.map(p=>({...p,s:'R'}))].map(p=><text key={p.s+p.name} x={p.s==='L'?L.board.x+8:L.board.x+L.board.w-8} y={p.y+3} textAnchor={p.s==='L'?'start':'end'} style={mono}>{p.name}</text>)}
  {L.parts.map(p=><g key={p.id}>
   <rect x={p.x} y={p.y} width={p.w} height={p.h} className="bs-w-part"/>
   <text x={p.x+6} y={p.y+HEAD-9} className="bs-w-title" style={{fontSize:FONT+1}}>{p.ref} {p.label}</text>
   {p.pins.map(q=><text key={q.name} x={p.side==='L'?p.x+8:p.x+p.w-8} y={q.y+3} textAnchor={p.side==='L'?'start':'end'} style={mono}>{q.name}</text>)}
  </g>)}
  {L.routes.map(r=>{const [c,dash]=WIRE[r.color]??WIRE.grey!;return <g key={r.id}>
   <path d={r.d} fill="none" stroke={c} strokeWidth={r.func==='power'||r.func==='ground'?1.8:1.4} strokeDasharray={dash} data-wire={r.id}/>
   <text x={r.tag.x} y={r.tag.y} textAnchor={r.tag.anchor??'start'} className="bs-w-tag" style={{fontSize:FONT}}>{r.id}</text>
  </g>;})}
 </svg>;
}
