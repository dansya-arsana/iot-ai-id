/** Ops service (ADR 009): public intake (inquiry form, catalog, Lab Mitra board) plus owner-token admin routes for the API proxy. */
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
  // nginx sets X-Real-IP from Cloudflare's CF-Connecting-IP; the socket address is the fallback for direct access.
  const ip=String(req.headers['x-real-ip']??req.socket.remoteAddress??'unknown');
  const result=await ops.handle({method:req.method??'GET',path,body,ip,admin:admin?{user:String(req.headers['x-ops-user']??'')}:undefined});
  if(!result){send(404,{error:'Not found'});return;}
  send(result.status,result.data);
 }catch(error){console.error(error);send(500,{error:'Internal error'});}
}).listen(port,host,()=>console.log(`ops: listening on ${host}:${port} (admin ${token?'enabled':'disabled'})`));
