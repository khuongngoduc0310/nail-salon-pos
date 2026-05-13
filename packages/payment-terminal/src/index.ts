export type TerminalConnectionStatus = {
  connected: boolean;
  provider: "mock" | "clover";
  message?: string;
};

export type TerminalSaleRequest = {
  amountCents: number;
  tipCents: number;
  idempotencyKey: string;
};

export type TerminalPaymentStatus = "approved" | "declined" | "cancelled" | "failed";

export type TerminalPaymentResult = {
  status: TerminalPaymentStatus;
  providerPaymentId?: string;
  authCode?: string;
  cardBrand?: string;
  cardLast4?: string;
  message?: string;
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
  private readonly approvedPayments: TerminalPaymentResult[] = [];

  constructor(nextStatus: TerminalPaymentStatus = "approved") {
    this.nextStatus = nextStatus;
  }

  setNextStatus(status: TerminalPaymentStatus): void {
    this.nextStatus = status;
  }

  async verifyConnection(): Promise<TerminalConnectionStatus> {
    return { connected: true, provider: "mock", message: "Mock terminal ready" };
  }

  async startSale(input: TerminalSaleRequest): Promise<TerminalPaymentResult> {
    const status = this.nextStatus;

    if (status !== "approved") {
      return { status, message: `Mock ${status}` };
    }

    const result: TerminalPaymentResult = {
      status,
      providerPaymentId: `mock_${input.idempotencyKey}`,
      authCode: "MOCKOK",
      cardBrand: "Visa",
      cardLast4: "1111",
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

  async reconcile(): Promise<ReconciliationResult> {
    return {
      provider: "mock",
      cardTotalCents: 0,
      payments: [...this.approvedPayments],
    };
  }
}
