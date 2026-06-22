const API_BASE_URL = (typeof import.meta !== "undefined" && (import.meta as any).env?.VITE_API_BASE_URL) || getDefaultApiBaseUrl();

function getDefaultApiBaseUrl(): string {
  return `http://${window.location.hostname}:4000/api`;
}

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

export type Session = {
  id: string;
  openedAt: string;
  closedAt: string | null;
  openingCashCents: number;
  closingCashCents: number | null;
  status: "open" | "closed";
};

export type CheckedInWorker = {
  id: string;
  workerId: string;
  name: string;
  checkedInAt: string;
  checkedOutAt: string | null;
};

export type SalonSettings = {
  id: string;
  turnCountThresholdCents: number;
  updatedAt: string;
};

export async function fetchJson<T>(path: string, init?: RequestInit): Promise<T> {
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

// Dashboard
export function fetchTurnDashboard(): Promise<{ workers: TurnDashboardWorker[] }> {
  return fetchJson("/turns/dashboard");
}
export function fetchWaitingCheckins(): Promise<Checkin[]> {
  return fetchJson("/checkins?status=waiting");
}
export function fetchReadyForCheckoutCheckins(): Promise<Checkin[]> {
  return fetchJson("/checkins?status=ready_for_checkout");
}
export function fetchCurrentSession(): Promise<Session | null> {
  return fetchJson("/sessions/current");
}
export function fetchCheckedInWorkers(): Promise<CheckedInWorker[]> {
  return fetchJson("/sessions/current/workers");
}
export function workerCheckIn(workerId: string): Promise<CheckedInWorker> {
  return fetchJson("/sessions/current/worker-checkin", { method: "POST", body: JSON.stringify({ workerId }) });
}
export function workerClockOut(workerId: string): Promise<CheckedInWorker> {
  return fetchJson("/sessions/current/worker-clockout", { method: "POST", body: JSON.stringify({ workerId }) });
}

// Turns
export function assignTurn(data: { checkinId: string; workerId: string; turnType?: string }): Promise<{ turn: unknown; checkin: unknown }> {
  return fetchJson("/turns/assign", { method: "POST", body: JSON.stringify(data) });
}
export function updateTurnCount(turnId: string, turnCount: number): Promise<unknown> {
  return fetchJson(`/turns/${turnId}`, { method: "PATCH", body: JSON.stringify({ turnCount }) });
}

// Checkins
export function createCheckin(data: { customerId?: string; appointmentId?: string; customer?: { name: string; phone?: string }; notes?: string }): Promise<Checkin> {
  return fetchJson("/checkins", { method: "POST", body: JSON.stringify(data) });
}

// Appointments
export function createAppointment(data: { customerId?: string; workerId?: string; startTime: string; endTime: string; status?: string; notes?: string }): Promise<unknown> {
  return fetchJson("/appointments", { method: "POST", body: JSON.stringify(data) });
}
export function fetchAppointments(params?: { workerId?: string; date?: string }): Promise<unknown[]> {
  const q = new URLSearchParams();
  if (params?.workerId) q.set("workerId", params.workerId);
  if (params?.date) q.set("date", params.date);
  const qs = q.toString();
  return fetchJson(`/appointments${qs ? `?${qs}` : ""}`);
}

// Workers
export function fetchWorkers(): Promise<Worker[]> {
  return fetchJson("/workers");
}
export function updateWorkerStatus(id: string, status: string): Promise<Worker> {
  return fetchJson(`/workers/${id}/status`, { method: "PATCH", body: JSON.stringify({ status }) });
}
export function fetchWorkerDashboard(workerId: string): Promise<{
  workerId: string; name: string; status: string; commissionRate: number;
  turnsTakenToday: number; activeTurn: unknown | null;
  serviceSalesTodayCents: number; tipsTodayCents: number;
  commissionTodayCents: number; totalPayTodayCents: number;
  appointmentsToday: unknown[];
}> {
  return fetchJson(`/workers/${workerId}/dashboard`);
}

// Services
export function fetchServices(params?: { active?: boolean }): Promise<Service[]> {
  const q = new URLSearchParams();
  if (params?.active !== undefined) q.set("active", String(params.active));
  const qs = q.toString();
  return fetchJson(`/services${qs ? `?${qs}` : ""}`);
}
export function fetchServiceCategories(): Promise<ServiceCategory[]> {
  return fetchJson("/service-categories");
}

// Sales / Checkout
export function createSale(data: { customerId?: string; checkinId?: string }): Promise<{ id: string }> {
  return fetchJson("/sales", { method: "POST", body: JSON.stringify(data) });
}
export function addSaleItem(saleId: string, data: { serviceId?: string; workerId: string; serviceName?: string; categoryName?: string; priceCents?: number; discountCents?: number }): Promise<unknown> {
  return fetchJson(`/sales/${saleId}/items`, { method: "POST", body: JSON.stringify(data) });
}
export function completeSale(saleId: string): Promise<{ sale: { id: string }; changeDueCents: number }> {
  return fetchJson(`/sales/${saleId}/complete`, { method: "POST" });
}

// Settings
export function fetchSettings(): Promise<SalonSettings> {
  return fetchJson("/settings");
}
export function updateSettings(data: { turnCountThresholdCents: number }): Promise<SalonSettings> {
  return fetchJson("/settings", { method: "PATCH", body: JSON.stringify(data) });
}
