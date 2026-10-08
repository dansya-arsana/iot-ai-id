/** Keep every displayed result tied to the newest experiment, including unfinished runs. */
export function currentRun(project: any) {
  const latest = project.experiments.at(-1);
  const experiment = project.activeDesign && project.activeDesign.status !== 'executable' ? undefined : latest && (!project.contractId || latest.contractId === project.contractId) ? latest : undefined;
  return {
    experiment,
    verification: project.verifications.filter((v: any) => experiment && v.experimentId === experiment.id).at(-1),
    observations: project.observations.filter((o: any) => experiment && o.evidence.experimentId === experiment.id),
    repair: project.repairs.filter((r: any) => experiment && r.experimentId === experiment.id).at(-1),
  };
}
