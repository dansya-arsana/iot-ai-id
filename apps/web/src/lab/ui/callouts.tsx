import {useEffect,useRef} from 'react';
import {useLang} from '../../i18n';
import type {PartState,SimSnapshot,UnoPin} from '../contract';
import type {Lesson} from '../lessons';
import type {StageApi} from './frame';
import {fmtCycles} from './chip-pill';
import {Icon} from './icons';

const CW=232,GAP=16;
const UNO_PARTS=['uno.mcu','uno.led-l','uno.usb','uno.power-jack','uno.reset','uno.digital-header','uno.analog-header','uno.power-header'];
type Tone='live'|'pwm';

/** The live value line for a callout, taken straight from the emulator snapshot. */
export function liveText(target:string,snap:SimSnapshot|null,pin?:string):{text:string;tone:Tone}|null{
 if(!snap||snap.status!=='running')return null;
 if(pin&&snap.pins[pin as UnoPin]){
  const s=snap.pins[pin as UnoPin];
  if(s.analog!==null&&s.mode!=='output')return {text:`${pin} ${Math.round(s.analog)}`,tone:'pwm'};
  if(s.duty>0.01&&s.duty<0.99&&s.freqHz>=50)return {text:`PWM ≈${Math.round(s.duty*100)}% · ${Math.round(s.freqHz)} Hz`,tone:'pwm'};
  return {text:`${pin} ${s.level?'HIGH':'LOW'}`,tone:'live'};
 }
 const part:PartState|undefined=snap.parts[target];
 // the parking-lot traffic light is three LEDs: the callout reports whichever one is lit
 if(target==='ledR'&&snap.parts.ledG&&snap.parts.ledY){
  const on=(id:string)=>{const q=snap.parts[id];return q?.kind==='led'&&q.on;};
  return {text:on('ledR')?'RED · stop':on('ledY')?'YELLOW · slow':on('ledG')?'GREEN':'OFF',tone:'live'};
 }
 if(part){
  switch(part.kind){
   case 'led':return {text:part.on?`ON · ${part.currentMa.toFixed(1)} mA`:'OFF',tone:'live'};
   case 'rgb-led':return {text:`≈ R ${Math.round(part.r*255)} G ${Math.round(part.g*255)} B ${Math.round(part.b*255)}`,tone:'pwm'};
   case 'potentiometer':return {text:`A0 ${Math.round(part.value)} → PWM ${Math.round(part.value/4)} · ${Math.round(part.value/1023*100)}%`,tone:'pwm'};
   case 'ldr':return {text:`ADC ${Math.round(part.adc)}`,tone:'pwm'};
   case 'hcsr04':return {text:part.echoCm===null?'no echo':`${Math.round(part.echoCm)} cm`,tone:'live'};
   case 'obstacle':return {text:`${Math.round(part.distanceCm)} cm`,tone:'live'};
   case 'buzzer':return {text:part.on?`${Math.round(part.freqHz)} Hz`:'silent',tone:'live'};
   case 'motor':return {text:`${Math.round(part.duty*100)}% · ${Math.round(part.rpm)} rpm`,tone:'pwm'};
   case 'servo':return {text:`${Math.round(part.angleDeg)}° · ${Math.round(part.pulseUs)} µs`,tone:'pwm'};
   case 'button':return {text:part.pressed?'PRESSED':'released',tone:'live'};
   case 'lamp':return {text:part.on?`ON · ${Math.round(part.distanceCm)} cm`:'OFF',tone:'live'};
   default:return null;
  }
 }
 if(target==='uno.led-l'){const s=snap.pins.D13,pw=s.duty>0.01&&s.duty<0.99&&s.freqHz>=50;return {text:`D13 ${pw?`PWM ${Math.round(s.duty*100)}%`:s.level?'HIGH':'LOW'}`,tone:pw?'pwm':'live'};}
 if(target==='uno.mcu')return {text:`${fmtCycles(snap.simTimeMs)} cyc`,tone:'live'};
 return null;
}

export function Callouts({lesson,api,pills,show,running,compact,maxPills,selected}:{selected?:string|null;lesson:Lesson;api:StageApi;pills:boolean;show:boolean;running:boolean;compact:boolean;maxPills?:number}){
 const {lang}=useLang();
 const cards=useRef<(HTMLDivElement|null)[]>([]);
 const lives=useRef<(HTMLSpanElement|null)[]>([]);
 const paths=useRef<(SVGPathElement|null)[]>([]);
 const dots=useRef<(SVGGElement|null)[]>([]);
 const lastLive=useRef(0);
 useEffect(()=>{
  if(!show)return;
  return api.subscribe(()=>{
   const scene=api.getScene(),stage=api.stage();
   if(!scene||!stage)return;
   const W=stage.clientWidth,H=stage.clientHeight;
   const hide=(i:number)=>{const el=cards.current[i],pa=paths.current[i],dot=dots.current[i];if(el)el.style.opacity='0';if(pa)pa.style.opacity='0';if(dot)dot.style.opacity='0';};
   const pts=lesson.callouts.map(c=>scene.project(c.pin??c.target));
   const vis=lesson.callouts.map((_,i)=>i).filter(i=>pts[i]&&pts[i]!.visible);
   lesson.callouts.forEach((_,i)=>{if(!vis.includes(i))hide(i);});
   const crc=scene.contentRect?.();
   // slots by anchor x: T1,T2,T3 on the top band; B1,B2 along the bottom only when the layout has room and there are more than three
   const order=[...vis].sort((a,b)=>pts[a]!.x-pts[b]!.x);
   const plan=(col:boolean)=>{
    const topN=col?0:order.length>3&&!compact?3:Math.min(3,order.length);
    const topIdx=order.slice(0,topN),botIdx=col||compact?[]:order.slice(topN,topN+2);
    // pick the order-preserving subset of T1/T2/T3 whose centres sit closest to the anchors (shortest leaders)
    const cxs=[GAP+CW/2,W/2,W-GAP-CW/2];
    const subsets:number[][]=topN===0?[[]]:topN===1?[[0],[1],[2]]:topN===2?[[0,1],[0,2],[1,2]]:[[0,1,2]];
    let slots:number[]=subsets[0],best=Infinity;
    for(const sub of subsets){const c=sub.reduce((a,k,j)=>a+Math.abs(cxs[k]-pts[topIdx[j]]!.x),0);if(c<best){best=c;slots=sub;}}
    return {topIdx,botIdx,slots,cxs};
   };
   const cardPos=(i:number,pl:ReturnType<typeof plan>,h:number):{x:number;y:number;top:boolean}|null=>{
    const ti=pl.topIdx.indexOf(i),bi=pl.botIdx.indexOf(i);
    if(ti>=0)return {x:Math.round(pl.cxs[pl.slots[ti]]-CW/2),y:GAP,top:true};
    if(bi>=0){const right=pl.botIdx.length===1?pts[i]!.x>W/2:bi===1;return {x:right?W-GAP-CW:GAP,y:H-h-GAP-52,top:false};}
    return null;
   };
   // one view is never a mix: if any full card would sit on the hardware or on the part it labels, every callout collapses to a pill
   let collapsed=pills;
   if(!collapsed){
    const pl=plan(false);
    for(const i of vis){
     const el=cards.current[i];if(!el)continue;
     el.dataset.pill='false';
     const h=el.offsetHeight,pos=cardPos(i,pl,h);if(!pos)continue;
     const hits=(r:{x:number;y:number;w:number;h:number}|null|undefined,m:number)=>!!r&&pos.x<r.x+r.w-m&&pos.x+CW>r.x+m&&pos.y<r.y+r.h-m&&pos.y+h>r.y+m;
     if(hits(crc,8)||hits(scene.targetRect?.(lesson.callouts[i].target),2)){collapsed=true;break;}
    }
   }
   const {topIdx,botIdx,slots}=plan(collapsed);
   const doLive=performance.now()-lastLive.current>100;
   if(doLive)lastLive.current=performance.now();
   const snap=api.snapshot();
   const placed:{x:number;y:number;w:number;h:number}[]=[];
   const avoid:{x:number;y:number;w:number;h:number}[]=[];
   if(collapsed){
    const add=(r:{x:number;y:number;w:number;h:number}|null|undefined)=>{if(r&&r.w>0&&r.h>0)avoid.push({x:r.x,y:r.y,w:r.w,h:r.h});};
    for(const c of lesson.callouts)add(scene.targetRect?.(c.target));
    for(const id of UNO_PARTS)add(scene.targetRect?.(id));
    if(selected)add(scene.targetRect?.(selected));
    // the stage's own controls: camera toolbar, dock card or chips, minimap
    // the art may be CSS-scaled (<1440px): convert screen pixels back to the stage's own layout pixels
    const sr=stage.getBoundingClientRect(),k=sr.width/W||1;
    document.querySelectorAll('.lab-viewbar,.lab-dock:not([data-folded=true]),.lab-dockchip:not([data-folded=true]),.lab-minimap').forEach(n=>{const r=n.getBoundingClientRect();if(r.width>0&&r.height>0)add({x:(r.left-sr.left)/k,y:(r.top-sr.top)/k,w:r.width/k,h:r.height/k});});
   }
   const maxCardH=Math.max(0,...vis.map(i=>cards.current[i]?.offsetHeight??0));
   vis.forEach(i=>{
    const el=cards.current[i],pa=paths.current[i],dot=dots.current[i],p=pts[i]!;
    if(!el||!pa||!dot)return;
    dot.setAttribute('transform',`translate(${p.x.toFixed(1)} ${p.y.toFixed(1)})`);
    const lv=lives.current[i];
    if(lv&&doLive){const t=liveText(lesson.callouts[i].target,snap,lesson.callouts[i].pin);lv.textContent=t?t.text:'';lv.dataset.tone=t?t.tone:'';lv.parentElement!.dataset.on=t?'true':'false';}
    el.dataset.pill=collapsed?'true':'false';
    const pillAt=():boolean=>{
     el.dataset.pill='true';
     const w=el.offsetWidth||120,ph=el.offsetHeight||28;
     const fitX=(xx:number)=>Math.max(8,Math.min(W-w-8,xx));
     const sides=[p.x+12+w>W-8?fitX(p.x-12-w):p.x+12,fitX(p.x-12-w)];
     const hit=(xx:number,yy:number)=>avoid.concat(placed).some(r=>xx<r.x+r.w+4&&xx+w+4>r.x&&yy<r.y+r.h+4&&yy+ph+4>r.y);
     // first free spot near the anchor (-66..+38 px); never fall back to sitting on hardware
     let px=sides[0],py=0,found=false;
     for(const dy of [-34,6,-66,38,-14,22,-50]){
      for(const sx of sides){
       const yy=Math.max(8,p.y+dy);
       if(yy+ph<=H-8&&!hit(sx,yy)){px=sx;py=yy;found=true;break;}
      }
      if(found)break;
     }
     if(!found||(maxPills!==undefined&&placed.length>=maxPills)){hide(i);return true;}
     placed.push({x:px,y:py,w,h:ph});el.style.opacity='1';
     el.style.transform=`translate(${px.toFixed(1)}px,${py.toFixed(1)}px)`;
     // straight leader to the dot when the pill sits more than ~20px from its part
     const ex=Math.max(px,Math.min(p.x,px+w)),ey=Math.max(py,Math.min(p.y,py+ph));
     if(Math.hypot(p.x-ex,p.y-ey)>20){pa.setAttribute('d',`M${ex.toFixed(1)} ${ey.toFixed(1)}L${p.x.toFixed(1)} ${p.y.toFixed(1)}`);pa.style.opacity='1';}
     else pa.style.opacity='0';
     dot.style.opacity='1';return true;
    };
    if(collapsed){pillAt();return;}
    const h=el.offsetHeight;
    const pos=cardPos(i,{topIdx,botIdx,slots,cxs:[GAP+CW/2,W/2,W-GAP-CW/2]},h);
    if(!pos){hide(i);return;}
    const {x,y,top}=pos;
    el.dataset.pill='false';el.style.opacity='1';dot.style.opacity='1';
    el.style.transform=`translate(${x}px,${y}px)`;
    const cx=Math.round(x+CW/2);
    const y0=top?y+h:y;
    // orthogonal elbow: vertical from the card edge midpoint, one 90 degree bend, ends exactly on the hotspot
    // flip the elbow (horizontal run at the card edge, vertical drop onto the hotspot) when V-then-H would cut across the hardware
    const cr=crc;
    const hitsH=cr&&p.y>cr.y+6&&p.y<cr.y+cr.h-6&&Math.max(Math.min(cx,p.x),cr.x+6)<Math.min(Math.max(cx,p.x),cr.x+cr.w-6);
    const lane=top?GAP+maxCardH+8:y0;
    const d=hitsH?`M${cx} ${y0}V${lane}H${p.x.toFixed(1)}V${p.y.toFixed(1)}`:`M${cx} ${y0}V${p.y.toFixed(1)}H${p.x.toFixed(1)}`;
    pa.setAttribute('d',d);pa.style.opacity='1';
   });
  });
 },[api,lesson,pills,show,compact,maxPills,selected]);
 if(!show)return null;
 const ic=(c:string)=>c.startsWith('uno.mcu')?'chip':c.startsWith('uno.led')?'led':c.startsWith('uno.usb')?'port':c.startsWith('uno.digital')?'port':c.startsWith('uno.analog')?'wave':/^(D\d+|A\d|GND)$/.test(c)?'port':/^led|^ledR|^ledG/.test(c)?'led':/^r\d|^rR|^rG/.test(c)?'resistor':/^pot/.test(c)?'pot':/^us|^obs/.test(c)?'sonar':/^sv/.test(c)?'horn':/^m\d/.test(c)?'motor':/^bz/.test(c)?'note':/^btn/.test(c)?'button':/^ldr|^lamp/.test(c)?'sun':/^rgb/.test(c)?'rgb':'chip';
 return (
  <div className="lab-callouts" data-testid="lab-callouts" data-running={running}>
   <svg className="lab-leaders" aria-hidden="true">
    {lesson.callouts.map((c,i)=><path key={'p'+(c.pin??c.target)+i} ref={el=>{paths.current[i]=el;}} className="lab-leader" opacity="0"/>)}
    {lesson.callouts.map((c,i)=>(
     <g key={'d'+(c.pin??c.target)+i} ref={el=>{dots.current[i]=el;}} opacity="0" className="lab-hotspot"><circle className="lab-halo-out" r="7"/><circle className="lab-halo" r="5"/><circle className="lab-dot-core" r="2"/></g>
    ))}
   </svg>
   {lesson.callouts.map((c,i)=>(
    <div key={(c.pin??c.target)+i} ref={el=>{cards.current[i]=el;}} className="lab-callout" data-target={c.target} data-pill="false" style={{opacity:0}}>
     <span className="lab-tile lab-tile--lg"><Icon name={ic(c.pin??c.target)} size={18}/></span>
     <span className="lab-callout-text">
      <strong>{c.title[lang]}</strong>
      <span className="lab-callout-body">{c.body[lang]}</span>
      <span className="lab-callout-live" data-on="false"><i/><span ref={el=>{lives.current[i]=el;}}/></span>
     </span>
    </div>
   ))}
  </div>
 );
}
