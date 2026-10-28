/** Site plan layout: pure geometry from SystemSpec (no DOM, no React). Plan metres, gateway at (0,0), y down. */
import type {SystemSpec} from '../../../../../packages/pro-contract/system-spec';

export const MARGIN_TARGET_DB=18;
export type Pt={x:number;y:number};
export type PlanField={id:string;name:string;crop:string;letter:string;areaM2:number;label:string;x:number;y:number;w:number;h:number;px:Pt[];nodeId?:string};
export type PlanNode={id:string;tag:string;role:'field'|'gateway'|'repeater'|'device';fieldId?:string;at:Pt;warn:boolean};
export type PlanLink={id:string;tag:string;from:string;to:string;medium:string;distanceM:number;marginDb?:number;low:boolean;a:Pt;b:Pt;mid:Pt;angleDeg:number;text:string};
export type SitePlanLayout={view:{minX:number;minY:number;w:number;h:number};scale:number;fields:PlanField[];nodes:PlanNode[];links:PlanLink[];gateway:Pt;gridM:number;bar:{m:number;len:number}};

export const fmtArea=(m2:number)=>m2>=1000?`${(m2/10000).toFixed(2)} ha`:`${Math.round(m2)} m²`;
const NICE=[10,20,25,50,100,200,250,500,1000];
const niceBar=(span:number)=>NICE.reduce((b,n)=>n<=span/4?n:b,NICE[0]);
const pillText=(tag:string,d:number,m:number|undefined,medium:string)=>{
 const dist=`${Math.round(d)} m`;
 if(medium==='lora'&&m!==undefined)return `${tag} · ${dist} · ${m>=0?'+':''}${Math.round(m)} dB`;
 return `${tag} · ${medium==='wifi'?'Wi-Fi':medium} · ${dist}`;
};

export function layoutSitePlan(spec:Pick<SystemSpec,'site'|'fields'|'nodes'|'links'|'checks'>,opts:{width?:number}={}):SitePlanLayout{
 const {widthM,heightM}=spec.site.plan??{widthM:1,heightM:1}; // a device has no plan; the site plan is not shown for it
 const pad=Math.max(widthM,heightM)*0.04;
 const view={minX:-widthM/2-pad,minY:-heightM/2-pad,w:widthM+2*pad,h:heightM+2*pad};
 const scale=(opts.width??1000)/view.w;
 const warnNodes=new Set<string>();
 for(const c of spec.checks)if(c.severity!=='info'){
  if(c.scope.nodeId)warnNodes.add(c.scope.nodeId);
  if(c.scope.fieldId){const n=spec.nodes.find(n=>n.fieldId===c.scope.fieldId);if(n)warnNodes.add(n.id);}
  if(c.scope.linkId){const l=spec.links.find(l=>l.id===c.scope.linkId);if(l){warnNodes.add(l.from);warnNodes.add(l.to);}}
 }
 const fields:PlanField[]=spec.fields.map((f,i)=>{
  const {x,y,w,h}=f.plan;
  return {id:f.id,name:f.name,crop:f.crop,letter:String.fromCharCode(65+i%26),areaM2:f.areaM2,label:`${String.fromCharCode(65+i%26)} ${f.name}`,x,y,w,h,
   px:[{x,y},{x:x+w,y},{x:x+w,y:y+h},{x,y:y+h}],nodeId:spec.nodes.find(n=>n.fieldId===f.id)?.id};
 });
 const byField=new Map(fields.map(f=>[f.id,f]));
 let fn=0,rn=0;
 const nodes:PlanNode[]=spec.nodes.map(n=>{
  const f=n.fieldId?byField.get(n.fieldId):undefined;
  const at=n.role==='gateway'?{x:0,y:0}:f?{x:f.x+f.w/2,y:f.y+f.h/2}:{x:0,y:0};
  const tag=n.role==='gateway'?'GW':n.role==='repeater'?`R${++rn}`:n.role==='device'?'DV':`N${++fn}`;
  return {id:n.id,tag,role:n.role,fieldId:n.fieldId,at,warn:warnNodes.has(n.id)};
 });
 const byNode=new Map(nodes.map(n=>[n.id,n]));
 const links:PlanLink[]=spec.links.flatMap((l,i)=>{
  const a=byNode.get(l.from),b=byNode.get(l.to);
  if(!a||!b)return [];
  const tag=`L${i+1}`,m=l.estimate.marginDb;
  let ang=Math.atan2(b.at.y-a.at.y,b.at.x-a.at.x)*180/Math.PI;
  if(ang>90)ang-=180;if(ang<-90)ang+=180;                 // keep pill text upright
  return [{id:l.id,tag,from:l.from,to:l.to,medium:l.params.medium,distanceM:l.distanceM,marginDb:m,
   low:m!==undefined&&m<MARGIN_TARGET_DB||!l.estimate.ok,a:a.at,b:b.at,mid:{x:(a.at.x+b.at.x)/2,y:(a.at.y+b.at.y)/2},angleDeg:ang,text:pillText(tag,l.distanceM,m,l.params.medium)}];
 });
 const barM=niceBar(widthM);
 return {view,scale,fields,nodes,links,gateway:{x:0,y:0},gridM:barM,bar:{m:barM,len:barM*scale}};
}

/** Hit radius helpers kept pure so tests can check selection targets. */
export const pointInField=(f:Pick<PlanField,'x'|'y'|'w'|'h'>,p:Pt)=>p.x>=f.x&&p.x<=f.x+f.w&&p.y>=f.y&&p.y<=f.y+f.h;
