const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? "http://localhost:4000/api";

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

export async function fetchTurnDashboard(): Promise<{ workers: TurnDashboardWorker[] }> {
  return fetchJson("/turns/dashboard");
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

async function fetchJson<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${API_BASE_URL}${path}`, {
    headers: {
      "Content-Type": "application/json",
      ...init?.headers,
    },
    ...init,
  });
  if (!response.ok) {
    throw new Error(`Request failed: ${response.status}`);
  }

  return response.json() as Promise<T>;
}
