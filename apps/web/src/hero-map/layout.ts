/** Pure geometry for the hero map: per-region dot paths, the zoom camera and the label collision placer. No React, no DOM except the cached canvas used to measure text. */
import {heroGrid} from '../hero-map-data';

export const {cols:W,rows:H,lon0,lat1,step,grid}=heroGrid;
export type Box={x0:number;y0:number;x1:number;y1:number};
export type Rect={x:number;y:number;w:number;h:number};
export type Frame={w:number;h:number};
export type Cam={k:number;tx:number;ty:number};

/** One SVG path per grid char (`M{c+.5} {r+.5}h0` per dot, drawn with round caps) and the dots' bounding box in grid cells. */
export const PATH:Record<string,string>={};
export const BBOX:Record<string,Box>={};
grid.forEach((row,r)=>{for(let c=0;c<row.length;c++){const ch=row[c];if(ch==='.')continue;PATH[ch]=(PATH[ch]??'')+`M${c+.5} ${r+.5}h0`;const b=BBOX[ch];if(!b)BBOX[ch]={x0:c,y0:r,x1:c+1,y1:r+1};else{b.x0=Math.min(b.x0,c);b.y0=Math.min(b.y0,r);b.x1=Math.max(b.x1,c+1);b.y1=Math.max(b.y1,r+1);}}});

export const cellOf=(lon:number,lat:number):[number,number]=>[(lon-lon0)/step,(lat1-lat)/step];
/** Pixels per grid cell at k=1 and the offset of the (centred, "meet") map inside the frame. */
export const unit=(f:Frame)=>{const u=Math.min(f.w/W,f.h/H);return{u,ox:(f.w-W*u)/2,oy:(f.h-H*u)/2};};
export const IDENTITY:Cam={k:1,tx:0,ty:0};
/** Screen position (inside the frame) of a grid cell under a camera. */
export const toScreen=(f:Frame,cam:Cam,cx:number,cy:number):[number,number]=>{const{u,ox,oy}=unit(f);return[cam.tx+cam.k*(ox+cx*u),cam.ty+cam.k*(oy+cy*u)];};
export const toCell=(f:Frame,cam:Cam,x:number,y:number):[number,number]=>{const{u,ox,oy}=unit(f);return[((x-cam.tx)/cam.k-ox)/u,((y-cam.ty)/cam.k-oy)/u];};

/** Camera that frames a bounding box inside the safe rect (where the card is not). The map never leaves the frame. */
export function camFor(box:Box|null,f:Frame,safe:Rect,kMax:number):Cam{
 if(!box)return IDENTITY;
 const{u,ox,oy}=unit(f),bw=(box.x1-box.x0+12)*u,bh=(box.y1-box.y0+12)*u;
 const k=Math.max(1,Math.min(kMax,safe.w/bw,safe.h/bh));
 const mx=ox+(box.x0+box.x1)/2*u,my=oy+(box.y0+box.y1)/2*u;
 const tx=Math.min(0,Math.max(f.w-k*f.w,safe.x+safe.w/2-k*mx)),ty=Math.min(0,Math.max(f.h-k*f.h,safe.y+safe.h/2-k*my));
 return{k,tx,ty};
}

const widths=new Map<string,number>();let ctx:CanvasRenderingContext2D|null|undefined;
/** Text width in px for the pin and region labels (IBM Plex Mono 10px plus letter-spacing), cached per string. */
export function textWidth(s:string,size=10):number{
 const key=`${size}|${s}`,hit=widths.get(key);if(hit!==undefined)return hit;
 if(ctx===undefined&&typeof document!=='undefined')ctx=document.createElement('canvas').getContext('2d');
 let w:number;if(ctx){ctx.font=`500 ${size}px 'IBM Plex Mono', monospace`;w=ctx.measureText(s).width+s.length*.4;}else w=s.length*(size*.6+.4);
 widths.set(key,w);return w;
}

export type Cand={id:string;kind:'pin'|'region'|'nb';x:number;y:number;w:number;h:number;/** try the anchor itself first (region labels sit on their dots) */centre?:boolean};
export type Placed={x:number;y:number;anchor:string;leader?:[number,number,number,number]};
const hit=(a:Rect,b:Rect,pad=0)=>a.x<b.x+b.w+pad&&a.x+a.w+pad>b.x&&a.y<b.y+b.h+pad&&a.y+a.h+pad>b.y;

/** Greedy label placement in screen pixels, in candidate priority order. Offsets E W NE NW SE SW N S at r=8, then E W N S at 2r and 3r with a leader line. */
export function placeLabels(cands:Cand[],obstacles:Rect[],pins:{id:string;x:number;y:number}[],f:Frame,dots:(r:Rect)=>number):Map<string,Placed>{
 const out=new Map<string,Placed>(),boxes:Rect[]=[],r=8;
 const bounds:Rect={x:4,y:4,w:f.w-8,h:f.h-8};
 for(const c of cands){
  type Opt={x:number;y:number;a:string;lead:number;pen:number};const opts:Opt[]=[];
  const dirs:[string,number,number][]=[['E',1,0],['W',-1,0],['NE',.7,-.7],['NW',-.7,-.7],['SE',.7,.7],['SW',-.7,.7],['N',0,-1],['S',0,1]];
  const at=(a:string,dx:number,dy:number,d:number):[number,number]=>{
   const px=c.x+dx*d,py=c.y+dy*d;
   if(a==='E'||a==='NE'||a==='SE')return[px,a==='E'?py-c.h/2:a==='NE'?py-c.h:py];
   if(a==='W'||a==='NW'||a==='SW')return[px-c.w,a==='W'?py-c.h/2:a==='NW'?py-c.h:py];
   return[px-c.w/2,a==='N'?py-c.h:py];
  };
  if(c.centre)opts.push({x:c.x-c.w/2,y:c.y-c.h/2,a:'C',lead:0,pen:0});
  for(const[a,dx,dy]of dirs)opts.push({...(([x,y])=>({x,y}))(at(a,dx,dy,r)),a,lead:0,pen:a==='N'||a==='S'?.5:0});
  for(const m of[2,3])for(const[a,dx,dy]of dirs.filter(d=>d[0].length===1))opts.push({...(([x,y])=>({x,y}))(at(a,dx,dy,r*m)),a,lead:m,pen:m+(a==='N'||a==='S'?.5:0)});
  let best:Opt|null=null,bs=1e9;
  for(const o of opts){
   const box:Rect={x:o.x,y:o.y,w:c.w,h:c.h};
   if(box.x<bounds.x||box.y<bounds.y||box.x+box.w>bounds.x+bounds.w||box.y+box.h>bounds.y+bounds.h)continue;
   if(boxes.some(b=>hit(box,b,2))||obstacles.some(b=>hit(box,b))||pins.some(p=>p.id!==c.id&&hit(box,{x:p.x-10,y:p.y-10,w:20,h:20})))continue;
   const s=dots(box)*2+o.pen;if(s<bs){bs=s;best=o;}
  }
  if(!best)continue;
  const box:Rect={x:best.x,y:best.y,w:c.w,h:c.h};boxes.push(box);
  const p:Placed={x:box.x,y:box.y,anchor:best.a};
  if(best.lead>0){const nx=Math.max(box.x,Math.min(c.x,box.x+box.w)),ny=Math.max(box.y,Math.min(c.y,box.y+box.h));p.leader=[c.x,c.y,nx,ny];}
  out.set(c.id,p);
 }
 return out;
}
