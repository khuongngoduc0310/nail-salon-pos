import { describe, expect, it } from "vitest";
import {
  calculateCommission,
  calculateSaleItem,
  calculateSaleTotals,
  countTurnsTaken,
  evaluateSaleCompletion,
  rankSuggestedWorkers,
  summarizeSale,
  type PaymentInput,
} from "./index.js";

describe("commission calculation", () => {
  it("calculates commission, tips, and business share from the test plan example", () => {
    expect(
      calculateCommission({
        servicePriceCents: 5000,
        discountCents: 500,
        commissionRate: 0.6,
        tipCents: 1000,
      })
    ).toEqual({
      finalServiceCents: 4500,
      workerCommissionCents: 2700,
      workerTotalCents: 3700,
      businessCents: 1800,
    });
  });
});

describe("turn counting", () => {
  it("does not count assigned turns before service starts", () => {
    expect(countTurnsTaken([{ status: "assigned", startedAt: null }])).toBe(0);
  });

  it("counts started and completed turns", () => {
    expect(
      countTurnsTaken([
        { status: "in_service", startedAt: "2026-05-12T15:00:00-05:00" },
        { status: "completed", startedAt: "2026-05-12T16:00:00-05:00" },
      ])
    ).toBe(2);
  });

  it("does not count a skipped turn unless it previously started", () => {
    expect(
      countTurnsTaken([
        { status: "skipped", startedAt: null },
        { status: "skipped", startedAt: "2026-05-12T17:00:00-05:00" },
      ])
    ).toBe(1);
  });
});

describe("worker suggestions", () => {
  it("ranks available workers by turns, last turn, sales, and name", () => {
    const ranked = rankSuggestedWorkers([
      {
        workerId: "busy",
        name: "Busy",
        status: "in_service",
        turnsTakenToday: 0,
        lastTurnEndedAt: null,
        salesTodayCents: 0,
      },
      {
        workerId: "bella",
        name: "Bella",
        status: "available",
        turnsTakenToday: 1,
        lastTurnEndedAt: "2026-05-12T17:00:00.000Z",
        salesTodayCents: 3000,
      },
      {
        workerId: "amy",
        name: "Amy",
        status: "available",
        turnsTakenToday: 1,
        lastTurnEndedAt: "2026-05-12T15:00:00.000Z",
        salesTodayCents: 5000,
      },
      {
        workerId: "cindy",
        name: "Cindy",
        status: "appointment_only",
        turnsTakenToday: 0,
        lastTurnEndedAt: null,
        salesTodayCents: 0,
      },
    ]);

    expect(ranked.map((worker) => [worker.workerId, worker.suggestionRank])).toEqual([
      ["amy", 1],
      ["bella", 2],
      ["cindy", 3],
    ]);
  });
});

describe("sale completion", () => {
  it("does not complete when underpaid", () => {
    expect(evaluateSaleCompletion(12000, [{ method: "cash", amountCents: 4000, status: "approved" }])).toEqual({
      canComplete: false,
      amountPaidCents: 4000,
      balanceDueCents: 8000,
      changeDueCents: 0,
    });
  });

  it("completes when exact paid", () => {
    expect(evaluateSaleCompletion(12000, [{ method: "cash", amountCents: 12000, status: "approved" }])).toEqual({
      canComplete: true,
      amountPaidCents: 12000,
      balanceDueCents: 0,
      changeDueCents: 0,
    });
  });

  it("reports cash overpayment as change due, not additional revenue", () => {
    expect(evaluateSaleCompletion(12000, [{ method: "cash", amountCents: 13000, status: "approved" }])).toEqual({
      canComplete: true,
      amountPaidCents: 13000,
      balanceDueCents: 0,
      changeDueCents: 1000,
    });
  });

  it("supports the split payment example", () => {
    const payments: PaymentInput[] = [
      { method: "gift_card", amountCents: 2000, status: "approved" },
      { method: "cash", amountCents: 4000, status: "approved" },
      { method: "card", amountCents: 6000, status: "approved" },
    ];

    expect(evaluateSaleCompletion(12000, payments)).toEqual({
      canComplete: true,
      amountPaidCents: 12000,
      balanceDueCents: 0,
      changeDueCents: 0,
    });
  });
});

describe("sale totals", () => {
  it("calculates subtotal, discounts, tips, and total", () => {
    expect(
      calculateSaleTotals([
        { priceCents: 5000, discountCents: 500, tipCents: 1000 },
        { priceCents: 7000, discountCents: 0, tipCents: 1500 },
      ])
    ).toEqual({
      subtotalCents: 12000,
      discountTotalCents: 500,
      tipTotalCents: 2500,
      totalCents: 14000,
    });
  });

  it("creates sale item snapshots with commission based on discounted service amount", () => {
    expect(
      calculateSaleItem({
        serviceId: "service-1",
        workerId: "worker-1",
        serviceNameSnapshot: "Classic Pedicure",
        categoryNameSnapshot: "Pedicure",
        priceCents: 5000,
        discountCents: 500,
        tipCents: 1000,
        commissionRate: 0.6,
      })
    ).toEqual({
      serviceId: "service-1",
      workerId: "worker-1",
      serviceNameSnapshot: "Classic Pedicure",
      categoryNameSnapshot: "Pedicure",
      priceCents: 5000,
      discountCents: 500,
      finalServiceCents: 4500,
      commissionRateSnapshot: 0.6,
      workerCommissionCents: 2700,
      tipCents: 1000,
      workerTotalCents: 3700,
      businessCents: 1800,
    });
  });

  it("summarizes sale totals and approved payments", () => {
    expect(
      summarizeSale(
        [
          { priceCents: 7000, discountCents: 1000, tipCents: 1000 },
          { priceCents: 5000, discountCents: 0, tipCents: 0 },
        ],
        [
          { method: "gift_card", amountCents: 2000, status: "approved" },
          { method: "cash", amountCents: 4000, status: "approved" },
        ]
      )
    ).toEqual({
      subtotalCents: 12000,
      discountTotalCents: 1000,
      tipTotalCents: 1000,
      totalCents: 12000,
      canComplete: false,
      amountPaidCents: 6000,
      balanceDueCents: 6000,
      changeDueCents: 0,
      status: "partially_paid",
    });
  });
});
