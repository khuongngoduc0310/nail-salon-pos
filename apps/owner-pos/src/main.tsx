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
  addCardPayment,
  completeSale,
  fetchCurrentSession,
  openSession,
  closeSession,
  workerCheckIn,
  workerClockOut,
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
  type SalesReportSummary,
  type SalesReportTicket,
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
  const [apiOffline, setApiOffline] = useState(false);
  const [showWorkerCheckIn, setShowWorkerCheckIn] = useState(false);
  const [showTurnMatrix, setShowTurnMatrix] = useState(false);
  const [now, setNow] = useState(() => new Date());

  const refreshFloor = async () => {
    const sess = await fetchCurrentSession();
    if (!sess) {
      setWorkers([]);
      setCheckins([]);
      setCheckoutCheckins([]);
      setCheckedInWorkers([]);
      setSelectedCheckin(null);
      setAssignModal(false);
      setSession(null);
      setStatus("No session");
      setApiOffline(false);
      return;
    }
    const [dash, waiting, ready, ciWorkers] = await Promise.all([
      fetchTurnDashboard({ currentSessionOnly: true }),
      fetchWaitingCheckins(),
      fetchReadyForCheckoutCheckins(),
      fetchCheckedInWorkers().catch(() => [] as CheckedInWorker[]),
    ]);
    setWorkers(dash.workers);
    setCheckins(waiting);
    setCheckoutCheckins(ready);
    setSession(sess);
    setCheckedInWorkers(ciWorkers);
    setStatus(sess ? "Session open" : "No session");
    setApiOffline(false);
  };

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        await refreshFloor();
      } catch {
        if (!cancelled) {
          setWorkers([]);
          setCheckins([]);
          setCheckoutCheckins([]);
          setCheckedInWorkers([]);
          setSession(null);
          setApiOffline(true);
          setStatus("API offline");
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
        await refreshFloor();
      } catch { /* silent */ }
    };

    const connectWs = () => {
      try {
        ws = new WebSocket(`${location.protocol === "https:" ? "wss" : "ws"}://${location.hostname}:4000/ws`);
        ws.onmessage = () => { void refreshAll(); };
        ws.onclose = () => { reconnect = setTimeout(connectWs, 3000); };
        ws.onerror = () => { /* error fires before close; let onclose handle reconnect */ };
      } catch { /* ignore */ }
    };

    if (session) connectWs();
    return () => {
      if (reconnect) clearTimeout(reconnect);
      if (ws) {
        ws.onclose = null;
        if (ws.readyState === WebSocket.OPEN) ws.close();
      }
    };
  }, [session]);

  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 30000);
    return () => clearInterval(timer);
  }, []);

  const handleWorkerClockToggle = async (workerId: string) => {
    const existing = checkedInWorkers.find((c) => c.workerId === workerId);
    if (existing && !existing.checkedOutAt) {
      try {
        const w = await workerClockOut(workerId);
        setCheckedInWorkers((prev) => prev.map((c) => (c.workerId === workerId ? w : c)));
        await refreshFloor();
      } catch (error) {
        alert(error instanceof Error ? error.message : "Failed to clock out worker");
      }
    } else {
      try {
        const w = await workerCheckIn(workerId);
        setCheckedInWorkers((prev) => {
          const filtered = prev.filter((c) => c.workerId !== workerId);
          return [...filtered, w];
        });
        await refreshFloor();
      } catch (error) {
        alert(error instanceof Error ? error.message : "Failed to clock in worker");
      }
    }
  };
  const checkedInSet = new Set(
    checkedInWorkers.filter((c) => !c.checkedOutAt).map((c) => c.workerId),
  );

  const clockedOutSet = new Set(
    checkedInWorkers.filter((c) => c.checkedOutAt).map((c) => c.workerId),
  );

  const handleStartDay = async () => {
    try {
      const s = await openSession({});
      setSession(s);
      setStatus("Session open");
      setApiOffline(false);
      await refreshFloor();
    } catch {
      setApiOffline(true);
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
      setStatus("No session");
      setWorkers([]);
      setCheckins([]);
      setCheckoutCheckins([]);
      setCheckedInWorkers([]);
      setSelectedCheckin(null);
      setAssignModal(false);
    } catch {
      // silent
    } finally {
      setClosingLoading(false);
    }
  };

  const activeTurns = workers.filter((w) => w.activeTurn).length;
  const readyCount = checkoutCheckins.length;
  const availableCount = workers.filter((w) => w.status === "available" && checkedInSet.has(w.workerId)).length;
  const totalSales = workers.reduce((sum, worker) => sum + worker.salesTodayCents, 0);
  const totalTips = workers.reduce((sum, worker) => sum + worker.tipsTodayCents, 0);
  const recommendedWorker = getRecommendedWorker(workers, checkedInSet);

  const handleAssignWorker = async (workerId: string) => {
    if (!selectedCheckin) return;
    try {
      await assignTurn({
        checkinId: selectedCheckin.id,
        workerId,
        turnType: "manual",
        suggestedWorkerId: recommendedWorker?.workerId,
      });
      setSelectedCheckin(null);
      setAssignModal(false);
      await refreshFloor();
    } catch {
      setApiOffline(true);
    }
  };

  const handleStartSale = async (checkinId: string) => {
    await createSaleForCheckin(checkinId).catch(() => null);
    onStartCheckout();
  };

  return (
    <div className="floor-page">
      <FloorSessionBar
        session={session}
        status={status}
        now={now}
        apiOffline={apiOffline}
        onStartDay={handleStartDay}
        onRequestEndDay={() => {
          requestOwnerPin(
            "Owner PIN Required",
            "Enter owner PIN to end the day and close the current session.",
            () => {
              setShowCloseModal(true);
              setClosingCashText("");
            }
          );
        }}
      />

      {apiOffline && (
        <div className="floor-alert floor-alert--offline">
          <strong>API offline.</strong>
          <span>Live floor data is unavailable. Check the local API before assigning turns.</span>
        </div>
      )}

      <div className="floor-legacy-hidden">
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

      {!session ? (
        <NoSessionFloorState apiOffline={apiOffline} onStartDay={handleStartDay} />
      ) : (
        <>
          <FloorKpiStrip
            waitingCount={checkins.length}
            availableCount={availableCount}
            inServiceCount={activeTurns}
            readyCount={readyCount}
          />

          <WorkerCheckInPanel
            open={showWorkerCheckIn}
            workers={workers}
            checkedInWorkers={checkedInWorkers}
            onToggle={() => setShowWorkerCheckIn((value) => !value)}
            onClockToggle={handleWorkerClockToggle}
          />

          <div className="floor-workspace">
            <WaitingQueuePanel
              checkins={checkins}
              selectedCheckinId={selectedCheckin?.id ?? null}
              recommendedWorkerName={recommendedWorker?.name ?? null}
              onSelect={(checkin) => setSelectedCheckin(checkin)}
              onAssignRecommended={() => {
                if (recommendedWorker) void handleAssignWorker(recommendedWorker.workerId);
              }}
              onOpenFallback={() => setAssignModal(true)}
            />
            <WorkerBoard
              workers={workers}
              checkedInSet={checkedInSet}
              selectedCustomerName={selectedCheckin?.customer?.name ?? (selectedCheckin ? "Walk-in" : null)}
              recommendedWorkerId={recommendedWorker?.workerId ?? null}
              onAssign={handleAssignWorker}
            />
            <ReadyCheckoutRail
              checkins={checkoutCheckins}
              onStartSale={(checkinId) => { void handleStartSale(checkinId); }}
            />
          </div>

          <TurnMatrixPanel
            open={showTurnMatrix}
            workers={workers}
            onToggleOpen={() => setShowTurnMatrix((value) => !value)}
            onToggleTurnCount={async (turnId, newCount) => {
              await updateTurnCount(turnId, newCount).catch(() => {});
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
        </>
      )}

      <div className="floor-legacy-hidden">

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
                  onClick={() => { void handleWorkerClockToggle(w.workerId); }}
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

      </div>

      {/* Assign worker modal */}
      {selectedCheckin && (
        <Modal open={assignModal} onClose={() => setAssignModal(false)} title={`Assign — ${selectedCheckin.customer?.name ?? "Walk-in"}`} footer={
          <Button variant="secondary" onClick={() => setAssignModal(false)}>Cancel</Button>
        }>
          <p className="text-muted text-sm mb-4">Select a worker to assign this customer.</p>
          <div className="checkin-list">
            {workers.filter((w) => w.checkedIn && w.status !== "off_today" && w.status !== "on_break" && w.status !== "in_service").map((w) => (
              <div
                key={w.workerId}
                className="checkin-item"
                style={{ cursor: "pointer" }}
                onClick={() => { void handleAssignWorker(w.workerId); }}
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
    </div>
  );
}

/* ════════════════════════════════════════
   Assign Customers Screen
   ════════════════════════════════════════ */

function FloorSessionBar({
  session,
  status,
  now,
  apiOffline,
  onStartDay,
  onRequestEndDay,
}: {
  session: Session | null;
  status: string;
  now: Date;
  apiOffline: boolean;
  onStartDay: () => void;
  onRequestEndDay: () => void;
}) {
  return (
    <header className="floor-topbar">
      <div className="floor-topbar__title">
        <p className="eyebrow">Owner POS</p>
        <h1 className="floor-title">Salon Floor</h1>
      </div>
      <div className="floor-topbar__meta">
        <span className="floor-clock">
          {now.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}
        </span>
        <Badge variant={apiOffline ? "danger" : session ? "success" : "warning"}>
          {apiOffline ? "Offline" : status}
        </Badge>
        {session ? (
          <>
            <span className="floor-session-time">
              Open {new Date(session.openedAt).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}
            </span>
            <Button size="sm" variant="ghost" onClick={onRequestEndDay}>
              End Day
            </Button>
          </>
        ) : (
          <Button size="md" onClick={onStartDay}>
            Start Day
          </Button>
        )}
      </div>
    </header>
  );
}

function NoSessionFloorState({
  apiOffline,
  onStartDay,
}: {
  apiOffline: boolean;
  onStartDay: () => void;
}) {
  return (
    <Card padding="lg" className="floor-start-card">
      <EmptyState
        icon="Open"
        title={apiOffline ? "Local API offline" : "Start the day"}
        description={
          apiOffline
            ? "The Floor page only shows live session data. Start the local API before opening the floor."
            : "Open a salon session to load workers, the waiting queue, and checkout-ready customers."
        }
        action={
          apiOffline ? null : (
            <Button size="lg" onClick={onStartDay}>
              Start Day
            </Button>
          )
        }
      />
    </Card>
  );
}

function FloorKpiStrip({
  waitingCount,
  availableCount,
  inServiceCount,
  readyCount,
}: {
  waitingCount: number;
  availableCount: number;
  inServiceCount: number;
  readyCount: number;
}) {
  return (
    <section className="floor-kpis" aria-label="Floor assignment summary">
      <FloorKpi label="Waiting" value={waitingCount} tone="warning" />
      <FloorKpi label="Available" value={availableCount} tone="success" />
      <FloorKpi label="In Service" value={inServiceCount} tone="info" />
      <FloorKpi label="Ready" value={readyCount} tone="success" />
    </section>
  );
}

function FloorKpi({
  label,
  value,
  tone,
}: {
  label: string;
  value: number;
  tone: "success" | "warning" | "info";
}) {
  return (
    <div className={`floor-kpi floor-kpi--${tone}`}>
      <span className="floor-kpi__label">{label}</span>
      <strong className="floor-kpi__value">{value}</strong>
    </div>
  );
}

function WorkerCheckInPanel({
  open,
  workers,
  checkedInWorkers,
  onToggle,
  onClockToggle,
}: {
  open: boolean;
  workers: TurnDashboardWorker[];
  checkedInWorkers: CheckedInWorker[];
  onToggle: () => void;
  onClockToggle: (workerId: string) => void;
}) {
  const checkedInSet = new Set(
    checkedInWorkers.filter((c) => !c.checkedOutAt).map((worker) => worker.workerId),
  );
  const clockedOutSet = new Set(
    checkedInWorkers.filter((c) => c.checkedOutAt).map((worker) => worker.workerId),
  );
  return (
    <Card padding="md" className="floor-collapse">
      <button className="floor-collapse__header" type="button" onClick={onToggle} aria-expanded={open}>
        <span>
          <strong>Worker Clock In / Out</strong>
          <small>{checkedInSet.size}/{workers.length} clocked in</small>
        </span>
        <Badge variant={open ? "info" : "default"}>{open ? "Hide" : "Show"}</Badge>
      </button>
      {open && (
        <div className="floor-worker-checkin">
          {workers.length === 0 ? (
            <p className="text-muted text-sm">No workers loaded for this session.</p>
          ) : (
            workers.map((worker) => {
              const isClockedIn = checkedInSet.has(worker.workerId);
              const isClockedOut = clockedOutSet.has(worker.workerId);
              const entry = checkedInWorkers.find((e) => e.workerId === worker.workerId);
              return (
                <button
                  key={worker.workerId}
                  className={`floor-checkin-chip ${isClockedIn ? "floor-checkin-chip--checked" : ""} ${isClockedOut ? "floor-checkin-chip--clocked-out" : ""}`}
                  type="button"
                  disabled={worker.status === "off_today"}
                  onClick={() => onClockToggle(worker.workerId)}
                >
                  <span>{worker.name}</span>
                  <small>
                    {isClockedIn && entry
                      ? `In ${new Date(entry.checkedInAt).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}`
                      : isClockedOut
                        ? "Clocked out"
                        : worker.status === "off_today"
                          ? "Off today"
                          : "Tap to clock in"}
                  </small>
                </button>
              );
            })
          )}
        </div>
      )}
    </Card>
  );
}

function WaitingQueuePanel({
  checkins,
  selectedCheckinId,
  recommendedWorkerName,
  onSelect,
  onAssignRecommended,
  onOpenFallback,
}: {
  checkins: Checkin[];
  selectedCheckinId: string | null;
  recommendedWorkerName: string | null;
  onSelect: (checkin: Checkin) => void;
  onAssignRecommended: () => void;
  onOpenFallback: () => void;
}) {
  return (
    <Card padding="lg" className="floor-panel floor-panel--queue">
      <div className="card__header">
        <div>
          <p className="eyebrow">Primary workflow</p>
          <h2 className="card__title">Waiting Queue</h2>
        </div>
        <Badge variant="warning">{checkins.length}</Badge>
      </div>
      {checkins.length === 0 ? (
        <EmptyState icon="Queue" title="No customers waiting" description="Waiting check-ins appear here after the day is started." />
      ) : (
        <div className="floor-queue-list">
          {checkins.map((checkin) => {
            const selected = selectedCheckinId === checkin.id;
            return (
              <div
                key={checkin.id}
                role="button"
                tabIndex={0}
                className={`floor-queue-card ${selected ? "floor-queue-card--selected" : ""}`}
                onClick={() => onSelect(checkin)}
                onKeyDown={(event) => {
                  if (event.key === "Enter" || event.key === " ") {
                    event.preventDefault();
                    onSelect(checkin);
                  }
                }}
              >
                <span className="floor-queue-card__main">
                  <strong>{checkin.customer?.name ?? "Walk-in"}</strong>
                  <small>{checkin.notes || "No service request noted"}</small>
                </span>
                <span className="floor-queue-card__meta">
                  <span>{timeAgo(checkin.checkedInAt)}</span>
                  <StatusPill status={checkin.status} />
                </span>
                {selected && (
                  <span className="floor-queue-card__actions">
                    <Button
                      size="sm"
                      onClick={(event) => {
                        event.stopPropagation();
                        onAssignRecommended();
                      }}
                      disabled={!recommendedWorkerName}
                    >
                      Assign {recommendedWorkerName ?? "Worker"}
                    </Button>
                    <Button
                      size="sm"
                      variant="secondary"
                      onClick={(event) => {
                        event.stopPropagation();
                        onOpenFallback();
                      }}
                    >
                      Choose
                    </Button>
                  </span>
                )}
              </div>
            );
          })}
        </div>
      )}
    </Card>
  );
}

function WorkerBoard({
  workers,
  checkedInSet,
  selectedCustomerName,
  recommendedWorkerId,
  onAssign,
}: {
  workers: TurnDashboardWorker[];
  checkedInSet: Set<string>;
  selectedCustomerName: string | null;
  recommendedWorkerId: string | null;
  onAssign: (workerId: string) => void;
}) {
  const groups = [
    { status: "available", label: "Available" },
    { status: "in_service", label: "In Service" },
    { status: "on_break", label: "On Break" },
    { status: "off_today", label: "Off Today" },
  ];

  return (
    <Card padding="lg" className="floor-panel floor-panel--workers">
      <div className="card__header">
        <div>
          <p className="eyebrow">{selectedCustomerName ? `Assigning ${selectedCustomerName}` : "Worker status"}</p>
          <h2 className="card__title">Worker Board</h2>
        </div>
        <Badge variant="info">{workers.length}</Badge>
      </div>
      {workers.length === 0 ? (
        <EmptyState icon="Staff" title="No workers loaded" description="Start a session and check the local API to show worker status." />
      ) : (
        <div className="floor-worker-groups">
          {groups.map((group) => {
            const groupedWorkers = sortWorkersForFloor(workers).filter((worker) => worker.status === group.status);
            if (groupedWorkers.length === 0) return null;
            return (
              <section key={group.status} className="floor-worker-group">
                <div className="floor-worker-group__header">
                  <span>{group.label}</span>
                  <Badge variant="default">{groupedWorkers.length}</Badge>
                </div>
                <div className="floor-worker-list">
                  {groupedWorkers.map((worker) => (
                    <FloorWorkerCard
                      key={worker.workerId}
                      worker={worker}
                      checkedIn={checkedInSet.has(worker.workerId)}
                      selectedCustomerName={selectedCustomerName}
                      recommended={recommendedWorkerId === worker.workerId}
                      onAssign={onAssign}
                    />
                  ))}
                </div>
              </section>
            );
          })}
        </div>
      )}
    </Card>
  );
}

function FloorWorkerCard({
  worker,
  checkedIn,
  selectedCustomerName,
  recommended,
  onAssign,
}: {
  worker: TurnDashboardWorker;
  checkedIn: boolean;
  selectedCustomerName: string | null;
  recommended: boolean;
  onAssign: (workerId: string) => void;
}) {
  const activeTurn = worker.activeTurn as { customerName?: string; serviceName?: string; startedAt?: string } | null;
  const assignable = Boolean(selectedCustomerName && worker.status === "available" && checkedIn);

  return (
    <button
      type="button"
      className={[
        "floor-worker-card",
        assignable ? "floor-worker-card--assignable" : "",
        recommended ? "floor-worker-card--recommended" : "",
      ].filter(Boolean).join(" ")}
      disabled={!assignable}
      onClick={() => onAssign(worker.workerId)}
    >
      <span className="floor-worker-card__top">
        <span className="floor-worker-card__identity">
          <span className={`worker-card__avatar ${statusAvatarClass(worker.status)}`}>
            {(worker.name || "?")[0].toUpperCase()}
          </span>
          <span className="floor-worker-card__name-stack">
            <strong>{worker.name}</strong>
            <small>{checkedIn ? "Checked in" : "Not checked in"}</small>
          </span>
        </span>
        <span className="floor-worker-card__badges">
          {recommended && <Badge variant="success">Recommended</Badge>}
          <StatusPill status={worker.status} />
        </span>
      </span>
      <span className="floor-worker-card__stats">
        <span>{worker.turnsTakenToday} turns</span>
        <span>{worker.lastTurnEndedAt ? `Last ${timeAgo(worker.lastTurnEndedAt)}` : "No completed turns"}</span>
        {worker.suggestionRank != null && <span>Rank #{worker.suggestionRank}</span>}
      </span>
      {activeTurn && (
        <span className="floor-worker-card__active">
          <strong>{activeTurn.customerName || "Customer"}</strong>
          <small>{activeTurn.serviceName || "Service in progress"}</small>
        </span>
      )}
      {assignable && (
        <span className="floor-worker-card__cta">
          Tap to assign{selectedCustomerName ? ` ${selectedCustomerName}` : ""}
        </span>
      )}
    </button>
  );
}

function ReadyCheckoutRail({
  checkins,
  onStartSale,
}: {
  checkins: Checkin[];
  onStartSale: (checkinId: string) => void;
}) {
  return (
    <Card padding="lg" className="floor-panel floor-panel--checkout">
      <div className="card__header">
        <h2 className="card__title">Ready for Checkout</h2>
        <Badge variant="success">{checkins.length}</Badge>
      </div>
      {checkins.length === 0 ? (
        <EmptyState icon="Sale" title="None ready" description="Completed turns appear here for checkout." />
      ) : (
        <div className="floor-checkout-list">
          {checkins.map((checkin) => (
            <div key={checkin.id} className="floor-checkout-item">
              <div>
                <strong>{checkin.customer?.name ?? "Walk-in"}</strong>
                <small>{timeAgo(checkin.checkedInAt)}</small>
              </div>
              <Button size="sm" onClick={() => onStartSale(checkin.id)}>
                Start Sale
              </Button>
            </div>
          ))}
        </div>
      )}
    </Card>
  );
}

function TurnMatrixPanel({
  open,
  workers,
  onToggleOpen,
  onToggleTurnCount,
}: {
  open: boolean;
  workers: TurnDashboardWorker[];
  onToggleOpen: () => void;
  onToggleTurnCount: (turnId: string, newCount: number) => Promise<void>;
}) {
  return (
    <Card padding="md" className="floor-collapse">
      <button className="floor-collapse__header" type="button" onClick={onToggleOpen} aria-expanded={open}>
        <span>
          <strong>Turn Matrix</strong>
          <small>Detailed service-by-worker view</small>
        </span>
        <Badge variant={open ? "info" : "default"}>{open ? "Hide" : "Show"}</Badge>
      </button>
      {open && (
        <div className="floor-turn-matrix">
          <SessionGrid workers={workers} onToggleTurnCount={onToggleTurnCount} />
        </div>
      )}
    </Card>
  );
}

function getRecommendedWorker(workers: TurnDashboardWorker[], checkedInSet: Set<string>) {
  const availableWorkers = workers.filter((worker) => worker.status === "available" && checkedInSet.has(worker.workerId));
  const ranked = availableWorkers.filter((worker) => worker.suggestionRank != null);
  if (ranked.length > 0) {
    return [...ranked].sort((a, b) => (a.suggestionRank ?? 999) - (b.suggestionRank ?? 999))[0] ?? null;
  }
  return sortWorkersForFloor(availableWorkers)[0] ?? null;
}

type AssignWorker = {
  id: string;
  name: string;
  status: "available" | "in_service" | "on_break" | "off_today" | "unavailable";
  checkedIn: boolean;
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
            checkedIn: w.checkedIn,
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
  const availableCount = workers.filter((w) => w.status === "available" && w.checkedIn).length;
  const inServiceCount = workers.filter((w) => w.status === "in_service").length;
  const onBreakCount = workers.filter((w) => w.status === "on_break").length;

  // Calculate average wait time in minutes from mock data
  const avgWait = customers.length > 0 ? "8m" : "—";

  const selectedCustomerData = customers.find((c) => c.id === selectedCustomer) ?? null;

  // Next available worker based on rotation
  const nextAvailableWorker = workers
    .filter((w) => w.status === "available" && w.checkedIn && w.rotationRank != null)
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
    if (!w || w.status !== "available" || !w.checkedIn) return;

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
                  const isAvailable = w.status === "available" && w.checkedIn;
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
                            {!w.checkedIn ? "Clocked Out" : w.status === "available" ? "Available" : w.status === "in_service" ? "In Service" : w.status === "on_break" ? "On Break" : w.status === "off_today" ? "Off Today" : "Unavailable"}
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
  { id: "w1", name: "Bella", status: "available", checkedIn: true, rotationRank: 1, serviceCount: 0, services: [] },
  { id: "w2", name: "Coco", status: "available", checkedIn: true, rotationRank: 2, serviceCount: 0, services: [] },
  { id: "w3", name: "Daisy", status: "available", checkedIn: true, rotationRank: 3, serviceCount: 0, services: [] },
  { id: "w4", name: "Amy", status: "on_break", checkedIn: true, rotationRank: null, serviceCount: 0, services: [] },
];

/* ════════════════════════════════════════
   Checkout Screen — 4-column iPad layout
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

type CheckoutMode = "active" | "done";

function CheckoutScreen({ onBack }: { onBack: () => void }) {
  const [mode, setMode] = useState<CheckoutMode>("active");
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
  const [hasStarted, setHasStarted] = useState(false);
  const [activeCategory, setActiveCategory] = useState("All");

  const subtotal = items.reduce((s, i) => s + i.priceCents, 0);
  const discounts = items.reduce((s, i) => s + i.discountCents, 0);
  const tips = items.reduce((s, i) => s + i.tipCents, 0);
  const total = Math.round(subtotal + tips - discounts);
  const paid = Math.round(payments.reduce((s, p) => s + p.amountCents, 0));
  const remaining = Math.max(0, total - paid);

  const selectedWorker = workers.find((w) => w.id === selectedWorkerId) ?? null;
  const selectedWorkerName = selectedWorker
    ? (selectedWorker.displayName || selectedWorker.user?.name || "Worker")
    : null;

  const categoryNames = ["All", ...Array.from(new Set(services.map((s) => s.category?.name).filter(Boolean)))] as string[];
  const filteredServices = activeCategory === "All"
    ? services
    : services.filter((s) => (s.category?.name ?? "") === activeCategory);

  const statusDotColor = (status: string) => {
    if (status === "available") return "var(--color-success)";
    if (status === "in_service") return "var(--color-info)";
    if (status === "on_break") return "var(--color-warning)";
    return "var(--color-border)";
  };

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
      setHasStarted(true);
    } catch {
      setError("Failed to start sale. Check API connection.");
    } finally {
      setLoading(false);
    }
  };

  const handleSelectWorker = (worker: Worker) => {
    setError("");
    setSelectedWorkerId(worker.id);
  };

  const handleSelectService = async (svc: Service) => {
    if (!selectedWorkerId || !saleId) {
      setError("Select a worker first before adding a service.");
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
          workerName: selectedWorkerName || "Worker",
          category: svc.category?.name ?? "",
          priceCents: svc.priceCents,
          discountCents: 0,
          tipCents: 0,
        },
      ]);
    } catch {
      setError("Failed to add service.");
    } finally {
      setLoading(false);
    }
  };

  const removeItem = async (idx: number) => {
    const item = items[idx];
    if (item?.saleItemId && saleId) {
      try {
        await removeSaleItem(saleId, item.saleItemId);
      } catch { /* ignore */ }
    }
    setItems(items.filter((_, i) => i !== idx));
  };

  const updateTip = (idx: number, delta: number) => {
    setItems((prev) =>
      prev.map((it, i) =>
        i === idx
          ? { ...it, tipCents: Math.max(0, it.tipCents + delta) }
          : it
      )
    );
  };

  const makePaymentIdempotencyKey = () => {
    const randomId = globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(36).slice(2)}`;
    return `owner-pos-${saleId}-${randomId}`;
  };

  const recordPayment = async (amount: number) => {
    if (!saleId || amount <= 0) return;

    if (activeMethod === "cash") {
      await addCashPayment(saleId, { amountCents: amount });
    } else if (activeMethod === "gift_card") {
      await addGiftCardPayment(saleId, { amountCents: amount });
    } else if (activeMethod === "card") {
      const result = await addCardPayment(saleId, {
        amountCents: amount,
        tipCents: 0,
        idempotencyKey: makePaymentIdempotencyKey(),
      });
      if (result.terminalStatus !== "approved") {
        throw new Error("Card payment was not approved.");
      }
    } else {
      throw new Error("Select a payment method.");
    }

    setPayments((prev) => [...prev, { method: activeMethod, amountCents: amount }]);
  };

  const addPayment = async () => {
    if (!saleId || amountCents <= 0) return;
    const capped = Math.min(amountCents, Math.max(remaining, 0));
    if (capped <= 0) return;
    setLoading(true);
    setError("");
    try {
      await recordPayment(capped);
      setAmountCents(0);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Payment failed.");
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
    setError("");
    try {
      await recordPayment(remaining);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Payment failed.");
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
      setMode("done");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to complete sale.");
    } finally {
      setLoading(false);
    }
  };

  const resetSale = () => {
    setSaleId(null);
    setItems([]);
    setPayments([]);
    setSelectedWorkerId(null);
    setAmountCents(0);
    setChangeCents(0);
    setError("");
    setHasStarted(false);
    setActiveCategory("All");
    setMode("active");
  };

  // ── Done overlay ──
  if (mode === "done") {
    return (
      <div className="checkout-done-overlay">
        <span className="checkout-done-overlay__icon">✅</span>
        <h2 className="checkout-done-overlay__title">Payment Received</h2>
        <MoneyDisplay cents={total} className="checkout-done-overlay__total" />
        <p className="checkout-done-overlay__meta">
          Paid {formatMoney(paid)} across {payments.length} method{payments.length !== 1 ? "s" : ""}
        </p>
        {changeCents > 0 && (
          <p style={{ color: "var(--color-success)", fontSize: "var(--text-md)", fontWeight: "var(--font-semibold)" }}>
            Change due: {formatMoney(changeCents)}
          </p>
        )}
        {items.length > 0 && (
          <div style={{ width: "100%", maxWidth: "400px", marginTop: "var(--space-4)" }}>
            <ReceiptPreview
              items={items}
              payments={payments}
              subtotal={subtotal}
              discounts={discounts}
              tips={tips}
              total={total}
            />
          </div>
        )}
        <div className="checkout-done-overlay__actions">
          <Button onClick={resetSale}>New Sale</Button>
          <Button variant="secondary" onClick={() => { resetSale(); onBack(); }}>
            Back to Floor
          </Button>
        </div>
      </div>
    );
  }

  // ── Start (pre-init) screen ──
  if (!hasStarted) {
    return (
      <div className="checkout-start">
        <span style={{ fontSize: "3rem" }}>🚶</span>
        <h2 style={{ margin: 0, fontSize: "var(--text-xl)", fontWeight: "var(--font-bold)" }}>New Sale</h2>
        <p className="text-muted text-sm" style={{ maxWidth: 320 }}>
          Create a walk-in sale. Select a worker, add services, and take payment — all on one screen.
        </p>
        <Button size="lg" loading={loading} onClick={initSale}>
          Start Sale
        </Button>
        <Button variant="ghost" size="sm" onClick={onBack}>← Back to Floor</Button>
        {error && <p className="field__error">{error}</p>}
      </div>
    );
  }

  // ── Active workspace ──
  return (
    <div className="checkout-workspace">
      {/* Top Bar */}
      <div className="checkout-topbar">
        <button className="checkout-topbar__back" onClick={onBack}>
          ← Floor
        </button>
        <div className="checkout-topbar__customer">
          👤 <strong>Walk-in</strong>
        </div>
        <div className="checkout-topbar__total">
          <span className="checkout-topbar__total-label">Total</span>
          <span className="checkout-topbar__total-amount">{formatMoney(total)}</span>
        </div>
        <Button
          size="sm"
          onClick={completeCheckout}
          disabled={remaining > 0 || loading || items.length === 0}
          loading={loading}
        >
          Complete
        </Button>
      </div>

      {error && (
        <p className="field__error" style={{ marginBottom: "var(--space-2)", textAlign: "center" }}>
          {error}
        </p>
      )}

      {/* Four Columns */}
      <div className="checkout-columns">
        {/* Column 1: Worker List */}
        <div className="checkout-column">
          <p className="checkout-column__title">👥 Workers</p>
          {workers.length === 0 ? (
            <EmptyState icon="👤" title="No workers" description="Add workers in the Workers tab." />
          ) : (
            <div className="checkout-worker-list">
              {workers.map((w) => (
                <div
                  key={w.id}
                  className={`checkout-worker-chip ${selectedWorkerId === w.id ? "checkout-worker-chip--selected" : ""}`}
                  onClick={() => handleSelectWorker(w)}
                >
                  <span
                    className="checkout-worker-chip__status-dot"
                    style={{ background: statusDotColor(w.currentStatus) }}
                  />
                  <div className="checkout-worker-chip__info">
                    <span className="checkout-worker-chip__name">
                      {w.displayName || w.user?.name}
                    </span>
                    <span className="checkout-worker-chip__meta">
                      {Math.round(w.commissionRate * 100)}% · <StatusPill status={w.currentStatus} />
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Column 2: Service Catalog */}
        <div className="checkout-column">
          <p className="checkout-column__title">💅 Services</p>
          {services.length === 0 ? (
            <EmptyState icon="💅" title="No services" description="Add services in the Services tab." />
          ) : (
            <>
              <div className="checkout-services-tabs">
                <Tabs
                  tabs={categoryNames.map((c) => ({ key: c, label: c }))}
                  activeKey={activeCategory}
                  onChange={setActiveCategory}
                />
              </div>
              <div className="checkout-services-grid">
                {filteredServices.map((svc) => (
                  <div
                    key={svc.id}
                    className="checkout-service-card"
                    onClick={() => { void handleSelectService(svc); }}
                  >
                    <span className="checkout-service-card__name">{svc.name}</span>
                    <span className="checkout-service-card__price">{formatMoney(svc.priceCents)}</span>
                    <span className="checkout-service-card__meta">
                      {svc.category?.name && <span>{svc.category.name}</span>}
                      <span>{svc.durationMinutes}m</span>
                    </span>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>

        {/* Column 3: Sale Items + Totals */}
        <div className="checkout-column">
          <p className="checkout-column__title">📋 Sale Items</p>
          {items.length === 0 ? (
            <EmptyState icon="📋" title="No items" description="Select a worker, then tap services to add." />
          ) : (
            <div className="checkout-items-list">
              {items.map((item, idx) => (
                <div key={idx} className="checkout-sale-item">
                  <div className="checkout-sale-item__info">
                    <span className="checkout-sale-item__name">{item.serviceName}</span>
                    <span className="checkout-sale-item__worker">
                      {item.workerName} · {item.category}
                    </span>
                    <div className="checkout-sale-item__tip-row">
                      <span style={{ fontSize: "var(--text-xs)", color: "var(--color-text-muted)" }}>💰 Tip:</span>
                      <button
                        className="checkout-sale-item__tip-btn"
                        onClick={() => updateTip(idx, -100)}
                      >
                        −
                      </button>
                      <span className="checkout-sale-item__tip-amount">
                        {formatMoney(item.tipCents)}
                      </span>
                      <button
                        className="checkout-sale-item__tip-btn"
                        onClick={() => updateTip(idx, 100)}
                      >
                        +
                      </button>
                    </div>
                  </div>
                  <div className="checkout-sale-item__right">
                    <span className="checkout-sale-item__price">
                      {formatMoney(item.priceCents + item.tipCents - item.discountCents)}
                    </span>
                    <button
                      className="checkout-sale-item__remove"
                      onClick={() => { void removeItem(idx); }}
                    >
                      ✕
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Totals pinned at bottom */}
          <div className="checkout-totals">
            <div className="checkout-totals__row">
              <span className="checkout-totals__label">Subtotal</span>
              <span className="checkout-totals__value">{formatMoney(subtotal)}</span>
            </div>
            {discounts > 0 && (
              <div className="checkout-totals__row">
                <span className="checkout-totals__label">Discounts</span>
                <span className="checkout-totals__value checkout-totals__value--discount">
                  −{formatMoney(discounts)}
                </span>
              </div>
            )}
            <div className="checkout-totals__row">
              <span className="checkout-totals__label">Tips</span>
              <span className="checkout-totals__value checkout-totals__value--tips">
                {formatMoney(tips)}
              </span>
            </div>
            <div className="checkout-totals__row checkout-totals__row--main">
              <span>Total</span>
              <span>{formatMoney(total)}</span>
            </div>
          </div>
        </div>

        {/* Column 4: Payment */}
        <div className="checkout-column">
          <p className="checkout-column__title">💳 Payment</p>
          <div className="checkout-payment-panel">
            {/* Method selector */}
            <div className="payment-methods">
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

            {/* Remaining */}
            <div className="remaining-tracker">
              {remaining > 0 ? (
                <>Remaining: <span className="remaining-tracker__amount">{formatMoney(remaining)}</span></>
              ) : (
                <span className="remaining-tracker__done">✓ Fully Paid!</span>
              )}
            </div>

            {/* Exact payment button */}
            {remaining > 0 && (
              <Button fullWidth variant="secondary" onClick={exactPayment} loading={loading} size="sm">
                Pay Exact — {formatMoney(remaining)}
              </Button>
            )}

            {/* Custom amount */}
            <AmountInput
              label="Custom Amount"
              valueCents={amountCents}
              onChangeCents={setAmountCents}
            />
            <Button
              fullWidth
              variant="ghost"
              size="sm"
              onClick={addPayment}
              disabled={amountCents <= 0 || loading}
            >
              Add Payment
            </Button>

            {/* Payment entries */}
            {payments.length > 0 && (
              <div className="payment-entries">
                {payments.map((p, i) => (
                  <div key={i} className="payment-entry">
                    <span className="payment-entry__method">{methodLabel(p.method)}</span>
                    <span className="payment-entry__amount">{formatMoney(p.amountCents)}</span>
                    <button className="payment-entry__remove" onClick={() => removePayment(i)}>✕</button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
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
  const [activeReport, setActiveReport] = useState("sales");
  const [startDate, setStartDate] = useState(() => {
    return toDateInputValue(new Date());
  });
  const [endDate, setEndDate] = useState(() => {
    return toDateInputValue(new Date());
  });
  const [selectedWorkerId, setSelectedWorkerId] = useState("");
  const [reportWorkers, setReportWorkers] = useState<Worker[]>([]);
  const [loading, setLoading] = useState(false);
  const [reportError, setReportError] = useState("");
  const [salesSummary, setSalesSummary] = useState<SalesReportSummary | null>(null);
  const [salesTickets, setSalesTickets] = useState<SalesReportTicket[]>([]);
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
    totalPayCents?: number;
  } | null>(null);

  const reportParams = {
    start: startDate ? `${startDate}T00:00:00` : undefined,
    end: endDate ? `${addDaysToDateInput(endDate, 1)}T00:00:00` : undefined,
    workerId: selectedWorkerId || undefined,
  };

  const clearReportData = () => {
    setSalesSummary(null);
    setSalesTickets([]);
    setWorkerEarnings([]);
    setTurnDetails([]);
    setEodData(null);
  };

  const setReportFailure = (error: unknown) => {
    clearReportData();
    setReportError(error instanceof Error ? error.message : "Failed to load report data.");
  };

  const loadSales = async () => {
    setLoading(true);
    setReportError("");
    setSalesSummary(null);
    setSalesTickets([]);
    try {
      const data = await fetchSalesReport(reportParams);
      setSalesSummary(data.summary);
      setSalesTickets(data.sales);
    } catch (error) { setReportFailure(error); }
    finally { setLoading(false); }
  };

  const loadWorkers = async () => {
    setLoading(true);
    setReportError("");
    setWorkerEarnings([]);
    try {
      const data = await fetchWorkerEarnings(reportParams);
      setWorkerEarnings(data.workers);
    } catch (error) { setReportFailure(error); }
    finally { setLoading(false); }
  };

  const loadTurns = async () => {
    setLoading(true);
    setReportError("");
    setTurnDetails([]);
    try {
      const data = await fetchTurnDetail(reportParams);
      setTurnDetails(data.turns);
    } catch (error) { setReportFailure(error); }
    finally { setLoading(false); }
  };

  const loadEod = async () => {
    setLoading(true);
    setReportError("");
    setEodData(null);
    try {
      const data = await fetchEndOfDayReport(reportParams);
      setEodData(data);
    } catch (error) { setReportFailure(error); }
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
  }, [activeReport, startDate, endDate, selectedWorkerId]);

  useEffect(() => {
    const loadReportWorkers = async () => {
      try {
        const data = await fetchWorkers();
        setReportWorkers(data.filter((worker) => worker.active));
      } catch {
        setReportWorkers([]);
      }
    };
    void loadReportWorkers();
  }, []);

  const reportLabel = startDate && endDate
    ? startDate === endDate ? startDate : `${startDate} - ${endDate}`
    : "Today";
  const selectedWorkerName = reportWorkers.find((worker) => worker.id === selectedWorkerId)?.displayName;
  const filterDescription = selectedWorkerName
    ? `${reportLabel} for ${selectedWorkerName}`
    : reportLabel;
  const workerOptions = [
    { value: "", label: "All workers" },
    ...reportWorkers.map((worker) => ({ value: worker.id, label: worker.displayName })),
  ];
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
      <div style={{ display: "flex", gap: "var(--space-2)", marginBottom: "var(--space-4)", alignItems: "flex-end", flexWrap: "wrap" }}>
        <Input label="Start" type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
        <Input label="End" type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} />
        <Select
          label="Worker"
          value={selectedWorkerId}
          onChange={(e) => setSelectedWorkerId(e.target.value)}
          options={workerOptions}
          style={{ minWidth: "180px" }}
        />
        <span style={{ paddingBottom: "var(--space-2)", fontSize: "var(--text-sm)", color: "var(--color-text-muted)" }}>
          {filterDescription}
        </span>
      </div>

      <Tabs
        tabs={[
          { key: "sales", label: "Sales" },
          { key: "workers", label: "Workers" },
          { key: "turns", label: "Turns" },
          { key: "eod", label: "End of Day" },
        ]}
        activeKey={activeReport}
        onChange={setActiveReport}
      />

      {loading && <p className="text-muted text-sm my-2">Loading...</p>}
      {reportError && <p className="field__error my-2">{reportError}</p>}

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
            <StatCard label="Service Total" value={formatMoney(salesSummary.netServiceSalesCents)} />
            <StatCard label="Commission" value={formatMoney(salesSummary.workerCommissionPayoutCents)} />
            <StatCard label="Tips" value={formatMoney(salesSummary.tipTotalCents)} />
            <StatCard label="Pay" value={formatMoney(salesSummary.totalPayCents)} />
            <StatCard label="Collected" value={formatMoney(salesSummary.totalCollectedCents)} />
          </div>
          {salesTickets.length === 0 ? (
            <EmptyState icon="📊" title="No paid tickets" description={`No paid ticket data found for ${filterDescription}.`} />
          ) : (
            <div className="report-ticket-list">
              {salesTickets.map((ticket) => (
                <Card key={ticket.id} padding="lg" className="report-ticket">
                  <div className="card__header">
                    <div>
                      <h2 className="card__title">{ticket.customerName}</h2>
                      <p className="text-muted text-sm">
                        {ticket.completedAt ? new Date(ticket.completedAt).toLocaleString() : "Completed sale"} · {ticket.paymentMethods.map(methodLabel).join(", ") || "No approved payment"}
                      </p>
                    </div>
                    <Badge variant="success">{formatMoney(ticket.totals.collectedCents)}</Badge>
                  </div>
                  <div className="table-wrap">
                    <table className="report-table">
                      <thead>
                        <tr>
                          <th>Service</th><th>Worker</th><th>Price</th><th>Discount</th><th>Paid</th><th>Commission</th><th>Tips</th><th>Pay</th>
                        </tr>
                      </thead>
                      <tbody>
                        {ticket.services.map((service) => (
                          <tr key={service.id}>
                            <td><strong>{service.serviceName}</strong></td>
                            <td>{service.workerName}</td>
                            <td>{formatMoney(service.priceCents)}</td>
                            <td>{service.discountCents > 0 ? `-${formatMoney(service.discountCents)}` : "—"}</td>
                            <td>{formatMoney(service.finalServiceCents)}</td>
                            <td>{formatMoney(service.commissionCents)}</td>
                            <td>{formatMoney(service.tipsCents)}</td>
                            <td><strong>{formatMoney(service.payCents)}</strong></td>
                          </tr>
                        ))}
                      </tbody>
                      <tfoot>
                        <tr>
                          <td colSpan={4}><strong>Ticket total</strong></td>
                          <td><strong>{formatMoney(ticket.totals.serviceCents)}</strong></td>
                          <td><strong>{formatMoney(ticket.totals.commissionCents)}</strong></td>
                          <td><strong>{formatMoney(ticket.totals.tipsCents)}</strong></td>
                          <td><strong>{formatMoney(ticket.totals.payCents)}</strong></td>
                        </tr>
                      </tfoot>
                    </table>
                  </div>
                </Card>
              ))}
              <Card padding="lg" className="report-ticket-total">
                <div className="report-ticket-total__grid">
                  <span><strong>All tickets</strong></span>
                  <span>Service {formatMoney(salesSummary.netServiceSalesCents)}</span>
                  <span>Commission {formatMoney(salesSummary.workerCommissionPayoutCents)}</span>
                  <span>Tips {formatMoney(salesSummary.tipTotalCents)}</span>
                  <span>Pay {formatMoney(salesSummary.totalPayCents)}</span>
                  <span>Collected {formatMoney(salesSummary.totalCollectedCents)}</span>
                </div>
              </Card>
            </div>
          )}
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

function toDateInputValue(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function addDaysToDateInput(value: string, days: number) {
  const [year, month, day] = value.split("-").map(Number);
  const date = new Date(year, month - 1, day);
  date.setDate(date.getDate() + days);
  return toDateInputValue(date);
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

export const MOCK_WORKERS_DASHBOARD: TurnDashboardWorker[] = [
  { workerId: "w1", name: "Amy", status: "available", turnsTakenToday: 3, lastTurnEndedAt: "2026-05-26T13:20:00-05:00", activeTurn: null, salesTodayCents: 24000, tipsTodayCents: 4500, suggestionRank: 1, checkedIn: true, turns: [] },
  { workerId: "w2", name: "Bella", status: "in_service", turnsTakenToday: 2, lastTurnEndedAt: null, activeTurn: { customerName: "Mary" }, salesTodayCents: 18000, tipsTodayCents: 3200, suggestionRank: null, checkedIn: true, turns: [] },
  { workerId: "w3", name: "Coco", status: "available", turnsTakenToday: 1, lastTurnEndedAt: "2026-05-26T11:00:00-05:00", activeTurn: null, salesTodayCents: 8000, tipsTodayCents: 1000, suggestionRank: 2, checkedIn: false, turns: [] },
  { workerId: "w4", name: "Daisy", status: "on_break", turnsTakenToday: 2, lastTurnEndedAt: "2026-05-26T12:00:00-05:00", activeTurn: null, salesTodayCents: 14000, tipsTodayCents: 2800, suggestionRank: null, checkedIn: false, turns: [] },
];

export const MOCK_CHECKINS: Checkin[] = [
  { id: "c1", status: "waiting", notes: "Full set acrylic", checkedInAt: new Date(Date.now() - 15 * 60000).toISOString(), customer: { name: "Sarah Johnson", phone: "555-0101" } },
  { id: "c2", status: "waiting", notes: "Gel pedicure", checkedInAt: new Date(Date.now() - 5 * 60000).toISOString(), customer: { name: "Kim Lee", phone: "555-0102" } },
  { id: "c3", status: "waiting", notes: "Walk-in manicure", checkedInAt: new Date(Date.now() - 2 * 60000).toISOString(), customer: { name: "Jessica M.", phone: "555-0103" } },
];

export const MOCK_CHECKOUT_READY: Checkin[] = [
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
