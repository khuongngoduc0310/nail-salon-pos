import { describe, expect, it } from "vitest";
import { MockTerminalAdapter } from "./index.js";

describe("MockTerminalAdapter", () => {
  it("returns approved card metadata without storing sensitive card data", async () => {
    const adapter = new MockTerminalAdapter("approved", 1000);

    await expect(
      adapter.startSale({ amountCents: 6000, tipCents: 0, idempotencyKey: "abc", saleId: "sale-1" })
    ).resolves.toMatchObject({
      status: "approved",
      providerPaymentId: "mock_abc",
      providerOrderId: "mock_order_sale-1",
      externalPaymentId: "abc",
      saleId: "sale-1",
      authCode: "MOCKOK",
      cardBrand: "Visa",
      cardLast4: "1111",
      baseAmountCents: 6000,
      tipCents: 1000,
      totalChargedCents: 7000,
    });
  });

  it.each(["declined", "cancelled", "failed"] as const)("represents %s without Clover", async (status) => {
    const adapter = new MockTerminalAdapter(status);

    await expect(adapter.startSale({ amountCents: 6000, tipCents: 0, idempotencyKey: status })).resolves.toMatchObject({
      status,
    });
  });

  it("reconciles approved payment totals", async () => {
    const adapter = new MockTerminalAdapter("approved", 250);

    await adapter.startSale({ amountCents: 1000, tipCents: 0, idempotencyKey: "one" });
    await adapter.startSale({ amountCents: 2000, tipCents: 0, idempotencyKey: "two" });

    await expect(adapter.reconcile({ start: new Date(0), end: new Date() })).resolves.toMatchObject({
      provider: "mock",
      cardTotalCents: 3500,
      payments: [{ externalPaymentId: "one" }, { externalPaymentId: "two" }],
    });
  });
});
