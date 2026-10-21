import {useEffect,useRef} from 'react';
import {useLang} from '../../i18n';
import type {PartState,SimSnapshot,UnoPin} from '../contract';
import type {Lesson} from '../lessons';
import type {StageApi} from './frame';
import {fmtCycles} from './chip-pill';
import {Icon} from './icons';

const CW=232,GAP=16;
type Tone='live'|'pwm';

/** The live value line for a callout, taken straight from the emulator snapshot. */
export function liveText(target:string,snap:SimSnapshot|null,pin?:string):{text:string;tone:Tone}|null{
 if(!snap||snap.status!=='running')return null;
 if(pin&&snap.pins[pin as UnoPin]){
  const s=snap.pins[pin as UnoPin];
  if(s.analog!==null&&s.mode!=='output')return {text:`${pin} ${Math.round(s.analog)}`,tone:'pwm'};
  if(s.duty>0.01&&s.duty<0.99)return {text:`PWM ≈${Math.round(s.duty*100)}% · ${Math.round(s.freqHz)} Hz`,tone:'pwm'};
  return {text:`${pin} ${s.level?'HIGH':'LOW'}`,tone:'live'};
 }
 const part:PartState|undefined=snap.parts[target];
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
 if(target==='uno.led-l'){const s=snap.pins.D13;return {text:`D13 ${s.duty>0.01&&s.duty<0.99?`PWM ${Math.round(s.duty*100)}%`:s.level?'HIGH':'LOW'}`,tone:s.duty>0.01&&s.duty<0.99?'pwm':'live'};}
 if(target==='uno.mcu')return {text:`${fmtCycles(snap.simTimeMs)} cyc`,tone:'live'};
 return null;
}

export function Callouts({lesson,api,pills,show,running,compact}:{lesson:Lesson;api:StageApi;pills:boolean;show:boolean;running:boolean;compact:boolean}){
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
   const collapsed=pills;
   const pts=lesson.callouts.map(c=>scene.project(c.pin??c.target));
   const vis=lesson.callouts.map((_,i)=>i).filter(i=>pts[i]&&pts[i]!.visible);
   const hide=(i:number)=>{const el=cards.current[i],pa=paths.current[i],dot=dots.current[i];if(el)el.style.opacity='0';if(pa)pa.style.opacity='0';if(dot)dot.style.opacity='0';};
   lesson.callouts.forEach((_,i)=>{if(!vis.includes(i))hide(i);});
   // slots by anchor x: T1,T2,T3 on the top band; B1,B2 along the bottom only when the layout has room and there are more than three
   const order=[...vis].sort((a,b)=>pts[a]!.x-pts[b]!.x);
   const topN=collapsed?0:order.length>3&&!compact?3:Math.min(3,order.length);
   const topIdx=order.slice(0,topN),botIdx=collapsed||compact?[]:order.slice(topN,topN+2);
   // pick the order-preserving subset of T1/T2/T3 whose centres sit closest to the anchors (shortest leaders)
   const cxs=[GAP+CW/2,W/2,W-GAP-CW/2];
   const subsets:number[][]=topN===0?[[]]:topN===1?[[0],[1],[2]]:topN===2?[[0,1],[0,2],[1,2]]:[[0,1,2]];
   let slots:number[]=subsets[0],best=Infinity;
   for(const sub of subsets){const c=sub.reduce((a,k,j)=>a+Math.abs(cxs[k]-pts[topIdx[j]]!.x),0);if(c<best){best=c;slots=sub;}}
   const doLive=performance.now()-lastLive.current>100;
   if(doLive)lastLive.current=performance.now();
   const snap=api.snapshot();
   const placed:{x:number;y:number;w:number;h:number}[]=[];
   vis.forEach(i=>{
    const el=cards.current[i],pa=paths.current[i],dot=dots.current[i],p=pts[i]!;
    if(!el||!pa||!dot)return;
    el.style.opacity='1';dot.style.opacity='1';
    dot.setAttribute('transform',`translate(${p.x.toFixed(1)} ${p.y.toFixed(1)})`);
    const lv=lives.current[i];
    if(lv&&doLive){const t=liveText(lesson.callouts[i].target,snap,lesson.callouts[i].pin);lv.textContent=t?t.text:'';lv.dataset.tone=t?t.tone:'';lv.parentElement!.dataset.on=t?'true':'false';}
    el.dataset.pill=collapsed?'true':'false';
    const pillAt=():boolean=>{
     el.dataset.pill='true';
     const w=el.offsetWidth||120,ph=el.offsetHeight||28;
     const right=p.x+12;
     const px=Math.max(8,right+w>W-8?Math.min(W-w-8,p.x-12-w):right);
     let py=Math.max(8,p.y-34),tries=0;
     const hit=(yy:number)=>placed.some(r=>px<r.x+r.w+4&&px+w+4>r.x&&yy<r.y+r.h+4&&yy+ph+4>r.y);
     while(hit(py)&&tries<6){py+=8;tries++;}
     if(hit(py)||py+ph>H-8){hide(i);return true;}
     placed.push({x:px,y:py,w,h:ph});
     el.style.transform=`translate(${px.toFixed(1)}px,${py.toFixed(1)}px)`;
     pa.style.opacity='0';dot.style.opacity='1';return true;
    };
    if(collapsed){pillAt();return;}
    const ti=topIdx.indexOf(i),bi=botIdx.indexOf(i);
    let x:number,y:number,top=true;
    const h=el.offsetHeight;
    if(ti>=0){x=Math.round(cxs[slots[ti]]-CW/2);y=GAP;}
    else if(bi>=0){const right=botIdx.length===1?p.x>W/2:bi===1;x=right?W-GAP-CW:GAP;y=H-h-GAP-52;top=false;}
    else{hide(i);return;}
    // a full card that would sit on top of the hardware it labels drops to a pill beside its anchor
    const crc=scene.contentRect?.();
    if(crc&&x<crc.x+crc.w-8&&x+CW>crc.x+8&&y<crc.y+crc.h-8&&y+h>crc.y+8){pillAt();return;}
    el.dataset.pill='false';
    el.style.transform=`translate(${x}px,${y}px)`;
    const cx=Math.round(x+CW/2);
    const y0=top?y+h:y;
    // orthogonal elbow: vertical from the card edge midpoint, one 90 degree bend, ends exactly on the hotspot
    // flip the elbow (horizontal run at the card edge, vertical drop onto the hotspot) when V-then-H would cut across the hardware
    const cr=scene.contentRect?.();
    const hitsH=cr&&p.y>cr.y+6&&p.y<cr.y+cr.h-6&&Math.max(Math.min(cx,p.x),cr.x+6)<Math.min(Math.max(cx,p.x),cr.x+cr.w-6);
    const d=hitsH?`M${cx} ${y0}H${p.x.toFixed(1)}V${p.y.toFixed(1)}`:`M${cx} ${y0}V${p.y.toFixed(1)}H${p.x.toFixed(1)}`;
    pa.setAttribute('d',d);pa.style.opacity='1';
   });
  });
 },[api,lesson,pills,show,compact]);
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
