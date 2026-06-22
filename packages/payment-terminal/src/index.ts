export type TerminalConnectionStatus = {
  connected: boolean;
  provider: "mock" | "clover";
  message?: string;
  pairingRequired?: boolean;
  pairingCode?: string;
};

export type TerminalSaleRequest = {
  amountCents: number;
  tipCents: number;
  idempotencyKey: string;
  saleId?: string;
};

export type TerminalPaymentStatus = "approved" | "declined" | "cancelled" | "failed";

export type TerminalPaymentResult = {
  status: TerminalPaymentStatus;
  provider?: "mock" | "clover";
  providerPaymentId?: string;
  providerOrderId?: string;
  externalPaymentId?: string;
  saleId?: string;
  authCode?: string;
  cardBrand?: string;
  cardLast4?: string;
  baseAmountCents?: number;
  tipCents?: number;
  totalChargedCents?: number;
  message?: string;
  rawProviderReference?: Record<string, unknown>;
};

export type TerminalRefundRequest = {
  providerPaymentId: string;
  amountCents: number;
  reason?: string;
};

export type TerminalRefundResult = {
  status: "approved" | "declined" | "failed";
  providerRefundId?: string;
  message?: string;
};

export type ReconciliationRequest = {
  start: Date;
  end: Date;
  externalPaymentId?: string;
};

export type ReconciliationResult = {
  provider: "mock" | "clover";
  cardTotalCents: number;
  payments: TerminalPaymentResult[];
};

export interface PaymentTerminalAdapter {
  verifyConnection(): Promise<TerminalConnectionStatus>;
  startSale(input: TerminalSaleRequest): Promise<TerminalPaymentResult>;
  cancelCurrentAction(): Promise<void>;
  refund(input: TerminalRefundRequest): Promise<TerminalRefundResult>;
  reconcile(input: ReconciliationRequest): Promise<ReconciliationResult>;
}

export class MockTerminalAdapter implements PaymentTerminalAdapter {
  private nextStatus: TerminalPaymentStatus;
  private nextTipCents: number;
  private readonly approvedPayments: TerminalPaymentResult[] = [];

  constructor(nextStatus: TerminalPaymentStatus = "approved", nextTipCents = 0) {
    this.nextStatus = nextStatus;
    this.nextTipCents = nextTipCents;
  }

  setNextStatus(status: TerminalPaymentStatus): void {
    this.nextStatus = status;
  }

  setNextTipCents(tipCents: number): void {
    if (!Number.isInteger(tipCents) || tipCents < 0) {
      throw new Error("tipCents must be a non-negative integer");
    }
    this.nextTipCents = tipCents;
  }

  async verifyConnection(): Promise<TerminalConnectionStatus> {
    return { connected: true, provider: "mock", message: "Mock terminal ready" };
  }

  async startSale(input: TerminalSaleRequest): Promise<TerminalPaymentResult> {
    const status = this.nextStatus;

    if (status !== "approved") {
      return { status, message: `Mock ${status}` };
    }

    const tipCents = this.nextTipCents;
    const result: TerminalPaymentResult = {
      status,
      provider: "mock",
      providerPaymentId: `mock_${input.idempotencyKey}`,
      providerOrderId: input.saleId ? `mock_order_${input.saleId}` : undefined,
      externalPaymentId: input.idempotencyKey,
      saleId: input.saleId,
      authCode: "MOCKOK",
      cardBrand: "Visa",
      cardLast4: "1111",
      baseAmountCents: input.amountCents,
      tipCents,
      totalChargedCents: input.amountCents + tipCents,
    };
    this.approvedPayments.push(result);
    return result;
  }

  async cancelCurrentAction(): Promise<void> {
    this.nextStatus = "cancelled";
  }

  async refund(input: TerminalRefundRequest): Promise<TerminalRefundResult> {
    return {
      status: "approved",
      providerRefundId: `mock_refund_${input.providerPaymentId}_${input.amountCents}`,
    };
  }

  async reconcile(_input?: ReconciliationRequest): Promise<ReconciliationResult> {
    const payments = _input?.externalPaymentId
      ? this.approvedPayments.filter((payment) => payment.externalPaymentId === _input.externalPaymentId)
      : this.approvedPayments;
    return {
      provider: "mock",
      cardTotalCents: payments.reduce((sum, payment) => sum + (payment.totalChargedCents ?? 0), 0),
      payments: [...payments],
    };
  }
}
