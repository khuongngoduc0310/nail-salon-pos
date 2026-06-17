import React, { useEffect, useRef, useState } from "react";
import { createRoot } from "react-dom/client";
import "./styles.css";

const API_BASE = import.meta.env?.VITE_API_BASE_URL ?? "http://localhost:4000/api";
const WORKER_SESSION_TTL_MS = 12 * 60 * 60 * 1000;
const WORKER_SESSION_STORAGE_KEY = "nail.workerPwa.session";

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
  totals: {
    serviceCents: number;
    tipsCents: number;
    commissionCents: number;
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
    return null;
  }
}

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
      )}
    </main>
  );
}

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
