const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? getDefaultApiBaseUrl();
const OWNER_AUTH_ID = import.meta.env.VITE_OWNER_AUTH_ID ?? "owner@example.com";

function getDefaultApiBaseUrl(): string {
  return `http://${window.location.hostname}:4000/api`;
}

/* ════════════════════════════════════════
   Types
   ════════════════════════════════════════ */

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
  customer?: Customer | null;
  requestedWorker?: Worker | null;
  requestedWorkerId?: string | null;
};

<<<<<<< HEAD
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
=======
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
>>>>>>> bdf0b2066dfcb2e3e613cb86c08bdfaba329da34
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
  transport: "mock" | "rest-local" | "rest-cloud" | "usb-sidecar" | "ws-lan";
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
<<<<<<< HEAD
  const hasBody = init?.body != null;
  const response = await fetch(`${API_BASE_URL}${path}`, {
=======
  const response = await fetch(API_BASE_URL + path, {
>>>>>>> bdf0b2066dfcb2e3e613cb86c08bdfaba329da34
    headers: {
      ...(hasBody ? { "Content-Type": "application/json" } : {}),
      ...init?.headers,
    },
    ...init,
  });
  if (!response.ok) {
<<<<<<< HEAD
    let detail = `${response.status} ${response.statusText}`;
    try {
      const body = await response.json();
      if (typeof body?.message === "string") detail = body.message;
      else if (typeof body?.error === "string") detail = body.error;
    } catch { /* ignore */ }
    throw new Error(detail);
=======
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
>>>>>>> bdf0b2066dfcb2e3e613cb86c08bdfaba329da34
  }
  return response.json() as Promise<T>;
}
