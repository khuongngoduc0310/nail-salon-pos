import {
  createCloverPaymentAdapter,
  loadCloverPaymentConfig,
  validateCloverPaymentConfig,
  type CloverPaymentAdapter,
  type CloverPaymentConfig,
  type CloverTransport,
} from "@nail/clover-payment";
import {
  MockTerminalAdapter,
  type PaymentTerminalAdapter,
  type ReconciliationRequest,
  type ReconciliationResult,
  type TerminalConnectionStatus,
  type TerminalPaymentResult,
  type TerminalRefundRequest,
  type TerminalRefundResult,
  type TerminalSaleRequest,
} from "@nail/payment-terminal";

export type SafeTerminalConfig = Omit<CloverPaymentConfig, "accessToken" | "authToken"> & {
  accessTokenConfigured?: boolean;
  authTokenConfigured?: boolean;
  accessTokenPreview?: string;
  authTokenPreview?: string;
};

export type TerminalConfigUpdate = Partial<CloverPaymentConfig>;

export function createConfiguredPaymentTerminalAdapter(): PaymentTerminalAdapter {
  return createConfiguredPaymentTerminalManager();
}

export function createConfiguredPaymentTerminalManager(initialAdapter?: PaymentTerminalAdapter): RuntimePaymentTerminalManager {
  if (initialAdapter) {
    return new RuntimePaymentTerminalManager(loadCloverPaymentConfig(), initialAdapter);
  }
  const config = normalizeTerminalConfig(loadCloverPaymentConfig());
  if (config.transport === "mock" && !process.env.CLOVER_TRANSPORT) {
    return new RuntimePaymentTerminalManager(config, new MockTerminalAdapter());
  }

  return new RuntimePaymentTerminalManager(config, createAdapterForConfig(config));
}

export class RuntimePaymentTerminalManager implements PaymentTerminalAdapter {
  constructor(private config: CloverPaymentConfig, private activeAdapter: PaymentTerminalAdapter) {}

  getSafeConfig(): SafeTerminalConfig {
    return toSafeTerminalConfig(this.config);
  }

  getConfig(): CloverPaymentConfig {
    return { ...this.config };
  }

  updateConfig(update: TerminalConfigUpdate): SafeTerminalConfig {
    const nextConfig = normalizeTerminalConfig({ ...this.config, ...update });
    const errors = validateTerminalConfig(nextConfig);
    if (errors.length > 0) {
      throw new Error(errors.join("; "));
    }
    this.activeAdapter = createAdapterForConfig(nextConfig);
    this.config = nextConfig;
    return this.getSafeConfig();
  }

  setMockApproved(): void {
    if (this.activeAdapter instanceof MockTerminalAdapter) {
      this.activeAdapter.setNextStatus("approved");
    }
  }

  setMockTip(tipCents: number): void {
    if (this.activeAdapter instanceof MockTerminalAdapter) {
      this.activeAdapter.setNextTipCents(tipCents);
    }
  }

  verifyConnection(): Promise<TerminalConnectionStatus> {
    return this.activeAdapter.verifyConnection();
  }

  startSale(input: TerminalSaleRequest): Promise<TerminalPaymentResult> {
    return this.activeAdapter.startSale(input);
  }

  cancelCurrentAction(): Promise<void> {
    return this.activeAdapter.cancelCurrentAction();
  }

  refund(input: TerminalRefundRequest): Promise<TerminalRefundResult> {
    return this.activeAdapter.refund(input);
  }

  reconcile(input: ReconciliationRequest): Promise<ReconciliationResult> {
    return this.activeAdapter.reconcile(input);
  }
}

export class CloverTerminalAdapter implements PaymentTerminalAdapter {
  constructor(private readonly clover: CloverPaymentAdapter) {}

  async verifyConnection(): Promise<TerminalConnectionStatus> {
    const status = await this.clover.verifyConnection();
    return {
      connected: status.connected,
      provider: "clover",
      message: status.message,
      pairingRequired: status.pairingRequired,
      pairingCode: status.pairingCode,
    };
  }

  async startSale(input: TerminalSaleRequest): Promise<TerminalPaymentResult> {
    const result = await this.clover.startCardSale({
      amountCents: input.amountCents,
      idempotencyKey: input.idempotencyKey,
      externalPaymentId: input.idempotencyKey,
      saleId: input.saleId,
      tipFlow: "pre_payment_device",
    });

    return {
      status: result.status,
      provider: "clover",
      providerPaymentId: result.providerPaymentId,
      providerOrderId: result.providerOrderId,
      externalPaymentId: result.externalPaymentId ?? input.idempotencyKey,
      saleId: input.saleId,
      authCode: result.authCode,
      cardBrand: result.cardBrand,
      cardLast4: result.cardLast4,
      baseAmountCents: result.baseAmountCents,
      tipCents: result.tipCents,
      totalChargedCents: result.totalChargedCents,
      message: result.message,
      rawProviderReference: result.rawProviderReference,
    };
  }

  async cancelCurrentAction(): Promise<void> {
    await this.clover.cancelCurrentPayment();
  }

  async refund(input: TerminalRefundRequest): Promise<TerminalRefundResult> {
    const result = await this.clover.refund(input);
    return {
      status: result.status,
      providerRefundId: result.providerRefundId,
      message: result.message,
    };
  }

  async reconcile(input: ReconciliationRequest): Promise<ReconciliationResult> {
    const result = await this.clover.reconcile(input);
    return {
      provider: "clover",
      cardTotalCents: result.cardTotalCents,
      payments: result.payments.map((payment) => ({
        status: payment.status,
        provider: "clover",
        providerPaymentId: payment.providerPaymentId,
        providerOrderId: payment.providerOrderId,
        externalPaymentId: payment.externalPaymentId,
        authCode: payment.authCode,
        cardBrand: payment.cardBrand,
        cardLast4: payment.cardLast4,
        baseAmountCents: payment.baseAmountCents,
        tipCents: payment.tipCents,
        totalChargedCents: payment.totalChargedCents,
        message: payment.message,
        rawProviderReference: payment.rawProviderReference,
      })),
    };
  }
}

function createAdapterForConfig(config: CloverPaymentConfig): PaymentTerminalAdapter {
  if (config.transport === "mock") {
    return new MockTerminalAdapter();
  }
  return new CloverTerminalAdapter(createCloverPaymentAdapter(config));
}

function normalizeTerminalConfig(config: CloverPaymentConfig): CloverPaymentConfig {
  const transport = config.transport ?? "mock";
  const normalized: CloverPaymentConfig = {
    ...config,
    transport,
    deviceBaseUrl: trimString(config.deviceBaseUrl),
    deviceId: trimString(config.deviceId),
    posId: trimString(config.posId),
    accessToken: trimString(config.accessToken),
    usbSidecarUrl: trimString(config.usbSidecarUrl),
    wsHost: trimString(config.wsHost),
    wsPath: normalizeWsPath(config.wsPath),
    remoteApplicationId: trimString(config.remoteApplicationId),
    posName: trimString(config.posName),
    serialNumber: trimString(config.serialNumber),
    authToken: trimString(config.authToken),
  };
  normalized.wsUrl = buildWsUrl(normalized);
  return normalized;
}

function validateTerminalConfig(config: CloverPaymentConfig): string[] {
  if (config.transport === "mock") return [];
  return validateCloverPaymentConfig(config);
}

function buildWsUrl(config: CloverPaymentConfig): string | undefined {
  const explicitUrl = trimString(config.wsUrl);
  if (explicitUrl && !config.wsHost) return explicitUrl;
  const host = trimString(config.wsHost);
  if (!host) return explicitUrl;
  const protocol = config.wsSecure === false ? "ws" : "wss";
  const portSegment = config.wsPort ? `:${config.wsPort}` : "";
  return `${protocol}://${host}${portSegment}${normalizeWsPath(config.wsPath) ?? "/remote_pay"}`;
}

function normalizeWsPath(value: string | undefined): string | undefined {
  const trimmed = trimString(value);
  if (!trimmed) return undefined;
  return trimmed.startsWith("/") ? trimmed : `/${trimmed}`;
}

function toSafeTerminalConfig(config: CloverPaymentConfig): SafeTerminalConfig {
  const { accessToken, authToken, ...safeConfig } = config;
  return {
    ...safeConfig,
    accessTokenConfigured: Boolean(accessToken),
    authTokenConfigured: Boolean(authToken),
    accessTokenPreview: maskSecret(accessToken),
    authTokenPreview: maskSecret(authToken),
  };
}

function maskSecret(value: string | undefined): string | undefined {
  if (!value) return undefined;
  if (value.length <= 4) return "****";
  return `${"*".repeat(Math.max(4, value.length - 4))}${value.slice(-4)}`;
}

function trimString(value: string | undefined): string | undefined {
  const trimmed = value?.trim();
  return trimmed ? trimmed : undefined;
}

export function parseTerminalTransport(value: unknown): CloverTransport {
  if (value === "mock" || value === "rest-local" || value === "usb-sidecar" || value === "ws-lan") {
    return value;
  }
  throw new Error("transport must be mock, rest-local, usb-sidecar, or ws-lan");
}
