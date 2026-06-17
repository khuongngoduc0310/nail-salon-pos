import { fileURLToPath } from "node:url";
import { config as loadEnv } from "dotenv";
import Fastify, { type FastifyServerOptions } from "fastify";

loadEnv({ path: fileURLToPath(new URL("../../../.env", import.meta.url)) });

export type MockCloverPaymentResult = "SUCCESS" | "DECLINED" | "CANCELLED" | "FAILED";

export type MockCloverDeviceConfig = {
  connected: boolean;
  nextPaymentResult: MockCloverPaymentResult;
  nextTipAmount: number;
  cardType: string;
  last4: string;
  authCode: string;
  responseDelayMs: number;
  includeSensitiveFields: boolean;
};

type MockPaymentRecord = {
  id: string;
  amount: number;
  tipAmount: number;
  externalPaymentId: string;
  saleId?: string;
  result: MockCloverPaymentResult;
  createdTime: number;
  orderId: string;
  cardType: string;
  last4: string;
  authCode: string;
};

type MockPairingState = {
  paired: boolean;
  pairingCode: string | null;
  authToken: string | null;
};

export type MockCloverServerOptions = {
  logger?: FastifyServerOptions["logger"];
  initialConfig?: Partial<MockCloverDeviceConfig>;
};

const defaultConfig: MockCloverDeviceConfig = {
  connected: true,
  nextPaymentResult: "SUCCESS",
  nextTipAmount: 0,
  cardType: "VISA",
  last4: "1111",
  authCode: "MOCKOK",
  responseDelayMs: 0,
  includeSensitiveFields: false,
};

export async function buildMockCloverDeviceServer(options: MockCloverServerOptions = {}) {
  const app = Fastify({ logger: options.logger ?? true });
  let config: MockCloverDeviceConfig = { ...defaultConfig, ...options.initialConfig };
  let pairing: MockPairingState = { paired: false, pairingCode: null, authToken: null };
  const payments: MockPaymentRecord[] = [];

  app.get("/", async (_request, reply) => reply.type("text/html").send(renderMockCloverUi()));

  app.get("/health", async () => ({ ok: true, service: "mock-clover-device" }));

  app.get("/mock/config", async () => config);

  app.post("/mock/config", async (request) => {
    const body = asObject(request.body);
    config = { ...config, ...normalizeConfigPatch(body) };
    return config;
  });

  app.post("/mock/reset", async () => {
    config = { ...defaultConfig, ...options.initialConfig };
    pairing = { paired: false, pairingCode: null, authToken: null };
    payments.length = 0;
    return { ok: true, config, pairing };
  });

  app.get("/mock/payments", async () => ({ payments }));

  app.get("/mock/pair/status", async () => ({ ...pairing, connected: config.connected }));

  app.post("/mock/pair/start", async () => {
    pairing = {
      paired: false,
      pairingCode: String(Math.floor(100000 + Math.random() * 900000)),
      authToken: null,
    };
    return { ...pairing, connected: config.connected };
  });

  app.post("/mock/pair/confirm", async (request, reply) => {
    const body = asObject(request.body);
    const pairingCode = requiredString(body.pairingCode, "pairingCode");
    if (!pairing.pairingCode || pairingCode !== pairing.pairingCode) {
      return reply.code(400).send({ message: "Pairing code does not match the Clover device" });
    }
    pairing = {
      paired: true,
      pairingCode: null,
      authToken: `mock-auth-${Date.now()}`,
    };
    return { ...pairing, connected: config.connected };
  });

  app.post("/mock/pair/approve", async () => {
    pairing = {
      paired: true,
      pairingCode: null,
      authToken: `mock-auth-${Date.now()}`,
    };
    return { ...pairing, connected: config.connected };
  });

  app.post("/mock/pair/clear", async () => {
    pairing = { paired: false, pairingCode: null, authToken: null };
    return { ...pairing, connected: config.connected };
  });

  app.post("/connect/v1/device/welcome", async (_request, reply) => {
    await delay(config.responseDelayMs);
    if (!config.connected) {
      return reply.code(503).send({ message: "Mock Clover device is disconnected" });
    }
    if (!pairing.paired) {
      return reply.code(409).send({ message: "Mock Clover device is not paired", pairingRequired: true });
    }

    return {
      message: "Welcome",
      device: {
        id: "mock-clover-mini-1",
        model: "Clover Mini",
        ready: true,
      },
    };
  });

  app.post("/connect/v1/device/read-tip", async (request, reply) => {
    await delay(config.responseDelayMs);
    if (!config.connected) {
      return reply.code(503).send({ message: "Mock Clover device is disconnected" });
    }
    if (!pairing.paired) {
      return reply.code(409).send({ message: "Mock Clover device is not paired", pairingRequired: true });
    }

    const body = asObject(request.body);
    const baseAmount = requiredPositiveInteger(body.baseAmount, "baseAmount");
    return {
      baseAmount,
      tipAmount: config.nextTipAmount,
    };
  });

  app.post("/connect/v1/payments", async (request, reply) => {
    await delay(config.responseDelayMs);
    if (!config.connected) {
      return reply.code(503).send({ message: "Mock Clover device is disconnected" });
    }
    if (!pairing.paired) {
      return reply.code(409).send({ message: "Mock Clover device is not paired", pairingRequired: true });
    }

    const body = asObject(request.body);
    const amount = requiredPositiveInteger(body.amount, "amount");
    const externalPaymentId = requiredString(body.externalPaymentId, "externalPaymentId");
    const saleId = optionalString(body.saleId, "saleId");
    const createdTime = Date.now();
    const id = `MOCKCLOVERPAY${String(payments.length + 1).padStart(6, "0")}`;
    const orderId = saleId ? `MOCKORDER_${saleId}` : `MOCKORDER${String(payments.length + 1).padStart(6, "0")}`;

    const record: MockPaymentRecord = {
      id,
      amount,
      externalPaymentId,
      saleId,
      result: config.nextPaymentResult,
      createdTime,
      orderId,
      tipAmount: config.nextTipAmount,
      cardType: config.cardType,
      last4: config.last4,
      authCode: config.authCode,
    };
    payments.push(record);

    if (config.nextPaymentResult === "FAILED") {
      return reply.code(500).send({ message: "Mock Clover payment failed", reason: "FAILED" });
    }

    return { payment: buildPaymentResponse(record, config.includeSensitiveFields) };
  });

  app.post("/connect/v1/device/cancel", async () => ({ status: "CANCELLED" }));

  app.post("/connect/v1/payments/:paymentId/refund", async (request, reply) => {
    await delay(config.responseDelayMs);
    if (!config.connected) {
      return reply.code(503).send({ message: "Mock Clover device is disconnected" });
    }
    if (!pairing.paired) {
      return reply.code(409).send({ message: "Mock Clover device is not paired", pairingRequired: true });
    }

    const params = asObject(request.params);
    const body = asObject(request.body);
    const paymentId = requiredString(params.paymentId, "paymentId");
    const amount = requiredPositiveInteger(body.amount, "amount");
    const payment = payments.find((record) => record.id === paymentId);
    if (!payment) {
      return reply.code(404).send({ message: "Payment not found" });
    }

    return {
      refund: {
        id: `MOCKREFUND${paymentId}${amount}`,
        amount,
        payment: { id: paymentId },
        result: "SUCCESS",
      },
    };
  });

  app.post("/connect/v1/payments/search", async (request) => {
    const body = request.body === undefined ? {} : asObject(request.body);
    const externalPaymentId = optionalString(body.externalPaymentId, "externalPaymentId");
    const matchingPayments = externalPaymentId
      ? payments.filter((record) => record.externalPaymentId === externalPaymentId)
      : payments;
    return {
      payments: matchingPayments.map((record) => ({ payment: buildPaymentResponse(record, false) })),
    };
  });

  return app;
}

function renderMockCloverUi(): string {
  return String.raw`<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>Mock Clover Device</title>
  <style>
    :root { color-scheme: light; font-family: Inter, system-ui, -apple-system, Segoe UI, sans-serif; }
    body { margin: 0; background: #f4f7f5; color: #162018; }
    header { background: #0f7b3a; color: white; padding: 20px; }
    main { display: grid; grid-template-columns: repeat(auto-fit, minmax(280px, 1fr)); gap: 16px; padding: 16px; }
    section { background: white; border: 1px solid #dce5dd; border-radius: 14px; padding: 16px; box-shadow: 0 2px 8px rgba(0,0,0,.05); }
    h1, h2 { margin: 0 0 10px; }
    h1 { font-size: 22px; }
    h2 { font-size: 16px; }
    button, select, input { font: inherit; border-radius: 10px; border: 1px solid #c9d7cc; padding: 9px 10px; }
    button { cursor: pointer; background: #0f7b3a; color: white; border-color: #0f7b3a; font-weight: 700; }
    button.secondary { background: white; color: #162018; border-color: #c9d7cc; }
    button.danger { background: #b42318; border-color: #b42318; }
    .row { display: flex; gap: 8px; flex-wrap: wrap; align-items: center; margin-top: 10px; }
    .stack { display: grid; gap: 10px; }
    .status { display: inline-flex; align-items: center; gap: 8px; border-radius: 999px; padding: 6px 10px; font-weight: 700; }
    .ok { background: #dcfce7; color: #166534; }
    .bad { background: #fee2e2; color: #991b1b; }
    .muted { color: #66756a; font-size: 13px; }
    .code { font-family: ui-monospace, SFMono-Regular, Consolas, monospace; background: #eef6ef; padding: 2px 6px; border-radius: 6px; }
    table { width: 100%; border-collapse: collapse; font-size: 13px; }
    th, td { text-align: left; border-bottom: 1px solid #e6eee8; padding: 8px 4px; vertical-align: top; }
    .wide { grid-column: 1 / -1; }
  </style>
</head>
<body>
  <header>
    <h1>Mock Clover Device</h1>
    <div class="muted" style="color:#dff7e5">Use this page to simulate Clover connection, pairing, payment result, and terminal tip.</div>
  </header>
  <main>
    <section>
      <h2>Connection</h2>
      <div id="connectionStatus" class="status bad">Checking...</div>
      <div class="row">
        <button onclick="setConnected(true)">Connect</button>
        <button class="danger" onclick="setConnected(false)">Disconnect</button>
        <button class="secondary" onclick="refreshAll()">Refresh</button>
      </div>
    </section>

    <section>
      <h2>Pairing Simulator</h2>
      <div id="pairingStatus" class="muted">Checking...</div>
      <div class="row">
        <button onclick="post('/mock/pair/start')">Show Code on Clover</button>
        <button class="secondary" onclick="post('/mock/pair/clear')">Clear Pairing</button>
      </div>
    </section>

    <section>
      <h2>Next Payment</h2>
      <div class="stack">
        <label>Result
          <select id="nextPaymentResult" onchange="saveConfig()">
            <option value="SUCCESS">Approved</option>
            <option value="DECLINED">Declined</option>
            <option value="CANCELLED">Cancelled</option>
            <option value="FAILED">Failed</option>
          </select>
        </label>
        <label>Card brand <input id="cardType" onchange="saveConfig()" /></label>
        <label>Last 4 <input id="last4" maxlength="4" onchange="saveConfig()" /></label>
      </div>
    </section>

    <section>
      <h2>Tip Options</h2>
      <div class="row">
        <button class="secondary" onclick="setTip(0)">No tip</button>
        <button class="secondary" onclick="setTip(100)">$1</button>
        <button class="secondary" onclick="setTip(200)">$2</button>
        <button class="secondary" onclick="setTip(500)">$5</button>
      </div>
      <div class="row">
        <label>Custom cents <input id="nextTipAmount" type="number" min="0" step="1" onchange="saveConfig()" /></label>
      </div>
    </section>

    <section>
      <h2>Security Test</h2>
      <label><input id="includeSensitiveFields" type="checkbox" onchange="saveConfig()" /> Include sensitive fields in mock Clover response</label>
      <p class="muted">Use this to verify POS strips PAN, track data, and raw EMV from stored metadata.</p>
    </section>

    <section>
      <h2>Reset</h2>
      <button class="danger" onclick="post('/mock/reset')">Reset mock device</button>
      <p class="muted">Clears payments, pairing, and restores default config.</p>
    </section>

    <section class="wide">
      <h2>Payment Activity</h2>
      <table>
        <thead><tr><th>Time</th><th>External ID</th><th>Amount</th><th>Tip</th><th>Result</th><th>Payment ID</th><th>Card</th></tr></thead>
        <tbody id="payments"><tr><td colspan="7" class="muted">No payments yet.</td></tr></tbody>
      </table>
    </section>
  </main>
<script>
const money = cents => '$' + (Number(cents || 0) / 100).toFixed(2);
async function getJson(url) { const res = await fetch(url); return res.json(); }
async function post(url, body) {
  const init = body === undefined
    ? { method: 'POST' }
    : { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) };
  await fetch(url, init);
  await refreshAll();
}
async function saveConfig() {
  await post('/mock/config', {
    nextPaymentResult: document.getElementById('nextPaymentResult').value,
    nextTipAmount: Number(document.getElementById('nextTipAmount').value || 0),
    cardType: document.getElementById('cardType').value || 'VISA',
    last4: document.getElementById('last4').value || '1111',
    includeSensitiveFields: document.getElementById('includeSensitiveFields').checked,
  });
}
async function setConnected(connected) { await post('/mock/config', { connected }); }
async function setTip(nextTipAmount) {
  document.getElementById('nextTipAmount').value = String(nextTipAmount);
  await saveConfig();
}
async function refreshAll() {
  const [config, pair, paymentData] = await Promise.all([getJson('/mock/config'), getJson('/mock/pair/status'), getJson('/mock/payments')]);
  document.getElementById('connectionStatus').className = 'status ' + (config.connected ? 'ok' : 'bad');
  document.getElementById('connectionStatus').textContent = config.connected ? 'Connected' : 'Disconnected';
  document.getElementById('nextPaymentResult').value = config.nextPaymentResult;
  document.getElementById('nextTipAmount').value = config.nextTipAmount;
  document.getElementById('cardType').value = config.cardType;
  document.getElementById('last4').value = config.last4;
  document.getElementById('includeSensitiveFields').checked = config.includeSensitiveFields;
  document.getElementById('pairingStatus').innerHTML = pair.paired
    ? 'Paired. Auth token: <span class="code">' + pair.authToken + '</span>'
    : pair.pairingCode
      ? 'Clover is showing pairing code: <span class="code">' + pair.pairingCode + '</span><br><span class="muted">Enter this code in the POS pairing pop-up.</span>'
      : 'Not paired. Click "Show Code on Clover" to begin.';
  const rows = paymentData.payments || [];
  document.getElementById('payments').innerHTML = rows.length ? rows.slice().reverse().map(p => '<tr>' +
    '<td>' + new Date(p.createdTime).toLocaleTimeString() + '</td>' +
    '<td><span class="code">' + p.externalPaymentId + '</span></td>' +
    '<td>' + money(p.amount) + '</td>' +
    '<td>' + money(p.tipAmount) + '</td>' +
    '<td>' + p.result + '</td>' +
    '<td>' + p.id + '</td>' +
    '<td>' + p.cardType + ' •••• ' + p.last4 + '</td>' +
  '</tr>').join('') : '<tr><td colspan="7" class="muted">No payments yet.</td></tr>';
}
refreshAll();
setInterval(refreshAll, 3000);
</script>
</body>
</html>`;
}

function buildPaymentResponse(record: MockPaymentRecord, includeSensitiveFields: boolean) {
  const successful = record.result === "SUCCESS";
  const payment = {
    amount: record.amount,
    tipAmount: successful ? record.tipAmount : 0,
    cardTransaction: successful
      ? {
          authCode: record.authCode,
          cardType: record.cardType,
          entryType: "EMV_CONTACT",
          extra: {
            authorizingNetworkName: record.cardType,
            applicationIdentifier: "A0000000031010",
            applicationLabel: record.cardType,
            ...(includeSensitiveFields ? { emvData: "raw-emv-data" } : {}),
          },
          last4: record.last4,
          referenceId: `MOCKREF${record.id}`,
          state: "CLOSED",
          transactionNo: record.id.slice(-6),
          type: "AUTH",
          ...(includeSensitiveFields ? { cardNumber: "4111111111111111", track2: "sensitive-track-data" } : {}),
        }
      : undefined,
    createdTime: record.createdTime,
    employee: { id: "DFLTEMPLOYEE" },
    externalPaymentId: record.externalPaymentId,
    saleId: record.saleId,
    id: record.id,
    offline: false,
    order: { id: record.orderId },
    result: record.result,
    taxAmount: 0,
    ...(record.result === "DECLINED" ? { reason: "NOT_APPROVED" } : {}),
    ...(record.result === "CANCELLED" ? { reason: "USER_CUSTOMER_CANCEL" } : {}),
  };

  return includeSensitiveFields ? { ...payment, pan: "4111111111111111" } : payment;
}

function normalizeConfigPatch(body: Record<string, unknown>): Partial<MockCloverDeviceConfig> {
  const patch: Partial<MockCloverDeviceConfig> = {};
  if (body.connected !== undefined) patch.connected = requiredBoolean(body.connected, "connected");
  if (body.nextPaymentResult !== undefined) patch.nextPaymentResult = requiredPaymentResult(body.nextPaymentResult, "nextPaymentResult");
  if (body.nextTipAmount !== undefined) patch.nextTipAmount = requiredNonNegativeInteger(body.nextTipAmount, "nextTipAmount");
  if (body.cardType !== undefined) patch.cardType = requiredString(body.cardType, "cardType");
  if (body.last4 !== undefined) patch.last4 = requiredString(body.last4, "last4");
  if (body.authCode !== undefined) patch.authCode = requiredString(body.authCode, "authCode");
  if (body.responseDelayMs !== undefined) patch.responseDelayMs = requiredNonNegativeInteger(body.responseDelayMs, "responseDelayMs");
  if (body.includeSensitiveFields !== undefined) patch.includeSensitiveFields = requiredBoolean(body.includeSensitiveFields, "includeSensitiveFields");
  return patch;
}

function asObject(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error("body must be an object");
  }
  return value as Record<string, unknown>;
}

function requiredString(value: unknown, fieldName: string): string {
  if (typeof value !== "string" || !value.trim()) {
    throw new Error(`${fieldName} is required`);
  }
  return value;
}

function optionalString(value: unknown, fieldName: string): string | undefined {
  if (value === undefined || value === null || value === "") {
    return undefined;
  }
  return requiredString(value, fieldName);
}

function requiredBoolean(value: unknown, fieldName: string): boolean {
  if (typeof value !== "boolean") {
    throw new Error(`${fieldName} must be a boolean`);
  }
  return value;
}

function requiredPositiveInteger(value: unknown, fieldName: string): number {
  if (typeof value !== "number" || !Number.isInteger(value) || value <= 0) {
    throw new Error(`${fieldName} must be a positive integer`);
  }
  return value;
}

function requiredNonNegativeInteger(value: unknown, fieldName: string): number {
  if (typeof value !== "number" || !Number.isInteger(value) || value < 0) {
    throw new Error(`${fieldName} must be a non-negative integer`);
  }
  return value;
}

function requiredPaymentResult(value: unknown, fieldName: string): MockCloverPaymentResult {
  if (value === "SUCCESS" || value === "DECLINED" || value === "CANCELLED" || value === "FAILED") {
    return value;
  }
  throw new Error(`${fieldName} must be SUCCESS, DECLINED, CANCELLED, or FAILED`);
}

async function delay(ms: number): Promise<void> {
  if (ms > 0) {
    await new Promise((resolve) => setTimeout(resolve, ms));
  }
}

const isDirectRun = process.argv[1]?.endsWith("server.ts") ?? false;

if (isDirectRun) {
  const port = Number(process.env.MOCK_CLOVER_PORT ?? 4100);
  const app = await buildMockCloverDeviceServer();
  await app.listen({ host: "0.0.0.0", port });
}
