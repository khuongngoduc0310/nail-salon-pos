import { describe, expect, it } from "vitest";
import { buildWorkerSavePayload } from "./workerForm.js";

const baseInput = {
  mode: "create" as const,
  name: "Amy Nguyen",
  displayName: "Amy",
  email: "amy@example.com",
  phone: "555-0100",
  commissionText: "60",
  pin: "2468",
};

describe("worker form payload", () => {
  it("builds a create payload with a required PIN", () => {
    expect(buildWorkerSavePayload(baseInput)).toEqual({
      ok: true,
      kind: "create",
      data: {
        name: "Amy Nguyen",
        displayName: "Amy",
        email: "amy@example.com",
        phone: "555-0100",
        commissionRate: 0.6,
        pin: "2468",
      },
    });
  });

  it("rejects create without a worker PIN", () => {
    expect(buildWorkerSavePayload({ ...baseInput, pin: "" })).toEqual({
      ok: false,
      error: "Worker PIN is required.",
    });
  });

  it("allows edit with a blank PIN and omits it from the payload", () => {
    expect(buildWorkerSavePayload({ ...baseInput, mode: "edit", pin: "" })).toEqual({
      ok: true,
      kind: "update",
      data: {
        displayName: "Amy",
        commissionRate: 0.6,
        pin: undefined,
      },
    });
  });

  it("includes a valid replacement PIN on edit", () => {
    expect(buildWorkerSavePayload({ ...baseInput, mode: "edit", pin: "1357" })).toMatchObject({
      ok: true,
      kind: "update",
      data: {
        pin: "1357",
      },
    });
  });

  it("rejects non-digit, short, and long PIN values", () => {
    for (const pin of ["12ab", "123", "1234567"]) {
      expect(buildWorkerSavePayload({ ...baseInput, pin })).toEqual({
        ok: false,
        error: "Worker PIN must be 4 to 6 digits.",
      });
    }
  });

  it("rejects missing names and invalid commission rates", () => {
    expect(buildWorkerSavePayload({ ...baseInput, name: " " })).toEqual({
      ok: false,
      error: "Name is required.",
    });
    expect(buildWorkerSavePayload({ ...baseInput, commissionText: "101" })).toEqual({
      ok: false,
      error: "Commission rate must be between 0 and 100.",
    });
  });
});
