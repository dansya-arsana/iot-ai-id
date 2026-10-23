/** Self-contained SVG export: computed styles are inlined so the file renders outside the app (tokens resolved). */
const PROPS=['fill','stroke','stroke-width','stroke-dasharray','stroke-linecap','stroke-linejoin','opacity','fill-opacity','font-family','font-size','font-weight','letter-spacing','text-anchor','dominant-baseline'];
export function serializeSvg(svg:SVGSVGElement,title:string):string{
 const clone=svg.cloneNode(true) as SVGSVGElement;
 const src=[svg,...svg.querySelectorAll<SVGElement>('*')],dst=[clone,...clone.querySelectorAll<SVGElement>('*')];
 src.forEach((el,i)=>{
  const cs=getComputedStyle(el),d=dst[i];
  d.removeAttribute('class');
  if(el!==svg)for(const p of PROPS){const v=cs.getPropertyValue(p);if(v)d.style.setProperty(p,v);}
 });
 clone.setAttribute('xmlns','http://www.w3.org/2000/svg');
 clone.removeAttribute('style');clone.removeAttribute('data-testid');
 const w=svg.viewBox.baseVal.width,h=svg.viewBox.baseVal.height;
 clone.setAttribute('width',String(w));clone.setAttribute('height',String(h));
 clone.querySelectorAll('title').forEach(t=>t.remove());
 const t=document.createElementNS('http://www.w3.org/2000/svg','title');t.textContent=title;clone.insertBefore(t,clone.firstChild);
 return `<?xml version="1.0" encoding="UTF-8"?>\n${new XMLSerializer().serializeToString(clone)}`;
}
export function downloadSvg(svg:SVGSVGElement,name:string,title:string){
 const url=URL.createObjectURL(new Blob([serializeSvg(svg,title)],{type:'image/svg+xml'}));
 const a=document.createElement('a');a.href=url;a.download=name;document.body.appendChild(a);a.click();a.remove();
 setTimeout(()=>URL.revokeObjectURL(url),1000);
}
