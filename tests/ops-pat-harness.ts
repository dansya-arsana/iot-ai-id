/** Shared harness for the token and remote MCP tests: ops in memory, Pro installed without a compiler, an owner and members with chosen grants. */
import {Ops,OpsStore,RateLimit} from '../services/ops/ops.js';
import {staffInvite} from '../services/ops/cli.js';
import {installPro} from '../services/ops/pro-wiring.js';

type R={status:number;data:any;setCookie?:string|string[]};
export async function patHarness(){
 const clock={t:Date.parse('2026-10-28T00:00:00Z')};
 const ops=new Ops(new OpsStore(':memory:'),new Map(),new RateLimit(),()=>new Date(clock.t));
 installPro(ops,{compiler:false});
 await staffInvite(ops,['daniel','owner','daniel person']);
 const admin=async(method:string,path:string,body?:unknown):Promise<R>=>(await ops.handle({method,path:'/ops/v1/admin/'+path,body,ip:'9.9.9.9',admin:{user:'daniel'}}))as R;
 const member=async(cookie:string,method:string,path:string,body?:unknown):Promise<R>=>(await ops.handle({method,path:'/ops/v1/member/'+path,body,ip:'7.7.7.7',headers:{cookie:`aiot_member=${cookie}`,'x-aiot-member':'1'}}))as R;
 async function join(username:string,grants:string[]){
  const r=await admin('POST','members',{username,name:`${username} member`,orgName:'X',grants});
  const a=(await ops.handle({method:'POST',path:'/ops/v1/member/activate',body:{code:r.data.inviteCode,password:'a long member password'},ip:'7.7.7.7',headers:{'x-aiot-member':'1'}}))as R;
  const session=/aiot_member=([^;]*)/.exec([a.setCookie??[]].flat().join('\n'))?.[1]??'';
  return{id:r.data.member.id as string,session};
 }
 return{ops,clock,admin,member,join};
}

