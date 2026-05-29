import cors from "@fastify/cors";
import websocket from "@fastify/websocket";
import Fastify, { type FastifyServerOptions } from "fastify";
import { MockTerminalAdapter, type PaymentTerminalAdapter } from "@nail/payment-terminal";
import { MockReceiptPrinterAdapter } from "@nail/receipt-printer";
import { createDbClient, type DbClient } from "./db.js";
import { registerAuthRoutes } from "./routes/auth.js";
import { registerCatalogRoutes } from "./routes/catalog.js";
import { registerCheckoutRoutes } from "./routes/checkout.js";
import { registerPeopleRoutes } from "./routes/people.js";
import { registerReportRoutes } from "./routes/reports.js";
import { registerSchedulingRoutes } from "./routes/scheduling.js";
import { registerSessionRoutes } from "./routes/sessions.js";
import { registerSettingsRoutes } from "./routes/settings.js";
import { registerTurnRoutes } from "./routes/turns.js";
import { registerWorkerDashboardRoutes } from "./routes/worker-dashboard.js";
import { addClient } from "./ws/events.js";

export type ServerOptions = {
  db?: DbClient;
  logger?: FastifyServerOptions["logger"];
  terminal?: PaymentTerminalAdapter;
};

export async function buildServer(options: ServerOptions = {}) {
  const app = Fastify({ logger: options.logger ?? true });
  const db = options.db ?? createDbClient();
  const terminal = options.terminal ?? new MockTerminalAdapter();
  const printer = new MockReceiptPrinterAdapter();

  await app.register(cors, { origin: true });
  await app.register(websocket);

  // WebSocket endpoint for real-time sync
  app.get("/ws", { websocket: true }, (socket) => {
    addClient(socket);
  });

  // Health
  app.get("/health", async () => ({ ok: true, service: "local-api" }));
  app.get("/api/health", async () => ({ ok: true, service: "local-api" }));

  // Terminal mock endpoints
  app.get("/api/terminal/status", async () => terminal.verifyConnection());
  app.post("/api/terminal/mock/approved", async () => {
    if (terminal instanceof MockTerminalAdapter) {
      terminal.setNextStatus("approved");
    }
    return { nextStatus: "approved" };
  });

  // Receipt mock
  app.post("/api/receipts/mock/status", async () => ({
    printedReceiptCount: printer.printedReceipts.length,
  }));

  // Register all route modules
  await registerAuthRoutes(app, db);
  await registerCatalogRoutes(app, db);
  await registerPeopleRoutes(app, db);
  await registerReportRoutes(app, db);
  await registerSchedulingRoutes(app, db);
  await registerSessionRoutes(app, db);
  await registerSettingsRoutes(app, db);
  await registerTurnRoutes(app, db);
  await registerWorkerDashboardRoutes(app, db);
  await registerCheckoutRoutes(app, db, terminal);

  return app;
}

const isDirectRun = process.argv[1]?.endsWith("server.ts") ?? false;

if (isDirectRun) {
  const port = Number(process.env.LOCAL_API_PORT ?? 4000);
  const app = await buildServer();
  await app.listen({ host: "0.0.0.0", port });
}