export type WorkerReportKey = "workers" | "sales" | "turns";

export type WorkerReportTarget = {
  report: WorkerReportKey;
  workerId: string;
};

export function buildWorkerReportTarget(workerId: string, report: WorkerReportKey = "workers"): WorkerReportTarget {
  return { report, workerId };
}
