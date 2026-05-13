import React from "react";
import { createRoot } from "react-dom/client";
import "./styles.css";

function App() {
  return (
    <main className="mobile-shell">
      <header>
        <p>Worker PWA</p>
        <h1>Today</h1>
      </header>
      <section>
        <h2>Status</h2>
        <p>Available</p>
      </section>
      <section>
        <h2>Dashboard</h2>
        <p>Turns, active service, appointments, tips, and estimated pay will start here.</p>
      </section>
    </main>
  );
}

createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
