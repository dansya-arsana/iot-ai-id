/**
 * live_part_lookup: unverified distributor search (LCSC Open API, JLC Open API). Results are NEVER stored or cached; the dispatcher
 * wraps `description` as untrusted. Each adapter is off unless its env keys exist; both off -> {available:false}.
 * LCSC: LCSC_API_KEY + LCSC_API_SECRET. JLC: JLC_APP_ID + JLC_ACCESS_KEY + JLC_SECRET_KEY (HMAC-SHA256 signed).
 * Endpoints are overridable (LCSC_API_URL, JLC_API_URL) because the vendor contracts are per-account; verify against your key's docs.
 */
import {createHash,createHmac,randomBytes} from 'node:crypto';
export type LiveItem={mpn:string;manufacturer:string;description:string;lcsc?:string;stock?:number;priceUsd?:number;datasheetUrl?:string};
export type LiveLookupInput={q:string;mpn?:string;limit:number};
export type LiveLookupOutput={available:boolean;source:string;items:LiveItem[];attribution:string};
type Env=Record<string,string|undefined>;
const TIMEOUT_MS=8000;
// eslint-disable-next-line no-control-regex
const str=(v:unknown,n:number)=>typeof v==='string'?v.replace(/[\u0000-\u001F\u007F]/g,' ').trim().slice(0,n):'';
const num=(v:unknown)=>{const n=typeof v==='number'?v:typeof v==='string'?Number(v):NaN;return Number.isFinite(n)&&n>=0?n:undefined;};
const httpsUrl=(v:unknown)=>{const s=str(v,300);try{return new URL(s).protocol==='https:'?s:undefined;}catch{return undefined;}};
const arr=(v:unknown):Record<string,unknown>[]=>Array.isArray(v)?v.filter((x):x is Record<string,unknown>=>!!x&&typeof x==='object'):[];
const get=(o:unknown,...k:string[]):unknown=>k.reduce((a:any,c)=>a&&typeof a==='object'?a[c]:undefined,o);
async function call(f:typeof fetch,url:string,init:RequestInit){
 const ac=new AbortController(),t=setTimeout(()=>ac.abort(),TIMEOUT_MS);
 try{const r=await f(url,{...init,signal:ac.signal});if(!r.ok)throw new Error('HTTP '+r.status);return await r.json();}finally{clearTimeout(t);}
}
const cut=(items:LiveItem[],n:number)=>items.filter(i=>i.mpn).slice(0,n);

/** LCSC: signature = sha1 of "key=..&nonce=..&secret=..&timestamp=.." (their documented scheme for key/secret accounts). */
export async function lcscSearch(input:LiveLookupInput,env:Env,f:typeof fetch):Promise<LiveItem[]>{
 const key=env.LCSC_API_KEY!,secret=env.LCSC_API_SECRET??'',nonce=randomBytes(8).toString('hex'),ts=String(Math.floor(Date.now()/1000));
 const signature=createHash('sha1').update(`key=${key}&nonce=${nonce}&secret=${secret}&timestamp=${ts}`).digest('hex');
 const u=new URL(env.LCSC_API_URL??'https://ips.lcsc.com/rest/wmsc2agent/search/product');
 for(const [k,v] of Object.entries({key,nonce,timestamp:ts,signature,keyword:input.mpn??input.q,current_page:'1',page_size:String(input.limit)}))u.searchParams.set(k,v);
 const j=await call(f,u.toString(),{method:'GET',headers:{accept:'application/json'}});
 return cut(arr(get(j,'result','productSearchResultVO','productList')??get(j,'result','data')).map(p=>({mpn:str(p.productModel??p.mpn,60),manufacturer:str(p.brandNameEn??p.manufacturer,60),description:str(p.productIntroEn??p.description,300),lcsc:str(p.productCode,20)||undefined,stock:num(p.stockNumber),priceUsd:num(get(p,'productPriceList',0 as any,'usdPrice')),datasheetUrl:httpsUrl(p.pdfUrl)})),input.limit);
}

/** JLC Open API: header `Authorization: JOP appid=...,accesskey=...,timestamp=...,nonce=...,signature=...`; signature = base64(HMAC-SHA256(secret, METHOD\nPATH\nTIMESTAMP\nNONCE\nBODY\n)). */
export async function jlcSearch(input:LiveLookupInput,env:Env,f:typeof fetch):Promise<LiveItem[]>{
 const base=new URL(env.JLC_API_URL??'https://open.jlcpcb.com/overseas/openapi/component/getComponentInfos'),
  body=JSON.stringify({keyword:input.mpn??input.q,pageSize:input.limit,currentPage:1}),ts=String(Math.floor(Date.now()/1000)),nonce=randomBytes(16).toString('hex');
 const sig=createHmac('sha256',env.JLC_SECRET_KEY??'').update(`POST\n${base.pathname}\n${ts}\n${nonce}\n${body}\n`).digest('base64');
 const j=await call(f,base.toString(),{method:'POST',headers:{'content-type':'application/json',accept:'application/json',authorization:`JOP appid="${env.JLC_APP_ID}",accesskey="${env.JLC_ACCESS_KEY??''}",timestamp="${ts}",nonce="${nonce}",signature="${sig}"`},body});
 return cut(arr(get(j,'data','componentInfos')??get(j,'data','list')).map(p=>({mpn:str(p.componentModelEn??p.mpn,60),manufacturer:str(p.componentBrandEn??p.manufacturer,60),description:str(p.describe??p.description,300),lcsc:str(p.lcscPart??p.componentCode,20)||undefined,stock:num(p.stockCount??p.stock),priceUsd:num(get(p,'componentPrices',0 as any,'productPrice')),datasheetUrl:httpsUrl(p.dataManualUrl)})),input.limit);
}

export async function liveLookup(input:LiveLookupInput,env:Env=process.env,fetchImpl:typeof fetch=fetch):Promise<LiveLookupOutput>{
 const lcsc=!!env.LCSC_API_KEY&&!!env.LCSC_API_SECRET,jlc=!!env.JLC_APP_ID&&!!env.JLC_ACCESS_KEY&&!!env.JLC_SECRET_KEY;
 if(!lcsc&&!jlc)return{available:false,source:'none',items:[],attribution:''};
 const sources:string[]=[];let items:LiveItem[]=[];
 for(const [on,name,fn] of [[lcsc,'LCSC',lcscSearch],[jlc,'JLCPCB',jlcSearch]]as const){
  if(!on||items.length>=input.limit)continue;
  try{const r=await fn(input,env,fetchImpl);if(r.length){items=items.concat(r);sources.push(name);}}catch{/* one adapter down must not hide the other */}
 }
 items=items.slice(0,input.limit);
 return{available:true,source:sources.join('+')||(lcsc?'LCSC':'JLCPCB'),items,attribution:sources.length?'Live data from '+sources.join(' and ')+'. Unverified, not stored; confirm on the datasheet.':'No live result. Unverified, not stored.'};
}
