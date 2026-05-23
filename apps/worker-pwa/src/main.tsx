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
  totals: {
    serviceCents: number;
    tipsCents: number;
    commissionCents: number;
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
    return null;
  }
}

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
      )}
    </main>
  );
}

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
