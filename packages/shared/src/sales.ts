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

export type TipAllocationMode = "even_workers" | "service_amount_percentage";

export type TipAllocationItemInput = {
  id: string;
  workerId: string;
  finalServiceCents: number;
  tipCents?: number;
};

export type TipAllocation = {
  itemId: string;
  addedTipCents: number;
  tipCents: number;
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

export function allocateTipToSaleItems(
  items: TipAllocationItemInput[],
  tipCents: number,
  mode: TipAllocationMode
): TipAllocation[] {
  assertNonNegativeInteger(tipCents, "tipCents");

  if (items.length === 0) return [];
  if (tipCents === 0) {
    return items.map((item) => ({ itemId: item.id, addedTipCents: 0, tipCents: item.tipCents ?? 0 }));
  }

  const addedByItem = mode === "even_workers"
    ? allocateEvenlyByWorkerThenServiceAmount(items, tipCents)
    : allocateByWeight(items, tipCents, (item) => item.finalServiceCents);

  return items.map((item, index) => {
    const addedTipCents = addedByItem[index] ?? 0;
    return {
      itemId: item.id,
      addedTipCents,
      tipCents: (item.tipCents ?? 0) + addedTipCents,
    };
  });
}

function allocateEvenlyByWorkerThenServiceAmount(items: TipAllocationItemInput[], tipCents: number): number[] {
  const workerOrder: string[] = [];
  const itemIndexesByWorker = new Map<string, number[]>();

  items.forEach((item, index) => {
    if (!itemIndexesByWorker.has(item.workerId)) {
      workerOrder.push(item.workerId);
      itemIndexesByWorker.set(item.workerId, []);
    }
    itemIndexesByWorker.get(item.workerId)?.push(index);
  });

  const workerShares = allocateByCount(workerOrder.length, tipCents);
  const result = new Array(items.length).fill(0) as number[];

  workerOrder.forEach((workerId, workerIndex) => {
    const indexes = itemIndexesByWorker.get(workerId) ?? [];
    const workerItems = indexes.map((index) => items[index]);
    const itemShares = allocateByWeight(workerItems, workerShares[workerIndex] ?? 0, (item) => item.finalServiceCents);
    indexes.forEach((itemIndex, shareIndex) => {
      result[itemIndex] = itemShares[shareIndex] ?? 0;
    });
  });

  return result;
}

function allocateByCount(count: number, amountCents: number): number[] {
  if (count <= 0) return [];
  const base = Math.floor(amountCents / count);
  const remainder = amountCents - base * count;
  return Array.from({ length: count }, (_, index) => base + (index < remainder ? 1 : 0));
}

function allocateByWeight<T>(items: T[], amountCents: number, getWeight: (item: T) => number): number[] {
  if (items.length === 0) return [];

  const weights = items.map((item) => Math.max(0, getWeight(item)));
  const totalWeight = weights.reduce((sum, weight) => sum + weight, 0);
  if (totalWeight <= 0) return allocateByCount(items.length, amountCents);

  const provisional = weights.map((weight, index) => {
    const numerator = amountCents * weight;
    const cents = Math.floor(numerator / totalWeight);
    return { index, cents, remainder: numerator - cents * totalWeight };
  });
  let allocated = provisional.reduce((sum, item) => sum + item.cents, 0);
  const byRemainder = [...provisional].sort((a, b) => b.remainder - a.remainder || a.index - b.index);

  for (const item of byRemainder) {
    if (allocated >= amountCents) break;
    item.cents += 1;
    allocated += 1;
  }

  return provisional.sort((a, b) => a.index - b.index).map((item) => item.cents);
}
