# ADR 010: Lab Mitra commissions, school portal and payout batches

Status: accepted. Contract: `packages/ops-contract/index.ts`. Service: `services/ops/` (`commissions.ts`, `ledger.ts`, `portal.ts`). UI: `/mitra` and the backoffice section `#bo-commissions`.

## Context

ADR 009 splits a verified Lab Mitra task 60% to student operators, 25% to the school TEFA fund and 15% to the supervising teacher, and used a per-task "Mark paid" button. That left three gaps: nobody recorded who among the students earned what, there was no audit trail of the money, and the schools had no place to see their own records. SMK students are minors, so the platform also must not become a system that pays children or collects their personal data.

## Decision

### Pay the school, never the student

Commissions are always transferred to the school's bank account. AIoT never pays a student directly and holds no student bank details. The platform records the per-student and teacher breakdown, and the school confirms that it distributed the money. The school carries the legal relationship with its students, teachers and their guardians.

### Flow

1. AIoT verifies a task (`submitted → verified`). The ledger accrues the 60/25/15 pools and the amount payable to the school.
2. The lead teacher (set by AIoT at assignment) proposes an allocation: the participating students and an amount each. The amounts must add up exactly to the task's student pool. `equalShares(total, n)` prefills an even split and gives the integer remainder 1 rupiah each to the first students.
3. The school admin approves or rejects. Approval needs a verified task and moves the pool into `student:<id>` entries.
4. AIoT creates a payout batch from the approved, unpaid allocations of one school, transfers the money and marks the batch paid with a mandatory `transferRef`. Its tasks become `paid`. The old per-task pay action is gone.
5. The school admin confirms the batch was distributed. The student entries clear and the batch is closed. A per-batch CSV lists every recipient (students, teacher, TEFA fund) with amounts.

### Two-person rule

The proposer of an allocation can never approve it, and teachers cannot approve at all. An allocation is valid only while its school still owns the task and its proposer is the task's current lead (or a school admin when there is no lead). Reassigning a task or changing its lead voids its pending allocations, verified tasks cannot be reassigned, and `approve` and batch creation re-check validity. A school admin may propose only for a task that has no lead teacher; such an allocation then needs a second school admin (AIoT can create more than one per school) to approve it. AIoT cannot approve allocations: the backoffice shows them read-only.

A school admin could try to take over a teacher by resetting their invite. A school admin may therefore reset a teacher's invite only while the teacher leads no unpaid task and has no pending or approved-unbatched allocation; otherwise AIoT must do it, and any reset voids that teacher's pending proposals and ends their sessions. Residual risk: a school can still create a brand-new teacher, but only AIoT assigns task leads, so AIoT stays in the loop for every allocation.

### Ledger

`ledger` is append-only: SQLite triggers `RAISE(ABORT)` on every UPDATE and DELETE. Rows are `{id, at, org_id, task_id, account, amount_idr, kind, ref, actor, note}`. Accounts are `student_pool`, `tefa`, `teacher` (ref = lead), `payable:<orgId>`, `student:<personId>` and `distributed:<orgId>`. Kinds are `accrual`, `allocation`, `payout` (ref = transfer reference), `distribution`, and `reversal:<kind>`. Corrections are grouped reversals written in one transaction, never single rows: `POST /admin/allocations/:id/reverse` undoes a whole approved allocation that is not in a batch (status `reversed`, `student_pool` restored), and `POST /admin/tasks/:id/reverse-accrual` undoes a whole task accrual while the task has no approved or batched allocation (task returns to `submitted`). Both need a reason. Payout and distribution rows are never reversed: a paid batch is final, and a later correction would be an explicit adjustment entry (not built; document it with the school and book it as a new batch or adjustment when needed). Balances are always a SUM. The per-task accrual rows (`student_pool`, `tefa`, `teacher`) add up to the `payable` row; this is a per-account ledger, not a double-entry system.

### People, logins and sessions

`people` holds school admins, teachers and students. Status is `active` or `disabled`; people are never deleted because the ledger references them. AIoT creates the first school admin of an active school; the school admin creates teachers and students in the portal. Students have no login in phase 1.

- Login-capable people receive a one-time invite code `ABCD-EFGHJKMNPQ`: a 4-character lookup id (stored plain, indexed) and a 10-character secret, both from an alphabet without look-alikes. The secret is stored as a scrypt hash, so activation runs one scrypt per attempt. The code is valid for 7 days and shown once. All scrypt work is asynchronous so the event loop is never blocked. A reset issues a new code and invalidates the password and sessions.
- Activation sets a password (at least 10 characters, scrypt with salt). The username is generated as `firstname.school-slug` and is unique.
- Five failed logins lock that person and IP pair for 15 minutes, and 30 failures across all IPs lock the person for 15 minutes, so one attacker cannot cheaply lock out a known username. Unknown, locked and not-yet-activated accounts all cost one dummy scrypt. Login and activation are also limited per IP in the service and by nginx (`iot_portal_auth`, 5 requests per minute).
- The session is a random 32-byte token in the `aiot_portal` cookie: HttpOnly, SameSite=Strict, Path `/ops/v1/portal`, 12 hours absolute plus a 2 hour idle timeout (last seen refreshed at most once a minute), at most 5 sessions per person (oldest dropped), expired rows purged, and Secure except for plain http on loopback (local development and e2e). Only the sha256 of the token is stored. All writes need the `X-AIoT-Portal: 1` header.
- Every query is filtered by the session's school. Another school's ids return 404.

### Minors and data minimization

For a student the platform stores the name, class and an optional NISN. No national ID (NIK), address, photo or bank details. The school admin must tick that the school holds written consent of the parent or guardian before a student can be added; the server records the consent time and who recorded it, and refuses the request without it. Students can be disabled but their ledger lines remain for audit. Schools are responsible for obtaining the consent, and a deletion or anonymization request is handled by AIoT on the school's behalf.

### Tax note

Honoraria paid to teachers and students may be taxable income (for example PPh 21), and school funds have their own accounting rules. AIoT does not withhold or advise: schools and AIoT should consult a tax advisor before the first payout.

## Phase 2 (not built)

Student login with an invite code and PIN, a student view of their own allocations, and receipt confirmation by the student. The `people` table and the `logins` table are shaped for it: a student only needs a `logins` row, and the session lookup currently refuses students on purpose. Phase 2 needs a separate guardian-facing consent wording and PIN lockout rules suitable for children.

## Consequences

- Every rupiah has a row, an actor and a transfer reference, so a school or auditor can reconstruct any balance.
- The public host gains an authenticated surface. It is isolated to `/ops/v1/portal/*` with its own limits, and the owner token and admin routes remain unreachable from it.
- nginx keys the portal rate zones on `$iot_client_ip`, which is `CF-Connecting-IP` or, when it is missing, the socket address, so a request without the header is still limited.
- Per-task payment is no longer possible: unrelated tasks of one school are paid together, which matches how schools receive transfers.
