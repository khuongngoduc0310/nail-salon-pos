import { createHash } from "node:crypto";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import { config as loadEnv } from "dotenv";

const require = createRequire(import.meta.url);
loadEnv({ path: fileURLToPath(new URL("../../../.env", import.meta.url)) });

export type CloverTransport = "mock" | "rest-local" | "usb-sidecar" | "ws-lan";

export type CloverPaymentStatus = "approved" | "declined" | "cancelled" | "failed";

export type CloverTipFlow = "none" | "pre_payment_device";

export type CloverConnectionStatus = {
  connected: boolean;
  provider: "clover";
  transport: CloverTransport;
  deviceId?: string;
  message?: string;
  pairingRequired?: boolean;
  pairingCode?: string;
};

export type CloverCardSaleRequest = {
  amountCents: number;
  idempotencyKey: string;
  saleId?: string;
  /**
   * Clover REST Pay Display uses externalPaymentId for idempotency.
   * Defaults to idempotencyKey when not supplied.
   */
  externalPaymentId?: string;
  /**
   * Use pre_payment_device when the POS asks Clover to read a tip before charging.
   * Auth/capture and paper tip-adjust flows are intentionally not modeled yet.
   */
  tipFlow?: CloverTipFlow;
  /** @deprecated Use tipFlow instead. true maps to pre_payment_device, false maps to none. */
  enableTipOnDevice?: boolean;
};

export type CloverCardSaleResult = {
  status: CloverPaymentStatus;
  providerPaymentId?: string;
  providerOrderId?: string;
  externalPaymentId?: string;
  authCode?: string;
  cardBrand?: string;
  cardLast4?: string;
  baseAmountCents: number;
  tipCents: number;
  totalChargedCents: number;
  message?: string;
  rawProviderReference?: Record<string, unknown>;
};

export type CloverRefundRequest = {
  providerPaymentId: string;
  amountCents: number;
  reason?: string;
};

export type CloverRefundResult = {
  status: "approved" | "declined" | "failed";
  providerRefundId?: string;
  message?: string;
  rawProviderReference?: Record<string, unknown>;
};

export type CloverReconciliationRequest = {
  start: Date;
  end: Date;
  externalPaymentId?: string;
};

export type CloverReconciliationResult = {
  provider: "clover";
  transport: CloverTransport;
  cardTotalCents: number;
  payments: CloverCardSaleResult[];
};

export interface CloverPaymentAdapter {
  verifyConnection(): Promise<CloverConnectionStatus>;
  startCardSale(input: CloverCardSaleRequest): Promise<CloverCardSaleResult>;
  cancelCurrentPayment(): Promise<void>;
  refund(input: CloverRefundRequest): Promise<CloverRefundResult>;
  reconcile(input: CloverReconciliationRequest): Promise<CloverReconciliationResult>;
}

export type CloverPaymentConfig = {
  transport: CloverTransport;
  deviceBaseUrl?: string;
  deviceId?: string;
  posId?: string;
  accessToken?: string;
  usbSidecarUrl?: string;
  wsUrl?: string;
  wsHost?: string;
  wsPort?: number;
  wsPath?: string;
  wsSecure?: boolean;
  wsTimeoutMs?: number;
  remoteApplicationId?: string;
  posName?: string;
  serialNumber?: string;
  authToken?: string;
};

export type CloverPaymentEnv = Record<string, string | undefined>;

export type CloverHttpClient = (url: string, init?: RequestInit) => Promise<Response>;

export type CloverHttpAdapterOptions = {
  fetch?: CloverHttpClient;
  remotePayCloud?: CloverRemotePayCloudSdk;
  websocketFactory?: unknown;
};

type CloverRemotePayCloudSdk = Record<string, unknown> & {
  remotepay?: Record<string, unknown>;
  CloverConnectorFactoryBuilder?: Record<string, unknown>;
  WebSocketPairedCloverDeviceConfigurationBuilder?: new (...args: unknown[]) => CloverBuilder;
  CardEntryMethods?: Record<string, unknown>;
};

type CloverBuilder = {
  setWebSocketFactoryFunction?: (factory: unknown) => CloverBuilder;
  setHeartbeatInterval?: (value: number) => CloverBuilder;
  build: () => unknown;
};

type CloverConnector = {
  addCloverConnectorListener(listener: unknown): void;
  initializeConnection(): void;
  dispose?: () => void;
  sale(request: unknown): void;
  resetDevice?: () => void;
  refundPayment?: (request: unknown) => void;
  retrieveDeviceStatus?: (request: unknown) => void;
  retrievePayment?: (request: unknown) => void;
  acceptPayment?: (payment: unknown) => void;
  acceptSignature?: (request: unknown) => void;
};

type NormalizedProviderPayment = {
  status?: unknown;
  result?: unknown;
  reason?: unknown;
  message?: unknown;
  payment?: unknown;
  providerPaymentId?: unknown;
  paymentId?: unknown;
  id?: unknown;
  externalPaymentId?: unknown;
  providerOrderId?: unknown;
  orderId?: unknown;
  order?: unknown;
  authCode?: unknown;
  cardBrand?: unknown;
  cardType?: unknown;
  cardLast4?: unknown;
  last4?: unknown;
  cardTransaction?: unknown;
  baseAmountCents?: unknown;
  amountCents?: unknown;
  amount?: unknown;
  tipCents?: unknown;
  tipAmount?: unknown;
  totalChargedCents?: unknown;
  totalCents?: unknown;
};

export function loadCloverPaymentConfig(env: CloverPaymentEnv = readProcessEnv()): CloverPaymentConfig {
  return {
    transport: parseTransport(env.CLOVER_TRANSPORT),
    deviceBaseUrl: trimOptional(env.CLOVER_DEVICE_BASE_URL),
    deviceId: trimOptional(env.CLOVER_DEVICE_ID),
    posId: trimOptional(env.CLOVER_POS_ID),
    accessToken: trimOptional(env.CLOVER_ACCESS_TOKEN),
    usbSidecarUrl: trimOptional(env.CLOVER_USB_SIDECAR_URL),
    wsUrl: resolveWsUrl(env),
    wsHost: resolveWsHost(env),
    wsPort: parseOptionalPositiveInteger(env.CLOVER_WS_PORT) ?? parseOptionalPositiveInteger(env.CLOVER_LAN_PORT),
    wsPath: resolveWsPathConfig(env),
    wsSecure: parseOptionalBoolean(env.CLOVER_WS_SECURE),
    wsTimeoutMs: parseOptionalPositiveInteger(env.CLOVER_WS_TIMEOUT_MS) ?? parseOptionalPositiveInteger(env.CLOVER_PAYMENT_TIMEOUT_MS),
    remoteApplicationId: trimOptional(env.CLOVER_REMOTE_APP_ID) ?? trimOptional(env.CLOVER_APPLICATION_ID),
    posName: trimOptional(env.CLOVER_POS_NAME),
    serialNumber: trimOptional(env.CLOVER_SERIAL_NUMBER),
    authToken: trimOptional(env.CLOVER_AUTH_TOKEN),
  };
}

export function validateCloverPaymentConfig(config: CloverPaymentConfig): string[] {
  const errors: string[] = [];

  if (config.transport === "rest-local") {
    requireConfig(errors, config.deviceBaseUrl, "CLOVER_DEVICE_BASE_URL is required for rest-local transport");
    requireConfig(errors, config.deviceId, "CLOVER_DEVICE_ID is required for rest-local transport");
    requireConfig(errors, config.posId, "CLOVER_POS_ID is required for rest-local transport");
    requireConfig(errors, config.accessToken, "CLOVER_ACCESS_TOKEN is required for rest-local transport");
  }

  if (config.transport === "usb-sidecar") {
    requireConfig(errors, config.usbSidecarUrl, "CLOVER_USB_SIDECAR_URL is required for usb-sidecar transport");
  }

  if (config.transport === "ws-lan") {
    requireConfig(errors, config.wsUrl, "CLOVER_WS_URL/CLOVER_ENDPOINT or CLOVER_WS_HOST with optional CLOVER_WS_PORT is required for ws-lan transport");
    requireConfig(errors, config.remoteApplicationId, "CLOVER_REMOTE_APP_ID is required for ws-lan transport");
    requireConfig(errors, config.posName, "CLOVER_POS_NAME is required for ws-lan transport");
    requireConfig(errors, config.serialNumber, "CLOVER_SERIAL_NUMBER is required for ws-lan transport");
  }

  return errors;
}

export function createCloverPaymentAdapter(
  config: CloverPaymentConfig = loadCloverPaymentConfig(),
  options: CloverHttpAdapterOptions = {}
): CloverPaymentAdapter {
  const errors = validateCloverPaymentConfig(config);
  if (errors.length > 0) {
    throw new Error(errors.join("; "));
  }

  if (config.transport === "rest-local") {
    return new RestPayDisplayAdapter(config, options);
  }

  if (config.transport === "usb-sidecar") {
    return new UsbSidecarAdapter(config, options);
  }

  if (config.transport === "ws-lan") {
    return new CloverRemotePayLanAdapter(config, options);
  }

  return new MockCloverPaymentAdapter();
}

export class MockCloverPaymentAdapter implements CloverPaymentAdapter {
  private nextStatus: CloverPaymentStatus;
  private readonly approvedPayments: CloverCardSaleResult[] = [];
  private nextTipCents: number;

  constructor(nextStatus: CloverPaymentStatus = "approved", nextTipCents = 0) {
    this.nextStatus = nextStatus;
    this.nextTipCents = nextTipCents;
  }

  setNextStatus(status: CloverPaymentStatus): void {
    this.nextStatus = status;
  }

  setNextTipCents(tipCents: number): void {
    this.nextTipCents = requireNonNegativeInteger(tipCents, "tipCents");
  }

  async verifyConnection(): Promise<CloverConnectionStatus> {
    return {
      connected: true,
      provider: "clover",
      transport: "mock",
      deviceId: "mock-clover",
      message: "Mock Clover payment adapter ready",
    };
  }

  async startCardSale(input: CloverCardSaleRequest): Promise<CloverCardSaleResult> {
    const baseAmountCents = requirePositiveInteger(input.amountCents, "amountCents");
    const tipCents = resolveTipFlow(input) === "pre_payment_device" ? this.nextTipCents : 0;
    const status = this.nextStatus;
    const baseResult = {
      status,
      baseAmountCents,
      tipCents: status === "approved" ? tipCents : 0,
      totalChargedCents: status === "approved" ? baseAmountCents + tipCents : 0,
    };

    if (status !== "approved") {
      return {
        ...baseResult,
        message: `Mock Clover ${status}`,
      };
    }

    const externalPaymentId = input.externalPaymentId ?? input.idempotencyKey;
    const result: CloverCardSaleResult = {
      ...baseResult,
      providerPaymentId: `clover_mock_${externalPaymentId}`,
      providerOrderId: input.saleId ? `order_${input.saleId}` : undefined,
      externalPaymentId,
      authCode: "MOCKOK",
      cardBrand: "Visa",
      cardLast4: "1111",
      rawProviderReference: {
        transport: "mock",
        externalPaymentId,
        saleId: input.saleId,
        providerOrderId: input.saleId ? `order_${input.saleId}` : undefined,
      },
    };
    this.approvedPayments.push(result);
    return result;
  }

  async cancelCurrentPayment(): Promise<void> {
    this.nextStatus = "cancelled";
  }

  async refund(input: CloverRefundRequest): Promise<CloverRefundResult> {
    requirePositiveInteger(input.amountCents, "amountCents");
    return {
      status: "approved",
      providerRefundId: `clover_mock_refund_${input.providerPaymentId}_${input.amountCents}`,
      rawProviderReference: {
        transport: "mock",
        reason: input.reason,
      },
    };
  }

  async reconcile(_input: CloverReconciliationRequest): Promise<CloverReconciliationResult> {
    return {
      provider: "clover",
      transport: "mock",
      cardTotalCents: this.approvedPayments.reduce((sum, payment) => sum + payment.totalChargedCents, 0),
      payments: [...this.approvedPayments],
    };
  }
}

export class CloverRemotePayLanAdapter implements CloverPaymentAdapter {
  private readonly sdk: CloverRemotePayCloudSdk;
  private readonly timeoutMs: number;
  private connector: CloverConnector | null = null;
  private connected = false;
  private pairingCode: string | undefined;
  private pairingRequired = false;
  private authToken: string | undefined;
  private pendingSale: PendingOperation<CloverCardSaleResult> | null = null;
  private pendingRefund: PendingOperation<CloverRefundResult> | null = null;
  private pendingRetrieve: PendingOperation<CloverCardSaleResult | null> | null = null;
  private readonly websocketFactory: unknown;

  constructor(private readonly config: CloverPaymentConfig, options: CloverHttpAdapterOptions = {}) {
    this.sdk = options.remotePayCloud ?? loadRemotePayCloudSdk();
    this.timeoutMs = config.wsTimeoutMs ?? 120000;
    this.authToken = config.authToken;
    this.websocketFactory = options.websocketFactory;
    this.ensureSdkReady();
  }

  async verifyConnection(): Promise<CloverConnectionStatus> {
    try {
      this.ensureConnector();
      return {
        connected: this.connected,
        provider: "clover",
        transport: "ws-lan",
        deviceId: this.config.serialNumber,
        pairingRequired: this.pairingRequired,
        pairingCode: this.pairingCode,
        message: this.connected
          ? "Clover Remote Pay LAN device ready"
          : this.pairingCode
            ? `Enter pairing code ${this.pairingCode} on the Clover device`
            : "Clover Remote Pay LAN connection initializing",
      };
    } catch (error) {
      return {
        connected: false,
        provider: "clover",
        transport: "ws-lan",
        deviceId: this.config.serialNumber,
        message: error instanceof Error ? error.message : "Clover Remote Pay LAN connection failed",
      };
    }
  }

  async startCardSale(input: CloverCardSaleRequest): Promise<CloverCardSaleResult> {
    const baseAmountCents = requirePositiveInteger(input.amountCents, "amountCents");
    requireNonEmptyString(input.idempotencyKey, "idempotencyKey");
    if (this.pendingSale) {
      throw new Error("A Clover sale is already in progress");
    }
    const connector = this.ensureConnector();
    const externalId = toCloverExternalPaymentId(input.externalPaymentId ?? input.idempotencyKey);
    const SaleRequest = requireRemotePayConstructor(this.sdk, "SaleRequest");
    const saleRequest = new SaleRequest();
    callSetter(saleRequest, "setExternalId", externalId);
    callSetter(saleRequest, "setAmount", baseAmountCents);
    callOptionalSetter(saleRequest, "setAutoAcceptSignature", true);
    callOptionalSetter(saleRequest, "setApproveOfflinePaymentWithoutPrompt", true);
    callOptionalSetter(saleRequest, "setDisableDuplicateChecking", true);
    const cardEntryMethods = asRecord(this.sdk.CardEntryMethods).ALL;
    if (cardEntryMethods !== undefined) {
      callOptionalSetter(saleRequest, "setCardEntryMethods", cardEntryMethods);
    }

    return new Promise<CloverCardSaleResult>((resolve, reject) => {
      this.pendingSale = createPending(resolve, reject, this.timeoutMs, "Clover sale timed out", () => {
        this.pendingSale = null;
      });
      try {
        connector.sale(saleRequest);
      } catch (error) {
        this.pendingSale?.reject(error instanceof Error ? error : new Error("Clover sale failed"));
      }
    });
  }

  async cancelCurrentPayment(): Promise<void> {
    const connector = this.ensureConnector();
    connector.resetDevice?.();
  }

  async refund(input: CloverRefundRequest): Promise<CloverRefundResult> {
    requireNonEmptyString(input.providerPaymentId, "providerPaymentId");
    requirePositiveInteger(input.amountCents, "amountCents");
    if (this.pendingRefund) {
      throw new Error("A Clover refund is already in progress");
    }
    const connector = this.ensureConnector();
    if (!connector.refundPayment) {
      throw new Error("Clover refundPayment API is unavailable");
    }
    const RefundPaymentRequest = requireRemotePayConstructor(this.sdk, "RefundPaymentRequest");
    const refundRequest = new RefundPaymentRequest();
    callSetter(refundRequest, "setPaymentId", input.providerPaymentId);
    callOptionalSetter(refundRequest, "setAmount", input.amountCents);
    callOptionalSetter(refundRequest, "setFullRefund", false);

    return new Promise<CloverRefundResult>((resolve, reject) => {
      this.pendingRefund = createPending(resolve, reject, this.timeoutMs, "Clover refund timed out", () => {
        this.pendingRefund = null;
      });
      try {
        connector.refundPayment?.(refundRequest);
      } catch (error) {
        this.pendingRefund?.reject(error instanceof Error ? error : new Error("Clover refund failed"));
      }
    });
  }

  async reconcile(input: CloverReconciliationRequest): Promise<CloverReconciliationResult> {
    const payment = await this.retrievePayment(input.externalPaymentId);
    return {
      provider: "clover",
      transport: "ws-lan",
      cardTotalCents: payment?.totalChargedCents ?? 0,
      payments: payment ? [payment] : [],
    };
  }

  async retrievePayment(externalPaymentId: string | undefined): Promise<CloverCardSaleResult | null> {
    if (!externalPaymentId) return null;
    if (this.pendingRetrieve) {
      throw new Error("A Clover payment retrieval is already in progress");
    }
    const connector = this.ensureConnector();
    const cloverExternalPaymentId = toCloverExternalPaymentId(externalPaymentId);
    const RetrieveDeviceStatusRequest = getRemotePayConstructor(this.sdk, "RetrieveDeviceStatusRequest");
    if (RetrieveDeviceStatusRequest && connector.retrieveDeviceStatus) {
      const deviceStatusRequest = new RetrieveDeviceStatusRequest();
      callOptionalSetter(deviceStatusRequest, "setSendLastMessage", true);
      connector.retrieveDeviceStatus(deviceStatusRequest);
    }
    const RetrievePaymentRequest = requireRemotePayConstructor(this.sdk, "RetrievePaymentRequest");
    const retrievePaymentRequest = new RetrievePaymentRequest();
    callSetter(retrievePaymentRequest, "setExternalPaymentId", cloverExternalPaymentId);

    return new Promise<CloverCardSaleResult | null>((resolve, reject) => {
      this.pendingRetrieve = createPending(resolve, reject, this.timeoutMs, "Clover payment retrieval timed out", () => {
        this.pendingRetrieve = null;
      });
      try {
        connector.retrievePayment?.(retrievePaymentRequest);
      } catch (error) {
        this.pendingRetrieve?.reject(error instanceof Error ? error : new Error("Clover payment retrieval failed"));
      }
    });
  }

  private ensureConnector(): CloverConnector {
    if (this.connector) return this.connector;

    let configurationRecord: Record<string, unknown> = {};
    const onPairingCode = (pairingCode: string) => {
      this.pairingRequired = true;
      this.pairingCode = pairingCode;
    };
    const onPairingSuccess = (authToken: string) => {
      this.pairingRequired = false;
      this.pairingCode = undefined;
      this.authToken = authToken;
      this.config.authToken = authToken;
      const setAuthToken = configurationRecord.setAuthToken;
      if (typeof setAuthToken === "function") {
        setAuthToken.call(configurationRecord, authToken);
      }
    };
    const Configuration = this.sdk.WebSocketPairedCloverDeviceConfiguration as new (...args: unknown[]) => unknown;
    const websocketFactory = this.createWebSocketFactory();
    const configuration = typeof Configuration === "function"
      ? new Configuration(
        requireConfigValue(this.config.wsUrl, "wsUrl"),
        requireConfigValue(this.config.remoteApplicationId, "remoteApplicationId"),
        requireConfigValue(this.config.posName, "posName"),
        requireConfigValue(this.config.serialNumber, "serialNumber"),
        this.authToken ?? null,
        onPairingCode,
        onPairingSuccess,
        websocketFactory,
        null,
        -1
      )
      : this.createPairedConfigurationWithBuilder(onPairingCode, onPairingSuccess, websocketFactory);
    configurationRecord = asRecord(configuration);

    const factoryBuilder = asRecord(this.sdk.CloverConnectorFactoryBuilder);
    const createFactory = factoryBuilder.createICloverConnectorFactory;
    if (typeof createFactory !== "function") {
      throw new Error("remote-pay-cloud CloverConnectorFactoryBuilder is unavailable");
    }
    const factoryVersionKey = readString(factoryBuilder.FACTORY_VERSION) ?? "factoryVersion";
    const factoryVersion = factoryBuilder.VERSION_12 ?? factoryBuilder.VERSION_1;
    const cloverConnectorFactory = asRecord(createFactory({ [factoryVersionKey]: factoryVersion }));
    const createConnector = cloverConnectorFactory.createICloverConnector;
    if (typeof createConnector !== "function") {
      throw new Error("remote-pay-cloud createICloverConnector is unavailable");
    }
    const connector = createConnector(configuration) as CloverConnector;
    connector.addCloverConnectorListener(this.createListener());
    connector.initializeConnection();
    this.connector = connector;
    return connector;
  }

  private createPairedConfigurationWithBuilder(
    onPairingCode: (pairingCode: string) => void,
    onPairingSuccess: (authToken: string) => void,
    websocketFactory: unknown
  ): unknown {
    const Builder = this.sdk.WebSocketPairedCloverDeviceConfigurationBuilder;
    if (!Builder) {
      throw new Error("remote-pay-cloud WebSocketPairedCloverDeviceConfigurationBuilder is unavailable");
    }
    const builder = new Builder(
      requireConfigValue(this.config.remoteApplicationId, "remoteApplicationId"),
      requireConfigValue(this.config.wsUrl, "wsUrl"),
      requireConfigValue(this.config.posName, "posName"),
      requireConfigValue(this.config.serialNumber, "serialNumber"),
      this.authToken ?? null,
      onPairingCode,
      onPairingSuccess
    );
    if (websocketFactory && builder.setWebSocketFactoryFunction) {
      builder.setWebSocketFactoryFunction(websocketFactory);
    }
    builder.setHeartbeatInterval?.(-1);
    return builder.build();
  }

  private createListener(): unknown {
    const listenerPrototype = asRecord(asRecord(this.sdk.remotepay).ICloverConnectorListener).prototype ?? {};
    return Object.assign({}, listenerPrototype, {
      onDeviceReady: () => {
        this.connected = true;
      },
      onDeviceDisconnected: () => {
        this.connected = false;
      },
      onDeviceError: (event: unknown) => {
        const message = getValue(event, "getMessage", "message") ?? "Clover device error";
        const error = new Error(String(message));
        this.pendingSale?.reject(error);
        this.pendingRefund?.reject(error);
        this.pendingRetrieve?.reject(error);
      },
      onSaleResponse: (response: unknown) => {
        const result = normalizeSdkSaleResponse(response);
        if (result.status === "approved") {
          this.pendingSale?.resolve(result);
        } else {
          this.pendingSale?.resolve(result);
        }
      },
      onRefundPaymentResponse: (response: unknown) => {
        this.pendingRefund?.resolve(normalizeSdkRefundResponse(response));
      },
      onRetrievePaymentResponse: (response: unknown) => {
        this.pendingRetrieve?.resolve(normalizeSdkRetrievePaymentResponse(response, this.sdk));
      },
      onConfirmPaymentRequest: (request: unknown) => {
        const payment = getValue(request, "getPayment", "payment");
        if (payment) this.connector?.acceptPayment?.(payment);
      },
      onVerifySignatureRequest: (request: unknown) => {
        this.connector?.acceptSignature?.(request);
      },
    });
  }

  private createWebSocketFactory(): unknown {
    if (this.config.transport !== "ws-lan") return undefined;
    if (this.websocketFactory) {
      return this.websocketFactory;
    }
    try {
      process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0";
      const NodeWebSocket = require("ws");
      const globals = globalThis as Record<string, unknown>;
      globals.WebSocket = function WebSocket(endpoint: string, accessToken?: string) {
        return new NodeWebSocket(endpoint, accessToken, { rejectUnauthorized: false });
      };
      try {
        globals.XMLHttpRequest = require("xmlhttprequest-ssl").XMLHttpRequest;
      } catch {
        // XMLHttpRequest is only needed by a few remote-pay-cloud code paths.
      }
      const BrowserWebSocketImpl = this.sdk.BrowserWebSocketImpl as new (endpoint: string) => unknown;
      if (typeof BrowserWebSocketImpl === "function") {
        return (endpoint: string) => new BrowserWebSocketImpl(endpoint);
      }
      return undefined;
    } catch {
      return undefined;
    }
  }

  private ensureSdkReady(): void {
    if (!this.sdk.remotepay || !this.sdk.CloverConnectorFactoryBuilder) {
      throw new Error("remote-pay-cloud SDK did not load correctly");
    }
  }
}

export class RestPayDisplayAdapter implements CloverPaymentAdapter {
  private readonly http: CloverHttpClient;
  private readonly baseUrl: string;

  constructor(private readonly config: CloverPaymentConfig, options: CloverHttpAdapterOptions = {}) {
    this.http = options.fetch ?? fetch;
    this.baseUrl = normalizeRestPayBaseUrl(requireConfigValue(config.deviceBaseUrl, "deviceBaseUrl"));
  }

  async verifyConnection(): Promise<CloverConnectionStatus> {
    try {
      await this.postJson("/v1/device/welcome", {});
      return {
        connected: true,
        provider: "clover",
        transport: "rest-local",
        deviceId: this.config.deviceId,
        message: "Clover REST Pay Display device responded",
      };
    } catch (error) {
      return {
        connected: false,
        provider: "clover",
        transport: "rest-local",
        deviceId: this.config.deviceId,
        message: error instanceof Error ? error.message : "Clover REST Pay Display connection failed",
      };
    }
  }

  async startCardSale(input: CloverCardSaleRequest): Promise<CloverCardSaleResult> {
    const baseAmountCents = requirePositiveInteger(input.amountCents, "amountCents");
    requireNonEmptyString(input.idempotencyKey, "idempotencyKey");
    const externalPaymentId = input.externalPaymentId ?? input.idempotencyKey;
    const tipFlow = resolveTipFlow(input);
    const tipCents = tipFlow === "pre_payment_device" ? await this.readTip(baseAmountCents) : 0;
    const totalAmountCents = baseAmountCents + tipCents;

    const body = await this.postJson(
      "/v1/payments",
      {
        amount: totalAmountCents,
        externalPaymentId,
        saleId: input.saleId,
      },
      { idempotencyKey: input.idempotencyKey }
    );

    return normalizePaymentResult(baseAmountCents, body, tipCents);
  }

  async cancelCurrentPayment(): Promise<void> {
    await this.postJson("/v1/device/cancel", {});
  }

  async refund(input: CloverRefundRequest): Promise<CloverRefundResult> {
    requireNonEmptyString(input.providerPaymentId, "providerPaymentId");
    requirePositiveInteger(input.amountCents, "amountCents");
    const body = await this.postJson(`/v1/payments/${encodeURIComponent(input.providerPaymentId)}/refund`, {
      amount: input.amountCents,
      reason: input.reason,
    });
    return normalizeRefundResult(body);
  }

  async reconcile(input: CloverReconciliationRequest): Promise<CloverReconciliationResult> {
    const body = await this.postJson("/v1/payments/search", {
      start: input.start.toISOString(),
      end: input.end.toISOString(),
      externalPaymentId: input.externalPaymentId,
    });
    return normalizeReconciliationResult("rest-local", body);
  }

  private async readTip(baseAmountCents: number): Promise<number> {
    const body = await this.postJson("/v1/device/read-tip", { baseAmount: baseAmountCents });
    return requireNonNegativeInteger(readInteger(asRecord(body).tipAmount, readInteger(asRecord(body).tipCents, 0)), "tipAmount");
  }

  private async postJson(path: string, body: unknown, options: { idempotencyKey?: string } = {}): Promise<unknown> {
    return this.requestJson(path, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    }, options);
  }

  private async requestJson(path: string, init: RequestInit, options: { idempotencyKey?: string } = {}): Promise<unknown> {
    const headers = new Headers(init.headers);
    headers.set("Accept", "application/json");
    headers.set("Authorization", `Bearer ${requireConfigValue(this.config.accessToken, "accessToken")}`);
    headers.set("X-Clover-Device-Id", requireConfigValue(this.config.deviceId, "deviceId"));
    headers.set("X-POS-ID", requireConfigValue(this.config.posId, "posId"));
    if (options.idempotencyKey) {
      headers.set("Idempotency-Key", options.idempotencyKey);
    }
    const response = await this.http(`${this.baseUrl}${path}`, { ...init, headers });
    if (!response.ok) {
      throw new Error(`Clover REST Pay Display request failed: ${response.status} ${response.statusText}`);
    }
    return response.json();
  }
}

export class UsbSidecarAdapter implements CloverPaymentAdapter {
  private readonly http: CloverHttpClient;
  private readonly baseUrl: string;

  constructor(config: CloverPaymentConfig, options: CloverHttpAdapterOptions = {}) {
    this.http = options.fetch ?? fetch;
    this.baseUrl = normalizeBaseUrl(requireConfigValue(config.usbSidecarUrl, "usbSidecarUrl"));
  }

  async verifyConnection(): Promise<CloverConnectionStatus> {
    const body = await this.getJson("/status");
    const object = asRecord(body);
    return {
      connected: readBoolean(object.connected, true),
      provider: "clover",
      transport: "usb-sidecar",
      deviceId: readString(object.deviceId),
      message: readString(object.message),
    };
  }

  async startCardSale(input: CloverCardSaleRequest): Promise<CloverCardSaleResult> {
    const baseAmountCents = requirePositiveInteger(input.amountCents, "amountCents");
    requireNonEmptyString(input.idempotencyKey, "idempotencyKey");
    const body = await this.postJson("/payments", {
      amount: baseAmountCents,
      externalPaymentId: input.externalPaymentId ?? input.idempotencyKey,
      tipFlow: resolveTipFlow(input),
    });
    return normalizePaymentResult(baseAmountCents, body);
  }

  async cancelCurrentPayment(): Promise<void> {
    await this.postJson("/payments/current/cancel", {});
  }

  async refund(input: CloverRefundRequest): Promise<CloverRefundResult> {
    requireNonEmptyString(input.providerPaymentId, "providerPaymentId");
    requirePositiveInteger(input.amountCents, "amountCents");
    const body = await this.postJson("/refunds", { ...input, amount: input.amountCents });
    return normalizeRefundResult(body);
  }

  async reconcile(input: CloverReconciliationRequest): Promise<CloverReconciliationResult> {
    const body = await this.postJson("/reconcile", {
      start: input.start.toISOString(),
      end: input.end.toISOString(),
    });
    return normalizeReconciliationResult("usb-sidecar", body);
  }

  private async getJson(path: string): Promise<unknown> {
    return this.requestJson(path, { method: "GET" });
  }

  private async postJson(path: string, body: unknown): Promise<unknown> {
    return this.requestJson(path, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
  }

  private async requestJson(path: string, init: RequestInit): Promise<unknown> {
    const response = await this.http(`${this.baseUrl}${path}`, init);
    if (!response.ok) {
      throw new Error(`Clover USB sidecar request failed: ${response.status} ${response.statusText}`);
    }
    return response.json();
  }
}

function parseTransport(value: string | undefined): CloverTransport {
  const normalized = trimOptional(value) ?? "mock";
  if (normalized === "mock" || normalized === "rest-local" || normalized === "usb-sidecar" || normalized === "ws-lan") {
    return normalized;
  }
  throw new Error(`Unsupported CLOVER_TRANSPORT: ${normalized}`);
}

export function resolveWsUrl(env: CloverPaymentEnv = readProcessEnv()): string | undefined {
  const explicitUrl = trimOptional(env.CLOVER_WS_URL) ?? trimOptional(env.CLOVER_ENDPOINT);
  if (explicitUrl) return explicitUrl;

  const host = resolveWsHost(env);
  if (!host) return undefined;

  const secure = parseOptionalBoolean(env.CLOVER_WS_SECURE) ?? true;
  const protocol = secure ? "wss" : "ws";
  const port = parseOptionalPositiveInteger(env.CLOVER_WS_PORT) ?? parseOptionalPositiveInteger(env.CLOVER_LAN_PORT);
  const path = normalizeWsPath(trimOptional(env.CLOVER_WS_PATH));
  const portSegment = port ? `:${port}` : "";
  return `${protocol}://${host}${portSegment}${path}`;
}

function resolveWsHost(env: CloverPaymentEnv): string | undefined {
  return trimOptional(env.CLOVER_WS_HOST) ?? trimOptional(env.CLOVER_WS_SERVER) ?? trimOptional(env.CLOVER_LAN_HOST);
}

function normalizeWsPath(value: string | undefined): string {
  if (!value) return "/remote_pay";
  return value.startsWith("/") ? value : `/${value}`;
}

function resolveWsPathConfig(env: CloverPaymentEnv): string | undefined {
  if (!resolveWsHost(env) && !trimOptional(env.CLOVER_WS_PATH)) return undefined;
  return normalizeWsPath(trimOptional(env.CLOVER_WS_PATH));
}

function parseOptionalBoolean(value: string | undefined): boolean | undefined {
  const trimmed = trimOptional(value)?.toLowerCase();
  if (!trimmed) return undefined;
  if (trimmed === "true" || trimmed === "1" || trimmed === "yes") return true;
  if (trimmed === "false" || trimmed === "0" || trimmed === "no") return false;
  throw new Error(`Expected boolean but received ${trimmed}`);
}

function trimOptional(value: string | undefined): string | undefined {
  const trimmed = value?.trim();
  return trimmed ? trimmed : undefined;
}

function parseOptionalPositiveInteger(value: string | undefined): number | undefined {
  const trimmed = trimOptional(value);
  if (!trimmed) return undefined;
  const parsed = Number(trimmed);
  if (!Number.isInteger(parsed) || parsed <= 0) {
    throw new Error(`Expected positive integer but received ${trimmed}`);
  }
  return parsed;
}

type PendingOperation<T> = {
  resolve(value: T): void;
  reject(error: Error): void;
};

function createPending<T>(
  resolve: (value: T) => void,
  reject: (error: Error) => void,
  timeoutMs: number,
  timeoutMessage: string,
  cleanup: () => void
): PendingOperation<T> {
  const timer = setTimeout(() => {
    cleanup();
    reject(new Error(timeoutMessage));
  }, timeoutMs);
  return {
    resolve: (value) => {
      clearTimeout(timer);
      cleanup();
      resolve(value);
    },
    reject: (error) => {
      clearTimeout(timer);
      cleanup();
      reject(error);
    },
  };
}

function loadRemotePayCloudSdk(): CloverRemotePayCloudSdk {
  return require("remote-pay-cloud") as CloverRemotePayCloudSdk;
}

function requireRemotePayConstructor(sdk: CloverRemotePayCloudSdk, name: string): new () => unknown {
  const ctor = getRemotePayConstructor(sdk, name);
  if (!ctor) {
    throw new Error(`remote-pay-cloud ${name} is unavailable`);
  }
  return ctor;
}

function getRemotePayConstructor(sdk: CloverRemotePayCloudSdk, name: string): (new () => unknown) | undefined {
  const ctor = asRecord(sdk.remotepay)[name];
  return typeof ctor === "function" ? ctor as new () => unknown : undefined;
}

function callSetter(target: unknown, method: string, value: unknown): void {
  const setter = asRecord(target)[method];
  if (typeof setter !== "function") {
    throw new Error(`remote-pay-cloud request is missing ${method}`);
  }
  setter.call(target, value);
}

function callOptionalSetter(target: unknown, method: string, value: unknown): void {
  const setter = asRecord(target)[method];
  if (typeof setter === "function") {
    setter.call(target, value);
  }
}

function getValue(target: unknown, getter: string, property: string): unknown {
  const record = asRecord(target);
  const getterFunction = record[getter];
  if (typeof getterFunction === "function") {
    return getterFunction.call(target);
  }
  return record[property];
}

function requireConfig(errors: string[], value: string | undefined, message: string): void {
  if (!value) {
    errors.push(message);
  }
}

function requireConfigValue(value: string | undefined, name: string): string {
  if (!value) {
    throw new Error(`${name} is required`);
  }
  return value;
}

function normalizeBaseUrl(value: string): string {
  return value.endsWith("/") ? value.slice(0, -1) : value;
}

function normalizeRestPayBaseUrl(value: string): string {
  const baseUrl = normalizeBaseUrl(value);
  return baseUrl.endsWith("/connect") ? baseUrl : `${baseUrl}/connect`;
}

function resolveTipFlow(input: CloverCardSaleRequest): CloverTipFlow {
  if (input.tipFlow) {
    return input.tipFlow;
  }
  if (input.enableTipOnDevice === true) {
    return "pre_payment_device";
  }
  return "none";
}

function normalizePaymentResult(baseAmountCents: number, body: unknown, expectedTipCents?: number): CloverCardSaleResult {
  const envelope = asRecord(body);
  const object = asRecord(envelope.payment ?? body) as NormalizedProviderPayment;
  const cardTransaction = asRecord(object.cardTransaction);
  const order = asRecord(object.order);
  const status = readPaymentStatus(object.status ?? object.result ?? cardTransaction.state ?? object.reason);
  const tipCents = readInteger(object.tipCents, readInteger(object.tipAmount, expectedTipCents ?? 0));
  const totalChargedCents = readInteger(
    object.totalChargedCents,
    readInteger(object.totalCents, readInteger(object.amount, readInteger(object.amountCents, baseAmountCents + tipCents)))
  );

  return {
    status,
    providerPaymentId: readString(object.providerPaymentId) ?? readString(object.paymentId) ?? readString(object.id),
    providerOrderId: readString(object.providerOrderId) ?? readString(object.orderId) ?? readString(order.id),
    externalPaymentId: readString(object.externalPaymentId),
    authCode: readString(object.authCode) ?? readString(cardTransaction.authCode),
    cardBrand: readString(object.cardBrand) ?? readString(object.cardType) ?? readString(cardTransaction.cardType),
    cardLast4: readString(object.cardLast4) ?? readString(object.last4) ?? readString(cardTransaction.last4),
    baseAmountCents,
    tipCents: status === "approved" ? tipCents : 0,
    totalChargedCents: status === "approved" ? totalChargedCents : 0,
    message: readString(object.message) ?? readString(envelope.message),
    rawProviderReference: stripSensitiveFields(envelope),
  };
}

function normalizeSdkSaleResponse(response: unknown): CloverCardSaleResult {
  const success = getValue(response, "getSuccess", "success") === true;
  const payment = getValue(response, "getPayment", "payment");
  const message = readString(getValue(response, "getMessage", "message"));
  if (!success || !payment) {
    return {
      status: readPaymentStatus(getValue(response, "getResult", "result")),
      baseAmountCents: 0,
      tipCents: 0,
      totalChargedCents: 0,
      message,
      rawProviderReference: stripSensitiveFields(response),
    };
  }
  return normalizeSdkPayment(payment, message);
}

function normalizeSdkRetrievePaymentResponse(response: unknown, sdk: CloverRemotePayCloudSdk): CloverCardSaleResult | null {
  const queryStatus = getValue(response, "getQueryStatus", "queryStatus");
  const queryStatusText = String(queryStatus ?? "");
  const queryStatusEnum = asRecord(asRecord(sdk.remotepay).QueryStatus);
  if (queryStatus !== queryStatusEnum.FOUND && queryStatusText !== "FOUND") {
    return null;
  }
  const payment = getValue(response, "getPayment", "payment");
  return payment ? normalizeSdkPayment(payment, readString(getValue(response, "getMessage", "message"))) : null;
}

function normalizeSdkPayment(payment: unknown, message?: string): CloverCardSaleResult {
  const amountCents = readInteger(getValue(payment, "getAmount", "amount"), 0);
  const tipCents = readInteger(getValue(payment, "getTipAmount", "tipAmount"), 0);
  const cardTransaction = getValue(payment, "getCardTransaction", "cardTransaction");
  const order = getValue(payment, "getOrder", "order");
  const result = getValue(payment, "getResult", "result");
  const status = readPaymentStatus(result);
  return {
    status,
    providerPaymentId: readString(getValue(payment, "getId", "id")),
    providerOrderId: readString(getValue(order, "getId", "id")),
    externalPaymentId: readString(getValue(payment, "getExternalPaymentId", "externalPaymentId")),
    authCode: readString(getValue(cardTransaction, "getAuthCode", "authCode")),
    cardBrand: readString(getValue(cardTransaction, "getCardType", "cardType")),
    cardLast4: readString(getValue(cardTransaction, "getLast4", "last4")),
    baseAmountCents: amountCents,
    tipCents: status === "approved" ? tipCents : 0,
    totalChargedCents: status === "approved" ? amountCents + tipCents : 0,
    message,
    rawProviderReference: stripSensitiveFields({
      payment: {
        id: readString(getValue(payment, "getId", "id")),
        externalPaymentId: readString(getValue(payment, "getExternalPaymentId", "externalPaymentId")),
        result,
        amount: amountCents,
        tipAmount: tipCents,
        cardTransaction: {
          authCode: readString(getValue(cardTransaction, "getAuthCode", "authCode")),
          cardType: readString(getValue(cardTransaction, "getCardType", "cardType")),
          last4: readString(getValue(cardTransaction, "getLast4", "last4")),
        },
      },
    }),
  };
}

function normalizeSdkRefundResponse(response: unknown): CloverRefundResult {
  const success = getValue(response, "getSuccess", "success") === true;
  const refund = getValue(response, "getRefund", "refund") ?? response;
  return {
    status: success ? "approved" : "failed",
    providerRefundId: readString(getValue(refund, "getId", "id")),
    message: readString(getValue(response, "getMessage", "message")),
    rawProviderReference: stripSensitiveFields(response),
  };
}

function normalizeRefundResult(body: unknown): CloverRefundResult {
  const object = asRecord(body);
  const refund = asRecord(object.refund ?? body);
  return {
    status: readRefundStatus(refund.status ?? refund.result),
    providerRefundId: readString(refund.providerRefundId) ?? readString(refund.refundId) ?? readString(refund.id),
    message: readString(refund.message) ?? readString(object.message),
    rawProviderReference: stripSensitiveFields(object),
  };
}

function normalizeReconciliationResult(transport: CloverTransport, body: unknown): CloverReconciliationResult {
  const object = asRecord(body);
  const rawPayments = Array.isArray(object.payments) ? object.payments : [];
  const payments = rawPayments.map((payment) => normalizePaymentResult(0, payment));
  return {
    provider: "clover",
    transport,
    cardTotalCents: readInteger(
      object.cardTotalCents,
      payments.reduce((sum, payment) => sum + payment.totalChargedCents, 0)
    ),
    payments,
  };
}

function asRecord(value: unknown): Record<string, unknown> {
  if (value && (typeof value === "object" || typeof value === "function") && !Array.isArray(value)) {
    return value as Record<string, unknown>;
  }
  return {};
}

function readString(value: unknown): string | undefined {
  return typeof value === "string" && value.trim() ? value : undefined;
}

function readBoolean(value: unknown, fallback: boolean): boolean {
  return typeof value === "boolean" ? value : fallback;
}

function readInteger(value: unknown, fallback: number): number {
  return Number.isInteger(value) ? Number(value) : fallback;
}

function readPaymentStatus(value: unknown): CloverPaymentStatus {
  if (value === "approved" || value === "declined" || value === "cancelled" || value === "failed") {
    return value;
  }
  if (value === "SUCCESS" || value === "CLOSED") {
    return "approved";
  }
  if (value === "DECLINED" || value === "NOT_APPROVED") {
    return "declined";
  }
  if (value === "CANCELLED" || value === "CANCELED" || value === "USER_CUSTOMER_CANCEL") {
    return "cancelled";
  }
  return "failed";
}

function readRefundStatus(value: unknown): CloverRefundResult["status"] {
  if (value === "approved" || value === "declined" || value === "failed") {
    return value;
  }
  if (value === "SUCCESS" || value === "CLOSED") {
    return "approved";
  }
  if (value === "DECLINED" || value === "NOT_APPROVED") {
    return "declined";
  }
  return "failed";
}

function requirePositiveInteger(value: number, name: string): number {
  if (!Number.isInteger(value) || value <= 0) {
    throw new Error(`${name} must be a positive integer`);
  }
  return value;
}

function requireNonNegativeInteger(value: number, name: string): number {
  if (!Number.isInteger(value) || value < 0) {
    throw new Error(`${name} must be a non-negative integer`);
  }
  return value;
}

function requireNonEmptyString(value: string, name: string): string {
  if (!value.trim()) {
    throw new Error(`${name} is required`);
  }
  return value;
}

function toCloverExternalPaymentId(value: string): string {
  const trimmed = requireNonEmptyString(value, "externalPaymentId").trim();
  if (trimmed.length <= 32) return trimmed;
  return `pos-${createHash("sha256").update(trimmed).digest("hex").slice(0, 28)}`;
}

function stripSensitiveFields(value: unknown): Record<string, unknown> {
  const stripped = stripSensitiveValue(value);
  return asRecord(stripped);
}

function stripSensitiveValue(value: unknown): unknown {
  if (typeof value === "function") {
    return undefined;
  }
  if (Array.isArray(value)) {
    return value.map((item) => stripSensitiveValue(item));
  }
  if (!value || typeof value !== "object") {
    return value;
  }

  return Object.fromEntries(
    Object.entries(value as Record<string, unknown>)
      .filter(([key]) => !isSensitiveKey(key))
      .map(([key, nested]) => [key, stripSensitiveValue(nested)])
      .filter(([, nested]) => nested !== undefined)
  );
}

function isSensitiveKey(key: string): boolean {
  const normalized = key.toLowerCase().replace(/[^a-z0-9]/g, "");
  return new Set([
    "cardnumber",
    "cvv",
    "cvc",
    "pin",
    "magstripe",
    "track",
    "track1",
    "track2",
    "track3",
    "trackdata",
    "emv",
    "rawemv",
    "emvdata",
    "pan",
    "fullpan",
    "cardpan",
  ]).has(normalized);
}

function readProcessEnv(): CloverPaymentEnv {
  const maybeProcess = globalThis as typeof globalThis & {
    process?: { env?: CloverPaymentEnv };
  };
  return maybeProcess.process?.env ?? {};
}
