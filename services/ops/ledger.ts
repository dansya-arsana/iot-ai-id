/** Append-only commission ledger (ADR 010). Rows are never edited: SQLite triggers abort UPDATE and DELETE, and corrections are grouped reversal rows written by Commissions (never single legs). */
import type {DatabaseSync} from 'node:sqlite';

export type LedgerEntry={id:number;at:string;orgId:string;taskId:string;account:string;amountIdr:number;kind:string;ref:string;actor:string;note:string};
export type NewEntry={orgId:string;taskId:string;account:string;amountIdr:number;kind:string;ref?:string;actor:string;note?:string};
const cols='id,at,org_id AS orgId,task_id AS taskId,account,amount_idr AS amountIdr,kind,ref,actor,note';

export class Ledger{
 constructor(readonly db:DatabaseSync){
  db.exec(`CREATE TABLE IF NOT EXISTS ledger(id INTEGER PRIMARY KEY AUTOINCREMENT,at TEXT NOT NULL,org_id TEXT NOT NULL,task_id TEXT NOT NULL,account TEXT NOT NULL,amount_idr INTEGER NOT NULL,kind TEXT NOT NULL,ref TEXT NOT NULL DEFAULT '',actor TEXT NOT NULL,note TEXT NOT NULL DEFAULT '');
CREATE INDEX IF NOT EXISTS ledger_org ON ledger(org_id);CREATE INDEX IF NOT EXISTS ledger_account ON ledger(account);
CREATE TRIGGER IF NOT EXISTS ledger_no_update BEFORE UPDATE ON ledger BEGIN SELECT RAISE(ABORT,'ledger is append-only'); END;
CREATE TRIGGER IF NOT EXISTS ledger_no_delete BEFORE DELETE ON ledger BEGIN SELECT RAISE(ABORT,'ledger is append-only'); END;`);
 }
 add(e:NewEntry,at:string){this.db.prepare('INSERT INTO ledger(at,org_id,task_id,account,amount_idr,kind,ref,actor,note) VALUES(?,?,?,?,?,?,?,?,?)').run(at,e.orgId,e.taskId,e.account,e.amountIdr,e.kind,e.ref??'',e.actor,e.note??'');}
 entries(where:{orgId?:string;taskId?:string;account?:string}={}):LedgerEntry[]{
  const w:string[]=[],v:string[]=[];if(where.orgId){w.push('org_id=?');v.push(where.orgId);}if(where.taskId){w.push('task_id=?');v.push(where.taskId);}if(where.account){w.push('account=?');v.push(where.account);}
  return this.db.prepare(`SELECT ${cols} FROM ledger ${w.length?'WHERE '+w.join(' AND '):''} ORDER BY id`).all(...v) as LedgerEntry[];
 }
 /** SUM over accounts (exact name or `prefix%`), optionally limited to kinds, one org or one task. */
 total(f:{account?:string;accountLike?:string;kinds?:string[];orgId?:string;taskId?:string}):number{
  const w:string[]=[],v:string[]=[];
  if(f.account){w.push('account=?');v.push(f.account);}if(f.accountLike){w.push('account LIKE ?');v.push(f.accountLike);}
  if(f.kinds){w.push(`kind IN (${f.kinds.map(()=>'?').join(',')})`);v.push(...f.kinds);}if(f.orgId){w.push('org_id=?');v.push(f.orgId);}if(f.taskId){w.push('task_id=?');v.push(f.taskId);}
  return Number((this.db.prepare(`SELECT COALESCE(SUM(amount_idr),0) AS n FROM ledger ${w.length?'WHERE '+w.join(' AND '):''}`).get(...v) as {n:number}).n);
 }
 entriesBy(kind:string,ref:string):LedgerEntry[]{return this.db.prepare(`SELECT ${cols} FROM ledger WHERE kind=? AND ref=? ORDER BY id`).all(kind,ref) as LedgerEntry[];}
 /** Net amount per account for a task over the given kinds (used to reverse a whole accrual). */
 netByAccount(taskId:string,kinds:string[]):{account:string;amountIdr:number;orgId:string}[]{return this.db.prepare(`SELECT account,org_id AS orgId,SUM(amount_idr) AS amountIdr FROM ledger WHERE task_id=? AND kind IN (${kinds.map(()=>'?').join(',')}) GROUP BY account,org_id HAVING SUM(amount_idr)<>0`).all(taskId,...kinds) as {account:string;amountIdr:number;orgId:string}[];}
}
