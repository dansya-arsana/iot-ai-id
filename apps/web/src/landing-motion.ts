/** Baseline's mass-one spring, with 1ms integration and a finite frame lifetime. */
export function mountLandingMotion(root:HTMLElement){
 const reduced=window.matchMedia('(prefers-reduced-motion: reduce)').matches;
 const content=Array.from(root.querySelectorAll<HTMLElement>('.rl-header, main, .rl-footer'));
 const previousOverflow=document.body.style.overflow;
 if(!reduced){document.body.style.overflow='hidden';content.forEach(el=>el.inert=true);}
 const timers:number[]=[];const cancels:Array<()=>void>=[];let disposed=false;
 const later=(fn:()=>void,delay:number)=>{timers.push(window.setTimeout(()=>{if(!disposed)fn();},delay));};
 function spring(el:HTMLElement,delay=0){
  if(reduced){el.style.opacity='1';el.style.transform='none';return;}
  el.style.opacity='0';el.style.transform='translate3d(0,32px,0)';
  later(()=>{let x=el.classList.contains('rl-header')?-32:48,v=0,last=0,frame=0;const start=performance.now();
   const tick=(now:number)=>{const dt=last?Math.min(now-last,64):16;last=now;for(let i=0;i<Math.ceil(dt);i++){v+=-180*.000001*x-26*.001*v;x+=v;}
    el.style.transform=`translate3d(0,${x}px,0)`;el.style.opacity=String(Math.min(1,(now-start)/400));
    if((Math.abs(x)<.032&&Math.abs(v)<.0032)||now-start>2200){el.style.transform='none';el.style.opacity='1';}else frame=requestAnimationFrame(tick);};
   frame=requestAnimationFrame(tick);cancels.push(()=>cancelAnimationFrame(frame));
  },delay);
 }
 const loader=root.querySelector<HTMLElement>('.rl-loader');
 const observer=new IntersectionObserver(entries=>entries.forEach(entry=>{if(entry.isIntersecting){spring(entry.target as HTMLElement);observer.unobserve(entry.target);}}),{threshold:.12});
 const begin=()=>{
  root.dataset.ready='true';document.body.style.overflow=previousOverflow;content.forEach(el=>el.inert=false);
  root.querySelectorAll<HTMLElement>('[data-enter]').forEach((el,i)=>spring(el,i*75));
  root.querySelectorAll<HTMLElement>('[data-reveal]').forEach(el=>reduced?spring(el):observer.observe(el));
  if(loader){loader.classList.add('rl-loader-exit');later(()=>loader.hidden=true,reduced?0:850);}
 };
 if(reduced)begin();else{
  const started=performance.now();let exited=false;const exit=()=>{if(exited)return;exited=true;later(begin,Math.max(0,1400-(performance.now()-started)));};
  const image=root.querySelector<HTMLImageElement>('.rl-robot');if(image?.complete)exit();else image?.addEventListener('load',exit,{once:true});
  later(exit,2600);cancels.push(()=>image?.removeEventListener('load',exit));
 }
 return()=>{disposed=true;document.body.style.overflow=previousOverflow;content.forEach(el=>el.inert=false);timers.forEach(clearTimeout);cancels.forEach(fn=>fn());observer.disconnect();};
}
