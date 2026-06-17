import { describe, expect, it } from "vitest";
import { buildWorkerReportTarget } from "./reportTarget.js";

describe("worker report target", () => {
  it("defaults worker card navigation to the earnings report", () => {
    expect(buildWorkerReportTarget("worker-1")).toEqual({
      report: "workers",
      workerId: "worker-1",
    });
  });

  it("supports explicit sales and turns report targets", () => {
    expect(buildWorkerReportTarget("worker-1", "sales")).toEqual({
      report: "sales",
      workerId: "worker-1",
    });
    expect(buildWorkerReportTarget("worker-1", "turns")).toEqual({
      report: "turns",
      workerId: "worker-1",
    });
  });
});
