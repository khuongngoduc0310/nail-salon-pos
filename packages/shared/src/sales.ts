import { assertNonNegativeInteger, calculateCommission } from "./money.js";

export type PaymentMethod = "cash" | "card" | "gift_card" | "other";
export type PaymentStatus = "pending" | "approved" | "declined" | "cancelled" | "failed" | "refunded";

export type SaleItemInput = {
  priceCents: number;
  discountCents: number;
  tipCents: number;
};

export type SaleItemCalculationInput = {
  serviceId?: string;
  workerId: string;
  serviceNameSnapshot: string;
  categoryNameSnapshot?: string | null;
  priceCents: number;
  discountCents: number;
  tipCents: number;
  commissionRate: number;
};

export type SaleItemCalculation = {
  serviceId?: string;
  workerId: string;
  serviceNameSnapshot: string;
  categoryNameSnapshot?: string | null;
  priceCents: number;
  discountCents: number;
  finalServiceCents: number;
  commissionRateSnapshot: number;
  workerCommissionCents: number;
  tipCents: number;
  workerTotalCents: number;
  businessCents: number;
};

export type PaymentInput = {
  method: PaymentMethod;
  amountCents: number;
  status: PaymentStatus;
};

export type SaleTotals = {
  subtotalCents: number;
  discountTotalCents: number;
  tipTotalCents: number;
  totalCents: number;
};

export type SaleCompletionResult = {
  canComplete: boolean;
  amountPaidCents: number;
  balanceDueCents: number;
  changeDueCents: number;
};

export type SaleSummary = SaleTotals &
  SaleCompletionResult & {
    status: "open" | "partially_paid" | "paid";
  };

export type PaymentRequest = {
  method: PaymentMethod;
  amountCents: number;
  tipCents?: number;
  idempotencyKey?: string;
};

export function calculateSaleItem(input: SaleItemCalculationInput): SaleItemCalculation {
  const commission = calculateCommission({
    servicePriceCents: input.priceCents,
    discountCents: input.discountCents,
    commissionRate: input.commissionRate,
    tipCents: input.tipCents,
  });

  return {
    serviceId: input.serviceId,
    workerId: input.workerId,
    serviceNameSnapshot: input.serviceNameSnapshot,
    categoryNameSnapshot: input.categoryNameSnapshot,
    priceCents: input.priceCents,
    discountCents: Math.min(input.discountCents, input.priceCents),
    finalServiceCents: commission.finalServiceCents,
    commissionRateSnapshot: input.commissionRate,
    workerCommissionCents: commission.workerCommissionCents,
    tipCents: input.tipCents,
    workerTotalCents: commission.workerTotalCents,
    businessCents: commission.businessCents,
  };
}

export function calculateSaleTotals(items: SaleItemInput[]): SaleTotals {
  const subtotalCents = items.reduce((sum, item) => {
    assertNonNegativeInteger(item.priceCents, "priceCents");
    return sum + item.priceCents;
  }, 0);

  const discountTotalCents = items.reduce((sum, item) => {
    assertNonNegativeInteger(item.discountCents, "discountCents");
    return sum + Math.min(item.discountCents, item.priceCents);
  }, 0);

  const tipTotalCents = items.reduce((sum, item) => {
    assertNonNegativeInteger(item.tipCents, "tipCents");
    return sum + item.tipCents;
  }, 0);

  return {
    subtotalCents,
    discountTotalCents,
    tipTotalCents,
    totalCents: subtotalCents - discountTotalCents + tipTotalCents,
  };
}

export function getApprovedPaymentTotal(payments: PaymentInput[]): number {
  return payments.reduce((sum, payment) => {
    assertNonNegativeInteger(payment.amountCents, "amountCents");
    return payment.status === "approved" ? sum + payment.amountCents : sum;
  }, 0);
}

export function evaluateSaleCompletion(totalCents: number, payments: PaymentInput[]): SaleCompletionResult {
  assertNonNegativeInteger(totalCents, "totalCents");

  const amountPaidCents = getApprovedPaymentTotal(payments);
  const canComplete = amountPaidCents >= totalCents;

  return {
    canComplete,
    amountPaidCents,
    balanceDueCents: canComplete ? 0 : totalCents - amountPaidCents,
    changeDueCents: canComplete ? amountPaidCents - totalCents : 0,
  };
}

export function summarizeSale(items: SaleItemInput[], payments: PaymentInput[]): SaleSummary {
  const totals = calculateSaleTotals(items);
  const completion = evaluateSaleCompletion(totals.totalCents, payments);
  const status = completion.canComplete ? "paid" : completion.amountPaidCents > 0 ? "partially_paid" : "open";

  return {
    ...totals,
    ...completion,
    status,
  };
}
