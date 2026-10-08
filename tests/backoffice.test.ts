import {test} from 'node:test';
import assert from 'node:assert/strict';
import {backofficeAggregates} from '../services/api/backoffice-aggregates.js';

test('dashboard aggregates include experiments and active jobs beyond recent display limits', () => {
  const experiments = Array.from({length: 91}, (_, index) => ({createdAt: index < 60 ? '2026-10-06T12:00:00Z' : '2026-09-01T12:00:00Z'}));
  const jobs = Array.from({length: 24}, (_, index) => ({status: index < 20 ? 'completed' : index < 22 ? 'awaiting_approval' : 'running'}));
  const result = backofficeAggregates(experiments, jobs);
  assert.deepEqual(result.experimentDaily, [{date:'2026-09-01',count:31},{date:'2026-10-06',count:60}]);
  assert.equal(result.experimentDaily.reduce((sum, day) => sum + day.count, 0), 91);
  assert.equal(result.activeRemoteJobs, 4);
  assert.equal(result.awaitingApproval, 2);
  assert.equal(result.activeJobs.length, 4);
  assert.deepEqual(backofficeAggregates([], []), {experimentDaily:[],activeJobs:[],activeRemoteJobs:0,awaitingApproval:0});
});

test('approval expiry boundary excludes past and equal deadlines while running remains counted',()=>{
 const now=1000;
 const jobs=[{status:'awaiting_approval',input:{expiresAt:999}},{status:'awaiting_approval',input:{expiresAt:1000}},{status:'awaiting_approval',input:{expiresAt:1001}},{status:'running',input:{expiresAt:999}},{status:'awaiting_approval'},{status:'awaiting_approval',input:{expiresAt:NaN}}];
 const result=backofficeAggregates([],jobs,now);
 assert.deepEqual(result.activeJobs,[jobs[2],jobs[3],jobs[4]]);
 assert.equal(result.awaitingApproval,2);
 assert.equal(result.activeRemoteJobs,3);
});
