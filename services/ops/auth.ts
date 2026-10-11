/** Shared login core (ADR 010, 009): invite codes, scrypt passwords, lockout and sessions. Subjects are school people (portal) and staff (admin host); both live in the same tables, keyed by a UUID, so usernames are unique across them. */
import {randomBytes,randomInt,scrypt,timingSafeEqual,createHash} from 'node:crypto';
import {promisify} from 'node:util';
import type {OpsStore} from './ops.js';
import {fail} from './http.js';

const ALPHABET='ABCDEFGHJKMNPQRSTUVWXYZ23456789';// No 0/O/1/I/L: invite codes are read aloud and typed by hand.
export const INVITE_DAYS=7;
const LOCK_AFTER=5,PERSON_LOCK_AFTER=30,LOCK_MS=15*60_000,SESSION_MS=12*3_600_000,IDLE_MS=2*3_600_000,TOUCH_MS=60_000,MAX_SESSIONS=5;
const scryptAsync=promisify(scrypt) as (secret:string,salt:Buffer,keylen:number)=>Promise<Buffer>;
/** Async scrypt so password and invite checks never block the event loop. */
export const hashSecret=async(secret:string)=>{const salt=randomBytes(16);return `${salt.toString('hex')}$${(await scryptAsync(secret,salt,32)).toString('hex')}`;};
export const verifySecret=async(secret:string,stored:string)=>{const [salt,hash]=stored.split('$');if(!salt||!hash)return false;const a=await scryptAsync(secret,Buffer.from(salt,'hex'),32),b=Buffer.from(hash,'hex');return a.length===b.length&&timingSafeEqual(a,b);};
let dummy:Promise<string>|undefined;
/** Unknown, locked and not-yet-activated accounts still cost one scrypt, so timing does not reveal the account state. */
const burn=async(secret:string)=>{await verifySecret(secret,await(dummy??=hashSecret('timing-equalizer')));};
const sha=(s:string)=>createHash('sha256').update(s).digest('hex');
export const chars=(n:number)=>Array.from({length:n},()=>ALPHABET[randomInt(ALPHABET.length)]).join('');

type Login={person_id:string;username:string;pass_hash:string|null;invite_id:string|null;invite_hash:string|null;invite_expires:number;failed:number;locked_until:number};
export type Invite={secret:string;hash:string};

export class Auth{
 constructor(readonly store:OpsStore,readonly clock:()=>Date){
  const db=store.db;
  db.exec(`CREATE TABLE IF NOT EXISTS logins(person_id TEXT PRIMARY KEY,username TEXT NOT NULL UNIQUE,pass_hash TEXT,invite_hash TEXT,invite_expires INTEGER NOT NULL DEFAULT 0,failed INTEGER NOT NULL DEFAULT 0,locked_until INTEGER NOT NULL DEFAULT 0);
CREATE TABLE IF NOT EXISTS sessions(token_hash TEXT PRIMARY KEY,person_id TEXT NOT NULL,expires_at INTEGER NOT NULL);
CREATE TABLE IF NOT EXISTS login_fails(person_id TEXT NOT NULL,ip TEXT NOT NULL,failed INTEGER NOT NULL DEFAULT 0,locked_until INTEGER NOT NULL DEFAULT 0,PRIMARY KEY(person_id,ip));`);
  const has=(table:string,col:string)=>(db.prepare(`PRAGMA table_info(${table})`).all() as {name:string}[]).some(r=>r.name===col);
  if(!has('logins','invite_id'))db.exec('ALTER TABLE logins ADD COLUMN invite_id TEXT');
  if(!has('sessions','last_seen'))db.exec('ALTER TABLE sessions ADD COLUMN last_seen INTEGER NOT NULL DEFAULT 0');
  db.exec('CREATE INDEX IF NOT EXISTS logins_invite ON logins(invite_id);CREATE INDEX IF NOT EXISTS sessions_person ON sessions(person_id)');
 }
 private get db(){return this.store.db;}
 now(){return this.clock().getTime();}
 private login(id:string){return this.db.prepare('SELECT * FROM logins WHERE person_id=?').get(id) as Login|undefined;}
 usernameTaken(username:string){return !!this.db.prepare('SELECT 1 FROM logins WHERE username=?').get(username);}
 /** Call inside the transaction that creates the subject. */
 create(id:string,username:string){this.db.prepare('INSERT INTO logins(person_id,username) VALUES(?,?)').run(id,username);}
 /** Whether the subject has set a password, and when a pending invite expires. */
 state(id:string){const l=this.login(id);return{activated:!!l?.pass_hash,...(l?.invite_hash&&l.invite_expires>this.now()?{inviteExpires:new Date(l.invite_expires).toISOString()}:{})};}

 /** Invite code `<4-char lookup id>-<10-char secret>`: the id is stored plain and indexed, only the secret is scrypt-hashed, so activation costs one scrypt. */
 async newInvite():Promise<Invite>{const secret=chars(10);return{secret,hash:await hashSecret(secret)};}
 storeInvite(id:string,inv:Invite){
  let code:string;do code=chars(4);while(this.db.prepare('SELECT 1 FROM logins WHERE invite_id=?').get(code));
  this.db.prepare('UPDATE logins SET invite_id=?,invite_hash=?,invite_expires=? WHERE person_id=?').run(code,inv.hash,this.now()+INVITE_DAYS*86_400_000,id);return `${code}-${inv.secret}`;
 }
 /** New invite code; clears the password, lockouts and sessions. Call inside a transaction. */
 reissue(id:string,inv:Invite){const code=this.storeInvite(id,inv);this.db.prepare('UPDATE logins SET pass_hash=NULL,failed=0,locked_until=0 WHERE person_id=?').run(id);this.db.prepare('DELETE FROM login_fails WHERE person_id=?').run(id);this.db.prepare('DELETE FROM sessions WHERE person_id=?').run(id);return code;}
 /** Disabling: ends sessions and voids any open invite. Call inside a transaction. */
 revoke(id:string){this.db.prepare('DELETE FROM sessions WHERE person_id=?').run(id);this.db.prepare('UPDATE logins SET invite_hash=NULL WHERE person_id=?').run(id);}

 /** Invite code plus a new password. One indexed lookup, one scrypt for the secret, one for the password. `load` returns the active subject for an id; `finish` records it inside the transaction. */
 async activate<T>(code:string,password:string,load:(id:string)=>T|undefined,finish:(fresh:T,at:string)=>void):Promise<T|undefined>{
  const [id,secret]=code.split('-');
  const l=this.db.prepare('SELECT * FROM logins WHERE invite_id=? AND invite_hash IS NOT NULL AND invite_expires>?').get(id??'',this.now()) as Login|undefined;
  if(!l||!await verifySecret(secret??'',l.invite_hash!)){if(!l)await burn(secret??'');return undefined;}
  if(!load(l.person_id))return undefined;
  const hash=await hashSecret(password);
  // The awaits above may have let another request change the invite or the subject: re-read and compare inside the transaction.
  return this.store.tx(()=>{
   const cur=this.login(l.person_id),fresh=load(l.person_id);
   if(!cur||cur.invite_id!==l.invite_id||cur.invite_hash!==l.invite_hash||cur.invite_expires<=this.now()||!fresh)return fail(409,'This invite code was just used or changed. Ask for a new one.');
   const r=this.db.prepare('UPDATE logins SET pass_hash=?,invite_id=NULL,invite_hash=NULL,failed=0,locked_until=0 WHERE person_id=? AND invite_id=? AND invite_hash=?').run(hash,l.person_id,l.invite_id,l.invite_hash);
   if(Number(r.changes)!==1)return fail(409,'This invite code was just used or changed. Ask for a new one.');
   finish(fresh,this.clock().toISOString());return fresh;
  });
 }
 /** Five failures lock a (person, IP) pair for 15 minutes; 30 failures across all IPs lock the person. Locked, unknown and unactivated accounts all cost one scrypt. */
 async authenticate<T>(username:string,password:string,ip:string,load:(id:string)=>T|undefined):Promise<T|undefined>{
  const l=this.db.prepare('SELECT * FROM logins WHERE username=?').get(username.trim().toLowerCase()) as Login|undefined;
  const now=this.now();const pair=l?this.db.prepare('SELECT * FROM login_fails WHERE person_id=? AND ip=?').get(l.person_id,ip) as {failed:number;locked_until:number}|undefined:undefined;
  if(!l||!l.pass_hash||l.locked_until>now||(pair?.locked_until??0)>now){await burn(password);return undefined;}
  if(!await verifySecret(password,l.pass_hash)){
   this.db.prepare('INSERT INTO login_fails(person_id,ip,failed,locked_until) VALUES(?,?,1,0) ON CONFLICT(person_id,ip) DO UPDATE SET failed=failed+1').run(l.person_id,ip);
   this.db.prepare('UPDATE logins SET failed=failed+1 WHERE person_id=?').run(l.person_id);
   const pf=this.db.prepare('SELECT failed FROM login_fails WHERE person_id=? AND ip=?').get(l.person_id,ip) as {failed:number},tf=this.db.prepare('SELECT failed FROM logins WHERE person_id=?').get(l.person_id) as {failed:number};
   if(pf.failed>=LOCK_AFTER)this.db.prepare('UPDATE login_fails SET failed=0,locked_until=? WHERE person_id=? AND ip=?').run(now+LOCK_MS,l.person_id,ip);
   if(tf.failed>=PERSON_LOCK_AFTER)this.db.prepare('UPDATE logins SET failed=0,locked_until=? WHERE person_id=?').run(now+LOCK_MS,l.person_id);
   return undefined;
  }
  const p=load(l.person_id);if(!p)return undefined;
  this.db.prepare('UPDATE logins SET failed=0,locked_until=0 WHERE person_id=?').run(l.person_id);this.db.prepare('DELETE FROM login_fails WHERE person_id=?').run(l.person_id);return p;
 }

 private lastPurge=0;
 private purge(now:number){this.lastPurge=now;this.db.prepare('DELETE FROM sessions WHERE expires_at<? OR last_seen<?').run(now,now-IDLE_MS);}
 /** Random 32-byte token; only its sha256 is stored. Expired sessions are purged, and a subject keeps at most 5 active ones (oldest dropped). */
 startSession(id:string){
  const token=randomBytes(32).toString('base64url');const now=this.now();this.purge(now);
  this.db.prepare('INSERT INTO sessions(token_hash,person_id,expires_at,last_seen) VALUES(?,?,?,?)').run(sha(token),id,now+SESSION_MS,now);
  this.db.prepare('DELETE FROM sessions WHERE person_id=? AND rowid NOT IN (SELECT rowid FROM sessions WHERE person_id=? ORDER BY rowid DESC LIMIT ?)').run(id,id,MAX_SESSIONS);
  return{token,maxAgeSeconds:SESSION_MS/1000};
 }
 /** The subject id of a live session. Absolute 12 h plus a 2 h idle timeout; last_seen is refreshed at most once a minute. */
 session(token:string):string|undefined{
  if(!token)return undefined;const now=this.now();if(now-this.lastPurge>5*60_000)this.purge(now);
  const hash=sha(token),row=this.db.prepare('SELECT person_id,expires_at,last_seen FROM sessions WHERE token_hash=?').get(hash) as {person_id:string;expires_at:number;last_seen:number}|undefined;
  if(!row||row.expires_at<now||row.last_seen<now-IDLE_MS){if(row)this.endSession(token);return undefined;}
  if(now-row.last_seen>TOUCH_MS)this.db.prepare('UPDATE sessions SET last_seen=? WHERE token_hash=?').run(now,hash);
  return row.person_id;
 }
 endSession(token:string){this.db.prepare('DELETE FROM sessions WHERE token_hash=?').run(sha(token));}
}
