import { describe, expect, it } from "vitest";
import { MockTerminalAdapter } from "./index.js";

describe("MockTerminalAdapter", () => {
  it("returns approved card metadata without storing sensitive card data", async () => {
    const adapter = new MockTerminalAdapter("approved");

    await expect(
      adapter.startSale({ amountCents: 6000, tipCents: 1000, idempotencyKey: "abc" })
    ).resolves.toMatchObject({
      status: "approved",
      providerPaymentId: "mock_abc",
      authCode: "MOCKOK",
      cardBrand: "Visa",
      cardLast4: "1111",
    });
  });

  it.each(["declined", "cancelled", "failed"] as const)("represents %s without Clover", async (status) => {
    const adapter = new MockTerminalAdapter(status);

    await expect(adapter.startSale({ amountCents: 6000, tipCents: 0, idempotencyKey: status })).resolves.toMatchObject({
      status,
    });
  });
});
