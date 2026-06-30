export type CommissionInput = {
  servicePriceCents: number;
  discountCents: number;
  commissionRate: number;
  tipCents: number;
};

export type CommissionResult = {
  finalServiceCents: number;
  workerCommissionCents: number;
  workerTotalCents: number;
  businessCents: number;
};

export function calculateCommission(input: CommissionInput): CommissionResult {
  assertNonNegativeInteger(input.servicePriceCents, "servicePriceCents");
  assertNonNegativeInteger(input.discountCents, "discountCents");
  assertNonNegativeInteger(input.tipCents, "tipCents");

  if (input.commissionRate < 0 || input.commissionRate > 1) {
    throw new RangeError("commissionRate must be between 0 and 1");
  }

  const finalServiceCents = Math.max(input.servicePriceCents - input.discountCents, 0);
  const workerCommissionCents = Math.round(finalServiceCents * input.commissionRate);
  const workerTotalCents = workerCommissionCents + input.tipCents;
  const businessCents = finalServiceCents - workerCommissionCents;

  return {
    finalServiceCents,
    workerCommissionCents,
    workerTotalCents,
    businessCents,
  };
}

export function assertNonNegativeInteger(value: number, fieldName: string): void {
  if (!Number.isInteger(value) || value < 0) {
    throw new RangeError(`${fieldName} must be a non-negative integer`);
  }
}

export function readCents(value: unknown): number {
  return typeof value === "number" && Number.isFinite(value) ? value : 0;
}

export function calculateFinalServiceCents(priceCents: unknown, discountCents: unknown): number {
  return Math.max(readCents(priceCents) - readCents(discountCents), 0);
}
