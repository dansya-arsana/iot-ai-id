/** Ops CLI. Bootstraps staff logins: `node --import tsx services/ops/cli.ts staff-invite <username> <role> [name] [--force]`. Uses OPS_DB; prints only the invite code and its expiry. */
import {pathToFileURL} from 'node:url';
import {ROLES,StaffInputSchema} from '../../packages/ops-contract/index.js';
import {Ops,OpsStore} from './ops.js';

const USAGE=`Usage: node --import tsx services/ops/cli.ts staff-invite <username> <role: ${ROLES.join('|')}> [name] [--force]`;

/** Creates the staff account, or resets the invite of an existing active one. Throws with a readable message on refusal. */
export async function staffInvite(ops:Ops,args:string[],force=false){
 const [usernameArg,role,...nameParts]=args;
 if(!usernameArg||!role)throw new Error(USAGE);
 if(!(ROLES as readonly string[]).includes(role))throw new Error(`Unknown role ${role}. ${USAGE}`);
 const username=usernameArg.trim().toLowerCase(),dir=ops.staff,existing=dir.byUsername(username);
 if(existing){
  if(existing.status!=='active')throw new Error(`${username} is disabled. Enable them in the Team section first.`);
  if(existing.role!==role)throw new Error(`${username} already exists as ${existing.role}. Change the role in the Team section.`);
  const r=await dir.resetInvite(existing,'cli');return r;
 }
 const input=StaffInputSchema.safeParse({username,role,name:nameParts.join(' ')||username});
 if(!input.success)throw new Error(input.error.issues[0]?.message??'Invalid input');
 return dir.create(input.data,'cli',{force});
}

async function main(){
 const argv=process.argv.slice(2),force=argv.includes('--force'),args=argv.filter(a=>a!=='--force');
 if(args[0]!=='staff-invite'){console.error(USAGE);process.exit(2);}
 const ops=new Ops(new OpsStore(process.env.OPS_DB??'.data/ops.sqlite'));
 try{
  const r=await staffInvite(ops,args.slice(1),force);
  console.log(`invite: ${r.inviteCode}\nexpires: ${r.staff.inviteExpires}`);
 }catch(error){console.error(error instanceof Error?error.message:String(error));process.exit(1);}
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href)void main();
