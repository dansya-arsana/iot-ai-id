/** Ops service (ADR 009, 010): public intake (inquiry form, catalog, Lab Mitra board, school portal at /ops/v1/portal/*, staff login at /ops/v1/staff/*, member login at /ops/v1/member/*) plus owner-token admin routes for the API proxy. */
import {createServer} from 'node:http';
import {timingSafeEqual} from 'node:crypto';
import {parseRoles} from '../../packages/ops-contract/index.js';
import {Ops,OpsStore} from './ops.js';

const port=Number(process.env.OPS_PORT??8791),host=process.env.OPS_HOST??'127.0.0.1';
const token=process.env.OPS_OWNER_TOKEN??'';
if(token&&token.length<32)throw new Error('OPS_OWNER_TOKEN must be at least 32 characters');
const ops=new Ops(new OpsStore(process.env.OPS_DB??'.data/ops.sqlite'),parseRoles(process.env.OPS_ROLES));
const bearer=(header:string|undefined)=>{if(!token||!header?.startsWith('Bearer '))return false;const given=Buffer.from(header.slice(7)),expected=Buffer.from(token);return given.length===expected.length&&timingSafeEqual(given,expected);};

createServer(async(req,res)=>{
 const send=(status:number,data:unknown)=>{res.writeHead(status,{'Content-Type':'application/json','Cache-Control':'no-store','X-Content-Type-Options':'nosniff'});res.end(JSON.stringify(data));};
 try{
  const path=new URL(req.url??'/','http://ops').pathname;
  if(path==='/health'&&req.method==='GET'){send(200,{status:'ok',admin:token?'enabled':'disabled'});return;}
  const admin=path.startsWith('/ops/v1/admin/');
  if(admin&&!bearer(req.headers.authorization)){send(token?401:503,{error:token?'Admin authorization required':'Admin routes are disabled: OPS_OWNER_TOKEN is not set'});return;}
  let text='';for await(const chunk of req){text+=chunk;if(text.length>20_000){send(413,{error:'Request too large'});return;}}
  let body:unknown;try{body=text?JSON.parse(text):undefined;}catch{send(400,{error:'Invalid JSON'});return;}
  // X-Real-IP is trusted only because this service binds to the internal docker network or loopback behind nginx. Never publish OPS_HOST: a direct caller could forge the header and dodge the per-IP limits.
  // nginx sets X-Real-IP from Cloudflare's CF-Connecting-IP; the socket address is the fallback for direct access.
  const ip=String(req.headers['x-real-ip']??req.socket.remoteAddress??'unknown');
  // Plain-http requests straight from this machine (no proxy header) may omit the Secure cookie flag; nginx always sets X-Forwarded-Proto.
  const plainLoopback=!req.headers['x-forwarded-proto']&&/^(127\.|::1$|::ffff:127\.)/.test(req.socket.remoteAddress??'');
  const headers={cookie:req.headers.cookie,'x-aiot-portal':String(req.headers['x-aiot-portal']??''),'x-aiot-staff':String(req.headers['x-aiot-staff']??''),'x-aiot-member':String(req.headers['x-aiot-member']??''),origin:req.headers.origin};
  const result=await ops.handle({method:req.method??'GET',path,body,ip,admin:admin?{user:String(req.headers['x-ops-user']??'')}:undefined,headers,plainLoopback});
  if(!result){send(404,{error:'Not found'});return;}
  if(result.text){res.writeHead(result.status,{'Content-Type':result.text.type,'Cache-Control':'no-store','X-Content-Type-Options':'nosniff',...(result.text.filename?{'Content-Disposition':`attachment; filename="${result.text.filename}"`}:{})});res.end(result.text.body);return;}
  if(result.status===204){res.writeHead(204,{'Cache-Control':'no-store',...result.headers});res.end();return;}
  if(result.redirect){res.writeHead(302,{Location:result.redirect,'Cache-Control':'no-store'});res.end();return;}
  if(result.setCookie)res.setHeader('Set-Cookie',result.setCookie);
  for(const[k,v]of Object.entries(result.headers??{}))res.setHeader(k,v);
  send(result.status,result.data);
 }catch(error){console.error(error);send(500,{error:'Internal error'});}
}).listen(port,host,()=>console.log(`ops: listening on ${host}:${port} (admin ${token?'enabled':'disabled'})`));
