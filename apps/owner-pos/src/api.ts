const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? "http://localhost:4000/api";

export type Customer = {
  id: string;
  name?: string | null;
  phone?: string | null;
};

export type Worker = {
  id: string;
  displayName: string;
  currentStatus: string;
  commissionRate: string | number;
  active: boolean;
};

export type WorkerStatus = "available" | "in_service" | "on_break" | "off_today" | "appointment_only";

export type Service = {
  id: string;
  categoryId: string;
  name: string;
  description?: string | null;
  priceCents: number;
  durationMinutes: number;
};

export type ServiceCategory = {
  id: string;
  name: string;
  services: Service[];
};

export type ActiveTurn = {
  id: string;
  status: "assigned" | "in_service" | "completed" | "skipped" | "cancelled";
  startedAt: string | null;
  checkinId?: string | null;
  workerId?: string | null;
  customer?: Customer | null;
  checkin?: {
    notes?: string | null;
    customer?: Customer | null;
  } | null;
};

export type TurnDashboardWorker = {
  workerId: string;
  name: string;
  status: string;
  turnsTakenSession: number;
  turnsTakenToday: number;
  lastTurnEndedAt: string | null;
  activeTurn: ActiveTurn | null;
  salesSessionCents: number;
  tipsSessionCents: number;
  salesTodayCents: number;
  tipsTodayCents: number;
  suggestionRank: number | null;
};

export type Checkin = {
  id: string;
  status: string;
  notes?: string | null;
  checkedInAt: string;
  customer?: Customer | null;
  requestedWorker?: Worker | null;
  requestedWorkerId?: string | null;
};

export type SaleItem = {
  id: string;
  serviceNameSnapshot: string;
  categoryNameSnapshot?: string | null;
  priceCents: number;
  discountCents: number;
  tipCents: number;
  finalServiceCents: number;
  workerId: string;
  worker?: Worker | null;
};

export type Payment = {
  id: string;
  method: "cash" | "card" | "gift_card" | "other";
  amountCents: number;
  tipCents: number;
  status: string;
  cardBrand?: string | null;
  cardLast4?: string | null;
  authCode?: string | null;
};

export type Sale = {
  id: string;
  checkinId?: string | null;
  customerId?: string | null;
  status: string;
  subtotalCents: number;
  discountTotalCents: number;
  tipTotalCents: number;
  totalCents: number;
  amountPaidCents: number;
  items?: SaleItem[];
  payments?: Payment[];
  checkin?: Checkin | null;
  customer?: Customer | null;
};

export type ReceiptRecord = {
  id: string;
  saleId: string;
  printStatus: string;
  smsStatus?: string | null;
  emailStatus?: string | null;
  receiptDataJson?: unknown;
  printedAt?: string | null;
  createdAt?: string | null;
};

export type WorkSession = {
  id: string;
  businessDate: string;
  status: "open" | "closed";
  openedAt: string;
  closedAt?: string | null;
};

export type CheckedInWorker = {
  workerId: string;
  checkedInAt: string | null;
};

export type CurrentSessionResponse = {
  session: WorkSession | null;
  checkedInWorkerIds: string[];
  checkedInWorkers: CheckedInWorker[];
};

export type SessionOpenMode = "continue" | "new";

export type SessionCandidate = WorkSession & {
  checkedInWorkerCount: number;
};

export type OpenSessionResponse = CurrentSessionResponse & {
  openMode?: SessionOpenMode;
  reopenedFromClosed?: boolean;
};

export type OwnerSession = {
  user: { id: string; name: string; role: "owner" };
  token: string;
  expiresAt: string;
};

export type ReportRange = {
  start: string;
  end: string;
};

export type ReportSummary = {
  grossServiceCents: number;
  discountCents: number;
  refundCents: number;
  netServiceCents: number;
  tipsCents: number;
  workerCommissionCents: number;
  workerTipsCents: number;
  businessShareCents: number;
  totalCollectedCents: number;
  salesCount: number;
  paymentBreakdown: {
    cashCents: number;
    cardCents: number;
    giftCardCents: number;
    otherCents: number;
  };
};

export type SalesReportRow = {
  id: string;
  completedAt: string | null;
  customer?: Customer | null;
  subtotalCents: number;
  discountCents: number;
  tipCents: number;
  totalCents: number;
  collectedCents: number;
  paymentMethods: string[];
  itemCount: number;
};

export type WorkerReportRow = {
  workerId: string;
  workerName: string;
  serviceCount: number;
  netServiceCents: number;
  commissionCents: number;
  tipsCents: number;
  totalWorkerPayCents: number;
  businessShareCents: number;
};

export type TurnReportRow = {
  workerId: string;
  workerName: string;
  turnsTaken: number;
  completedTurns: number;
  skippedTurns: number;
  appointmentTurns: number;
  walkInTurns: number;
  averageServiceMinutes: number;
  lastTurnAt: string | null;
};

export type PaymentReportRow = {
  id: string;
  saleId: string | null;
  method: "cash" | "card" | "gift_card" | "other";
  amountCents: number;
  tipCents: number;
  status: string;
  provider?: string | null;
  providerPaymentId?: string | null;
  cardBrand?: string | null;
  cardLast4?: string | null;
  authCode?: string | null;
  createdAt: string | null;
};

export type DiscountReportRow = {
  id: string;
  saleId: string;
  saleItemId: string | null;
  type: string;
  amountCents: number;
  percent?: string | number | null;
  reason?: string | null;
  createdAt: string | null;
};

export type RefundReportRow = {
  id: string;
  saleId: string;
  paymentId: string | null;
  amountCents: number;
  reason?: string | null;
  paymentMethod?: string | null;
  createdAt: string | null;
};

export class ApiError extends Error {
  readonly code?: string;
  readonly data?: unknown;
  readonly status?: number;

  constructor(message: string, options?: { code?: string; data?: unknown; status?: number }) {
    super(message);
    this.name = "ApiError";
    this.code = options?.code;
    this.data = options?.data;
    this.status = options?.status;
  }
}

export async function fetchTurnDashboard(): Promise<{
  scope: "session";
  session: WorkSession | null;
  workers: TurnDashboardWorker[];
}> {
  return fetchJson("/turns/dashboard");
}

export async function loginOwner(input: { emailOrPhone: string; password: string }): Promise<OwnerSession> {
  return fetchJson("/owner/login", {
    method: "POST",
    body: JSON.stringify(input),
  });
}

export async function fetchReportSummary(token: string, range: ReportRange): Promise<{ range: ReportRange; summary: ReportSummary }> {
  return fetchAuthedJson(token, "/reports/summary" + reportQuery(range));
}

export async function fetchSalesReport(token: string, range: ReportRange): Promise<{ range: ReportRange; sales: SalesReportRow[] }> {
  return fetchAuthedJson(token, "/reports/sales" + reportQuery(range));
}

export async function fetchWorkersReport(token: string, range: ReportRange): Promise<{ range: ReportRange; workers: WorkerReportRow[] }> {
  return fetchAuthedJson(token, "/reports/workers" + reportQuery(range));
}

export async function fetchTurnsReport(token: string, range: ReportRange): Promise<{ range: ReportRange; workers: TurnReportRow[] }> {
  return fetchAuthedJson(token, "/reports/turns" + reportQuery(range));
}

export async function fetchPaymentsReport(token: string, range: ReportRange): Promise<{
  range: ReportRange;
  payments: PaymentReportRow[];
  totals: ReportSummary["paymentBreakdown"];
}> {
  return fetchAuthedJson(token, "/reports/payments" + reportQuery(range));
}

export async function fetchDiscountsReport(token: string, range: ReportRange): Promise<{ range: ReportRange; discounts: DiscountReportRow[] }> {
  return fetchAuthedJson(token, "/reports/discounts" + reportQuery(range));
}

export async function fetchRefundsReport(token: string, range: ReportRange): Promise<{ range: ReportRange; refunds: RefundReportRow[] }> {
  return fetchAuthedJson(token, "/reports/refunds" + reportQuery(range));
}

export async function fetchServiceCategories(): Promise<ServiceCategory[]> {
  return fetchJson("/service-categories");
}

export async function fetchWorkers(): Promise<Worker[]> {
  return fetchJson("/workers");
}

export async function fetchCheckins(status?: string): Promise<Checkin[]> {
  return fetchJson(status ? `/checkins?status=${encodeURIComponent(status)}` : "/checkins");
}

export async function fetchWaitingCheckins(): Promise<Checkin[]> {
  return fetchCheckins("waiting");
}

export async function fetchReadyForCheckoutCheckins(): Promise<Checkin[]> {
  return fetchCheckins("ready_for_checkout");
}

export async function fetchCurrentSession(): Promise<CurrentSessionResponse> {
  return fetchJson("/sessions/current");
}

export async function openWorkSession(input?: { mode?: SessionOpenMode; sourceSessionId?: string }) {
  return fetchJson<OpenSessionResponse>("/sessions/open", {
    method: "POST",
    body: JSON.stringify({
      mode: input?.mode,
      sourceSessionId: input?.sourceSessionId,
    }),
  });
}

export async function closeWorkSession(sessionId: string) {
  return fetchJson<{ session: WorkSession; blockers: { unresolvedCheckinsCount: number; unresolvedSalesCount: number } }>(
    "/sessions/" + encodeURIComponent(sessionId) + "/close",
    { method: "POST", body: "{}" }
  );
}

export async function fetchSessionReport(sessionId: string) {
  return fetchJson<{
    session: WorkSession;
    summary: {
      checkinsCount: number;
      resolvedCheckinsCount: number;
      turnsCount: number;
      completedTurnsCount: number;
      salesCount: number;
      paidSalesCount: number;
      serviceCents: number;
      tipCents: number;
      commissionCents: number;
      collectedCents: number;
    };
  }>("/sessions/" + encodeURIComponent(sessionId) + "/report");
}

export async function createWorkerSessionCheckin(sessionId: string, input: { workerId: string; notes?: string }) {
  return fetchJson("/sessions/" + encodeURIComponent(sessionId) + "/workers/checkin", {
    method: "POST",
    body: JSON.stringify({
      notes: input.notes?.trim() || undefined,
      workerId: input.workerId,
    }),
  });
}

export async function updateWorkerStatus(workerId: string, status: WorkerStatus) {
  return fetchJson<Worker>("/workers/" + encodeURIComponent(workerId) + "/status", {
    method: "PATCH",
    body: JSON.stringify({ status }),
  });
}

export async function assignTurn(checkinId: string, workerId: string, suggestedWorkerId?: string | null) {
  return fetchJson<{ turn: ActiveTurn; checkin: Checkin }>("/turns/assign", {
    method: "POST",
    body: JSON.stringify({ checkinId, workerId, turnType: "walk_in", suggestedWorkerId }),
  });
}

export async function startTurn(turn: ActiveTurn) {
  return fetchJson("/turns/" + turn.id + "/start", {
    method: "POST",
    body: JSON.stringify({ workerId: turn.workerId, checkinId: turn.checkinId }),
  });
}

export async function completeTurn(turn: ActiveTurn) {
  return fetchJson("/turns/" + turn.id + "/complete", {
    method: "POST",
    body: JSON.stringify({ workerId: turn.workerId, checkinId: turn.checkinId }),
  });
}

export async function createSaleForCheckin(checkin: Checkin): Promise<Sale> {
  return fetchJson("/sales", {
    method: "POST",
    body: JSON.stringify({ checkinId: checkin.id, customerId: checkin.customer?.id }),
  });
}

export async function createEmptySale(): Promise<Sale> {
  return fetchJson("/sales", {
    method: "POST",
    body: JSON.stringify({}),
  });
}

export async function fetchSale(saleId: string): Promise<Sale> {
  return fetchJson("/sales/" + saleId);
}

export async function addSaleItem(saleId: string, input: { serviceId: string; workerId: string }) {
  return fetchJson<{ saleItem: SaleItem; sale: Sale }>("/sales/" + saleId + "/items", {
    method: "POST",
    body: JSON.stringify({ ...input, tipCents: 0 }),
  });
}

export async function addCustomSaleItem(saleId: string, input: { customName: string; priceCents: number; workerId: string }) {
  return fetchJson<{ saleItem: SaleItem; sale: Sale }>("/sales/" + saleId + "/items", {
    method: "POST",
    body: JSON.stringify({ ...input, tipCents: 0 }),
  });
}

export async function updateSaleItem(saleId: string, itemId: string, updates: { workerId?: string }) {
  return fetchJson<{ saleItem: SaleItem; sale: Sale }>("/sales/" + saleId + "/items/" + itemId, {
    method: "PATCH",
    body: JSON.stringify(updates),
  });
}

export async function removeSaleItem(saleId: string, itemId: string) {
  return fetchJson<{ sale: Sale }>("/sales/" + saleId + "/items/" + itemId, { method: "DELETE" });
}

export async function recordCashPayment(saleId: string, amountCents: number) {
  return recordPayment(saleId, "cash", amountCents);
}

export async function recordGiftCardPayment(saleId: string, amountCents: number) {
  return recordPayment(saleId, "gift-card", amountCents);
}

export async function startCardPayment(saleId: string, amountCents: number) {
  return fetchJson<{ payment: Payment; sale: Sale; terminalStatus: string; tipCents: number }>(
    "/sales/" + saleId + "/payments/card/start",
    {
      method: "POST",
      body: JSON.stringify({ amountCents, idempotencyKey: crypto.randomUUID() }),
    }
  );
}

export async function setTipDistribution(saleId: string, items: { itemId: string; tipCents: number }[]) {
  return fetchJson<{ sale: Sale }>("/sales/" + saleId + "/tip-distribution", {
    method: "POST",
    body: JSON.stringify({ items }),
  });
}

export async function completeSale(saleId: string) {
  return fetchJson<{ sale: Sale; checkin: Checkin | null; changeDueCents: number }>(
    "/sales/" + saleId + "/complete",
    { method: "POST", body: "{}" }
  );
}

export async function fetchSaleReceipts(saleId: string): Promise<ReceiptRecord[]> {
  return fetchJson("/sales/" + saleId + "/receipts");
}

export async function printSaleReceipt(saleId: string) {
  return fetchJson<{ receipt: ReceiptRecord; printResult: { success: boolean; provider: string; message?: string } }>(
    "/sales/" + saleId + "/receipts/print",
    { method: "POST", body: "{}" }
  );
}

export async function reprintSaleReceipt(saleId: string, receiptId: string) {
  return fetchJson<{ receipt: ReceiptRecord; printResult: { success: boolean; provider: string; message?: string } }>(
    "/sales/" + saleId + "/receipts/" + receiptId + "/reprint",
    { method: "POST", body: "{}" }
  );
}

async function recordPayment(saleId: string, method: "cash" | "gift-card", amountCents: number) {
  return fetchJson<{ payment: Payment; sale: Sale }>("/sales/" + saleId + "/payments/" + method, {
    method: "POST",
    body: JSON.stringify({ amountCents, tipCents: 0 }),
  });
}

function reportQuery(range: ReportRange): string {
  const params = new URLSearchParams({ start: range.start, end: range.end });
  return "?" + params.toString();
}

async function fetchAuthedJson<T>(token: string, path: string, init?: RequestInit): Promise<T> {
  return fetchJson<T>(path, {
    ...init,
    headers: {
      ...(init?.headers ?? {}),
      Authorization: `Bearer ${token}`,
    },
  });
}

async function fetchJson<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(API_BASE_URL + path, {
    headers: {
      "Content-Type": "application/json",
      ...init?.headers,
    },
    ...init,
  });
  if (!response.ok) {
    let message = "Request failed: " + response.status;
    let errorCode: string | undefined;
    let parsedData: unknown;
    try {
      const data = (await response.json()) as {
        error?: string;
        errorCode?: string;
        blockers?: { unresolvedCheckinsCount?: number; unresolvedSalesCount?: number };
      };
      parsedData = data;
      if (data.error) {
        message = data.error;
      }
      if (data.errorCode) {
        errorCode = data.errorCode;
      }
      if (data.blockers) {
        message += ` (check-ins: ${data.blockers.unresolvedCheckinsCount ?? 0}, sales: ${data.blockers.unresolvedSalesCount ?? 0})`;
      }
    } catch {
      const text = await response.text();
      if (text) message = text;
    }
    throw new ApiError(message, { code: errorCode, data: parsedData, status: response.status });
  }
  return response.json() as Promise<T>;
}
