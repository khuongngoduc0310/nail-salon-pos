import { describe, expect, it } from "vitest";
import {
  CloverCloudPayDisplayAdapter,
  MockCloverPaymentAdapter,
  RestPayDisplayAdapter,
  UsbSidecarAdapter,
  CloverRemotePayLanAdapter,
  createCloverPaymentAdapter,
  loadCloverPaymentConfig,
  resolveWsUrl,
  validateCloverPaymentConfig,
  type CloverHttpClient,
} from "./index.js";

describe("MockCloverPaymentAdapter", () => {
  it("returns approved card metadata with Clover tip separated from base amount", async () => {
    const adapter = new MockCloverPaymentAdapter("approved", 1500);

    await expect(
      adapter.startCardSale({
        amountCents: 6000,
        idempotencyKey: "abc",
        saleId: "sale-1",
        tipFlow: "pre_payment_device",
      })
    ).resolves.toMatchObject({
      status: "approved",
      providerPaymentId: "clover_mock_abc",
      providerOrderId: "order_sale-1",
      externalPaymentId: "abc",
      authCode: "MOCKOK",
      cardBrand: "Visa",
      cardLast4: "1111",
      baseAmountCents: 6000,
      tipCents: 1500,
      totalChargedCents: 7500,
    });
  });

  it.each(["declined", "cancelled", "failed"] as const)("does not charge totals when %s", async (status) => {
    const adapter = new MockCloverPaymentAdapter(status, 500);

    await expect(adapter.startCardSale({ amountCents: 6000, idempotencyKey: status, tipFlow: "pre_payment_device" })).resolves.toMatchObject({
      status,
      baseAmountCents: 6000,
      tipCents: 0,
      totalChargedCents: 0,
    });
  });

  it("reconciles approved mock payments", async () => {
    const adapter = new MockCloverPaymentAdapter("approved", 250);

    await adapter.startCardSale({ amountCents: 1000, idempotencyKey: "one", tipFlow: "pre_payment_device" });
    await adapter.startCardSale({ amountCents: 2000, idempotencyKey: "two", tipFlow: "pre_payment_device" });

    await expect(adapter.reconcile({ start: new Date(0), end: new Date() })).resolves.toMatchObject({
      provider: "clover",
      transport: "mock",
      cardTotalCents: 3500,
      payments: [{ providerPaymentId: "clover_mock_one" }, { providerPaymentId: "clover_mock_two" }],
    });
  });
});

describe("Clover config", () => {
  it("defaults to mock transport", () => {
    expect(loadCloverPaymentConfig({})).toEqual({ transport: "mock" });
  });

  it("validates rest-local required fields", () => {
    expect(validateCloverPaymentConfig({ transport: "rest-local" })).toEqual([
      "CLOVER_DEVICE_BASE_URL is required for rest-local transport",
      "CLOVER_DEVICE_ID is required for rest-local transport",
      "CLOVER_POS_ID is required for rest-local transport",
      "CLOVER_ACCESS_TOKEN is required for rest-local transport",
    ]);
  });

  it("validates rest-cloud required fields", () => {
    expect(validateCloverPaymentConfig({ transport: "rest-cloud" })).toEqual([
      "CLOVER_CLOUD_BASE_URL is required for rest-cloud transport",
      "CLOVER_DEVICE_ID is required for rest-cloud transport",
      "CLOVER_POS_ID is required for rest-cloud transport",
      "CLOVER_ACCESS_TOKEN is required for rest-cloud transport",
    ]);
  });

  it("loads rest-cloud environment config", () => {
    expect(loadCloverPaymentConfig({
      CLOVER_TRANSPORT: "rest-cloud",
      CLOVER_CLOUD_BASE_URL: "https://sandbox.clover.example/connect",
      CLOVER_MERCHANT_ID: "MERCHANT123",
      CLOVER_APP_ID: "APP123",
      CLOVER_APP_SECRET: "secret",
      CLOVER_ACCESS_TOKEN: "access",
      CLOVER_DEVICE_ID: "device-1",
      CLOVER_POS_ID: "owner-pos",
      CLOVER_REMOTE_APP_ID: "DEV.APP123",
      CLOVER_PAYMENT_TIMEOUT_MS: "90000",
      CLOVER_CLOUD_SERVER: "https://api.clover.com",
      CLOVER_FRIENDLY_ID: "TL Nails And Spa 625",
    })).toMatchObject({
      transport: "rest-cloud",
      cloudBaseUrl: "https://sandbox.clover.example/connect",
      merchantId: "MERCHANT123",
      appId: "APP123",
      appSecret: "secret",
      accessToken: "access",
      deviceId: "device-1",
      posId: "owner-pos",
      remoteApplicationId: "DEV.APP123",
      wsTimeoutMs: 90000,
      cloudServer: "https://api.clover.com",
      friendlyId: "TL Nails And Spa 625",
    });
  });

  it("validates usb sidecar URL", () => {
    expect(validateCloverPaymentConfig({ transport: "usb-sidecar" })).toEqual([
      "CLOVER_USB_SIDECAR_URL is required for usb-sidecar transport",
    ]);
  });

  it("validates LAN WebSocket required fields", () => {
    expect(validateCloverPaymentConfig({ transport: "ws-lan" })).toEqual([
      "CLOVER_WS_URL/CLOVER_ENDPOINT or CLOVER_WS_HOST with optional CLOVER_WS_PORT is required for ws-lan transport",
      "CLOVER_REMOTE_APP_ID is required for ws-lan transport",
      "CLOVER_POS_NAME is required for ws-lan transport",
      "CLOVER_SERIAL_NUMBER is required for ws-lan transport",
    ]);
  });

  it("validates cloud WebSocket required fields", () => {
    expect(validateCloverPaymentConfig({ transport: "ws-cloud" })).toEqual([
      "CLOVER_REMOTE_APP_ID is required for ws-cloud transport",
      "CLOVER_DEVICE_ID is required for ws-cloud transport",
      "CLOVER_MERCHANT_ID is required for ws-cloud transport",
      "CLOVER_ACCESS_TOKEN is required for ws-cloud transport",
      "CLOVER_CLOUD_SERVER is required for ws-cloud transport",
    ]);
  });

  it("uses explicit LAN WebSocket URL before host and port fields", () => {
    expect(resolveWsUrl({
      CLOVER_WS_URL: "wss://10.0.0.9:12345/explicit",
      CLOVER_WS_HOST: "192.168.1.20",
      CLOVER_WS_PORT: "12345",
    })).toBe("wss://10.0.0.9:12345/explicit");
  });

  it("builds LAN WebSocket URL from host and port", () => {
    expect(loadCloverPaymentConfig({
      CLOVER_TRANSPORT: "ws-lan",
      CLOVER_WS_HOST: "192.168.1.20",
      CLOVER_WS_PORT: "12345",
    })).toMatchObject({
      transport: "ws-lan",
      wsUrl: "wss://192.168.1.20:12345/remote_pay",
      wsHost: "192.168.1.20",
      wsPort: 12345,
      wsPath: "/remote_pay",
    });
  });

  it("builds LAN WebSocket URL with custom path", () => {
    expect(resolveWsUrl({
      CLOVER_WS_HOST: "192.168.1.20",
      CLOVER_WS_PORT: "12345",
      CLOVER_WS_PATH: "custom_remote_pay",
    })).toBe("wss://192.168.1.20:12345/custom_remote_pay");
  });

  it("can build insecure LAN WebSocket URL for test networks", () => {
    expect(resolveWsUrl({
      CLOVER_WS_HOST: "127.0.0.1",
      CLOVER_WS_PORT: "12345",
      CLOVER_WS_SECURE: "false",
    })).toBe("ws://127.0.0.1:12345/remote_pay");
  });

  it("creates the requested adapter type", () => {
    expect(createCloverPaymentAdapter({ transport: "mock" })).toBeInstanceOf(MockCloverPaymentAdapter);
  });
});

describe("HTTP adapters", () => {
  it("maps REST Pay Display sales to Clover /v1/payments and required headers", async () => {
    const calls: Array<{ url: string; init?: RequestInit }> = [];
    const http = jsonFetch(calls, {
      payment: {
        result: "SUCCESS",
        id: "clover-payment-1",
        amount: 3000,
        order: { id: "clover-order-1" },
        cardTransaction: {
          authCode: "A1B2",
          cardType: "MASTERCARD",
          last4: "4444",
          cardNumber: "4111111111111111",
          extra: { emvData: "raw" },
        },
      },
    });
    const adapter = new RestPayDisplayAdapter(
      {
        transport: "rest-local",
        deviceBaseUrl: "http://192.168.1.20:12346",
        deviceId: "mini-3",
        posId: "owner-pos",
        accessToken: "token",
      },
      { fetch: http }
    );

    const result = await adapter.startCardSale({ amountCents: 3000, idempotencyKey: "idem-1", tipFlow: "none" });

    expect(calls[0].url).toBe("http://192.168.1.20:12346/connect/v1/payments");
    expect((calls[0].init?.headers as Headers).get("Authorization")).toBe("Bearer token");
    expect((calls[0].init?.headers as Headers).get("X-Clover-Device-Id")).toBe("mini-3");
    expect((calls[0].init?.headers as Headers).get("X-POS-ID")).toBe("owner-pos");
    expect(JSON.parse(String(calls[0].init?.body))).toEqual({ amount: 3000, externalPaymentId: "idem-1" });
    expect(result).toMatchObject({
      status: "approved",
      providerPaymentId: "clover-payment-1",
      providerOrderId: "clover-order-1",
      baseAmountCents: 3000,
      tipCents: 0,
      totalChargedCents: 3000,
      authCode: "A1B2",
      cardBrand: "MASTERCARD",
      cardLast4: "4444",
    });
    expect(result.rawProviderReference).not.toHaveProperty("payment.cardTransaction.cardNumber");
    expect(JSON.stringify(result.rawProviderReference)).not.toContain("4111111111111111");
    expect(JSON.stringify(result.rawProviderReference)).not.toContain("emvData");
  });

  it("maps Cloud REST Pay Display sales to configured cloud endpoint and required context", async () => {
    const calls: Array<{ url: string; init?: RequestInit }> = [];
    const http = jsonFetch(calls, {
      payment: {
        result: "SUCCESS",
        id: "cloud-payment-1",
        amount: 4500,
        externalPaymentId: "idem-cloud",
        order: { id: "cloud-order-1" },
        cardTransaction: {
          authCode: "CLOUDOK",
          cardType: "VISA",
          last4: "1111",
          pan: "4111111111111111",
          rawEmv: "raw",
        },
      },
    });
    const adapter = new CloverCloudPayDisplayAdapter(
      {
        transport: "rest-cloud",
        cloudBaseUrl: "https://sandbox.clover.example/card-present",
        merchantId: "MERCHANT123",
        appId: "APP123",
        appSecret: "secret",
        accessToken: "token",
        deviceId: "mini-cloud",
        posId: "owner-pos",
        remoteApplicationId: "DEV.APP123",
      },
      { fetch: http }
    );

    const result = await adapter.startCardSale({ amountCents: 4500, idempotencyKey: "idem-cloud", tipFlow: "none" });

    expect(calls[0].url).toBe("https://sandbox.clover.example/card-present/v1/payments");
    expect((calls[0].init?.headers as Headers).get("Authorization")).toBe("Bearer token");
    expect((calls[0].init?.headers as Headers).get("User-Agent")).toBe("NailSalonPOS/1.0 (local-api)");
    expect((calls[0].init?.headers as Headers).get("X-Clover-Merchant-Id")).toBe("MERCHANT123");
    expect((calls[0].init?.headers as Headers).get("X-Clover-App-Id")).toBe("APP123");
    expect((calls[0].init?.headers as Headers).get("X-Clover-Device-Id")).toBe("mini-cloud");
    expect((calls[0].init?.headers as Headers).get("X-POS-ID")).toBe("owner-pos");
    expect((calls[0].init?.headers as Headers).get("X-Clover-Remote-App-Id")).toBe("DEV.APP123");
    expect((calls[0].init?.headers as Headers).has("X-Clover-App-Secret")).toBe(false);
    expect(JSON.parse(String(calls[0].init?.body))).toEqual({ amount: 4500, externalPaymentId: "idem-cloud" });
    expect(result).toMatchObject({
      status: "approved",
      providerPaymentId: "cloud-payment-1",
      providerOrderId: "cloud-order-1",
      externalPaymentId: "idem-cloud",
      baseAmountCents: 4500,
      tipCents: 0,
      totalChargedCents: 4500,
      authCode: "CLOUDOK",
      cardBrand: "VISA",
      cardLast4: "1111",
    });
    expect(JSON.stringify(result.rawProviderReference)).not.toContain("4111111111111111");
    expect(JSON.stringify(result.rawProviderReference)).not.toContain("rawEmv");
  });

  it("uses Clover read-tip before payment when requested", async () => {
    const calls: Array<{ url: string; init?: RequestInit }> = [];
    const http = routeFetch(calls, {
      "/connect/v1/device/read-tip": { tipAmount: 700 },
      "/connect/v1/payments": { payment: { result: "SUCCESS", id: "clover-payment-2", amount: 3700 } },
    });
    const adapter = new RestPayDisplayAdapter(
      {
        transport: "rest-local",
        deviceBaseUrl: "http://192.168.1.20:12346/connect",
        deviceId: "mini-3",
        posId: "owner-pos",
        accessToken: "token",
      },
      { fetch: http }
    );

    await expect(adapter.startCardSale({ amountCents: 3000, idempotencyKey: "idem-2", tipFlow: "pre_payment_device" })).resolves.toMatchObject({
      providerPaymentId: "clover-payment-2",
      baseAmountCents: 3000,
      tipCents: 700,
      totalChargedCents: 3700,
    });
    expect(calls.map((call) => new URL(call.url).pathname)).toEqual(["/connect/v1/device/read-tip", "/connect/v1/payments"]);
    expect(JSON.parse(String(calls[0].init?.body))).toEqual({ baseAmount: 3000 });
    expect(JSON.parse(String(calls[1].init?.body))).toEqual({ amount: 3700, externalPaymentId: "idem-2" });
  });

  it("uses remote-pay-cloud LAN pairing and sale APIs", async () => {
    const sdk = createFakeRemotePayCloudSdk();
    const adapter = new CloverRemotePayLanAdapter(
      {
        transport: "ws-lan",
        wsUrl: "wss://192.168.1.20:12345/remote_pay",
        wsTimeoutMs: 1000,
        remoteApplicationId: "com.nail.pos:1.0.0",
        posName: "Nail Salon POS",
        serialNumber: "owner-pos-1",
      },
      { remotePayCloud: sdk as never }
    );

    await expect(adapter.verifyConnection()).resolves.toMatchObject({ connected: true, transport: "ws-lan" });
    const result = await adapter.startCardSale({ amountCents: 3000, idempotencyKey: "ws-1" });

    expect((sdk as FakeRemotePayCloudSdk).builders[0]).toMatchObject({
      applicationId: "com.nail.pos:1.0.0",
      endpoint: "wss://192.168.1.20:12345/remote_pay",
      posName: "Nail Salon POS",
      serialNumber: "owner-pos-1",
    });
    expect((sdk as FakeRemotePayCloudSdk).sales[0]).toMatchObject({ externalId: "ws-1", amount: 3000 });
    expect(result).toMatchObject({
      status: "approved",
      providerPaymentId: "ws-payment-1",
      baseAmountCents: 3000,
      tipCents: 500,
      totalChargedCents: 3500,
      authCode: "WSOK",
      cardBrand: "VISA",
      cardLast4: "4242",
    });
    expect(JSON.stringify(result.rawProviderReference)).not.toContain("4111111111111111");
    expect(JSON.stringify(result.rawProviderReference)).not.toContain("emvData");
  });

  it("uses remote-pay-cloud cloud configuration and sale APIs", async () => {
    const sdk = createFakeRemotePayCloudSdk();
    const adapter = new CloverRemotePayLanAdapter(
      {
        transport: "ws-cloud",
        wsTimeoutMs: 1000,
        remoteApplicationId: "RQ07XH5Z3EX44.BT1G67W0JJFVC",
        deviceId: "C035UT24950367",
        merchantId: "HDSPNPKW4VXZ1",
        accessToken: "access-token",
        cloudServer: "https://api.clover.com",
        friendlyId: "TL Nails And Spa 625",
      },
      { remotePayCloud: sdk as never }
    );

    await expect(adapter.verifyConnection()).resolves.toMatchObject({ connected: true, transport: "ws-cloud", deviceId: "C035UT24950367" });
    await expect(adapter.startCardSale({ amountCents: 4200, idempotencyKey: "cloud-ws-1" })).resolves.toMatchObject({
      status: "approved",
      providerPaymentId: "ws-payment-1",
      baseAmountCents: 4200,
      totalChargedCents: 4700,
    });

    expect((sdk as FakeRemotePayCloudSdk).cloudBuilders[0]).toMatchObject({
      applicationId: "RQ07XH5Z3EX44.BT1G67W0JJFVC",
      deviceId: "C035UT24950367",
      merchantId: "HDSPNPKW4VXZ1",
      accessToken: "access-token",
      cloverServer: "https://api.clover.com",
      friendlyId: "TL Nails And Spa 625",
    });
    expect((sdk as FakeRemotePayCloudSdk).sales[0]).toMatchObject({ externalId: "cloud-ws-1", amount: 4200 });
  });

  it("normalizes USB sidecar status and sale responses", async () => {
    const calls: Array<{ url: string; init?: RequestInit }> = [];
    const http = routeFetch(calls, {
      "/status": { connected: true, deviceId: "mini-usb" },
      "/payments": { status: "approved", providerPaymentId: "usb-payment-1", totalChargedCents: 2300, tipCents: 300 },
    });
    const adapter = new UsbSidecarAdapter({ transport: "usb-sidecar", usbSidecarUrl: "http://127.0.0.1:4567" }, { fetch: http });

    await expect(adapter.verifyConnection()).resolves.toMatchObject({
      connected: true,
      transport: "usb-sidecar",
      deviceId: "mini-usb",
    });
    await expect(adapter.startCardSale({ amountCents: 2000, idempotencyKey: "usb" })).resolves.toMatchObject({
      status: "approved",
      providerPaymentId: "usb-payment-1",
      baseAmountCents: 2000,
      tipCents: 300,
      totalChargedCents: 2300,
    });
  });
});

function jsonFetch(calls: Array<{ url: string; init?: RequestInit }>, body: unknown): CloverHttpClient {
  return async (url, init) => {
    calls.push({ url, init });
    return new Response(JSON.stringify(body), { status: 200, headers: { "Content-Type": "application/json" } });
  };
}

function routeFetch(calls: Array<{ url: string; init?: RequestInit }>, routes: Record<string, unknown>): CloverHttpClient {
  return async (url, init) => {
    calls.push({ url, init });
    const path = new URL(url).pathname;
    return new Response(JSON.stringify(routes[path] ?? {}), { status: 200, headers: { "Content-Type": "application/json" } });
  };
}

type FakeRemotePayCloudSdk = ReturnType<typeof createFakeRemotePayCloudSdk>;

function createFakeRemotePayCloudSdk() {
  const builders: unknown[] = [];
  const cloudBuilders: unknown[] = [];
  const sales: unknown[] = [];
  let listener: Record<string, (value?: unknown) => void> = {};

  class FakeSaleRequest {
    externalId = "";
    amount = 0;
    setExternalId(value: string): void { this.externalId = value; }
    setAmount(value: number): void { this.amount = value; }
    setAutoAcceptSignature(): void { /* no-op */ }
    setApproveOfflinePaymentWithoutPrompt(): void { /* no-op */ }
    setDisableDuplicateChecking(): void { /* no-op */ }
    setCardEntryMethods(): void { /* no-op */ }
  }

  class FakeBuilder {
    constructor(
      readonly applicationId: string,
      readonly endpoint: string,
      readonly posName: string,
      readonly serialNumber: string,
      readonly authToken: string | null,
      readonly onPairingCode: (code: string) => void,
      readonly onPairingSuccess: (token: string) => void
    ) {
      builders.push(this);
    }
    setHeartbeatInterval(): this { return this; }
    setWebSocketFactoryFunction(): this { return this; }
    build(): unknown { return this; }
  }

  class FakeCloudBuilder {
    cloverServer = "";
    friendlyId = "";
    constructor(
      readonly applicationId: string,
      readonly deviceId: string,
      readonly merchantId: string,
      readonly accessToken: string
    ) {
      cloudBuilders.push(this);
    }
    setCloverServer(value: string): this { this.cloverServer = value; return this; }
    setFriendlyId(value: string): this { this.friendlyId = value; return this; }
    build(): unknown { return this; }
  }

  const connector = {
    addCloverConnectorListener(value: unknown) { listener = value as Record<string, (value?: unknown) => void>; },
    initializeConnection() { listener.onDeviceReady?.({}); },
    sale(request: unknown) {
      sales.push(request);
      setTimeout(() => listener.onSaleResponse?.({
        getSuccess: () => true,
        getPayment: () => ({
          getId: () => "ws-payment-1",
          getAmount: () => (request as FakeSaleRequest).amount,
          getTipAmount: () => 500,
          getResult: () => "SUCCESS",
          getCardTransaction: () => ({
            getAuthCode: () => "WSOK",
            getCardType: () => "VISA",
            getLast4: () => "4242",
            cardNumber: "4111111111111111",
            extra: { emvData: "raw" },
          }),
        }),
      }), 0);
    },
    resetDevice() { /* no-op */ },
  };

  return {
    builders,
    cloudBuilders,
    sales,
    remotepay: {
      SaleRequest: FakeSaleRequest,
      ICloverConnectorListener: { prototype: {} },
      QueryStatus: { FOUND: "FOUND" },
    },
    CardEntryMethods: { ALL: 7 },
    WebSocketPairedCloverDeviceConfigurationBuilder: FakeBuilder,
    WebSocketCloudCloverDeviceConfigurationBuilder: FakeCloudBuilder,
    CloverConnectorFactoryBuilder: {
      FACTORY_VERSION: "factoryVersion",
      VERSION_12: 12,
      createICloverConnectorFactory: () => ({ createICloverConnector: () => connector }),
    },
  };
}
