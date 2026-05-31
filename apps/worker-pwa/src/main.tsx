import React, { useEffect, useState } from "react";
import { createRoot } from "react-dom/client";
import "./styles.css";

const API_BASE = import.meta.env?.VITE_API_BASE_URL ?? "http://localhost:4000/api";

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

type View = "login" | "dashboard" | "appointments" | "earnings";

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

/* ════════════════════════════════════════
   App
   ════════════════════════════════════════ */

function App() {
  const [view, setView] = useState<View>("login");
  const [worker, setWorker] = useState<WorkerState | null>(null);
  const [token, setToken] = useState<string | null>(null);

  if (!worker || !token) {
    return <LoginScreen onLogin={(w: WorkerState, t: string) => { setWorker(w); setToken(t); setView("dashboard"); }} />;
  }

  const handleStartService = async () => {
    if (!worker?.activeTurn?.id) {
      alert("No active service assigned. Wait for a turn to be assigned by the owner.");
      return;
    }
    try {
      await post(`/turns/${worker.activeTurn.id}/start`, { workerId: worker.id }, token);
      setWorker({ ...worker, status: "in_service" });
      await refreshWorker();
    } catch (e: any) {
      alert(e?.message || "Failed to start service");
    }
  };

  const handleCompleteService = async () => {
    if (!worker?.activeTurn?.id) return;
    try {
      await post(`/turns/${worker.activeTurn.id}/complete`, { workerId: worker.id }, token);
      await refreshWorker();
    } catch (e: any) {
      alert(e?.message || "Failed to complete service");
    }
  };

  // WebSocket sync — auto-refresh on any event
  useEffect(() => {
    let ws: WebSocket | null = null; let reconnect: any;
    const connect = () => {
      try {
        ws = new WebSocket(`${location.protocol === "https:" ? "wss" : "ws"}://${location.hostname}:4000/ws`);
        ws.onmessage = () => { void refreshWorker(); };
        ws.onclose = () => { reconnect = setTimeout(connect, 3000); };
        ws.onerror = () => { ws?.close(); };
      } catch {}
    };
    connect();
    return () => { clearTimeout(reconnect); if (ws) { ws.onclose = null; ws.close(); } };
  }, [worker?.id]);

  const handleStatusChange = async (status: string) => {
    if (!worker) return;
    try {
      await patch(`/workers/${worker.id}/status`, { status }, token);
      setWorker({ ...worker, status });
    } catch (e: any) {
      alert(e?.message || "Failed to update status");
    }
  };

  const refreshWorker = async () => {
    if (!worker) return;
    try {
      const data: any = await get(`/workers/${worker.id}/dashboard`, token);
      const turn = data.activeTurn || null;
      setWorker({
        ...worker,
        status: data.status || worker.status,
        turnsToday: data.turnsTakenToday ?? 0,
        salesTodayCents: data.serviceSalesTodayCents ?? 0,
        tipsTodayCents: data.tipsTodayCents ?? 0,
        commissionRate: data.commissionRate ?? worker.commissionRate,
        activeTurn: turn ? { id: turn.id, customerName: turn.customerName, startedAt: turn.startedAt } : null,
      });
    } catch (e: any) {
      if (e?.message?.includes("401") || e?.message?.includes("403")) {
        // Token expired or invalid — force re-login
        setWorker(null);
        setToken(null);
        setView("login");
      }
    }
  };

  return (
    <div className="has-bottom-nav">
      <div className="pwa-shell">
        {view === "dashboard" && <Dashboard worker={worker} onStartService={handleStartService} onCompleteService={handleCompleteService} onBreak={() => handleStatusChange("on_break")} onAvailable={() => handleStatusChange("available")} />}
        {view === "appointments" && <AppointmentsScreen workerId={worker.id} token={token} />}
        {view === "earnings" && <EarningsScreen worker={worker} />}
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
      </nav>
    </div>
  );
}

/* ════════════════════════════════════════
   Login Screen — real PIN auth
   ════════════════════════════════════════ */

function LoginScreen({ onLogin }: { onLogin: (w: WorkerState, token: string) => void }) {
  const [workers, setWorkers] = useState<any[]>([]);
  const [selectedId, setSelectedId] = useState("");
  const [pin, setPin] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    get<any[]>("/workers").then((w) => setWorkers(w.filter((x: any) => x.active))).catch(() => {});
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedId) { setError("Select a worker."); return; }
    if (pin.length < 4) { setError("Enter at least 4 digits."); return; }
    setError("");
    setLoading(true);

    try {
      // Authenticate with PIN via the worker-login endpoint
      const loginData: any = await post("/auth/worker-login", {
        workerId: selectedId,
        pin,
      });

      const token = loginData.token as string;
      if (!token) throw new Error("No token returned");

      // Load full dashboard with the token
      const dashData: any = await get(`/workers/${selectedId}/dashboard`, token);
      const turn = dashData.activeTurn || null;

      onLogin({
        id: selectedId,
        name: loginData.worker?.displayName || dashData.name || "Worker",
        status: loginData.worker?.currentStatus || dashData.status || "available",
        turnsToday: dashData.turnsTakenToday ?? 0,
        salesTodayCents: dashData.serviceSalesTodayCents ?? 0,
        tipsTodayCents: dashData.tipsTodayCents ?? 0,
        commissionRate: loginData.worker?.commissionRate ?? Number(dashData.commissionRate ?? 0),
        activeTurn: turn ? { id: turn.id, customerName: turn.customerName, startedAt: turn.startedAt } : null,
      }, token);
    } catch (e: any) {
      const msg = e?.message || "Login failed";
      setError(msg.includes("Invalid PIN") ? "Invalid PIN. Try the default: 1234" : msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ minHeight: "100dvh", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "var(--space-4)", background: "linear-gradient(135deg, var(--color-primary-50), var(--color-bg))" }}>
      <div style={{ width: "min(360px, 100%)", textAlign: "center" }}>
        <div style={{ fontSize: "3rem", marginBottom: "var(--space-3)" }}>💅</div>
        <h1 style={{ margin: "0 0 var(--space-1)", fontSize: "var(--text-xl)", fontWeight: "var(--font-bold)" }}>Worker Login</h1>
        <p style={{ margin: "0 0 var(--space-6)", fontSize: "var(--text-sm)", color: "var(--color-text-muted)" }}>Select worker & enter PIN</p>
        <form onSubmit={handleSubmit}>
          <select value={selectedId} onChange={(e) => setSelectedId(e.target.value)}
            style={{ width: "100%", height: "48px", marginBottom: "var(--space-3)", padding: "0 var(--space-3)", border: "1px solid var(--color-border)", borderRadius: "var(--radius-md)", fontSize: "var(--text-sm)" }}>
            <option value="">-- Select Worker --</option>
            {workers.map((w: any) => (<option key={w.id} value={w.id}>{w.displayName || w.user?.name}</option>))}
          </select>
          <input type="password" value={pin} readOnly
            style={{ width: "100%", height: "56px", textAlign: "center", fontSize: "var(--text-xl)", letterSpacing: "0.5em", border: "1px solid var(--color-border)", borderRadius: "var(--radius-md)", background: "var(--color-surface)", outline: "none", fontFamily: "var(--font-mono)" }} placeholder="····" />
          {error && <p style={{ color: "var(--color-danger)", fontSize: "var(--text-sm)", marginTop: "var(--space-2)" }}>{error}</p>}
        </form>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: "var(--space-2)", marginTop: "var(--space-4)" }}>
          {["1", "2", "3", "4", "5", "6", "7", "8", "9", "", "0", "⌫"].map((digit) => (
            <button key={digit} type="button" disabled={!digit} onClick={() => { if (digit === "⌫") setPin(pin.slice(0, -1)); else if (digit) setPin(pin + digit); }}
              style={{ height: "52px", border: "1px solid var(--color-border)", borderRadius: "var(--radius-md)", background: "var(--color-surface)", fontSize: "var(--text-lg)", fontWeight: "var(--font-semibold)", cursor: digit ? "pointer" : "default" }}>
              {digit || ""}
            </button>
          ))}
        </div>
        <button type="submit" onClick={handleSubmit} disabled={loading} className="btn btn--primary btn--full" style={{ marginTop: "var(--space-4)" }}>
          {loading ? "Signing in…" : "Sign In"}
        </button>
      </div>
    </div>
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

function AppointmentsScreen({ workerId, token }: { workerId: string; token: string | null }) {
  const [appts, setAppts] = useState<any[]>([]);

  useEffect(() => {
    get<any[]>(`/appointments?workerId=${workerId}&date=${todayStr()}`, token ?? undefined).then((data) => {
      setAppts((data || []).map((a: any) => ({
        id: a.id,
        time: formatTime(a.startTime),
        customer: a.customer?.name || "Customer",
        service: a.services?.map((s: any) => s.service?.name || "Service").join(", ") || "—",
        durationMin: a.services?.[0]?.durationMinutes || 30,
        status: a.status,
      })));
    }).catch(() => {});
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
   Helpers
   ════════════════════════════════════════ */

function formatMoney(c: number) { return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(c / 100); }
function timeAgo(iso: string) { const m = Math.floor((Date.now() - new Date(iso).getTime()) / 60000); return m < 1 ? "just now" : m < 60 ? `${m}m ago` : `${Math.floor(m / 60)}h ago`; }
function todayStr() { return new Date().toISOString().slice(0, 10); }
function formatTime(iso: string) { return new Date(iso).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }); }

createRoot(document.getElementById("root")!).render(<React.StrictMode><App /></React.StrictMode>);