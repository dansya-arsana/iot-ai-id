import {z} from 'zod';
import {canonicalJson, hashText} from '../evidence/index.js';

export const ExportPurposeSchema = z.enum(['local', 'research', 'model_improvement']);
export type ExportPurpose = z.infer<typeof ExportPurposeSchema>;
export const ProjectMetadataSchema = z.object({
  entryPoint: z.enum(['build', 'learn']).default('build'),
  actor: z.enum(['human', 'agent']).optional(),
  challengeId: z.string().regex(/^[a-z0-9-]{3,64}$/).optional(),
  challengeVersion: z.number().int().positive().optional(),
}).strict().superRefine((value, ctx) => {
  if ((value.challengeId === undefined) !== (value.challengeVersion === undefined)) {
    ctx.addIssue({code: 'custom', message: 'Challenge ID and version must be supplied together'});
  }
  if (value.entryPoint === 'learn' && !value.challengeId) {
    ctx.addIssue({code: 'custom', message: 'Learning entry requires an explicit challenge from the challenge catalog'});
  }
});
export type ProjectMetadata = z.infer<typeof ProjectMetadataSchema>;
const references = {
  experimentId: z.string().uuid().optional(),
  contractId: z.string().uuid().optional(),
};
export const HumanActionSchema = z.object({
  ...references,
  provenance: z.enum(['human_reported', 'test_fixture']).default('human_reported'),
  actionType: z.enum(['accepted_plan', 'inspected_wiring', 'reported_edit', 'performed_repair', 'observed_display', 'note']),
  description: z.string().trim().min(1).max(1000),
}).strict();
export const EnvironmentRecordSchema = z.object({
  ...references,
  provenance: z.enum(['human_reported', 'test_fixture']).default('human_reported'),
  quantity: z.enum(['temperature', 'humidity', 'supply_voltage', 'reboot_cycles', 'other']),
  value: z.number().finite(),
  unit: z.string().trim().min(1).max(30),
  method: z.string().trim().min(1).max(300),
}).strict();
export const RightsRecordSchema = z.object({
  purpose: z.enum(['research', 'model_improvement']),
  participant: z.enum(['adult', 'minor', 'unknown']),
  participantConsent: z.boolean(),
  schoolConsent: z.boolean(),
  guardianConsent: z.boolean(),
  reviewed: z.boolean(),
  authorizationReference: z.string().trim().max(200).default(''),
  withdrawn: z.boolean(),
}).strict().superRefine((value, ctx) => {
  if ((value.participantConsent || value.schoolConsent || value.guardianConsent || value.reviewed) && !value.authorizationReference) {
    ctx.addIssue({code: 'custom', message: 'Approvals require a nonempty authorization reference'});
  }
});
export type HumanActionInput = z.input<typeof HumanActionSchema>;
export type EnvironmentInput = z.input<typeof EnvironmentRecordSchema>;
export type RightsInput = z.infer<typeof RightsRecordSchema>;

export function rightsEligibility(records: any[], purpose: ExportPurpose, containsTestFixtures = false, currentContentHash?: string) {
  if (purpose === 'local') return {eligible: true, reasons: [], source: 'local engineering export; research authorization is separate'};
  const current = records.filter(r => r.purpose === purpose).at(-1);
  const reasons: string[] = [];
  if (containsTestFixtures) reasons.push('Episode contains test fixture records; excluded from research reuse');
  if (!current) reasons.push('No purpose-specific authorization attestation');
  else {
    if (current.withdrawn) reasons.push('Authorization withdrawn');
    if (current.participant === 'unknown') reasons.push('Participant age category unknown');
    if (!current.participantConsent) reasons.push('Participant authorization absent');
    if (!current.reviewed) reasons.push('Content review attestation absent');
    if (current.reviewed && (!current.reviewedContentHash || current.reviewedContentHash !== currentContentHash)) reasons.push('Episode changed since content review');
    if (!current.authorizationReference) reasons.push('Authorization reference absent');
    if (current.participant === 'minor' && (!current.schoolConsent || !current.guardianConsent)) reasons.push('Minor requires school and guardian authorization attestations');
  }
  return {eligible: reasons.length === 0, reasons, source: 'local operator attestation; authority and consent not independently verified'};
}

/** Conservative portable text filtering. It does not certify anonymity. */
export function portableText(value: string): string {
  return value
    .replace(/(?:Bearer\s+)[\w.-]+|\b(?:sk-|sk_|ghp_|github_pat_|wok_)[\w.-]+/gi, '[redacted credential]')
    .replace(/\b(?:api[_-]?key|token|password|secret)\s*[:=]\s*[^\s,;]+/gi, '[redacted credential]')
    .replace(/\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/gi, '[redacted email]')
    .replace(/\/(?:Users|home|dev|private|tmp)\/[^\s"'<>]+/g, '[redacted local path]');
}
function portable(value: any): any {
  if (typeof value === 'string') return portableText(value);
  if (Array.isArray(value)) return value.map(portable);
  if (value && typeof value === 'object') return Object.fromEntries(Object.entries(value).map(([key, entry]) => [key, portable(entry)]));
  return value;
}
function pick(value: any, keys: string[]) {
  return Object.fromEntries(keys.filter(key => value[key] !== undefined).map(key => [key, value[key]]));
}
function observationData(value: any) {
  const data: Record<string, unknown> = {};
  if (!value || typeof value !== 'object' || Array.isArray(value)) return data;
  if (typeof value.boardId === 'string') data.boardId = portableText(value.boardId).slice(0, 100);
  for (const key of ['success', 'initialized', 'addressAck', 'simulated']) {
    if (typeof value[key] === 'boolean') data[key] = value[key];
  }
  if (Array.isArray(value.addresses)) {
    data.addresses = value.addresses.filter((address: unknown) => typeof address === 'number' && Number.isInteger(address) && address >= 0 && address <= 127).slice(0, 128);
  }
  for (const key of ['temperature', 'humidity']) {
    if (value[key] === null || (typeof value[key] === 'number' && Number.isFinite(value[key]))) data[key] = value[key];
  }
  if (Number.isSafeInteger(value.cycle) && value.cycle >= 0) data.cycle = value.cycle;
  return data;
}

/** Content binding excludes permission history and operational/volatile state.
 * Stored artifacts are bound as well as their portable views, so changes hidden
 * by redaction cannot silently inherit an earlier content review.
 */
export function episodeContentHash(project: any): string {
  const content = {
    task: pick(project, ['id', 'goal', 'title', 'entryPoint', 'actor', 'challengeId', 'challengeVersion']),
    chatMessages: project.chatMessages ?? [],
    designDrafts: project.designDrafts ?? [],
    contracts: project.contracts,
    firmwareArtifacts: project.firmwareArtifacts,
    agentRuns: project.agentRuns,
    experiments: project.experiments.map((r: any) => pick(r, ['id', 'mode', 'backend', 'fault', 'parentId', 'identity', 'contractId', 'status', 'createdAt', 'completedAt'])),
    observations: project.observations,
    failures: project.failures,
    repairs: project.repairs,
    verifications: project.verifications,
    humanActions: project.humanActions ?? [],
    environmentRecords: project.environmentRecords ?? [],
    trajectory: project.events.filter((event: any) => event.type !== 'rights.recorded'),
  };
  return hashText(canonicalJson(content));
}
const eventFields: Record<string, string[]> = {
  'project.created': ['entryPoint', 'actor', 'challengeId', 'challengeVersion'],
  'contract.created': ['hash', 'valid'],
  'experiment.started': ['experimentId', 'mode', 'fault', 'backend', 'parentId'],
  'check.observed': ['experimentId', 'check', 'passed', 'source', 'artifactHash'],
  'verification.completed': ['id', 'experimentId', 'mode', 'status', 'passed', 'physical', 'checks', 'evidenceIds'],
  'repair.proposed': ['id', 'experimentId', 'category', 'retryAllowed', 'status'],
  'repair.confirmed': ['repairId', 'parentId', 'mode'],
  'human.action': ['actionId', 'actionType', 'experimentId', 'contractId', 'provenance'],
  'environment.reported': ['environmentId', 'quantity', 'experimentId', 'contractId', 'provenance'],
  'rights.recorded': ['rightsId', 'purpose', 'withdrawn'],
  'experiment.failed': ['experimentId'],
  'experiment.interrupted': ['experimentId'],
  'operation.interrupted': ['previousStatus'],
};

/** Allowlist export. Raw runtime/knowledge/tool envelopes are intentionally never copied. */
export function assembleEpisode(project: any, purpose: ExportPurpose, exportedAt: string) {
  const containsTestFixtures = [...(project.humanActions ?? []), ...(project.environmentRecords ?? [])].some(record => record.provenance === 'test_fixture');
  const currentContentHash = episodeContentHash(project);
  const eligibility = rightsEligibility(project.rightsRecords ?? [], purpose, containsTestFixtures, currentContentHash);
  if (!eligibility.eligible) throw new Error('Export authorization required: ' + eligibility.reasons.join('; '));
  const contracts = project.contracts.map((record: any) => {
    const contract = portable(record.contract);
    const exportedHash = hashText(canonicalJson(contract));
    return {id: record.id, version: record.version, contract, originalHash: record.hash,
      exportedHash, contentRedacted: exportedHash !== record.hash, createdAt: record.createdAt};
  });
  const firmware = project.firmwareArtifacts.map((record: any) => {
    const source = portableText(record.source);
    return {...pick(record, ['id', 'contractHash', 'experimentId', 'nonce', 'filename', 'fqbn', 'libraries', 'mode', 'createdAt']),
      source, originalHash: record.hash, originalSourceHash: record.sourceHash ?? record.hash, exportedHash: hashText(source), contentRedacted: hashText(source) !== record.hash};
  });
  const payload = {
    schemaVersion: 1,
    episodeId: project.id,
    exportedAt,
    purpose,
    actor: {id: 'local-operator-' + hashText(project.id).slice(0, 16), type: 'human', source: 'local operator; identity not verified'},
    task: portable(pick(project, ['goal', 'title', 'entryPoint', 'actor', 'challengeId', 'challengeVersion'])),
    chatMessages: (project.chatMessages ?? []).map((r:any)=>portable(pick(r,['id','role','purpose','message','contractId','draftId','experimentId','error','createdAt']))),
    designDrafts: (project.designDrafts ?? []).map((r:any)=>portable(pick(r,['id','version','status','componentIds','desiredBehavior','sizeConstraint','unresolved','contractId','reason','createdAt']))),
    contracts, firmwareArtifacts: firmware,
    agentRuns: project.agentRuns.map((r: any) => portable(pick(r, ['id', 'kind', 'experimentId', 'plan', 'diagnosis', 'provider', 'createdAt']))),
    experiments: project.experiments.map((r: any) => pick(r, ['id', 'mode', 'backend', 'fault', 'parentId', 'identity', 'contractId', 'status', 'createdAt', 'completedAt'])),
    observations: project.observations.map((r: any) => ({id: r.id, evidence: {...pick(r.evidence, ['experimentId', 'nonce', 'contractHash', 'firmwareHash', 'id', 'source', 'timestamp', 'check', 'passed', 'artifactHash', 'artifactId']), data: observationData(r.evidence.data)},
      artifactBodyOmitted: true, originalArtifactHash: r.artifact.hash})),
    failures: project.failures.map((r: any) => portable(pick(r, ['id', 'experimentId', 'category', 'createdAt']))),
    repairs: project.repairs.map((r: any) => portable(pick(r, ['id', 'experimentId', 'category', 'summary', 'checks', 'repair', 'retryAllowed', 'status', 'createdAt']))),
    verifications: project.verifications.map((r: any) => pick(r, ['id', 'experimentId', 'status', 'passed', 'physical', 'checks', 'mode', 'evidenceIds', 'createdAt'])),
    humanActions: (project.humanActions ?? []).map((r: any) => portable(r)),
    environmentRecords: (project.environmentRecords ?? []).map((r: any) => portable(r)),
    trajectory: project.events.map((event: any) => ({seq: event.seq, type: event.type, createdAt: event.createdAt,
      actorType: event.payload?.provenance === 'test_fixture' ? 'test' : event.type.startsWith('human.') || event.type.startsWith('environment.') || event.type.startsWith('rights.') || event.type === 'repair.confirmed' ? 'human' : event.type.startsWith('plan.') || event.type.startsWith('diagnosis.') || event.type === 'repair.proposed' ? 'agent' : 'system',
      payload: pick(event.payload ?? {}, eventFields[event.type] ?? [])})),
    rights: {currentContentHash, eligibility, eligibilityByPurpose: {research: rightsEligibility(project.rightsRecords ?? [], 'research', containsTestFixtures, currentContentHash), model_improvement: rightsEligibility(project.rightsRecords ?? [], 'model_improvement', containsTestFixtures, currentContentHash)}, records: (project.rightsRecords ?? []).map((r: any) => ({...pick(r, ['id', 'purpose', 'participant', 'participantConsent', 'schoolConsent', 'guardianConsent', 'reviewed', 'reviewedContentHash', 'withdrawn', 'policyVersion', 'source', 'createdAt']),
      authorizationReferenceHash: r.authorizationReference ? hashText(r.authorizationReference) : null}))},
    policy: {
      version: 'episode-export-v1',
      excluded: ['rawSerial', 'USB paths', 'tool logs', 'knowledge contexts', 'errors', 'session/credential fields', 'plaintext authorization references'],
      integrity: 'Original hashes identify stored artifacts. Exported hashes identify portable content after redaction. Observation bodies are omitted, so this export cannot recompute their original artifact hashes. Hashes are consistency identifiers, not external attestation.',
      privacy: 'Pseudonymous, not certified anonymous. Free text can contain identifying information; operator review is required before reuse.',
      processing: 'Human, environment and rights records stay local and are not ingested into knowledge or sent to frontier providers. Operational build goals and machine observations may be processed for build assistance.',
      evidence: 'Human reports cannot satisfy runtime checks. Simulation never proves a physical build.',
    },
  };
  return {...payload, integrity: {algorithm: 'sha256', exportedPayloadHash: hashText(canonicalJson(payload))}};
}
