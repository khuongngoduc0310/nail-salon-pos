export type PaymentEntry = {
  id?: string;
  method: string;
  amountCents: number;
  tipCents?: number;
  provider?: string | null;
  providerOrderId?: string | null;
  providerPaymentId?: string | null;
  authCode?: string | null;
  cardBrand?: string | null;
  cardLast4?: string | null;
};

export type CheckoutItem = {
  saleItemId?: string;
  serviceId?: string;
  workerId?: string;
  serviceName: string;
  workerName: string;
  category: string;
  priceCents: number;
  discountCents: number;
  tipCents: number;
};

export type CheckoutMode = "active" | "done";

export type CheckoutDraft = {
  saleId: string | null;
  items: CheckoutItem[];
  payments: PaymentEntry[];
  selectedWorkerId: string | null;
  amountCents: number;
  changeCents: number;
  hasStarted: boolean;
  activeCategory: string;
  activeMethod: string;
  pendingTipAllocation: { paymentId: string; tipCents: number } | null;
  mode: CheckoutMode;
  savedAt: number;
};
