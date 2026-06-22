<<<<<<< HEAD
import React, { useEffect, useRef, useState } from "react";
import { createRoot } from "react-dom/client";
import "./styles.css";

const API_BASE = import.meta.env?.VITE_API_BASE_URL ?? getDefaultApiBaseUrl();
const WORKER_SESSION_TTL_MS = 12 * 60 * 60 * 1000;
const WORKER_SESSION_STORAGE_KEY = "nail.workerPwa.session";

function getDefaultApiBaseUrl(): string {
  return `http://${window.location.hostname}:4000/api`;
}

/* ════════════════════════════════════════
   HTTP helpers — pass token when available
   ════════════════════════════════════════ */

function buildHeaders(token?: string): Record<string, string> {
  const h: Record<string, string> = { "Content-Type": "application/json" };
  if (token) h["Authorization"] = `Bearer ${token}`;
  return h;
}

async function get<T>(path: string, token?: string): Promise<T> {
  const r = await fetch(`${API_BASE}${path}`, { headers: token ? { Authorization: `Bearer ${token}` } : {} });
  if (!r.ok) {
    let detail = `${r.status}`;
    try { const body = await r.json(); if (body?.error) detail = body.error; } catch {}
    throw new Error(detail);
  }
  return r.json() as Promise<T>;
}
async function post<T>(path: string, body: unknown, token?: string): Promise<T> {
  const r = await fetch(`${API_BASE}${path}`, {
    method: "POST",
    headers: buildHeaders(token),
    body: JSON.stringify(body),
  });
  if (!r.ok) {
    let detail = `${r.status}`;
    try { const bodyErr = await r.json(); if (bodyErr?.error) detail = bodyErr.error; } catch {}
    throw new Error(detail);
  }
  return r.json() as Promise<T>;
}
async function patch<T>(path: string, body: unknown, token?: string): Promise<T> {
  const r = await fetch(`${API_BASE}${path}`, {
    method: "PATCH",
    headers: buildHeaders(token),
    body: JSON.stringify(body),
  });
  if (!r.ok) {
    let detail = `${r.status}`;
    try { const bodyErr = await r.json(); if (bodyErr?.error) detail = bodyErr.error; } catch {}
    throw new Error(detail);
  }
  return r.json() as Promise<T>;
}

/* ════════════════════════════════════════
   Types
   ════════════════════════════════════════ */

type View = "login" | "dashboard" | "appointments" | "earnings" | "reports";

type WorkerState = {
  id: string;
  name: string;
  status: string;
  turnsToday: number;
  salesTodayCents: number;
  tipsTodayCents: number;
  commissionRate: number;
  activeTurn: { id: string; customerName: string | null; startedAt: string | null } | null;
};

type WorkerSession = {
  workerId: string;
  token: string;
  expiresAt: number;
};

type ConnectionStatus = {
  browserOnline: boolean;
  apiConnected: boolean;
  wsConnected: boolean;
};

type LoginWorkerOption = {
  id: string;
  displayName: string;
  status?: string;
};

type WorkerTicketSummary = {
  ticketCount: number;
  serviceCount: number;
  serviceTotalCents: number;
  tipTotalCents: number;
  commissionTotalCents: number;
  payTotalCents: number;
};

type WorkerTicketService = {
  id: string;
  serviceName: string;
  priceCents: number;
  discountCents: number;
  serviceCents: number;
  commissionCents: number;
  tipsCents: number;
  payCents: number;
};

type WorkerTicket = {
  id: string;
  completedAt: string | null;
  customerName: string;
  services: WorkerTicketService[];
=======
import React, { useEffect, useMemo, useState } from "react";
import { createRoot } from "react-dom/client";
import "./styles.css";

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? "http://localhost:4000/api";
const SESSION_STORAGE_KEY = "worker_pwa_session_v2";

type WorkerSession = {
  workerId: string;
  displayName: string;
  token: string;
  expiresAt: string;
};

type TurnStatus = "assigned" | "in_service" | "completed" | "skipped" | "cancelled";

type TurnRecord = {
  id: string;
  status: TurnStatus;
  turnType?: "walk_in" | "appointment" | "requested_worker" | "manual";
  checkinId?: string | null;
  appointmentId?: string | null;
  skippedReason?: string | null;
  createdAt?: string | null;
  startedAt: string | null;
  endedAt?: string | null;
  completedAt?: string | null;
  checkin?: {
    notes?: string | null;
    customer?: { id: string; name?: string | null; phone?: string | null } | null;
  } | null;
  customer?: { id: string; name?: string | null; phone?: string | null } | null;
  serviceNames?: string[];
  serviceTotalCents?: number;
  tipTotalCents?: number;
  commissionCents?: number;
  turnTotalCents?: number;
};

type WorkerDashboard = {
  range?: {
    start: string;
    end: string;
  };
  worker: {
    id: string;
    displayName: string;
    status: string;
  };
  activeTurn: TurnRecord | null;
  turnsTodayCount: number;
  salesTodayCents: number;
  tipsTodayCents: number;
  salesRangeCents?: number;
  tipsRangeCents?: number;
  commissionRangeCents?: number;
  estimatedPayTodayCents: number;
  recentTurns: TurnRecord[];
};

type WorkerLoginResponse = {
  workerId: string;
  displayName: string;
  token: string;
  expiresAt: string;
};

type WorkerAppointment = {
  id: string;
  startTime: string;
  endTime: string;
  status: string;
  notes?: string | null;
  customer?: { name?: string | null; phone?: string | null } | null;
};

type WorkerEarnings = {
>>>>>>> bdf0b2066dfcb2e3e613cb86c08bdfaba329da34
  totals: {
    serviceCents: number;
    tipsCents: number;
    commissionCents: number;
<<<<<<< HEAD
    payCents: number;
  };
};

type WorkerTicketReport = {
  summary: WorkerTicketSummary;
  tickets: WorkerTicket[];
};

type ReportPreset = "today" | "yesterday" | "week" | "month";

/* ════════════════════════════════════════
   Session + connectivity helpers
   ════════════════════════════════════════ */

function saveWorkerSession(workerId: string, token: string) {
  const session: WorkerSession = {
    workerId,
    token,
    expiresAt: Date.now() + WORKER_SESSION_TTL_MS,
  };
  localStorage.setItem(WORKER_SESSION_STORAGE_KEY, JSON.stringify(session));
}

function loadWorkerSession(): WorkerSession | null {
  try {
    const raw = localStorage.getItem(WORKER_SESSION_STORAGE_KEY);
    if (!raw) return null;

    const parsed = JSON.parse(raw) as Partial<WorkerSession>;
    if (typeof parsed.workerId !== "string" || typeof parsed.token !== "string" || typeof parsed.expiresAt !== "number") {
      clearWorkerSession();
      return null;
    }

    if (parsed.expiresAt <= Date.now()) {
      clearWorkerSession();
      return null;
    }

    return { workerId: parsed.workerId, token: parsed.token, expiresAt: parsed.expiresAt };
  } catch {
    clearWorkerSession();
=======
    estimatedPayCents: number;
  };
  byDay: Array<{
    date: string;
    serviceCents: number;
    tipsCents: number;
    commissionCents: number;
    estimatedPayCents: number;
  }>;
  recentItems: Array<{
    id: string;
    saleId?: string;
    serviceName?: string;
    serviceCents: number;
    tipsCents: number;
    commissionCents: number;
    estimatedPayCents: number;
    createdAt?: string | null;
  }>;
};

type Tab = "today" | "appointments" | "earnings";

function formatMoney(cents: number): string {
  return "$" + (cents / 100).toFixed(2);
}

function startOfDateInputToIso(value: string): string {
  const [year, month, day] = value.split("-").map((part) => Number(part));
  return new Date(year, month - 1, day, 0, 0, 0, 0).toISOString();
}

function endOfDateInputToIso(value: string): string {
  const [year, month, day] = value.split("-").map((part) => Number(part));
  return new Date(year, month - 1, day, 23, 59, 59, 999).toISOString();
}

function formatTime(value?: string | null): string {
  if (!value) return "-";
  const date = new Date(value);
  return date.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
}

function formatDateTime(value?: string | null): string {
  if (!value) return "-";
  const date = new Date(value);
  return date.toLocaleString([], { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });
}

function formatDurationFrom(startedAt?: string | null): string {
  if (!startedAt) return "-";
  const minutes = Math.max(0, Math.floor((Date.now() - new Date(startedAt).getTime()) / 60000));
  const hours = Math.floor(minutes / 60);
  const remain = minutes % 60;
  return hours > 0 ? `${hours}h ${remain}m` : `${remain}m`;
}

function formatDuration(startedAt?: string | null, endedAt?: string | null): string {
  if (!startedAt || !endedAt) return "-";
  const minutes = Math.max(0, Math.floor((new Date(endedAt).getTime() - new Date(startedAt).getTime()) / 60000));
  const hours = Math.floor(minutes / 60);
  const remain = minutes % 60;
  return hours > 0 ? `${hours}h ${remain}m` : `${remain}m`;
}

function customerName(turn?: TurnRecord | null): string {
  const customer = turn?.customer ?? turn?.checkin?.customer;
  return customer?.name ?? customer?.phone ?? "Guest";
}

function turnTypeLabel(turnType?: TurnRecord["turnType"]): string {
  if (!turnType) return "manual";
  return turnType.replace(/_/g, " ");
}

function turnDurationLabel(turn: TurnRecord): string {
  if (turn.endedAt || turn.completedAt) {
    return formatDuration(turn.startedAt, turn.endedAt ?? turn.completedAt);
  }
  return formatDurationFrom(turn.startedAt);
}

function loadSession(): WorkerSession | null {
  try {
    const raw = localStorage.getItem(SESSION_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as WorkerSession;
    if (!parsed.workerId || !parsed.displayName || !parsed.token || !parsed.expiresAt) return null;
    if (new Date(parsed.expiresAt).getTime() <= Date.now()) return null;
    return parsed;
  } catch {
>>>>>>> bdf0b2066dfcb2e3e613cb86c08bdfaba329da34
    return null;
  }
}

<<<<<<< HEAD
function clearWorkerSession() {
  localStorage.removeItem(WORKER_SESSION_STORAGE_KEY);
}

function isAuthError(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error);
  return message.includes("401") || message.includes("403") || message.includes("Not authenticated") || message.includes("Forbidden");
}

function workerFromDashboard(workerId: string, dashData: any, fallback?: Partial<WorkerState>): WorkerState {
  const turn = dashData.activeTurn || null;
  return {
    id: workerId,
    name: dashData.name || fallback?.name || "Worker",
    status: dashData.status || fallback?.status || "available",
    turnsToday: dashData.turnsTakenToday ?? fallback?.turnsToday ?? 0,
    salesTodayCents: dashData.serviceSalesTodayCents ?? fallback?.salesTodayCents ?? 0,
    tipsTodayCents: dashData.tipsTodayCents ?? fallback?.tipsTodayCents ?? 0,
    commissionRate: Number(dashData.commissionRate ?? fallback?.commissionRate ?? 0),
    activeTurn: turn ? { id: turn.id, customerName: turn.customerName, startedAt: turn.startedAt } : null,
  };
}

function buildWorkerWebSocketUrl(): string {
  try {
    const url = new URL(API_BASE, window.location.href);
    url.protocol = url.protocol === "https:" ? "wss:" : "ws:";
    url.pathname = url.pathname.replace(/\/api\/?$/, "") + "/ws";
    url.search = "";
    url.hash = "";
    return url.toString();
  } catch {
    return `${location.protocol === "https:" ? "wss" : "ws"}://${location.hostname}:4000/ws`;
  }
}

function registerServiceWorker() {
  if (!("serviceWorker" in navigator) || !import.meta.env.PROD) return;
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("/worker-sw.js").catch(() => {});
  });
}

/* ════════════════════════════════════════
   App
   ════════════════════════════════════════ */

function App() {
  const [view, setView] = useState<View>("login");
  const [worker, setWorker] = useState<WorkerState | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [restoringSession, setRestoringSession] = useState(true);
  const [connection, setConnection] = useState<ConnectionStatus>({
    browserOnline: typeof navigator === "undefined" ? true : navigator.onLine,
    apiConnected: true,
    wsConnected: false,
  });

  const markApiConnected = (apiConnected: boolean) => {
    setConnection((current) => ({ ...current, apiConnected }));
  };

  useEffect(() => {
    const handleOnline = () => setConnection((current) => ({ ...current, browserOnline: true }));
    const handleOffline = () => setConnection((current) => ({ ...current, browserOnline: false, apiConnected: false, wsConnected: false }));
    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);
    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
    };
  }, []);

  useEffect(() => {
    const session = loadWorkerSession();
    if (!session) {
      setRestoringSession(false);
      return;
    }

    let cancelled = false;
    get<any>(`/workers/${session.workerId}/dashboard`, session.token)
      .then((data) => {
        if (cancelled) return;
        setWorker(workerFromDashboard(session.workerId, data));
        setToken(session.token);
        setView("dashboard");
        markApiConnected(true);
      })
      .catch((e: unknown) => {
        if (cancelled) return;
        if (isAuthError(e)) clearWorkerSession();
        markApiConnected(false);
      })
      .finally(() => {
        if (!cancelled) setRestoringSession(false);
      });

    return () => { cancelled = true; };
  }, []);

  const refreshWorker = async () => {
    if (!worker || !token) return;
    try {
      const data: any = await get(`/workers/${worker.id}/dashboard`, token);
      setWorker(workerFromDashboard(worker.id, data, worker));
      markApiConnected(true);
    } catch (e: any) {
      if (isAuthError(e)) {
        // Token expired or invalid — force re-login
        clearWorkerSession();
        setWorker(null);
        setToken(null);
        setView("login");
      } else {
        markApiConnected(false);
      }
    }
  };

  // WebSocket sync — auto-refresh on any event
  useEffect(() => {
    if (!worker || !token) {
      setConnection((current) => ({ ...current, wsConnected: false }));
      return;
    }

    let ws: WebSocket | null = null; let reconnect: ReturnType<typeof setTimeout> | undefined;
    const connect = () => {
      try {
        ws = new WebSocket(buildWorkerWebSocketUrl());
        ws.onopen = () => setConnection((current) => ({ ...current, wsConnected: true, apiConnected: true }));
        ws.onmessage = () => { void refreshWorker(); };
        ws.onclose = () => {
          setConnection((current) => ({ ...current, wsConnected: false }));
          reconnect = setTimeout(connect, 3000);
        };
        ws.onerror = () => { ws?.close(); };
      } catch {
        setConnection((current) => ({ ...current, wsConnected: false }));
      }
    };
    connect();
    return () => { if (reconnect) clearTimeout(reconnect); if (ws) { ws.onclose = null; ws.close(); } };
  }, [worker?.id, token]);

  if (restoringSession) {
    return <BootScreen message="Restoring worker session…" />;
  }

  const handleLogout = () => {
    clearWorkerSession();
    setWorker(null);
    setToken(null);
    setView("login");
    setConnection((current) => ({ ...current, wsConnected: false }));
  };

  if (!worker || !token) {
    return (
      <>
        <ConnectionBanner status={connection} showLiveStatus={false} />
        <LoginScreen
          onLogin={(w: WorkerState, t: string) => {
            saveWorkerSession(w.id, t);
            setWorker(w);
            setToken(t);
            setView("dashboard");
            markApiConnected(true);
          }}
          onApiConnectionChange={markApiConnected}
        />
      </>
    );
  }

  const handleStartService = async () => {
    if (!worker?.activeTurn?.id) {
      alert("No active service assigned. Wait for a turn to be assigned by the owner.");
      return;
    }
    try {
      await post(`/turns/${worker.activeTurn.id}/start`, { workerId: worker.id }, token);
      setWorker({ ...worker, status: "in_service" });
      markApiConnected(true);
      await refreshWorker();
    } catch (e: any) {
      markApiConnected(false);
      alert(e?.message || "Failed to start service");
    }
  };

  const handleCompleteService = async () => {
    if (!worker?.activeTurn?.id) return;
    try {
      await post(`/turns/${worker.activeTurn.id}/complete`, { workerId: worker.id }, token);
      markApiConnected(true);
      await refreshWorker();
    } catch (e: any) {
      markApiConnected(false);
      alert(e?.message || "Failed to complete service");
    }
  };

  const handleStatusChange = async (status: string) => {
    if (!worker) return;
    try {
      await patch(`/workers/${worker.id}/status`, { status }, token);
      setWorker({ ...worker, status });
      markApiConnected(true);
    } catch (e: any) {
      markApiConnected(false);
      alert(e?.message || "Failed to update status");
    }
  };

  return (
    <div className="has-bottom-nav">
      <ConnectionBanner status={connection} />
      <div className="pwa-shell">
        <div className="session-bar">
          <span>Signed in as {worker.name}</span>
          <button type="button" className="session-bar__logout" onClick={handleLogout}>Logout</button>
        </div>
        {view === "dashboard" && <Dashboard worker={worker} onStartService={handleStartService} onCompleteService={handleCompleteService} onBreak={() => handleStatusChange("on_break")} onAvailable={() => handleStatusChange("available")} />}
        {view === "appointments" && <AppointmentsScreen workerId={worker.id} token={token} onApiConnectionChange={markApiConnected} />}
        {view === "earnings" && <EarningsScreen worker={worker} />}
        {view === "reports" && <WorkerReportsScreen workerId={worker.id} token={token} onApiConnectionChange={markApiConnected} onAuthFailure={handleLogout} />} 
      </div>
      <nav className="bottom-nav">
        <button className={`bottom-nav__item ${view === "dashboard" ? "bottom-nav__item--active" : ""}`} onClick={() => setView("dashboard")}>
          <span className="bottom-nav__icon">🏠</span><span className="bottom-nav__label">Today</span>
        </button>
        <button className={`bottom-nav__item ${view === "appointments" ? "bottom-nav__item--active" : ""}`} onClick={() => setView("appointments")}>
          <span className="bottom-nav__icon">📅</span><span className="bottom-nav__label">Appts</span>
        </button>
        <button className={`bottom-nav__item ${view === "earnings" ? "bottom-nav__item--active" : ""}`} onClick={() => setView("earnings")}>
          <span className="bottom-nav__icon">💰</span><span className="bottom-nav__label">Earnings</span>
        </button>
        <button className={`bottom-nav__item ${view === "reports" ? "bottom-nav__item--active" : ""}`} onClick={() => setView("reports")}>
          <span className="bottom-nav__icon">📊</span><span className="bottom-nav__label">Reports</span>
        </button>
      </nav>
    </div>
  );
}

function BootScreen({ message }: { message: string }) {
  return (
    <div className="boot-screen">
      <div className="boot-screen__icon">💅</div>
      <div className="boot-screen__text">{message}</div>
    </div>
  );
}

function ConnectionBanner({ status, showLiveStatus = true }: { status: ConnectionStatus; showLiveStatus?: boolean }) {
  if (!status.browserOnline) {
    return <div className="connection-banner connection-banner--warning">Device is offline. Saved app screens may still open, but worker actions need the local API.</div>;
  }

  if (!status.apiConnected) {
    return <div className="connection-banner connection-banner--danger">Local API is disconnected. Worker actions are not queued; try again after the server reconnects.</div>;
  }

  if (showLiveStatus && !status.wsConnected) {
    return <div className="connection-banner connection-banner--info">Live updates are reconnecting. Use refresh or retry an action if today's data looks stale.</div>;
  }

  return null;
}

/* ════════════════════════════════════════
   Login Screen — real PIN auth
   ════════════════════════════════════════ */

function LoginScreen({ onLogin, onApiConnectionChange }: { onLogin: (w: WorkerState, token: string) => void; onApiConnectionChange: (connected: boolean) => void }) {
  const [workers, setWorkers] = useState<LoginWorkerOption[]>([]);
  const [selectedWorker, setSelectedWorker] = useState<LoginWorkerOption | null>(null);
  const [pin, setPin] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const pinInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    get<any[]>("/workers")
      .then((w) => {
        setWorkers(w.filter((x: any) => x.active).map((x: any) => ({
          id: x.id,
          displayName: x.displayName || x.user?.name || "Worker",
          status: x.currentStatus,
        })));
        onApiConnectionChange(true);
      })
      .catch(() => { onApiConnectionChange(false); });
  }, []);

  useEffect(() => {
    if (!selectedWorker) return;
    const focusTimer = window.setTimeout(() => pinInputRef.current?.focus(), 80);
    return () => window.clearTimeout(focusTimer);
  }, [selectedWorker?.id]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedWorker) { setError("Tap your name first."); return; }
    if (pin.length < 4) { setError("Enter at least 4 digits."); return; }
    setError("");
    setLoading(true);

    try {
      // Authenticate with PIN via the worker-login endpoint
      const loginData: any = await post("/auth/worker-login", {
        workerId: selectedWorker.id,
        pin,
      });

      const token = loginData.token as string;
      if (!token) throw new Error("No token returned");

      // Load full dashboard with the token
      const dashData: any = await get(`/workers/${selectedWorker.id}/dashboard`, token);
      const worker = workerFromDashboard(selectedWorker.id, dashData, {
        name: loginData.worker?.displayName || selectedWorker.displayName,
        status: loginData.worker?.currentStatus || selectedWorker.status || "available",
        commissionRate: loginData.worker?.commissionRate ?? 0,
      });

      onApiConnectionChange(true);
      onLogin(worker, token);
    } catch (e: any) {
      onApiConnectionChange(isAuthError(e));
      const msg = e?.message || "Login failed";
      setError(msg.includes("Invalid PIN") ? "Invalid PIN. Try the default: 1234" : msg);
    } finally {
      setLoading(false);
    }
  };

  const openPinSheet = (worker: LoginWorkerOption) => {
    if (loading) return;
    setSelectedWorker(worker);
    setPin("");
    setError("");
  };

  const closePinSheet = () => {
    if (loading) return;
    setSelectedWorker(null);
    setPin("");
    setError("");
  };

  const updatePinFromKeyboard = (value: string) => {
    setPin(value.replace(/\D/g, "").slice(0, 12));
    if (error) setError("");
  };

  const pressDigit = (digit: string) => {
    if (digit === "⌫") {
      setPin((current) => current.slice(0, -1));
      return;
    }
    if (digit) setPin((current) => `${current}${digit}`.slice(0, 12));
    if (error) setError("");
  };

  return (
    <main className="login-screen">
      <section className="login-card login-card--worker-picker" aria-labelledby="worker-login-title">
        <div className="login-brand">
          <div className="login-brand__mark" aria-hidden="true">💅</div>
          <div>
            <p className="login-brand__eyebrow">Worker PWA</p>
            <h1 id="worker-login-title" className="login-brand__title">Tap your name</h1>
          </div>
        </div>

        <p className="login-card__copy">No dropdowns. Pick your worker tile, then enter your PIN in the pop-out.</p>

        <div className="worker-tile-grid" aria-label="Worker list">
          {workers.length === 0 ? (
            <p className="login-empty">Worker list is loading…</p>
          ) : workers.map((worker) => (
            <button
              key={worker.id}
              type="button"
              className="worker-tile"
              onClick={() => openPinSheet(worker)}
              disabled={loading}
            >
              <span className="worker-tile__avatar" aria-hidden="true">{workerInitials(worker.displayName)}</span>
              <span className="worker-tile__body">
                <span className="worker-tile__name">{worker.displayName}</span>
                {worker.status && <span className="worker-tile__status">{formatStatus(worker.status)}</span>}
              </span>
              <span className="worker-tile__chevron" aria-hidden="true">›</span>
            </button>
          ))}
        </div>

        <p id="worker-login-help" className="login-help">Session stays signed in for 12 hours or until logout.</p>
      </section>

      {selectedWorker && (
        <div className="pin-popout" role="dialog" aria-modal="true" aria-labelledby="pin-popout-title">
          <button type="button" className="pin-popout__backdrop" aria-label="Change worker" onClick={closePinSheet} disabled={loading} />
          <form className="pin-popout__panel" onSubmit={handleSubmit}>
            <div className="pin-popout__handle" aria-hidden="true" />
            <div className="pin-popout__header">
              <button type="button" className="pin-popout__back" onClick={closePinSheet} disabled={loading}>←</button>
              <div>
                <p className="pin-popout__eyebrow">Signing in as</p>
                <h2 id="pin-popout-title" className="pin-popout__title">{selectedWorker.displayName}</h2>
              </div>
            </div>

            <label className="login-field">
              <span className="login-field__label">PIN</span>
              <input
                ref={pinInputRef}
                className="login-pin-input"
                type="password"
                value={pin}
                inputMode="numeric"
                pattern="[0-9]*"
                autoComplete="current-password"
                maxLength={12}
                onChange={(e) => updatePinFromKeyboard(e.target.value)}
                placeholder="••••"
                aria-describedby="worker-login-help"
              />
            </label>

            {error && <p className="login-error" role="alert">{error}</p>}

            <div className="login-keypad" aria-label="PIN keypad">
              {["1", "2", "3", "4", "5", "6", "7", "8", "9", "", "0", "⌫"].map((digit) => (
                <button key={digit || "spacer"} type="button" className="login-keypad__key" disabled={!digit || loading} onClick={() => pressDigit(digit)}>
                  {digit || ""}
                </button>
              ))}
            </div>

            <button type="submit" disabled={loading} className="btn btn--primary btn--full login-submit">
              {loading ? "Signing in…" : "Sign In"}
            </button>
          </form>
        </div>
=======
function saveSession(session: WorkerSession | null): void {
  if (!session) {
    localStorage.removeItem(SESSION_STORAGE_KEY);
    return;
  }
  localStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify(session));
}

function App() {
  const [session, setSession] = useState<WorkerSession | null>(() => loadSession());
  const [tab, setTab] = useState<Tab>("today");
  const [workerIdInput, setWorkerIdInput] = useState("");
  const [passwordInput, setPasswordInput] = useState("");
  const [loginLoading, setLoginLoading] = useState(false);
  const [loginError, setLoginError] = useState("");

  const [dashboard, setDashboard] = useState<WorkerDashboard | null>(null);
  const [loadingDashboard, setLoadingDashboard] = useState(false);
  const [dashboardError, setDashboardError] = useState("");
  const [todayStart, setTodayStart] = useState("");
  const [todayEnd, setTodayEnd] = useState("");

  const [appointments, setAppointments] = useState<WorkerAppointment[]>([]);
  const [appointmentsStart, setAppointmentsStart] = useState("");
  const [appointmentsEnd, setAppointmentsEnd] = useState("");
  const [appointmentsLoading, setAppointmentsLoading] = useState(false);
  const [appointmentsError, setAppointmentsError] = useState("");
  const [newAppointmentStart, setNewAppointmentStart] = useState("");
  const [newAppointmentEnd, setNewAppointmentEnd] = useState("");
  const [newAppointmentNotes, setNewAppointmentNotes] = useState("");
  const [creatingAppointment, setCreatingAppointment] = useState(false);

  const [earnings, setEarnings] = useState<WorkerEarnings | null>(null);
  const [earningsStart, setEarningsStart] = useState("");
  const [earningsEnd, setEarningsEnd] = useState("");
  const [earningsLoading, setEarningsLoading] = useState(false);
  const [earningsError, setEarningsError] = useState("");

  useEffect(() => {
    saveSession(session);
  }, [session]);

  useEffect(() => {
    if (!session) return;
    void fetchDashboard();
    void fetchAppointments();
    void fetchEarnings();
  }, [session]);

  const turnsLabel = useMemo(() => {
    if (!dashboard) return "0 turns";
    return dashboard.turnsTodayCount + (dashboard.turnsTodayCount === 1 ? " turn" : " turns");
  }, [dashboard]);

  async function handleLogin(event: React.FormEvent) {
    event.preventDefault();
    setLoginError("");
    if (!workerIdInput.trim() || !passwordInput.trim()) {
      setLoginError("Enter worker ID and password.");
      return;
    }
    setLoginLoading(true);
    try {
      const result = await fetchJson<WorkerLoginResponse>("/workers/login", {
        method: "POST",
        body: JSON.stringify({ workerId: workerIdInput.trim(), password: passwordInput }),
      });
      setSession({
        workerId: result.workerId,
        displayName: result.displayName,
        token: result.token,
        expiresAt: result.expiresAt,
      });
      setPasswordInput("");
      setTab("today");
    } catch (error) {
      setLoginError(error instanceof Error ? error.message : "Login failed.");
    } finally {
      setLoginLoading(false);
    }
  }

  function handleSignOut(message = "") {
    setSession(null);
    setDashboard(null);
    setAppointments([]);
    setEarnings(null);
    setDashboardError("");
    setAppointmentsError("");
    setEarningsError("");
    setLoginError(message);
    setPasswordInput("");
  }

  function requireSession(): WorkerSession {
    if (!session) {
      throw new Error("No session");
    }
    return session;
  }

  async function fetchDashboard() {
    const s = requireSession();
    setLoadingDashboard(true);
    setDashboardError("");
    try {
      const params = new URLSearchParams();
      if (todayStart) params.set("start", startOfDateInputToIso(todayStart));
      if (todayEnd) params.set("end", endOfDateInputToIso(todayEnd));
      const query = params.toString();
      const data = await fetchAuthedJson<WorkerDashboard>(s, "/worker/me/dashboard" + (query ? "?" + query : ""));
      setDashboard(data);
    } catch (error) {
      if (error instanceof ApiError && error.statusCode === 401) {
        handleSignOut("Session expired. Please log in again.");
      } else {
        setDashboardError(error instanceof Error ? error.message : "Unable to load dashboard.");
      }
    } finally {
      setLoadingDashboard(false);
    }
  }

  async function fetchAppointments() {
    const s = requireSession();
    setAppointmentsLoading(true);
    setAppointmentsError("");
    try {
      const params = new URLSearchParams();
      if (appointmentsStart) params.set("start", new Date(appointmentsStart).toISOString());
      if (appointmentsEnd) params.set("end", new Date(appointmentsEnd).toISOString());
      const query = params.toString();
      const data = await fetchAuthedJson<WorkerAppointment[]>(s, "/worker/me/appointments" + (query ? "?" + query : ""));
      setAppointments(data);
    } catch (error) {
      if (error instanceof ApiError && error.statusCode === 401) {
        handleSignOut("Session expired. Please log in again.");
      } else {
        setAppointmentsError(error instanceof Error ? error.message : "Unable to load appointments.");
      }
    } finally {
      setAppointmentsLoading(false);
    }
  }

  async function fetchEarnings() {
    const s = requireSession();
    setEarningsLoading(true);
    setEarningsError("");
    try {
      const params = new URLSearchParams();
      if (earningsStart) params.set("start", new Date(earningsStart).toISOString());
      if (earningsEnd) params.set("end", new Date(earningsEnd).toISOString());
      const query = params.toString();
      const data = await fetchAuthedJson<WorkerEarnings>(s, "/worker/me/earnings" + (query ? "?" + query : ""));
      setEarnings(data);
    } catch (error) {
      if (error instanceof ApiError && error.statusCode === 401) {
        handleSignOut("Session expired. Please log in again.");
      } else {
        setEarningsError(error instanceof Error ? error.message : "Unable to load earnings.");
      }
    } finally {
      setEarningsLoading(false);
    }
  }

  async function handleCreateAppointment(event: React.FormEvent) {
    event.preventDefault();
    if (!newAppointmentStart || !newAppointmentEnd) {
      setAppointmentsError("Start and end times are required.");
      return;
    }
    const s = requireSession();
    setCreatingAppointment(true);
    setAppointmentsError("");
    try {
      await fetchAuthedJson(s, "/worker/me/appointments", {
        method: "POST",
        body: JSON.stringify({
          startTime: new Date(newAppointmentStart).toISOString(),
          endTime: new Date(newAppointmentEnd).toISOString(),
          notes: newAppointmentNotes.trim() || undefined,
        }),
      });
      setNewAppointmentNotes("");
      setNewAppointmentStart("");
      setNewAppointmentEnd("");
      await fetchAppointments();
    } catch (error) {
      if (error instanceof ApiError && error.statusCode === 401) {
        handleSignOut("Session expired. Please log in again.");
      } else {
        setAppointmentsError(error instanceof Error ? error.message : "Unable to create appointment.");
      }
    } finally {
      setCreatingAppointment(false);
    }
  }

  async function handleDeleteAppointment(appointmentId: string) {
    if (!confirm("Cancel this appointment?")) return;
    const s = requireSession();
    setAppointmentsError("");
    try {
      await fetchAuthedJson(s, "/worker/me/appointments/" + encodeURIComponent(appointmentId), {
        method: "DELETE",
      });
      await fetchAppointments();
    } catch (error) {
      if (error instanceof ApiError && error.statusCode === 401) {
        handleSignOut("Session expired. Please log in again.");
      } else {
        setAppointmentsError(error instanceof Error ? error.message : "Unable to cancel appointment.");
      }
    }
  }

  if (!session) {
    return (
      <main className="mobile-shell auth-shell">
        <header className="app-head">
          <p>Worker PWA</p>
          <h1>Login</h1>
        </header>
        <form className="auth-card" onSubmit={handleLogin}>
          <label>
            Worker ID
            <input
              type="text"
              value={workerIdInput}
              onChange={(event) => setWorkerIdInput(event.target.value)}
              autoComplete="username"
              placeholder="worker id"
            />
          </label>
          <label>
            Password
            <input
              type="password"
              value={passwordInput}
              onChange={(event) => setPasswordInput(event.target.value)}
              autoComplete="current-password"
              placeholder="Enter password"
            />
          </label>
          {loginError && <p className="banner error">{loginError}</p>}
          <button type="submit" disabled={loginLoading}>
            {loginLoading ? "Signing in..." : "Sign in"}
          </button>
        </form>
      </main>
    );
  }

  return (
    <main className="mobile-shell">
      <header className="app-head">
        <div>
          <p>Worker PWA</p>
          <h1>{tab === "today" ? "Today" : tab === "appointments" ? "Appointments" : "Earnings"}</h1>
        </div>
        <button type="button" className="danger small" onClick={() => handleSignOut()}>
          Sign out
        </button>
      </header>

      <nav className="tab-strip tab-strip-3">
        <button type="button" className={tab === "today" ? "tab active" : "tab"} onClick={() => setTab("today")}>Today</button>
        <button type="button" className={tab === "appointments" ? "tab active" : "tab"} onClick={() => setTab("appointments")}>Appointments</button>
        <button type="button" className={tab === "earnings" ? "tab active" : "tab"} onClick={() => setTab("earnings")}>Earnings</button>
      </nav>

      {tab === "today" && (
        <>
          <section>
            <h2>Range</h2>
            <div className="filter-grid">
              <label>
                Start
                <input type="date" value={todayStart} onChange={(e) => setTodayStart(e.target.value)} />
              </label>
              <label>
                End
                <input type="date" value={todayEnd} onChange={(e) => setTodayEnd(e.target.value)} />
              </label>
            </div>
            <button type="button" className="secondary small" onClick={() => void fetchDashboard()}>
              {loadingDashboard ? "Loading..." : "Pull to refresh"}
            </button>
          </section>
          {dashboardError && <p className="banner error">{dashboardError}</p>}
          {loadingDashboard && !dashboard ? (
            <section className="skeleton-wrap">
              <div className="skeleton-line lg" />
              <div className="skeleton-line" />
              <div className="skeleton-grid">
                <div className="skeleton-box" />
                <div className="skeleton-box" />
                <div className="skeleton-box" />
                <div className="skeleton-box" />
              </div>
            </section>
          ) : (
            <>
              <section>
                <h2>Current status</h2>
                <div className="status-row">
                  <span className={"status-pill s-" + (dashboard?.worker.status ?? "available")}>
                    {dashboard?.worker.status.replace(/_/g, " ") ?? "available"}
                  </span>
                  <span className="muted">{turnsLabel}</span>
                </div>
              </section>

              <section>
                <h2>Active service</h2>
                {dashboard?.activeTurn ? (
                  <div className="active-card">
                    <p className="active-customer">{customerName(dashboard.activeTurn)}</p>
                    <p className="muted">Turn ID: {dashboard.activeTurn.id}</p>
                    <p className="muted">Type: {turnTypeLabel(dashboard.activeTurn.turnType)}</p>
                    <p className="muted">Started: {formatDateTime(dashboard.activeTurn.startedAt)}</p>
                    {dashboard.activeTurn.status === "in_service" && (
                      <p className="muted">Elapsed: {formatDurationFrom(dashboard.activeTurn.startedAt)}</p>
                    )}
                    {dashboard.activeTurn.checkinId && <p className="muted">Check-in: {dashboard.activeTurn.checkinId}</p>}
                    {dashboard.activeTurn.appointmentId && <p className="muted">Appointment: {dashboard.activeTurn.appointmentId}</p>}
                    {dashboard.activeTurn.checkin?.notes && <p className="muted wrap">{dashboard.activeTurn.checkin.notes}</p>}
                  </div>
                ) : (
                  <p className="muted">No active service right now.</p>
                )}
              </section>

              <section>
                <h2>Summary</h2>
                <div className="metric-grid">
                  <article className="metric-card"><span>Turns</span><strong>{dashboard?.turnsTodayCount ?? 0}</strong></article>
                  <article className="metric-card"><span>Service</span><strong>{formatMoney(dashboard?.salesRangeCents ?? dashboard?.salesTodayCents ?? 0)}</strong></article>
                  <article className="metric-card"><span>Tips</span><strong>{formatMoney(dashboard?.tipsRangeCents ?? dashboard?.tipsTodayCents ?? 0)}</strong></article>
                  <article className="metric-card"><span>Commission</span><strong>{formatMoney(dashboard?.commissionRangeCents ?? 0)}</strong></article>
                </div>
              </section>

              <section>
                <h2>Recent turns</h2>
                {!dashboard || dashboard.recentTurns.length === 0 ? (
                  <p className="muted">No turns found for this range.</p>
                ) : (
                  <ul className="turn-list">
                    {dashboard.recentTurns.slice(0, 20).map((turn) => (
                      <li key={turn.id} className="turn-row turn-row-detail">
                        <div className="turn-head">
                          <p className="turn-customer">{customerName(turn)}</p>
                          <span className={"status-pill s-" + turn.status}>{turn.status.replace(/_/g, " ")}</span>
                        </div>
                        <div className="turn-meta">
                          <span className="turn-meta-chip">Type: {turnTypeLabel(turn.turnType)}</span>
                          <span className="turn-meta-chip">Turn: {turn.id}</span>
                          {turn.checkinId && <span className="turn-meta-chip">Check-in: {turn.checkinId}</span>}
                          {turn.appointmentId && <span className="turn-meta-chip">Appt: {turn.appointmentId}</span>}
                        </div>
                        <div>
                          <p className="turn-section-label">Services</p>
                          {turn.serviceNames && turn.serviceNames.length > 0 ? (
                            <div className="service-chip-row">
                              {turn.serviceNames.map((name, idx) => (
                                <span key={`${turn.id}-svc-${idx}`} className="service-chip">{name}</span>
                              ))}
                            </div>
                          ) : (
                            <p className="muted">No services recorded</p>
                          )}
                        </div>
                        <div className="turn-grid turn-grid-money">
                          <div className="turn-grid-item">
                            <small className="turn-grid-label">Service</small>
                            <strong>{formatMoney(turn.serviceTotalCents ?? 0)}</strong>
                          </div>
                          <div className="turn-grid-item">
                            <small className="turn-grid-label">Tip</small>
                            <strong>{formatMoney(turn.tipTotalCents ?? 0)}</strong>
                          </div>
                          <div className="turn-grid-item">
                            <small className="turn-grid-label">Commission</small>
                            <strong>{formatMoney(turn.commissionCents ?? 0)}</strong>
                          </div>
                          <div className="turn-grid-item">
                            <small className="turn-grid-label">Turn total</small>
                            <strong>{formatMoney(turn.turnTotalCents ?? ((turn.serviceTotalCents ?? 0) + (turn.tipTotalCents ?? 0)))}</strong>
                          </div>
                        </div>
                        <div className="turn-grid turn-grid-time">
                          <div className="turn-grid-item">
                            <small className="turn-grid-label">Start</small>
                            <strong>{formatDateTime(turn.startedAt)}</strong>
                          </div>
                          <div className="turn-grid-item">
                            <small className="turn-grid-label">End</small>
                            <strong>{formatDateTime(turn.endedAt ?? turn.completedAt)}</strong>
                          </div>
                          <div className="turn-grid-item">
                            <small className="turn-grid-label">Duration</small>
                            <strong>{turnDurationLabel(turn)}</strong>
                          </div>
                        </div>
                        {turn.skippedReason && <p className="muted wrap">Skip reason: {turn.skippedReason}</p>}
                        <p className="muted wrap">{turn.checkin?.notes ?? "No notes"}</p>
                        <small className="muted">Updated: {formatTime(turn.endedAt ?? turn.completedAt ?? turn.createdAt ?? turn.startedAt)}</small>
                      </li>
                    ))}
                  </ul>
                )}
              </section>
            </>
          )}
        </>
      )}

      {tab === "appointments" && (
        <>
          <section>
            <h2>Filter</h2>
            <div className="filter-grid">
              <label>
                Start
                <input type="datetime-local" value={appointmentsStart} onChange={(e) => setAppointmentsStart(e.target.value)} />
              </label>
              <label>
                End
                <input type="datetime-local" value={appointmentsEnd} onChange={(e) => setAppointmentsEnd(e.target.value)} />
              </label>
            </div>
            <button type="button" className="secondary small" onClick={() => void fetchAppointments()}>
              {appointmentsLoading ? "Loading..." : "Pull to refresh"}
            </button>
          </section>

          <section>
            <h2>Add appointment</h2>
            <form className="auth-card" onSubmit={handleCreateAppointment}>
              <label>
                Start time
                <input type="datetime-local" value={newAppointmentStart} onChange={(e) => setNewAppointmentStart(e.target.value)} />
              </label>
              <label>
                End time
                <input type="datetime-local" value={newAppointmentEnd} onChange={(e) => setNewAppointmentEnd(e.target.value)} />
              </label>
              <label>
                Notes
                <input type="text" value={newAppointmentNotes} onChange={(e) => setNewAppointmentNotes(e.target.value)} placeholder="Optional notes" />
              </label>
              <button type="submit" disabled={creatingAppointment}>
                {creatingAppointment ? "Saving..." : "Add appointment"}
              </button>
            </form>
          </section>

          {appointmentsError && <p className="banner error">{appointmentsError}</p>}
          <section>
            <h2>My appointments</h2>
            {appointmentsLoading ? (
              <p className="muted">Loading appointments...</p>
            ) : appointments.length === 0 ? (
              <p className="muted">No appointments found.</p>
            ) : (
              <ul className="turn-list">
                {appointments.map((appointment) => (
                  <li key={appointment.id} className="turn-row">
                    <div className="turn-left">
                      <p className="turn-customer">{appointment.customer?.name ?? appointment.customer?.phone ?? "Customer not set"}</p>
                      <p className="muted">Start: {formatDateTime(appointment.startTime)}</p>
                      <p className="muted">End: {formatDateTime(appointment.endTime)}</p>
                      {appointment.notes && <p className="muted wrap">{appointment.notes}</p>}
                    </div>
                    <div className="turn-right">
                      <span className={"status-pill s-" + appointment.status}>{appointment.status.replace(/_/g, " ")}</span>
                      <button type="button" className="danger small" onClick={() => void handleDeleteAppointment(appointment.id)}>Delete</button>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </>
      )}

      {tab === "earnings" && (
        <>
          <section>
            <h2>Range</h2>
            <div className="filter-grid">
              <label>
                Start
                <input type="datetime-local" value={earningsStart} onChange={(e) => setEarningsStart(e.target.value)} />
              </label>
              <label>
                End
                <input type="datetime-local" value={earningsEnd} onChange={(e) => setEarningsEnd(e.target.value)} />
              </label>
            </div>
            <button type="button" className="secondary small" onClick={() => void fetchEarnings()}>
              {earningsLoading ? "Loading..." : "Pull to refresh"}
            </button>
          </section>

          {earningsError && <p className="banner error">{earningsError}</p>}
          <section>
            <h2>Totals</h2>
            <div className="metric-grid">
              <article className="metric-card"><span>Service</span><strong>{formatMoney(earnings?.totals.serviceCents ?? 0)}</strong></article>
              <article className="metric-card"><span>Tips</span><strong>{formatMoney(earnings?.totals.tipsCents ?? 0)}</strong></article>
              <article className="metric-card"><span>Commission</span><strong>{formatMoney(earnings?.totals.commissionCents ?? 0)}</strong></article>
              <article className="metric-card"><span>Est. pay</span><strong>{formatMoney(earnings?.totals.estimatedPayCents ?? 0)}</strong></article>
            </div>
          </section>

          <section>
            <h2>By day</h2>
            {!earnings || earnings.byDay.length === 0 ? (
              <p className="muted">No earnings records for this range.</p>
            ) : (
              <ul className="turn-list">
                {earnings.byDay.map((day) => (
                  <li key={day.date} className="turn-row">
                    <div className="turn-left">
                      <p className="turn-customer">{day.date}</p>
                      <p className="muted">Service: {formatMoney(day.serviceCents)}</p>
                      <p className="muted">Tips: {formatMoney(day.tipsCents)}</p>
                    </div>
                    <div className="turn-right">
                      <small className="muted">Commission</small>
                      <strong>{formatMoney(day.commissionCents)}</strong>
                      <small className="muted">Est: {formatMoney(day.estimatedPayCents)}</small>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </>
>>>>>>> bdf0b2066dfcb2e3e613cb86c08bdfaba329da34
      )}
    </main>
  );
}

<<<<<<< HEAD
/* ════════════════════════════════════════
   Dashboard
   ════════════════════════════════════════ */

function Dashboard({ worker, onStartService, onCompleteService, onBreak, onAvailable }: {
  worker: WorkerState;
  onStartService: () => void;
  onCompleteService: () => void;
  onBreak: () => void;
  onAvailable: () => void;
}) {
  const commission = Math.round(worker.salesTodayCents * worker.commissionRate);
  const totalPay = commission + worker.tipsTodayCents;

  return (
    <>
      <header className="pwa-header">
        <span className="pwa-header__eyebrow">{worker.name}</span>
        <h1 className="pwa-header__title">Today's Dashboard</h1>
      </header>

      <div className={`status-banner status-banner--${worker.status}`}>
        <span>{worker.status === "available" ? "✅" : worker.status === "in_service" ? "🔨" : "☕"}</span>
        <span>{worker.status.replaceAll("_", " ").replace(/\b\w/g, (c) => c.toUpperCase())}</span>
      </div>

      {worker.status === "available" && (
        <div className="actions-row">
          <button className="btn btn--primary btn--full" onClick={onStartService}>▶ Start Service</button>
          <button className="btn btn--secondary btn--full" onClick={onBreak}>☕ Take Break</button>
        </div>
      )}
      {worker.status === "in_service" && (
        <div className="actions-row">
          <button className="btn btn--primary btn--full" onClick={onCompleteService}>✓ Complete</button>
        </div>
      )}
      {worker.status === "on_break" && (
        <div className="actions-row">
          <button className="btn btn--primary btn--full" onClick={onAvailable}>✅ Back to Available</button>
        </div>
      )}

      {worker.activeTurn && (
        <div className="active-turn">
          <div className="active-turn__label">🔨 Active Service</div>
          <div className="active-turn__customer">{worker.activeTurn.customerName || "Customer"}</div>
          {worker.activeTurn.startedAt && <div className="active-turn__meta">Started {timeAgo(worker.activeTurn.startedAt)}</div>}
        </div>
      )}

      <div className="stat-grid-3">
        <div className="mini-stat"><span className="mini-stat__value">{worker.turnsToday}</span><span className="mini-stat__label">Turns</span></div>
        <div className="mini-stat"><span className="mini-stat__value">{formatMoney(worker.salesTodayCents)}</span><span className="mini-stat__label">Sales</span></div>
        <div className="mini-stat"><span className="mini-stat__value">{formatMoney(worker.tipsTodayCents)}</span><span className="mini-stat__label">Tips</span></div>
      </div>

      <div className="earnings-total">
        <div className="earnings-total__label">Estimated Pay Today</div>
        <div className="earnings-total__amount">{formatMoney(totalPay)}</div>
        <div className="earnings-total__label" style={{ fontSize: "var(--text-xs)" }}>
          Commission {Math.round(worker.commissionRate * 100)}% · {formatMoney(commission)} + Tips {formatMoney(worker.tipsTodayCents)}
        </div>
      </div>
    </>
  );
}

/* ════════════════════════════════════════
   Appointments
   ════════════════════════════════════════ */

function AppointmentsScreen({ workerId, token, onApiConnectionChange }: { workerId: string; token: string | null; onApiConnectionChange: (connected: boolean) => void }) {
  const [appts, setAppts] = useState<any[]>([]);

  useEffect(() => {
    get<any[]>(`/appointments?workerId=${workerId}&date=${todayStr()}`, token ?? undefined).then((data) => {
      onApiConnectionChange(true);
      setAppts((data || []).map((a: any) => ({
        id: a.id,
        time: formatTime(a.startTime),
        customer: a.customer?.name || "Customer",
        service: a.services?.map((s: any) => s.service?.name || "Service").join(", ") || "—",
        durationMin: a.services?.[0]?.durationMinutes || 30,
        status: a.status,
      })));
    }).catch(() => { onApiConnectionChange(false); });
  }, [workerId]);

  return (
    <>
      <header className="pwa-header">
        <span className="pwa-header__eyebrow">Schedule</span>
        <h1 className="pwa-header__title">My Appointments</h1>
        <p className="text-muted text-sm mt-2">{new Date().toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" })}</p>
      </header>
      {appts.length === 0 ? <p className="text-muted text-sm text-center mt-4">No appointments today.</p> : (
        <div className="appt-list">
          {appts.map((apt: any) => (
            <div key={apt.id} className="appt-item">
              <div className="appt-item__time">{apt.time}</div>
              <div className="appt-item__info"><div className="appt-item__name">{apt.customer}</div><div className="appt-item__service">{apt.service} · {apt.durationMin} min</div></div>
              <span className={`status-pill ${apt.status === "checked_in" ? "status-pill--info" : "status-pill--success"}`}>{apt.status.replaceAll("_", " ")}</span>
            </div>
          ))}
        </div>
      )}
    </>
  );
}

/* ════════════════════════════════════════
   Earnings
   ════════════════════════════════════════ */

function EarningsScreen({ worker }: { worker: WorkerState }) {
  const commission = Math.round(worker.salesTodayCents * worker.commissionRate);
  const totalPay = commission + worker.tipsTodayCents;

  return (
    <>
      <header className="pwa-header"><span className="pwa-header__eyebrow">My Pay</span><h1 className="pwa-header__title">Earnings</h1></header>
      <div className="earnings-total"><div className="earnings-total__label">Today's Estimated Pay</div><div className="earnings-total__amount">{formatMoney(totalPay)}</div></div>
      <div className="pwa-section">
        <h2 className="pwa-section__title">Today's Breakdown</h2>
        <div className="earnings-row"><span className="earnings-row__label">Turns</span><span className="earnings-row__value">{worker.turnsToday}</span></div>
        <div className="earnings-row"><span className="earnings-row__label">Sales</span><span className="earnings-row__value">{formatMoney(worker.salesTodayCents)}</span></div>
        <div className="earnings-row"><span className="earnings-row__label">Commission ({Math.round(worker.commissionRate * 100)}%)</span><span className="earnings-row__value">{formatMoney(commission)}</span></div>
        <div className="earnings-row"><span className="earnings-row__label">Tips</span><span className="earnings-row__value">{formatMoney(worker.tipsTodayCents)}</span></div>
        <div className="earnings-row" style={{ fontWeight: "var(--font-bold)", borderTop: "2px solid var(--color-primary)", paddingTop: "var(--space-4)", marginTop: "var(--space-2)" }}>
          <span className="earnings-row__label">Total Pay</span><span className="earnings-row__value" style={{ color: "var(--color-primary)", fontSize: "var(--text-lg)" }}>{formatMoney(totalPay)}</span>
        </div>
      </div>
    </>
  );
}

/* ════════════════════════════════════════
   Worker Reports
   ════════════════════════════════════════ */

function WorkerReportsScreen({ workerId, token, onApiConnectionChange, onAuthFailure }: {
  workerId: string;
  token: string;
  onApiConnectionChange: (connected: boolean) => void;
  onAuthFailure: () => void;
}) {
  const [preset, setPreset] = useState<ReportPreset>("today");
  const [report, setReport] = useState<WorkerTicketReport | null>(null);
  const [selectedTicket, setSelectedTicket] = useState<WorkerTicket | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const range = getReportRange(preset);

  const loadReport = async () => {
    setLoading(true);
    setError("");
    try {
      const params = new URLSearchParams({
        start: `${range.start}T00:00:00`,
        end: `${addDaysToDateInput(range.end, 1)}T00:00:00`,
      });
      const data = await get<WorkerTicketReport>(`/workers/${workerId}/tickets?${params.toString()}`, token);
      setReport(data);
      onApiConnectionChange(true);
    } catch (e: unknown) {
      if (isAuthError(e)) {
        onAuthFailure();
        return;
      }
      onApiConnectionChange(false);
      setError(e instanceof Error ? e.message : "Failed to load tickets.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { void loadReport(); }, [workerId, preset]);

  const summary = report?.summary ?? {
    ticketCount: 0,
    serviceCount: 0,
    serviceTotalCents: 0,
    tipTotalCents: 0,
    commissionTotalCents: 0,
    payTotalCents: 0,
  };

  return (
    <>
      <header className="pwa-header">
        <span className="pwa-header__eyebrow">My Tickets</span>
        <h1 className="pwa-header__title">Reports</h1>
        <p className="text-muted text-sm mt-2">{range.label}</p>
      </header>

      <div className="report-presets" role="tablist" aria-label="Report date range">
        {reportPresetOptions.map((option) => (
          <button
            key={option.key}
            type="button"
            role="tab"
            aria-selected={preset === option.key}
            className={`report-preset ${preset === option.key ? "report-preset--active" : ""}`}
            onClick={() => setPreset(option.key)}
          >
            {option.label}
          </button>
        ))}
      </div>

      <div className="worker-report-toolbar">
        <span>{loading ? "Loading…" : `${summary.ticketCount} ticket${summary.ticketCount === 1 ? "" : "s"}`}</span>
        <button type="button" className="session-bar__logout" onClick={loadReport} disabled={loading}>Retry</button>
      </div>

      <div className="report-summary-grid">
        <ReportSummaryCard label="Tickets" value={String(summary.ticketCount)} />
        <ReportSummaryCard label="Services" value={String(summary.serviceCount)} />
        <ReportSummaryCard label="Service Total" value={formatMoney(summary.serviceTotalCents)} />
        <ReportSummaryCard label="Tips" value={formatMoney(summary.tipTotalCents)} />
        <ReportSummaryCard label="Commission" value={formatMoney(summary.commissionTotalCents)} />
        <ReportSummaryCard label="Total Pay" value={formatMoney(summary.payTotalCents)} highlight />
      </div>

      {error && <div className="report-state report-state--error"><strong>Could not load tickets.</strong><span>{error}</span><button className="btn btn--secondary" onClick={loadReport}>Retry</button></div>}
      {!error && loading && <div className="report-state">Loading your tickets…</div>}
      {!error && !loading && report?.tickets.length === 0 && <div className="report-state">No paid tickets for this range.</div>}

      {!error && report && report.tickets.length > 0 && (
        <div className="worker-ticket-list">
          {report.tickets.map((ticket) => (
            <button key={ticket.id} type="button" className="worker-ticket-card" onClick={() => setSelectedTicket(ticket)}>
              <span className="worker-ticket-card__top"><strong>{ticket.customerName}</strong><span>{ticket.completedAt ? formatDateTime(ticket.completedAt) : "Pending time"}</span></span>
              <span className="worker-ticket-card__services">{ticket.services.map((service) => service.serviceName).join(", ")}</span>
              <span className="worker-ticket-card__totals">
                <span><small>Services</small><strong>{formatMoney(ticket.totals.serviceCents)}</strong></span>
                <span><small>Tips</small><strong>{formatMoney(ticket.totals.tipsCents)}</strong></span>
                <span><small>Commission</small><strong>{formatMoney(ticket.totals.commissionCents)}</strong></span>
                <span className="worker-ticket-card__pay"><small>Pay</small><strong>{formatMoney(ticket.totals.payCents)}</strong></span>
              </span>
            </button>
          ))}
        </div>
      )}

      {selectedTicket && (
        <div className="ticket-detail-popout" role="dialog" aria-modal="true" aria-labelledby="ticket-detail-title">
          <button type="button" className="pin-popout__backdrop" aria-label="Close ticket detail" onClick={() => setSelectedTicket(null)} />
          <section className="ticket-detail-panel">
            <div className="pin-popout__handle" aria-hidden="true" />
            <div className="ticket-detail-panel__header">
              <div><p className="pin-popout__eyebrow">Ticket</p><h2 id="ticket-detail-title">{selectedTicket.customerName}</h2></div>
              <button type="button" className="pin-popout__back" onClick={() => setSelectedTicket(null)}>×</button>
            </div>
            <p className="text-muted text-sm">{selectedTicket.completedAt ? formatDateTime(selectedTicket.completedAt) : "Completed time unavailable"}</p>
            <div className="ticket-service-lines">
              {selectedTicket.services.map((service) => (
                <div key={service.id} className="ticket-service-line">
                  <div><strong>{service.serviceName}</strong>{service.discountCents > 0 && <small>Discount {formatMoney(service.discountCents)}</small>}</div>
                  <div><span>Service {formatMoney(service.serviceCents)}</span><span>Tip {formatMoney(service.tipsCents)}</span><span>Commission {formatMoney(service.commissionCents)}</span><strong>Pay {formatMoney(service.payCents)}</strong></div>
                </div>
              ))}
            </div>
          </section>
        </div>
      )}
    </>
  );
}

function ReportSummaryCard({ label, value, highlight }: { label: string; value: string; highlight?: boolean }) {
  return <div className={`report-summary-card ${highlight ? "report-summary-card--highlight" : ""}`}><span>{label}</span><strong>{value}</strong></div>;
}

const reportPresetOptions: { key: ReportPreset; label: string }[] = [
  { key: "today", label: "Today" },
  { key: "yesterday", label: "Yesterday" },
  { key: "week", label: "7 Days" },
  { key: "month", label: "Month" },
];

/* ════════════════════════════════════════
   Helpers
   ════════════════════════════════════════ */

function formatMoney(c: number) { return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(c / 100); }
function timeAgo(iso: string) { const m = Math.floor((Date.now() - new Date(iso).getTime()) / 60000); return m < 1 ? "just now" : m < 60 ? `${m}m ago` : `${Math.floor(m / 60)}h ago`; }
function todayStr() { return new Date().toISOString().slice(0, 10); }
function formatTime(iso: string) { return new Date(iso).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }); }
function formatDateTime(iso: string) { return new Date(iso).toLocaleString([], { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" }); }
function formatStatus(status: string) { return status.replaceAll("_", " "); }
function dateInputValue(date: Date) { return date.toISOString().slice(0, 10); }
function addDaysToDateInput(value: string, days: number) { const date = new Date(`${value}T00:00:00`); date.setDate(date.getDate() + days); return dateInputValue(date); }
function getReportRange(preset: ReportPreset) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const end = new Date(today);
  const start = new Date(today);
  if (preset === "yesterday") { start.setDate(today.getDate() - 1); end.setDate(today.getDate() - 1); }
  if (preset === "week") start.setDate(today.getDate() - 6);
  if (preset === "month") start.setDate(1);
  return {
    start: dateInputValue(start),
    end: dateInputValue(end),
    label: dateInputValue(start) === dateInputValue(end) ? dateInputValue(start) : `${dateInputValue(start)} - ${dateInputValue(end)}`,
  };
}
function workerInitials(name: string) {
  const initials = name.trim().split(/\s+/).slice(0, 2).map((part) => part[0]?.toUpperCase() ?? "").join("");
  return initials || "W";
}

registerServiceWorker();
createRoot(document.getElementById("root")!).render(<React.StrictMode><App /></React.StrictMode>);
=======
class ApiError extends Error {
  statusCode: number;

  constructor(statusCode: number, message: string) {
    super(message);
    this.statusCode = statusCode;
  }
}

async function fetchJson<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(API_BASE_URL + path, {
    headers: { "Content-Type": "application/json", ...init?.headers },
    ...init,
  });
  if (!response.ok) {
    let message = "Request failed";
    try {
      const data = (await response.json()) as { error?: string };
      message = data.error ?? message;
    } catch {
      // ignore parse failures
    }
    throw new ApiError(response.status, message);
  }
  return response.json() as Promise<T>;
}

async function fetchAuthedJson<T>(session: WorkerSession, path: string, init?: RequestInit): Promise<T> {
  return fetchJson<T>(path, {
    ...init,
    headers: {
      ...(init?.headers ?? {}),
      Authorization: `Bearer ${session.token}`,
    },
  });
}

createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
>>>>>>> bdf0b2066dfcb2e3e613cb86c08bdfaba329da34
