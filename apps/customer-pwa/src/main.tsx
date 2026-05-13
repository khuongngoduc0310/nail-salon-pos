import React from "react";
import { createRoot } from "react-dom/client";
import "./styles.css";

function App() {
  return (
    <main className="mobile-shell">
      <header>
        <p>Customer PWA</p>
        <h1>Appointments and check-in</h1>
      </header>
      <section>
        <h2>Book</h2>
        <p>Customer appointment booking will start here.</p>
      </section>
      <section>
        <h2>Check in</h2>
        <p>Walk-in and appointment check-in will start here.</p>
      </section>
    </main>
  );
}

createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
