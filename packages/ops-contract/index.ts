/** Business operations contract (ADR 009): inquiries, organizations, distributor products, Lab Mitra tasks, payouts and roles. */
import {z} from 'zod';
import {CircuitSpecSchema,type SpecIssue} from '../../apps/web/src/lab/circuit-spec';

const text=(max:number)=>z.string().trim().max(max);
const slug=z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/).min(3).max(80);
export const HistorySchema=z.array(z.object({at:z.string(),by:z.string(),action:z.string().max(200)}).strict());

// Inquiries: the public form posts these; everything else is owner-side.
export const INQUIRY_KINDS=['vendor','school','buyer','other'] as const;
export const INQUIRY_STATUSES=['new','contacted','qualified','proposal','won','lost','spam'] as const;
/** Test context carried from the global home map into the inquiry (all optional, fixed vocabularies). */
export const TEST_REGIONS=['java','batam','sumatra','kalimantan','sulawesi','nusa-tenggara','maluku','papua','maritime'] as const;
export const TEST_BUILDS=['ground','drone','amr','marine','sensors','humanoid'] as const;
/** Hotspot ids on the home map (apps/web/src/hero-map/hotspots.ts); a unit test keeps the two in sync. */
export const TEST_SITES=['jakarta','bekasi-karawang','bandung','cilegon','semarang-kendal','yogyakarta','surabaya-perak','gresik-jiipe','malang-singhasari','medan','sei-mangkei-kuala-tanjung','pekanbaru-riau-palm','palembang','batam','kek-tanjung-sauh','balikpapan-ikn','makassar','denpasar-sanur'] as const;
export const TEST_STRESSORS=['heat','haze','flood','salt','power','connectivity'] as const;
export const TEST_MONTHS=['jan','feb','mar','apr','may','jun','jul','aug','sep','oct','nov','dec'] as const;
export const InquiryInputSchema=z.object({
 kind:z.enum(INQUIRY_KINDS),
 name:text(120).min(2),
 organization:text(160).default(''),
 email:z.union([z.literal(''),z.string().trim().email().max(200)]).default(''),
 phone:z.union([z.literal(''),z.string().trim().regex(/^\+?[0-9 ()-]{7,20}$/,'Use digits, spaces, + or -')]).default(''),
 country:text(80).default(''),
 interest:text(160).default(''),
 message:text(4000).min(10),
 consent:z.literal(true,{error:'Consent is required'}),
 source:text(300).default(''),
 region:z.enum(TEST_REGIONS).optional(),
 build:z.enum(TEST_BUILDS).optional(),
 month:z.enum(TEST_MONTHS).optional(),
 stressor:z.enum(TEST_STRESSORS).optional(),
 site:z.enum(TEST_SITES).optional(),
}).strict().refine(i=>!!(i.email||i.phone),{message:'Provide an email or a WhatsApp number',path:['email']});
export type InquiryInput=z.infer<typeof InquiryInputSchema>;
export type Inquiry=Omit<InquiryInput,'consent'>&{id:string;status:typeof INQUIRY_STATUSES[number];assignee:string;organizationId?:string;consentAt:string;createdAt:string;updatedAt:string;history:z.infer<typeof HistorySchema>};
export const InquiryUpdateSchema=z.object({status:z.enum(INQUIRY_STATUSES).optional(),assignee:text(80).optional(),note:text(2000).min(1).optional()}).strict();

// Organizations: vendors (device makers), schools (Lab Mitra), buyers and other partners.
export const ORG_TYPES=['vendor','school','buyer','partner'] as const;
export const ORG_STATUSES=['prospect','active','paused','ended'] as const;
export const SCHOOL_PACKAGES=['none','guru','lab','agency'] as const;
export const OrganizationInputSchema=z.object({
 type:z.enum(ORG_TYPES),
 name:text(160).min(2),
 country:text(80).default('Indonesia'),
 city:text(80).default(''),
 status:z.enum(ORG_STATUSES).default('prospect'),
 contactName:text(120).default(''),
 contactEmail:z.union([z.literal(''),z.string().trim().email().max(200)]).default(''),
 contactPhone:z.union([z.literal(''),z.string().trim().regex(/^\+?[0-9 ()-]{7,20}$/)]).default(''),
 package:z.enum(SCHOOL_PACKAGES).default('none'),
 publicListing:z.boolean().default(false),
 notes:text(4000).default(''),
}).strict().superRefine((o,ctx)=>{
 if(o.type!=='school'&&o.package!=='none')ctx.addIssue({code:'custom',path:['package'],message:'Only schools have a Lab Mitra package'});
 if(o.type!=='school'&&o.publicListing)ctx.addIssue({code:'custom',path:['publicListing'],message:'Only schools appear on the public Lab Mitra board'});
});
export type OrganizationInput=z.infer<typeof OrganizationInputSchema>;
export type Organization=OrganizationInput&{id:string;inquiryId?:string;createdAt:string;updatedAt:string;history:z.infer<typeof HistorySchema>};
export const OrganizationUpdateSchema=z.object(Object.fromEntries(Object.entries({type:z.enum(ORG_TYPES),name:text(160).min(2),country:text(80),city:text(80),status:z.enum(ORG_STATUSES),contactName:text(120),contactEmail:z.union([z.literal(''),z.string().trim().email().max(200)]),contactPhone:z.union([z.literal(''),z.string().trim().regex(/^\+?[0-9 ()-]{7,20}$/)]),package:z.enum(SCHOOL_PACKAGES),publicListing:z.boolean(),notes:text(4000)}).map(([k,v])=>[k,v.optional()]))).strict();

// Distributor products: a partner device on its way into the Indonesian market.
export const PRODUCT_STATUSES=['evaluating','testing','localizing','available','discontinued'] as const;
export const CHECK_STATES=['todo','in_progress','done','not_applicable'] as const;
export const LOCALIZATION_ITEMS=['sdppi','manual_id','warranty','service_center','stock','pricing'] as const;
export type LocalizationItem=typeof LOCALIZATION_ITEMS[number];
const state=z.enum(CHECK_STATES);
const checklist=z.object({sdppi:state.default('todo'),manual_id:state.default('todo'),warranty:state.default('todo'),service_center:state.default('todo'),stock:state.default('todo'),pricing:state.default('todo')}).strict();
const evidence=z.object({label:text(120).min(1),url:z.string().url().startsWith('https://').max(500)}).strict();
const productShape={
 slug,
 vendorId:z.string().uuid(),
 name:text(120).min(2),
 category:text(60).min(2),
 summary:text(600).min(10),
 wireless:z.boolean(),
 status:z.enum(PRODUCT_STATUSES).default('evaluating'),
 localization:checklist.prefault({}),
 evidence:z.array(evidence).max(20).default([]),
 testSummary:text(600).default(''),
 priceNote:text(120).default(''),
 published:z.boolean().default(false),
};
/** A product may be sold only when every localization item is settled; wireless devices always need SDPPI. */
export function productErrors(p:{wireless:boolean;status:string;localization:Record<LocalizationItem,string>;published:boolean;evidence:unknown[];testSummary:string}):string[]{
 const errors:string[]=[];
 if(p.wireless&&p.localization.sdppi==='not_applicable')errors.push('Wireless devices need SDPPI certification');
 if(p.status==='available'){for(const k of LOCALIZATION_ITEMS)if(!['done','not_applicable'].includes(p.localization[k]))errors.push(`Cannot mark available: ${k} is ${p.localization[k]}`);if(!p.evidence.length)errors.push('Cannot mark available without test evidence');}
 if(p.published&&p.status==='evaluating')errors.push('Products under evaluation are not published');
 if(p.evidence.length&&!p.testSummary)errors.push('Evidence needs a test summary');
 return errors;
}
export const ProductInputSchema=z.object(productShape).strict().superRefine((p,ctx)=>{for(const message of productErrors(p))ctx.addIssue({code:'custom',message});});
export type ProductInput=z.infer<typeof ProductInputSchema>;
export type Product=ProductInput&{id:string;createdAt:string;updatedAt:string;history:z.infer<typeof HistorySchema>};
export const ProductUpdateSchema=z.object({...Object.fromEntries(Object.entries(productShape).filter(([k])=>k!=='localization').map(([k,v])=>[k,(v as z.ZodTypeAny).optional()])),localization:z.object({sdppi:state.optional(),manual_id:state.optional(),warranty:state.optional(),service_center:state.optional(),stock:state.optional(),pricing:state.optional()}).strict().optional()}).strict();

/** Public catalog view: no vendor contact, notes or history. */
export function publicProduct(p:Product,vendorName:string){
 return{slug:p.slug,name:p.name,vendor:vendorName,category:p.category,summary:p.summary,status:p.status,wireless:p.wireless,localization:p.localization,testedInIndonesia:p.evidence.length>0,testSummary:p.testSummary,evidence:p.evidence,priceNote:p.priceNote};
}
export type PublicProduct=ReturnType<typeof publicProduct>;

// Lab Mitra tasks: paid test work done by a school lab, verified before payout.
export const TASK_STATUSES=['open','assigned','submitted','verified','rejected','paid'] as const;
export type TaskStatus=typeof TASK_STATUSES[number];
export const TaskInputSchema=z.object({title:text(160).min(4),feeIdr:z.number().int().min(10000).max(100_000_000),productId:z.string().uuid().optional(),partnerId:z.string().uuid().optional(),labId:z.string().uuid().optional(),leadId:z.string().uuid().optional(),instructions:text(4000).default('')}).strict().refine(t=>!t.leadId||!!t.labId,{message:'A lead teacher needs an assigned school',path:['leadId']});
export type TaskInput=z.infer<typeof TaskInputSchema>;
export type LabTask=TaskInput&{id:string;status:TaskStatus;evidenceRef:string;batchId?:string;createdAt:string;updatedAt:string;history:z.infer<typeof HistorySchema>};
/** Tasks become `paid` when their payout batch is marked paid (ADR 010), so there is no per-task pay action. */
export const TASK_ACTIONS=['assign','submit','verify','reject'] as const;
export const TaskActionSchema=z.object({action:z.enum(TASK_ACTIONS),labId:z.string().uuid().optional(),leadId:z.string().uuid().optional(),evidenceRef:text(500).optional(),note:text(1000).optional()}).strict();
const flow:Record<typeof TASK_ACTIONS[number],{from:TaskStatus[];to:TaskStatus}>={assign:{from:['open','rejected','assigned'],to:'assigned'},submit:{from:['assigned'],to:'submitted'},verify:{from:['submitted'],to:'verified'},reject:{from:['submitted'],to:'rejected'}};
/** Next task status, or an error. Payment happens through payout batches after verification; submission needs an evidence reference. */
export function taskTransition(task:Pick<LabTask,'status'|'labId'|'evidenceRef'>,input:z.infer<typeof TaskActionSchema>):{status:TaskStatus}|{error:string}{
 const step=flow[input.action];
 if(!step.from.includes(task.status))return{error:`Cannot ${input.action} a task that is ${task.status}`};
 if(input.action==='assign'&&!input.labId)return{error:'Choose a Lab Mitra school to assign'};
 if(input.action!=='assign'&&!task.labId)return{error:'Task has no assigned lab'};
 if(input.action==='submit'&&!(input.evidenceRef||task.evidenceRef))return{error:'Submission needs an evidence reference (job id or link)'};
 return{status:step.to};
}

/** Lab Mitra payout split: 60% student operators, 25% school TEFA fund, 15% supervising teacher. Rounding goes to the TEFA fund. */
export const PAYOUT_SPLIT={students:60,tefa:25,teacher:15} as const;
export function payoutSplit(feeIdr:number){const students=Math.floor(feeIdr*PAYOUT_SPLIT.students/100),teacher=Math.floor(feeIdr*PAYOUT_SPLIT.teacher/100);return{students,tefa:feeIdr-students-teacher,teacher};}

/** Integer split of `total` over `n` students; the remainder goes 1 rupiah each to the first students. */
export function equalShares(total:number,n:number):number[]{if(!(n>0))return[];const base=Math.floor(total/n),rest=total-base*n;return Array.from({length:n},(_,i)=>base+(i<rest?1:0));}

// Lab Mitra portal (ADR 010): school-side people, allocations, payout batches. Commissions are paid to the school, never to students.
export const PERSON_ROLES=['school_admin','teacher','student'] as const;
export type PersonRole=typeof PERSON_ROLES[number];
export const PERSON_STATUSES=['active','disabled'] as const;
const personName=text(120).min(2);
export const TeacherInputSchema=z.object({role:z.literal('teacher'),name:personName}).strict();
export const StudentInputSchema=z.object({role:z.literal('student'),name:personName,className:text(40).min(1),nisn:z.union([z.literal(''),z.string().trim().regex(/^[0-9]{10}$/,'NISN has 10 digits')]).optional(),guardianConsent:z.literal(true,{error:'Guardian consent is required for students'})}).strict();
export const PortalPersonInputSchema=z.discriminatedUnion('role',[TeacherInputSchema,StudentInputSchema]);
export const SchoolAdminInputSchema=z.object({orgId:z.string().uuid(),name:personName}).strict();
export const PersonUpdateSchema=z.object({name:personName.optional(),className:text(40).min(1).optional(),nisn:z.union([z.literal(''),z.string().trim().regex(/^[0-9]{10}$/,'NISN has 10 digits')]).optional(),status:z.enum(PERSON_STATUSES).optional()}).strict();
export type Person={id:string;orgId:string;role:PersonRole;name:string;className?:string;nisn?:string;username?:string;status:typeof PERSON_STATUSES[number];guardianConsent?:{at:string;recordedBy:string};createdBy:string;createdAt:string;updatedAt:string;history:z.infer<typeof HistorySchema>};
export const PortalLoginSchema=z.object({username:text(80).min(3),password:z.string().min(1).max(200)}).strict();
export const PortalActivateSchema=z.object({code:z.string().trim().toUpperCase().regex(/^[A-HJKMNP-Z2-9]{4}-[A-HJKMNP-Z2-9]{10}$/,{error:'Invite codes look like ABCD-EFGHJKMNPQ'}),password:z.string().min(10,{error:'Password needs at least 10 characters'}).max(200)}).strict();
export const AllocationProposalSchema=z.object({taskId:z.string().uuid(),shares:z.array(z.object({studentId:z.string().uuid(),amountIdr:z.number().int().min(0).max(100_000_000)}).strict()).min(1).max(60)}).strict();
export const AllocationDecisionSchema=z.object({note:text(500).optional()}).strict();
export const ReasonSchema=z.object({reason:text(300).min(3,{error:'A reason is required'})}).strict();
export const EvidenceSchema=z.object({evidenceRef:text(500).min(1)}).strict();
export const BatchCreateSchema=z.object({orgId:z.string().uuid()}).strict();
export const BatchPaidSchema=z.object({transferRef:text(120).min(3,{error:'Transfer reference is required'}),paidAt:z.string().regex(/^\d{4}-\d{2}-\d{2}(T[\d:.]+Z?)?$/,{error:'Use a date like 2026-10-31'})}).strict();
export type Share={studentId:string;amountIdr:number};
export type Allocation={id:string;taskId:string;orgId:string;proposedBy:string;shares:Share[];status:'pending'|'approved'|'rejected'|'void'|'reversed';decidedBy?:string;decidedAt?:string;note:string;batchId?:string;createdAt:string;updatedAt:string;history:z.infer<typeof HistorySchema>};
export type Batch={id:string;orgId:string;taskIds:string[];allocationIds:string[];amountIdr:number;status:'created'|'paid';transferRef:string;paidAt?:string;distributedAt?:string;distributedBy?:string;createdAt:string;updatedAt:string;history:z.infer<typeof HistorySchema>};
/** An allocation must hand out exactly the task's student pool to distinct students. */
export function allocationErrors(poolIdr:number,shares:Share[]):string[]{
 const errors:string[]=[];const total=shares.reduce((n,s)=>n+s.amountIdr,0);
 if(new Set(shares.map(s=>s.studentId)).size!==shares.length)errors.push('Each student can appear only once');
 if(total!==poolIdr)errors.push(`Shares must add up to the student pool of ${poolIdr} (got ${total})`);
 return errors;
}
export const PORTAL_ACTIONS=['summary.read','people.read','people.write','tasks.read','tasks.evidence','allocations.read','allocations.propose','allocations.decide','batches.read','batches.confirm'] as const;
export type PortalAction=typeof PORTAL_ACTIONS[number];
const portalGrants:Record<'school_admin'|'teacher',PortalAction[]>={
 school_admin:['summary.read','people.read','people.write','tasks.read','allocations.read','allocations.propose','allocations.decide','batches.read','batches.confirm'],
 teacher:['people.read','tasks.read','tasks.evidence','allocations.read','allocations.propose'],
};
export function portalCan(role:PersonRole,action:PortalAction){return role!=='student'&&portalGrants[role].includes(action);}

// Roles: per-user access behind the admin gateway login.
export const ROLES=['owner','sales','ops','viewer'] as const;
export type Role=typeof ROLES[number];
export const RESOURCES=['inquiries','organizations','products','tasks'] as const;
export type Resource=typeof RESOURCES[number];
const grants:Record<Role,Record<Resource,'r'|'rw'>>={
 owner:{inquiries:'rw',organizations:'rw',products:'rw',tasks:'rw'},
 sales:{inquiries:'rw',organizations:'rw',products:'r',tasks:'r'},
 ops:{inquiries:'r',organizations:'r',products:'rw',tasks:'rw'},
 viewer:{inquiries:'r',organizations:'r',products:'r',tasks:'r'},
};
export function can(role:Role,resource:Resource,write:boolean){const g=grants[role][resource];return write?g==='rw':true;}
export function permissions(role:Role){return grants[role];}
/** `OPS_ROLES="daniel:owner,rina:sales"`. With no roles configured the install is single-owner and every gateway user is owner. */
export function parseRoles(spec=''):Map<string,Role>{
 const map=new Map<string,Role>();
 for(const part of spec.split(',').map(s=>s.trim()).filter(Boolean)){const [user,role]=part.split(':').map(s=>s.trim());if(!user||!(ROLES as readonly string[]).includes(role))throw new Error(`Invalid OPS_ROLES entry: ${part}`);map.set(user,role as Role);}
 return map;
}
export function resolveRole(user:string|undefined,roles:Map<string,Role>):Role|undefined{if(!roles.size)return'owner';return user?roles.get(user):undefined;}

// Staff accounts (ADR 009 addendum): per-person logins for the admin host. Login and activation share the portal schemas.
export const STAFF_STATUSES=['active','disabled'] as const;
export const USERNAME_RE=/^[a-z0-9._-]{3,40}$/;
export const StaffInputSchema=z.object({username:z.string().trim().toLowerCase().regex(USERNAME_RE,{error:'Username: 3-40 characters, a-z 0-9 . _ -'}),name:text(120).min(2),role:z.enum(ROLES)}).strict();
export const StaffUpdateSchema=z.object({role:z.enum(ROLES).optional(),status:z.enum(STAFF_STATUSES).optional()}).strict().refine(v=>v.role!==undefined||v.status!==undefined,{error:'Nothing to change'});
export type Staff={id:string;username:string;name:string;role:Role;status:typeof STAFF_STATUSES[number];createdBy:string;createdAt:string;updatedAt:string;history:z.infer<typeof HistorySchema>};

// Members (ADR 009 addendum): invited clients, partners and schools whose account unlocks areas of iot.ai.id. Login and activation share the portal schemas.
export const MEMBER_GRANTS=['products','bench','arena','builders','installer','lab','lab-ai','pro'] as const;
export type MemberGrant=typeof MEMBER_GRANTS[number];
export const MEMBER_STATUSES=['active','disabled'] as const;
const grantList=z.array(z.enum(MEMBER_GRANTS)).max(MEMBER_GRANTS.length).transform(g=>MEMBER_GRANTS.filter(x=>g.includes(x)));
export const MemberInputSchema=z.object({username:z.string().trim().toLowerCase().regex(USERNAME_RE,{error:'Username: 3-40 characters, a-z 0-9 . _ -'}),name:text(120).min(2),orgName:text(160).default(''),orgId:z.string().uuid().optional(),grants:grantList.default([])}).strict();
export const MemberUpdateSchema=z.object({name:text(120).min(2).optional(),orgName:text(160).optional(),orgId:z.string().uuid().nullable().optional(),grants:grantList.optional(),status:z.enum(MEMBER_STATUSES).optional()}).strict().refine(v=>Object.values(v).some(x=>x!==undefined),{error:'Nothing to change'});
export type Member={id:string;username:string;name:string;orgName:string;orgId?:string;grants:MemberGrant[];status:typeof MEMBER_STATUSES[number];createdBy:string;createdAt:string;updatedAt:string;history:z.infer<typeof HistorySchema>};
/** What a signed-in member may see about themselves: no ids, no session data. */
export type MemberMe={name:string;org:string;grants:MemberGrant[]};

// Lab AI builder (ADR 011): prompt -> CircuitSpec + sketch -> compiled hex. Routes under /ops/v1/lab/. The LLM never runs in ops: ops calls the api container (INTERNAL_SPEC_PATH) with a dedicated token.
export {CircuitSpecSchema} from '../../apps/web/src/lab/circuit-spec';
export type {CircuitSpec,SpecIssue} from '../../apps/web/src/lab/circuit-spec';

export const LAB_AI_LANGS=['en','id'] as const;
export const LAB_AI_EXAMPLE_IDS=['close-alarm','night-light','servo-gate'] as const;
export type LabAiExampleId=typeof LAB_AI_EXAMPLE_IDS[number];
export const LAB_AI_DAILY_MEMBER_QUOTA=20;
export const LAB_AI_DAILY_GLOBAL_CAP=500;
export const LAB_AI_PROMPT_MAX=600;
/** Compiled sketch in the same shape as FirmwareVariant (contract.ts) minus lesson-only fields: `lines` = [firstWord,lastWord,inoLine1Based] from DWARF. */
export const LabBuildArtifactSchema=z.object({
 sha256:z.string().regex(/^[a-f0-9]{64}$/),
 flashBase64:z.string().max(120_000),
 bytes:z.number().int().min(1).max(32_768),
 lines:z.array(z.tuple([z.number().int(),z.number().int(),z.number().int()])).max(8000),
 toolchain:z.string().max(80),
}).strict();
export type LabBuildArtifact=z.infer<typeof LabBuildArtifactSchema>;
export const LabDiagnosticSchema=z.object({line:z.number().int().min(0),message:z.string().max(400)}).strict();
export type LabDiagnostic=z.infer<typeof LabDiagnosticSchema>;

/** POST /ops/v1/lab/build. Anonymous callers may only send `exampleId` (no LLM, precomputed). Members with the lab-ai grant and staff send `prompt`. */
export const LabBuildRequestSchema=z.object({
 prompt:text(LAB_AI_PROMPT_MAX).min(8).optional(),
 exampleId:z.enum(LAB_AI_EXAMPLE_IDS).optional(),
 lang:z.enum(LAB_AI_LANGS).default('en'),
}).strict().refine(v=>!!v.prompt!==!!v.exampleId,{error:'Send either a prompt or an exampleId'});
export type LabBuildRequest=z.infer<typeof LabBuildRequestSchema>;
/** `limit` 0 = no per-person limit (staff); the global daily cap still applies. */
export const LabQuotaSchema=z.object({usedToday:z.number().int().min(0),limit:z.number().int().min(0),resetsAt:z.string()}).strict();
export type LabQuota=z.infer<typeof LabQuotaSchema>;
export const LabBuildResponseSchema=z.object({
 buildId:z.string().uuid().or(z.string().regex(/^ex-[a-z-]+$/)),
 source:z.enum(['llm','example','cache']),
 spec:CircuitSpecSchema,
 build:LabBuildArtifactSchema,
 /** Warnings that did not block (errors are returned as LabBuildErrorSchema instead). */
 issues:z.array(z.object({code:z.string(),severity:z.enum(['error','warning']),en:z.string(),id:z.string(),ref:z.string().optional()}).strict()),
 /** The spec was repaired once after the first model answer failed validation. */
 repaired:z.boolean(),
 quota:LabQuotaSchema.optional(),
}).strict();
export type LabBuildResponse=z.infer<typeof LabBuildResponseSchema>;
/** Error bodies. `kind`: validation (spec stayed invalid after one repair), compile (arduino-cli rejected the sketch), quota (member or global cap), forbidden (no lab-ai grant), unavailable (api/provider down), bad-request. */
export const LAB_BUILD_ERROR_KINDS=['validation','compile','quota','forbidden','unavailable','bad-request'] as const;
export const LabBuildErrorSchema=z.object({
 error:z.string(),
 kind:z.enum(LAB_BUILD_ERROR_KINDS),
 issues:z.array(z.object({code:z.string(),severity:z.enum(['error','warning']),en:z.string(),id:z.string(),ref:z.string().optional()}).strict()).optional(),
 diagnostics:z.array(LabDiagnosticSchema).optional(),
 quota:LabQuotaSchema.optional(),
}).strict();
export type LabBuildError=z.infer<typeof LabBuildErrorSchema>;

/** GET /ops/v1/lab/examples (signed-in member with the `lab` grant, or staff; 401/403 otherwise. Data only, the lab itself is gated in the web app): the 3 curated prompts with committed specs and hex. No LLM call. */
export const LabExamplesResponseSchema=z.object({examples:z.array(z.object({exampleId:z.enum(LAB_AI_EXAMPLE_IDS),prompt:z.object({en:z.string(),id:z.string()}).strict(),spec:CircuitSpecSchema,build:LabBuildArtifactSchema}).strict()).max(3)}).strict();
export type LabExamplesResponse=z.infer<typeof LabExamplesResponseSchema>;

/** POST /ops/v1/lab/compile: edit-and-recompile of a sketch (same access as build, counts toward the global cap, not the member quota). */
export const LabCompileRequestSchema=z.object({source:z.string().min(1).max(20_000)}).strict();
export const LabCompileResponseSchema=z.object({build:LabBuildArtifactSchema,cached:z.boolean()}).strict();
export type LabCompileResponse=z.infer<typeof LabCompileResponseSchema>;

/** GET /ops/v1/lab/history: the member's own past builds, newest first. Prompt and output are logged server-side per ADR 011. */
export const LabHistoryItemSchema=z.object({buildId:z.string(),at:z.string(),prompt:z.string(),ok:z.boolean(),repaired:z.boolean(),sha256:z.string().optional()}).strict();
export type LabHistoryItem=z.infer<typeof LabHistoryItemSchema>;
export const LabHistoryResponseSchema=z.object({items:z.array(LabHistoryItemSchema).max(100),quota:LabQuotaSchema}).strict();

/**
 * Internal only (ops -> api over the docker network, header `x-aiot-internal: <OPS_API_INTERNAL_TOKEN>`; never routed by nginx).
 * The api container owns the provider keys. It must answer with JSON that parses as CircuitSpec, forced via the provider's structured-output mode.
 */
export const INTERNAL_SPEC_PATH='/internal/lab/spec';
export const InternalSpecRequestSchema=z.object({
 prompt:text(LAB_AI_PROMPT_MAX).min(8),
 lang:z.enum(LAB_AI_LANGS),
 /** Present on the single repair attempt: the previous spec JSON and the validator issues to fix. */
 repair:z.object({previous:z.unknown(),issues:z.array(z.object({code:z.string(),en:z.string(),ref:z.string().optional()}).strict()).max(20)}).strict().optional(),
}).strict();
export type InternalSpecRequest=z.infer<typeof InternalSpecRequestSchema>;
export const InternalSpecResponseSchema=z.object({spec:z.unknown(),provider:z.string().max(40),model:z.string().max(80)}).strict();
export type InternalSpecResponse=z.infer<typeof InternalSpecResponseSchema>;
export type {SpecIssue as LabSpecIssue};
