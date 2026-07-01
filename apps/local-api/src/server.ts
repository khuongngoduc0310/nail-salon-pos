import { fileURLToPath } from "node:url";
import { config as loadEnv } from "dotenv";
import cors from "@fastify/cors";
import websocket from "@fastify/websocket";
import Fastify, { type FastifyServerOptions } from "fastify";
import type { PaymentTerminalAdapter } from "@nail/payment-terminal";
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
import {
  RuntimePaymentTerminalManager,
  createConfiguredPaymentTerminalManager,
  parseTerminalTransport,
  type TerminalConfigUpdate,
} from "./payment-terminal.js";
import { addClient } from "./ws/events.js";

loadEnv({ path: fileURLToPath(new URL("../../../.env", import.meta.url)) });

export type ServerOptions = {
  db?: DbClient;
  logger?: FastifyServerOptions["logger"];
  terminal?: PaymentTerminalAdapter;
};

export async function buildServer(options: ServerOptions = {}) {
  const app = Fastify({ logger: options.logger ?? true });
  const db = options.db ?? createDbClient();
  const terminal = options.terminal instanceof RuntimePaymentTerminalManager
    ? options.terminal
    : createConfiguredPaymentTerminalManager(options.terminal);
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

  // Terminal endpoints
  app.get("/api/terminal/config", async () => terminal.getSafeConfig());
  app.patch("/api/terminal/config", async (request, reply) => {
    try {
      const update = parseTerminalConfigUpdate(request.body);
      const config = terminal.updateConfig(update);
      const status = await readTerminalStatus(terminal);
      return { config, status };
    } catch (error) {
      return reply.code(400).send({ error: error instanceof Error ? error.message : "Invalid terminal config" });
    }
  });
  app.get("/api/terminal/status", async () => readTerminalStatus(terminal));
  app.post("/api/terminal/pair/start", async () => startTerminalPairing(terminal));
  app.post("/api/terminal/pair/confirm", async (request) => {
    const body = request.body as { pairingCode?: unknown } | undefined;
    return confirmTerminalPairing(terminal, typeof body?.pairingCode === "string" ? body.pairingCode : "");
  });
  app.get("/api/terminal/pair/status", async () => readTerminalPairStatus(terminal));
  app.post("/api/terminal/mock/approved", async () => {
    terminal.setMockApproved();
    return { nextStatus: "approved" };
  });
  app.post("/api/terminal/mock/tip", async (request) => {
    const body = request.body as { tipCents?: unknown } | undefined;
    const tipCents = typeof body?.tipCents === "number" && Number.isInteger(body.tipCents) && body.tipCents >= 0
      ? body.tipCents
      : 0;
    terminal.setMockTip(tipCents);
    return { nextTipCents: tipCents };
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

async function readTerminalStatus(terminal: RuntimePaymentTerminalManager) {
  const status = await terminal.verifyConnection();
  const mockPairing = await readMockCloverPairingStatus(terminal);
  if (!mockPairing) return status;
  return {
    ...status,
    connected: status.connected && mockPairing.paired,
    pairingRequired: !mockPairing.paired,
    pairingCode: undefined,
    message: mockPairing.paired
      ? status.message
      : mockPairing.pairingCode
        ? "Enter the pairing code shown on the mock Clover device"
        : "Mock Clover device is not paired",
  };
}

async function readTerminalPairStatus(terminal: RuntimePaymentTerminalManager) {
  const mockPairing = await readMockCloverPairingStatus(terminal);
  const status = terminal.getCachedConnectionStatus() ?? {
    connected: false,
    provider: "clover" as const,
    message: "Clover pairing has not been started. Press Connect / Pair to start pairing.",
  };
  if (!mockPairing) return status;
  return {
    ...status,
    connected: status.connected && mockPairing.paired,
    pairingRequired: !mockPairing.paired,
    pairingCode: undefined,
    message: mockPairing.paired
      ? status.message
      : mockPairing.pairingCode
        ? "Enter the pairing code shown on the mock Clover device"
        : "Mock Clover device is not paired",
  };
}

async function startTerminalPairing(terminal: RuntimePaymentTerminalManager) {
  const mockPairing = await postMockCloverPairing(terminal, "/mock/pair/start");
  if (!mockPairing) {
    const status = await terminal.verifyConnection();
    if (status.connected || status.pairingCode) return status;
    return waitForTerminalPairingCode(terminal, status);
  }
  return {
    connected: false,
    provider: "clover" as const,
    pairingRequired: true,
    message: "Enter the pairing code shown on the mock Clover device",
  };
}

async function waitForTerminalPairingCode(terminal: RuntimePaymentTerminalManager, fallbackStatus: Awaited<ReturnType<RuntimePaymentTerminalManager["verifyConnection"]>>) {
  const deadline = Date.now() + 8000;
  let latestStatus = fallbackStatus;
  while (Date.now() < deadline) {
    await delay(250);
    latestStatus = terminal.getCachedConnectionStatus() ?? latestStatus;
    if (latestStatus.connected || latestStatus.pairingCode) return latestStatus;
  }
  return latestStatus;
}

function delay(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function confirmTerminalPairing(terminal: RuntimePaymentTerminalManager, pairingCode: string) {
  const mockPairing = await postMockCloverPairing(terminal, "/mock/pair/confirm", { pairingCode });
  if (!mockPairing) return terminal.verifyConnection();
  return readTerminalStatus(terminal);
}

type MockCloverPairingStatus = {
  paired: boolean;
  pairingCode?: string | null;
  connected: boolean;
};

async function readMockCloverPairingStatus(terminal: RuntimePaymentTerminalManager): Promise<MockCloverPairingStatus | null> {
  return requestMockCloverPairing(terminal, "/mock/pair/status");
}

async function postMockCloverPairing(terminal: RuntimePaymentTerminalManager, path: string, body?: Record<string, unknown>): Promise<MockCloverPairingStatus | null> {
  const baseUrl = getMockCloverBaseUrl(terminal);
  if (!baseUrl) return null;
  const init: RequestInit = body
    ? { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) }
    : { method: "POST" };
  const response = await fetch(`${baseUrl}${path}`, init);
  if (!response.ok) {
    const responseBody = await response.json().catch(() => ({})) as { message?: string };
    throw new Error(responseBody.message ?? "Mock Clover pairing failed");
  }
  return await response.json() as MockCloverPairingStatus;
}

async function requestMockCloverPairing(terminal: RuntimePaymentTerminalManager, path: string, init?: RequestInit): Promise<MockCloverPairingStatus | null> {
  const baseUrl = getMockCloverBaseUrl(terminal);
  if (!baseUrl) return null;
  try {
    const response = await fetch(`${baseUrl}${path}`, init);
    if (!response.ok) return null;
    return await response.json() as MockCloverPairingStatus;
  } catch {
    return null;
  }
}

function getMockCloverBaseUrl(terminal: RuntimePaymentTerminalManager): string | null {
  const config = terminal.getConfig();
  return config.transport === "rest-local" && config.deviceBaseUrl ? config.deviceBaseUrl : null;
}

function parseTerminalConfigUpdate(value: unknown): TerminalConfigUpdate {
  const body = asRecord(value);
  const update: TerminalConfigUpdate = {};
  if (body.transport !== undefined) update.transport = parseTerminalTransport(body.transport);
  if (body.cloudBaseUrl !== undefined) update.cloudBaseUrl = optionalString(body.cloudBaseUrl, "cloudBaseUrl");
  if (body.merchantId !== undefined) update.merchantId = optionalString(body.merchantId, "merchantId");
  if (body.appId !== undefined) update.appId = optionalString(body.appId, "appId");
  if (body.appSecret !== undefined) {
    const appSecret = optionalString(body.appSecret, "appSecret");
    if (appSecret) update.appSecret = appSecret;
  }
  if (body.deviceBaseUrl !== undefined) update.deviceBaseUrl = optionalString(body.deviceBaseUrl, "deviceBaseUrl");
  if (body.deviceId !== undefined) update.deviceId = optionalString(body.deviceId, "deviceId");
  if (body.posId !== undefined) update.posId = optionalString(body.posId, "posId");
  if (body.accessToken !== undefined) {
    const accessToken = optionalString(body.accessToken, "accessToken");
    if (accessToken) update.accessToken = accessToken;
  }
  if (body.usbSidecarUrl !== undefined) update.usbSidecarUrl = optionalString(body.usbSidecarUrl, "usbSidecarUrl");
  if (body.wsUrl !== undefined) update.wsUrl = optionalString(body.wsUrl, "wsUrl");
  if (body.wsHost !== undefined) update.wsHost = optionalString(body.wsHost, "wsHost");
  if (body.wsPort !== undefined) update.wsPort = optionalPositiveInteger(body.wsPort, "wsPort");
  if (body.wsPath !== undefined) update.wsPath = optionalString(body.wsPath, "wsPath");
  if (body.wsSecure !== undefined) update.wsSecure = optionalBoolean(body.wsSecure, "wsSecure");
  if (body.wsTimeoutMs !== undefined) update.wsTimeoutMs = optionalPositiveInteger(body.wsTimeoutMs, "wsTimeoutMs");
  if (body.remoteApplicationId !== undefined) update.remoteApplicationId = optionalString(body.remoteApplicationId, "remoteApplicationId");
  if (body.posName !== undefined) update.posName = optionalString(body.posName, "posName");
  if (body.serialNumber !== undefined) update.serialNumber = optionalString(body.serialNumber, "serialNumber");
  if (body.authToken !== undefined) {
    const authToken = optionalString(body.authToken, "authToken");
    if (authToken) update.authToken = authToken;
  }
  if (body.cloudServer !== undefined) update.cloudServer = optionalString(body.cloudServer, "cloudServer");
  if (body.friendlyId !== undefined) update.friendlyId = optionalString(body.friendlyId, "friendlyId");
  return update;
}

function asRecord(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error("request body must be an object");
  }
  return value as Record<string, unknown>;
}

function optionalString(value: unknown, fieldName: string): string | undefined {
  if (value === undefined || value === null || value === "") return undefined;
  if (typeof value !== "string") throw new Error(`${fieldName} must be a string`);
  return value.trim() || undefined;
}

function optionalPositiveInteger(value: unknown, fieldName: string): number | undefined {
  if (value === undefined || value === null || value === "") return undefined;
  const parsed = typeof value === "number" ? value : Number(value);
  if (!Number.isInteger(parsed) || parsed <= 0) throw new Error(`${fieldName} must be a positive integer`);
  return parsed;
}

function optionalBoolean(value: unknown, fieldName: string): boolean | undefined {
  if (value === undefined || value === null || value === "") return undefined;
  if (typeof value === "boolean") return value;
  if (value === "true" || value === "1") return true;
  if (value === "false" || value === "0") return false;
  throw new Error(`${fieldName} must be a boolean`);
}

const isDirectRun = process.argv[1]?.endsWith("server.ts") ?? false;

if (isDirectRun) {
  const port = Number(process.env.LOCAL_API_PORT ?? 4000);
  const app = await buildServer();
  await app.listen({ host: "0.0.0.0", port });
}
