import React, { useEffect, useMemo, useState } from "react";
import { createRoot } from "react-dom/client";
import {
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
  createSaleForCheckin,
  fetchCheckins,
  fetchSale,
  fetchSaleReceipts,
  fetchServiceCategories,
  fetchTurnDashboard,
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
  type WorkSession,
  type Worker,
  type WorkerReportRow,
  type WorkerStatus,
} from "./api.js";
import "./styles.css";

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

  return (
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
