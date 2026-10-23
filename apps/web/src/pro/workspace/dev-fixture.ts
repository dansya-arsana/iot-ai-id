/** Farm fixture for /pro/dev (the 4-field SystemSpec r1 from the contract package). */
import type {SystemSpec} from '../../../../../packages/pro-contract/system-spec';
import fixture from '../../../../../packages/pro-contract/fixtures/farm-4-fields/spec.r1.json';
import {proActions} from '../api/spec-store';

export const DEV_PROJECT_ID='dev-farm';
// The contract fixture predates the lab catalog; show its soil probe with the 3D part the lab ships (soil-capacitive-v2).
export const devSpec=JSON.parse(JSON.stringify(fixture).replaceAll('soil-moisture-capacitive','soil-capacitive-v2')) as unknown as SystemSpec;
export const loadDevFixture=()=>proActions.setSpec(DEV_PROJECT_ID,1,devSpec);
