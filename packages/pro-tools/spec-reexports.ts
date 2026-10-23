/** Re-exports of the SystemSpec vocabulary the registry needs (keeps registry.ts imports short). */
export {Slug,PRO_BOARDS,PinRowSchema,PRO_LIMITS,FILENAME_RE,CheckSchema} from '../pro-contract/system-spec.js';
export const SpecIssueSeverities=['error','warning','info'] as const;
