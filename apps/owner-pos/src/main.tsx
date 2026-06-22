import React, { useEffect, useMemo, useState } from "react";
import { createRoot } from "react-dom/client";
import {
<<<<<<< HEAD
  assignTurn,
=======
  ApiError,
  addCustomSaleItem,
  addSaleItem,
  assignTurn,
  closeWorkSession,
  completeSale,
  completeTurn,
  createWorkerSessionCheckin,
  createEmptySale,
  fetchCurrentSession,
  fetchDiscountsReport,
  fetchPaymentsReport,
  fetchRefundsReport,
  fetchReportSummary,
  fetchSalesReport,
  fetchSessionReport,
  fetchTurnsReport,
  fetchWorkersReport,
>>>>>>> bdf0b2066dfcb2e3e613cb86c08bdfaba329da34
  createSaleForCheckin,
  fetchCheckins,
  fetchSale,
  fetchSaleReceipts,
  fetchServiceCategories,
  fetchTurnDashboard,
<<<<<<< HEAD
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
  fetchTerminalConfig,
  updateTerminalConfig,
  fetchTerminalStatus,
  startTerminalPairing,
  fetchTerminalPairStatus,
  confirmTerminalPairing,
  allocateCardTip,
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
  fetchPaymentReport,
  fetchRefundReport,
  fetchDiscountReport,
  verifyOwnerPin,
=======
  fetchWorkers,
  loginOwner,
  openWorkSession,
  recordCashPayment,
  recordGiftCardPayment,
  printSaleReceipt,
  reprintSaleReceipt,
  removeSaleItem,
  setTipDistribution,
  startCardPayment,
  startTurn,
  updateWorkerStatus,
  updateSaleItem,
  type ActiveTurn,
  type CheckedInWorker,
>>>>>>> bdf0b2066dfcb2e3e613cb86c08bdfaba329da34
  type Checkin,
  type DiscountReportRow,
  type OwnerSession,
  type PaymentReportRow,
  type RefundReportRow,
  type ReportRange,
  type ReportSummary,
  type ReceiptRecord,
  type Sale,
  type SaleItem,
  type SalesReportRow,
  type SessionCandidate,
  type ServiceCategory,
  type TurnReportRow,
  type TurnDashboardWorker,
<<<<<<< HEAD
  type Service,
  type ServiceCategory,
  type Worker,
  type Session,
  type TurnDetail,
  type SalesReportSummary,
  type SalesReportTicket,
  type WorkerEarningsRow,
  type PaymentReportSummary,
  type PaymentReportRow,
  type RefundReportRow,
  type DiscountReportRow,
  type TerminalConfig,
  type TerminalStatus,
=======
  type WorkSession,
  type Worker,
  type WorkerReportRow,
  type WorkerStatus,
>>>>>>> bdf0b2066dfcb2e3e613cb86c08bdfaba329da34
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
import { buildWorkerReportTarget, type WorkerReportKey, type WorkerReportTarget } from "./reportTarget.js";
import { buildWorkerSavePayload } from "./workerForm.js";
import "./styles.css";

<<<<<<< HEAD
/* ════════════════════════════════════════
   Types
   ════════════════════════════════════════ */

type View =
  | "dashboard"
  | "checkout"
  | "services"
  | "workers"
  | "reports";

type PaymentEntry = {
  method: string;
  amountCents: number;
  tipCents?: number;
};

type CheckoutDraft = {
  saleId: string | null;
  items: CheckoutItem[];
  payments: PaymentEntry[];
  selectedWorkerId: string | null;
  amountCents: number;
  changeCents: number;
  hasStarted: boolean;
  activeCategory: string;
  activeMethod: string;
  pendingTipAllocation: { paymentId: string; tipCents: number } | null;
  mode: CheckoutMode;
  savedAt: number;
};

const CHECKOUT_DRAFT_STORAGE_KEY = "nail.ownerPos.checkoutDraft.v1";
const CHECKOUT_DRAFT_MAX_AGE_MS = 24 * 60 * 60 * 1000;

/* ════════════════════════════════════════
   App
   ════════════════════════════════════════ */

function App() {
  const [view, setView] = useState<View>("dashboard");
  const [reportTarget, setReportTarget] = useState<WorkerReportTarget | null>(null);
  const [secureRequest, setSecureRequest] = useState<{
    title: string;
    description: string;
    onConfirm: () => void;
  } | null>(null);

  const requestOwnerPin = (title: string, description: string, onConfirm: () => void) => {
    setSecureRequest({ title, description, onConfirm });
  };

  const openView = (nextView: View) => {
    const showView = () => {
      if (nextView === "reports") setReportTarget(null);
      setView(nextView);
    };

    if (isSecureView(nextView)) {
      requestOwnerPin(
        "Owner PIN Required",
        `Enter owner PIN to open ${viewLabel(nextView)}.`,
        showView
      );
      return;
    }

    showView();
  };

  const openReportsForWorker = (workerId: string, report?: WorkerReportKey) => {
    setReportTarget(buildWorkerReportTarget(workerId, report));
    setView("reports");
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
        {view === "checkout" && <CheckoutScreen onBack={() => setView("dashboard")} />}
        {view === "services" && <ServicesScreen />}
        {view === "workers" && <WorkersScreen onOpenReportsForWorker={openReportsForWorker} />}
        {view === "reports" && <ReportsScreen initialReport={reportTarget?.report} initialWorkerId={reportTarget?.workerId} />}
      </main>
      <BottomNav
        items={[
          { icon: "🏠", label: "Floor", active: view === "dashboard", onClick: () => openView("dashboard") },
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
  const [workerClockModalOpen, setWorkerClockModalOpen] = useState(false);
  const [clockActionWorkerId, setClockActionWorkerId] = useState<string | null>(null);
  const [clockActionError, setClockActionError] = useState("");
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
=======
type LoadState = "loading" | "ready" | "error";
type ActiveTab = "turns" | "checkout" | "reports";
type CheckoutPhase = "build_order" | "payment" | "card_processing" | "tip_review";

type WorkerTipShare = {
  workerId: string;
  workerName: string;
  itemIds: string[];
  serviceCents: number;
  tipCents: number;
};

type NumpadState =
  | { open: false }
  | { open: true; purpose: "cash" | "gift_card"; digits: string }
  | { open: true; purpose: "tip_adjust"; workerIndex: number; digits: string }
  | { open: true; purpose: "custom_price"; digits: string };

type CustomServiceState = { open: false } | { open: true; name: string };

const workerStatusOptions: WorkerStatus[] = ["available", "in_service", "on_break", "off_today", "appointment_only"];

function customerName(c?: { name?: string | null; phone?: string | null } | null): string {
  if (!c) return "Guest";
  return c.name ?? c.phone ?? "Guest";
}

function formatMoney(cents: number): string {
  return "$" + (cents / 100).toFixed(2);
}

function formatSessionDate(value?: string | null): string {
  if (!value) return "-";
  return new Date(value).toLocaleDateString([], { month: "short", day: "numeric", year: "numeric" });
}

function formatDateTime(value?: string | null): string {
  if (!value) return "-";
  return new Date(value).toLocaleString([], { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });
}

function digitsToDisplay(digits: string): string {
  const padded = (digits || "0").padStart(3, "0");
  return "$" + parseInt(padded.slice(0, -2), 10) + "." + padded.slice(-2);
}

function digitsToCents(digits: string): number {
  return parseInt(digits || "0", 10);
}

// ── App ──────────────────────────────────────────────────────────────────────

function App() {
  const [dashboardWorkers, setDashboardWorkers] = useState<TurnDashboardWorker[]>([]);
  const [workers, setWorkers] = useState<Worker[]>([]);
  const [waitingCheckins, setWaitingCheckins] = useState<Checkin[]>([]);
  const [activeCheckins, setActiveCheckins] = useState<Checkin[]>([]);
  const [categories, setCategories] = useState<ServiceCategory[]>([]);
  const [currentSession, setCurrentSession] = useState<WorkSession | null>(null);
  const [checkedInWorkers, setCheckedInWorkers] = useState<CheckedInWorker[]>([]);
  const [pendingSessionCandidate, setPendingSessionCandidate] = useState<SessionCandidate | null>(null);
  const [loadState, setLoadState] = useState<LoadState>("loading");
  const [statusMsg, setStatusMsg] = useState("Loading...");
  const [activeTab, setActiveTab] = useState<ActiveTab>("turns");
  const [assignments, setAssignments] = useState<Record<string, string>>({});

  const suggestedWorker = useMemo(
    () =>
      dashboardWorkers.find((w) => w.suggestionRank === 1) ??
      dashboardWorkers.find((w) => w.status === "available"),
    [dashboardWorkers]
  );

  async function loadAll(message = "Connected.") {
    try {
      const [dashboard, allWorkers, waiting, inService, readyForCheckout, catalog, sessionInfo] = await Promise.all([
        fetchTurnDashboard(),
        fetchWorkers(),
        fetchCheckins("waiting"),
        fetchCheckins("in_service"),
        fetchCheckins("ready_for_checkout"),
        fetchServiceCategories(),
        fetchCurrentSession(),
      ]);
      setDashboardWorkers(dashboard.workers);
      setWorkers(allWorkers.filter((w) => w.active));
      setWaitingCheckins(waiting);
      setActiveCheckins([...inService, ...readyForCheckout]);
      setCategories(catalog);
      setCurrentSession(sessionInfo.session);
      const workerCheckins =
        sessionInfo.checkedInWorkers ??
        (sessionInfo.checkedInWorkerIds ?? []).map((workerId) => ({ workerId, checkedInAt: null }));
      setCheckedInWorkers(workerCheckins);
      setLoadState("ready");
      setStatusMsg(message);
    } catch (err) {
      setLoadState("error");
      setStatusMsg(err instanceof Error ? err.message : "Failed to connect.");
    }
  }

  useEffect(() => { void loadAll(); }, []);

  async function handleAssign(checkin: Checkin) {
    const workerId = assignments[checkin.id] ?? suggestedWorker?.workerId;
    if (!workerId) { setStatusMsg("No worker selected."); return; }
    try {
      await assignTurn(checkin.id, workerId, suggestedWorker?.workerId ?? null);
      void loadAll("Turn assigned.");
    } catch (err) {
      setStatusMsg(err instanceof Error ? err.message : "Assign failed.");
    }
  }

  async function handleTurnAction(turn: ActiveTurn, action: "start" | "complete") {
    try {
      if (action === "start") await startTurn(turn);
      else await completeTurn(turn);
      void loadAll(action === "start" ? "Service started." : "Service completed.");
    } catch (err) {
      setStatusMsg(err instanceof Error ? err.message : "Action failed.");
    }
  }

  async function handleOwnerCheckin(workerId: string, notes: string) {
    if (!currentSession) {
      setStatusMsg("Open a session before worker check-in.");
      return;
    }
    try {
      await createWorkerSessionCheckin(currentSession.id, { workerId, notes });
      void loadAll("Check-in created.");
    } catch (err) {
      setStatusMsg(err instanceof Error ? err.message : "Check-in failed.");
    }
  }

  async function handleWorkerStatusChange(workerId: string, status: WorkerStatus) {
    try {
      await updateWorkerStatus(workerId, status);
      void loadAll("Worker status updated.");
    } catch (err) {
      setStatusMsg(err instanceof Error ? err.message : "Status update failed.");
    }
  }

  async function handleOpenSession() {
    try {
      const opened = await openWorkSession();
      setPendingSessionCandidate(null);
      void loadAll(
        opened.openMode === "continue" ? "Continued last session." : "Session opened."
      );
    } catch (err) {
      if (err instanceof ApiError && err.code === "CONTINUE_DECISION_REQUIRED") {
        const data = (err.data ?? {}) as { candidateSession?: SessionCandidate };
        setPendingSessionCandidate(data.candidateSession ?? null);
        setStatusMsg("Choose continue or start new session.");
        return;
      }
      setStatusMsg(err instanceof Error ? err.message : "Open session failed.");
    }
  }

  async function handleResolveOpenSession(mode: "continue" | "new") {
    try {
      const opened = await openWorkSession({
        mode,
        sourceSessionId: mode === "continue" ? pendingSessionCandidate?.id : undefined,
      });
      setPendingSessionCandidate(null);
      void loadAll(
        opened.openMode === "continue"
          ? "Continued last session."
          : "Started a new session. Worker check-ins are renewed."
      );
    } catch (err) {
      if (err instanceof ApiError && (err.code === "CANDIDATE_STALE" || err.code === "CONTINUE_DECISION_REQUIRED")) {
        const data = (err.data ?? {}) as { candidateSession?: SessionCandidate };
        setPendingSessionCandidate(data.candidateSession ?? null);
        setStatusMsg("Session decision changed. Please choose again.");
        return;
      }
      setStatusMsg(err instanceof Error ? err.message : "Open session failed.");
    }
  }

  async function handleCloseSession() {
    if (!currentSession) {
      setStatusMsg("No open session.");
      return;
    }
    try {
      await closeWorkSession(currentSession.id);
      const report = await fetchSessionReport(currentSession.id);
      void loadAll(
        `Session closed. Service ${formatMoney(report.summary.serviceCents)}, tip ${formatMoney(report.summary.tipCents)}, commission ${formatMoney(report.summary.commissionCents)}.`
      );
    } catch (err) {
      setStatusMsg(err instanceof Error ? err.message : "Close session failed.");
    }
  }
>>>>>>> bdf0b2066dfcb2e3e613cb86c08bdfaba329da34

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
      const w = await workerClockOut(workerId);
      setCheckedInWorkers((prev) => prev.map((c) => (c.workerId === workerId ? w : c)));
      await refreshFloor();
      return;
    }

    const w = await workerCheckIn(workerId);
    setCheckedInWorkers((prev) => {
      const filtered = prev.filter((c) => c.workerId !== workerId);
      return [...filtered, w];
    });
    await refreshFloor();
  };
  const checkedInSet = new Set([
    ...workers.filter((worker) => worker.checkedIn).map((worker) => worker.workerId),
    ...checkedInWorkers.filter((c) => !c.checkedOutAt).map((c) => c.workerId),
  ]);

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
<<<<<<< HEAD
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
              checkedInWorkers={checkedInWorkers}
              selectedCustomerName={selectedCheckin?.customer?.name ?? (selectedCheckin ? "Walk-in" : null)}
              recommendedWorkerId={recommendedWorker?.workerId ?? null}
              onAssign={handleAssignWorker}
              onOpenWorkerClock={() => setWorkerClockModalOpen(true)}
            />
            <ReadyCheckoutRail
              checkins={checkoutCheckins}
              onStartSale={(checkinId) => { void handleStartSale(checkinId); }}
            />
          </div>

          <WorkerClockModal
            open={workerClockModalOpen}
            workers={workers}
            checkedInWorkers={checkedInWorkers}
            loadingWorkerId={clockActionWorkerId}
            error={clockActionError}
            onClose={() => setWorkerClockModalOpen(false)}
            onToggleWorker={async (workerId) => {
              setClockActionWorkerId(workerId);
              setClockActionError("");
              try {
                await handleWorkerClockToggle(workerId);
              } catch (error) {
                setClockActionError(error instanceof Error ? error.message : "Failed to update worker clock status.");
              } finally {
                setClockActionWorkerId(null);
              }
            }}
          />

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
                  onClick={() => {
                    void handleWorkerClockToggle(w.workerId).catch((error) => {
                      alert(error instanceof Error ? error.message : "Failed to update worker clock status");
                    });
                  }}
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

function WorkerClockTrigger({
  workers,
  checkedInWorkers,
  onOpen,
  compact = false,
}: {
  workers: TurnDashboardWorker[];
  checkedInWorkers: CheckedInWorker[];
  onOpen: () => void;
  compact?: boolean;
}) {
  const checkedInCount = getClockedInCount(workers, checkedInWorkers);

  return (
    <button className={`worker-clock-trigger ${compact ? "worker-clock-trigger--board" : ""}`} type="button" onClick={onOpen}>
      <span>
        <strong>Clock In/ Clock Out</strong>
        <small>{checkedInCount}/{workers.length} clocked in</small>
      </span>
    </button>
  );
}

function WorkerClockModal({
  open,
  workers,
  checkedInWorkers,
  loadingWorkerId,
  error,
  onClose,
  onToggleWorker,
}: {
  open: boolean;
  workers: TurnDashboardWorker[];
  checkedInWorkers: CheckedInWorker[];
  loadingWorkerId: string | null;
  error: string;
  onClose: () => void;
  onToggleWorker: (workerId: string) => Promise<void>;
}) {
  const checkedInCount = getClockedInCount(workers, checkedInWorkers);

  return (
    <Modal open={open} onClose={onClose} title="Worker Clock In / Out" className="worker-clock-modal">
      <div className="worker-clock-modal__summary">
        <strong>{checkedInCount}/{workers.length}</strong>
        <span>workers clocked in</span>
      </div>
      {error && <p className="field__error">{error}</p>}
      {workers.length === 0 ? (
        <EmptyState icon="Staff" title="No workers loaded" description="Workers appear here after the floor session loads." />
      ) : (
        <div className="worker-clock-grid">
          {workers.map((worker) => {
            const state = getWorkerClockState(worker, checkedInWorkers);
            const loading = loadingWorkerId === worker.workerId;
            return (
              <button
                key={worker.workerId}
                type="button"
                className={`worker-clock-tile worker-clock-tile--${state.kind}`}
                disabled={loadingWorkerId != null}
                onClick={() => { void onToggleWorker(worker.workerId); }}
                title={state.detail}
              >
                <strong>{worker.name}</strong>
                <small>{loading ? "Updating..." : state.label}</small>
              </button>
            );
          })}
        </div>
      )}
    </Modal>
  );
}

function getClockedInCount(workers: TurnDashboardWorker[], checkedInWorkers: CheckedInWorker[]) {
  const checkedInSet = new Set([
    ...workers.filter((worker) => worker.checkedIn).map((worker) => worker.workerId),
    ...checkedInWorkers.filter((entry) => !entry.checkedOutAt).map((entry) => entry.workerId),
  ]);
  return checkedInSet.size;
}

type WorkerClockState = {
  kind: "checked-in" | "clocked-out" | "not-checked-in" | "off-today";
  label: string;
  detail: string;
};

function getWorkerClockState(worker: TurnDashboardWorker, checkedInWorkers: CheckedInWorker[]): WorkerClockState {
  const entry = checkedInWorkers.find((item) => item.workerId === worker.workerId);
  if ((entry && !entry.checkedOutAt) || worker.checkedIn) {
    return {
      kind: "checked-in",
      label: "Clocked in",
      detail: entry?.checkedInAt ? `Since ${formatClockTime(entry.checkedInAt)}` : "Active in current session",
    };
  }

  if (entry?.checkedOutAt) {
    return {
      kind: "clocked-out",
      label: "Clocked out",
      detail: `Out ${formatClockTime(entry.checkedOutAt)}`,
    };
  }

  if (worker.status === "off_today") {
    return {
      kind: "off-today",
      label: "Off today",
      detail: "Not clocked in",
    };
  }

  return {
    kind: "not-checked-in",
    label: "Not clocked in",
    detail: "Ready to clock in",
  };
}

function formatClockTime(value: string) {
  return new Date(value).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
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
  checkedInWorkers,
  selectedCustomerName,
  recommendedWorkerId,
  onAssign,
  onOpenWorkerClock,
}: {
  workers: TurnDashboardWorker[];
  checkedInSet: Set<string>;
  checkedInWorkers: CheckedInWorker[];
  selectedCustomerName: string | null;
  recommendedWorkerId: string | null;
  onAssign: (workerId: string) => void;
  onOpenWorkerClock: () => void;
}) {
  const groups = [
    { status: "available", label: "Available" },
    { status: "in_service", label: "In Service" },
    { status: "on_break", label: "On Break" },
    { status: "off_today", label: "Off Today" },
    { status: "not_checked_in", label: "Not Clocked In" },
  ];

  return (
    <Card padding="lg" className="floor-panel floor-panel--workers">
      <div className="card__header">
        <div>
          <p className="eyebrow">{selectedCustomerName ? `Assigning ${selectedCustomerName}` : "Worker status"}</p>
          <h2 className="card__title">Worker Board</h2>
        </div>
        <WorkerClockTrigger
          workers={workers}
          checkedInWorkers={checkedInWorkers}
          onOpen={onOpenWorkerClock}
          compact
        />
      </div>
      {workers.length === 0 ? (
        <EmptyState icon="Staff" title="No workers loaded" description="Start a session and check the local API to show worker status." />
      ) : (
        <div className="floor-worker-groups">
          {groups.map((group) => {
            const groupedWorkers = sortWorkersForFloor(workers).filter((worker) => {
              const checkedIn = checkedInSet.has(worker.workerId);
              const effectiveStatus = checkedIn ? worker.status : "not_checked_in";
              return effectiveStatus === group.status;
            });
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
  const effectiveStatus = checkedIn ? worker.status : "not_checked_in";
  const assignable = Boolean(selectedCustomerName && effectiveStatus === "available");
  const turnLabel = `${worker.turnsTakenToday} turn${worker.turnsTakenToday === 1 ? "" : "s"}`;
  const statusLabel = effectiveStatus.replace(/_/g, " ");

  return (
    <button
      type="button"
      className={[
        "floor-worker-card",
        `floor-worker-card--${effectiveStatus}`,
        assignable ? "floor-worker-card--assignable" : "",
      ].filter(Boolean).join(" ")}
      disabled={!assignable}
      onClick={() => onAssign(worker.workerId)}
      aria-label={`${worker.name}, ${turnLabel}, ${statusLabel}${recommended ? ", recommended" : ""}`}
    >
      <strong className="floor-worker-card__name">{worker.name}</strong>
      <span className="floor-worker-card__turns">{turnLabel}</span>
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

type TerminalConfigForm = {
  transport: TerminalConfig["transport"];
  cloudBaseUrl: string;
  merchantId: string;
  appId: string;
  appSecret: string;
  deviceBaseUrl: string;
  deviceId: string;
  posId: string;
  accessToken: string;
  wsHost: string;
  wsPort: string;
  wsPath: string;
  wsSecure: boolean;
  remoteApplicationId: string;
  posName: string;
  serialNumber: string;
  authToken: string;
};

function defaultTerminalConfigForm(): TerminalConfigForm {
  return {
    transport: "mock",
    cloudBaseUrl: "",
    merchantId: "",
    appId: "",
    appSecret: "",
    deviceBaseUrl: "http://localhost:4100",
    deviceId: "mock-clover-mini-1",
    posId: "owner-pos-dev",
    accessToken: "",
    wsHost: "192.168.0.18",
    wsPort: "12345",
    wsPath: "/remote_pay",
    wsSecure: true,
    remoteApplicationId: "RQ07XH5Z3EX44.BT1G67W0JJFVC",
    posName: "Nail Salon POS",
    serialNumber: "C035UT24950367",
    authToken: "",
  };
}

function formFromTerminalConfig(config: TerminalConfig): TerminalConfigForm {
  return {
    ...defaultTerminalConfigForm(),
    transport: config.transport,
    cloudBaseUrl: config.cloudBaseUrl ?? "",
    merchantId: config.merchantId ?? "",
    appId: config.appId ?? "",
    deviceBaseUrl: config.deviceBaseUrl ?? "",
    deviceId: config.deviceId ?? "",
    posId: config.posId ?? "",
    wsHost: config.wsHost ?? "",
    wsPort: config.wsPort ? String(config.wsPort) : "12345",
    wsPath: config.wsPath ?? "/remote_pay",
    wsSecure: config.wsSecure ?? true,
    remoteApplicationId: config.remoteApplicationId ?? "",
    posName: config.posName ?? "Nail Salon POS",
    serialNumber: config.serialNumber ?? "owner-pos-1",
  };
}

function updateFromTerminalConfigForm(form: TerminalConfigForm) {
  const wsPort = Number(form.wsPort || 0);
  return {
    transport: form.transport,
    cloudBaseUrl: form.cloudBaseUrl.trim() || undefined,
    merchantId: form.merchantId.trim() || undefined,
    appId: form.appId.trim() || undefined,
    appSecret: form.appSecret.trim() || undefined,
    deviceBaseUrl: form.deviceBaseUrl.trim() || undefined,
    deviceId: form.deviceId.trim() || undefined,
    posId: form.posId.trim() || undefined,
    accessToken: form.accessToken.trim() || undefined,
    wsHost: form.wsHost.trim() || undefined,
    wsPort: Number.isInteger(wsPort) && wsPort > 0 ? wsPort : undefined,
    wsPath: form.wsPath.trim() || undefined,
    wsSecure: form.wsSecure,
    remoteApplicationId: form.remoteApplicationId.trim() || undefined,
    posName: form.posName.trim() || undefined,
    serialNumber: form.serialNumber.trim() || undefined,
    authToken: form.authToken.trim() || undefined,
  };
}

const TERMINAL_CONFIG_STORAGE_KEY = "nail.ownerPos.terminalConfig.v1";

type StoredTerminalConfigForm = Omit<TerminalConfigForm, "accessToken" | "appSecret" | "authToken">;

function readStoredTerminalConfigForm(): TerminalConfigForm | null {
  try {
    const raw = window.localStorage.getItem(TERMINAL_CONFIG_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<StoredTerminalConfigForm>;
    if (parsed.transport !== "mock" && parsed.transport !== "rest-local" && parsed.transport !== "rest-cloud" && parsed.transport !== "usb-sidecar" && parsed.transport !== "ws-lan") {
      return null;
    }
    return {
      ...defaultTerminalConfigForm(),
      ...parsed,
      wsPort: parsed.wsPort ? String(parsed.wsPort) : "12345",
      wsSecure: parsed.wsSecure ?? true,
      accessToken: "",
      appSecret: "",
      authToken: "",
    };
  } catch {
    return null;
  }
}

function storeTerminalConfigForm(form: TerminalConfigForm) {
  const { accessToken: _accessToken, appSecret: _appSecret, authToken: _authToken, ...safeForm } = form;
  window.localStorage.setItem(TERMINAL_CONFIG_STORAGE_KEY, JSON.stringify(safeForm));
}

function readCheckoutDraft(): CheckoutDraft | null {
  try {
    const raw = window.localStorage.getItem(CHECKOUT_DRAFT_STORAGE_KEY);
    if (!raw) return null;
    const draft = JSON.parse(raw) as CheckoutDraft;
    if (!draft.savedAt || Date.now() - draft.savedAt > CHECKOUT_DRAFT_MAX_AGE_MS) {
      window.localStorage.removeItem(CHECKOUT_DRAFT_STORAGE_KEY);
      return null;
    }
    if (draft.mode !== "active" && draft.mode !== "done") return null;
    return {
      saleId: draft.saleId ?? null,
      items: Array.isArray(draft.items) ? draft.items : [],
      payments: Array.isArray(draft.payments) ? draft.payments : [],
      selectedWorkerId: draft.selectedWorkerId ?? null,
      amountCents: Number.isInteger(draft.amountCents) ? draft.amountCents : 0,
      changeCents: Number.isInteger(draft.changeCents) ? draft.changeCents : 0,
      hasStarted: Boolean(draft.hasStarted),
      activeCategory: draft.activeCategory || "All",
      activeMethod: draft.activeMethod || "cash",
      pendingTipAllocation: draft.pendingTipAllocation ?? null,
      mode: draft.mode,
      savedAt: draft.savedAt,
    };
  } catch {
    return null;
  }
}

function writeCheckoutDraft(draft: CheckoutDraft) {
  window.localStorage.setItem(CHECKOUT_DRAFT_STORAGE_KEY, JSON.stringify({ ...draft, savedAt: Date.now() }));
}

function clearCheckoutDraft() {
  window.localStorage.removeItem(CHECKOUT_DRAFT_STORAGE_KEY);
}

function CheckoutScreen({ onBack }: { onBack: () => void }) {
  const [mode, setMode] = useState<CheckoutMode>("active");
  const [saleId, setSaleId] = useState<string | null>(null);
  const [items, setItems] = useState<CheckoutItem[]>([]);
  const [services, setServices] = useState<Service[]>([]);
  const [workers, setWorkers] = useState<Worker[]>([]);
  const [selectedWorkerId, setSelectedWorkerId] = useState<string | null>(null);
  const [payments, setPayments] = useState<PaymentEntry[]>([]);
  const [amountCents, setAmountCents] = useState(0);
  const [paymentAmountModalOpen, setPaymentAmountModalOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [activeMethod, setActiveMethod] = useState("cash");
  const [changeCents, setChangeCents] = useState(0);
  const [hasStarted, setHasStarted] = useState(false);
  const [activeCategory, setActiveCategory] = useState("All");
  const [showCustomServiceModal, setShowCustomServiceModal] = useState(false);
  const [customServiceName, setCustomServiceName] = useState("");
  const [customServicePriceCents, setCustomServicePriceCents] = useState(0);
  const [customServiceCategory, setCustomServiceCategory] = useState("Custom");
  const [customServiceError, setCustomServiceError] = useState("");
  const [pendingTipAllocation, setPendingTipAllocation] = useState<{ paymentId: string; tipCents: number } | null>(null);
  const [terminalStatus, setTerminalStatus] = useState<TerminalStatus | null>(null);
  const [terminalStatusLoading, setTerminalStatusLoading] = useState(false);
  const [pairingModalOpen, setPairingModalOpen] = useState(false);
  const [pairingError, setPairingError] = useState("");
  const [pairingCodeInput, setPairingCodeInput] = useState("");
  const [terminalConfigOpen, setTerminalConfigOpen] = useState(false);
  const [terminalConfig, setTerminalConfig] = useState<TerminalConfig | null>(null);
  const [terminalConfigForm, setTerminalConfigForm] = useState<TerminalConfigForm>(() => readStoredTerminalConfigForm() ?? defaultTerminalConfigForm());
  const [terminalConfigError, setTerminalConfigError] = useState("");
  const [terminalConfigSaving, setTerminalConfigSaving] = useState(false);
  const [checkoutDraftLoaded, setCheckoutDraftLoaded] = useState(false);

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
  const terminalTransport = terminalConfig?.transport ?? terminalConfigForm.transport;
  const isRealCloverLan = terminalTransport === "ws-lan";
  const isCloverCloudRest = terminalTransport === "rest-cloud";
  const isRealCloverTransport = isRealCloverLan || isCloverCloudRest;
  const terminalEndpoint = isCloverCloudRest
    ? terminalConfig?.cloudBaseUrl ?? "Not configured"
    : terminalTransport === "rest-local"
      ? terminalConfig?.deviceBaseUrl ?? "Not configured"
      : terminalConfig?.wsUrl
        ?? (terminalConfig?.wsHost
          ? `${terminalConfig.wsSecure === false ? "ws" : "wss"}://${terminalConfig.wsHost}${terminalConfig.wsPort ? `:${terminalConfig.wsPort}` : ""}${terminalConfig.wsPath ?? "/remote_pay"}`
          : "Not configured");
  const terminalDisplayName = isRealCloverLan
    ? "Clover Mini 3 LAN"
    : isCloverCloudRest
      ? "Clover Cloud REST Pay Display"
      : terminalTransport === "rest-local"
        ? "Mock Clover REST"
        : "Mock terminal";
  const terminalStep = terminalStatus?.connected
    ? "ready"
    : terminalStatus?.pairingCode
      ? "pair"
      : terminalStatusLoading
        ? "checking"
        : isRealCloverTransport
          ? "waiting"
          : "offline";

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
      const draft = readCheckoutDraft();
      const [sale, svcs, wrks] = await Promise.all([
        draft?.saleId ? Promise.resolve({ id: draft.saleId }) : createSale({}),
        fetchServices({ active: true }),
        fetchWorkers(),
      ]);
      setSaleId(sale.id);
      setServices(svcs);
      setWorkers(wrks.filter((w) => w.active));
      if (draft) {
        setItems(draft.items);
        setPayments(draft.payments);
        setSelectedWorkerId(draft.selectedWorkerId);
        setAmountCents(draft.amountCents);
        setChangeCents(draft.changeCents);
        setHasStarted(draft.hasStarted);
        setActiveCategory(draft.activeCategory);
        setActiveMethod(draft.activeMethod);
        setPendingTipAllocation(draft.pendingTipAllocation);
        setMode(draft.mode);
      } else {
        setHasStarted(true);
      }
    } catch {
      setError("Failed to start sale. Check API connection.");
    } finally {
      setCheckoutDraftLoaded(true);
      setLoading(false);
    }
  };

  useEffect(() => {
    void initSale();
  }, []);

  useEffect(() => {
    if (!checkoutDraftLoaded) return;
    writeCheckoutDraft({
      saleId,
      items,
      payments,
      selectedWorkerId,
      amountCents,
      changeCents,
      hasStarted,
      activeCategory,
      activeMethod,
      pendingTipAllocation,
      mode,
      savedAt: Date.now(),
    });
  }, [checkoutDraftLoaded, saleId, items, payments, selectedWorkerId, amountCents, changeCents, hasStarted, activeCategory, activeMethod, pendingTipAllocation, mode]);

  const updateTerminalStatus = (status: TerminalStatus) => {
    setTerminalStatus(status);
    if (status.pairingRequired || status.pairingCode) {
      setPairingModalOpen(true);
    }
    if (status.connected) {
      setPairingError("");
      setPairingModalOpen(false);
    }
  };

  const refreshTerminalStatus = async () => {
    setTerminalStatusLoading(true);
    try {
      updateTerminalStatus(await fetchTerminalStatus());
    } catch (err) {
      setTerminalStatus({
        connected: false,
        provider: "clover",
        message: err instanceof Error ? err.message : "Unable to reach payment terminal",
      });
    } finally {
      setTerminalStatusLoading(false);
    }
  };

  const loadTerminalConfig = async () => {
    setTerminalConfigError("");
    const storedForm = readStoredTerminalConfigForm();
    if (storedForm) {
      setTerminalConfigForm(storedForm);
    }
    try {
      const config = await fetchTerminalConfig();
      if (storedForm) {
        const result = await updateTerminalConfig(updateFromTerminalConfigForm(storedForm));
        setTerminalConfig(result.config);
        setTerminalConfigForm(formFromTerminalConfig(result.config));
        updateTerminalStatus(result.status);
      } else {
        setTerminalConfig(config);
        setTerminalConfigForm(formFromTerminalConfig(config));
      }
    } catch (err) {
      setTerminalConfigError(err instanceof Error ? err.message : "Unable to load Clover settings.");
    }
  };

  const openTerminalConfig = () => {
    setTerminalConfigOpen(true);
    void loadTerminalConfig();
  };

  const saveTerminalConfig = async () => {
    setTerminalConfigSaving(true);
    setTerminalConfigError("");
    try {
      const result = await updateTerminalConfig(updateFromTerminalConfigForm(terminalConfigForm));
      setTerminalConfig(result.config);
      const nextForm = formFromTerminalConfig(result.config);
      setTerminalConfigForm(nextForm);
      storeTerminalConfigForm(nextForm);
      updateTerminalStatus(result.status);
      setTerminalConfigOpen(false);
      if (result.config.transport === "ws-lan" && !result.status.connected) {
        setPairingModalOpen(true);
      }
    } catch (err) {
      setTerminalConfigError(err instanceof Error ? err.message : "Unable to save Clover settings.");
    } finally {
      setTerminalConfigSaving(false);
    }
  };

  const beginTerminalPairing = async () => {
    setTerminalStatusLoading(true);
    setPairingError("");
    setPairingCodeInput("");
    setPairingModalOpen(true);
    try {
      updateTerminalStatus(await startTerminalPairing());
    } catch (err) {
      setPairingError(err instanceof Error ? err.message : "Unable to start Clover pairing.");
    } finally {
      setTerminalStatusLoading(false);
    }
  };

  const submitTerminalPairingCode = async () => {
    const code = pairingCodeInput.trim();
    if (!code) {
      setPairingError("Enter the pairing code shown on the Clover device.");
      return;
    }
    setTerminalStatusLoading(true);
    setPairingError("");
    try {
      updateTerminalStatus(await confirmTerminalPairing(code));
    } catch (err) {
      setPairingError(err instanceof Error ? err.message : "Pairing code did not match.");
    } finally {
      setTerminalStatusLoading(false);
    }
  };

  useEffect(() => {
    void refreshTerminalStatus();
    void loadTerminalConfig();
  }, []);

  useEffect(() => {
    if (activeMethod === "card") {
      void refreshTerminalStatus();
    }
  }, [activeMethod]);

  useEffect(() => {
    if (!pairingModalOpen) return;
    const pollPairing = async () => {
      try {
        updateTerminalStatus(await fetchTerminalPairStatus());
      } catch (err) {
        setPairingError(err instanceof Error ? err.message : "Unable to refresh Clover pairing status.");
      }
    };
    const intervalId = window.setInterval(() => { void pollPairing(); }, 2000);
    return () => window.clearInterval(intervalId);
  }, [pairingModalOpen]);

  useEffect(() => {
    if (activeMethod !== "card" || (terminalConfig?.transport !== "ws-lan" && terminalConfig?.transport !== "rest-cloud") || terminalStatus?.connected) return;
    const intervalId = window.setInterval(() => { void refreshTerminalStatus(); }, 3000);
    return () => window.clearInterval(intervalId);
  }, [activeMethod, terminalConfig?.transport, terminalStatus?.connected]);

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
      addCheckoutItemFromResult(result.saleItem, {
        serviceName: svc.name,
        workerName: selectedWorkerName || "Worker",
        category: svc.category?.name ?? "",
        priceCents: svc.priceCents,
      });
    } catch {
      setError("Failed to add service.");
    } finally {
      setLoading(false);
    }
  };

  const addCheckoutItemFromResult = (
    saleItem: Record<string, unknown>,
    item: Omit<CheckoutItem, "saleItemId" | "discountCents" | "tipCents">
  ) => {
    const saleItemId =
      saleItem && typeof saleItem === "object" && "id" in saleItem
        ? String(saleItem.id)
        : undefined;
    setItems((prev) => [
      ...prev,
      {
        saleItemId,
        ...item,
        discountCents: 0,
        tipCents: 0,
      },
    ]);
  };

  const openCustomServiceModal = () => {
    if (!selectedWorkerId || !saleId) {
      setError("Select a worker first before adding a custom service.");
      return;
    }
    setCustomServiceName("");
    setCustomServicePriceCents(0);
    setCustomServiceCategory("Custom");
    setCustomServiceError("");
    setShowCustomServiceModal(true);
  };

  const handleAddCustomService = async () => {
    if (!selectedWorkerId || !saleId) {
      setCustomServiceError("Select a worker first.");
      return;
    }
    const name = customServiceName.trim();
    if (!name) {
      setCustomServiceError("Service name is required.");
      return;
    }
    if (customServicePriceCents <= 0) {
      setCustomServiceError("Enter a price greater than $0.00.");
      return;
    }

    setCustomServiceError("");
    setLoading(true);
    try {
      const category = customServiceCategory.trim() || "Custom";
      const result = await addSaleItem(saleId, {
        workerId: selectedWorkerId,
        serviceName: name,
        categoryName: category,
        priceCents: customServicePriceCents,
      });
      addCheckoutItemFromResult(result.saleItem, {
        serviceName: name,
        workerName: selectedWorkerName || "Worker",
        category,
        priceCents: customServicePriceCents,
      });
      setShowCustomServiceModal(false);
    } catch {
      setCustomServiceError("Failed to add custom service.");
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

  const makePaymentIdempotencyKey = () => {
    const randomId = globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(36).slice(2)}`;
    return `owner-pos-${saleId}-${randomId}`;
  };

  const readCents = (value: unknown) => (typeof value === "number" && Number.isInteger(value) ? value : 0);

  const applyAllocatedTips = (saleItems: Record<string, unknown>[]) => {
    setItems((prev) => prev.map((item) => {
      const updated = saleItems.find((saleItem) => String(saleItem.id) === item.saleItemId);
      return updated ? { ...item, tipCents: readCents(updated.tipCents) } : item;
    }));
  };

  const prepareCardTerminal = async () => {
    const config = terminalConfig ?? await fetchTerminalConfig();
    setTerminalConfig(config);
    if (config.transport !== "ws-lan" && config.transport !== "rest-cloud") return;

    const status = await fetchTerminalStatus();
    updateTerminalStatus(status);
    if (config.transport === "ws-lan" && !status.connected) {
      setPairingModalOpen(true);
    }
  };

  const paymentFailureMessage = (payment: Record<string, unknown>) => {
    const raw = payment.rawProviderReference;
    if (raw && typeof raw === "object" && "message" in raw && typeof raw.message === "string") {
      return raw.message;
    }
    return "Card payment was sent to Clover but was not approved.";
  };

  const recordPayment = async (amount: number): Promise<boolean> => {
    if (!saleId || amount <= 0) return false;

    let recordedAmountCents = amount;
    let recordedTipCents = 0;

    if (activeMethod === "cash") {
      await addCashPayment(saleId, { amountCents: amount });
    } else if (activeMethod === "gift_card") {
      await addGiftCardPayment(saleId, { amountCents: amount });
    } else if (activeMethod === "card") {
      await prepareCardTerminal();
      const result = await addCardPayment(saleId, {
        amountCents: amount,
        idempotencyKey: makePaymentIdempotencyKey(),
      });
      if (result.terminalStatus !== "approved") {
        throw new Error(paymentFailureMessage(result.payment));
      }
      recordedAmountCents = readCents(result.payment.amountCents) || amount;
      recordedTipCents = readCents(result.payment.tipCents);
      const paymentId = typeof result.payment.id === "string" ? result.payment.id : "";
      if (paymentId && recordedTipCents > 0) {
        setPendingTipAllocation({ paymentId, tipCents: recordedTipCents });
      }
    } else {
      throw new Error("Select a payment method.");
    }

    setPayments((prev) => [...prev, { method: activeMethod, amountCents: recordedAmountCents, tipCents: recordedTipCents }]);
    return true;
  };

  const openPaymentAmountModal = () => {
    setAmountCents(0);
    setPaymentAmountModalOpen(true);
  };

  const appendPaymentDigit = (digit: string) => {
    setAmountCents((current) => {
      const next = Number(`${current}${digit}`);
      return Number.isSafeInteger(next) ? Math.min(next, 99999999) : current;
    });
  };

  const backspacePaymentAmount = () => {
    setAmountCents((current) => Math.floor(current / 10));
  };

  const addPayment = async () => {
    if (!saleId || amountCents <= 0) return;
    const capped = Math.min(amountCents, Math.max(remaining, 0));
    if (capped <= 0) return;
    setLoading(true);
    setError("");
    try {
      const recorded = await recordPayment(capped);
      if (recorded) {
        setAmountCents(0);
        setPaymentAmountModalOpen(false);
      }
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

  const allocatePendingTip = async (splitMode: "even_workers" | "service_amount_percentage") => {
    if (!saleId || !pendingTipAllocation) return;
    setLoading(true);
    setError("");
    try {
      const result = await allocateCardTip(saleId, {
        paymentId: pendingTipAllocation.paymentId,
        splitMode,
      });
      applyAllocatedTips(result.saleItems);
      setPendingTipAllocation(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to allocate tip.");
    } finally {
      setLoading(false);
    }
  };

  const completeCheckout = async () => {
    if (!saleId) return;
    if (pendingTipAllocation) {
      setError("Allocate the Clover tip before completing checkout.");
      return;
    }
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
    clearCheckoutDraft();
    setCheckoutDraftLoaded(false);
    setSaleId(null);
    setItems([]);
    setPayments([]);
    setSelectedWorkerId(null);
    setAmountCents(0);
    setPaymentAmountModalOpen(false);
    setChangeCents(0);
    setError("");
    setHasStarted(false);
    setActiveCategory("All");
    setActiveMethod("cash");
    setPendingTipAllocation(null);
    setMode("active");
  };

  const startNewSale = () => {
    resetSale();
    void initSale();
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
          <Button onClick={startNewSale}>New Sale</Button>
          <Button variant="secondary" onClick={() => { resetSale(); onBack(); }}>
            Back to Floor
          </Button>
        </div>
      </div>
    );
  }

  // ── Loading checkout workspace ──
  if (!hasStarted) {
    return (
      <div className="checkout-start">
        <span style={{ fontSize: "3rem" }}>💳</span>
        <h2 style={{ margin: 0, fontSize: "var(--text-xl)", fontWeight: "var(--font-bold)" }}>Opening Checkout</h2>
        <p className="text-muted text-sm" style={{ maxWidth: 320 }}>
          Preparing a new sale...
        </p>
        {loading && <p className="text-muted text-sm">Loading...</p>}
        {error && <p className="field__error">{error}</p>}
        {error && (
          <Button size="lg" loading={loading} onClick={initSale}>
            Retry
          </Button>
        )}
        <Button variant="ghost" size="sm" onClick={onBack}>← Back to Floor</Button>
      </div>
    );
  }

  // ── Active workspace ──
  return (
    <>
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
          disabled={remaining > 0 || loading || items.length === 0 || pendingTipAllocation !== null}
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
          <div className="checkout-column__header">
            <p className="checkout-column__title">💅 Services</p>
            <Button size="sm" variant="secondary" onClick={openCustomServiceModal}>
              Custom
            </Button>
          </div>
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
                      <span style={{ fontSize: "var(--text-xs)", color: "var(--color-text-muted)" }}>
                        {item.tipCents > 0 ? `Tip allocated: ${formatMoney(item.tipCents)}` : "Tips are added on Clover during card payment."}
                      </span>
                    </div>
                  </div>
                  <div className="checkout-sale-item__right">
                    <span className="checkout-sale-item__price">
                      {formatMoney(item.priceCents - item.discountCents)}
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
            <div
              className={`terminal-status-card terminal-status-card--${terminalStep} ${terminalStatus?.connected ? "terminal-status-card--connected" : "terminal-status-card--disconnected"}`}
            >
              <div className="terminal-status-card__main">
                <div className="terminal-status-card__header">
                  <span className="terminal-status-card__badge">{terminalStep === "ready" ? "Ready" : terminalStep === "pair" ? "Pair" : terminalStep === "checking" ? "Checking" : "Connect"}</span>
                  <strong>{terminalDisplayName}</strong>
                </div>
                <span>{terminalStatus?.message ?? "Checking payment terminal..."}</span>
                {terminalStatus?.pairingCode && <div className="terminal-inline-code">Enter on Clover: {terminalStatus.pairingCode}</div>}
                <details className="terminal-info-popover">
                  <summary aria-label="Show Clover connection details">i</summary>
                  <div className="terminal-info-popover__content">
                    <ol className="terminal-process-list" aria-label="Clover connection process">
                      <li className={terminalConfig ? "terminal-process-list__step--done" : "terminal-process-list__step--active"}>Configure Clover IP, app ID, and device serial.</li>
                      <li className={terminalStatus?.pairingCode || terminalStatus?.connected ? "terminal-process-list__step--done" : "terminal-process-list__step--active"}>Start connection from the local API.</li>
                      <li className={terminalStatus?.connected ? "terminal-process-list__step--done" : terminalStatus?.pairingCode ? "terminal-process-list__step--active" : ""}>If a code appears here, enter it on the Clover Mini.</li>
                      <li className={terminalStatus?.connected ? "terminal-process-list__step--done" : ""}>Wait for “Ready”, then run card payment.</li>
                    </ol>
                    <span>Endpoint: {terminalEndpoint}</span>
                    {terminalConfig?.merchantId && <span>Merchant: {terminalConfig.merchantId}</span>}
                    {terminalConfig?.appId && <span>App ID: {terminalConfig.appId}</span>}
                    {terminalConfig?.remoteApplicationId && <span>App: {terminalConfig.remoteApplicationId}</span>}
                    {terminalConfig?.serialNumber && <span>Device: {terminalConfig.serialNumber}</span>}
                    {terminalConfig?.deviceId && <span>Device ID: {terminalConfig.deviceId}</span>}
                  </div>
                </details>
              </div>
              <div className="terminal-status-card__actions">
                <button type="button" onClick={openTerminalConfig} disabled={terminalStatusLoading}>
                  Configure
                </button>
                <button
                  type="button"
                  onClick={() => { isCloverCloudRest ? void refreshTerminalStatus() : void beginTerminalPairing(); }}
                  disabled={terminalStatusLoading || terminalTransport === "mock"}
                >
                  {isCloverCloudRest ? "Check Connection" : "Connect / Pair"}
                </button>
                <button type="button" onClick={() => { void refreshTerminalStatus(); }} disabled={terminalStatusLoading}>
                  {terminalStatusLoading ? "..." : "Refresh"}
                </button>
              </div>
            </div>

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
            {activeMethod === "card" && (terminalConfig?.transport === "ws-lan" || terminalConfig?.transport === "rest-cloud") && !terminalStatus?.connected && (
              <div className="card-payment-readiness">
                <strong>Clover is not ready</strong>
                <span>You can still press Send to call the Clover adapter, but Clover may reject it until the terminal reports Ready.</span>
                <button type="button" onClick={() => { isCloverCloudRest ? void refreshTerminalStatus() : void beginTerminalPairing(); }} disabled={terminalStatusLoading}>
                  {isCloverCloudRest ? "Check Clover" : "Connect Clover"}
                </button>
              </div>
            )}
            <div className="payment-action-stack">
              {remaining > 0 && (
                <Button fullWidth variant="secondary" onClick={exactPayment} loading={loading} size="lg" className="payment-touch-button">
                  {activeMethod === "card" && (terminalConfig?.transport === "ws-lan" || terminalConfig?.transport === "rest-cloud") ? "Send Exact to Clover" : "Pay Exact"}
                  <span className="payment-touch-button__amount">{formatMoney(remaining)}</span>
                </Button>
              )}
              <Button
                fullWidth
                variant="ghost"
                size="lg"
                className="payment-touch-button payment-touch-button--custom"
                onClick={openPaymentAmountModal}
                disabled={remaining <= 0 || loading}
              >
                Enter Custom Amount
              </Button>
            </div>

            {/* Payment entries */}
            {payments.length > 0 && (
              <div className="payment-entries">
                {payments.map((p, i) => (
                  <div key={i} className="payment-entry">
                    <span className="payment-entry__method">
                      {methodLabel(p.method)}{p.tipCents ? ` · tip ${formatMoney(p.tipCents)}` : ""}
                    </span>
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
    <Modal
      open={paymentAmountModalOpen}
      onClose={() => setPaymentAmountModalOpen(false)}
      title={`${methodLabel(activeMethod)} Amount`}
      className="payment-keypad-modal"
      footer={
        <>
          <Button variant="secondary" size="lg" onClick={() => setPaymentAmountModalOpen(false)}>Cancel</Button>
          <Button size="lg" onClick={() => { void addPayment(); }} loading={loading} disabled={amountCents <= 0 || remaining <= 0}>
            {activeMethod === "card" && (terminalConfig?.transport === "ws-lan" || terminalConfig?.transport === "rest-cloud") ? "Send to Clover" : `Add ${methodLabel(activeMethod)}`}
          </Button>
        </>
      }
    >
      <div className="payment-keypad">
        <div className="payment-keypad__display" aria-live="polite">
          <span>Amount</span>
          <strong>{formatMoney(amountCents)}</strong>
          <small>Remaining {formatMoney(remaining)}</small>
        </div>
        <div className="payment-keypad__grid" aria-label="Payment amount keypad">
          {["1", "2", "3", "4", "5", "6", "7", "8", "9"].map((digit) => (
            <button key={digit} type="button" onClick={() => appendPaymentDigit(digit)}>{digit}</button>
          ))}
          <button type="button" onClick={() => appendPaymentDigit("0")}>0</button>
          <button type="button" onClick={() => appendPaymentDigit("00")}>00</button>
          <button type="button" onClick={backspacePaymentAmount}>⌫</button>
        </div>
        <div className="payment-keypad__shortcuts">
          <button type="button" onClick={() => setAmountCents(0)}>Clear</button>
          <button type="button" onClick={() => setAmountCents(Math.floor(remaining / 2))}>Half</button>
          <button type="button" onClick={() => setAmountCents(remaining)}>Remaining</button>
        </div>
      </div>
    </Modal>
    <Modal
      open={terminalConfigOpen}
      onClose={() => setTerminalConfigOpen(false)}
      title="Clover Connection Settings"
      className="terminal-config-modal"
      footer={
        <>
          <Button variant="secondary" onClick={() => setTerminalConfigOpen(false)}>Cancel</Button>
          <Button onClick={() => { void saveTerminalConfig(); }} loading={terminalConfigSaving}>Save & Connect</Button>
        </>
      }
    >
      <div className="terminal-config-form">
        <p className="text-muted text-sm" style={{ marginTop: 0 }}>
          Configure the payment terminal used by this Checkout tab. Save & Connect applies the config on the local API. Tokens and secrets are kept on the local API and are never shown in full.
        </p>
        <Select
          label="Terminal Mode"
          value={terminalConfigForm.transport}
          onChange={(event) => setTerminalConfigForm((form) => ({ ...form, transport: event.target.value as TerminalConfigForm["transport"] }))}
          options={[
            { value: "mock", label: "Built-in mock terminal" },
            { value: "ws-lan", label: "Real Clover LAN WebSocket" },
            { value: "rest-cloud", label: "Clover Cloud REST Pay Display" },
            { value: "rest-local", label: "Mock Clover / REST-local" },
          ]}
        />
        {terminalConfigForm.transport === "rest-cloud" && (
          <>
            <div className="clover-process-panel clover-process-panel--compact">
              <div><strong>Cloud REST process:</strong> enter the Clover cloud endpoint, merchant/app details, device ID, POS ID, and access token. OAuth token setup is manual for this version.</div>
            </div>
            <Input label="Clover Cloud Base URL" value={terminalConfigForm.cloudBaseUrl} onChange={(event) => setTerminalConfigForm((form) => ({ ...form, cloudBaseUrl: event.target.value }))} placeholder="https://sandbox.dev.clover.com/connect" />
            <Input label="Merchant ID" value={terminalConfigForm.merchantId} onChange={(event) => setTerminalConfigForm((form) => ({ ...form, merchantId: event.target.value }))} placeholder="13-character Clover ID" />
            <Input label="App ID" value={terminalConfigForm.appId} onChange={(event) => setTerminalConfigForm((form) => ({ ...form, appId: event.target.value }))} placeholder="Clover app ID" />
            <Input label={`App Secret${terminalConfig?.appSecretPreview ? ` (${terminalConfig.appSecretPreview})` : ""}`} value={terminalConfigForm.appSecret} onChange={(event) => setTerminalConfigForm((form) => ({ ...form, appSecret: event.target.value }))} placeholder="Leave blank to keep existing secret" />
            <Input label={`Access Token${terminalConfig?.accessTokenPreview ? ` (${terminalConfig.accessTokenPreview})` : ""}`} value={terminalConfigForm.accessToken} onChange={(event) => setTerminalConfigForm((form) => ({ ...form, accessToken: event.target.value }))} placeholder="Leave blank to keep existing token" />
            <Input label="Device ID" value={terminalConfigForm.deviceId} onChange={(event) => setTerminalConfigForm((form) => ({ ...form, deviceId: event.target.value }))} placeholder="Clover device ID" />
            <Input label="POS ID" value={terminalConfigForm.posId} onChange={(event) => setTerminalConfigForm((form) => ({ ...form, posId: event.target.value }))} placeholder="owner-pos" />
            <Input label="Remote App ID" value={terminalConfigForm.remoteApplicationId} onChange={(event) => setTerminalConfigForm((form) => ({ ...form, remoteApplicationId: event.target.value }))} placeholder="developerId.appId" />
          </>
        )}
        {terminalConfigForm.transport === "ws-lan" && (
          <>
            <div className="clover-process-panel clover-process-panel--compact">
              <div><strong>Real Mini 3 process:</strong> enter the Clover IP, application ID, and device serial; save; enter the POS pairing code on the Clover if prompted; wait for Ready.</div>
            </div>
            <Input label="Clover LAN Host/IP" value={terminalConfigForm.wsHost} onChange={(event) => setTerminalConfigForm((form) => ({ ...form, wsHost: event.target.value }))} placeholder="192.168.0.18" />
            <Input label="WebSocket Port" value={terminalConfigForm.wsPort} onChange={(event) => setTerminalConfigForm((form) => ({ ...form, wsPort: event.target.value.replace(/\D/g, "") }))} placeholder="12345" />
            <Input label="WebSocket Path" value={terminalConfigForm.wsPath} onChange={(event) => setTerminalConfigForm((form) => ({ ...form, wsPath: event.target.value }))} placeholder="/remote_pay" />
            <label className="field terminal-config-checkbox">
              <span className="field__label">Secure WebSocket</span>
              <input type="checkbox" checked={terminalConfigForm.wsSecure} onChange={(event) => setTerminalConfigForm((form) => ({ ...form, wsSecure: event.target.checked }))} />
              <span>{terminalConfigForm.wsSecure ? "wss://" : "ws://"}</span>
            </label>
            <Input label="Remote App ID" value={terminalConfigForm.remoteApplicationId} onChange={(event) => setTerminalConfigForm((form) => ({ ...form, remoteApplicationId: event.target.value }))} placeholder="RQ07XH5Z3EX44.BT1G67W0JJFVC" />
            <Input label="POS Name Shown on Clover" value={terminalConfigForm.posName} onChange={(event) => setTerminalConfigForm((form) => ({ ...form, posName: event.target.value }))} placeholder="Nail Salon POS" />
            <Input label="Clover Device Serial" value={terminalConfigForm.serialNumber} onChange={(event) => setTerminalConfigForm((form) => ({ ...form, serialNumber: event.target.value }))} placeholder="C035UT24950367" />
            <Input label={`Auth Token${terminalConfig?.authTokenPreview ? ` (${terminalConfig.authTokenPreview})` : ""}`} value={terminalConfigForm.authToken} onChange={(event) => setTerminalConfigForm((form) => ({ ...form, authToken: event.target.value }))} placeholder="Leave blank to keep existing token" />
          </>
        )}
        {terminalConfigForm.transport === "rest-local" && (
          <>
            <Input label="Mock Clover Base URL" value={terminalConfigForm.deviceBaseUrl} onChange={(event) => setTerminalConfigForm((form) => ({ ...form, deviceBaseUrl: event.target.value }))} placeholder="http://localhost:4100" />
            <Input label="Device ID" value={terminalConfigForm.deviceId} onChange={(event) => setTerminalConfigForm((form) => ({ ...form, deviceId: event.target.value }))} placeholder="mock-clover-mini-1" />
            <Input label="POS ID" value={terminalConfigForm.posId} onChange={(event) => setTerminalConfigForm((form) => ({ ...form, posId: event.target.value }))} placeholder="owner-pos-dev" />
            <Input label={`Access Token${terminalConfig?.accessTokenPreview ? ` (${terminalConfig.accessTokenPreview})` : ""}`} value={terminalConfigForm.accessToken} onChange={(event) => setTerminalConfigForm((form) => ({ ...form, accessToken: event.target.value }))} placeholder="Leave blank to keep existing token" />
          </>
        )}
        {terminalConfigError && <p className="field__error">{terminalConfigError}</p>}
      </div>
    </Modal>
    <Modal
      open={pairingModalOpen}
      onClose={() => setPairingModalOpen(false)}
      title={isRealCloverLan ? "Connect Clover Mini 3" : "Pair Clover Device"}
      className="clover-pairing-modal"
      footer={
        <>
          <Button variant="secondary" onClick={() => { void refreshTerminalStatus(); }} loading={terminalStatusLoading}>
            Refresh Status
          </Button>
          <Button variant="secondary" onClick={() => { void beginTerminalPairing(); }} loading={terminalStatusLoading}>
            Restart Connect
          </Button>
          {!isRealCloverLan && (
            <Button onClick={() => { void submitTerminalPairingCode(); }} loading={terminalStatusLoading}>
              Pair
            </Button>
          )}
        </>
      }
    >
      {terminalStatus?.connected ? (
        <div className="clover-pairing-status clover-pairing-status--connected">
          Clover is connected and ready for card payments.
        </div>
      ) : isRealCloverLan ? (
        <div className="clover-pairing-content">
          <div className="clover-process-panel">
            <div><strong>1.</strong> Keep Secure Network Pay Display open on the Clover Mini.</div>
            <div><strong>2.</strong> POS connects to {terminalEndpoint} from the local API.</div>
            <div><strong>3.</strong> If Clover asks for pairing, enter the POS code below on the Clover Mini.</div>
            <div><strong>4.</strong> Leave this window open until status changes to Ready.</div>
          </div>
          {terminalStatus?.pairingCode ? (
            <>
              <div className="clover-pairing-code">{terminalStatus.pairingCode}</div>
              <p className="clover-pairing-status">Enter this code on the Clover Mini. The POS will continue automatically after Clover approves pairing.</p>
            </>
          ) : (
            <p className="clover-pairing-status">{terminalStatus?.message ?? "Waiting for Clover to send a pairing code or ready status..."}</p>
          )}
          {pairingError && <p className="field__error">{pairingError}</p>}
        </div>
      ) : (
        <div className="clover-pairing-content">
          <p className="text-muted text-sm" style={{ marginTop: 0 }}>
            For mock Clover, look at the code shown on the mock Clover screen, then enter that code here in POS.
          </p>
          <Input
            label="Pairing Code"
            value={pairingCodeInput}
            onChange={(event) => setPairingCodeInput(event.target.value.replace(/\D/g, "").slice(0, 6))}
            placeholder="123456"
          />
          <p className="clover-pairing-status">
            {terminalStatus?.message ?? "Waiting for the code shown on mock Clover..."}
          </p>
          {pairingError && <p className="field__error">{pairingError}</p>}
        </div>
      )}
    </Modal>
    <Modal
      open={pendingTipAllocation !== null}
      onClose={() => {}}
      title="Allocate Clover Tip"
      className="checkout-tip-allocation-modal"
      footer={
        <>
          <Button
            variant="secondary"
            onClick={() => { void allocatePendingTip("service_amount_percentage"); }}
            loading={loading}
          >
            By Service Amount
          </Button>
          <Button
            onClick={() => { void allocatePendingTip("even_workers"); }}
            loading={loading}
          >
            Evenly Between Workers
          </Button>
        </>
      }
    >
      <p className="text-muted text-sm" style={{ marginTop: 0 }}>
        Clover returned a tip of <strong>{formatMoney(pendingTipAllocation?.tipCents ?? 0)}</strong>. Choose how to split it for worker reports.
      </p>
      <div className="tip-allocation-options">
        <div className="tip-allocation-option">
          <strong>By service amount</strong>
          <span>Distributes the tip across all services by each discounted service amount.</span>
        </div>
        <div className="tip-allocation-option">
          <strong>Evenly between workers</strong>
          <span>Each worker receives the same tip share, then that worker's share is divided across their services by service amount.</span>
        </div>
      </div>
    </Modal>
    <Modal
      open={showCustomServiceModal}
      onClose={() => setShowCustomServiceModal(false)}
      title="Add Custom Service"
      className="checkout-custom-service-modal"
      footer={
        <>
          <Button variant="secondary" onClick={() => setShowCustomServiceModal(false)}>Cancel</Button>
          <Button onClick={handleAddCustomService} loading={loading}>Add Service</Button>
        </>
      }
    >
      <p className="text-muted text-sm" style={{ marginTop: 0 }}>
        This creates a one-time checkout item only. It will not be added to the service catalog.
      </p>
      <Input
        label="Service Name"
        value={customServiceName}
        onChange={(event) => setCustomServiceName(event.target.value)}
        placeholder="e.g. Nail repair"
        autoFocus
      />
      <Input
        label="Category"
        value={customServiceCategory}
        onChange={(event) => setCustomServiceCategory(event.target.value)}
        placeholder="Custom"
      />
      <AmountInput
        label="Price"
        valueCents={customServicePriceCents}
        onChangeCents={setCustomServicePriceCents}
      />
      {customServiceError && <p className="field__error">{customServiceError}</p>}
    </Modal>
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
  const [showCategoryPicker, setShowCategoryPicker] = useState(false);
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
  const selectedFormCategory = categories.find((category) => category.id === formCategoryId) ?? null;
  const categoryTiles = catNames.map((categoryName) => ({
    key: categoryName,
    label: categoryName === "all" ? "All" : categoryName,
    count: categoryName === "all"
      ? services.length
      : services.filter((service) => (service.category?.name ?? service.categoryId) === categoryName).length,
  }));

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
          <div className="services-header-actions">
            <Button size="sm" variant="secondary" onClick={() => { setShowNewCatForm(true); setNewCatName(""); }}>
              + Category
            </Button>
            <Button size="sm" onClick={openAddModal}>
              + Add Service
            </Button>
          </div>
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

      <div className="services-layout">
        <aside className="services-category-rail" aria-label="Service categories">
          {categoryTiles.map((category) => (
            <button
              key={category.key}
              type="button"
              className={`services-category-tile ${activeCat === category.key ? "services-category-tile--active" : ""}`}
              onClick={() => setActiveCat(category.key)}
            >
              <strong>{category.label}</strong>
              <small>{category.count} service{category.count === 1 ? "" : "s"}</small>
            </button>
          ))}
          <button
            type="button"
            className="services-category-tile services-category-tile--add"
            onClick={() => { setShowNewCatForm(true); setNewCatName(""); }}
          >
            <strong>+ Category</strong>
            <small>Add new group</small>
          </button>
        </aside>

        <section className="services-results">
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
        </section>
      </div>

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
        <div className="service-form-picker-row">
          <span className="field__label">Category</span>
          <button className="service-form-picker" type="button" onClick={() => setShowCategoryPicker(true)}>
            <strong>{selectedFormCategory?.name ?? "Choose category"}</strong>
            <small>Tap to change</small>
          </button>
          <Button size="sm" variant="ghost" onClick={() => { setShowNewCatForm(true); setNewCatName(""); }} type="button">
            + New
          </Button>
        </div>
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

      <Modal open={showCategoryPicker} onClose={() => setShowCategoryPicker(false)} title="Choose Category" className="service-picker-modal">
        <div className="service-category-picker-grid">
          {categories.map((category) => (
            <button
              key={category.id}
              type="button"
              className={`service-category-picker-tile ${formCategoryId === category.id ? "service-category-picker-tile--selected" : ""}`}
              onClick={() => {
                setFormCategoryId(category.id);
                setShowCategoryPicker(false);
              }}
            >
              <strong>{category.name}</strong>
              <small>{services.filter((service) => service.categoryId === category.id).length} services</small>
            </button>
          ))}
          <button
            type="button"
            className="service-category-picker-tile service-category-picker-tile--add"
            onClick={() => {
              setShowCategoryPicker(false);
              setShowNewCatForm(true);
              setNewCatName("");
            }}
          >
            <strong>+ New</strong>
            <small>Add category</small>
          </button>
        </div>
      </Modal>

      <Modal
        open={showNewCatForm}
        onClose={() => setShowNewCatForm(false)}
        title="Add Category"
        className="service-picker-modal service-category-create-modal"
        footer={
          <>
            <Button variant="secondary" onClick={() => setShowNewCatForm(false)}>Cancel</Button>
            <Button onClick={handleAddCategory} loading={addingCat} disabled={!newCatName.trim()}>Save Category</Button>
          </>
        }
      >
        <Input
          label="Category Name"
          value={newCatName}
          onChange={(e) => setNewCatName(e.target.value)}
          placeholder="e.g. Waxing"
          autoFocus
        />
      </Modal>
    </>
  );
}

/* ════════════════════════════════════════
   Workers Management
   ════════════════════════════════════════ */

function WorkersScreen({
  onOpenReportsForWorker,
}: {
  onOpenReportsForWorker: (workerId: string, report?: WorkerReportKey) => void;
}) {
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
  const [formPin, setFormPin] = useState("");
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
    setFormPin("");
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
    setFormPin("");
    setFormError("");
    setEditingWorker(w);
    setShowAddModal(true);
  };

  const handleSave = async () => {
    setFormError("");
    const payload = buildWorkerSavePayload({
      mode: editingWorker ? "edit" : "create",
      name: formName,
      displayName: formDisplayName,
      email: formEmail,
      phone: formPhone,
      commissionText: formCommissionText,
      pin: formPin,
    });
    if (!payload.ok) {
      setFormError(payload.error);
      return;
    }

    setSaving(true);
    try {
      if (payload.kind === "update") {
        if (!editingWorker) return;
        await updateWorker(editingWorker.id, payload.data);
      } else {
        await createWorker(payload.data);
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
              <div className="mgmt-card__actions mgmt-card__actions--reports">
                <Button
                  size="sm"
                  variant="secondary"
                  onClick={() => onOpenReportsForWorker(w.id)}
                >
                  View Earnings
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => onOpenReportsForWorker(w.id, "sales")}
                >
                  Sales
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => onOpenReportsForWorker(w.id, "turns")}
                >
                  Turns
                </Button>
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
        <Input
          label={editingWorker ? "New Worker PIN (optional)" : "Worker PIN"}
          type="password"
          value={formPin}
          onChange={(e) => setFormPin(e.target.value)}
          placeholder={editingWorker ? "Leave blank to keep current PIN" : "4-6 digits"}
          inputMode="numeric"
          pattern="[0-9]*"
          maxLength={6}
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

type ReportKey = "sales" | "workers" | "turns" | "payments" | "refunds" | "discounts" | "eod";
type DatePreset = "today" | "yesterday" | "week" | "month" | "custom";

function getReportPresetRange(preset: DatePreset) {
  const today = new Date();
  const start = new Date(today);
  const end = new Date(today);

  if (preset === "yesterday") {
    start.setDate(today.getDate() - 1);
    end.setDate(today.getDate() - 1);
  } else if (preset === "week") {
    start.setDate(today.getDate() - today.getDay());
  } else if (preset === "month") {
    start.setDate(1);
  }

  return { start: toDateInputValue(start), end: toDateInputValue(end) };
}

function formatDateTime(value: string | null) {
  return value ? new Date(value).toLocaleString() : "-";
}

function formatCommissionRates(rates: number[], fallbackRate: number) {
  const source = rates.length > 0 ? rates : [fallbackRate];
  return source.map((rate) => `${Math.round(rate * 100)}%`).join(", ");
}

function formatDiscountValue(discount: DiscountReportRow) {
  if (discount.amountCents > 0) return formatMoney(discount.amountCents);
  if (discount.percent == null) return discount.type;

  const percent = Number(discount.percent);
  return Number.isFinite(percent) ? `${Math.round(percent * 100)}%` : String(discount.percent);
}

const reportTypeOptions: { key: ReportKey; label: string; icon: string; description: string }[] = [
  { key: "sales", label: "Sales", icon: "Sales", description: "Tickets, services, tips, and collected totals" },
  { key: "workers", label: "Workers", icon: "Staff", description: "Commission, tips, and total worker pay" },
  { key: "turns", label: "Turns", icon: "Turns", description: "Turn detail, completion, and duration" },
  { key: "payments", label: "Payments", icon: "Pay", description: "Approved payments by method and provider" },
  { key: "refunds", label: "Refunds", icon: "Back", description: "Refund count and refund totals" },
  { key: "discounts", label: "Discounts", icon: "Deal", description: "Discount usage by ticket and service" },
  { key: "eod", label: "End of Day", icon: "EOD", description: "Closeout totals and reconciliation" },
];

const datePresetOptions: { key: DatePreset; label: string; description: string }[] = [
  { key: "today", label: "Today", description: "Current business day" },
  { key: "yesterday", label: "Yesterday", description: "Previous business day" },
  { key: "week", label: "This week", description: "Sunday through today" },
  { key: "month", label: "This month", description: "Month-to-date" },
  { key: "custom", label: "Custom range", description: "Choose start and end dates" },
];

function workerDisplayName(worker: Worker) {
  return worker.displayName || worker.user?.name || "Worker";
}

function ReportsScreen({
  initialReport,
  initialWorkerId,
}: {
  initialReport?: WorkerReportTarget["report"];
  initialWorkerId?: string;
}) {
  const [activeReport, setActiveReport] = useState<ReportKey>(initialReport ?? "sales");
  const [datePreset, setDatePreset] = useState<DatePreset>("today");
  const [startDate, setStartDate] = useState(() => toDateInputValue(new Date()));
  const [endDate, setEndDate] = useState(() => toDateInputValue(new Date()));
  const [selectedWorkerId, setSelectedWorkerId] = useState(initialWorkerId ?? "");
  const [selectedPaymentMethod, setSelectedPaymentMethod] = useState("");
  const [reportPickerOpen, setReportPickerOpen] = useState(false);
  const [datePickerOpen, setDatePickerOpen] = useState(false);
  const [workerPickerOpen, setWorkerPickerOpen] = useState(false);
  const [paymentPickerOpen, setPaymentPickerOpen] = useState(false);
  const [reportWorkers, setReportWorkers] = useState<Worker[]>([]);
  const [loading, setLoading] = useState(false);
  const [reportError, setReportError] = useState("");
  const [salesSummary, setSalesSummary] = useState<SalesReportSummary | null>(null);
  const [salesTickets, setSalesTickets] = useState<SalesReportTicket[]>([]);
  const [selectedTicket, setSelectedTicket] = useState<SalesReportTicket | null>(null);
  const [workerEarnings, setWorkerEarnings] = useState<WorkerEarningsRow[]>([]);
  const [turnDetails, setTurnDetails] = useState<TurnDetail[]>([]);
  const [paymentSummary, setPaymentSummary] = useState<PaymentReportSummary | null>(null);
  const [paymentRows, setPaymentRows] = useState<PaymentReportRow[]>([]);
  const [refundSummary, setRefundSummary] = useState<{ refundTotalCents: number; refundCount: number } | null>(null);
  const [refundRows, setRefundRows] = useState<RefundReportRow[]>([]);
  const [discountSummary, setDiscountSummary] = useState<{ discountTotalCents: number; discountCount: number } | null>(null);
  const [discountRows, setDiscountRows] = useState<DiscountReportRow[]>([]);
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
    workerTipsPayoutCents?: number;
    businessShareCents: number;
    totalPayCents?: number;
    totalCollectedCents: number;
  } | null>(null);

  const dateRangeError = startDate && endDate && endDate < startDate
    ? "End date must be on or after the start date."
    : "";
  const supportsPaymentFilter = activeReport === "sales" || activeReport === "payments";
  const reportParams = {
    start: startDate ? `${startDate}T00:00:00` : undefined,
    end: endDate ? `${addDaysToDateInput(endDate, 1)}T00:00:00` : undefined,
    workerId: selectedWorkerId || undefined,
    paymentMethod: supportsPaymentFilter && selectedPaymentMethod ? selectedPaymentMethod : undefined,
  };

  const clearReportData = () => {
    setSalesSummary(null);
    setSalesTickets([]);
    setSelectedTicket(null);
    setWorkerEarnings([]);
    setTurnDetails([]);
    setPaymentSummary(null);
    setPaymentRows([]);
    setRefundSummary(null);
    setRefundRows([]);
    setDiscountSummary(null);
    setDiscountRows([]);
    setEodData(null);
  };

  const setReportFailure = (error: unknown) => {
    clearReportData();
    setReportError(error instanceof Error ? error.message : "Failed to load report data.");
  };

  const runReportLoad = async (loader: () => Promise<void>) => {
    if (dateRangeError) {
      clearReportData();
      setReportError(dateRangeError);
      return;
    }

    setLoading(true);
    setReportError("");
    try {
      await loader();
    } catch (error) {
      setReportFailure(error);
    } finally {
      setLoading(false);
    }
  };

  const loadSales = () => runReportLoad(async () => {
    setSalesSummary(null);
    setSalesTickets([]);
    const data = await fetchSalesReport(reportParams);
    setSalesSummary(data.summary);
    setSalesTickets(data.sales);
  });

  const loadWorkers = () => runReportLoad(async () => {
    setWorkerEarnings([]);
    const data = await fetchWorkerEarnings(reportParams);
    setWorkerEarnings(data.workers);
  });

  const loadTurns = () => runReportLoad(async () => {
    setTurnDetails([]);
    const data = await fetchTurnDetail(reportParams);
    setTurnDetails(data.turns);
  });

  const loadPayments = () => runReportLoad(async () => {
    setPaymentSummary(null);
    setPaymentRows([]);
    const data = await fetchPaymentReport(reportParams);
    setPaymentSummary(data.summary);
    setPaymentRows(data.payments);
  });

  const loadRefunds = () => runReportLoad(async () => {
    setRefundSummary(null);
    setRefundRows([]);
    const data = await fetchRefundReport(reportParams);
    setRefundSummary(data.summary);
    setRefundRows(data.refunds);
  });

  const loadDiscounts = () => runReportLoad(async () => {
    setDiscountSummary(null);
    setDiscountRows([]);
    const data = await fetchDiscountReport(reportParams);
    setDiscountSummary(data.summary);
    setDiscountRows(data.discounts);
  });

  const loadEod = () => runReportLoad(async () => {
    setEodData(null);
    const data = await fetchEndOfDayReport(reportParams);
    setEodData(data);
  });

  const refresh = () => {
    if (activeReport === "sales") void loadSales();
    else if (activeReport === "workers") void loadWorkers();
    else if (activeReport === "turns") void loadTurns();
    else if (activeReport === "payments") void loadPayments();
    else if (activeReport === "refunds") void loadRefunds();
    else if (activeReport === "discounts") void loadDiscounts();
    else if (activeReport === "eod") void loadEod();
  };

  useEffect(() => {
    refresh();
  }, [activeReport, startDate, endDate, selectedWorkerId, selectedPaymentMethod]);

  useEffect(() => {
    if (initialReport) setActiveReport(initialReport);
    if (initialWorkerId !== undefined) setSelectedWorkerId(initialWorkerId);
  }, [initialReport, initialWorkerId]);

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

  const applyDatePreset = (preset: DatePreset) => {
    setDatePreset(preset);
    if (preset === "custom") return;

    const range = getReportPresetRange(preset);
    setStartDate(range.start);
    setEndDate(range.end);
  };

  const handleStartDateChange = (value: string) => {
    setDatePreset("custom");
    setStartDate(value);
  };

  const handleEndDateChange = (value: string) => {
    setDatePreset("custom");
    setEndDate(value);
  };

  const reportLabel = startDate && endDate
    ? startDate === endDate ? startDate : `${startDate} - ${endDate}`
    : "Selected range";
  const selectedWorker = reportWorkers.find((worker) => worker.id === selectedWorkerId);
  const selectedWorkerName = selectedWorker ? workerDisplayName(selectedWorker) : "";
  const selectedPaymentLabel = selectedPaymentMethod ? methodLabel(selectedPaymentMethod) : "";
  const activeReportLabel = reportTypeOptions.find((option) => option.key === activeReport)?.label ?? "Report";
  const datePresetLabel = datePresetOptions.find((option) => option.key === datePreset)?.label ?? "Custom";
  const filterDescription = [
    reportLabel,
    selectedWorkerName ? `for ${selectedWorkerName}` : "All workers",
    selectedPaymentLabel ? `paid by ${selectedPaymentLabel}` : supportsPaymentFilter ? "All payments" : "",
  ].filter(Boolean).join(" · ");
  const paymentOptions = [
    { value: "", label: "All methods", icon: "All" },
    { value: "cash", label: "Cash", icon: "Cash" },
    { value: "card", label: "Card", icon: "Card" },
    { value: "gift_card", label: "Gift Card", icon: "Gift" },
  ];
  const workerTotals = workerEarnings.reduce((totals, worker) => ({
    services: totals.services + worker.services,
    netSalesCents: totals.netSalesCents + worker.netSalesCents,
    commissionCents: totals.commissionCents + worker.commissionCents,
    tipsCents: totals.tipsCents + worker.tipsCents,
    totalPayCents: totals.totalPayCents + worker.totalPayCents,
  }), { services: 0, netSalesCents: 0, commissionCents: 0, tipsCents: 0, totalPayCents: 0 });
  const completedTurns = turnDetails.filter((turn) => turn.status === "completed").length;
  const skippedTurns = turnDetails.filter((turn) => turn.status === "skipped").length;
  const durations = turnDetails
    .map((turn) => turn.durationMinutes)
    .filter((minutes): minutes is number => typeof minutes === "number");
  const avgDuration = durations.length > 0
    ? Math.round(durations.reduce((sum, minutes) => sum + minutes, 0) / durations.length)
    : 0;
  const selectedTicketWorkerBreakdown = selectedTicket
    ? Object.values(selectedTicket.services.reduce<Record<string, {
        workerId: string;
        workerName: string;
        services: string[];
        netSalesCents: number;
        commissionCents: number;
        tipsCents: number;
        payCents: number;
      }>>((workersById, service) => {
        const existing = workersById[service.workerId] ?? {
          workerId: service.workerId,
          workerName: service.workerName,
          services: [],
          netSalesCents: 0,
          commissionCents: 0,
          tipsCents: 0,
          payCents: 0,
        };
        existing.services.push(service.serviceName);
        existing.netSalesCents += service.finalServiceCents;
        existing.commissionCents += service.commissionCents;
        existing.tipsCents += service.tipsCents;
        existing.payCents += service.payCents;
        workersById[service.workerId] = existing;
        return workersById;
      }, {}))
    : [];

  return (
    <>
      <header>
        <p className="eyebrow">Reports</p>
        <div className="app-bar">
          <h1 className="app-bar__title">Reports</h1>
          <Button size="sm" variant="secondary" onClick={refresh} loading={loading}>Refresh</Button>
        </div>
      </header>

      <div className="report-ipad-toolbar">
        <button className="report-filter-card report-filter-card--primary" type="button" onClick={() => setReportPickerOpen(true)}>
          <span className="report-filter-card__label">Report</span>
          <strong>{activeReportLabel}</strong>
          <small>Tap to switch report</small>
        </button>
        <button className="report-filter-card" type="button" onClick={() => setDatePickerOpen(true)}>
          <span className="report-filter-card__label">Date</span>
          <strong>{datePreset === "custom" ? reportLabel : datePresetLabel}</strong>
          <small>{reportLabel}</small>
        </button>
        <button className="report-filter-card" type="button" onClick={() => setWorkerPickerOpen(true)}>
          <span className="report-filter-card__label">Worker</span>
          <strong>{selectedWorkerName || "All workers"}</strong>
          <small>{selectedWorkerId ? "Filtered" : "Whole salon"}</small>
        </button>
        {supportsPaymentFilter && (
          <button className="report-filter-card" type="button" onClick={() => setPaymentPickerOpen(true)}>
            <span className="report-filter-card__label">Payment</span>
            <strong>{selectedPaymentLabel || "All methods"}</strong>
            <small>{selectedPaymentMethod ? "Filtered" : "Cash, card, gift card"}</small>
          </button>
        )}
      </div>

      <div className="report-type-grid" role="tablist" aria-label="Report type">
        {reportTypeOptions.map((option) => (
          <button
            key={option.key}
            type="button"
            role="tab"
            aria-selected={activeReport === option.key}
            className={`report-type-card ${activeReport === option.key ? "report-type-card--active" : ""}`}
            onClick={() => setActiveReport(option.key)}
          >
            <span className="report-type-card__icon">{option.icon}</span>
            <strong>{option.label}</strong>
          </button>
        ))}
      </div>

      <p className="report-filters__summary">{filterDescription}</p>

      <Modal open={reportPickerOpen} onClose={() => setReportPickerOpen(false)} title="Choose Report" className="report-picker-modal">
        <div className="report-choice-grid">
          {reportTypeOptions.map((option) => (
            <button
              key={option.key}
              type="button"
              className={`report-choice-card ${activeReport === option.key ? "report-choice-card--selected" : ""}`}
              onClick={() => {
                setActiveReport(option.key);
                setReportPickerOpen(false);
              }}
            >
              <span className="report-choice-card__icon">{option.icon}</span>
              <span>
                <strong>{option.label}</strong>
                <small>{option.description}</small>
              </span>
            </button>
          ))}
        </div>
      </Modal>

      <Modal open={datePickerOpen} onClose={() => setDatePickerOpen(false)} title="Choose Date Range" className="report-picker-modal">
        <div className="report-choice-grid report-choice-grid--dates">
          {datePresetOptions.map((option) => (
            <button
              key={option.key}
              type="button"
              className={`report-choice-card ${datePreset === option.key ? "report-choice-card--selected" : ""}`}
              onClick={() => {
                applyDatePreset(option.key);
                if (option.key !== "custom") setDatePickerOpen(false);
              }}
            >
              <span>
                <strong>{option.label}</strong>
                <small>{option.description}</small>
              </span>
            </button>
          ))}
        </div>
        <div className="report-date-custom">
          <Input label="Start" type="date" value={startDate} onChange={(event) => handleStartDateChange(event.target.value)} error={dateRangeError} />
          <Input label="End" type="date" value={endDate} onChange={(event) => handleEndDateChange(event.target.value)} />
          <Button fullWidth onClick={() => setDatePickerOpen(false)} disabled={Boolean(dateRangeError)}>
            Apply Date Range
          </Button>
        </div>
      </Modal>

      <Modal open={workerPickerOpen} onClose={() => setWorkerPickerOpen(false)} title="Choose Worker" className="report-picker-modal report-worker-picker-modal">
        <div className="report-choice-list report-choice-list--workers">
          <button
            type="button"
            className={`report-choice-card report-worker-choice-card ${selectedWorkerId === "" ? "report-choice-card--selected" : ""}`}
            onClick={() => {
              setSelectedWorkerId("");
              setWorkerPickerOpen(false);
            }}
          >
            <span>
              <strong>All</strong>
              <small>workers</small>
            </span>
          </button>
          {reportWorkers.map((worker) => (
            <button
              key={worker.id}
              type="button"
              className={`report-choice-card report-worker-choice-card ${selectedWorkerId === worker.id ? "report-choice-card--selected" : ""}`}
              onClick={() => {
                setSelectedWorkerId(worker.id);
                setWorkerPickerOpen(false);
              }}
            >
              <span>
                <strong>{workerDisplayName(worker)}</strong>
                <small>{Math.round(worker.commissionRate * 100)}% · {worker.currentStatus.replace(/_/g, " ")}</small>
              </span>
            </button>
          ))}
        </div>
      </Modal>

      <Modal open={paymentPickerOpen} onClose={() => setPaymentPickerOpen(false)} title="Choose Payment Method" className="report-picker-modal">
        <div className="report-choice-grid report-choice-grid--payments">
          {paymentOptions.map((option) => (
            <button
              key={option.value}
              type="button"
              className={`report-choice-card ${selectedPaymentMethod === option.value ? "report-choice-card--selected" : ""}`}
              onClick={() => {
                setSelectedPaymentMethod(option.value);
                setPaymentPickerOpen(false);
              }}
            >
              <span className="report-choice-card__icon">{option.icon}</span>
              <span><strong>{option.label}</strong></span>
            </button>
          ))}
        </div>
      </Modal>

      {loading && <p className="text-muted text-sm my-2">Loading...</p>}
      {reportError && <p className="field__error my-2">{reportError}</p>}

      {activeReport === "sales" && salesSummary && (
        <section className="report-section">
          <div className="report-summary">
            <StatCard label="Gross Service" value={formatMoney(salesSummary.grossServiceSalesCents)} />
            <StatCard label="Discounts" value={formatMoney(salesSummary.discountTotalCents)} />
            <StatCard label="Net Service" value={formatMoney(salesSummary.netServiceSalesCents)} />
            <StatCard label="Tips" value={formatMoney(salesSummary.tipTotalCents)} />
            <StatCard label="Worker Pay" value={formatMoney(salesSummary.totalPayCents)} />
            <StatCard label="Collected" value={formatMoney(salesSummary.totalCollectedCents)} />
          </div>
          {salesTickets.length === 0 ? (
            <EmptyState icon="-" title="No paid tickets" description={`No paid ticket data found for ${filterDescription}.`} />
          ) : (
            <div className="report-ticket-list">
              {salesTickets.map((ticket) => (
                <Card key={ticket.id} padding="lg" className="report-ticket">
                  <div className="card__header">
                    <div>
                      <h2 className="card__title">{ticket.customerName}</h2>
                      <p className="text-muted text-sm">
                        {ticket.completedAt ? new Date(ticket.completedAt).toLocaleString() : "Completed sale"} | {ticket.paymentMethods.map(methodLabel).join(", ") || "No approved payment"}
                      </p>
                    </div>
                    <div className="report-ticket__header-actions">
                      <Badge variant="success">{formatMoney(ticket.totals.collectedCents)}</Badge>
                      <Button size="sm" variant="secondary" onClick={() => setSelectedTicket(ticket)}>
                        View Ticket
                      </Button>
                    </div>
                  </div>
                  <div className="table-wrap">
                    <table className="report-table">
                      <thead>
                        <tr>
                          <th>Service</th><th>Worker</th><th>Price</th><th>Discount</th><th>Paid</th><th>Commission</th><th>Tips</th><th>Pay</th><th></th>
                        </tr>
                      </thead>
                      <tbody>
                        {ticket.services.map((service) => (
                          <tr key={service.id}>
                            <td><strong>{service.serviceName}</strong></td>
                            <td>{service.workerName}</td>
                            <td>{formatMoney(service.priceCents)}</td>
                            <td>{service.discountCents > 0 ? `-${formatMoney(service.discountCents)}` : "-"}</td>
                            <td>{formatMoney(service.finalServiceCents)}</td>
                            <td>{formatMoney(service.commissionCents)}</td>
                            <td>{formatMoney(service.tipsCents)}</td>
                            <td><strong>{formatMoney(service.payCents)}</strong></td>
                            <td>
                              <Button size="sm" variant="ghost" onClick={() => setSelectedTicket(ticket)}>
                                Ticket
                              </Button>
                            </td>
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
                          <td></td>
                        </tr>
                      </tfoot>
                    </table>
                  </div>
                </Card>
              ))}
            </div>
          )}
        </section>
      )}

      <Modal
        open={selectedTicket !== null}
        onClose={() => setSelectedTicket(null)}
        title={selectedTicket ? `Ticket - ${selectedTicket.customerName}` : "Ticket"}
        className="report-ticket-modal"
      >
        {selectedTicket && (
          <div className="report-ticket-detail">
            <section className="report-ticket-detail__hero">
              <div>
                <p className="eyebrow">Ticket detail</p>
                <h2>{selectedTicket.customerName}</h2>
                <p className="text-muted text-sm">
                  {selectedTicket.completedAt ? new Date(selectedTicket.completedAt).toLocaleString() : "Completed sale"} · {selectedTicket.paymentMethods.map(methodLabel).join(", ") || "No approved payment"}
                </p>
              </div>
              <div className="report-ticket-detail__collected">
                <span>Collected</span>
                <strong>{formatMoney(selectedTicket.totals.collectedCents)}</strong>
              </div>
            </section>

            <div className="report-ticket-detail__body">
              <section className="report-ticket-detail__panel report-ticket-detail__panel--services">
                <div className="report-ticket-detail__section-header">
                  <h3>Services</h3>
                  <Badge variant="info">{selectedTicket.services.length}</Badge>
                </div>
                <div className="report-ticket-detail__services">
                  {selectedTicket.services.map((service) => (
                    <article key={service.id} className="report-ticket-detail__service-card">
                      <div className="report-ticket-detail__service-title">
                        <strong>{service.serviceName}</strong>
                        <small>{service.workerName}</small>
                      </div>
                      <div className="report-ticket-detail__service-amounts">
                        <div><span>Price</span><strong>{formatMoney(service.priceCents)}</strong></div>
                        <div><span>Discount</span><strong>{service.discountCents > 0 ? `-${formatMoney(service.discountCents)}` : "-"}</strong></div>
                        <div><span>Net</span><strong>{formatMoney(service.finalServiceCents)}</strong></div>
                        <div><span>Tip</span><strong>{formatMoney(service.tipsCents)}</strong></div>
                      </div>

                    </article>
                  ))}
                </div>
              </section>

              <aside className="report-ticket-detail__panel report-ticket-detail__panel--summary">
                <h3>Summary</h3>
                <div className="report-ticket-detail__totals">
                  <div><span>Gross service</span><strong>{formatMoney(selectedTicket.totals.grossServiceCents)}</strong></div>
                  <div><span>Discounts</span><strong>{selectedTicket.totals.discountCents > 0 ? `-${formatMoney(selectedTicket.totals.discountCents)}` : formatMoney(0)}</strong></div>
                  <div><span>Net service</span><strong>{formatMoney(selectedTicket.totals.serviceCents)}</strong></div>
                  <div><span>Tips</span><strong>{formatMoney(selectedTicket.totals.tipsCents)}</strong></div>
                  <div className="report-ticket-detail__total-main"><span>Collected</span><strong>{formatMoney(selectedTicket.totals.collectedCents)}</strong></div>
                  <div><span>Commission</span><strong>{formatMoney(selectedTicket.totals.commissionCents)}</strong></div>
                  <div><span>Worker pay</span><strong>{formatMoney(selectedTicket.totals.payCents)}</strong></div>
                  <div><span>Business share</span><strong>{formatMoney(Math.max(selectedTicket.totals.serviceCents - selectedTicket.totals.commissionCents, 0))}</strong></div>
                </div>
              </aside>
            </div>

            <section className="report-ticket-detail__panel">
              <div className="report-ticket-detail__section-header">
                <h3>Worker Breakdown</h3>
                <Badge variant="default">{selectedTicketWorkerBreakdown.length}</Badge>
              </div>
              <div className="report-ticket-detail__workers">
                {selectedTicketWorkerBreakdown.map((worker) => (
                  <article key={worker.workerId} className="report-ticket-detail__worker-card">
                    <div>
                      <strong>{worker.workerName}</strong>
                      <small>{worker.services.join(", ")}</small>
                    </div>
                    <div><span>Net sales</span><strong>{formatMoney(worker.netSalesCents)}</strong></div>
                    <div><span>Commission</span><strong>{formatMoney(worker.commissionCents)}</strong></div>
                    <div><span>Tips</span><strong>{formatMoney(worker.tipsCents)}</strong></div>
                    <div><span>Pay</span><strong>{formatMoney(worker.payCents)}</strong></div>
                  </article>
                ))}
              </div>
            </section>
          </div>
        )}
      </Modal>

      {activeReport === "sales" && !salesSummary && !loading && !reportError && (
        <EmptyState icon="-" title="No sales data" description="Try adjusting the date range." />
      )}

      {activeReport === "workers" && (
        <section className="report-section">
          <div className="report-summary">
            <StatCard label="Services" value={String(workerTotals.services)} />
            <StatCard label="Net Sales" value={formatMoney(workerTotals.netSalesCents)} />
            <StatCard label="Commission" value={formatMoney(workerTotals.commissionCents)} />
            <StatCard label="Tips" value={formatMoney(workerTotals.tipsCents)} />
            <StatCard label="Total Pay" value={formatMoney(workerTotals.totalPayCents)} />
          </div>
          <Card padding="lg">
            <div className="card__header">
              <h2 className="card__title">Worker Earnings - {reportLabel}</h2>
            </div>
            {workerEarnings.length === 0 ? (
              <EmptyState icon="-" title="No worker data" description="No sales recorded for workers in this period." />
            ) : (
              <div className="table-wrap">
                <table>
                  <thead>
                    <tr><th>Worker</th><th>Services</th><th>Net Sales</th><th>Rate Snapshot</th><th>Commission</th><th>Tips</th><th>Total Pay</th></tr>
                  </thead>
                  <tbody>
                    {workerEarnings.map((worker) => (
                      <tr key={worker.workerId}>
                        <td><strong>{worker.name}</strong></td>
                        <td>{worker.services}</td>
                        <td>{formatMoney(worker.netSalesCents)}</td>
                        <td>{formatCommissionRates(worker.commissionRates, worker.commissionRate)}</td>
                        <td>{formatMoney(worker.commissionCents)}</td>
                        <td>{formatMoney(worker.tipsCents)}</td>
                        <td><strong>{formatMoney(worker.totalPayCents)}</strong></td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr>
                      <td><strong>Total</strong></td>
                      <td><strong>{workerTotals.services}</strong></td>
                      <td><strong>{formatMoney(workerTotals.netSalesCents)}</strong></td>
                      <td></td>
                      <td><strong>{formatMoney(workerTotals.commissionCents)}</strong></td>
                      <td><strong>{formatMoney(workerTotals.tipsCents)}</strong></td>
                      <td><strong>{formatMoney(workerTotals.totalPayCents)}</strong></td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            )}
          </Card>
        </section>
      )}

      {activeReport === "turns" && (
        <section className="report-section">
          <div className="report-summary">
            <StatCard label="Turns" value={String(turnDetails.length)} />
            <StatCard label="Completed" value={String(completedTurns)} />
            <StatCard label="Skipped" value={String(skippedTurns)} />
            <StatCard label="Avg Duration" value={avgDuration > 0 ? `${avgDuration}m` : "-"} />
          </div>
          <Card padding="lg">
            <div className="card__header">
              <h2 className="card__title">Turn Detail - {reportLabel}</h2>
              <Badge variant="info">{turnDetails.length} turns</Badge>
            </div>
            {turnDetails.length === 0 ? (
              <EmptyState icon="-" title="No turns found" description="No turn data for the selected date range." />
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
                    {turnDetails.map((turn) => (
                      <tr key={turn.id}>
                        <td><strong>{turn.workerName}</strong></td>
                        <td>{turn.customerName}</td>
                        <td className="report-cell--truncate">{turn.services || "-"}</td>
                        <td><StatusPill status={turn.status} /></td>
                        <td>{formatMoney(turn.itemTotalCents)}</td>
                        <td>{formatMoney(turn.commissionCents)}</td>
                        <td>{formatMoney(turn.tipsCents)}</td>
                        <td><strong>{formatMoney(turn.totalPayCents)}</strong></td>
                        <td>{turn.durationMinutes != null ? `${turn.durationMinutes}m` : "-"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Card>
        </section>
      )}

      {activeReport === "payments" && paymentSummary && (
        <section className="report-section">
          <div className="report-summary">
            <StatCard label="Cash" value={formatMoney(paymentSummary.cashTotalCents)} />
            <StatCard label="Card" value={formatMoney(paymentSummary.cardTotalCents)} />
            <StatCard label="Gift Card" value={formatMoney(paymentSummary.giftCardTotalCents)} />
            <StatCard label="Other" value={formatMoney(paymentSummary.otherTotalCents)} />
            <StatCard label="Approved Total" value={formatMoney(paymentSummary.totalApprovedCents)} />
          </div>
          <Card padding="lg">
            <div className="card__header">
              <h2 className="card__title">Payments - {reportLabel}</h2>
              <Badge variant="info">{paymentRows.length} payments</Badge>
            </div>
            {paymentRows.length === 0 ? (
              <EmptyState icon="-" title="No payments found" description="No backend-approved payments found for this period." />
            ) : (
              <div className="table-wrap">
                <table>
                  <thead>
                    <tr><th>Time</th><th>Customer</th><th>Method</th><th>Provider</th><th>Status</th><th>Tip</th><th>Amount</th></tr>
                  </thead>
                  <tbody>
                    {paymentRows.map((payment) => (
                      <tr key={payment.id}>
                        <td>{formatDateTime(payment.createdAt)}</td>
                        <td>{payment.customerName}</td>
                        <td>{methodLabel(payment.method)}</td>
                        <td>{payment.provider ?? "-"}</td>
                        <td><StatusPill status={payment.status} /></td>
                        <td>{formatMoney(payment.tipCents)}</td>
                        <td><strong>{formatMoney(payment.amountCents)}</strong></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Card>
        </section>
      )}

      {activeReport === "refunds" && refundSummary && (
        <section className="report-section">
          <div className="report-summary">
            <StatCard label="Refunds" value={String(refundSummary.refundCount)} />
            <StatCard label="Refund Total" value={formatMoney(refundSummary.refundTotalCents)} />
          </div>
          <Card padding="lg">
            <div className="card__header">
              <h2 className="card__title">Refunds - {reportLabel}</h2>
            </div>
            {refundRows.length === 0 ? (
              <EmptyState icon="-" title="No refunds found" description="No refunds recorded for this period." />
            ) : (
              <div className="table-wrap">
                <table>
                  <thead>
                    <tr><th>Time</th><th>Customer</th><th>Payment</th><th>Reason</th><th>Approved By</th><th>Amount</th></tr>
                  </thead>
                  <tbody>
                    {refundRows.map((refund) => (
                      <tr key={refund.id}>
                        <td>{formatDateTime(refund.createdAt)}</td>
                        <td>{refund.customerName}</td>
                        <td>{refund.paymentMethod ? methodLabel(refund.paymentMethod) : "-"}</td>
                        <td>{refund.reason ?? "-"}</td>
                        <td>{refund.approvedByUserId ?? "-"}</td>
                        <td><strong>{formatMoney(refund.amountCents)}</strong></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Card>
        </section>
      )}

      {activeReport === "discounts" && discountSummary && (
        <section className="report-section">
          <div className="report-summary">
            <StatCard label="Discounts" value={String(discountSummary.discountCount)} />
            <StatCard label="Discount Total" value={formatMoney(discountSummary.discountTotalCents)} />
          </div>
          <Card padding="lg">
            <div className="card__header">
              <h2 className="card__title">Discounts - {reportLabel}</h2>
            </div>
            {discountRows.length === 0 ? (
              <EmptyState icon="-" title="No discounts found" description="No discounts recorded for this period." />
            ) : (
              <div className="table-wrap">
                <table>
                  <thead>
                    <tr><th>Time</th><th>Customer</th><th>Service</th><th>Type</th><th>Reason</th><th>Approved By</th><th>Amount</th></tr>
                  </thead>
                  <tbody>
                    {discountRows.map((discount) => (
                      <tr key={discount.id}>
                        <td>{formatDateTime(discount.createdAt)}</td>
                        <td>{discount.customerName}</td>
                        <td>{discount.serviceName ?? "-"}</td>
                        <td>{formatDiscountValue(discount)}</td>
                        <td>{discount.reason ?? "-"}</td>
                        <td>{discount.approvedByUserId ?? "-"}</td>
                        <td><strong>{formatMoney(discount.amountCents)}</strong></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Card>
        </section>
      )}

      {activeReport === "eod" && eodData && (
        <section className="report-section">
          <div className="report-summary">
            <StatCard label="Gross Sales" value={formatMoney(eodData.grossServiceSalesCents)} />
            <StatCard label="Discounts" value={formatMoney(eodData.discountTotalCents)} />
            <StatCard label="Refunds" value={formatMoney(eodData.refundTotalCents)} />
            <StatCard label="Net Sales" value={formatMoney(eodData.netServiceSalesCents)} />
            <StatCard label="Tips Paid" value={formatMoney(eodData.tipTotalCents)} />
            <StatCard label="Commission Payout" value={formatMoney(eodData.workerCommissionPayoutCents)} />
            <StatCard label="Business Share" value={formatMoney(eodData.businessShareCents)} />
            <StatCard label="Collected" value={formatMoney(eodData.totalCollectedCents)} />
          </div>
          <Card padding="lg">
            <h2 className="card__title mb-2">End-of-Day Reconciliation - {reportLabel}</h2>
            <div className="report-reconcile">
              <div><span>Cash collected</span><strong>{formatMoney(eodData.cashTotalCents)}</strong></div>
              <div><span>Card collected</span><strong>{formatMoney(eodData.cardTotalCents)}</strong></div>
              <div><span>Gift card collected</span><strong>{formatMoney(eodData.giftCardTotalCents)}</strong></div>
              <div><span>Worker commission</span><strong>{formatMoney(eodData.workerCommissionPayoutCents)}</strong></div>
              <div><span>Worker tips</span><strong>{formatMoney(eodData.tipTotalCents)}</strong></div>
              <div><span>Worker total pay</span><strong>{formatMoney(eodData.totalPayCents ?? eodData.workerCommissionPayoutCents + eodData.tipTotalCents)}</strong></div>
              <div><span>POS card total</span><strong>{formatMoney(eodData.cardTotalCents)}</strong></div>
              <div><span>Clover card total</span><strong>Unavailable</strong></div>
              <div><span>Card difference</span><strong>Unavailable</strong></div>
            </div>
            <p className="text-muted text-sm mt-4">Clover settlement comparison will be available after a Clover reporting adapter is connected.</p>
          </Card>
        </section>
      )}
      {activeReport === "eod" && !eodData && !loading && !reportError && (
        <EmptyState icon="-" title="No EOD data" description="Try adjusting the date range." />
      )}
    </>
  );
}

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
=======
    <main className="app">
      <header className="app-header">
        <h1>Salon POS</h1>
        <div className="header-right">
          <span className={"conn-status " + loadState}>{statusMsg}</span>
          <button type="button" className="secondary small" onClick={() => void loadAll()}>Refresh</button>
        </div>
      </header>

      {loadState === "loading" && <p className="state-msg">Connecting to local server…</p>}
      {loadState === "error" && <p className="state-msg error-msg">{statusMsg}</p>}

      {loadState === "ready" && (
        <>
          <nav className="tab-nav">
            <button
              type="button"
              className={"tab-btn" + (activeTab === "turns" ? " active" : "")}
              onClick={() => setActiveTab("turns")}
            >Turns</button>
            <button
              type="button"
              className={"tab-btn" + (activeTab === "checkout" ? " active" : "")}
              onClick={() => setActiveTab("checkout")}
            >Checkout</button>
            <button
              type="button"
              className={"tab-btn" + (activeTab === "reports" ? " active" : "")}
              onClick={() => setActiveTab("reports")}
            >Reports</button>
          </nav>

          {activeTab === "turns" && (
            <TurnsTab
              dashboardWorkers={dashboardWorkers}
              workers={workers}
              waitingCheckins={waitingCheckins}
              assignments={assignments}
              setAssignments={setAssignments}
              suggestedWorker={suggestedWorker ?? null}
              currentSession={currentSession}
              checkedInWorkers={checkedInWorkers}
              onAssign={handleAssign}
              onTurnAction={handleTurnAction}
              onWorkerStatusChange={handleWorkerStatusChange}
              onCreateCheckin={handleOwnerCheckin}
              onOpenSession={handleOpenSession}
              onCloseSession={handleCloseSession}
              pendingSessionCandidate={pendingSessionCandidate}
              onResolveOpenSession={handleResolveOpenSession}
              onDismissOpenSessionDecision={() => setPendingSessionCandidate(null)}
            />
          )}
          {activeTab === "checkout" && (
            <CheckoutTab
              workers={workers}
              activeCheckins={activeCheckins}
              categories={categories}
              onRefresh={(m) => void loadAll(m)}
            />
          )}
          {activeTab === "reports" && <ReportsTab workers={workers} />}
        </>
      )}
    </main>
  );
}

// ── Turns Tab ─────────────────────────────────────────────────────────────────

type OptionPickerOption = {
  value: string;
  label: string;
  hint?: string;
  disabled?: boolean;
};

type OptionPickerState =
  | {
      context: { kind: "queue"; checkinId: string };
      title: string;
      subtitle?: string;
      selectedValue: string;
      options: OptionPickerOption[];
    }
  | {
      context: { kind: "status"; workerId: string };
      title: string;
      subtitle?: string;
      selectedValue: string;
      options: OptionPickerOption[];
    }
  | {
      context: { kind: "checkin" };
      title: string;
      subtitle?: string;
      selectedValue: string;
      options: OptionPickerOption[];
    };

function TurnsTab({
  dashboardWorkers, workers, waitingCheckins, assignments, setAssignments, suggestedWorker, currentSession, checkedInWorkers,
  onAssign, onTurnAction, onWorkerStatusChange, onCreateCheckin, onOpenSession, onCloseSession, pendingSessionCandidate,
  onResolveOpenSession, onDismissOpenSessionDecision,
}: {
  dashboardWorkers: TurnDashboardWorker[];
  workers: Worker[];
  waitingCheckins: Checkin[];
  assignments: Record<string, string>;
  setAssignments: React.Dispatch<React.SetStateAction<Record<string, string>>>;
  suggestedWorker: TurnDashboardWorker | null;
  currentSession: WorkSession | null;
  checkedInWorkers: CheckedInWorker[];
  onAssign: (c: Checkin) => Promise<void>;
  onTurnAction: (t: ActiveTurn, a: "start" | "complete") => Promise<void>;
  onWorkerStatusChange: (workerId: string, status: WorkerStatus) => Promise<void>;
  onCreateCheckin: (workerId: string, notes: string) => Promise<void>;
  onOpenSession: () => Promise<void>;
  onCloseSession: () => Promise<void>;
  pendingSessionCandidate: SessionCandidate | null;
  onResolveOpenSession: (mode: "continue" | "new") => Promise<void>;
  onDismissOpenSessionDecision: () => void;
}) {
  const [checkinModalOpen, setCheckinModalOpen] = useState(false);
  const [checkinWorkerId, setCheckinWorkerId] = useState("");
  const [checkinNotes, setCheckinNotes] = useState("");
  const [optionPicker, setOptionPicker] = useState<OptionPickerState | null>(null);
  const checkedInWorkerIds = useMemo(() => checkedInWorkers.map((worker) => worker.workerId), [checkedInWorkers]);
  const checkedInSet = useMemo(() => new Set(checkedInWorkerIds), [checkedInWorkerIds]);
  const checkedInOrder = useMemo(
    () => new Map(checkedInWorkerIds.map((workerId, index) => [workerId, index])),
    [checkedInWorkerIds]
  );
  const workerById = useMemo(() => new Map(workers.map((worker) => [worker.id, worker])), [workers]);
  const eligibleWorkers = useMemo(() => workers.filter((worker) => !checkedInSet.has(worker.id)), [workers, checkedInSet]);
  const visibleDashboardWorkers = useMemo(
    () =>
      dashboardWorkers
        .filter((worker) => checkedInSet.has(worker.workerId))
        .sort((left, right) => (checkedInOrder.get(left.workerId) ?? Number.MAX_SAFE_INTEGER) - (checkedInOrder.get(right.workerId) ?? Number.MAX_SAFE_INTEGER)),
    [dashboardWorkers, checkedInSet, checkedInOrder]
  );

  async function handleCreateCheckin() {
    if (!currentSession) return;
    const workerId = checkinWorkerId || eligibleWorkers[0]?.id;
    if (!workerId) return;
    await onCreateCheckin(workerId, checkinNotes);
    setCheckinModalOpen(false);
    setCheckinWorkerId("");
    setCheckinNotes("");
  }

  function openQueueWorkerPicker(checkin: Checkin) {
    const selectedValue = assignments[checkin.id] ?? suggestedWorker?.workerId ?? workers[0]?.id ?? "";
    setOptionPicker({
      context: { kind: "queue", checkinId: checkin.id },
      title: "Select worker",
      subtitle: customerName(checkin.customer),
      selectedValue,
      options: workers.map((worker) => ({
        value: worker.id,
        label: worker.displayName,
        hint: suggestedWorker?.workerId === worker.id ? "Suggested" : undefined,
      })),
    });
  }

  function openStatusPicker(worker: TurnDashboardWorker) {
    setOptionPicker({
      context: { kind: "status", workerId: worker.workerId },
      title: "Set worker status",
      subtitle: worker.name,
      selectedValue: worker.status,
      options: workerStatusOptions.map((status) => ({
        value: status,
        label: status.replace(/_/g, " "),
      })),
    });
  }

  function openCheckinWorkerPicker() {
    setOptionPicker({
      context: { kind: "checkin" },
      title: "Select checked-in worker",
      subtitle: "Worker shift check-in",
      selectedValue: checkinWorkerId || eligibleWorkers[0]?.id || "",
      options: eligibleWorkers.map((worker) => ({
        value: worker.id,
        label: worker.displayName,
      })),
    });
  }

  async function handleConfirmOptionPicker() {
    if (!optionPicker || !optionPicker.selectedValue) return;
    const selectedValue = optionPicker.selectedValue;
    const context = optionPicker.context;
    setOptionPicker(null);
    if (context.kind === "queue") {
      setAssignments((prev) => ({ ...prev, [context.checkinId]: selectedValue }));
      return;
    }
    if (context.kind === "status") {
      await onWorkerStatusChange(context.workerId, selectedValue as WorkerStatus);
      return;
    }
    setCheckinWorkerId(selectedValue);
  }

  return (
    <div className="turns-tab">
      <section className="session-bar">
        <div className="session-meta">
          <strong>{currentSession ? "Session open" : "No open session"}</strong>
          <span>
            {currentSession
              ? `Business date: ${formatSessionDate(currentSession.businessDate)}`
              : "Open a session before worker check-in."}
          </span>
        </div>
        <div className="session-actions">
          {!currentSession ? (
            <button type="button" className="secondary small" onClick={() => void onOpenSession()}>
              Open session
            </button>
          ) : (
            <button type="button" className="secondary small" onClick={() => void onCloseSession()}>
              Close session
            </button>
          )}
        </div>
      </section>

      <section className="queue-section">
        <div className="queue-head">
          <h2>Waiting queue</h2>
          <button
            type="button"
            className="secondary small"
            disabled={!currentSession}
            onClick={() => {
              setCheckinWorkerId(eligibleWorkers[0]?.id ?? "");
              setCheckinModalOpen(true);
            }}
          >
            Worker shift check-in
          </button>
        </div>
      </section>

      {waitingCheckins.length > 0 && (
        <section className="queue-section">
          <ul className="queue-list">
            {waitingCheckins.map((c) => (
              <li key={c.id} className="queue-item">
                <div className="queue-info">
                  <strong>{customerName(c.customer)}</strong>
                  {c.notes && <span className="queue-note">{c.notes}</span>}
                  {c.requestedWorkerId && (
                    <span className="requested-tag">
                      Requested: {workers.find((w) => w.id === c.requestedWorkerId)?.displayName ?? "Worker"}
                    </span>
                  )}
                </div>
                <div className="queue-controls">
                  <button
                    type="button"
                    className="secondary picker-trigger picker-trigger--queue"
                    onClick={() => openQueueWorkerPicker(c)}
                    disabled={workers.length === 0}
                  >
                    <span className="picker-trigger-label">
                      {workerById.get(assignments[c.id] ?? (suggestedWorker?.workerId ?? ""))?.displayName ?? "Select worker"}
                    </span>
                    <span className="picker-trigger-meta">Choose</span>
                  </button>
                  <button type="button" className="queue-assign-btn" onClick={() => void onAssign(c)}>Assign</button>
                </div>
              </li>
            ))}
          </ul>
        </section>
      )}

      <section className="turns-section">
        <h2>Worker turns this session</h2>
        <p className="checkin-hint">
          {currentSession
            ? `Session ${formatSessionDate(currentSession.businessDate)} is open.`
            : "Open session to track session turns."}
        </p>
        <div className="turns-table-wrap">
          <table className="turns-table">
            <thead>
              <tr>
                <th>Worker</th>
                <th>Status</th>
                <th className="center-col">Turns</th>
                <th>History</th>
                <th className="right-col">Sales</th>
                <th className="right-col">Tips</th>
                <th className="action-col"></th>
              </tr>
            </thead>
            <tbody>
              {visibleDashboardWorkers.map((w) => {
                const inServiceNow = w.activeTurn?.status === "in_service" ? 1 : 0;
                const turnsTaken = w.turnsTakenSession ?? w.turnsTakenToday;
                const salesCents = w.salesSessionCents ?? w.salesTodayCents;
                const tipsCents = w.tipsSessionCents ?? w.tipsTodayCents;
                const doneCount = Math.max(0, turnsTaken - inServiceNow);
                return (
                  <tr key={w.workerId}>
                    <td>
                      <span className="worker-name">{w.name}</span>
                      {w.suggestionRank === 1 && <span className="next-up-badge">Next up</span>}
                    </td>
                    <td>
                      <div className="status-cell">
                        <span className={"status-pill s-" + w.status}>{w.status.replace(/_/g, " ")}</span>
                        <button
                          type="button"
                          className="secondary picker-trigger picker-trigger--status"
                          onClick={() => openStatusPicker(w)}
                        >
                          <span className="picker-trigger-label">{w.status.replace(/_/g, " ")}</span>
                          <span className="picker-trigger-meta">Change</span>
                        </button>
                      </div>
                    </td>
                    <td className="center-col">{turnsTaken}</td>
                    <td>
                      <div className="sq-wrap">
                        {Array.from({ length: doneCount }).map((_, i) => (
                          <span key={"d" + i} className="sq sq-done" title="Completed" />
                        ))}
                        {inServiceNow > 0 && <span className="sq sq-active" title="In service" />}
                        {turnsTaken === 0 && <span className="sq-none">-</span>}
                      </div>
                    </td>
                    <td className="right-col">{formatMoney(salesCents)}</td>
                    <td className="right-col">{formatMoney(tipsCents)}</td>
                    <td>
                      {w.activeTurn?.status === "assigned" && (
                        <button type="button" className="small" onClick={() => void onTurnAction(w.activeTurn!, "start")}>
                          Start
                        </button>
                      )}
                      {w.activeTurn?.status === "in_service" && (
                        <button type="button" className="small" onClick={() => void onTurnAction(w.activeTurn!, "complete")}>
                          Complete
                        </button>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        {currentSession && visibleDashboardWorkers.length === 0 && (
          <p className="checkin-hint">No checked-in workers for this session yet.</p>
        )}
        <p className="sq-legend">
          <span className="sq sq-done" style={{ display: "inline-block" }} /> Completed &nbsp;
          <span className="sq sq-active" style={{ display: "inline-block" }} /> In service
        </p>
      </section>

      {checkinModalOpen && (
        <div className="numpad-overlay" onClick={(e) => { if (e.target === e.currentTarget) setCheckinModalOpen(false); }}>
          <div className="numpad-modal checkin-modal">
            <p className="numpad-label">Worker shift check-in</p>
            {!currentSession && <p className="checkin-hint">Open a session before checking in workers.</p>}
            <label className="checkin-label">
              Worker
              <button
                type="button"
                className="secondary picker-trigger picker-trigger--checkin"
                onClick={openCheckinWorkerPicker}
                disabled={!currentSession || eligibleWorkers.length === 0}
              >
                <span className="picker-trigger-label">
                  {workerById.get(checkinWorkerId)?.displayName ?? "Select worker"}
                </span>
                <span className="picker-trigger-meta">Choose</span>
              </button>
            </label>
            {currentSession && eligibleWorkers.length === 0 && (
              <p className="checkin-hint">All workers already checked in for this session.</p>
            )}
            <label className="checkin-label">
              Shift note (optional)
              <input
                type="text"
                value={checkinNotes}
                onChange={(e) => setCheckinNotes(e.target.value)}
                placeholder="Notes"
              />
            </label>
            <div className="numpad-actions">
              <button type="button" className="secondary" onClick={() => setCheckinModalOpen(false)}>Cancel</button>
              <button
                type="button"
                className="numpad-confirm"
                disabled={!currentSession || !checkinWorkerId || eligibleWorkers.length === 0}
                onClick={() => void handleCreateCheckin()}
              >
                Check in
              </button>
            </div>
          </div>
        </div>
      )}

      {pendingSessionCandidate && (
        <div className="numpad-overlay" onClick={(e) => { if (e.target === e.currentTarget) onDismissOpenSessionDecision(); }}>
          <div className="numpad-modal checkin-modal session-decision-modal">
            <p className="numpad-label">Session found for today</p>
            <p className="checkin-hint">
              A closed session from {formatSessionDate(pendingSessionCandidate.businessDate)} exists.
            </p>
            <p className="checkin-hint">
              Continue keeps current check-ins and session totals. Start new renews worker check-in eligibility.
            </p>
            <div className="numpad-actions session-decision-actions">
              <button type="button" className="secondary" onClick={onDismissOpenSessionDecision}>Cancel</button>
              <button type="button" className="numpad-confirm" onClick={() => void onResolveOpenSession("continue")}>
                Continue last session
              </button>
              <button type="button" className="secondary" onClick={() => void onResolveOpenSession("new")}>
                Start new session
              </button>
            </div>
          </div>
        </div>
      )}

      {optionPicker && (
        <OptionPickerModal
          title={optionPicker.title}
          subtitle={optionPicker.subtitle}
          options={optionPicker.options}
          selectedValue={optionPicker.selectedValue}
          onSelect={(value) => setOptionPicker((prev) => (prev ? { ...prev, selectedValue: value } : prev))}
          onCancel={() => setOptionPicker(null)}
          onConfirm={() => void handleConfirmOptionPicker()}
        />
      )}
    </div>
  );
}

// ── Checkout Tab ──────────────────────────────────────────────────────────────

function OptionPickerModal({
  title,
  subtitle,
  options,
  selectedValue,
  onSelect,
  onCancel,
  onConfirm,
}: {
  title: string;
  subtitle?: string;
  options: OptionPickerOption[];
  selectedValue: string;
  onSelect: (value: string) => void;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  const selectedOption = options.find((option) => option.value === selectedValue && !option.disabled);
  return (
    <div className="numpad-overlay option-picker-overlay" onClick={(e) => { if (e.target === e.currentTarget) onCancel(); }}>
      <div className="numpad-modal option-picker-modal">
        <p className="numpad-label">{title}</p>
        {subtitle && <p className="checkin-hint option-picker-sub">{subtitle}</p>}
        {options.length > 0 ? (
          <div className="option-picker-grid">
            {options.map((option) => (
              <button
                key={option.value}
                type="button"
                className={"option-picker-btn" + (option.value === selectedValue ? " selected" : "")}
                disabled={option.disabled}
                onClick={() => onSelect(option.value)}
              >
                <span className="option-picker-label">{option.label}</span>
                {option.hint && <span className="option-picker-hint">{option.hint}</span>}
              </button>
            ))}
          </div>
        ) : (
          <p className="checkin-hint">No options available.</p>
        )}
        <div className="numpad-actions option-picker-actions">
          <button type="button" className="secondary" onClick={onCancel}>Cancel</button>
          <button type="button" className="numpad-confirm" disabled={!selectedOption} onClick={onConfirm}>
            Confirm
          </button>
        </div>
      </div>
    </div>
  );
}

type ReportView = "summary" | "sales" | "workers" | "turns" | "payments" | "discounts" | "refunds";
type ReportQuickRange = "today" | "yesterday" | "seven_days" | "custom";

const OWNER_SESSION_STORAGE_KEY = "owner_pos_session_v1";
const reportViews: ReportView[] = ["summary", "sales", "workers", "turns", "payments", "discounts", "refunds"];

function ReportsTab({ workers }: { workers: Worker[] }) {
  const [session, setSession] = useState<OwnerSession | null>(() => loadOwnerSession());
  const [emailOrPhone, setEmailOrPhone] = useState("owner@example.com");
  const [password, setPassword] = useState("");
  const [authError, setAuthError] = useState("");
  const [authLoading, setAuthLoading] = useState(false);
  const [view, setView] = useState<ReportView>("summary");
  const [quickRange, setQuickRange] = useState<ReportQuickRange>("today");
  const [range, setRange] = useState<ReportRange>(() => rangeForQuick("today"));
  const [customStart, setCustomStart] = useState(() => toLocalInputValue(new Date(range.start)));
  const [customEnd, setCustomEnd] = useState(() => toLocalInputValue(new Date(range.end)));
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [summary, setSummary] = useState<ReportSummary | null>(null);
  const [sales, setSales] = useState<SalesReportRow[]>([]);
  const [workerRows, setWorkerRows] = useState<WorkerReportRow[]>([]);
  const [turnRows, setTurnRows] = useState<TurnReportRow[]>([]);
  const [payments, setPayments] = useState<PaymentReportRow[]>([]);
  const [discounts, setDiscounts] = useState<DiscountReportRow[]>([]);
  const [refunds, setRefunds] = useState<RefundReportRow[]>([]);

  useEffect(() => {
    saveOwnerSession(session);
  }, [session]);

  useEffect(() => {
    if (!session) return;
    void loadReports();
  }, [session, range.start, range.end, view]);

  async function handleLogin(event: React.FormEvent) {
    event.preventDefault();
    setAuthError("");
    setAuthLoading(true);
    try {
      const next = await loginOwner({ emailOrPhone: emailOrPhone.trim(), password });
      setSession(next);
      setPassword("");
    } catch (err) {
      setAuthError(err instanceof Error ? err.message : "Owner login failed.");
    } finally {
      setAuthLoading(false);
    }
  }

  async function loadReports() {
    if (!session) return;
    setLoading(true);
    setError("");
    try {
      setSummary((await fetchReportSummary(session.token, range)).summary);
      if (view === "sales") setSales((await fetchSalesReport(session.token, range)).sales);
      if (view === "workers") setWorkerRows((await fetchWorkersReport(session.token, range)).workers);
      if (view === "turns") setTurnRows((await fetchTurnsReport(session.token, range)).workers);
      if (view === "payments") setPayments((await fetchPaymentsReport(session.token, range)).payments);
      if (view === "discounts") setDiscounts((await fetchDiscountsReport(session.token, range)).discounts);
      if (view === "refunds") setRefunds((await fetchRefundsReport(session.token, range)).refunds);
    } catch (err) {
      if (err instanceof ApiError && err.status === 401) {
        setSession(null);
        setAuthError("Owner session expired. Please sign in again.");
      } else {
        setError(err instanceof Error ? err.message : "Unable to load reports.");
      }
    } finally {
      setLoading(false);
    }
  }

  function applyQuickRange(next: ReportQuickRange) {
    setQuickRange(next);
    if (next === "custom") return;
    const nextRange = rangeForQuick(next);
    setRange(nextRange);
    setCustomStart(toLocalInputValue(new Date(nextRange.start)));
    setCustomEnd(toLocalInputValue(new Date(nextRange.end)));
  }

  function applyCustomRange() {
    if (!customStart || !customEnd) {
      setError("Start and end are required.");
      return;
    }
    setRange({ start: new Date(customStart).toISOString(), end: new Date(customEnd).toISOString() });
  }

  if (!session) {
    return (
      <section className="reports-tab reports-auth-wrap">
        <form className="reports-auth" onSubmit={handleLogin}>
          <h2>Owner reports</h2>
          <label>Email or phone<input type="text" value={emailOrPhone} onChange={(event) => setEmailOrPhone(event.target.value)} /></label>
          <label>Password<input type="password" value={password} onChange={(event) => setPassword(event.target.value)} placeholder="1234" /></label>
          {authError && <p className="report-error">{authError}</p>}
          <button type="submit" disabled={authLoading}>{authLoading ? "Signing in..." : "Sign in"}</button>
        </form>
      </section>
    );
  }

  return (
    <section className="reports-tab">
      <div className="reports-toolbar">
        <div>
          <h2>Reports</h2>
          <p className="reports-range-label">{formatDateTime(range.start)} to {formatDateTime(range.end)}</p>
        </div>
        <button type="button" className="secondary small" onClick={() => setSession(null)}>Sign out</button>
      </div>

      <div className="range-panel">
        <div className="quick-range">
          {[
            ["today", "Today"],
            ["yesterday", "Yesterday"],
            ["seven_days", "7 days"],
            ["custom", "Custom"],
          ].map(([value, label]) => (
            <button key={value} type="button" className={"range-btn" + (quickRange === value ? " active" : "")} onClick={() => applyQuickRange(value as ReportQuickRange)}>
              {label}
            </button>
          ))}
        </div>
        {quickRange === "custom" && (
          <div className="custom-range">
            <label>Start<input type="datetime-local" value={customStart} onChange={(event) => setCustomStart(event.target.value)} /></label>
            <label>End<input type="datetime-local" value={customEnd} onChange={(event) => setCustomEnd(event.target.value)} /></label>
            <button type="button" className="secondary" onClick={applyCustomRange}>Apply</button>
          </div>
        )}
      </div>

      {summary && <SummaryCards summary={summary} />}

      <nav className="report-segments">
        {reportViews.map((item) => (
          <button key={item} type="button" className={view === item ? "active" : ""} onClick={() => setView(item)}>
            {item}
          </button>
        ))}
      </nav>

      {loading && <p className="report-status">Loading report...</p>}
      {error && <p className="report-error">{error}</p>}

      <div className="report-content">
        {view === "summary" && summary && <SummaryDetail summary={summary} />}
        {view === "sales" && <SalesReportList rows={sales} />}
        {view === "workers" && <WorkersReportList rows={workerRows} workers={workers} />}
        {view === "turns" && <TurnsReportList rows={turnRows} />}
        {view === "payments" && <PaymentsReportList rows={payments} />}
        {view === "discounts" && <DiscountsReportList rows={discounts} />}
        {view === "refunds" && <RefundsReportList rows={refunds} />}
      </div>
    </section>
  );
}

function SummaryCards({ summary }: { summary: ReportSummary }) {
  const cards: Array<[string, number]> = [
    ["Gross service", summary.grossServiceCents],
    ["Net service", summary.netServiceCents],
    ["Tips", summary.tipsCents],
    ["Collected", summary.totalCollectedCents],
  ];
  return (
    <div className="report-metric-grid">
      {cards.map(([label, value]) => (
        <article key={label} className="report-metric"><span>{label}</span><strong>{formatMoney(value)}</strong></article>
      ))}
    </div>
  );
}

function SummaryDetail({ summary }: { summary: ReportSummary }) {
  return (
    <div className="report-list">
      <ReportRow title="Service totals" meta={`${summary.salesCount} paid sales`} values={[["Gross", summary.grossServiceCents], ["Discounts", summary.discountCents], ["Refunds", summary.refundCents], ["Net", summary.netServiceCents]]} />
      <ReportRow title="Worker payout" values={[["Commission", summary.workerCommissionCents], ["Tips", summary.workerTipsCents], ["Total pay", summary.workerCommissionCents + summary.workerTipsCents], ["Business share", summary.businessShareCents]]} />
      <ReportRow title="Payment breakdown" values={[["Cash", summary.paymentBreakdown.cashCents], ["Card", summary.paymentBreakdown.cardCents], ["Gift card", summary.paymentBreakdown.giftCardCents], ["Other", summary.paymentBreakdown.otherCents]]} />
    </div>
  );
}

function SalesReportList({ rows }: { rows: SalesReportRow[] }) {
  if (rows.length === 0) return <EmptyReport />;
  return <div className="report-list">{rows.map((row) => <ReportRow key={row.id} title={customerName(row.customer)} meta={`${formatDateTime(row.completedAt)} | ${row.paymentMethods.join(", ") || "no payment"}`} values={[["Subtotal", row.subtotalCents], ["Discount", row.discountCents], ["Tip", row.tipCents], ["Collected", row.collectedCents]]} />)}</div>;
}

function WorkersReportList({ rows, workers }: { rows: WorkerReportRow[]; workers: Worker[] }) {
  if (rows.length === 0) return <EmptyReport />;
  const workerNames = new Map(workers.map((worker) => [worker.id, worker.displayName]));
  return <div className="report-list">{rows.map((row) => <ReportRow key={row.workerId} title={workerNames.get(row.workerId) ?? row.workerName} meta={`${row.serviceCount} services`} values={[["Service", row.netServiceCents], ["Commission", row.commissionCents], ["Tips", row.tipsCents], ["Pay", row.totalWorkerPayCents]]} />)}</div>;
}

function TurnsReportList({ rows }: { rows: TurnReportRow[] }) {
  if (rows.length === 0) return <EmptyReport />;
  return <div className="report-list">{rows.map((row) => <ReportRow key={row.workerId} title={row.workerName} meta={`Last: ${formatDateTime(row.lastTurnAt)}`} values={[["Taken", row.turnsTaken], ["Completed", row.completedTurns], ["Skipped", row.skippedTurns], ["Avg min", row.averageServiceMinutes]]} money={false} />)}</div>;
}

function PaymentsReportList({ rows }: { rows: PaymentReportRow[] }) {
  if (rows.length === 0) return <EmptyReport />;
  return <div className="report-list">{rows.map((row) => <ReportRow key={row.id} title={row.method.replace("_", " ")} meta={`${formatDateTime(row.createdAt)}${row.cardLast4 ? ` | ${row.cardBrand ?? "Card"} ${row.cardLast4}` : ""}`} values={[["Amount", row.amountCents], ["Tip", row.tipCents]]} />)}</div>;
}

function DiscountsReportList({ rows }: { rows: DiscountReportRow[] }) {
  if (rows.length === 0) return <EmptyReport />;
  return <div className="report-list">{rows.map((row) => <ReportRow key={row.id} title={row.reason || "Discount"} meta={`${formatDateTime(row.createdAt)} | sale ${shortId(row.saleId)}`} values={[["Amount", row.amountCents]]} />)}</div>;
}

function RefundsReportList({ rows }: { rows: RefundReportRow[] }) {
  if (rows.length === 0) return <EmptyReport />;
  return <div className="report-list">{rows.map((row) => <ReportRow key={row.id} title={row.reason || "Refund"} meta={`${formatDateTime(row.createdAt)} | ${row.paymentMethod ?? "payment"}`} values={[["Amount", row.amountCents]]} />)}</div>;
}

function ReportRow({ title, meta, values, money = true }: { title: string; meta?: string; values: Array<[string, number]>; money?: boolean }) {
  return (
    <article className="report-row">
      <div className="report-row-head"><strong>{title}</strong>{meta && <span>{meta}</span>}</div>
      <div className="report-row-values">
        {values.map(([label, value]) => <div key={label}><span>{label}</span><strong>{money ? formatMoney(value) : value}</strong></div>)}
      </div>
    </article>
  );
}

function EmptyReport() {
  return <p className="empty-hint big">No report records for this range.</p>;
}

function loadOwnerSession(): OwnerSession | null {
  try {
    const raw = localStorage.getItem(OWNER_SESSION_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as OwnerSession;
    if (!parsed.token || new Date(parsed.expiresAt).getTime() <= Date.now()) return null;
    return parsed;
  } catch {
    return null;
  }
}

function saveOwnerSession(session: OwnerSession | null) {
  if (!session) localStorage.removeItem(OWNER_SESSION_STORAGE_KEY);
  else localStorage.setItem(OWNER_SESSION_STORAGE_KEY, JSON.stringify(session));
}

function rangeForQuick(value: ReportQuickRange): ReportRange {
  const end = new Date();
  const start = new Date();
  if (value === "yesterday") {
    start.setDate(start.getDate() - 1);
    end.setDate(end.getDate() - 1);
  } else if (value === "seven_days") {
    start.setDate(start.getDate() - 6);
  }
  start.setHours(0, 0, 0, 0);
  end.setHours(23, 59, 59, 999);
  return { start: start.toISOString(), end: end.toISOString() };
}

function toLocalInputValue(date: Date): string {
  const local = new Date(date.getTime() - date.getTimezoneOffset() * 60000);
  return local.toISOString().slice(0, 16);
}

function shortId(id: string): string {
  return id.slice(0, 8);
}

function CheckoutTab({
  workers, activeCheckins, categories, onRefresh,
}: {
  workers: Worker[];
  activeCheckins: Checkin[];
  categories: ServiceCategory[];
  onRefresh: (msg: string) => void;
}) {
  const [phase, setPhase] = useState<CheckoutPhase>("build_order");
  const [currentSale, setCurrentSale] = useState<Sale | null>(null);
  const [selectedCheckin, setSelectedCheckin] = useState<Checkin | null>(null);
  const [activeWorker, setActiveWorker] = useState<Worker | null>(null);
  const [reassigningItemId, setReassigningItemId] = useState<string | null>(null);
  const [statusMsg, setStatusMsg] = useState("");
  const [numpad, setNumpad] = useState<NumpadState>({ open: false });
  const [customService, setCustomService] = useState<CustomServiceState>({ open: false });
  const [tipDist, setTipDist] = useState<WorkerTipShare[]>([]);
  const [totalTipFromTerminal, setTotalTipFromTerminal] = useState(0);
  const [completedSale, setCompletedSale] = useState<{ id: string; customerName: string } | null>(null);
  const [receipts, setReceipts] = useState<ReceiptRecord[]>([]);

  const balanceDueCents = Math.max((currentSale?.totalCents ?? 0) - (currentSale?.amountPaidCents ?? 0), 0);

  function resetCheckout() {
    setCurrentSale(null); setSelectedCheckin(null); setPhase("build_order");
    setActiveWorker(null); setReassigningItemId(null); setStatusMsg("");
    setNumpad({ open: false }); setCustomService({ open: false });
    setTipDist([]); setTotalTipFromTerminal(0);
  }

  async function run(action: () => Promise<void>, msg: string) {
    try { setStatusMsg("Working..."); await action(); setStatusMsg(msg); }
    catch (err) { setStatusMsg(err instanceof Error ? err.message : "Action failed."); }
  }

  async function handleSelectCheckin(checkin: Checkin) {
    if (currentSale && selectedCheckin?.id !== checkin.id) {
      if (!confirm("Switch customer? Current order will be lost.")) return;
      resetCheckout();
    }
    if (selectedCheckin?.id === checkin.id && currentSale) return;
    await run(async () => {
      const sale = await createSaleForCheckin(checkin);
      setCompletedSale(null); setReceipts([]);
      setCurrentSale(await fetchSale(sale.id));
      setSelectedCheckin(checkin);
      setPhase("build_order");
      setActiveWorker(null);
    }, "Order opened for " + customerName(checkin.customer) + ".");
  }

  async function handleStartNoCheckinSale() {
    if (currentSale) {
      if (!confirm("Start a no check-in sale? Current order will be lost.")) return;
      resetCheckout();
    }
    await run(async () => {
      const sale = await createEmptySale();
      setCompletedSale(null); setReceipts([]);
      setCurrentSale(await fetchSale(sale.id));
      setSelectedCheckin(null);
      setPhase("build_order");
      setActiveWorker(null);
    }, "No check-in sale opened.");
  }

  function handleSelectWorker(worker: Worker) {
    if (reassigningItemId) {
      void handleReassignWorker(worker);
      return;
    }
    setActiveWorker(worker);
    setStatusMsg("Adding services for " + worker.displayName + ". Tap another worker to switch.");
  }

  async function handleSelectService(serviceId: string) {
    if (!currentSale || !activeWorker) {
      setStatusMsg("Select a worker first.");
      return;
    }
    await run(async () => {
      await addSaleItem(currentSale.id, { serviceId, workerId: activeWorker.id });
      setCurrentSale(await fetchSale(currentSale.id));
    }, "Added for " + activeWorker.displayName + ".");
  }

  function handleTapItem(item: SaleItem) {
    if (reassigningItemId === item.id) {
      setReassigningItemId(null);
      setStatusMsg(activeWorker ? "Adding services for " + activeWorker.displayName + "." : "");
    } else {
      setReassigningItemId(item.id);
      setStatusMsg('Tap a worker to reassign "' + item.serviceNameSnapshot + '".');
    }
  }

  async function handleReassignWorker(worker: Worker) {
    if (!currentSale || !reassigningItemId) return;
    const itemId = reassigningItemId;
    await run(async () => {
      await updateSaleItem(currentSale.id, itemId, { workerId: worker.id });
      setCurrentSale(await fetchSale(currentSale.id));
      setReassigningItemId(null);
    }, "Reassigned to " + worker.displayName + ".");
  }

  async function handleRemoveItem(itemId: string) {
    if (!currentSale) return;
    const saleId = currentSale.id;
    await run(async () => {
      await removeSaleItem(saleId, itemId);
      setCurrentSale(await fetchSale(saleId));
      if (reassigningItemId === itemId) setReassigningItemId(null);
    }, "Service removed.");
  }

  function handleNumpadKey(key: string) {
    setNumpad((prev) => {
      if (!prev.open) return prev;
      if (key === "DEL") return { ...prev, digits: prev.digits.slice(0, -1) };
      if (prev.digits.length >= 7) return prev;
      return { ...prev, digits: prev.digits + key };
    });
  }

  async function handleNumpadConfirm() {
    if (!numpad.open) return;
    if (numpad.purpose === "tip_adjust") {
      const { workerIndex, digits } = numpad;
      setTipDist((prev) => setWorkerTip(prev, workerIndex, digitsToCents(digits)));
      setNumpad({ open: false }); setStatusMsg("Tip adjusted."); return;
    }
    if (numpad.purpose === "custom_price") return; // handled by handleCustomServiceConfirm
    if (!currentSale) return;
    const { purpose, digits } = numpad;
    const amountCents = digitsToCents(digits);
    if (amountCents <= 0) { setStatusMsg("Enter an amount greater than zero."); return; }
    const saleId = currentSale.id;
    setNumpad({ open: false });
    await run(async () => {
      if (purpose === "cash") await recordCashPayment(saleId, amountCents);
      else await recordGiftCardPayment(saleId, amountCents);
      setCurrentSale(await fetchSale(saleId));
    }, (purpose === "cash" ? "Cash" : "Gift card") + " payment recorded.");
  }

  async function handleCustomServiceConfirm() {
    if (!customService.open || !numpad.open) return;
    if (!currentSale || !activeWorker) { setStatusMsg("Select a worker first."); return; }
    const name = customService.name.trim();
    if (!name) { setStatusMsg("Enter a service name."); return; }
    const priceCents = digitsToCents(numpad.digits);
    const saleId = currentSale.id;
    const workerName = activeWorker.displayName;
    const workerId = activeWorker.id;
    setCustomService({ open: false }); setNumpad({ open: false });
    await run(async () => {
      await addCustomSaleItem(saleId, { customName: name, priceCents, workerId });
      setCurrentSale(await fetchSale(saleId));
    }, "Custom service added for " + workerName + ".");
  }

  async function handleChargeCard() {
    if (!currentSale) return;
    const saleId = currentSale.id;
    setPhase("card_processing"); setStatusMsg("Waiting for customer on Clover Mini…");
    try {
      const result = await startCardPayment(saleId, balanceDueCents);
      if (result.terminalStatus !== "approved") {
        setPhase("payment"); setStatusMsg("Card " + result.terminalStatus + ". Please try again."); return;
      }
      const fresh = await fetchSale(saleId);
      setCurrentSale(fresh);
      const tipCents = result.tipCents ?? 0;
      if (tipCents <= 0) {
        setPhase("payment"); setStatusMsg("Card approved. No tip entered.");
        return;
      }

      const initialDist = calcInitialTipDist(fresh.items ?? [], workers, tipCents);
      setTipDist(initialDist);
      setTotalTipFromTerminal(tipCents);
      if (initialDist.length <= 1) {
        const items = buildTipDistributionItems(initialDist);
        await setTipDistribution(saleId, items);
        setCurrentSale(await fetchSale(saleId));
        setPhase("payment");
        setStatusMsg("Card approved. Tip saved.");
        return;
      }

      setPhase("tip_review");
      setStatusMsg("Card approved. Review and confirm the tip split.");
    } catch (err) {
      setPhase("payment"); setStatusMsg(err instanceof Error ? err.message : "Card payment failed.");
    }
  }

  async function handleConfirmTipDist() {
    if (!currentSale) return;
    const tipTotal = tipDist.reduce((s, w) => s + w.tipCents, 0);
    if (tipTotal !== totalTipFromTerminal) {
      setStatusMsg("Tip split must equal Clover tip total before confirming.");
      return;
    }
    const items = buildTipDistributionItems(tipDist);
    await run(async () => {
      await setTipDistribution(currentSale.id, items);
      setCurrentSale(await fetchSale(currentSale.id));
      setPhase("payment");
    }, "Tip distribution saved.");
  }

  async function handleCompleteSale() {
    if (!currentSale) return;
    const saleId = currentSale.id;
    const completedCustomerName = customerName(currentSale.customer ?? currentSale.checkin?.customer ?? selectedCheckin?.customer ?? null);
    await run(async () => {
      await completeSale(saleId);
      setCompletedSale({ id: saleId, customerName: completedCustomerName });
      setReceipts(await fetchSaleReceipts(saleId));
      onRefresh("Sale completed.");
    }, "Sale completed.");
    setCurrentSale(null); setSelectedCheckin(null); setActiveWorker(null);
    setReassigningItemId(null); setPhase("build_order");
    setTipDist([]); setTotalTipFromTerminal(0);
  }

  async function handlePrintReceipt(saleId: string) {
    await run(async () => {
      await printSaleReceipt(saleId);
      setReceipts(await fetchSaleReceipts(saleId));
    }, "Receipt printed.");
  }

  async function handleReprintReceipt(receiptId: string) {
    if (!completedSale) return;
    await run(async () => {
      await reprintSaleReceipt(completedSale.id, receiptId);
      setReceipts(await fetchSaleReceipts(completedSale.id));
    }, "Receipt reprinted.");
  }

  const numpadWorkerName =
    numpad.open && numpad.purpose === "tip_adjust"
      ? (tipDist[numpad.workerIndex]?.workerName ?? "Worker")
      : "";

  // ── Build order ───────────────────────────────────────────────────────────

  if (phase === "build_order") {
    return (
      <div className="checkout-tab">
        <div className="customer-section">
          {activeCheckins.length === 0 ? (
            <p className="empty-hint">No customers currently in service or ready for checkout.</p>
          ) : (
            <div className="customer-chips">
              {activeCheckins.map((c) => (
                <button
                  key={c.id}
                  type="button"
                  className={"customer-chip" + (selectedCheckin?.id === c.id ? " selected" : "")}
                  onClick={() => void handleSelectCheckin(c)}
                >
                  <span className="chip-name">{customerName(c.customer)}</span>
                  <span className={"chip-status cs-" + c.status}>
                    {c.status === "in_service" ? "In service" : "Ready"}
                  </span>
                </button>
              ))}
            </div>
          )}
        </div>

        {!currentSale && (
          <>
            {completedSale && (
              <section className="receipt-panel">
                <div className="receipt-panel-head">
                  <div>
                    <strong>Sale completed</strong>
                    <span>{completedSale.customerName}</span>
                  </div>
                  <button type="button" onClick={() => void handlePrintReceipt(completedSale.id)}>
                    Print receipt
                  </button>
                </div>
                {statusMsg && <p className="checkout-status">{statusMsg}</p>}
                {receipts.length > 0 && (
                  <div className="receipt-history">
                    {receipts.map((receipt) => (
                      <div key={receipt.id} className="receipt-history-row">
                        <div>
                          <strong>{receipt.printStatus.replace(/_/g, " ")}</strong>
                          <span>{formatDateTime(receipt.printedAt ?? receipt.createdAt)}</span>
                        </div>
                        <button type="button" className="secondary small" onClick={() => void handleReprintReceipt(receipt.id)}>
                          Reprint
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </section>
            )}
            <div className="empty-start-wrap">
              <p className="empty-hint big">Select a customer above to start an order.</p>
              <button type="button" className="secondary" onClick={() => void handleStartNoCheckinSale()}>
                No check-in customer
              </button>
            </div>
          </>
        )}

        {currentSale && (
          <>
            {statusMsg && <p className="checkout-status">{statusMsg}</p>}

            <div className="checkout-columns">
              <div className="panel-box workers-box">
                <div className="panel-head">
                  {reassigningItemId
                    ? "Tap worker to reassign"
                    : activeWorker
                    ? "Worker: " + activeWorker.displayName
                    : "Select a worker"}
                </div>
                <div className="worker-tiles">
                  {workers.map((w) => (
                    <button
                      key={w.id}
                      type="button"
                      className={"worker-tile" + (activeWorker?.id === w.id && !reassigningItemId ? " selected" : "")}
                      onClick={() => handleSelectWorker(w)}
                    >
                      <span className="wt-name">{w.displayName}</span>
                      <span className={"status-pill s-" + w.currentStatus}>{w.currentStatus.replace(/_/g, " ")}</span>
                    </button>
                  ))}
                </div>
              </div>

              <div className="panel-box services-box">
                <div className="panel-head">Select a service</div>
                <div className="services-scroll">
                  {categories.map((cat) => (
                    <div key={cat.id} className="svc-category">
                      <div className="cat-label">{cat.name}</div>
                      <div className="svc-grid">
                        {cat.services.map((svc) => (
                          <button
                            key={svc.id}
                            type="button"
                            className="svc-tile"
                            onClick={() => void handleSelectService(svc.id)}
                          >
                            <span className="svc-name">{svc.name}</span>
                            <span className="svc-price">{formatMoney(svc.priceCents)}</span>
                            <span className="svc-dur">{svc.durationMinutes} min</span>
                          </button>
                        ))}
                      </div>
                    </div>
                  ))}
                  <button
                    type="button"
                    className="custom-svc-btn"
                    onClick={() => {
                      if (!activeWorker) { setStatusMsg("Select a worker first."); return; }
                      setCustomService({ open: true, name: "" });
                      setNumpad({ open: true, purpose: "custom_price", digits: "" });
                    }}
                  >
                    + Custom service
                  </button>
                </div>
              </div>

              {/* Order panel — right column */}
              <div className="panel-box order-panel">
                <div className="panel-head">Order</div>
                <div className="order-items-list">
                  {(currentSale.items?.length ?? 0) === 0 ? (
                    <p className="empty-order">No services added yet.</p>
                  ) : (
                    currentSale.items?.map((item) => (
                      <div
                        key={item.id}
                        className={"order-item-row" + (reassigningItemId === item.id ? " reassigning" : "")}
                      >
                        <button
                          type="button"
                          className="order-item-main"
                          onClick={() => handleTapItem(item)}
                          title="Tap to reassign worker"
                        >
                          <div className="order-item-info">
                            <span className="chip-worker">{item.worker?.displayName ?? "?"}</span>
                            <span className="chip-svc">{item.serviceNameSnapshot}</span>
                          </div>
                          <span className="chip-price">{formatMoney(item.priceCents)}</span>
                        </button>
                        <button
                          type="button"
                          className="item-remove-btn"
                          onClick={() => void handleRemoveItem(item.id)}
                          title="Remove service"
                        >✕</button>
                      </div>
                    ))
                  )}
                </div>
                <div className="order-footer">
                  {(currentSale.items?.length ?? 0) > 0 && (
                    <div className="order-total-row">
                      <span>Total</span>
                      <strong>{formatMoney(currentSale.subtotalCents)}</strong>
                    </div>
                  )}
                  <button
                    type="button"
                    className="proceed-btn"
                    disabled={(currentSale.items?.length ?? 0) === 0}
                    onClick={() => setPhase("payment")}
                  >
                    Proceed to payment
                  </button>
                  <button type="button" className="secondary small" onClick={resetCheckout}>Cancel</button>
                </div>
              </div>
            </div>

          </>
        )}

        {customService.open && (
          <div
            className="numpad-overlay"
            onClick={(e) => {
              if (e.target === e.currentTarget) { setCustomService({ open: false }); setNumpad({ open: false }); }
            }}
          >
            <div className="numpad-modal">
              <p className="numpad-label">Custom service</p>
              <input
                type="text"
                className="custom-svc-input"
                placeholder="Service name…"
                value={customService.name}
                onChange={(e) => setCustomService((prev) => prev.open ? { ...prev, name: e.target.value } : prev)}
                autoFocus
              />
              <div className="numpad-display">
                {numpad.open ? digitsToDisplay(numpad.digits) : "$0.00"}
              </div>
              <div className="numpad-keys">
                {["1","2","3","4","5","6","7","8","9","DEL","0","00"].map((k) => (
                  <button key={k} type="button" className="numpad-key" onClick={() => handleNumpadKey(k)}>
                    {k === "DEL" ? "⌫" : k}
                  </button>
                ))}
              </div>
              <div className="numpad-actions">
                <button
                  type="button"
                  className="secondary"
                  onClick={() => { setCustomService({ open: false }); setNumpad({ open: false }); }}
                >Cancel</button>
                <button type="button" className="numpad-confirm" onClick={() => void handleCustomServiceConfirm()}>
                  Add service
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    );
  }

  // ── Payment ───────────────────────────────────────────────────────────────

  if (phase === "payment" && currentSale) {
    return (
      <div className="checkout-tab">
        <div className="payment-view">
          <div className="payment-nav">
            <button type="button" className="secondary small" onClick={() => setPhase("build_order")}>← Back to order</button>
            <button type="button" className="secondary small" onClick={resetCheckout}>Cancel sale</button>
          </div>
          {statusMsg && <p className="checkout-status">{statusMsg}</p>}
          <SaleSummary sale={currentSale} />
          <div className={"balance-display" + (balanceDueCents === 0 ? " balance-zero" : " balance-owed")}>
            <span>Balance due</span>
            <strong>{formatMoney(balanceDueCents)}</strong>
          </div>
          {(currentSale.payments?.length ?? 0) > 0 && (
            <div className="payments-recorded">
              <p className="payments-label">Payments recorded:</p>
              {currentSale.payments?.map((p) => (
                <div key={p.id} className="payment-line">
                  <span className="pline-method">{p.method.replace(/_/g, " ")}</span>
                  <span>{formatMoney(p.amountCents)}</span>
                </div>
              ))}
            </div>
          )}
          <div className="payment-btns">
            <button
              type="button"
              className="payment-btn"
              onClick={() => setNumpad({ open: true, purpose: "cash", digits: String(balanceDueCents) })}
            >Cash</button>
            <button
              type="button"
              className="payment-btn"
              onClick={() => setNumpad({ open: true, purpose: "gift_card", digits: String(balanceDueCents) })}
            >Gift card</button>
            <button
              type="button"
              className="payment-btn card-btn"
              disabled={balanceDueCents === 0}
              onClick={() => void handleChargeCard()}
            >Card (Clover)</button>
          </div>
          {balanceDueCents === 0 && (
            <button type="button" className="complete-btn" onClick={() => void handleCompleteSale()}>
              Complete sale
            </button>
          )}
        </div>

        {numpad.open && (
          <div className="numpad-overlay" onClick={(e) => { if (e.target === e.currentTarget) setNumpad({ open: false }); }}>
            <div className="numpad-modal">
              <p className="numpad-label">{numpad.purpose === "cash" ? "Cash amount" : "Gift card amount"}</p>
              <div className="numpad-display">{digitsToDisplay(numpad.digits)}</div>
              <div className="numpad-keys">
                {["1","2","3","4","5","6","7","8","9","DEL","0","00"].map((k) => (
                  <button key={k} type="button" className="numpad-key" onClick={() => handleNumpadKey(k)}>
                    {k === "DEL" ? "⌫" : k}
                  </button>
                ))}
              </div>
              <div className="numpad-actions">
                <button type="button" className="secondary" onClick={() => setNumpad({ open: false })}>Cancel</button>
                <button type="button" className="numpad-confirm" onClick={() => void handleNumpadConfirm()}>Confirm</button>
              </div>
            </div>
          </div>
        )}
      </div>
    );
  }

  // ── Card processing ───────────────────────────────────────────────────────

  if (phase === "card_processing") {
    return (
      <div className="checkout-tab">
        <div className="card-processing-state">
          <div className="processing-spinner" />
          <p>Waiting for customer on Clover Mini…</p>
          <p className="processing-sub">Customer is reviewing the total and entering a tip.</p>
        </div>
      </div>
    );
  }

  // ── Tip review ────────────────────────────────────────────────────────────

  if (phase === "tip_review" && currentSale) {
    const tipTotal = tipDist.reduce((s, w) => s + w.tipCents, 0);
    const tipRemaining = totalTipFromTerminal - tipTotal;
    const serviceTotal = tipDist.reduce((sum, share) => sum + share.serviceCents, 0);
    return (
      <div className="checkout-tab">
        <div className="tip-review">
          <h2>Tip distribution</h2>
          <p className="tip-review-sub">
            Terminal approved <strong>{formatMoney(totalTipFromTerminal)}</strong>. Tap a worker to adjust.
          </p>
          <button
            type="button"
            className="secondary service-percent-btn"
            onClick={() => setTipDist(calcInitialTipDist(currentSale.items ?? [], workers, totalTipFromTerminal))}
          >
            Apply service %
          </button>
          <div className="tip-rows">
            {tipDist.map((share, i) => (
              <div key={share.workerId} className="tip-row">
                <div className="tip-row-info">
                  <span className="tip-worker-name">{share.workerName}</span>
                  <span className="tip-service-amt">
                    {formatMoney(share.serviceCents)} in services ({servicePercent(share.serviceCents, serviceTotal)}%)
                  </span>
                </div>
                <button
                  type="button"
                  className="secondary tip-percent-btn"
                  onClick={() =>
                    setTipDist((prev) =>
                      setWorkerTip(prev, i, Math.round(totalTipFromTerminal * (share.serviceCents / Math.max(1, serviceTotal))))
                    )
                  }
                >
                  Use %
                </button>
                <button
                  type="button"
                  className="tip-amount-btn"
                  onClick={() => setNumpad({ open: true, purpose: "tip_adjust", workerIndex: i, digits: String(share.tipCents) })}
                >
                  {formatMoney(share.tipCents)}
                </button>
              </div>
            ))}
          </div>
          <div className="tip-total-banner">
            <span>Total tip</span>
            <span className={"tip-total-val" + (tipTotal === totalTipFromTerminal ? " ok" : " warn")}>
              {formatMoney(tipTotal)} / {formatMoney(totalTipFromTerminal)}
            </span>
          </div>
          {tipRemaining !== 0 && (
            <p className="tip-delta-msg">
              {tipRemaining > 0 ? "Remaining to assign: " : "Over-assigned by: "}
              {formatMoney(Math.abs(tipRemaining))}
            </p>
          )}
          <button
            type="button"
            className="complete-btn"
            disabled={tipTotal !== totalTipFromTerminal}
            onClick={() => void handleConfirmTipDist()}
          >
            Confirm tip distribution
          </button>
        </div>

        {numpad.open && (
          <div className="numpad-overlay" onClick={(e) => { if (e.target === e.currentTarget) setNumpad({ open: false }); }}>
            <div className="numpad-modal">
              <p className="numpad-label">Tip for {numpadWorkerName}</p>
              <div className="numpad-display">{digitsToDisplay(numpad.digits)}</div>
              <div className="numpad-keys">
                {["1","2","3","4","5","6","7","8","9","DEL","0","00"].map((k) => (
                  <button key={k} type="button" className="numpad-key" onClick={() => handleNumpadKey(k)}>
                    {k === "DEL" ? "⌫" : k}
                  </button>
                ))}
              </div>
              <div className="numpad-actions">
                <button type="button" className="secondary" onClick={() => setNumpad({ open: false })}>Cancel</button>
                <button type="button" className="numpad-confirm" onClick={() => void handleNumpadConfirm()}>Confirm</button>
              </div>
            </div>
          </div>
        )}
      </div>
    );
  }

  return null;
}

// ── Sale Summary ──────────────────────────────────────────────────────────────

function SaleSummary({ sale }: { sale: Sale }) {
  return (
    <div className="sale-summary">
      <h3>Order summary</h3>
      {(sale.items?.length ?? 0) === 0 ? (
        <p className="muted compact">No services added.</p>
      ) : (
        <ul className="sale-items-list">
          {sale.items?.map((item) => (
            <li key={item.id} className="sale-item-row">
              <span>{item.worker?.displayName ?? "?"} — {item.serviceNameSnapshot}</span>
              <span>{formatMoney(item.priceCents)}</span>
            </li>
          ))}
        </ul>
      )}
      <div className="sale-totals">
        {sale.discountTotalCents > 0 && (
          <div className="total-row"><span>Discount</span><span>−{formatMoney(sale.discountTotalCents)}</span></div>
        )}
        <div className="total-row"><span>Subtotal</span><span>{formatMoney(sale.subtotalCents)}</span></div>
        <div className="total-row"><span>Tax (0%)</span><span>{formatMoney(0)}</span></div>
        {sale.tipTotalCents > 0 && (
          <div className="total-row"><span>Tip</span><span>{formatMoney(sale.tipTotalCents)}</span></div>
        )}
        <div className="total-row total-bold"><span>Total</span><span>{formatMoney(sale.totalCents)}</span></div>
      </div>
    </div>
  );
}

// ── Tip math ──────────────────────────────────────────────────────────────────

function calcInitialTipDist(items: SaleItem[], workers: Worker[], totalTipCents: number): WorkerTipShare[] {
  const byWorker = new Map<string, { worker: Worker; items: SaleItem[] }>();
  for (const item of items) {
    const worker = workers.find((w) => w.id === item.workerId);
    if (!worker) continue;
    if (!byWorker.has(item.workerId)) byWorker.set(item.workerId, { worker, items: [] });
    byWorker.get(item.workerId)!.items.push(item);
  }
  const groups = [...byWorker.values()];
  if (groups.length === 0) return [];
  const totalService = groups.reduce((sum, g) => sum + g.items.reduce((s, i) => s + Math.max(0, i.priceCents - i.discountCents), 0), 0);
  const shares: WorkerTipShare[] = groups.map((g) => {
    const serviceCents = g.items.reduce((s, i) => s + Math.max(0, i.priceCents - i.discountCents), 0);
    const proportion = totalService > 0 ? serviceCents / totalService : 1 / groups.length;
    return {
      workerId: g.worker.id,
      workerName: g.worker.displayName,
      itemIds: g.items.map((i) => i.id),
      serviceCents,
      tipCents: Math.round(totalTipCents * proportion),
    };
  });
  const diff = totalTipCents - shares.reduce((s, w) => s + w.tipCents, 0);
  if (diff !== 0 && shares.length > 0) shares[shares.length - 1].tipCents = Math.max(0, shares[shares.length - 1].tipCents + diff);
  return shares;
}

function setWorkerTip(distribution: WorkerTipShare[], changedIndex: number, newTipCents: number): WorkerTipShare[] {
  const capped = Math.max(0, newTipCents);
  return distribution.map((share, i) => (i === changedIndex ? { ...share, tipCents: capped } : share));
}

function servicePercent(serviceCents: number, totalService: number): number {
  if (totalService <= 0) return 0;
  return Math.round((serviceCents / totalService) * 100);
}

function buildTipDistributionItems(distribution: WorkerTipShare[]): { itemId: string; tipCents: number }[] {
  return distribution.flatMap((share) =>
    share.itemIds.map((itemId, idx) => {
      const base = Math.floor(share.tipCents / share.itemIds.length);
      const extra = idx === share.itemIds.length - 1 ? share.tipCents - (base * share.itemIds.length) : 0;
      return { itemId, tipCents: base + extra };
    })
  );
}

// ── Mount ─────────────────────────────────────────────────────────────────────

createRoot(document.getElementById("root")!).render(<App />);
>>>>>>> bdf0b2066dfcb2e3e613cb86c08bdfaba329da34
