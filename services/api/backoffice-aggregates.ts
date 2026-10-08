import {approvalPending,type ApprovalJob} from '../../packages/job-protocol/approval.js';
export function backofficeAggregates(experiments: {createdAt: string}[], jobs: ApprovalJob[], now=Date.now()) {
  const dailyCounts = new Map<string, number>();
  for (const experiment of experiments) {
    const day = experiment.createdAt.slice(0, 10);
    dailyCounts.set(day, (dailyCounts.get(day) ?? 0) + 1);
  }
  const experimentDaily = Array.from(dailyCounts, ([date, count]) => ({date, count}))
    .sort((a, b) => a.date.localeCompare(b.date));
  const activeJobs = jobs.filter(job => job.status === 'running' || approvalPending(job,now));
  return {experimentDaily, activeJobs, activeRemoteJobs: activeJobs.length,
    awaitingApproval: activeJobs.filter(job => job.status === 'awaiting_approval').length};
}
