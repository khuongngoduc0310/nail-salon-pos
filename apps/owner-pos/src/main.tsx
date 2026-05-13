import React, { useEffect, useState } from "react";
import { createRoot } from "react-dom/client";
import {
  createSaleForCheckin,
  fetchReadyForCheckoutCheckins,
  fetchTurnDashboard,
  fetchWaitingCheckins,
  type Checkin,
  type TurnDashboardWorker,
} from "./api.js";
import "./styles.css";

function App() {
  const [workers, setWorkers] = useState<TurnDashboardWorker[]>([]);
  const [checkins, setCheckins] = useState<Checkin[]>([]);
  const [checkoutCheckins, setCheckoutCheckins] = useState<Checkin[]>([]);
  const [status, setStatus] = useState("Loading local API data");
  const [checkoutStatus, setCheckoutStatus] = useState("Select a ready customer to start a draft sale.");

  useEffect(() => {
    let cancelled = false;

    async function loadDashboard() {
      try {
        const [dashboard, waitingCheckins, readyCheckins] = await Promise.all([
          fetchTurnDashboard(),
          fetchWaitingCheckins(),
          fetchReadyForCheckoutCheckins(),
        ]);
        if (!cancelled) {
          setWorkers(dashboard.workers);
          setCheckins(waitingCheckins);
          setCheckoutCheckins(readyCheckins);
          setStatus("Connected to local API");
        }
      } catch {
        if (!cancelled) {
          setStatus("Local API unavailable. Start it with corepack pnpm dev:api.");
        }
      }
    }

    void loadDashboard();

    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <main className="app-shell">
      <header>
        <p className="eyebrow">Owner POS</p>
        <h1>Salon floor dashboard</h1>
        <p className="status-line">{status}</p>
      </header>
      <section className="grid">
        <article>
          <h2>Check-ins</h2>
          {checkins.length === 0 ? (
            <p>No waiting check-ins.</p>
          ) : (
            <ul className="list">
              {checkins.map((checkin) => (
                <li key={checkin.id}>
                  <strong>{checkin.customer?.name ?? "Walk-in customer"}</strong>
                  <span>{checkin.notes ?? checkin.status}</span>
                </li>
              ))}
            </ul>
          )}
        </article>
        <article className="wide">
          <h2>Turns</h2>
          {workers.length === 0 ? (
            <p>Worker status, turn count, and owner assignment controls will start here.</p>
          ) : (
            <table>
              <thead>
                <tr>
                  <th>Worker</th>
                  <th>Status</th>
                  <th>Turns</th>
                  <th>Rank</th>
                  <th>Sales</th>
                  <th>Tips</th>
                </tr>
              </thead>
              <tbody>
                {workers.map((worker) => (
                  <tr key={worker.workerId}>
                    <td>{worker.name}</td>
                    <td>{worker.status.replaceAll("_", " ")}</td>
                    <td>{worker.turnsTakenToday}</td>
                    <td>{worker.suggestionRank ?? "-"}</td>
                    <td>{formatMoney(worker.salesTodayCents)}</td>
                    <td>{formatMoney(worker.tipsTodayCents)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </article>
        <article>
          <h2>Checkout</h2>
          <p>{checkoutStatus}</p>
          {checkoutCheckins.length === 0 ? (
            <p>No customers ready for checkout.</p>
          ) : (
            <ul className="list">
              {checkoutCheckins.map((checkin) => (
                <li key={checkin.id}>
                  <strong>{checkin.customer?.name ?? "Walk-in customer"}</strong>
                  <button
                    type="button"
                    onClick={() => {
                      void createSaleForCheckin(checkin.id)
                        .then((sale) => setCheckoutStatus(`Draft sale created: ${sale.id}`))
                        .catch(() => setCheckoutStatus("Could not create sale. Check the local API."));
                    }}
                  >
                    Start sale
                  </button>
                </li>
              ))}
            </ul>
          )}
        </article>
      </section>
    </main>
  );
}

function formatMoney(cents: number) {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(cents / 100);
}

createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
