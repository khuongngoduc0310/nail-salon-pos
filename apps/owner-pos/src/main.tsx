import React, { useEffect, useState } from "react";
import { createRoot } from "react-dom/client";
import {
  assignTurn,
  createSaleForCheckin,
  fetchReadyForCheckoutCheckins,
  fetchTurnDashboard,
  fetchWaitingCheckins,
  fetchServices,
  fetchServiceCategories,
  createService,
  createServiceCategory,
  updateService,
  deleteService,
  fetchWorkers,
  createWorker,
  updateWorker,
  updateWorkerStatus,
  createSale,
  addSaleItem,
  removeSaleItem,
  addCashPayment,
  addGiftCardPayment,
  completeSale,
  fetchCurrentSession,
  openSession,
  closeSession,
  workerCheckIn,
  fetchCheckedInWorkers,
  fetchSettings,
  updateSettings,
  updateTurnCount,
  type CheckedInWorker,
  type SalonSettings,
  fetchSalesReport,
  fetchWorkerEarnings,
  fetchTurnDetail,
  fetchEndOfDayReport,
  verifyOwnerPin,
  type Checkin,
  type TurnDashboardWorker,
  type Service,
  type ServiceCategory,
  type Worker,
  type Session,
  type TurnDetail,
} from "./api.js";
import {
  AmountInput,
  Badge,
  BottomNav,
  Button,
  Card,
  EmptyState,
  Input,
  MoneyDisplay,
  Modal,
  Select,
  StatCard,
  StatusPill,
  Tabs,
} from "./components.js";
import "./styles.css";

/* ════════════════════════════════════════
   Types
   ════════════════════════════════════════ */

type View =
  | "dashboard"
  | "assign"
  | "checkout"
  | "services"
  | "workers"
  | "reports";

type PaymentEntry = {
  method: string;
  amountCents: number;
};

/* ════════════════════════════════════════
   App
   ════════════════════════════════════════ */

function App() {
  const [view, setView] = useState<View>("dashboard");
  const [secureRequest, setSecureRequest] = useState<{
    title: string;
    description: string;
    onConfirm: () => void;
  } | null>(null);

  const requestOwnerPin = (title: string, description: string, onConfirm: () => void) => {
    setSecureRequest({ title, description, onConfirm });
  };

  const openView = (nextView: View) => {
    if (isSecureView(nextView)) {
      requestOwnerPin(
        "Owner PIN Required",
        `Enter owner PIN to open ${viewLabel(nextView)}.`,
        () => setView(nextView)
      );
      return;
    }

    setView(nextView);
  };

  return (
    <div className="has-bottom-nav">
      <main className="app-shell">
        {view === "dashboard" && (
          <Dashboard
            onStartCheckout={() => setView("checkout")}
            requestOwnerPin={requestOwnerPin}
          />
        )}
        {view === "assign" && <AssignCustomersScreen />}
        {view === "checkout" && <CheckoutScreen onBack={() => setView("dashboard")} />}
        {view === "services" && <ServicesScreen />}
        {view === "workers" && <WorkersScreen />}
        {view === "reports" && <ReportsScreen />}
      </main>
      <BottomNav
        items={[
          { icon: "🏠", label: "Floor", active: view === "dashboard", onClick: () => openView("dashboard") },
          { icon: "📋", label: "Assign", active: view === "assign", onClick: () => openView("assign") },
          { icon: "💳", label: "Checkout", active: view === "checkout", onClick: () => openView("checkout") },
          { icon: "💅", label: "Services", active: view === "services", onClick: () => openView("services") },
          { icon: "👥", label: "Workers", active: view === "workers", onClick: () => openView("workers") },
          { icon: "📊", label: "Reports", active: view === "reports", onClick: () => openView("reports") },
        ]}
      />
      <SecurePinModal
        open={secureRequest !== null}
        title={secureRequest?.title ?? ""}
        description={secureRequest?.description ?? ""}
        onClose={() => setSecureRequest(null)}
        onConfirm={async (pin) => {
          const verified = await verifyOwnerPin(pin);
          if (!verified) return false;

          const action = secureRequest?.onConfirm;
          setSecureRequest(null);
          action?.();
          return true;
        }}
      />
    </div>
  );
}

function isSecureView(view: View) {
  return view === "services" || view === "workers" || view === "reports";
}

function viewLabel(view: View) {
  return (
    {
      dashboard: "Floor",
      assign: "Assign",
      checkout: "Checkout",
      services: "Services",
      workers: "Workers",
      reports: "Reports",
    } satisfies Record<View, string>
  )[view];
}

/* ════════════════════════════════════════
   Secure PIN Modal
   ════════════════════════════════════════ */

function SecurePinModal({
  open,
  title,
  description,
  onClose,
  onConfirm,
}: {
  open: boolean;
  title: string;
  description: string;
  onClose: () => void;
  onConfirm: (pin: string) => Promise<boolean>;
}) {
  const [pin, setPin] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (open) {
      setPin("");
      setError("");
      setLoading(false);
    }
  }, [open]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (pin.length < 4) {
      setError("PIN must be at least 4 digits.");
      return;
    }
    setError("");
    setLoading(true);
    try {
      const verified = await onConfirm(pin);
      if (!verified) setError("Invalid owner PIN.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={title}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>Cancel</Button>
          <Button type="submit" form="secure-pin-form" loading={loading}>Unlock</Button>
        </>
      }
    >
      <form id="secure-pin-form" className="login-form" onSubmit={handleSubmit}>
          <p className="text-muted text-sm" style={{ marginTop: 0 }}>{description}</p>
          <Input label="Owner PIN" type="password" value={pin} onChange={(e) => setPin(e.target.value)} placeholder="Enter PIN" maxLength={6} autoFocus />
          {error && <p className="field__error">{error}</p>}
      </form>
    </Modal>
  );
}

/* ════════════════════════════════════════
   Dashboard — Floor View
   ════════════════════════════════════════ */

function Dashboard({
  onStartCheckout,
  requestOwnerPin,
}: {
  onStartCheckout: () => void;
  requestOwnerPin: (title: string, description: string, onConfirm: () => void) => void;
}) {
  const [workers, setWorkers] = useState<TurnDashboardWorker[]>([]);
  const [checkins, setCheckins] = useState<Checkin[]>([]);
  const [checkoutCheckins, setCheckoutCheckins] = useState<Checkin[]>([]);
  const [status, setStatus] = useState("Loading...");
  const [selectedCheckin, setSelectedCheckin] = useState<Checkin | null>(null);
  const [assignModal, setAssignModal] = useState(false);
  const [session, setSession] = useState<Session | null>(null);
  const [showCloseModal, setShowCloseModal] = useState(false);
  const [closingCashText, setClosingCashText] = useState("");
  const [closingLoading, setClosingLoading] = useState(false);
  const [closeSummary, setCloseSummary] = useState<Record<string, number> | null>(null);
  const [checkedInWorkers, setCheckedInWorkers] = useState<CheckedInWorker[]>([]);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const [dash, waiting, ready, sess, ciWorkers] = await Promise.all([
          fetchTurnDashboard(),
          fetchWaitingCheckins(),
          fetchReadyForCheckoutCheckins(),
          fetchCurrentSession(),
          fetchCheckedInWorkers().catch(() => [] as CheckedInWorker[]),
        ]);
        if (!cancelled) {
          setWorkers(dash.workers);
          setCheckins(waiting);
          setCheckoutCheckins(ready);
          setSession(sess);
          setCheckedInWorkers(ciWorkers);
          setStatus(sess ? "Session open" : "Live");
        }
      } catch {
        if (!cancelled) setStatus("API offline — showing mock data");
        if (!cancelled) {
          setWorkers(MOCK_WORKERS_DASHBOARD);
          setCheckins(MOCK_CHECKINS);
          setCheckoutCheckins(MOCK_CHECKOUT_READY);
        }
      }
    }
    void load();
    return () => { cancelled = true; };
  }, []);

  // WebSocket sync — replaces polling for real-time updates
  useEffect(() => {
    let ws: WebSocket | null = null;
    let reconnect: ReturnType<typeof setTimeout> | null = null;

    const refreshAll = async () => {
      try {
        const [dash, waiting, ready, ciWorkers] = await Promise.all([
          fetchTurnDashboard(),
          fetchWaitingCheckins(),
          fetchReadyForCheckoutCheckins(),
          fetchCheckedInWorkers().catch(() => [] as CheckedInWorker[]),
        ]);
        setWorkers(dash.workers);
        setCheckins(waiting);
        setCheckoutCheckins(ready);
        setCheckedInWorkers(ciWorkers);
      } catch { /* silent */ }
    };

    const connectWs = () => {
      try {
        ws = new WebSocket(`${location.protocol === "https:" ? "wss" : "ws"}://${location.hostname}:4000/ws`);
        ws.onmessage = () => { void refreshAll(); };
        ws.onclose = () => { reconnect = setTimeout(connectWs, 3000); };
        ws.onerror = () => { ws?.close(); };
      } catch { /* ignore */ }
    };

    if (session) connectWs();
    return () => {
      if (reconnect) clearTimeout(reconnect);
      if (ws) { ws.onclose = null; ws.close(); }
    };
  }, [session]);

  const handleWorkerCheckIn = async (workerId: string) => {
    try {
      const w = await workerCheckIn(workerId);
      setCheckedInWorkers((prev) => {
        const filtered = prev.filter((c) => c.workerId !== workerId);
        return [...filtered, w];
      });
    } catch { /* offline – ignore */ }
  };

  const checkedInSet = new Set(checkedInWorkers.map((c) => c.workerId));

  const handleStartDay = async () => {
    try {
      const s = await openSession({});
      setSession(s);
      setStatus("Session open");
    } catch {
      // silent
    }
  };

  const handleEndDay = async () => {
    if (!session) return;
    setClosingLoading(true);
    try {
      const cash = Math.round(parseFloat(closingCashText || "0") * 100);
      const result = await closeSession(session.id, { closingCashCents: cash });
      setCloseSummary(result.summary);
      setSession(null);
      setStatus("Live");
    } catch {
      // silent
    } finally {
      setClosingLoading(false);
    }
  };

  const activeTurns = workers.filter((w) => w.activeTurn).length;
  const readyCount = checkoutCheckins.length;
  const totalSales = workers.reduce((s, w) => s + w.salesTodayCents, 0);
  const totalTips = workers.reduce((s, w) => s + w.tipsTodayCents, 0);

  return (
    <>
      <header>
        <p className="eyebrow">Owner POS</p>
        <div className="app-bar">
          <h1 className="app-bar__title">Salon Floor</h1>
          <span className="status-line" style={{ margin: 0 }}>
            <Badge variant={status === "Live" ? "success" : "warning"}>{status}</Badge>
          </span>
        </div>
      </header>

      {/* Session bar */}
      <div style={{ marginBottom: "var(--space-4)" }}>
        {session ? (
          <div style={{ display: "flex", gap: "var(--space-3)", alignItems: "center", justifyContent: "space-between", padding: "var(--space-3)", background: "var(--color-success-light, #e8f5e9)", borderRadius: "var(--radius-md)" }}>
            <span style={{ fontSize: "var(--text-sm)", fontWeight: "var(--font-semibold)", color: "var(--color-success)" }}>
              🔵 Session open since {new Date(session.openedAt).toLocaleTimeString()}
            </span>
            <div style={{ display: "flex", gap: "var(--space-2)" }}>
              <Button
                size="sm"
                variant="ghost"
                onClick={() => {
                  requestOwnerPin(
                    "Owner PIN Required",
                    "Enter owner PIN to end the day and close the current session.",
                    () => {
                      setShowCloseModal(true);
                      setClosingCashText("");
                    }
                  );
                }}
              >
                End Day
              </Button>
            </div>
          </div>
        ) : (
          <div style={{ display: "flex", gap: "var(--space-3)", alignItems: "center", justifyContent: "space-between", padding: "var(--space-3)", background: "var(--color-warning-light, #fff8e1)", borderRadius: "var(--radius-md)" }}>
            <span style={{ fontSize: "var(--text-sm)", fontWeight: "var(--font-semibold)", color: "var(--color-warning, #c79100)" }}>
              ⚠️ No active session
            </span>
            <Button size="sm" onClick={handleStartDay}>Start Day</Button>
          </div>
        )}
      </div>

      {/* Close session modal */}
      <Modal
        open={showCloseModal}
        onClose={() => { setShowCloseModal(false); setCloseSummary(null); }}
        title="End Day"
        footer={
          <>
            <Button variant="secondary" onClick={() => { setShowCloseModal(false); setCloseSummary(null); }}>
              Cancel
            </Button>
            {!closeSummary && (
              <Button onClick={handleEndDay} loading={closingLoading}>
                Close Session
              </Button>
            )}
          </>
        }
      >
        {closeSummary ? (
          <div>
            <div style={{ textAlign: "center", padding: "var(--space-4) 0" }}>
              <div style={{ fontSize: "2rem", marginBottom: "var(--space-2)" }}>✅</div>
              <h3 style={{ margin: "0 0 var(--space-3)" }}>Session Closed</h3>
            </div>
            <div style={{ display: "grid", gap: "var(--space-2)" }}>
              <div style={{ display: "flex", justifyContent: "space-between" }}><span>Total Sales</span><strong>{formatMoney(closeSummary.totalSalesCents || 0)}</strong></div>
              <div style={{ display: "flex", justifyContent: "space-between" }}><span>💵 Cash</span><span>{formatMoney(closeSummary.cashCents || 0)}</span></div>
              <div style={{ display: "flex", justifyContent: "space-between" }}><span>💳 Card</span><span>{formatMoney(closeSummary.cardCents || 0)}</span></div>
              <div style={{ display: "flex", justifyContent: "space-between" }}><span>🎁 Gift Card</span><span>{formatMoney(closeSummary.giftCardCents || 0)}</span></div>
              <div style={{ display: "flex", justifyContent: "space-between", borderTop: "1px solid var(--color-border)", paddingTop: "var(--space-2)" }}>
                <span>Sales Count</span><strong>{closeSummary.saleCount || 0}</strong>
              </div>
            </div>
          </div>
        ) : (
          <AmountInput
            label="Closing Cash Count"
            valueCents={(() => { const v = parseFloat(closingCashText || "0"); return isNaN(v) ? 0 : Math.round(v * 100); })()}
            onChangeCents={(c) => setClosingCashText((c / 100).toFixed(2))}
          />
        )}
      </Modal>

      {/* Worker Check-in bar */}
      {session && workers.length > 0 && (
        <div style={{ marginBottom: "var(--space-4)", padding: "var(--space-4)", background: "var(--color-surface)", border: "1px solid var(--color-border)", borderRadius: "var(--radius-lg)", boxShadow: "var(--shadow-sm)" }}>
          <div className="card__header">
            <h2 className="card__title">📋 Worker Check‑in</h2>
            <Badge variant="info">{checkedInWorkers.length}/{workers.length}</Badge>
          </div>
          <div style={{ display: "flex", gap: "var(--space-2)", flexWrap: "wrap" }}>
            {workers.map((w) => {
              const isCheckedIn = checkedInSet.has(w.workerId);
              return (
                <button
                  key={w.workerId}
                  onClick={() => { if (!isCheckedIn) void handleWorkerCheckIn(w.workerId); }}
                  disabled={isCheckedIn}
                  title={isCheckedIn ? `Checked in at ${new Date(checkedInWorkers.find((c) => c.workerId === w.workerId)?.checkedInAt ?? "").toLocaleTimeString()}` : "Click to check in"}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "var(--space-1)",
                    padding: "var(--space-1) var(--space-3)",
                    borderRadius: "var(--radius-full)",
                    border: isCheckedIn ? "2px solid var(--color-success)" : "2px dashed var(--color-border)",
                    background: isCheckedIn ? "var(--color-success-light)" : "var(--color-bg)",
                    cursor: isCheckedIn ? "default" : "pointer",
                    opacity: w.status === "off_today" ? 0.5 : 1,
                    fontSize: "var(--text-xs)",
                    fontWeight: "var(--font-medium)",
                    transition: "all var(--transition-fast)",
                  }}
                >
                  {isCheckedIn ? "✅" : "⬜"} {w.name}
                  {isCheckedIn && (
                    <span style={{ color: "var(--color-text-muted)", fontSize: "var(--text-xs)" }}>
                      {new Date(checkedInWorkers.find((c) => c.workerId === w.workerId)?.checkedInAt ?? "").toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Stats row */}
      <div className="grid--stats" style={{ display: "grid", gap: "var(--space-3)", marginBottom: "var(--space-6)" }}>
        <StatCard label="Waiting" value={String(checkins.length)} />
        <StatCard label="In Service" value={String(activeTurns)} />
        <StatCard label="Ready" value={String(readyCount)} sub="for checkout" />
        <StatCard label="Sales Today" value={formatMoney(totalSales)} />
        <StatCard label="Tips Today" value={formatMoney(totalTips)} />
      </div>

      {/* Waiting queue + Turns + Ready for checkout */}
      <div className="grid">
        {/* Check-in queue */}
        <Card padding="lg">
          <div className="card__header">
            <h2 className="card__title">⏳ Waiting Queue</h2>
            <Badge variant="warning">{checkins.length}</Badge>
          </div>
          {checkins.length === 0 ? (
            <EmptyState icon="🪑" title="No one waiting" description="Check in a walk-in or appointment customer to get started." />
          ) : (
            <div className="checkin-list">
              {checkins.map((c) => (
                <div key={c.id} className="checkin-item">
                  <div className="checkin-item__top">
                    <span className="checkin-item__name">{c.customer?.name ?? "Walk-in"}</span>
                    <StatusPill status={c.status} />
                  </div>
                  <div className="checkin-item__meta">
                    <span>{c.notes ?? "No notes"}</span>
                    <span>·</span>
                    <span>{timeAgo(c.checkedInAt)}</span>
                  </div>
                  <div className="checkin-item__actions">
                    <Button size="sm" variant="secondary" onClick={() => { setSelectedCheckin(c); setAssignModal(true); }}>Assign Worker</Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </Card>

        {/* Worker turns */}
        <Card padding="lg" className="wide">
          <div className="card__header">
            <h2 className="card__title">👥 Worker Turns</h2>
            <Badge variant="info">{session ? workers.length : 0} active</Badge>
          </div>
          {!session ? (
            <EmptyState icon="🔒" title="No session open" description="Start the day to view worker turns and assign customers." />
          ) : workers.length === 0 ? (
            <EmptyState icon="👤" title="No workers" description="Add workers in the Workers tab to start assigning turns." />
          ) : (
            <div className="mgmt-grid" style={{ gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))" }}>
              {sortWorkersForFloor(workers).map((w) => {
                const borderClass = statusBorderClass(w.status);
                const initial = (w.name || "?")[0].toUpperCase();
                const avatarClass = statusAvatarClass(w.status);
                const activeTurn = w.activeTurn as { customerName?: string; serviceName?: string; startedAt?: string } | null;
                return (
                  <div key={w.workerId} className={`worker-card ${borderClass}`}>
                    {/* Header: avatar + name + status pill */}
                    <div className="worker-card__header">
                      <div className={`worker-card__avatar ${avatarClass}`}>{initial}</div>
                      <div className="worker-card__info">
                        <span className="worker-card__name">{w.name}</span>
                        <span className="worker-card__meta">
                          {w.turnsTakenToday} turn{w.turnsTakenToday !== 1 ? "s" : ""} today
                        </span>
                      </div>
                      {w.suggestionRank != null && (
                        <span className="worker-card__rank-badge">⭐ #{w.suggestionRank}</span>
                      )}
                    </div>

                    {/* Active turn panel */}
                    {activeTurn && (
                      <div className="worker-card__active-turn">
                        <div className="worker-card__active-customer">
                          👤 {activeTurn.customerName || "Customer"}
                        </div>
                        {activeTurn.serviceName && (
                          <div className="worker-card__active-service">
                            💅 {activeTurn.serviceName}
                          </div>
                        )}
                        {activeTurn.startedAt && (
                          <div className="worker-card__active-time">
                            ⏱ Started {timeAgo(activeTurn.startedAt)}
                          </div>
                        )}
                      </div>
                    )}

                    {/* Stats row */}
                    <div className="worker-card__stats-row">
                      <div className="worker-card__stat-item">
                        📋 <strong>{w.turnsTakenToday}</strong> turns
                      </div>
                      {w.lastTurnEndedAt && (
                        <div className="worker-card__stat-item">
                          🕐 Last turn: {timeAgo(w.lastTurnEndedAt)}
                        </div>
                      )}
                      <div className="worker-card__status-pill">
                        <StatusPill status={w.status} />
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </Card>

        {/* Ready for checkout */}
        <Card padding="lg">
          <div className="card__header">
            <h2 className="card__title">💰 Ready for Checkout</h2>
            <Badge variant="success">{checkoutCheckins.length}</Badge>
          </div>
          {checkoutCheckins.length === 0 ? (
            <EmptyState icon="🧾" title="None ready" description="Complete a service turn to bring customers here." />
          ) : (
            <div className="checkin-list">
              {checkoutCheckins.map((c) => (
                <div key={c.id} className="checkin-item">
                  <div className="checkin-item__top">
                    <span className="checkin-item__name">{c.customer?.name ?? "Walk-in"}</span>
                    <StatusPill status={c.status} />
                  </div>
                  <div className="checkin-item__actions">
                    <Button size="sm" onClick={() => {
                      void createSaleForCheckin(c.id).then(() => onStartCheckout()).catch(() => onStartCheckout());
                    }}>Start Sale</Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </Card>
      </div>

      {/* Session Grid — service-by-worker matrix */}
      {session && (
        <SessionGrid
          workers={workers}
          onToggleTurnCount={async (turnId, newCount) => {
            await updateTurnCount(turnId, newCount).catch(() => {});
            // Update local state optimistically
            setWorkers((prev) => prev.map((w) => {
              const updatedTurns = w.turns.map((t) => t.turnId === turnId ? { ...t, turnCount: newCount } : t);
              return {
                ...w,
                turns: updatedTurns,
                turnsTakenToday: updatedTurns
                  .filter((t) => t.status === "completed" || t.status === "in_service")
                  .reduce((s, t) => s + t.turnCount, 0),
              };
            }));
          }}
        />
      )}

      {/* Assign worker modal */}
      {selectedCheckin && (
        <Modal open={assignModal} onClose={() => setAssignModal(false)} title={`Assign — ${selectedCheckin.customer?.name ?? "Walk-in"}`} footer={
          <Button variant="secondary" onClick={() => setAssignModal(false)}>Cancel</Button>
        }>
          <p className="text-muted text-sm mb-4">Select a worker to assign this customer.</p>
          <div className="checkin-list">
            {workers.filter((w) => w.status !== "off_today" && w.status !== "on_break" && w.status !== "in_service").map((w) => (
              <div
                key={w.workerId}
                className="checkin-item"
                style={{ cursor: "pointer" }}
                onClick={async () => {
                  try {
                    await assignTurn({
                      checkinId: selectedCheckin.id,
                      workerId: w.workerId,
                      turnType: "manual",
                      suggestedWorkerId: w.suggestionRank != null ? w.workerId : undefined,
                    });
                    // Refresh dashboard data after assignment
                    const [dash, waiting, ready] = await Promise.all([
                      fetchTurnDashboard(),
                      fetchWaitingCheckins(),
                      fetchReadyForCheckoutCheckins(),
                    ]);
                    setWorkers(dash.workers);
                    setCheckins(waiting);
                    setCheckoutCheckins(ready);
                  } catch { /* silent */ }
                  setAssignModal(false);
                  setSelectedCheckin(null);
                }}
              >
                <div className="checkin-item__top">
                  <span className="checkin-item__name">{w.name}</span>
                  <StatusPill status={w.status} />
                </div>
                <div className="checkin-item__meta">
                  <span>Turns today: {w.turnsTakenToday}</span>
                  {w.suggestionRank && <span>· Rank #{w.suggestionRank}</span>}
                </div>
              </div>
            ))}
          </div>
        </Modal>
      )}
    </>
  );
}

/* ════════════════════════════════════════
   Assign Customers Screen
   ════════════════════════════════════════ */

type AssignWorker = {
  id: string;
  name: string;
  status: "available" | "in_service" | "on_break" | "off_today" | "unavailable";
  rotationRank: number | null;
  serviceCount: number;
  services: AssignServiceCell[];
};

type AssignServiceCell = {
  service: string;
  customer: string;
  status: "completed" | "in_service" | "assigned" | "break";
  duration?: string;
  priceCents?: number;
};

type AssignCustomer = {
  id: string;
  name: string;
  type: "Walk-in" | "Appointment";
  waitTime: string;
  services: string[];
  preference: string;
  notes?: string;
  partySize?: number;
};

const SHOW_ASSIGN_DEMO = import.meta.env.MODE === "__assign_demo__";

function AssignCustomersScreen() {
  const [workers, setWorkers] = useState<AssignWorker[]>([]);
  const [customers, setCustomers] = useState<AssignCustomer[]>([]);
  const [selectedCustomer, setSelectedCustomer] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [session, setSession] = useState<Session | null>(null);
  const [loadError, setLoadError] = useState("");

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const currentSession = await fetchCurrentSession();
        if (cancelled) return;

        setSession(currentSession);
        setLoadError("");

        if (!currentSession) {
          setWorkers([]);
          setCustomers([]);
          setSelectedCustomer(null);
          return;
        }

        const [dash, waiting] = await Promise.all([
          fetchTurnDashboard({ currentSessionOnly: true }),
          fetchWaitingCheckins(),
        ]);
        if (!cancelled) {
          const mappedWorkers: AssignWorker[] = (dash.workers || []).map((w) => ({
            id: w.workerId,
            name: w.name,
            status: (w.status as AssignWorker["status"]) || "available",
            rotationRank: w.suggestionRank ?? null,
            serviceCount: w.turnsTakenToday,
            services: (w.turns || []).map((t) => ({
              service: t.services?.[0]?.serviceName ?? t.customerName,
              customer: t.customerName,
              status: (t.status as AssignServiceCell["status"]) || "completed",
            })),
          }));
          const sessionOpenedAt = new Date(currentSession.openedAt).getTime();
          const mappedCustomers: AssignCustomer[] = (waiting || [])
            .filter((c) => new Date(c.checkedInAt).getTime() >= sessionOpenedAt)
            .map((c) => ({
              id: c.id,
              name: c.customer?.name ?? "Walk-in",
              type: "Walk-in",
              waitTime: timeAgo(c.checkedInAt),
              services: c.notes ? [c.notes] : ["Service"],
              preference: "Any worker",
            }));
          setWorkers(mappedWorkers);
          setCustomers(mappedCustomers);
        }
      } catch {
        if (!cancelled) {
          setWorkers([]);
          setCustomers([]);
          setSelectedCustomer(null);
          setLoadError("Unable to load current session assignment board.");
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    void load();
    return () => { cancelled = true; };
  }, []);

  const waitingCount = customers.length;
  const availableCount = workers.filter((w) => w.status === "available").length;
  const inServiceCount = workers.filter((w) => w.status === "in_service").length;
  const onBreakCount = workers.filter((w) => w.status === "on_break").length;

  // Calculate average wait time in minutes from mock data
  const avgWait = customers.length > 0 ? "8m" : "—";

  const selectedCustomerData = customers.find((c) => c.id === selectedCustomer) ?? null;

  // Next available worker based on rotation
  const nextAvailableWorker = workers
    .filter((w) => w.status === "available" && w.rotationRank != null)
    .sort((a, b) => (a.rotationRank ?? 99) - (b.rotationRank ?? 99))[0] ?? null;

  const sortedWorkers = [...workers].sort((a, b) => {
    const statusOrder: Record<string, number> = { available: 0, in_service: 1, on_break: 2, off_today: 3, unavailable: 4 };
    const oa = statusOrder[a.status] ?? 99;
    const ob = statusOrder[b.status] ?? 99;
    if (oa !== ob) return oa - ob;
    return (a.rotationRank ?? 99) - (b.rotationRank ?? 99);
  });

  // Max service cells across all workers
  const maxCells = Math.max(...workers.map((w) => w.services.length + 1), 5);

  const handleAssignToNext = (customerId: string) => {
    if (!nextAvailableWorker) return;
    const customer = customers.find((c) => c.id === customerId);
    if (!customer) return;

    // Optimistic update
    setWorkers((prev) =>
      prev.map((w) => {
        if (w.id === nextAvailableWorker.id) {
          return {
            ...w,
            status: "in_service",
            serviceCount: w.serviceCount + 1,
            rotationRank: null,
            services: [
              ...w.services,
              { service: customer.services.join(" + "), customer: customer.name, status: "in_service", duration: "0m" },
            ],
          };
        }
        return w;
      })
    );
    setCustomers((prev) => prev.filter((c) => c.id !== customerId));
    setSelectedCustomer(null);
  };

  const handleAssignToWorker = (workerId: string) => {
    if (!selectedCustomerData) return;
    const w = workers.find((x) => x.id === workerId);
    if (!w || w.status !== "available") return;

    setWorkers((prev) =>
      prev.map((w) => {
        if (w.id === workerId) {
          return {
            ...w,
            status: "in_service",
            serviceCount: w.serviceCount + 1,
            rotationRank: null,
            services: [
              ...w.services,
              { service: selectedCustomerData.services.join(" + "), customer: selectedCustomerData.name, status: "in_service", duration: "0m" },
            ],
          };
        }
        return w;
      })
    );
    setCustomers((prev) => prev.filter((c) => c.id !== selectedCustomer));
    setSelectedCustomer(null);
  };

  if (loading) {
    return (
      <>
        <header>
          <p className="eyebrow">Assign</p>
          <h1>Assign Customers</h1>
        </header>
        <p className="text-muted">Loading assignment board...</p>
      </>
    );
  }

  if (!session) {
    return (
      <>
        <header>
          <p className="eyebrow">Assign</p>
          <h1>Assign Customers</h1>
        </header>
        <EmptyState
          icon="⏱"
          title="No active session"
          description="Start the day from the Floor tab before assigning customers."
        />
      </>
    );
  }

  return (
    <>
      {/* Top Header */}
      <header className="assign-header">
        <div className="assign-header__top">
          <div>
            <p className="eyebrow">Assign</p>
            <h1 className="assign-header__title">Assign Customers</h1>
          </div>
          <div className="assign-header__actions">
            <Badge variant={loadError ? "warning" : "success"}>{loadError || "Session open"}</Badge>
          </div>
        </div>
        <div className="assign-header__stats">
          <span className="assign-stat">
            <span className="assign-stat__value assign-stat__value--warning">{waitingCount}</span>
            <span className="assign-stat__label">Waiting</span>
          </span>
          <span className="assign-stat">
            <span className="assign-stat__value assign-stat__value--success">{availableCount}</span>
            <span className="assign-stat__label">Available</span>
          </span>
          <span className="assign-stat">
            <span className="assign-stat__value assign-stat__value--info">{inServiceCount}</span>
            <span className="assign-stat__label">In Service</span>
          </span>
          <span className="assign-stat">
            <span className="assign-stat__value assign-stat__value--warn">{onBreakCount}</span>
            <span className="assign-stat__label">On Break</span>
          </span>
          <span className="assign-stat">
            <span className="assign-stat__value assign-stat__value--muted">{avgWait}</span>
            <span className="assign-stat__label">Avg Wait</span>
          </span>
        </div>
      </header>

      {/* Two-Column Layout */}
      <div className="assign-layout">
        {/* Left Panel: Waiting Queue */}
        <aside className="assign-queue">
          <div className="assign-queue__header">
            <h2 className="assign-queue__title">Waiting Queue</h2>
            <Badge variant="warning">{waitingCount}</Badge>
          </div>
          {customers.length === 0 ? (
            <EmptyState icon="🪑" title="No one waiting" description="Check in customers to start assigning." />
          ) : (
            <div className="assign-queue__list">
              {customers.map((c) => (
                <div
                  key={c.id}
                  className={`assign-customer-card ${selectedCustomer === c.id ? "assign-customer-card--selected" : ""}`}
                  onClick={() => setSelectedCustomer(selectedCustomer === c.id ? null : c.id)}
                >
                  <div className="assign-customer-card__top">
                    <span className="assign-customer-card__name">{c.name}</span>
                    <span className="assign-customer-card__type">{c.type}</span>
                  </div>
                  <div className="assign-customer-card__wait">
                    ⏱ Waiting {c.waitTime}
                    {c.partySize && c.partySize > 1 && <span> · Party of {c.partySize}</span>}
                  </div>
                  <div className="assign-customer-card__services">
                    <span className="assign-customer-card__services-label">Services:</span>
                    <span className="assign-customer-card__services-list">{c.services.join(" + ")}</span>
                  </div>
                  {c.preference && (
                    <div className="assign-customer-card__pref">
                      Preference: <strong>{c.preference}</strong>
                    </div>
                  )}
                  {c.notes && (
                    <div className="assign-customer-card__notes">{c.notes}</div>
                  )}
                  <div className="assign-customer-card__actions">
                    {selectedCustomer === c.id ? (
                      <>
                        {nextAvailableWorker ? (
                          <Button
                            size="sm"
                            fullWidth
                            onClick={(e) => { e.stopPropagation(); handleAssignToNext(c.id); }}
                          >
                            Assign to {nextAvailableWorker.name}
                          </Button>
                        ) : (
                          <span className="assign-customer-card__no-worker">No workers available</span>
                        )}
                        <button
                          className="assign-customer-card__choose-btn"
                          onClick={(e) => e.stopPropagation()}
                        >
                          Choose Worker
                        </button>
                      </>
                    ) : (
                      <span className="assign-customer-card__hint">Click to select · then assign</span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </aside>

        {/* Right Panel: Worker Service Grid */}
        <section className="assign-grid">
          <div className="assign-grid__header">
            <h2 className="assign-grid__title">Worker Service Grid</h2>
          </div>

          {workers.length === 0 ? (
            <EmptyState icon="👤" title="No workers" description="Add workers in the Workers tab to see the service board." />
          ) : (
            <div className="assign-grid__scroll">
              <div className="assign-grid__table">
                {/* Table Header */}
                <div className="assign-row assign-row--header">
                  <div className="assign-row__worker-col">Worker</div>
                  <div className="assign-row__count-col">Count</div>
                  <div className="assign-row__status-col">Status / Rotation</div>
                  {Array.from({ length: maxCells }).map((_, i) => (
                    <div key={i} className="assign-row__cell-col">Service {i + 1}</div>
                  ))}
                </div>

                {/* Worker Rows */}
                {sortedWorkers.map((w) => {
                  const isAvailable = w.status === "available";
                  const isSelectedTarget = selectedCustomer != null && isAvailable;
                  const isDimmed = selectedCustomer != null && !isAvailable;

                  return (
                    <div
                      key={w.id}
                      className={`assign-row ${isSelectedTarget ? "assign-row--highlight" : ""} ${isDimmed ? "assign-row--dimmed" : ""} ${w.status === "in_service" ? "assign-row--in-service" : ""} ${w.status === "on_break" ? "assign-row--on-break" : ""} ${w.status === "off_today" ? "assign-row--off" : ""}`}
                    >
                      {/* Worker identity - sticky */}
                      <div className="assign-row__worker-col">
                        <div className="assign-worker">
                          <span className="assign-worker__name">{w.name}</span>
                        </div>
                      </div>

                      {/* Service Count - large badge */}
                      <div className="assign-row__count-col">
                        <div className={`assign-count assign-count--${w.status === "available" ? "available" : w.status === "in_service" ? "active" : w.status === "on_break" ? "break" : "neutral"}`}>
                          <span className="assign-count__number">{w.serviceCount}</span>
                          <span className="assign-count__label">svc</span>
                        </div>
                      </div>

                      {/* Status & Rotation */}
                      <div className="assign-row__status-col">
                        <div className="assign-status-row">
                          <span className={`assign-status-pill assign-status-pill--${w.status === "available" ? "available" : w.status === "in_service" ? "in_service" : w.status === "on_break" ? "break" : "off"}`}>
                            {w.status === "available" ? "Available" : w.status === "in_service" ? "In Service" : w.status === "on_break" ? "On Break" : w.status === "off_today" ? "Checked Out" : "Unavailable"}
                          </span>
                          {w.rotationRank != null && (
                            <span className={`assign-rotation ${w.rotationRank === 1 ? "assign-rotation--next" : ""}`}>
                              Next #{w.rotationRank}
                            </span>
                          )}
                        </div>
                      </div>

                      {/* Service Cells */}
                      {Array.from({ length: maxCells }).map((_, cellIdx) => {
                        const cell = w.services[cellIdx];
                        const isEmpty = !cell;
                        const isLastEmpty = isEmpty && cellIdx === w.services.length;

                        return (
                          <div
                            key={cellIdx}
                            className={`assign-cell ${cell ? `assign-cell--${cell.status}` : ""} ${isEmpty && !isLastEmpty ? "assign-cell--past" : ""} ${isLastEmpty && isSelectedTarget ? "assign-cell--assign-target" : ""} ${isLastEmpty && !isSelectedTarget ? "assign-cell--empty" : ""}`}
                            onClick={() => {
                              if (isLastEmpty && isSelectedTarget) {
                                handleAssignToWorker(w.id);
                              }
                            }}
                          >
                            {cell ? (
                              <>
                                {cell.status === "completed" && (
                                  <>
                                    <div className="assign-cell__service">{cell.service}</div>
                                    <div className="assign-cell__customer">{cell.customer}</div>
                                    <div className="assign-cell__meta assign-cell__meta--done">Done</div>
                                  </>
                                )}
                                {cell.status === "in_service" && (
                                  <>
                                    <div className="assign-cell__customer assign-cell__customer--active">{cell.customer}</div>
                                    <div className="assign-cell__service">{cell.service}</div>
                                    {cell.duration && (
                                      <div className="assign-cell__timer">⏱ {cell.duration}</div>
                                    )}
                                  </>
                                )}
                                {cell.status === "assigned" && (
                                  <>
                                    <div className="assign-cell__customer">{cell.customer}</div>
                                    <div className="assign-cell__meta assign-cell__meta--assigned">Assigned</div>
                                  </>
                                )}
                                {cell.status === "break" && (
                                  <>
                                    <div className="assign-cell__service">Break</div>
                                    {cell.duration && (
                                      <div className="assign-cell__meta">{cell.duration}</div>
                                    )}
                                  </>
                                )}
                              </>
                            ) : isLastEmpty && isSelectedTarget ? (
                              <span className="assign-cell__assign-text">+ {selectedCustomerData?.name}</span>
                            ) : isLastEmpty ? (
                              <span className="assign-cell__placeholder">+ Assign</span>
                            ) : (
                              <span className="assign-cell__past">—</span>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </section>
      </div>

      {/* Populated State Demo */}
      {SHOW_ASSIGN_DEMO && (
      <div className="assign-populated">
        <div className="assign-grid__header" style={{ marginTop: "var(--space-6)" }}>
          <h2 className="assign-grid__title">Example Populated Board</h2>
          <Badge variant="info">Demo</Badge>
        </div>
        <div className="assign-grid__scroll" style={{ maxHeight: "none", overflow: "visible" }}>
          <div className="assign-grid__table">
            <div className="assign-row assign-row--header">
              <div className="assign-row__worker-col">Worker</div>
              <div className="assign-row__count-col">Count</div>
              <div className="assign-row__status-col">Status / Rotation</div>
              <div className="assign-row__cell-col">1</div>
              <div className="assign-row__cell-col">2</div>
              <div className="assign-row__cell-col">3</div>
              <div className="assign-row__cell-col">4</div>
              <div className="assign-row__cell-col">5</div>
            </div>
            {/* Bella — Available with completed services */}
            <div className="assign-row">
              <div className="assign-row__worker-col">
                <div className="assign-worker">
                  <span className="assign-worker__name">Bella</span>
                </div>
              </div>
              <div className="assign-row__count-col">
                <div className="assign-count assign-count--available">
                  <span className="assign-count__number">3</span>
                  <span className="assign-count__label">svc</span>
                </div>
              </div>
              <div className="assign-row__status-col">
                <div className="assign-status-row">
                  <span className="assign-status-pill assign-status-pill--available">Available</span>
                  <span className="assign-rotation assign-rotation--next">Next #1</span>
                </div>
              </div>
              <div className="assign-cell assign-cell--completed">
                <div className="assign-cell__service">Manicure</div>
                <div className="assign-cell__customer">Mia</div>
                <div className="assign-cell__meta assign-cell__meta--done">Done</div>
              </div>
              <div className="assign-cell assign-cell--completed">
                <div className="assign-cell__service">Pedicure</div>
                <div className="assign-cell__customer">Anna</div>
                <div className="assign-cell__meta assign-cell__meta--done">Done</div>
              </div>
              <div className="assign-cell assign-cell--completed">
                <div className="assign-cell__service">Gel</div>
                <div className="assign-cell__customer">Lily</div>
                <div className="assign-cell__meta assign-cell__meta--done">Done</div>
              </div>
              <div className="assign-cell assign-cell--empty">
                <span className="assign-cell__placeholder">+ Assign</span>
              </div>
              <div className="assign-cell assign-cell--empty">
                <span className="assign-cell__placeholder">+ Assign</span>
              </div>
            </div>
            {/* Coco — Available #2 with some services */}
            <div className="assign-row">
              <div className="assign-row__worker-col">
                <div className="assign-worker">
                  <span className="assign-worker__name">Coco</span>
                </div>
              </div>
              <div className="assign-row__count-col">
                <div className="assign-count assign-count--available">
                  <span className="assign-count__number">2</span>
                  <span className="assign-count__label">svc</span>
                </div>
              </div>
              <div className="assign-row__status-col">
                <div className="assign-status-row">
                  <span className="assign-status-pill assign-status-pill--available">Available</span>
                  <span className="assign-rotation">Next #2</span>
                </div>
              </div>
              <div className="assign-cell assign-cell--completed">
                <div className="assign-cell__service">Pedicure</div>
                <div className="assign-cell__customer">Jane</div>
                <div className="assign-cell__meta assign-cell__meta--done">Done</div>
              </div>
              <div className="assign-cell assign-cell--completed">
                <div className="assign-cell__service">Fill</div>
                <div className="assign-cell__customer">Rose</div>
                <div className="assign-cell__meta assign-cell__meta--done">Done</div>
              </div>
              <div className="assign-cell assign-cell--empty">
                <span className="assign-cell__placeholder">+ Assign</span>
              </div>
              <div className="assign-cell assign-cell--empty">
                <span className="assign-cell__placeholder">+ Assign</span>
              </div>
              <div className="assign-cell assign-cell--empty">
                <span className="assign-cell__placeholder">+ Assign</span>
              </div>
            </div>
            {/* Daisy — In Service with active turn */}
            <div className="assign-row assign-row--in-service">
              <div className="assign-row__worker-col">
                <div className="assign-worker">
                  <span className="assign-worker__name">Daisy</span>
                </div>
              </div>
              <div className="assign-row__count-col">
                <div className="assign-count assign-count--active">
                  <span className="assign-count__number">4</span>
                  <span className="assign-count__label">svc</span>
                </div>
              </div>
              <div className="assign-row__status-col">
                <div className="assign-status-row">
                  <span className="assign-status-pill assign-status-pill--in_service">In Service</span>
                  <span className="assign-rotation">—</span>
                </div>
              </div>
              <div className="assign-cell assign-cell--completed">
                <div className="assign-cell__service">Manicure</div>
                <div className="assign-cell__customer">Sara</div>
                <div className="assign-cell__meta assign-cell__meta--done">Done</div>
              </div>
              <div className="assign-cell assign-cell--completed">
                <div className="assign-cell__service">Pedicure</div>
                <div className="assign-cell__customer">Emily</div>
                <div className="assign-cell__meta assign-cell__meta--done">Done</div>
              </div>
              <div className="assign-cell assign-cell--completed">
                <div className="assign-cell__service">Fill</div>
                <div className="assign-cell__customer">Jane</div>
                <div className="assign-cell__meta assign-cell__meta--done">Done</div>
              </div>
              <div className="assign-cell assign-cell--in_service">
                <div className="assign-cell__customer assign-cell__customer--active">Kyler</div>
                <div className="assign-cell__service">Full Set</div>
                <div className="assign-cell__timer">⏱ 18m</div>
              </div>
              <div className="assign-cell assign-cell--empty">
                <span className="assign-cell__placeholder">+ Assign</span>
              </div>
            </div>
            {/* Amy — On Break */}
            <div className="assign-row assign-row--on-break">
              <div className="assign-row__worker-col">
                <div className="assign-worker">
                  <span className="assign-worker__name">Amy</span>
                </div>
              </div>
              <div className="assign-row__count-col">
                <div className="assign-count assign-count--break">
                  <span className="assign-count__number">1</span>
                  <span className="assign-count__label">svc</span>
                </div>
              </div>
              <div className="assign-row__status-col">
                <div className="assign-status-row">
                  <span className="assign-status-pill assign-status-pill--break">On Break</span>
                  <span className="assign-rotation">—</span>
                </div>
              </div>
              <div className="assign-cell assign-cell--completed">
                <div className="assign-cell__service">Manicure</div>
                <div className="assign-cell__customer">Tina</div>
                <div className="assign-cell__meta assign-cell__meta--done">Done</div>
              </div>
              <div className="assign-cell assign-cell--break">
                <div className="assign-cell__service">Break</div>
                <div className="assign-cell__meta">12m</div>
              </div>
              <div className="assign-cell assign-cell--empty">
                <span className="assign-cell__placeholder">—</span>
              </div>
              <div className="assign-cell assign-cell--empty">
                <span className="assign-cell__placeholder">—</span>
              </div>
              <div className="assign-cell assign-cell--empty">
                <span className="assign-cell__placeholder">—</span>
              </div>
            </div>
          </div>
        </div>
      </div>
      )}
    </>
  );
}

/* ════════════════════════════════════════
   Assign Mock Data
   ════════════════════════════════════════ */

export const MOCK_ASSIGN_CUSTOMERS: AssignCustomer[] = [
  {
    id: "c1",
    name: "Kyler",
    type: "Walk-in",
    waitTime: "8m",
    services: ["Pedicure", "Gel"],
    preference: "Any worker",
  },
  {
    id: "c2",
    name: "Sarah J.",
    type: "Walk-in",
    waitTime: "15m",
    services: ["Full Set"],
    preference: "Bella",
    notes: "Acrylic, coffin shape",
  },
  {
    id: "c3",
    name: "Kim Lee",
    type: "Appointment",
    waitTime: "5m",
    services: ["Manicure", "Pedicure"],
    preference: "Any worker",
    partySize: 2,
  },
];

export const MOCK_ASSIGN_WORKERS: AssignWorker[] = [
  { id: "w1", name: "Bella", status: "available", rotationRank: 1, serviceCount: 0, services: [] },
  { id: "w2", name: "Coco", status: "available", rotationRank: 2, serviceCount: 0, services: [] },
  { id: "w3", name: "Daisy", status: "available", rotationRank: 3, serviceCount: 0, services: [] },
  { id: "w4", name: "Amy", status: "on_break", rotationRank: null, serviceCount: 0, services: [] },
];

/* ════════════════════════════════════════
   Checkout Screen
   ════════════════════════════════════════ */

type CheckoutItem = {
  saleItemId?: string;
  serviceName: string;
  workerName: string;
  category: string;
  priceCents: number;
  discountCents: number;
  tipCents: number;
};

type CheckoutStep = "start" | "build" | "pay" | "done";

function CheckoutScreen({ onBack }: { onBack: () => void }) {
  const [step, setStep] = useState<CheckoutStep>("start");
  const [saleId, setSaleId] = useState<string | null>(null);
  const [items, setItems] = useState<CheckoutItem[]>([]);
  const [services, setServices] = useState<Service[]>([]);
  const [workers, setWorkers] = useState<Worker[]>([]);
  const [selectedWorkerId, setSelectedWorkerId] = useState<string | null>(null);
  const [payments, setPayments] = useState<PaymentEntry[]>([]);
  const [amountCents, setAmountCents] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [activeMethod, setActiveMethod] = useState("cash");
  const [changeCents, setChangeCents] = useState(0);

  const subtotal = items.reduce((s, i) => s + i.priceCents, 0);
  const discounts = items.reduce((s, i) => s + i.discountCents, 0);
  const tips = items.reduce((s, i) => s + i.tipCents, 0);
  const total = Math.round(subtotal - discounts + tips);
  const paid = Math.round(payments.reduce((s, p) => s + p.amountCents, 0));
  const remaining = Math.max(0, total - paid);

  const selectedWorker = workers.find((w) => w.id === selectedWorkerId) ?? null;

  const initSale = async () => {
    setLoading(true);
    setError("");
    try {
      const [sale, svcs, wrks] = await Promise.all([
        createSale({}),
        fetchServices({ active: true }),
        fetchWorkers(),
      ]);
      setSaleId(sale.id);
      setServices(svcs);
      setWorkers(wrks.filter((w) => w.active));
      setStep("build");
    } catch {
      setError("Failed to start sale. Check API connection.");
    } finally {
      setLoading(false);
    }
  };

  const handleSelectService = async (svc: Service) => {
    if (!selectedWorkerId || !saleId) {
      setError("Please select a worker first before adding a service.");
      return;
    }
    setError("");
    setLoading(true);
    try {
      const result = await addSaleItem(saleId, {
        serviceId: svc.id,
        workerId: selectedWorkerId,
      });
      const saleItemId =
        result.saleItem && typeof result.saleItem === "object" && "id" in result.saleItem
          ? String(result.saleItem.id)
          : undefined;
      setItems([
        ...items,
        {
          saleItemId,
          serviceName: svc.name,
          workerName: selectedWorker?.displayName || selectedWorker?.user?.name || "Worker",
          category: svc.category?.name ?? "",
          priceCents: svc.priceCents,
          discountCents: 0,
          tipCents: 0,
        },
      ]);
    } catch {
      setError("Failed to add service to sale.");
    } finally {
      setLoading(false);
    }
  };

  const handleSelectWorker = (worker: Worker) => {
    setError("");
    setSelectedWorkerId(worker.id);
  };

  const removeItem = async (idx: number) => {
    const item = items[idx];
    if (item?.saleItemId && saleId) {
      try {
        await removeSaleItem(saleId, item.saleItemId);
      } catch {
        // proceed to remove locally even if API fails
      }
    }
    setItems(items.filter((_, i) => i !== idx));
  };

  const addPayment = async () => {
    if (!saleId || amountCents <= 0) return;
    const capped = Math.min(amountCents, Math.max(remaining, 0));
    setLoading(true);
    try {
      if (activeMethod === "cash") {
        await addCashPayment(saleId, { amountCents: capped });
      } else if (activeMethod === "gift_card") {
        await addGiftCardPayment(saleId, { amountCents: capped });
      }
      setPayments([...payments, { method: activeMethod, amountCents: capped }]);
      setAmountCents(0);
    } catch {
      setError("Payment failed.");
    } finally {
      setLoading(false);
    }
  };

  const removePayment = (idx: number) => {
    setPayments(payments.filter((_, i) => i !== idx));
  };

  const exactPayment = async () => {
    if (!saleId || remaining <= 0) return;
    setLoading(true);
    try {
      if (activeMethod === "cash") {
        await addCashPayment(saleId, { amountCents: remaining });
      } else if (activeMethod === "gift_card") {
        await addGiftCardPayment(saleId, { amountCents: remaining });
      }
      setPayments([...payments, { method: activeMethod, amountCents: remaining }]);
    } catch {
      setError("Payment failed.");
    } finally {
      setLoading(false);
    }
  };

  const completeCheckout = async () => {
    if (!saleId) return;
    setLoading(true);
    try {
      const result = await completeSale(saleId);
      setChangeCents(result.changeDueCents);
      setStep("done");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to complete sale.");
    } finally {
      setLoading(false);
    }
  };

  // Done screen
  if (step === "done") {
    return (
      <>
        <header>
          <p className="eyebrow">Checkout</p>
          <h1>Sale Complete 🎉</h1>
        </header>
        <Card padding="lg" className="mt-4">
          <div style={{ textAlign: "center", padding: "var(--space-8) 0" }}>
            <div style={{ fontSize: "3rem", marginBottom: "var(--space-4)" }}>✅</div>
            <h2 style={{ margin: "0 0 var(--space-2)" }}>Payment Received</h2>
            <MoneyDisplay cents={total} className="money--large" />
            <p className="text-muted text-sm mt-2">
              Paid {formatMoney(paid)} across {payments.length} method(s)
            </p>
            {changeCents > 0 && (
              <p style={{ color: "var(--color-success)" }}>
                Change due: {formatMoney(changeCents)}
              </p>
            )}
          </div>
          <div style={{ display: "flex", gap: "var(--space-3)", justifyContent: "center", marginTop: "var(--space-4)" }}>
            <Button onClick={() => {
              setStep("start");
              setSaleId(null);
              setItems([]);
              setPayments([]);
              setSelectedWorkerId(null);
              setChangeCents(0);
            }}>
              New Sale
            </Button>
          </div>
        </Card>
        {items.length > 0 && (
          <ReceiptPreview
            items={items}
            payments={payments}
            subtotal={subtotal}
            discounts={discounts}
            tips={tips}
            total={total}
          />
        )}
        <div className="mt-4">
          <Button variant="ghost" onClick={onBack}>← Back to Floor</Button>
        </div>
      </>
    );
  }

  // Start screen
  if (step === "start") {
    return (
      <>
        <header>
          <p className="eyebrow">Checkout</p>
          <div className="app-bar">
            <h1 className="app-bar__title">New Sale</h1>
            <Button variant="ghost" size="sm" onClick={onBack}>← Floor</Button>
          </div>
        </header>
        <Card padding="lg">
          <h2 className="card__title mb-2">Start a Sale</h2>
          <p className="text-muted text-sm mb-4">
            Tap below to create a new walk-in sale. Then select a worker and add services.
          </p>
          <Button fullWidth size="lg" loading={loading} onClick={initSale}>
            🚶 Walk-in Customer
          </Button>
          {error && <p className="field__error mt-2">{error}</p>}
        </Card>
      </>
    );
  }

  // Build screen — two areas: Workers | Services
  return (
    <>
      <header>
        <p className="eyebrow">Checkout</p>
        <div className="app-bar">
          <h1 className="app-bar__title">
            {step === "build" && "Build Sale"}
            {step === "pay" && "Take Payment"}
          </h1>
          <Button variant="ghost" size="sm" onClick={onBack}>← Floor</Button>
        </div>
      </header>

      {/* Summary bar */}
      <div className="checkout-total-bar mb-4">
        <span className="checkout-total-bar__label">
          {items.length} item{items.length !== 1 ? "s" : ""} · Sale Total
        </span>
        <span className="checkout-total-bar__amount">{formatMoney(total)}</span>
      </div>

      {step === "build" && (
        <>
          {/* Active worker indicator */}
          {selectedWorker ? (
            <div
              style={{
                padding: "var(--space-3)",
                marginBottom: "var(--space-4)",
                background: "var(--color-info-light, #e8f4fd)",
                borderRadius: "var(--radius-md)",
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
              }}
            >
              <span>
                👤 Active: <strong>{selectedWorker.displayName || selectedWorker.user?.name}</strong>
                {" "}· {Math.round(selectedWorker.commissionRate * 100)}% commission
              </span>
              <Button size="sm" variant="ghost" onClick={() => setSelectedWorkerId(null)}>
                Clear
              </Button>
            </div>
          ) : (
            <div
              style={{
                padding: "var(--space-3)",
                marginBottom: "var(--space-4)",
                background: "var(--color-warning-light, #fff8e1)",
                borderRadius: "var(--radius-md)",
                fontSize: "var(--text-sm)",
                color: "var(--color-warning, #c79100)",
              }}
            >
              ⚠️ Select a worker below before adding services.
            </div>
          )}
          {error && <p className="field__error mb-3">{error}</p>}

          <div className="grid">
            {/* ── Workers Area ── */}
            <Card padding="lg">
              <div className="card__header">
                <h2 className="card__title">👥 Workers</h2>
                <Badge variant="info">{workers.length}</Badge>
              </div>
              {workers.length === 0 ? (
                <EmptyState icon="👤" title="No workers available" description="Add workers in the Workers tab first." />
              ) : (
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(140px, 1fr))", gap: "var(--space-2)" }}>
                  {workers.map((w) => (
                    <div
                      key={w.id}
                      onClick={() => handleSelectWorker(w)}
                      style={{
                        cursor: "pointer",
                        padding: "var(--space-3)",
                        borderRadius: "var(--radius-md)",
                        border: selectedWorkerId === w.id
                          ? "2px solid var(--color-primary)"
                          : "2px solid var(--color-border, #ddd)",
                        background: selectedWorkerId === w.id
                          ? "var(--color-primary-light, #e8f0fe)"
                          : "var(--color-surface)",
                        textAlign: "center",
                        transition: "all 0.15s",
                      }}
                    >
                      <div style={{ fontSize: "var(--text-lg)", marginBottom: "var(--space-1)" }}>
                        {w.currentStatus === "available" ? "🟢" : w.currentStatus === "in_service" ? "🔵" : w.currentStatus === "on_break" ? "🟡" : "⚪"}
                      </div>
                      <div style={{ fontWeight: "var(--font-semibold)", fontSize: "var(--text-sm)", marginBottom: "var(--space-1)" }}>
                        {w.displayName || w.user?.name}
                      </div>
                      <div style={{ fontSize: "var(--text-xs)", color: "var(--color-text-muted)" }}>
                        {Math.round(w.commissionRate * 100)}%
                      </div>
                      <StatusPill status={w.currentStatus} />
                    </div>
                  ))}
                </div>
              )}
            </Card>

            {/* ── Services Area ── */}
            <Card padding="lg" className="wide">
              <div className="card__header">
                <h2 className="card__title">💅 Services</h2>
                <div style={{ display: "flex", gap: "var(--space-2)" }}>
                  {items.length > 0 && (
                    <Button size="sm" variant="secondary" onClick={() => setStep("pay")}>
                      Go to Payment →
                    </Button>
                  )}
                </div>
              </div>
              {services.length === 0 ? (
                <EmptyState icon="💅" title="No services available" description="Add services in the Services tab first." />
              ) : (
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(150px, 1fr))", gap: "var(--space-2)" }}>
                  {services.map((svc) => (
                    <div
                      key={svc.id}
                      onClick={() => { void handleSelectService(svc); }}
                      style={{
                        cursor: "pointer",
                        padding: "var(--space-3)",
                        borderRadius: "var(--radius-md)",
                        border: "2px solid var(--color-border, #ddd)",
                        background: "var(--color-surface)",
                        textAlign: "center",
                        transition: "all 0.15s",
                      }}
                    >
                      <div style={{ fontWeight: "var(--font-semibold)", fontSize: "var(--text-sm)", marginBottom: "var(--space-1)" }}>
                        {svc.name}
                      </div>
                      <MoneyDisplay cents={svc.priceCents} className="money--sm" />
                      <div style={{ fontSize: "var(--text-xs)", color: "var(--color-text-muted)", marginTop: "var(--space-1)" }}>
                        {svc.category?.name ?? ""} · {svc.durationMinutes}m
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </Card>
          </div>

          {/* Items added so far */}
          {items.length > 0 && (
            <Card padding="lg" className="mt-4">
              <div className="card__header">
                <h2 className="card__title">Sale Items</h2>
                <Badge variant="info">{items.length}</Badge>
              </div>
              <div className="checkout-section">
                {items.map((item, idx) => (
                  <div key={idx} style={{ fontSize: "var(--text-sm)", display: "flex", justifyContent: "space-between", alignItems: "flex-start", padding: "var(--space-2) 0" }}>
                    <div>
                      <div style={{ fontWeight: "var(--font-semibold)" }}>{item.serviceName}</div>
                      <div className="text-muted" style={{ fontSize: "var(--text-xs)" }}>
                        {item.workerName} · {item.category}
                      </div>
                    </div>
                    <div style={{ display: "flex", alignItems: "center", gap: "var(--space-2)" }}>
                      <span style={{ fontWeight: "var(--font-semibold)" }}>
                        {formatMoney(item.priceCents - item.discountCents + item.tipCents)}
                      </span>
                      <button
                        onClick={() => removeItem(idx)}
                        style={{
                          background: "none", border: "none", cursor: "pointer",
                          color: "var(--color-danger)", fontSize: "var(--text-lg)",
                          padding: 0, lineHeight: 1,
                        }}
                      >
                        ✕
                      </button>
                    </div>
                  </div>
                ))}
                <hr className="receipt__line" />
                <div className="flex-between" style={{ fontWeight: "var(--font-bold)" }}>
                  <span>Total</span>
                  <span>{formatMoney(total)}</span>
                </div>
              </div>
            </Card>
          )}
        </>
      )}

      {/* ── Payment Step ── */}
      {step === "pay" && (
        <div className="grid">
          <Card padding="lg" className="wide">
            <div className="card__header">
              <h2 className="card__title">💰 Take Payment</h2>
              <Button size="sm" variant="secondary" onClick={() => setStep("build")}>
                ← Back to Build
              </Button>
            </div>
            <div className="remaining-tracker mb-4">
              {remaining > 0 ? (
                <>Remaining: <span className="remaining-tracker__amount">{formatMoney(remaining)}</span></>
              ) : (
                <span className="remaining-tracker__done">✓ Fully Paid!</span>
              )}
            </div>
            <div className="payment-methods mb-4">
              {[
                { key: "cash", icon: "💵", label: "Cash" },
                { key: "card", icon: "💳", label: "Card" },
                { key: "gift_card", icon: "🎁", label: "Gift Card" },
              ].map((m) => (
                <button
                  key={m.key}
                  type="button"
                  className={`payment-method-btn ${activeMethod === m.key ? "payment-method-btn--active" : ""}`}
                  onClick={() => setActiveMethod(m.key)}
                >
                  <span className="payment-method-btn__icon">{m.icon}</span>
                  {m.label}
                </button>
              ))}
            </div>
            {remaining > 0 && (
              <div className="mb-3">
                <Button fullWidth variant="secondary" onClick={exactPayment} loading={loading}>
                  Pay Exact Total — {formatMoney(remaining)}
                </Button>
              </div>
            )}
            <AmountInput label="Custom Amount" valueCents={amountCents} onChangeCents={setAmountCents} />
            <div className="mt-2">
              <Button fullWidth variant="ghost" onClick={addPayment} disabled={amountCents <= 0 || loading}>
                Add Payment
              </Button>
            </div>
            {payments.length > 0 && (
              <div className="payment-entries mt-4">
                {payments.map((p, i) => (
                  <div key={i} className="payment-entry">
                    <span className="payment-entry__method">{methodLabel(p.method)}</span>
                    <span className="payment-entry__amount">{formatMoney(p.amountCents)}</span>
                    <button className="payment-entry__remove" onClick={() => removePayment(i)}>✕</button>
                  </div>
                ))}
              </div>
            )}
            {error && <p className="field__error mt-2">{error}</p>}
            <div className="flex-between mt-4">
              <Button variant="secondary" onClick={() => setStep("build")}>← Back</Button>
              <Button onClick={completeCheckout} disabled={remaining > 0 || loading} loading={loading}>
                Complete Sale
              </Button>
            </div>
          </Card>
          <Card padding="lg">
            <h2 className="card__title mb-2">Sale Summary</h2>
            {items.length === 0 ? (
              <p className="text-muted text-sm">No services added.</p>
            ) : (
              <div className="checkout-section">
                {items.map((item, idx) => (
                  <div key={idx} style={{ fontSize: "var(--text-sm)", display: "flex", justifyContent: "space-between", padding: "var(--space-1) 0" }}>
                    <div>
                      <div style={{ fontWeight: "var(--font-semibold)" }}>{item.serviceName}</div>
                      <div className="text-muted" style={{ fontSize: "var(--text-xs)" }}>{item.workerName}</div>
                    </div>
                    <span style={{ fontWeight: "var(--font-semibold)" }}>
                      {formatMoney(item.priceCents - item.discountCents + item.tipCents)}
                    </span>
                  </div>
                ))}
                <hr className="receipt__line" />
                <div className="flex-between" style={{ fontWeight: "var(--font-bold)" }}>
                  <span>Total</span><span>{formatMoney(total)}</span>
                </div>
                {paid > 0 && <div className="flex-between text-sm text-muted"><span>Paid</span><span>{formatMoney(paid)}</span></div>}
                {remaining > 0 && <div className="flex-between text-sm" style={{ color: "var(--color-danger)" }}><span>Due</span><span>{formatMoney(remaining)}</span></div>}
              </div>
            )}
          </Card>
        </div>
      )}
    </>
  );
}

/* ════════════════════════════════════════
   Services Management
   ════════════════════════════════════════ */

function ServicesScreen() {
  const [services, setServices] = useState<Service[]>([]);
  const [categories, setCategories] = useState<ServiceCategory[]>([]);
  const [activeCat, setActiveCat] = useState("all");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingService, setEditingService] = useState<Service | null>(null);

  /* ── Form state ── */
  const [formName, setFormName] = useState("");
  const [formCategoryId, setFormCategoryId] = useState("");
  const [formPriceText, setFormPriceText] = useState("");
  const [formDurationMin, setFormDurationMin] = useState(30);
  const [formDescription, setFormDescription] = useState("");
  const [formTurnCount, setFormTurnCount] = useState<string | null>(null);
  const [formError, setFormError] = useState("");
  const [saving, setSaving] = useState(false);
  const [newCatName, setNewCatName] = useState("");
  const [showNewCatForm, setShowNewCatForm] = useState(false);
  const [addingCat, setAddingCat] = useState(false);

  /* ── Threshold settings ── */
  const [settings, setSettings] = useState<SalonSettings | null>(null);
  const [thresholdText, setThresholdText] = useState("");
  const [savingThreshold, setSavingThreshold] = useState(false);
  const [showThresholdEdit, setShowThresholdEdit] = useState(false);

  const handleAddCategory = async () => {
    const name = newCatName.trim();
    if (!name) return;
    setAddingCat(true);
    try {
      const created = await createServiceCategory({ name });
      await load();
      setFormCategoryId(created.id);
      setNewCatName("");
      setShowNewCatForm(false);
    } catch {
      setFormError("Failed to create category.");
    } finally {
      setAddingCat(false);
    }
  };

  const load = async () => {
    setLoading(true);
    setError("");
    try {
      const [svcs, cats] = await Promise.all([
        fetchServices(),
        fetchServiceCategories(),
      ]);
      setServices(svcs);
      setCategories(cats);
    } catch {
      setError("Failed to load services. Using mock data.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
  }, []);

  const catNames = ["all", ...Array.from(new Set(categories.map((c) => c.name)))];

  const filtered =
    activeCat === "all"
      ? services
      : services.filter(
          (s) => (s.category?.name ?? s.categoryId) === activeCat
        );

  const loadSettings = async () => {
    try {
      const s = await fetchSettings();
      setSettings(s);
      setThresholdText(String(s.turnCountThresholdCents / 100));
    } catch { /* ignore */ }
  };

  useEffect(() => { void loadSettings(); }, []);

  const handleSaveThreshold = async () => {
    const cents = Math.round(parseFloat(thresholdText || "30") * 100);
    if (isNaN(cents) || cents < 0) return;
    setSavingThreshold(true);
    try {
      const s = await updateSettings({ turnCountThresholdCents: cents });
      setSettings(s);
      setThresholdText(String(s.turnCountThresholdCents / 100));
      setShowThresholdEdit(false);
    } catch { /* ignore */ }
    finally { setSavingThreshold(false); }
  };

  const openAddModal = () => {
    setFormName("");
    setFormCategoryId(categories[0]?.id ?? "");
    setFormPriceText("");
    setFormDurationMin(30);
    setFormDescription("");
    setFormTurnCount(null);
    setFormError("");
    setEditingService(null);
    setShowAddModal(true);
  };

  const openEditModal = (svc: Service) => {
    setFormName(svc.name);
    setFormCategoryId(svc.categoryId);
    setFormPriceText((svc.priceCents / 100).toFixed(2));
    setFormDurationMin(svc.durationMinutes);
    setFormDescription(svc.description ?? "");
    setFormTurnCount(String(svc.turnCount));
    setFormError("");
    setEditingService(svc);
    setShowAddModal(true);
  };

  const handleSave = async () => {
    setFormError("");
    if (!formName.trim()) {
      setFormError("Name is required.");
      return;
    }
    if (!formCategoryId) {
      setFormError("Category is required.");
      return;
    }
    const priceCents = Math.round(parseFloat(formPriceText || "0") * 100);
    if (isNaN(priceCents) || priceCents < 0) {
      setFormError("Valid price is required.");
      return;
    }

    setSaving(true);
    try {
      if (editingService) {
        const turnCountVal = formTurnCount != null ? parseInt(formTurnCount, 10) : undefined;
        await updateService(editingService.id, {
          name: formName.trim(),
          categoryId: formCategoryId,
          priceCents,
          turnCount: turnCountVal,
          durationMinutes: formDurationMin,
          description: formDescription.trim() || undefined,
        });
      } else {
        await createService({
          name: formName.trim(),
          categoryId: formCategoryId,
          priceCents,
          turnCount: formTurnCount != null ? parseInt(formTurnCount, 10) : undefined,
          durationMinutes: formDurationMin,
          description: formDescription.trim() || undefined,
        });
      }
      setShowAddModal(false);
      await load();
    } catch {
      setFormError("Failed to save service.");
    } finally {
      setSaving(false);
    }
  };

  const handleToggleActive = async (svc: Service) => {
    try {
      if (svc.active) {
        await deleteService(svc.id);
      } else {
        await updateService(svc.id, { active: true });
      }
      await load();
    } catch {
      // silently fail
    }
  };

  if (loading) {
    return (
      <>
        <header>
          <p className="eyebrow">Management</p>
          <div className="app-bar">
            <h1 className="app-bar__title">Services</h1>
          </div>
        </header>
        <p className="text-muted">Loading services...</p>
      </>
    );
  }

  return (
    <>
      <header>
        <p className="eyebrow">Management</p>
        <div className="app-bar">
          <h1 className="app-bar__title">Services</h1>
          <Button size="sm" onClick={openAddModal}>
            + Add Service
          </Button>
        </div>
        {error && (
          <p className="text-sm" style={{ color: "var(--color-warning)" }}>
            {error}
          </p>
        )}
      </header>

      {/* Threshold settings bar */}
      {settings && (
        <div style={{ marginBottom: "var(--space-4)", padding: "var(--space-3)", background: "var(--color-surface)", border: "1px solid var(--color-border)", borderRadius: "var(--radius-md)", display: "flex", alignItems: "center", gap: "var(--space-3)", flexWrap: "wrap" }}>
          <span style={{ fontSize: "var(--text-sm)", fontWeight: "var(--font-semibold)" }}>⚙️ Auto-zero turn count below:</span>
          {showThresholdEdit ? (
            <>
              <span style={{ fontSize: "var(--text-sm)" }}>$</span>
              <input
                type="number"
                value={thresholdText}
                onChange={(e) => setThresholdText(e.target.value)}
                step="0.01"
                min="0"
                style={{ width: "80px", padding: "var(--space-1) var(--space-2)", border: "1px solid var(--color-border)", borderRadius: "var(--radius-sm)", fontSize: "var(--text-sm)" }}
              />
              <Button size="sm" onClick={handleSaveThreshold} loading={savingThreshold}>Save</Button>
              <Button size="sm" variant="ghost" onClick={() => setShowThresholdEdit(false)}>Cancel</Button>
            </>
          ) : (
            <>
              <span style={{ fontSize: "var(--text-sm)", fontWeight: "var(--font-bold)" }}>{formatMoney(settings.turnCountThresholdCents)}</span>
              <Button size="sm" variant="ghost" onClick={() => { setShowThresholdEdit(true); setThresholdText(String(settings.turnCountThresholdCents / 100)); }}>Edit</Button>
            </>
          )}
          <span style={{ fontSize: "var(--text-xs)", color: "var(--color-text-muted)", flexBasis: "100%" }}>
            New services below this price default to turn count 0 (will not count toward turn ranking).
          </span>
        </div>
      )}

      <Tabs
        tabs={catNames.map((c) => ({
          key: c,
          label: c === "all" ? "All" : c,
        }))}
        activeKey={activeCat}
        onChange={setActiveCat}
      />

      {filtered.length === 0 ? (
        <EmptyState
          icon="💅"
          title="No services found"
          description="Add your first service to get started."
          action={
            <Button size="sm" onClick={openAddModal}>
              + Add Service
            </Button>
          }
        />
      ) : (
        <div className="mgmt-grid">
          {filtered.map((svc) => (
            <div key={svc.id} className="mgmt-card">
              <div className="mgmt-card__header">
                <span className="mgmt-card__name">{svc.name}</span>
                <StatusPill status={svc.active ? "active" : "inactive"} />
              </div>
              <div className="mgmt-card__body">
                <div className="mgmt-card__row">
                  <span>Category</span>
                  <span>{svc.category?.name ?? svc.categoryId}</span>
                </div>
                <div className="mgmt-card__row">
                  <span>Price</span>
                  <MoneyDisplay cents={svc.priceCents} />
                </div>
                <div className="mgmt-card__row">
                  <span>Duration</span>
                  <span>{svc.durationMinutes} min</span>
                </div>
                <div className="mgmt-card__row">
                  <span>Turn Count</span>
                  <span>{svc.turnCount}</span>
                </div>
                {svc.description && (
                  <div
                    className="mgmt-card__row"
                    style={{ fontSize: "var(--text-xs)", color: "var(--color-text-muted)" }}
                  >
                    <span>Description</span>
                    <span>{svc.description}</span>
                  </div>
                )}
              </div>
              <div className="mgmt-card__actions">
                <Button
                  size="sm"
                  variant="secondary"
                  onClick={() => openEditModal(svc)}
                >
                  Edit
                </Button>
                <Button
                  size="sm"
                  variant={svc.active ? "ghost" : "secondary"}
                  onClick={() => handleToggleActive(svc)}
                >
                  {svc.active ? "Disable" : "Enable"}
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Add / Edit Modal */}
      <Modal
        open={showAddModal}
        onClose={() => setShowAddModal(false)}
        title={editingService ? "Edit Service" : "Add Service"}
        footer={
          <>
            <Button
              variant="secondary"
              onClick={() => setShowAddModal(false)}
            >
              Cancel
            </Button>
            <Button onClick={handleSave} loading={saving}>
              {editingService ? "Save Changes" : "Add Service"}
            </Button>
          </>
        }
      >
        <Input
          label="Service Name"
          value={formName}
          onChange={(e) => setFormName(e.target.value)}
          placeholder="e.g. Classic Manicure"
        />
        <div style={{ display: "flex", gap: "var(--space-2)", alignItems: "flex-end" }}>
          <div style={{ flex: 1 }}>
            <Select
              label="Category"
              value={formCategoryId}
              onChange={(e) => setFormCategoryId(e.target.value)}
              options={categories.map((c) => ({
                value: c.id,
                label: c.name,
              }))}
              placeholder="Select a category"
            />
          </div>
          <Button size="sm" variant="ghost" onClick={() => { setShowNewCatForm(true); setNewCatName(""); }} type="button" style={{ marginBottom: "2px" }}>
            + New
          </Button>
        </div>
        {showNewCatForm && (
          <div style={{ display: "flex", gap: "var(--space-2)", alignItems: "flex-end", marginBottom: "var(--space-2)" }}>
            <Input
              label="New Category Name"
              value={newCatName}
              onChange={(e) => setNewCatName(e.target.value)}
              placeholder="e.g. Waxing"
            />
            <Button size="sm" onClick={handleAddCategory} loading={addingCat} disabled={!newCatName.trim()}>
              Save
            </Button>
          </div>
        )}
        <AmountInput
          label="Price"
          valueCents={(() => {
            const v = parseFloat(formPriceText || "0");
            return isNaN(v) ? 0 : Math.round(v * 100);
          })()}
          onChangeCents={(c) => setFormPriceText((c / 100).toFixed(2))}
        />
        <Input
          label="Duration (minutes)"
          type="number"
          value={String(formDurationMin)}
          onChange={(e) =>
            setFormDurationMin(parseInt(e.target.value, 10) || 0)
          }
          min={1}
        />
        <Input
          label="Turn Count (blank = auto)"
          type="number"
          value={formTurnCount ?? ""}
          onChange={(e) => setFormTurnCount(e.target.value || null)}
          placeholder="Auto (1 if ≥ threshold)"
          min={0}
        />
        <Input
          label="Description (optional)"
          value={formDescription}
          onChange={(e) => setFormDescription(e.target.value)}
          placeholder="Brief description of the service"
        />
        {formError && (
          <p className="field__error" style={{ marginTop: "var(--space-2)" }}>
            {formError}
          </p>
        )}
      </Modal>
    </>
  );
}

/* ════════════════════════════════════════
   Workers Management
   ════════════════════════════════════════ */

function WorkersScreen() {
  const [workers, setWorkers] = useState<Worker[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingWorker, setEditingWorker] = useState<Worker | null>(null);

  /* ── Form state ── */
  const [formName, setFormName] = useState("");
  const [formDisplayName, setFormDisplayName] = useState("");
  const [formEmail, setFormEmail] = useState("");
  const [formPhone, setFormPhone] = useState("");
  const [formCommissionText, setFormCommissionText] = useState("60");
  const [formError, setFormError] = useState("");
  const [saving, setSaving] = useState(false);

  const load = async () => {
    setLoading(true);
    setError("");
    try {
      const data = await fetchWorkers();
      setWorkers(data);
    } catch {
      setError("Failed to load workers. Using mock data.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
  }, []);

  const openAddModal = () => {
    setFormName("");
    setFormDisplayName("");
    setFormEmail("");
    setFormPhone("");
    setFormCommissionText("60");
    setFormError("");
    setEditingWorker(null);
    setShowAddModal(true);
  };

  const openEditModal = (w: Worker) => {
    setFormName(w.user?.name ?? "");
    setFormDisplayName(w.displayName);
    setFormEmail(w.user?.email ?? "");
    setFormPhone(w.user?.phone ?? "");
    setFormCommissionText(String(Math.round(w.commissionRate * 100)));
    setFormError("");
    setEditingWorker(w);
    setShowAddModal(true);
  };

  const handleSave = async () => {
    setFormError("");
    if (!formName.trim() && !editingWorker) {
      setFormError("Name is required.");
      return;
    }
    const commissionRate = parseFloat(formCommissionText) / 100;
    if (isNaN(commissionRate) || commissionRate < 0 || commissionRate > 1) {
      setFormError("Commission rate must be between 0 and 100.");
      return;
    }

    setSaving(true);
    try {
      if (editingWorker) {
        await updateWorker(editingWorker.id, {
          displayName: formDisplayName.trim() || undefined,
          commissionRate,
        });
      } else {
        await createWorker({
          name: formName.trim(),
          displayName: formDisplayName.trim() || undefined,
          email: formEmail.trim() || undefined,
          phone: formPhone.trim() || undefined,
          commissionRate,
        });
      }
      setShowAddModal(false);
      await load();
    } catch {
      setFormError("Failed to save worker.");
    } finally {
      setSaving(false);
    }
  };

  const handleStatusChange = async (workerId: string, status: string) => {
    try {
      await updateWorkerStatus(workerId, status);
      await load();
    } catch {
      // silently fail
    }
  };

  const handleToggleActive = async (w: Worker) => {
    try {
      await updateWorker(w.id, { active: !w.active });
      await load();
    } catch {
      // silently fail
    }
  };

  if (loading) {
    return (
      <>
        <header>
          <p className="eyebrow">Management</p>
          <div className="app-bar">
            <h1 className="app-bar__title">Workers</h1>
          </div>
        </header>
        <p className="text-muted">Loading workers...</p>
      </>
    );
  }

  return (
    <>
      <header>
        <p className="eyebrow">Management</p>
        <div className="app-bar">
          <h1 className="app-bar__title">Workers</h1>
          <Button size="sm" onClick={openAddModal}>
            + Add Worker
          </Button>
        </div>
        {error && (
          <p className="text-sm" style={{ color: "var(--color-warning)" }}>
            {error}
          </p>
        )}
      </header>

      {workers.length === 0 ? (
        <EmptyState
          icon="👤"
          title="No workers yet"
          description="Add your first worker to start assigning turns."
          action={
            <Button size="sm" onClick={openAddModal}>
              + Add Worker
            </Button>
          }
        />
      ) : (
        <div className="mgmt-grid">
          {workers.map((w) => (
            <div key={w.id} className="mgmt-card">
              <div className="mgmt-card__header">
                <span className="mgmt-card__name">
                  {w.displayName || w.user?.name}
                </span>
                <StatusPill status={w.currentStatus} />
              </div>
              <div className="mgmt-card__body">
                <div className="mgmt-card__row">
                  <span>Commission Rate</span>
                  <span>{Math.round(w.commissionRate * 100)}%</span>
                </div>
                <div className="mgmt-card__row">
                  <span>Status</span>
                  <StatusPill status={w.currentStatus} />
                </div>
                {w.user?.email && (
                  <div className="mgmt-card__row">
                    <span>Email</span>
                    <span style={{ fontSize: "var(--text-xs)" }}>
                      {w.user.email}
                    </span>
                  </div>
                )}
                {w.user?.phone && (
                  <div className="mgmt-card__row">
                    <span>Phone</span>
                    <span style={{ fontSize: "var(--text-xs)" }}>
                      {w.user.phone}
                    </span>
                  </div>
                )}
              </div>
              <div className="mgmt-card__actions">
                <Button
                  size="sm"
                  variant="secondary"
                  onClick={() => openEditModal(w)}
                >
                  Edit
                </Button>
                <Select
                  value={w.currentStatus}
                  onChange={(e) => handleStatusChange(w.id, e.target.value)}
                  options={[
                    { value: "available", label: "Available" },
                    { value: "in_service", label: "In Service" },
                    { value: "on_break", label: "On Break" },
                    { value: "off_today", label: "Off Today" },
                    { value: "appointment_only", label: "Appt Only" },
                  ]}
                  style={{ fontSize: "var(--text-sm)", minWidth: "120px" }}
                />
                <Button
                  size="sm"
                  variant={w.active ? "ghost" : "secondary"}
                  onClick={() => handleToggleActive(w)}
                >
                  {w.active ? "Deactivate" : "Activate"}
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Add / Edit Modal */}
      <Modal
        open={showAddModal}
        onClose={() => setShowAddModal(false)}
        title={editingWorker ? "Edit Worker" : "Add Worker"}
        footer={
          <>
            <Button
              variant="secondary"
              onClick={() => setShowAddModal(false)}
            >
              Cancel
            </Button>
            <Button onClick={handleSave} loading={saving}>
              {editingWorker ? "Save Changes" : "Add Worker"}
            </Button>
          </>
        }
      >
        {!editingWorker && (
          <Input
            label="Full Name"
            value={formName}
            onChange={(e) => setFormName(e.target.value)}
            placeholder="e.g. Amy Nguyen"
          />
        )}
        <Input
          label="Display Name"
          value={formDisplayName}
          onChange={(e) => setFormDisplayName(e.target.value)}
          placeholder={editingWorker ? editingWorker.displayName : "e.g. Amy"}
        />
        {!editingWorker && (
          <>
            <Input
              label="Email (optional)"
              type="email"
              value={formEmail}
              onChange={(e) => setFormEmail(e.target.value)}
              placeholder="worker@example.com"
            />
            <Input
              label="Phone (optional)"
              type="tel"
              value={formPhone}
              onChange={(e) => setFormPhone(e.target.value)}
              placeholder="555-0100"
            />
          </>
        )}
        <Input
          label="Commission Rate (%)"
          type="number"
          value={formCommissionText}
          onChange={(e) => setFormCommissionText(e.target.value)}
          min={0}
          max={100}
        />
        {formError && (
          <p className="field__error" style={{ marginTop: "var(--space-2)" }}>
            {formError}
          </p>
        )}
      </Modal>
    </>
  );
}

/* ════════════════════════════════════════
   Reports
   ════════════════════════════════════════ */

function ReportsScreen() {
  const [activeReport, setActiveReport] = useState("turns");
  const [startDate, setStartDate] = useState(() => {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    return d.toISOString().slice(0, 10);
  });
  const [endDate, setEndDate] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() + 1);
    d.setHours(0, 0, 0, 0);
    return d.toISOString().slice(0, 10);
  });
  const [loading, setLoading] = useState(false);
  const [salesSummary, setSalesSummary] = useState<Record<string, number> | null>(null);
  const [workerEarnings, setWorkerEarnings] = useState<{ workerId: string; name: string; services: number; netSalesCents: number; commissionCents: number; tipsCents: number; totalPayCents: number }[]>([]);
  const [turnDetails, setTurnDetails] = useState<TurnDetail[]>([]);
  const [eodData, setEodData] = useState<{
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
  } | null>(null);

  const reportParams = {
    start: startDate ? `${startDate}T00:00:00` : undefined,
    end: endDate ? `${endDate}T00:00:00` : undefined,
  };

  const loadSales = async () => {
    setLoading(true);
    try {
      const data = await fetchSalesReport(reportParams);
      setSalesSummary(data.summary);
    } catch { /* ignore */ }
    finally { setLoading(false); }
  };

  const loadWorkers = async () => {
    setLoading(true);
    try {
      const data = await fetchWorkerEarnings(reportParams);
      setWorkerEarnings(data.workers);
    } catch { /* ignore */ }
    finally { setLoading(false); }
  };

  const loadTurns = async () => {
    setLoading(true);
    try {
      const data = await fetchTurnDetail(reportParams);
      setTurnDetails(data.turns);
    } catch { /* ignore */ }
    finally { setLoading(false); }
  };

  const loadEod = async () => {
    setLoading(true);
    try {
      const data = await fetchEndOfDayReport(reportParams);
      setEodData(data);
    } catch { /* ignore */ }
    finally { setLoading(false); }
  };

  const refresh = () => {
    if (activeReport === "sales") loadSales();
    else if (activeReport === "workers") loadWorkers();
    else if (activeReport === "turns") loadTurns();
    else if (activeReport === "eod") loadEod();
  };

  useEffect(() => {
    refresh();
  }, [activeReport, startDate, endDate]);

  const reportLabel = startDate && endDate
    ? `${startDate} — ${endDate}`
    : "Today";

  return (
    <>
      <header>
        <p className="eyebrow">Reports</p>
        <div className="app-bar">
          <h1 className="app-bar__title">Reports</h1>
          <Button size="sm" variant="secondary" onClick={refresh} loading={loading}>Refresh</Button>
        </div>
      </header>

      {/* Date range picker */}
      <div style={{ display: "flex", gap: "var(--space-2)", marginBottom: "var(--space-4)", alignItems: "flex-end" }}>
        <Input label="Start" type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
        <Input label="End" type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} />
        <span style={{ paddingBottom: "var(--space-2)", fontSize: "var(--text-sm)", color: "var(--color-text-muted)" }}>
          {reportLabel}
        </span>
      </div>

      <Tabs
        tabs={[
          { key: "turns", label: "Turns" },
          { key: "sales", label: "Sales" },
          { key: "workers", label: "Workers" },
          { key: "eod", label: "End of Day" },
        ]}
        activeKey={activeReport}
        onChange={setActiveReport}
      />

      {loading && <p className="text-muted text-sm my-2">Loading...</p>}

      {/* ── Turn Detail Report ── */}
      {activeReport === "turns" && (
        <Card padding="lg">
          <div className="card__header">
            <h2 className="card__title">Turn Detail — {reportLabel}</h2>
            <Badge variant="info">{turnDetails.length} turns</Badge>
          </div>
          {turnDetails.length === 0 ? (
            <EmptyState icon="📋" title="No turns found" description="No turn data for the selected date range." />
          ) : (
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Worker</th><th>Customer</th><th>Services</th><th>Status</th>
                    <th>Total</th><th>Commission</th><th>Tips</th><th>Pay</th><th>Duration</th>
                  </tr>
                </thead>
                <tbody>
                  {turnDetails.map((t) => (
                    <tr key={t.id}>
                      <td><strong>{t.workerName}</strong></td>
                      <td>{t.customerName}</td>
                      <td style={{ maxWidth: "150px", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{t.services || "—"}</td>
                      <td><StatusPill status={t.status} /></td>
                      <td>{formatMoney(t.itemTotalCents)}</td>
                      <td>{formatMoney(t.commissionCents)}</td>
                      <td>{formatMoney(t.tipsCents)}</td>
                      <td><strong>{formatMoney(t.totalPayCents)}</strong></td>
                      <td>{t.durationMinutes != null ? `${t.durationMinutes}m` : "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>
      )}

      {/* ── Sales ── */}
      {activeReport === "sales" && salesSummary && (
        <>
          <div className="report-summary">
            <StatCard label="Gross Sales" value={formatMoney(salesSummary.grossServiceSalesCents || 0)} />
            <StatCard label="Discounts" value={formatMoney(salesSummary.discountTotalCents || 0)} />
            <StatCard label="Refunds" value={formatMoney(salesSummary.refundTotalCents || 0)} />
            <StatCard label="Net Sales" value={formatMoney(salesSummary.netServiceSalesCents || 0)} />
            <StatCard label="Tips" value={formatMoney(salesSummary.tipTotalCents || 0)} />
            <StatCard label="Cash" value={formatMoney(salesSummary.cashTotalCents || 0)} />
            <StatCard label="Card" value={formatMoney(salesSummary.cardTotalCents || 0)} />
            <StatCard label="Gift Card" value={formatMoney(salesSummary.giftCardTotalCents || 0)} />
          </div>
        </>
      )}
      {activeReport === "sales" && !salesSummary && !loading && (
        <EmptyState icon="📊" title="No sales data" description="Try adjusting the date range." />
      )}

      {/* ── Worker Earnings ── */}
      {activeReport === "workers" && (
        <Card padding="lg">
          <div className="card__header">
            <h2 className="card__title">Worker Earnings — {reportLabel}</h2>
          </div>
          {workerEarnings.length === 0 ? (
            <EmptyState icon="👤" title="No worker data" description="No sales recorded for workers in this period." />
          ) : (
            <div className="table-wrap">
              <table>
                <thead>
                  <tr><th>Worker</th><th>Services</th><th>Net Sales</th><th>Commission</th><th>Tips</th><th>Total Pay</th></tr>
                </thead>
                <tbody>
                  {workerEarnings.map((w) => (
                    <tr key={w.workerId}>
                      <td><strong>{w.name}</strong></td>
                      <td>{w.services}</td>
                      <td>{formatMoney(w.netSalesCents)}</td>
                      <td>{formatMoney(w.commissionCents)}</td>
                      <td>{formatMoney(w.tipsCents)}</td>
                      <td><strong>{formatMoney(w.totalPayCents)}</strong></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>
      )}

      {/* ── End of Day ── */}
      {activeReport === "eod" && eodData && (
        <>
          <div className="report-summary">
            <StatCard label="Gross Sales" value={formatMoney(eodData.grossServiceSalesCents)} />
            <StatCard label="Net Sales" value={formatMoney(eodData.netServiceSalesCents)} />
            <StatCard label="Commission Payout" value={formatMoney(eodData.workerCommissionPayoutCents)} />
            <StatCard label="Business Share" value={formatMoney(eodData.businessShareCents)} />
            <StatCard label="Tips Paid" value={formatMoney(eodData.tipTotalCents)} />
            <StatCard label="Cash" value={formatMoney(eodData.cashTotalCents)} />
            <StatCard label="Card" value={formatMoney(eodData.cardTotalCents)} />
            <StatCard label="Gift Card" value={formatMoney(eodData.giftCardTotalCents)} />
          </div>
          <Card padding="lg">
            <h2 className="card__title mb-2">End-of-Day Summary — {reportLabel}</h2>
            <p className="text-muted text-sm">All transactions reconciled for the selected period.</p>
          </Card>
        </>
      )}
      {activeReport === "eod" && !eodData && !loading && (
        <EmptyState icon="📊" title="No EOD data" description="Try adjusting the date range." />
      )}
    </>
  );
}

/* ════════════════════════════════════════
   Receipt Preview
   ════════════════════════════════════════ */
function ReceiptPreview({ items, payments, subtotal, discounts, tips, total }: {
  items: CheckoutItem[];
  payments: PaymentEntry[];
  subtotal: number;
  discounts: number;
  tips: number;
  total: number;
}) {
  return (
    <Card padding="lg" className="mt-4">
      <div className="receipt">
        <div className="receipt__header">
          <div className="receipt__salon">💅 Serenity Nail Salon</div>
          <div>123 Main Street · (555) 123-4567</div>
          <div>{new Date().toLocaleString()}</div>
          <div>Receipt #SAL-{String(Math.floor(Math.random() * 9000) + 1000)}</div>
        </div>
        <hr className="receipt__line" />
        {items.map((item, idx) => (
          <div key={idx}>
            <div className="receipt__row">
              <span>{item.serviceName}</span>
              <span>{formatMoney(item.priceCents)}</span>
            </div>
            <div className="text-sm text-muted" style={{ marginBottom: "var(--space-1)" }}>
              {item.workerName} · {item.category}
              {item.discountCents > 0 && ` · Discount: −${formatMoney(item.discountCents)}`}
              {item.tipCents > 0 && ` · Tip: ${formatMoney(item.tipCents)}`}
            </div>
          </div>
        ))}
        <hr className="receipt__line" />
        <div className="receipt__row"><span>Subtotal</span><span>{formatMoney(subtotal)}</span></div>
        {discounts > 0 && <div className="receipt__row"><span>Discounts</span><span>−{formatMoney(discounts)}</span></div>}
        {tips > 0 && <div className="receipt__row"><span>Tips</span><span>{formatMoney(tips)}</span></div>}
        <hr className="receipt__line" />
        <div className="receipt__row receipt__total"><span>Total</span><span>{formatMoney(total)}</span></div>
        <hr className="receipt__line" />
        <div style={{ fontWeight: "var(--font-semibold)", marginBottom: "var(--space-2)" }}>Payment</div>
        {payments.map((p, i) => (
          <div key={i} className="receipt__row">
            <span>{methodLabel(p.method)}</span>
            <span>{formatMoney(p.amountCents)}</span>
          </div>
        ))}
        <hr className="receipt__line" />
        <div style={{ textAlign: "center", color: "var(--color-text-muted)", fontSize: "var(--text-xs)" }}>
          Thank you for visiting! 💅
        </div>
      </div>
    </Card>
  );
}

/* ════════════════════════════════════════
   Session Grid — Service-by-Worker Matrix
   ════════════════════════════════════════ */

function SessionGrid({ workers, onToggleTurnCount }: {
  workers: TurnDashboardWorker[];
  onToggleTurnCount: (turnId: string, newCount: number) => Promise<void>;
}) {
  if (workers.length === 0 || workers.every((w) => w.turns.length === 0)) {
    return (
      <Card padding="lg" className="mt-4">
        <div className="card__header">
          <h2 className="card__title">🧩 Session Grid</h2>
        </div>
        <EmptyState icon="📊" title="No turns yet" description="Assign workers to see the session matrix." />
      </Card>
    );
  }

  // Collect all unique category names across all workers' turns and assign colors
  const catNameSet = new Set<string>();
  workers.forEach((w) => w.turns.forEach((t) => t.services.forEach((s) => catNameSet.add(s.categoryName))));
  const categories = Array.from(catNameSet).sort();
  const catColorMap = new Map<string, string>(categories.map((name, i) => [name, CATEGORY_COLORS[i % CATEGORY_COLORS.length]]));

  // Max turns across workers
  const maxTurns = Math.max(...workers.map((w) => w.turns.length), 1);

  // Build row data: each row is a "turn position" across workers
  const rows: { turnIdx: number }[] = [];
  for (let i = 0; i < maxTurns; i++) {
    rows.push({ turnIdx: i });
  }

  return (
    <Card padding="lg" className="mt-4">
      <div className="card__header">
        <h2 className="card__title">🧩 Session Grid — Today's Turns</h2>
        <span style={{ fontSize: "var(--text-xs)", color: "var(--color-text-muted)" }}>
          Click 0/1 to toggle turn count
        </span>
      </div>
      <div style={{ overflowX: "auto", fontSize: "var(--text-xs)" }}>
        <table style={{ borderCollapse: "collapse", width: "100%", minWidth: "600px" }}>
          <thead>
            <tr>
              <th style={{ padding: "var(--space-2)", borderBottom: "2px solid var(--color-border)", textAlign: "left", minWidth: "60px" }}></th>
              {workers.map((w) => (
                <th key={w.workerId} style={{ padding: "var(--space-2)", borderBottom: "2px solid var(--color-border)", textAlign: "center", fontWeight: "var(--font-bold)", fontSize: "var(--text-sm)" }}>
                  {w.name}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row, rowIdx) => (
              <tr key={rowIdx} style={{ borderBottom: "1px solid var(--color-border)" }}>
                <td style={{ padding: "var(--space-1) var(--space-2)", color: "var(--color-text-muted)", fontSize: "var(--text-xs)", whiteSpace: "nowrap" }}>
                  {rowIdx + 1}
                </td>
                {workers.map((w) => {
                  const turn = w.turns[rowIdx];
                  if (!turn) {
                    return <td key={`${w.workerId}-${rowIdx}`} style={{ padding: "var(--space-2)", textAlign: "center", color: "var(--color-text-muted)" }}>—</td>;
                  }
                  const serviceNames = turn.services.map((s) => s.serviceName).join(", ");
                  const catName = turn.services[0]?.categoryName ?? "—";
                  const bgColor = catColorMap.get(catName) ?? "#f0f0f0";
                  const currentCount = turn.turnCount;

                  return (
                    <td key={`${w.workerId}-${rowIdx}`} style={{ padding: "var(--space-1)", verticalAlign: "top" }}>
                      <div
                        style={{
                          background: bgColor,
                          borderRadius: "var(--radius-sm)",
                          padding: "var(--space-2)",
                          textAlign: "center",
                          minHeight: "48px",
                          display: "flex",
                          flexDirection: "column",
                          justifyContent: "center",
                          gap: "var(--space-1)",
                          border: "1px solid transparent",
                        }}
                      >
                        <div style={{ fontWeight: "var(--font-semibold)", fontSize: "var(--text-xs)" }} title={serviceNames}>
                          {serviceNames || "—"}
                        </div>
                        <div style={{ fontSize: "var(--text-xs)", color: "var(--color-text-muted)" }}>
                          {turn.customerName} · {turn.status.replaceAll("_", " ")}
                        </div>
                        <button
                          onClick={() => {
                            const newCount = currentCount === 0 ? 1 : 0;
                            void onToggleTurnCount(turn.turnId, newCount);
                          }}
                          style={{
                            background: currentCount === 0 ? "var(--color-danger-light, #fce4ec)" : "var(--color-success-light, #e8f5e9)",
                            border: currentCount === 0 ? "2px solid var(--color-danger)" : "2px solid var(--color-success)",
                            borderRadius: "var(--radius-full)",
                            cursor: "pointer",
                            fontSize: "var(--text-xs)",
                            fontWeight: "var(--font-bold)",
                            padding: "1px 12px",
                            minWidth: "32px",
                            alignSelf: "center",
                            transition: "all 0.15s",
                          }}
                          title={`Click to toggle turn count (currently ${currentCount})`}
                        >
                          {currentCount === 0 ? "0 ✗" : "1 ✓"}
                        </button>
                      </div>
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr style={{ borderTop: "2px solid var(--color-border)", fontWeight: "var(--font-bold)" }}>
              <td style={{ padding: "var(--space-2)", fontSize: "var(--text-sm)" }}>Total</td>
              {workers.map((w) => (
                <td key={`${w.workerId}-total`} style={{ padding: "var(--space-2)", textAlign: "center", fontSize: "var(--text-sm)", color: "var(--color-primary)" }}>
                  {w.turnsTakenToday}
                </td>
              ))}
            </tr>
          </tfoot>
        </table>
      </div>
    </Card>
  );
}

/* ════════════════════════════════════════
   Helpers
   ════════════════════════════════════════ */

function formatMoney(cents: number) {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(cents / 100);
}

function timeAgo(iso: string) {
  const diff = Date.now() - new Date(iso).getTime();
  const min = Math.floor(diff / 60000);
  if (min < 1) return "Just now";
  if (min < 60) return `${min}m ago`;
  const hrs = Math.floor(min / 60);
  return `${hrs}h ago`;
}

function methodLabel(method: string) {
  return ({ cash: "Cash", card: "Card", gift_card: "Gift Card" } as Record<string, string>)[method] ?? method;
}

/* Worker turn helpers */

function sortWorkersForFloor(workers: TurnDashboardWorker[]): TurnDashboardWorker[] {
  const statusOrder: Record<string, number> = {
    available: 0,
    in_service: 1,
    on_break: 2,
    off_today: 3,
  };
  return [...workers].sort((a, b) => {
    const orderA = statusOrder[a.status] ?? 99;
    const orderB = statusOrder[b.status] ?? 99;
    if (orderA !== orderB) return orderA - orderB;
    // Within same status group, sort by suggestion rank (lower = first)
    const rankA = a.suggestionRank ?? 999;
    const rankB = b.suggestionRank ?? 999;
    return rankA - rankB;
  });
}

function statusBorderClass(status: string): string {
  if (status === "available") return "worker-card--available";
  if (status === "in_service") return "worker-card--in-service";
  if (status === "on_break") return "worker-card--on-break";
  if (status === "off_today") return "worker-card--off-today";
  return "";
}

function statusAvatarClass(status: string): string {
  if (status === "available") return "worker-card__avatar--available";
  if (status === "in_service") return "worker-card__avatar--in-service";
  if (status === "on_break") return "worker-card__avatar--on-break";
  if (status === "off_today") return "worker-card__avatar--off-today";
  return "";
}

const CATEGORY_COLORS = [
  "#e8f5e9", "#e3f2fd", "#fff3e0", "#fce4ec", "#f3e5f5",
  "#e0f2f1", "#fff8e1", "#fbe9e7", "#e8eaf6", "#f1f8e9",
  "#e0f7fa", "#f9fbe7", "#efebe9", "#eceff1", "#f5f5f5",
];

/* ════════════════════════════════════════
   Mock Data
   ════════════════════════════════════════ */

const MOCK_WORKERS_DASHBOARD: TurnDashboardWorker[] = [
  { workerId: "w1", name: "Amy", status: "available", turnsTakenToday: 3, lastTurnEndedAt: "2026-05-26T13:20:00-05:00", activeTurn: null, salesTodayCents: 24000, tipsTodayCents: 4500, suggestionRank: 1, turns: [] },
  { workerId: "w2", name: "Bella", status: "in_service", turnsTakenToday: 2, lastTurnEndedAt: null, activeTurn: { customerName: "Mary" }, salesTodayCents: 18000, tipsTodayCents: 3200, suggestionRank: null, turns: [] },
  { workerId: "w3", name: "Coco", status: "available", turnsTakenToday: 1, lastTurnEndedAt: "2026-05-26T11:00:00-05:00", activeTurn: null, salesTodayCents: 8000, tipsTodayCents: 1000, suggestionRank: 2, turns: [] },
  { workerId: "w4", name: "Daisy", status: "on_break", turnsTakenToday: 2, lastTurnEndedAt: "2026-05-26T12:00:00-05:00", activeTurn: null, salesTodayCents: 14000, tipsTodayCents: 2800, suggestionRank: null, turns: [] },
];

const MOCK_CHECKINS: Checkin[] = [
  { id: "c1", status: "waiting", notes: "Full set acrylic", checkedInAt: new Date(Date.now() - 15 * 60000).toISOString(), customer: { name: "Sarah Johnson", phone: "555-0101" } },
  { id: "c2", status: "waiting", notes: "Gel pedicure", checkedInAt: new Date(Date.now() - 5 * 60000).toISOString(), customer: { name: "Kim Lee", phone: "555-0102" } },
  { id: "c3", status: "waiting", notes: "Walk-in manicure", checkedInAt: new Date(Date.now() - 2 * 60000).toISOString(), customer: { name: "Jessica M.", phone: "555-0103" } },
];

const MOCK_CHECKOUT_READY: Checkin[] = [
  { id: "c4", status: "ready_for_checkout", notes: "Deluxe pedicure", checkedInAt: new Date(Date.now() - 90 * 60000).toISOString(), customer: { name: "Mary Tran", phone: "555-0104" } },
];

export const MOCK_SALE_ITEMS: CheckoutItem[] = [
  { serviceName: "Deluxe Pedicure", workerName: "Amy", category: "Pedicure", priceCents: 5500, discountCents: 500, tipCents: 1000 },
];

export const MOCK_SALES_REPORT = [
  { id: "1", time: "9:15 AM", receipt: "1012", customer: "Sarah Johnson", services: "2", total: 8000, status: "paid" },
  { id: "2", time: "10:00 AM", receipt: "1013", customer: "Kim Lee", services: "1", total: 5500, status: "paid" },
  { id: "3", time: "11:30 AM", receipt: "1014", customer: "Lisa Park", services: "3", total: 12000, status: "paid" },
  { id: "4", time: "1:00 PM", receipt: "1015", customer: "Mary Tran", services: "1", total: 5500, status: "paid" },
  { id: "5", time: "2:20 PM", receipt: "1016", customer: "Jessica M.", services: "1", total: 3000, status: "paid" },
];

export const MOCK_WORKER_EARNINGS = [
  { name: "Amy Nguyen", services: 4, netSales: 22500, commission: 13500, tips: 4500, totalPay: 18000 },
  { name: "Bella Tran", services: 3, netSales: 17000, commission: 9350, tips: 3200, totalPay: 12550 },
  { name: "Coco Le", services: 2, netSales: 7000, commission: 4200, tips: 1000, totalPay: 5200 },
  { name: "Daisy Pham", services: 3, netSales: 14000, commission: 7700, tips: 2800, totalPay: 10500 },
];

export const MOCK_TURN_REPORT = [
  { name: "Amy Nguyen", taken: 4, completed: 4, skipped: 0, avgDuration: "45 min" },
  { name: "Bella Tran", taken: 3, completed: 3, skipped: 0, avgDuration: "55 min" },
  { name: "Coco Le", taken: 2, completed: 2, skipped: 0, avgDuration: "38 min" },
  { name: "Daisy Pham", taken: 3, completed: 2, skipped: 1, avgDuration: "50 min" },
  { name: "Elena Vo", taken: 0, completed: 0, skipped: 0, avgDuration: "-" },
];

/* ════════════════════════════════════════
   Mount
   ════════════════════════════════════════ */

createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
