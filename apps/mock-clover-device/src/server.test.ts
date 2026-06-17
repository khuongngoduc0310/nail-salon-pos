import { afterEach, describe, expect, it } from "vitest";
import { RestPayDisplayAdapter } from "@nail/clover-payment";
import { buildMockCloverDeviceServer } from "./server.js";

const apps: Array<Awaited<ReturnType<typeof buildMockCloverDeviceServer>>> = [];

afterEach(async () => {
  await Promise.all(apps.splice(0).map((app) => app.close()));
});

describe("mock Clover REST Pay Display device", () => {
  it("accepts Clover-shaped payment requests and returns Clover-shaped payment details", async () => {
    const app = await buildMockCloverDeviceServer({ logger: false });
    apps.push(app);

    await pairMockDevice(app);

    const response = await app.inject({
      method: "POST",
      url: "/connect/v1/payments",
      payload: { amount: 6900, externalPaymentId: "sale-idem-1" },
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toMatchObject({
      payment: {
        amount: 6900,
        externalPaymentId: "sale-idem-1",
        result: "SUCCESS",
        order: { id: "MOCKORDER000001" },
        cardTransaction: {
          authCode: "MOCKOK",
          cardType: "VISA",
          last4: "1111",
          state: "CLOSED",
          type: "AUTH",
        },
      },
    });
  });

  it("starts pairing without sending an empty JSON body", async () => {
    const app = await buildMockCloverDeviceServer({ logger: false });
    apps.push(app);

    const response = await app.inject({
      method: "POST",
      url: "/mock/pair/start",
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toMatchObject({ paired: false, connected: true });
    expect(response.json().pairingCode).toMatch(/^\d{6}$/);
  });

  it("lets the Clover adapter connect, read tip, and normalize the payment", async () => {
    const app = await buildMockCloverDeviceServer({ logger: false, initialConfig: { nextTipAmount: 900 } });
    apps.push(app);
    const adapter = adapterFor(app);
    await pairMockDevice(app);

    await expect(adapter.verifyConnection()).resolves.toMatchObject({ connected: true, provider: "clover", transport: "rest-local" });
    await expect(
      adapter.startCardSale({ amountCents: 6000, idempotencyKey: "sale-idem-2", tipFlow: "pre_payment_device" })
    ).resolves.toMatchObject({
      status: "approved",
      providerPaymentId: "MOCKCLOVERPAY000001",
      providerOrderId: "MOCKORDER000001",
      externalPaymentId: "sale-idem-2",
      authCode: "MOCKOK",
      cardBrand: "VISA",
      cardLast4: "1111",
      baseAmountCents: 6000,
      tipCents: 900,
      totalChargedCents: 6900,
    });
  });

  it("filters payment search by Clover externalPaymentId for recovery", async () => {
    const app = await buildMockCloverDeviceServer({ logger: false });
    apps.push(app);
    await pairMockDevice(app);

    await app.inject({ method: "POST", url: "/connect/v1/payments", payload: { amount: 1000, externalPaymentId: "recover-me" } });
    await app.inject({ method: "POST", url: "/connect/v1/payments", payload: { amount: 2000, externalPaymentId: "ignore-me" } });

    const response = await app.inject({
      method: "POST",
      url: "/connect/v1/payments/search",
      payload: { start: new Date(0).toISOString(), end: new Date().toISOString(), externalPaymentId: "recover-me" },
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toMatchObject({
      payments: [{ payment: { amount: 1000, externalPaymentId: "recover-me" } }],
    });
    expect(response.json().payments).toHaveLength(1);
  });

  it("returns declined and cancelled Clover responses that normalize to POS statuses", async () => {
    const declinedApp = await buildMockCloverDeviceServer({ logger: false, initialConfig: { nextPaymentResult: "DECLINED" } });
    const cancelledApp = await buildMockCloverDeviceServer({ logger: false, initialConfig: { nextPaymentResult: "CANCELLED" } });
    apps.push(declinedApp, cancelledApp);
    await pairMockDevice(declinedApp);
    await pairMockDevice(cancelledApp);

    await expect(adapterFor(declinedApp).startCardSale({ amountCents: 1000, idempotencyKey: "declined" })).resolves.toMatchObject({
      status: "declined",
      totalChargedCents: 0,
    });
    await expect(adapterFor(cancelledApp).startCardSale({ amountCents: 1000, idempotencyKey: "cancelled" })).resolves.toMatchObject({
      status: "cancelled",
      totalChargedCents: 0,
    });
  });

  it("supports mock configuration and strips sensitive fields through the Clover adapter", async () => {
    const app = await buildMockCloverDeviceServer({ logger: false });
    apps.push(app);

    const configResponse = await app.inject({
      method: "POST",
      url: "/mock/config",
      payload: { includeSensitiveFields: true, cardType: "MASTERCARD", last4: "4444" },
    });
    expect(configResponse.statusCode).toBe(200);
    await pairMockDevice(app);

    const result = await adapterFor(app).startCardSale({ amountCents: 2500, idempotencyKey: "sensitive" });
    expect(result).toMatchObject({ cardBrand: "MASTERCARD", cardLast4: "4444" });
    expect(JSON.stringify(result.rawProviderReference)).not.toContain("4111111111111111");
    expect(JSON.stringify(result.rawProviderReference)).not.toContain("raw-emv-data");
    expect(JSON.stringify(result.rawProviderReference)).not.toContain("sensitive-track-data");
  });
});

async function pairMockDevice(app: Awaited<ReturnType<typeof buildMockCloverDeviceServer>>) {
  const start = await app.inject({ method: "POST", url: "/mock/pair/start" });
  const pairingCode = start.json().pairingCode;
  await app.inject({ method: "POST", url: "/mock/pair/confirm", payload: { pairingCode } });
}

function adapterFor(app: Awaited<ReturnType<typeof buildMockCloverDeviceServer>>) {
  return new RestPayDisplayAdapter(
    {
      transport: "rest-local",
      deviceBaseUrl: "http://mock-clover.local:4100",
      deviceId: "mock-clover-mini-1",
      posId: "owner-pos-test",
      accessToken: "mock-token",
    },
    {
      fetch: async (url: string, init?: RequestInit) => {
        const parsed = new URL(url);
        const method = readInjectMethod(init?.method);
        const response = await app.inject({
          method,
          url: parsed.pathname,
          headers: Object.fromEntries(new Headers(init?.headers).entries()),
          payload: typeof init?.body === "string" ? init.body : undefined,
        });
        return new Response(response.body, {
          status: response.statusCode,
          headers: response.headers as unknown as HeadersInit,
        });
      },
    }
  );
}

function readInjectMethod(method: string | undefined): "GET" | "POST" {
  if (!method || method === "GET") {
    return "GET";
  }
  if (method === "POST") {
    return "POST";
  }
  throw new Error(`Unsupported mock fetch method: ${method}`);
}
