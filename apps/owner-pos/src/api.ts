const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? "http://localhost:4000/api";
const OWNER_AUTH_ID = import.meta.env.VITE_OWNER_AUTH_ID ?? "owner@example.com";

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
};

export async function workerCheckIn(workerId: string): Promise<CheckedInWorker> {
  return fetchJson("/sessions/current/worker-checkin", {
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

export async function fetchSalesReport(params?: ReportParams): Promise<{
  summary: Record<string, number>;
  sales: unknown[];
}> {
  const query = buildQuery(params);
  return fetchJson(`/reports/sales${query}`);
}

export async function fetchWorkerEarnings(params?: ReportParams): Promise<{
  workers: { workerId: string; name: string; services: number; netSalesCents: number; commissionCents: number; tipsCents: number; totalPayCents: number }[];
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
  businessShareCents: number;
  totalCollectedCents: number;
}> {
  const query = buildQuery(params);
  return fetchJson(`/reports/end-of-day${query}`);
}

function buildQuery(params?: ReportParams): string {
  if (!params || (!params.start && !params.end && !params.workerId)) return "";
  const q = new URLSearchParams();
  if (params.start) q.set("start", params.start);
  if (params.end) q.set("end", params.end);
  if (params.workerId) q.set("workerId", params.workerId);
  return `?${q.toString()}`;
}

/* ════════════════════════════════════════
   Worker Endpoints
   ════════════════════════════════════════ */

export async function fetchWorkers(): Promise<Worker[]> {
  return fetchJson("/workers");
}
export async function createWorker(data: { name: string; displayName?: string; email?: string; phone?: string; commissionRate: number }): Promise<Worker> {
  return fetchJson("/workers", { method: "POST", body: JSON.stringify(data) });
}
export async function updateWorker(id: string, data: { displayName?: string; commissionRate?: number; active?: boolean; sortOrder?: number }): Promise<Worker> {
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
export async function addSaleItem(saleId: string, data: { serviceId: string; workerId: string; priceCents?: number; discountCents?: number; tipCents?: number }): Promise<{ saleItem: Record<string, unknown>; sale: Record<string, unknown> }> {
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
