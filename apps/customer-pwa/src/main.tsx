import React, { useEffect, useState } from "react";
import { createRoot } from "react-dom/client";
import "./styles.css";

<<<<<<< HEAD
const API_BASE = import.meta.env?.VITE_API_BASE_URL ?? getDefaultApiBaseUrl();

function getDefaultApiBaseUrl(): string {
  return `http://${window.location.hostname}:4000/api`;
}

async function get<T>(path: string): Promise<T> {
  const r = await fetch(`${API_BASE}${path}`);
  if (!r.ok) throw new Error(`${r.status}`);
  return r.json() as Promise<T>;
}
async function post<T>(path: string, body: unknown): Promise<T> {
  const r = await fetch(`${API_BASE}${path}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
  if (!r.ok) throw new Error(`${r.status}`);
  return r.json() as Promise<T>;
}

/* ════════════════════════════════════════
   Types
   ════════════════════════════════════════ */

type View = "landing" | "book" | "checkin" | "status" | "confirmed";

type BookingState = {
  services: string[];
  date: string;
  time: string;
  workerId: string;
  name: string;
  phone: string;
};

/* ════════════════════════════════════════
   App
   ════════════════════════════════════════ */

function App() {
  const [view, setView] = useState<View>("landing");
  const [booking, setBooking] = useState<BookingState>({
    services: [],
    date: todayStr(),
    time: "",
    workerId: "",
    name: "",
    phone: "",
  });
  const [checkinName, setCheckinName] = useState("");
  const [checkinPhone, setCheckinPhone] = useState("");
  const [statusStep, setStatusStep] = useState<string>("confirmed");
  const [services, setServices] = useState<any[]>([]);
  const [workers, setWorkers] = useState<any[]>([]);

  useEffect(() => {
    Promise.all([get<any[]>("/services?active=true"), get<any[]>("/workers")]).then(([s, w]) => {
      setServices(s);
      setWorkers(w.filter((x: any) => x.active));
    }).catch(() => {});
  }, []);

  const submitBooking = async () => {
    if (!booking.name || !booking.phone || booking.services.length === 0 || !booking.time) return;
    try {
      const startTime = `${booking.date}T${booking.time}:00`;
      const svc = services.find((s: any) => s.id === booking.services[0]);
      const endTime = svc ? new Date(new Date(startTime).getTime() + (svc.durationMinutes || 30) * 60000).toISOString() : startTime;
      await post("/appointments", {
        workerId: booking.workerId || undefined,
        startTime,
        endTime,
        customer: { name: booking.name, phone: booking.phone },
        status: "scheduled",
      });
      setView("confirmed");
    } catch { /* ignore */ }
  };

  const submitCheckin = async () => {
    const name = checkinName.trim();
    const phone = checkinPhone.trim();
    if (!name && !phone) return;
    try {
      await post("/checkins", {
        customer: { name: name || "Walk-in", phone: phone || undefined },
        notes: "Walk-in check-in",
      });
      setStatusStep("confirmed");
      setView("status");
    } catch { /* ignore */ }
  };

  if (view === "confirmed") {
    return (
      <div className="has-bottom-nav">
        <div className="pwa-shell">
          <div className="confirmation">
            <div className="confirmation__icon">✅</div>
            <h1 className="confirmation__title">Booked!</h1>
            <p className="confirmation__desc">Your appointment has been scheduled.</p>
            <div className="confirmation__details">
              <div style={{ display: "flex", justifyContent: "space-between" }}><span className="text-muted">Date</span><strong>{formatDate(booking.date)}</strong></div>
              <div style={{ display: "flex", justifyContent: "space-between" }}><span className="text-muted">Time</span><strong>{booking.time}</strong></div>
              <div style={{ display: "flex", justifyContent: "space-between" }}>
                <span className="text-muted">Services</span>
                <strong>{booking.services.map((s) => services.find((x: any) => x.id === s)?.name || s).join(", ")}</strong>
              </div>
              {booking.workerId && (
                <div style={{ display: "flex", justifyContent: "space-between" }}>
                  <span className="text-muted">With</span>
                  <strong>{workers.find((w: any) => w.id === booking.workerId)?.displayName || "Staff"}</strong>
                </div>
              )}
            </div>
            <div className="confirmation__actions mt-3">
              <button className="btn btn--primary btn--full" onClick={() => setView("landing")}>Done</button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (view === "status") {
    return (
      <div className="has-bottom-nav">
        <div className="pwa-shell">
          <StatusScreen step={statusStep} onCheckIn={() => setView("checkin")} />
          <nav className="bottom-nav">
            <button className="bottom-nav__item" onClick={() => setView("landing")}><span className="bottom-nav__icon">🏠</span><span className="bottom-nav__label">Home</span></button>
            <button className="bottom-nav__item" onClick={() => setView("book")}><span className="bottom-nav__icon">📅</span><span className="bottom-nav__label">Book</span></button>
            <button className="bottom-nav__item" onClick={() => setView("checkin")}><span className="bottom-nav__icon">✅</span><span className="bottom-nav__label">Check In</span></button>
          </nav>
        </div>
      </div>
=======
const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? "http://localhost:4000/api";
const SESSION_STORAGE_KEY = "customer_pwa_session_v1";

type CustomerSession = {
  token: string;
  expiresAt: string;
  customer: {
    id: string;
    name: string;
    phone: string;
    email?: string | null;
  };
};

type Appointment = {
  id: string;
  startTime: string;
  endTime: string;
  status: string;
  notes?: string | null;
  worker?: { displayName?: string | null } | null;
};

type Checkin = {
  id: string;
  checkedInAt: string;
  status: string;
  notes?: string | null;
  appointment?: { id: string; startTime?: string | null } | null;
};

type Tab = "book" | "checkin" | "status";

function formatDateTime(value?: string | null): string {
  if (!value) return "-";
  return new Date(value).toLocaleString([], { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });
}

function loadSession(): CustomerSession | null {
  try {
    const raw = localStorage.getItem(SESSION_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as CustomerSession;
    if (!parsed.token || !parsed.expiresAt || !parsed.customer?.id) return null;
    if (new Date(parsed.expiresAt).getTime() <= Date.now()) return null;
    return parsed;
  } catch {
    return null;
  }
}

function saveSession(session: CustomerSession | null): void {
  if (!session) {
    localStorage.removeItem(SESSION_STORAGE_KEY);
    return;
  }
  localStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify(session));
}

function App() {
  const [session, setSession] = useState<CustomerSession | null>(() => loadSession());
  const [tab, setTab] = useState<Tab>("book");

  const [phone, setPhone] = useState("");
  const [name, setName] = useState("");
  const [loginError, setLoginError] = useState("");
  const [loginLoading, setLoginLoading] = useState(false);

  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [checkins, setCheckins] = useState<Checkin[]>([]);
  const [statusMsg, setStatusMsg] = useState("");

  const [bookStart, setBookStart] = useState("");
  const [bookEnd, setBookEnd] = useState("");
  const [bookNotes, setBookNotes] = useState("");
  const [booking, setBooking] = useState(false);

  const [checkinNotes, setCheckinNotes] = useState("");
  const [selectedAppointmentId, setSelectedAppointmentId] = useState("");
  const [checkingIn, setCheckingIn] = useState(false);

  useEffect(() => {
    saveSession(session);
  }, [session]);

  useEffect(() => {
    if (!session) return;
    void refreshAll();
  }, [session]);

  async function refreshAll() {
    if (!session) return;
    try {
      const [appointmentsData, checkinsData] = await Promise.all([
        fetchAuthed<Appointment[]>(session.token, "/customer/me/appointments"),
        fetchAuthed<Checkin[]>(session.token, "/customer/me/checkins"),
      ]);
      setAppointments(appointmentsData);
      setCheckins(checkinsData);
      setStatusMsg("Updated.");
    } catch (error) {
      if (error instanceof ApiError && error.statusCode === 401) {
        handleSignOut();
      } else {
        setStatusMsg(error instanceof Error ? error.message : "Failed to refresh.");
      }
    }
  }

  async function handleLogin(event: React.FormEvent) {
    event.preventDefault();
    setLoginError("");
    if (!phone.trim()) {
      setLoginError("Phone number is required.");
      return;
    }
    setLoginLoading(true);
    try {
      const result = await fetchJson<CustomerSession>("/customer/auth/start", {
        method: "POST",
        body: JSON.stringify({ phone: phone.trim(), name: name.trim() || "Guest" }),
      });
      setSession(result);
      setTab("book");
      setStatusMsg("Signed in.");
    } catch (error) {
      setLoginError(error instanceof Error ? error.message : "Login failed.");
    } finally {
      setLoginLoading(false);
    }
  }

  function handleSignOut() {
    setSession(null);
    setAppointments([]);
    setCheckins([]);
    setStatusMsg("");
  }

  async function handleBook(event: React.FormEvent) {
    event.preventDefault();
    if (!session) return;
    setBooking(true);
    try {
      await fetchAuthed(session.token, "/customer/me/appointments", {
        method: "POST",
        body: JSON.stringify({
          startTime: new Date(bookStart).toISOString(),
          endTime: new Date(bookEnd).toISOString(),
          notes: bookNotes.trim() || undefined,
        }),
      });
      setBookStart("");
      setBookEnd("");
      setBookNotes("");
      await refreshAll();
      setStatusMsg("Appointment booked.");
    } catch (error) {
      setStatusMsg(error instanceof Error ? error.message : "Booking failed.");
    } finally {
      setBooking(false);
    }
  }

  async function handleCheckin(event: React.FormEvent) {
    event.preventDefault();
    if (!session) return;
    setCheckingIn(true);
    try {
      await fetchAuthed(session.token, "/customer/me/checkins", {
        method: "POST",
        body: JSON.stringify({
          appointmentId: selectedAppointmentId || undefined,
          notes: checkinNotes.trim() || undefined,
        }),
      });
      setSelectedAppointmentId("");
      setCheckinNotes("");
      await refreshAll();
      setStatusMsg("Checked in.");
    } catch (error) {
      setStatusMsg(error instanceof Error ? error.message : "Check-in failed.");
    } finally {
      setCheckingIn(false);
    }
  }

  if (!session) {
    return (
      <main className="mobile-shell auth-shell">
        <header>
          <p>Customer PWA</p>
          <h1>Sign in with phone</h1>
        </header>
        <form className="card" onSubmit={handleLogin}>
          <label>
            Phone number
            <input type="tel" value={phone} onChange={(event) => setPhone(event.target.value)} placeholder="(555) 123-4567" />
          </label>
          <label>
            Name (optional)
            <input type="text" value={name} onChange={(event) => setName(event.target.value)} placeholder="Your name" />
          </label>
          {loginError && <p className="error">{loginError}</p>}
          <button type="submit" disabled={loginLoading}>{loginLoading ? "Signing in..." : "Continue"}</button>
        </form>
      </main>
>>>>>>> bdf0b2066dfcb2e3e613cb86c08bdfaba329da34
    );
  }

  return (
<<<<<<< HEAD
    <div className="has-bottom-nav">
      <div className="pwa-shell">
        {view === "landing" && <LandingScreen onBook={() => setView("book")} onCheckIn={() => setView("checkin")} />}
        {view === "book" && (
          <BookingScreen
            booking={booking}
            setBooking={setBooking}
            services={services}
            workers={workers}
            onSubmit={submitBooking}
            onBack={() => setView("landing")}
          />
        )}
        {view === "checkin" && (
          <CheckinScreen
            name={checkinName}
            setName={setCheckinName}
            phone={checkinPhone}
            setPhone={setCheckinPhone}
            onSubmit={submitCheckin}
            onBack={() => setView("landing")}
          />
        )}
      </div>
      <nav className="bottom-nav">
        <button className={`bottom-nav__item ${view === "landing" ? "bottom-nav__item--active" : ""}`} onClick={() => setView("landing")}>
          <span className="bottom-nav__icon">🏠</span><span className="bottom-nav__label">Home</span>
        </button>
        <button className={`bottom-nav__item ${view === "book" ? "bottom-nav__item--active" : ""}`} onClick={() => setView("book")}>
          <span className="bottom-nav__icon">📅</span><span className="bottom-nav__label">Book</span>
        </button>
        <button className={`bottom-nav__item ${view === "checkin" ? "bottom-nav__item--active" : ""}`} onClick={() => setView("checkin")}>
          <span className="bottom-nav__icon">✅</span><span className="bottom-nav__label">Check In</span>
        </button>
      </nav>
    </div>
  );
}

/* ════════════════════════════════════════
   Landing Screen
   ════════════════════════════════════════ */

function LandingScreen({ onBook, onCheckIn }: { onBook: () => void; onCheckIn: () => void }) {
  return (
    <>
      <header className="pwa-header">
        <span className="pwa-header__eyebrow">Serenity Nail Salon</span>
        <h1 className="pwa-header__title">Welcome!</h1>
        <p className="text-muted text-sm mt-2">Book an appointment or check in for your visit.</p>
      </header>
      <div className="actions-row">
        <button className="btn btn--primary btn--full" onClick={onBook}>📅 Book Appointment</button>
        <button className="btn btn--secondary btn--full" onClick={onCheckIn}>✅ Walk-in Check In</button>
      </div>
      <div className="pwa-section mt-3">
        <h2 className="pwa-section__title">📍 Location & Hours</h2>
        <p className="text-muted text-sm">123 Main Street · (555) 123-4567</p>
        <p className="text-muted text-sm">Mon–Sat 9:00 AM – 7:00 PM · Sun 10:00 AM – 5:00 PM</p>
      </div>
    </>
  );
}

/* ════════════════════════════════════════
   Booking Screen
   ════════════════════════════════════════ */

function BookingScreen({ booking, setBooking, services, workers, onSubmit, onBack }: {
  booking: BookingState;
  setBooking: React.Dispatch<React.SetStateAction<BookingState>>;
  services: any[];
  workers: any[];
  onSubmit: () => void;
  onBack: () => void;
}) {
  const toggleService = (id: string) => {
    setBooking((prev) => ({
      ...prev,
      services: prev.services.includes(id) ? prev.services.filter((s) => s !== id) : [...prev.services, id],
    }));
  };

  return (
    <>
      <header className="pwa-header">
        <span className="pwa-header__eyebrow">Appointment</span>
        <h1 className="pwa-header__title">Book a Service</h1>
      </header>

      <div className="pwa-section">
        <h2 className="pwa-section__title">💅 Select Services</h2>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(130px, 1fr))", gap: "var(--space-2)" }}>
          {services.map((svc: any) => (
            <button key={svc.id}
              onClick={() => toggleService(svc.id)}
              style={{
                padding: "var(--space-3)", borderRadius: "var(--radius-md)",
                border: booking.services.includes(svc.id) ? "2px solid var(--color-primary)" : "2px solid var(--color-border)",
                background: booking.services.includes(svc.id) ? "var(--color-primary-light)" : "var(--color-surface)",
                textAlign: "center", cursor: "pointer", fontSize: "var(--text-sm)",
              }}>
              <div style={{ fontWeight: "var(--font-semibold)" }}>{svc.name}</div>
              <div style={{ fontSize: "var(--text-xs)", color: "var(--color-text-muted)" }}>{formatMoney(svc.priceCents)} · {svc.durationMinutes}min</div>
            </button>
          ))}
        </div>
      </div>

      <div className="pwa-section">
        <h2 className="pwa-section__title">👤 Your Info</h2>
        <input type="text" placeholder="Full Name" value={booking.name}
          onChange={(e) => setBooking({ ...booking, name: e.target.value })}
          style={{ width: "100%", padding: "var(--space-3)", marginBottom: "var(--space-2)", border: "1px solid var(--color-border)", borderRadius: "var(--radius-md)", fontSize: "var(--text-sm)" }} />
        <input type="tel" placeholder="Phone Number" value={booking.phone}
          onChange={(e) => setBooking({ ...booking, phone: e.target.value })}
          style={{ width: "100%", padding: "var(--space-3)", marginBottom: "var(--space-2)", border: "1px solid var(--color-border)", borderRadius: "var(--radius-md)", fontSize: "var(--text-sm)" }} />
      </div>

      <div className="pwa-section">
        <h2 className="pwa-section__title">📅 Date & Time</h2>
        <input type="date" value={booking.date}
          onChange={(e) => setBooking({ ...booking, date: e.target.value })}
          style={{ width: "100%", padding: "var(--space-3)", marginBottom: "var(--space-2)", border: "1px solid var(--color-border)", borderRadius: "var(--radius-md)", fontSize: "var(--text-sm)" }} />
        <input type="time" value={booking.time}
          onChange={(e) => setBooking({ ...booking, time: e.target.value })}
          style={{ width: "100%", padding: "var(--space-3)", marginBottom: "var(--space-2)", border: "1px solid var(--color-border)", borderRadius: "var(--radius-md)", fontSize: "var(--text-sm)" }} />

        <select value={booking.workerId}
          onChange={(e) => setBooking({ ...booking, workerId: e.target.value })}
          style={{ width: "100%", padding: "var(--space-3)", border: "1px solid var(--color-border)", borderRadius: "var(--radius-md)", fontSize: "var(--text-sm)" }}>
          <option value="">-- Any Available --</option>
          {workers.filter((w: any) => w.currentStatus !== "off_today").map((w: any) => (
            <option key={w.id} value={w.id}>{w.displayName || w.user?.name}</option>
          ))}
        </select>
      </div>

      <div className="actions-row">
        <button className="btn btn--secondary btn--full" onClick={onBack}>← Back</button>
        <button className="btn btn--primary btn--full" onClick={onSubmit}
          disabled={!booking.name || !booking.phone || booking.services.length === 0 || !booking.time}>
          Confirm Booking
        </button>
      </div>
    </>
  );
}

/* ════════════════════════════════════════
   Check-in Screen
   ════════════════════════════════════════ */

function CheckinScreen({ name, setName, phone, setPhone, onSubmit, onBack }: {
  name: string; setName: (v: string) => void;
  phone: string; setPhone: (v: string) => void;
  onSubmit: () => void; onBack: () => void;
}) {
  return (
    <>
      <header className="pwa-header">
        <span className="pwa-header__eyebrow">Walk-in</span>
        <h1 className="pwa-header__title">Check In</h1>
        <p className="text-muted text-sm mt-2">Let us know you've arrived and we'll get you seated.</p>
      </header>
      <div className="pwa-section">
        <input type="text" placeholder="Your Name" value={name}
          onChange={(e) => setName(e.target.value)}
          style={{ width: "100%", padding: "var(--space-3)", marginBottom: "var(--space-2)", border: "1px solid var(--color-border)", borderRadius: "var(--radius-md)", fontSize: "var(--text-sm)" }} />
        <input type="tel" placeholder="Phone (optional)" value={phone}
          onChange={(e) => setPhone(e.target.value)}
          style={{ width: "100%", padding: "var(--space-3)", marginBottom: "var(--space-2)", border: "1px solid var(--color-border)", borderRadius: "var(--radius-md)", fontSize: "var(--text-sm)" }} />
      </div>
      <div className="actions-row">
        <button className="btn btn--secondary btn--full" onClick={onBack}>← Back</button>
        <button className="btn btn--primary btn--full" onClick={onSubmit} disabled={!name.trim() && !phone.trim()}>
          ✅ I'm Here
        </button>
      </div>
    </>
  );
}

/* ════════════════════════════════════════
   Status Screen
   ════════════════════════════════════════ */

function StatusScreen({ step, onCheckIn }: { step: string; onCheckIn: () => void }) {
  return (
    <>
      <header className="pwa-header">
        <span className="pwa-header__eyebrow">Your Visit</span>
        <h1 className="pwa-header__title">Status</h1>
      </header>
      <div className="confirmation">
        <div className="confirmation__icon">✅</div>
        <h1 className="confirmation__title">Checked In!</h1>
        <p className="confirmation__desc">We'll call you when your service is ready.</p>
        <div className="confirmation__actions mt-3">
          <button className="btn btn--primary btn--full" onClick={onCheckIn}>Check In Another</button>
        </div>
      </div>
    </>
  );
}

/* ════════════════════════════════════════
   Helpers
   ════════════════════════════════════════ */

function formatMoney(c: number) { return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(c / 100); }
function formatDate(d: string) { if (!d) return ""; const [y, m, day] = d.split("-"); return `${Number(m)}/${Number(day)}/${y}`; }
function todayStr() { return new Date().toISOString().slice(0, 10); }

createRoot(document.getElementById("root")!).render(<React.StrictMode><App /></React.StrictMode>);
=======
    <main className="mobile-shell">
      <header className="app-head">
        <div>
          <p>Customer PWA</p>
          <h1>Hello, {session.customer.name}</h1>
          <small>{session.customer.phone}</small>
        </div>
        <button type="button" className="secondary" onClick={handleSignOut}>Sign out</button>
      </header>

      <nav className="tab-strip">
        <button type="button" className={tab === "book" ? "active" : ""} onClick={() => setTab("book")}>Book</button>
        <button type="button" className={tab === "checkin" ? "active" : ""} onClick={() => setTab("checkin")}>Check in</button>
        <button type="button" className={tab === "status" ? "active" : ""} onClick={() => setTab("status")}>Status</button>
      </nav>

      {statusMsg && <p className="banner">{statusMsg}</p>}

      {tab === "book" && (
        <section className="card">
          <h2>Book appointment</h2>
          <form onSubmit={handleBook}>
            <label>
              Start
              <input type="datetime-local" value={bookStart} onChange={(event) => setBookStart(event.target.value)} required />
            </label>
            <label>
              End
              <input type="datetime-local" value={bookEnd} onChange={(event) => setBookEnd(event.target.value)} required />
            </label>
            <label>
              Notes
              <input type="text" value={bookNotes} onChange={(event) => setBookNotes(event.target.value)} placeholder="Optional" />
            </label>
            <button type="submit" disabled={booking}>{booking ? "Saving..." : "Book appointment"}</button>
          </form>
        </section>
      )}

      {tab === "checkin" && (
        <section className="card">
          <h2>Check in</h2>
          <form onSubmit={handleCheckin}>
            <label>
              Appointment (optional)
              <select value={selectedAppointmentId} onChange={(event) => setSelectedAppointmentId(event.target.value)}>
                <option value="">Walk-in</option>
                {appointments
                  .filter((appointment) => ["scheduled", "confirmed", "checked_in"].includes(appointment.status))
                  .map((appointment) => (
                    <option key={appointment.id} value={appointment.id}>
                      {formatDateTime(appointment.startTime)} ({appointment.status})
                    </option>
                  ))}
              </select>
            </label>
            <label>
              Notes
              <input type="text" value={checkinNotes} onChange={(event) => setCheckinNotes(event.target.value)} placeholder="Optional" />
            </label>
            <button type="submit" disabled={checkingIn}>{checkingIn ? "Checking in..." : "Check in now"}</button>
          </form>
        </section>
      )}

      {tab === "status" && (
        <>
          <section className="card">
            <div className="row-head">
              <h2>Appointments</h2>
              <button type="button" className="secondary" onClick={() => void refreshAll()}>Refresh</button>
            </div>
            {appointments.length === 0 ? (
              <p>No appointments yet.</p>
            ) : (
              <ul className="list">
                {appointments.map((appointment) => (
                  <li key={appointment.id}>
                    <strong>{formatDateTime(appointment.startTime)}</strong>
                    <span>{appointment.status.replace(/_/g, " ")}</span>
                  </li>
                ))}
              </ul>
            )}
          </section>

          <section className="card">
            <h2>Check-ins</h2>
            {checkins.length === 0 ? (
              <p>No check-ins yet.</p>
            ) : (
              <ul className="list">
                {checkins.map((checkin) => (
                  <li key={checkin.id}>
                    <strong>{formatDateTime(checkin.checkedInAt)}</strong>
                    <span>{checkin.status.replace(/_/g, " ")}</span>
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
    headers: { "Content-Type": "application/json", ...(init?.headers ?? {}) },
    ...init,
  });
  if (!response.ok) {
    let message = `Request failed: ${response.status}`;
    try {
      const data = (await response.json()) as { error?: string };
      if (data.error) message = data.error;
    } catch {
      // ignore
    }
    throw new ApiError(response.status, message);
  }
  return response.json() as Promise<T>;
}

function fetchAuthed<T>(token: string, path: string, init?: RequestInit): Promise<T> {
  return fetchJson<T>(path, {
    ...init,
    headers: {
      ...(init?.headers ?? {}),
      Authorization: `Bearer ${token}`,
    },
  });
}

createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
>>>>>>> bdf0b2066dfcb2e3e613cb86c08bdfaba329da34
