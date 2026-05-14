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
  turnsTakenToday: number;
  lastTurnEndedAt: string | null;
  activeTurn: ActiveTurn | null;
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

export async function fetchTurnDashboard(): Promise<{ workers: TurnDashboardWorker[] }> {
  return fetchJson("/turns/dashboard");
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

async function recordPayment(saleId: string, method: "cash" | "gift-card", amountCents: number) {
  return fetchJson<{ payment: Payment; sale: Sale }>("/sales/" + saleId + "/payments/" + method, {
    method: "POST",
    body: JSON.stringify({ amountCents, tipCents: 0 }),
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
    const message = await response.text();
    throw new Error(message || "Request failed: " + response.status);
  }
  return response.json() as Promise<T>;
}
