/** Farm fixture for /pro/dev (the 4-field SystemSpec r1 from the contract package). */
import type {SystemSpec} from '../../../../../packages/pro-contract/system-spec';
import fixture from '../../../../../packages/pro-contract/fixtures/farm-4-fields/spec.r1.json';
import {buildChecklist} from '../../../../../packages/pro-tools/impl/checklist';
import {proActions} from '../api/spec-store';

export const DEV_PROJECT_ID='dev-farm';
// The contract fixture predates the lab catalog; show its soil probe with the 3D part the lab ships (soil-capacitive-v2).
const base=JSON.parse(JSON.stringify(fixture).replaceAll('soil-moisture-capacitive','soil-capacitive-v2')) as unknown as SystemSpec;
// The contract fixture's checklist is a 5-item stub; the dev copy uses the server generator so the checklist, print and progress views have real content.
export const devSpec:SystemSpec={...base,checklist:buildChecklist(base)};
export const loadDevFixture=()=>proActions.setSpec(DEV_PROJECT_ID,1,devSpec);
