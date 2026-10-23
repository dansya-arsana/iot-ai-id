/** Balloon layout (pure): item numbers with leaders. Balloons sit in a left or right column so leaders never cross parts of the label text. */
export interface BalloonIn{id:string;ref:number;label:string;ax:number;ay:number}
export interface Balloon extends BalloonIn{bx:number;by:number;side:'left'|'right'}
export function layoutBalloons(items:BalloonIn[],w:number,h:number,pad=44,minGap=26,compact=false):Balloon[]{
 const out:Balloon[]=items.map(i=>({...i,bx:i.ax,by:i.ay,side:i.ax<w/2?'left':'right'}));
 for(const side of ['left','right'] as const){
  const col=out.filter(b=>b.side===side).sort((a,b)=>a.ay-b.ay);
  let last=-Infinity;
  for(const b of col){
   const lw=compact?0:Math.min(190,Math.max(0,...col.map(c=>c.label.length*6.6)));
   b.bx=side==='left'?pad+lw:w-pad-lw;
   b.by=Math.max(b.ay,last+minGap);
   last=b.by;
  }
  // pull the column back up if it ran off the bottom
  let over=(col[col.length-1]?.by??0)-(h-pad);
  for(let i=col.length-1;i>=0&&over>0;i--){const b=col[i]!;const prev=col[i-1];const room=prev?b.by-prev.by-minGap:b.by-pad;const mv=Math.min(over,Math.max(0,room));b.by-=mv;over-=mv;}
 }
 return out;
}
