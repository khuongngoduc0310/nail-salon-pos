import cors from "@fastify/cors";
import Fastify, { type FastifyServerOptions } from "fastify";
import { MockTerminalAdapter, type PaymentTerminalAdapter } from "@nail/payment-terminal";
import { MockReceiptPrinterAdapter, type ReceiptPrinterAdapter } from "@nail/receipt-printer";
import { createDbClient, type DbClient } from "./db.js";
import { registerCatalogRoutes } from "./routes/catalog.js";
import { registerCheckoutRoutes } from "./routes/checkout.js";
import { registerCustomerRoutes } from "./routes/customer.js";
import { registerPeopleRoutes } from "./routes/people.js";
import { registerReportRoutes } from "./routes/reports.js";
import { registerSchedulingRoutes } from "./routes/scheduling.js";
import { registerSessionRoutes } from "./routes/sessions.js";
import { registerTurnRoutes } from "./routes/turns.js";

export type ServerOptions = {
  db?: DbClient;
  logger?: FastifyServerOptions["logger"];
  terminal?: PaymentTerminalAdapter;
  printer?: ReceiptPrinterAdapter;
};

export async function buildServer(options: ServerOptions = {}) {
  const app = Fastify({ logger: options.logger ?? true });
  const db = options.db ?? createDbClient();
  const terminal = options.terminal ?? new MockTerminalAdapter();
  const printer = options.printer ?? new MockReceiptPrinterAdapter();

  app.register(cors, {
    origin: true,
  });

  app.get("/health", async () => ({
    ok: true,
    service: "local-api",
  }));

  app.get("/api/health", async () => ({
    ok: true,
    service: "local-api",
  }));

  app.get("/api/terminal/status", async () => terminal.verifyConnection());

  app.post("/api/terminal/mock/approved", async () => {
    if (terminal instanceof MockTerminalAdapter) {
      terminal.setNextStatus("approved");
    }
    return { nextStatus: "approved" };
  });

  app.post("/api/receipts/mock/status", async () => ({
    printedReceiptCount: "printedReceipts" in printer && Array.isArray(printer.printedReceipts) ? printer.printedReceipts.length : 0,
  }));

  await registerCatalogRoutes(app, db);
  await registerSessionRoutes(app, db);
  await registerPeopleRoutes(app, db);
  await registerCustomerRoutes(app, db);
  await registerSchedulingRoutes(app, db);
  await registerTurnRoutes(app, db);
  await registerCheckoutRoutes(app, db, terminal, printer);
  await registerReportRoutes(app, db);

  return app;
}

const isDirectRun = process.argv[1]?.endsWith("server.ts") ?? false;

if (isDirectRun) {
  const port = Number(process.env.LOCAL_API_PORT ?? 4000);
  const app = await buildServer();
  await app.listen({ host: "0.0.0.0", port });
}
