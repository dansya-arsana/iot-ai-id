/** Transport helpers shared by the ops server and the local api: query-string routes and Server-Sent Events for Pro turns. */
import type {IncomingMessage,ServerResponse} from 'node:http';

/** Routes that read their own query string (catalog search and filters). Every other route sees the bare pathname. */
export const wantsQuery=(path:string)=>path.startsWith('/ops/v1/catalog/')||path.startsWith('/ops/v1/member/catalog/');
export function opsPath(url:string|undefined):{path:string;routed:string}{
 const u=new URL(url??'/','http://ops');
 return{path:u.pathname,routed:wantsQuery(u.pathname)?u.pathname+u.search:u.pathname};
}
/** Request body caps in bytes. Pro tool results from the browser can be large; everything else stays small. */
export const bodyLimit=(path:string)=>path.startsWith('/ops/v1/member/pro/')?262_144:path.startsWith('/ops/v1/lab/')||path.startsWith('/ops/v1/member/lab/')?64_000:20_000;

/** A result with a `stream(write,end)` function is SSE: pipe frames until the loop ends or the client leaves. Returns true when handled. */
export function pipeOpsStream(req:IncomingMessage,res:ServerResponse,result:{status:number;headers?:Record<string,string>}&{stream?:unknown}):boolean{
 const start=result.stream as ((write:(f:string)=>void,end:()=>void)=>()=>void)|undefined;
 if(typeof start!=='function')return false;
 res.writeHead(result.status,{'Cache-Control':'no-cache, no-transform','X-Content-Type-Options':'nosniff','X-Accel-Buffering':'no',...result.headers});
 res.flushHeaders();
 let off=()=>{};
 off=start(frame=>{if(!res.writableEnded)res.write(frame);},()=>{if(!res.writableEnded)res.end();});
 req.on('close',()=>off());
 return true;
}
