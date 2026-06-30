const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? getDefaultApiBaseUrl();
const OWNER_AUTH_ID = import.meta.env.VITE_OWNER_AUTH_ID ?? "owner@example.com";

function getDefaultApiBaseUrl(): string {
  return `http://${window.location.hostname}:4000/api`;
}

/* ════════════════════════════════════════
   Types
   ════════════════════════════════════════ */

export type TurnDashboardWorker = {
  workerId: string;
  name: string;
  status: string;
  turnsTakenToday: number;
  lastTurnEndedAt: string | null;
  activeTurn: unknown | null;
  salesTodayCents: number;
  tipsTodayCents: number;
  suggestionRank: number | null;
  checkedIn: boolean;
  turns: TurnDetailEntry[];
};

export type TurnDetailEntry = {
  turnId: string;
  status: string;
  turnCount: number;
  customerName: string;
  services: {
    serviceName: string;
    categoryName: string;
    turnCount: number;
    priceCents: number;
  }[];
};

export type Checkin = {
  id: string;
  status: string;
  notes?: string | null;
  checkedInAt: string;
  customer?: {
    name?: string | null;
    phone?: string | null;
  } | null;
};

export type ServiceCategory = {
  id: string;
  name: string;
  sortOrder: number;
  active: boolean;
  services?: Service[];
};

export type Service = {
  id: string;
  categoryId: string;
  name: string;
  description: string | null;
  priceCents: number;
  turnCount: number;
  durationMinutes: number;
  active: boolean;
  sortOrder: number;
  category?: { id: string; name: string };
};

export type Worker = {
  id: string;
  userId: string;
  displayName: string;
  commissionRate: number;
  currentStatus: string;
  active: boolean;
  sortOrder: number;
  user?: { id: string; name: string; email: string | null; phone: string | null };
};

/* ════════════════════════════════════════
   Dashboard & Checkout Endpoints
   ════════════════════════════════════════ */

export async function fetchTurnDashboard(options?: {
  currentSessionOnly?: boolean;
}): Promise<{ workers: TurnDashboardWorker[] }> {
  const query = options?.currentSessionOnly ? "?currentSessionOnly=true" : "";
  return fetchJson(`/turns/dashboard${query}`);
}

export async function fetchWaitingCheckins(): Promise<Checkin[]> {
  return fetchJson("/checkins?status=waiting");
}

export async function fetchReadyForCheckoutCheckins(): Promise<Checkin[]> {
  return fetchJson("/checkins?status=ready_for_checkout");
}

export async function createSaleForCheckin(checkinId: string): Promise<{ id: string }> {
  return fetchJson("/sales", {
    method: "POST",
    body: JSON.stringify({ checkinId }),
  });
}

export async function verifyOwnerPin(pin: string): Promise<boolean> {
  try {
    const result = await fetchJson<{ user: { role: string } }>("/auth/login", {
      method: "POST",
      body: JSON.stringify({
        emailOrPhone: OWNER_AUTH_ID,
        passwordOrPin: pin,
      }),
    });
    return result.user.role === "owner";
  } catch {
    return false;
  }
}

/* ════════════════════════════════════════
   Turn Assignment Endpoints
   ════════════════════════════════════════ */

export async function assignTurn(data: {
  checkinId: string;
  workerId: string;
  turnType?: string;
  suggestedWorkerId?: string;
}): Promise<{ turn: unknown; checkin: unknown }> {
  return fetchJson("/turns/assign", {
    method: "POST",
    body: JSON.stringify(data),
  });
}

export async function updateTurnCount(turnId: string, turnCount: number): Promise<unknown> {
  return fetchJson(`/turns/${turnId}`, {
    method: "PATCH",
    body: JSON.stringify({ turnCount }),
  });
}

/* ════════════════════════════════════════
   Service Catalog Endpoints
   ════════════════════════════════════════ */

export async function fetchServiceCategories(): Promise<ServiceCategory[]> {
  return fetchJson("/service-categories");
}

export async function createServiceCategory(data: {
  name: string;
  sortOrder?: number;
}): Promise<{ id: string }> {
  return fetchJson("/service-categories", {
    method: "POST",
    body: JSON.stringify(data),
  });
}

export async function fetchServices(params?: {
  active?: boolean;
  categoryId?: string;
}): Promise<Service[]> {
  const query = new URLSearchParams();
  if (params?.active !== undefined) query.set("active", String(params.active));
  if (params?.categoryId) query.set("categoryId", params.categoryId);
  const qs = query.toString();
  return fetchJson(`/services${qs ? `?${qs}` : ""}`);
}

export async function createService(data: {
  categoryId: string;
  name: string;
  description?: string;
  priceCents: number;
  turnCount?: number;
  durationMinutes?: number;
  active?: boolean;
  sortOrder?: number;
}): Promise<Service> {
  return fetchJson("/services", {
    method: "POST",
    body: JSON.stringify(data),
  });
}

export async function updateService(
  id: string,
  data: {
    categoryId?: string;
    name?: string;
    description?: string;
    priceCents?: number;
    turnCount?: number;
    durationMinutes?: number;
    active?: boolean;
    sortOrder?: number;
  }
): Promise<Service> {
  return fetchJson(`/services/${id}`, {
    method: "PATCH",
    body: JSON.stringify(data),
  });
}

export async function deleteService(id: string): Promise<void> {
  await fetchJson(`/services/${id}`, { method: "DELETE" });
}

/* ════════════════════════════════════════
   Worker Session Check-in
   ════════════════════════════════════════ */

export type CheckedInWorker = {
  id: string;
  workerId: string;
  name: string;
  checkedInAt: string;
  checkedOutAt: string | null;
};

export async function workerCheckIn(workerId: string): Promise<CheckedInWorker> {
  return fetchJson("/sessions/current/worker-checkin", {
    method: "POST",
    body: JSON.stringify({ workerId }),
  });
}

export async function workerClockOut(workerId: string): Promise<CheckedInWorker> {
  return fetchJson("/sessions/current/worker-clockout", {
    method: "POST",
    body: JSON.stringify({ workerId }),
  });
}

export async function fetchCheckedInWorkers(): Promise<CheckedInWorker[]> {
  return fetchJson("/sessions/current/workers");
}

/* ════════════════════════════════════════
   Session Endpoints
   ════════════════════════════════════════ */

export type Session = {
  id: string;
  openedAt: string;
  closedAt: string | null;
  openingCashCents: number;
  closingCashCents: number | null;
  status: "open" | "closed";
};

export async function fetchCurrentSession(): Promise<Session | null> {
  return fetchJson("/sessions/current");
}

export async function openSession(data: {
  openingCashCents?: number;
}): Promise<Session> {
  return fetchJson("/sessions/open", {
    method: "POST",
    body: JSON.stringify(data),
  });
}

export async function closeSession(
  id: string,
  data: { closingCashCents: number }
): Promise<{ session: Session; summary: Record<string, number> }> {
  return fetchJson(`/sessions/${id}/close`, {
    method: "POST",
    body: JSON.stringify(data),
  });
}

/* ════════════════════════════════════════
   Settings Endpoints
   ════════════════════════════════════════ */

export type SalonSettings = {
  id: string;
  turnCountThresholdCents: number;
  updatedAt: string;
};

export async function fetchSettings(): Promise<SalonSettings> {
  return fetchJson("/settings");
}

export async function updateSettings(data: {
  turnCountThresholdCents: number;
}): Promise<SalonSettings> {
  return fetchJson("/settings", {
    method: "PATCH",
    body: JSON.stringify(data),
  });
}

/* ════════════════════════════════════════
    Report Endpoints
    ════════════════════════════════════════ */

export type ReportParams = {
  start?: string;
  end?: string;
  workerId?: string;
  paymentMethod?: string;
};

export type TurnDetail = {
  id: string;
  workerName: string;
  customerName: string;
  status: string;
  services: string;
  itemTotalCents: number;
  commissionCents: number;
  tipsCents: number;
  totalPayCents: number;
  durationMinutes: number | null;
  startedAt: string | null;
  endedAt: string | null;
  createdAt: string;
};

export type SalesReportService = {
  id: string;
  serviceName: string;
  workerId: string;
  workerName: string;
  priceCents: number;
  discountCents: number;
  finalServiceCents: number;
  commissionCents: number;
  tipsCents: number;
  payCents: number;
};

export type SalesReportTicket = {
  id: string;
  completedAt: string | null;
  customerName: string;
  paymentMethods: string[];
  services: SalesReportService[];
  totals: {
    grossServiceCents: number;
    discountCents: number;
    refundCents: number;
    serviceCents: number;
    commissionCents: number;
    tipsCents: number;
    payCents: number;
    cashCents: number;
    cardCents: number;
    giftCardCents: number;
    collectedCents: number;
  };
};

export type SalesReportSummary = {
  grossServiceSalesCents: number;
  discountTotalCents: number;
  refundTotalCents: number;
  netServiceSalesCents: number;
  tipTotalCents: number;
  workerCommissionPayoutCents: number;
  workerTipsPayoutCents: number;
  totalPayCents: number;
  cashTotalCents: number;
  cardTotalCents: number;
  giftCardTotalCents: number;
  totalCollectedCents: number;
};

export type WorkerEarningsRow = {
  workerId: string;
  name: string;
  services: number;
  netSalesCents: number;
  commissionCents: number;
  commissionRate: number;
  commissionRates: number[];
  tipsCents: number;
  totalPayCents: number;
};

export type PaymentReportRow = {
  id: string;
  saleId: string;
  customerName: string;
  method: string;
  provider: string | null;
  providerPaymentId: string | null;
  amountCents: number;
  tipCents: number;
  status: string;
  createdAt: string;
};

export type PaymentReportSummary = {
  cashTotalCents: number;
  cardTotalCents: number;
  giftCardTotalCents: number;
  otherTotalCents: number;
  totalApprovedCents: number;
  byProvider: Record<string, Record<string, number>>;
};

export type RefundReportRow = {
  id: string;
  saleId: string;
  paymentId: string | null;
  customerName: string;
  amountCents: number;
  reason: string | null;
  approvedByUserId: string | null;
  paymentMethod: string | null;
  createdAt: string;
};

export type DiscountReportRow = {
  id: string;
  saleId: string;
  saleItemId: string | null;
  customerName: string;
  serviceName: string | null;
  type: string;
  amountCents: number;
  percent: number | string | null;
  reason: string | null;
  approvedByUserId: string | null;
  createdAt: string;
};

export async function fetchSalesReport(params?: ReportParams): Promise<{
  summary: SalesReportSummary;
  sales: SalesReportTicket[];
}> {
  const query = buildQuery(params);
  return fetchJson(`/reports/sales${query}`);
}

export async function fetchWorkerEarnings(params?: ReportParams): Promise<{
  workers: WorkerEarningsRow[];
}> {
  const query = buildQuery(params);
  return fetchJson(`/reports/workers${query}`);
}

export async function fetchTurnDetail(params?: ReportParams): Promise<{
  turns: TurnDetail[];
}> {
  const query = buildQuery(params);
  return fetchJson(`/reports/turns/detail${query}`);
}

export async function fetchEndOfDayReport(params?: ReportParams): Promise<{
  grossServiceSalesCents: number;
  discountTotalCents: number;
  refundTotalCents: number;
  netServiceSalesCents: number;
  tipTotalCents: number;
  cashTotalCents: number;
  cardTotalCents: number;
  giftCardTotalCents: number;
  workerCommissionPayoutCents: number;
  workerTipsPayoutCents: number;
  businessShareCents: number;
  totalPayCents: number;
  totalCollectedCents: number;
}> {
  const query = buildQuery(params);
  return fetchJson(`/reports/end-of-day${query}`);
}

export async function fetchPaymentReport(params?: ReportParams): Promise<{
  summary: PaymentReportSummary;
  payments: PaymentReportRow[];
}> {
  const query = buildQuery(params);
  return fetchJson(`/reports/payments${query}`);
}

export async function fetchRefundReport(params?: ReportParams): Promise<{
  summary: { refundTotalCents: number; refundCount: number };
  refunds: RefundReportRow[];
}> {
  const query = buildQuery(params);
  return fetchJson(`/reports/refunds${query}`);
}

export async function fetchDiscountReport(params?: ReportParams): Promise<{
  summary: { discountTotalCents: number; discountCount: number };
  discounts: DiscountReportRow[];
}> {
  const query = buildQuery(params);
  return fetchJson(`/reports/discounts${query}`);
}

function buildQuery(params?: ReportParams): string {
  if (!params || (!params.start && !params.end && !params.workerId && !params.paymentMethod)) return "";
  const q = new URLSearchParams();
  if (params.start) q.set("start", params.start);
  if (params.end) q.set("end", params.end);
  if (params.workerId) q.set("workerId", params.workerId);
  if (params.paymentMethod) q.set("paymentMethod", params.paymentMethod);
  return `?${q.toString()}`;
}

/* ════════════════════════════════════════
   Worker Endpoints
   ════════════════════════════════════════ */

export async function fetchWorkers(): Promise<Worker[]> {
  return fetchJson("/workers");
}
export async function createWorker(data: { name: string; displayName?: string; email?: string; phone?: string; commissionRate: number; pin?: string }): Promise<Worker> {
  return fetchJson("/workers", { method: "POST", body: JSON.stringify(data) });
}
export async function updateWorker(id: string, data: { displayName?: string; commissionRate?: number; active?: boolean; sortOrder?: number; pin?: string }): Promise<Worker> {
  return fetchJson(`/workers/${id}`, { method: "PATCH", body: JSON.stringify(data) });
}
export async function updateWorkerStatus(id: string, status: string): Promise<Worker> {
  return fetchJson(`/workers/${id}/status`, { method: "PATCH", body: JSON.stringify({ status }) });
}

/* ════════════════════════════════════════
   Checkout / Sale Endpoints
   ════════════════════════════════════════ */

export async function createSale(data: { customerId?: string; checkinId?: string }): Promise<{ id: string }> {
  return fetchJson("/sales", { method: "POST", body: JSON.stringify(data) });
}
export async function addSaleItem(saleId: string, data: { serviceId?: string; workerId: string; serviceName?: string; categoryName?: string; priceCents?: number; discountCents?: number }): Promise<{ saleItem: Record<string, unknown>; sale: Record<string, unknown> }> {
  return fetchJson(`/sales/${saleId}/items`, { method: "POST", body: JSON.stringify(data) });
}
export async function removeSaleItem(saleId: string, itemId: string): Promise<unknown> {
  return fetchJson(`/sales/${saleId}/items/${itemId}`, { method: "DELETE" });
}
export async function addCashPayment(saleId: string, data: { amountCents: number }): Promise<{ payment: Record<string, unknown>; sale: Record<string, unknown> }> {
  return fetchJson(`/sales/${saleId}/payments/cash`, { method: "POST", body: JSON.stringify(data) });
}
export async function addGiftCardPayment(saleId: string, data: { amountCents: number }): Promise<{ payment: Record<string, unknown>; sale: Record<string, unknown> }> {
  return fetchJson(`/sales/${saleId}/payments/gift-card`, { method: "POST", body: JSON.stringify(data) });
}
export async function addCardPayment(saleId: string, data: { amountCents: number; idempotencyKey: string }): Promise<{ payment: Record<string, unknown>; sale: Record<string, unknown>; terminalStatus: string }> {
  return fetchJson(`/sales/${saleId}/payments/card`, { method: "POST", body: JSON.stringify(data) });
}

export async function reconcileCardPayment(paymentId: string): Promise<{ payment: Record<string, unknown>; sale?: Record<string, unknown> | null; terminalStatus: string }> {
  return fetchJson(`/payments/${paymentId}/reconcile`, { method: "POST" });
}
export type TerminalStatus = {
  connected: boolean;
  provider: "mock" | "clover";
  message?: string;
  pairingRequired?: boolean;
  pairingCode?: string;
};

export type TerminalConfig = {
  transport: "mock" | "rest-local" | "rest-cloud" | "usb-sidecar" | "ws-lan" | "ws-cloud";
  cloudBaseUrl?: string;
  merchantId?: string;
  appId?: string;
  deviceBaseUrl?: string;
  deviceId?: string;
  posId?: string;
  usbSidecarUrl?: string;
  wsUrl?: string;
  wsHost?: string;
  wsPort?: number;
  wsPath?: string;
  wsSecure?: boolean;
  wsTimeoutMs?: number;
  remoteApplicationId?: string;
  posName?: string;
  serialNumber?: string;
  accessTokenConfigured?: boolean;
  appSecretConfigured?: boolean;
  authTokenConfigured?: boolean;
  accessTokenPreview?: string;
  appSecretPreview?: string;
  authTokenPreview?: string;
  cloudServer?: string;
  friendlyId?: string;
};

export type TerminalConfigUpdate = Partial<TerminalConfig> & {
  accessToken?: string;
  appSecret?: string;
  authToken?: string;
};

export async function fetchTerminalConfig(): Promise<TerminalConfig> {
  return fetchJson("/terminal/config");
}

export async function updateTerminalConfig(data: TerminalConfigUpdate): Promise<{ config: TerminalConfig; status: TerminalStatus }> {
  return fetchJson("/terminal/config", { method: "PATCH", body: JSON.stringify(data) });
}

export async function fetchTerminalStatus(): Promise<TerminalStatus> {
  return fetchJson("/terminal/status");
}

export async function startTerminalPairing(): Promise<TerminalStatus> {
  return fetchJson("/terminal/pair/start", { method: "POST" });
}

export async function fetchTerminalPairStatus(): Promise<TerminalStatus> {
  return fetchJson("/terminal/pair/status");
}

export async function confirmTerminalPairing(pairingCode: string): Promise<TerminalStatus> {
  return fetchJson("/terminal/pair/confirm", { method: "POST", body: JSON.stringify({ pairingCode }) });
}

export async function allocateCardTip(saleId: string, data: { paymentId: string; splitMode: "even_workers" | "service_amount_percentage" }): Promise<{ saleItems: Record<string, unknown>[]; sale: Record<string, unknown> }> {
  return fetchJson(`/sales/${saleId}/tips/allocate`, { method: "POST", body: JSON.stringify(data) });
}
export async function completeSale(saleId: string): Promise<{ sale: { id: string; totalCents: number; amountPaidCents: number }; changeDueCents: number }> {
  return fetchJson(`/sales/${saleId}/complete`, { method: "POST" });
}

/* ════════════════════════════════════════
   Session Grid (legacy)
   ════════════════════════════════════════ */

export type SessionGridWorker = Record<string, unknown>;
export type SessionGridTurn = Record<string, unknown>;
export type SessionGridService = Record<string, unknown>;
export function fetchSessionGrid(): Promise<{ workers: SessionGridWorker[] }> {
  return fetchJson("/turns/session-grid");
}

/* ════════════════════════════════════════
   Shared HTTP Helper
   ════════════════════════════════════════ */

async function fetchJson<T>(path: string, init?: RequestInit): Promise<T> {
  const hasBody = init?.body != null;
  const response = await fetch(`${API_BASE_URL}${path}`, {
    headers: {
      ...(hasBody ? { "Content-Type": "application/json" } : {}),
      ...init?.headers,
    },
    ...init,
  });
  if (!response.ok) {
    let detail = `${response.status} ${response.statusText}`;
    try {
      const body = await response.json();
      if (typeof body?.message === "string") detail = body.message;
      else if (typeof body?.error === "string") detail = body.error;
    } catch { /* ignore */ }
    throw new Error(detail);
  }
  return response.json() as Promise<T>;
}
