import React, { useEffect, useMemo, useState } from "react";
import { createRoot } from "react-dom/client";
import {
  addCustomSaleItem,
  addSaleItem,
  assignTurn,
  completeSale,
  completeTurn,
  createEmptySale,
  createSaleForCheckin,
  fetchCheckins,
  fetchSale,
  fetchServiceCategories,
  fetchTurnDashboard,
  fetchWorkers,
  recordCashPayment,
  recordGiftCardPayment,
  removeSaleItem,
  setTipDistribution,
  startCardPayment,
  startTurn,
  updateSaleItem,
  type ActiveTurn,
  type Checkin,
  type Sale,
  type SaleItem,
  type ServiceCategory,
  type TurnDashboardWorker,
  type Worker,
} from "./api.js";
import "./styles.css";

type LoadState = "loading" | "ready" | "error";
type ActiveTab = "turns" | "checkout";
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

function customerName(c?: { name?: string | null; phone?: string | null } | null): string {
  if (!c) return "Guest";
  return c.name ?? c.phone ?? "Guest";
}

function formatMoney(cents: number): string {
  return "$" + (cents / 100).toFixed(2);
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
      const [dashboard, allWorkers, waiting, inService, readyForCheckout, catalog] = await Promise.all([
        fetchTurnDashboard(),
        fetchWorkers(),
        fetchCheckins("waiting"),
        fetchCheckins("in_service"),
        fetchCheckins("ready_for_checkout"),
        fetchServiceCategories(),
      ]);
      setDashboardWorkers(dashboard.workers);
      setWorkers(allWorkers.filter((w) => w.active));
      setWaitingCheckins(waiting);
      setActiveCheckins([...inService, ...readyForCheckout]);
      setCategories(catalog);
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
          </nav>

          {activeTab === "turns" && (
            <TurnsTab
              dashboardWorkers={dashboardWorkers}
              workers={workers}
              waitingCheckins={waitingCheckins}
              assignments={assignments}
              setAssignments={setAssignments}
              suggestedWorker={suggestedWorker ?? null}
              onAssign={handleAssign}
              onTurnAction={handleTurnAction}
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
        </>
      )}
    </main>
  );
}

// ── Turns Tab ─────────────────────────────────────────────────────────────────

function TurnsTab({
  dashboardWorkers, workers, waitingCheckins, assignments, setAssignments, suggestedWorker, onAssign, onTurnAction,
}: {
  dashboardWorkers: TurnDashboardWorker[];
  workers: Worker[];
  waitingCheckins: Checkin[];
  assignments: Record<string, string>;
  setAssignments: React.Dispatch<React.SetStateAction<Record<string, string>>>;
  suggestedWorker: TurnDashboardWorker | null;
  onAssign: (c: Checkin) => Promise<void>;
  onTurnAction: (t: ActiveTurn, a: "start" | "complete") => Promise<void>;
}) {
  return (
    <div className="turns-tab">
      {waitingCheckins.length > 0 && (
        <section className="queue-section">
          <h2>Waiting queue</h2>
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
                  <select
                    value={assignments[c.id] ?? (suggestedWorker?.workerId ?? "")}
                    onChange={(e) => setAssignments((prev) => ({ ...prev, [c.id]: e.target.value }))}
                  >
                    <option value="">— select worker —</option>
                    {workers.map((w) => (
                      <option key={w.id} value={w.id}>
                        {w.displayName}{suggestedWorker?.workerId === w.id ? " ★" : ""}
                      </option>
                    ))}
                  </select>
                  <button type="button" onClick={() => void onAssign(c)}>Assign</button>
                </div>
              </li>
            ))}
          </ul>
        </section>
      )}

      <section className="turns-section">
        <h2>Worker turns today</h2>
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
              {dashboardWorkers.map((w) => {
                const inServiceNow = w.activeTurn?.status === "in_service" ? 1 : 0;
                const doneCount = Math.max(0, w.turnsTakenToday - inServiceNow);
                return (
                  <tr key={w.workerId}>
                    <td>
                      <span className="worker-name">{w.name}</span>
                      {w.suggestionRank === 1 && <span className="next-up-badge">Next up</span>}
                    </td>
                    <td>
                      <span className={"status-pill s-" + w.status}>{w.status.replace(/_/g, " ")}</span>
                    </td>
                    <td className="center-col">{w.turnsTakenToday}</td>
                    <td>
                      <div className="sq-wrap">
                        {Array.from({ length: doneCount }).map((_, i) => (
                          <span key={"d" + i} className="sq sq-done" title="Completed" />
                        ))}
                        {inServiceNow > 0 && <span className="sq sq-active" title="In service" />}
                        {w.turnsTakenToday === 0 && <span className="sq-none">—</span>}
                      </div>
                    </td>
                    <td className="right-col">{formatMoney(w.salesTodayCents)}</td>
                    <td className="right-col">{formatMoney(w.tipsTodayCents)}</td>
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
        <p className="sq-legend">
          <span className="sq sq-done" style={{ display: "inline-block" }} /> Completed &nbsp;
          <span className="sq sq-active" style={{ display: "inline-block" }} /> In service
        </p>
      </section>
    </div>
  );
}

// ── Checkout Tab ──────────────────────────────────────────────────────────────

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
    await run(async () => {
      await completeSale(currentSale.id);
      onRefresh("Sale completed.");
      resetCheckout();
    }, "Sale completed.");
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
          <div className="empty-start-wrap">
            <p className="empty-hint big">Select a customer above to start an order.</p>
            <button type="button" className="secondary" onClick={() => void handleStartNoCheckinSale()}>
              No check-in customer
            </button>
          </div>
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
