import React, { useEffect, useState } from "react";
import { createRoot } from "react-dom/client";
import "./styles.css";

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
    );
  }

  return (
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
