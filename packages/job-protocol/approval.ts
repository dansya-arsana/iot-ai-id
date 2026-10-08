export interface ApprovalJob {status:string;input?:{expiresAt?:number}}
/** Missing expiry is retained for historical local jobs; malformed expiry fails closed. */
export function approvalPending(job:ApprovalJob,now=Date.now()):boolean {
 const expiry=job.input?.expiresAt;
 return job.status==='awaiting_approval'&&(expiry===undefined||(Number.isFinite(expiry)&&expiry>now));
}
