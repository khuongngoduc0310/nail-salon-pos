import { describe, expect, it } from "vitest";
import { normalizePhone } from "./phone.js";

describe("normalizePhone", () => {
  it("normalizes US local numbers", () => {
    expect(normalizePhone("(555) 123-4567")).toBe("+15551234567");
  });

  it("normalizes 11-digit US numbers", () => {
    expect(normalizePhone("1-555-123-4567")).toBe("+15551234567");
  });

  it("keeps international numbers", () => {
    expect(normalizePhone("+84 912 345 678")).toBe("+84912345678");
  });
});
