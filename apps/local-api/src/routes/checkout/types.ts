import type { PaymentMethod, PaymentStatus } from "@nail/shared";

export type ServiceRecord = {
  id: string;
  name: string;
  priceCents: number;
  category?: { name?: string | null } | null;
};

export type WorkerRecord = {
  id: string;
  commissionRate: number | string | { toString(): string };
};

export type SaleRecord = {
  id: string;
  checkinId?: string | null;
  status?: string;
  completedAt?: Date | string | null;
  totalCents: number;
  amountPaidCents?: number;
  items?: SaleItemRecord[];
  payments?: PaymentRecord[];
};

export type SaleItemRecord = {
  id: string;
  saleId?: string;
  serviceId?: string | null;
  workerId?: string;
  serviceNameSnapshot?: string;
  categoryNameSnapshot?: string | null;
  priceCents: number;
  discountCents: number;
  finalServiceCents?: number;
  tipCents: number;
  status?: string;
  commissionRateSnapshot?: number | string | { toString(): string };
};

export type OwnerUserRecord = {
  id: string;
  role: string;
  pinHash: string | null;
  active?: boolean;
};

export type PaymentRecord = {
  id?: string;
  saleId?: string;
  method: PaymentMethod;
  provider?: string | null;
  providerPaymentId?: string | null;
  providerOrderId?: string | null;
  idempotencyKey?: string | null;
  authCode?: string | null;
  rawProviderReference?: unknown;
  amountCents: number;
  tipCents?: number;
  status: PaymentStatus;
  createdAt?: Date | string;
};
