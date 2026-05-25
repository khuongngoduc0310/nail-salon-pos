import type { FastifyInstance } from "fastify";
import type { DbClient } from "../db.js";
import { issueOwnerToken, requireOwnerSession, verifySecret } from "../auth.js";
import { asObject, getQuery, handleRouteError, optionalDate, optionalString, requiredString } from "../http.js";

type OwnerUserRecord = {
  id: string;
  name?: string | null;
  email?: string | null;
  phone?: string | null;
  role?: string;
  active?: boolean;
  passwordHash?: string | null;
};

type SaleRecord = {
  id: string;
  status: string;
  completedAt?: Date | string | null;
  subtotalCents?: number;
  discountTotalCents?: number;
  tipTotalCents?: number;
  totalCents?: number;
  amountPaidCents?: number;
  customer?: { id: string; name?: string | null; phone?: string | null } | null;
  checkin?: { customer?: { id: string; name?: string | null; phone?: string | null } | null } | null;
  items?: SaleItemRecord[];
  payments?: PaymentRecord[];
  refunds?: RefundRecord[];
};

type SaleItemRecord = {
  id: string;
  saleId?: string;
  workerId: string;
  serviceNameSnapshot?: string;
  priceCents?: number;
  discountCents?: number;
  finalServiceCents?: number;
  workerCommissionCents?: number;
  tipCents?: number;
  workerTotalCents?: number;
  businessCents?: number;
  status?: string;
  worker?: { id: string; displayName?: string | null } | null;
};

type PaymentRecord = {
  id: string;
  saleId?: string;
  method: "cash" | "card" | "gift_card" | "other";
  provider?: string | null;
  providerPaymentId?: string | null;
  amountCents?: number;
  tipCents?: number;
  status: string;
  cardBrand?: string | null;
  cardLast4?: string | null;
  authCode?: string | null;
  createdAt?: Date | string | null;
  sale?: SaleRecord | null;
};

type TurnRecord = {
  id: string;
  workerId: string;
  turnType?: string;
  status: string;
  startedAt?: Date | string | null;
  endedAt?: Date | string | null;
  completedAt?: Date | string | null;
  skippedAt?: Date | string | null;
  createdAt?: Date | string | null;
  worker?: { id: string; displayName?: string | null } | null;
};

type DiscountRecord = {
  id: string;
  saleId: string;
  saleItemId?: string | null;
  type: string;
  amountCents?: number | null;
  percent?: number | string | null;
  reason?: string | null;
  createdAt?: Date | string | null;
};

type RefundRecord = {
  id: string;
  saleId: string;
  paymentId?: string | null;
  amountCents?: number;
  reason?: string | null;
  createdAt?: Date | string | null;
  payment?: PaymentRecord | null;
  sale?: SaleRecord | null;
};

type ReportRange = {
  start: Date;
  end: Date;
};

const paymentMethods = ["cash", "card", "gift_card", "other"] as const;

export async function registerReportRoutes(app: FastifyInstance, db: DbClient) {
  app.post("/api/owner/login", async (request, reply) => {
    try {
      const body = asObject(request.body);
      const emailOrPhone = requiredString(body.emailOrPhone, "emailOrPhone");
      const password = requiredString(body.password, "password");
      const owners = (await db.user.findMany({
        where: {
          role: "owner",
          active: true,
          OR: [{ email: emailOrPhone }, { phone: emailOrPhone }],
        },
        take: 1,
      })) as OwnerUserRecord[];
      const owner = owners[0] ?? null;
      if (!owner?.passwordHash || !verifySecret(password, owner.passwordHash)) {
        return reply.code(401).send({ error: "invalid owner credentials" });
      }

      const issued = issueOwnerToken(owner.id);
      return {
        user: { id: owner.id, name: owner.name ?? "Owner", role: "owner" },
        token: issued.token,
        expiresAt: issued.expiresAt,
      };
    } catch (error) {
      return handleRouteError(error, reply);
    }
  });

  app.get("/api/reports/summary", async (request, reply) => {
    try {
      requireOwnerSession(request);
      const range = parseReportRange(request);
      const sales = await loadPaidSales(db, range);
      const refunds = flattenRefunds(sales);
      return { range: serializeRange(range), summary: buildSummary(sales, refunds) };
    } catch (error) {
      return handleRouteError(error, reply);
    }
  });

  app.get("/api/reports/sales", async (request, reply) => {
    try {
      requireOwnerSession(request);
      const range = parseReportRange(request);
      const query = getQuery(request);
      const workerId = optionalString(query.workerId, "workerId");
      const paymentMethod = optionalPaymentMethod(optionalString(query.paymentMethod, "paymentMethod"));
      const sales = (await loadPaidSales(db, range))
        .filter((sale) => !workerId || (sale.items ?? []).some((item) => item.workerId === workerId))
        .filter((sale) => !paymentMethod || (sale.payments ?? []).some((payment) => payment.method === paymentMethod && payment.status === "approved"));

      return {
        range: serializeRange(range),
        sales: sales.map((sale) => ({
          id: sale.id,
          completedAt: toIsoOrNull(sale.completedAt),
          customer: sale.customer ?? sale.checkin?.customer ?? null,
          subtotalCents: sale.subtotalCents ?? sumItems(sale.items ?? [], "priceCents"),
          discountCents: sale.discountTotalCents ?? sumItems(sale.items ?? [], "discountCents"),
          tipCents: sale.tipTotalCents ?? sumItems(sale.items ?? [], "tipCents"),
          totalCents: sale.totalCents ?? 0,
          collectedCents: sumApprovedPayments(sale.payments ?? []),
          paymentMethods: [...new Set((sale.payments ?? []).filter((payment) => payment.status === "approved").map((payment) => payment.method))],
          itemCount: (sale.items ?? []).length,
        })),
      };
    } catch (error) {
      return handleRouteError(error, reply);
    }
  });

  app.get("/api/reports/workers", async (request, reply) => {
    try {
      requireOwnerSession(request);
      const range = parseReportRange(request);
      const sales = await loadPaidSales(db, range);
      return { range: serializeRange(range), workers: buildWorkerRows(sales) };
    } catch (error) {
      return handleRouteError(error, reply);
    }
  });

  app.get("/api/reports/turns", async (request, reply) => {
    try {
      requireOwnerSession(request);
      const range = parseReportRange(request);
      const turns = (await db.turn.findMany({
        where: {
          OR: [
            { startedAt: { gte: range.start, lt: range.end } },
            { skippedAt: { gte: range.start, lt: range.end } },
            { createdAt: { gte: range.start, lt: range.end } },
          ],
        },
        include: { worker: true },
      })) as TurnRecord[];
      return { range: serializeRange(range), workers: buildTurnRows(turns) };
    } catch (error) {
      return handleRouteError(error, reply);
    }
  });

  app.get("/api/reports/payments", async (request, reply) => {
    try {
      requireOwnerSession(request);
      const range = parseReportRange(request);
      const payments = (await db.payment.findMany({
        where: { createdAt: { gte: range.start, lt: range.end }, status: "approved" },
        include: { sale: true },
        orderBy: [{ createdAt: "desc" }],
      })) as PaymentRecord[];
      return { range: serializeRange(range), payments: buildPaymentRows(payments), totals: buildPaymentBreakdown(payments) };
    } catch (error) {
      return handleRouteError(error, reply);
    }
  });

  app.get("/api/reports/discounts", async (request, reply) => {
    try {
      requireOwnerSession(request);
      const range = parseReportRange(request);
      const discounts = (await db.discount.findMany({
        where: { createdAt: { gte: range.start, lt: range.end } },
        orderBy: [{ createdAt: "desc" }],
      })) as DiscountRecord[];
      return {
        range: serializeRange(range),
        discounts: discounts.map((discount) => ({
          id: discount.id,
          saleId: discount.saleId,
          saleItemId: discount.saleItemId ?? null,
          type: discount.type,
          amountCents: discount.amountCents ?? 0,
          percent: discount.percent ?? null,
          reason: discount.reason ?? null,
          createdAt: toIsoOrNull(discount.createdAt),
        })),
      };
    } catch (error) {
      return handleRouteError(error, reply);
    }
  });

  app.get("/api/reports/refunds", async (request, reply) => {
    try {
      requireOwnerSession(request);
      const range = parseReportRange(request);
      const refunds = (await db.refund.findMany({
        where: { createdAt: { gte: range.start, lt: range.end } },
        include: { payment: true, sale: true },
        orderBy: [{ createdAt: "desc" }],
      })) as RefundRecord[];
      return { range: serializeRange(range), refunds: buildRefundRows(refunds) };
    } catch (error) {
      return handleRouteError(error, reply);
    }
  });
}

function parseReportRange(request: Parameters<typeof getQuery>[0]): ReportRange {
  const query = getQuery(request);
  const start = optionalDate(query.start, "start") ?? startOfToday();
  const end = optionalDate(query.end, "end") ?? endOfDay(start);
  return { start, end };
}

async function loadPaidSales(db: DbClient, range: ReportRange): Promise<SaleRecord[]> {
  return (await db.sale.findMany({
    where: { status: "paid", completedAt: { gte: range.start, lt: range.end } },
    include: {
      customer: true,
      checkin: { include: { customer: true } },
      items: { where: { status: "active" }, include: { worker: true } },
      payments: true,
      refunds: true,
    },
    orderBy: [{ completedAt: "desc" }],
  })) as SaleRecord[];
}

function buildSummary(sales: SaleRecord[], refunds: RefundRecord[]) {
  const items = sales.flatMap((sale) => sale.items ?? []);
  const payments = sales.flatMap((sale) => sale.payments ?? []).filter((payment) => payment.status === "approved");
  const grossServiceCents = sumItems(items, "priceCents");
  const discountCents = sumItems(items, "discountCents");
  const refundCents = refunds.reduce((sum, refund) => sum + (refund.amountCents ?? 0), 0);
  const netServiceCents = sumItems(items, "finalServiceCents") - refundCents;
  const tipsCents = sumItems(items, "tipCents");
  const workerCommissionCents = sumItems(items, "workerCommissionCents");
  const workerTipsCents = tipsCents;
  const businessShareCents = sumItems(items, "businessCents") - refundCents;

  return {
    grossServiceCents,
    discountCents,
    refundCents,
    netServiceCents,
    tipsCents,
    workerCommissionCents,
    workerTipsCents,
    businessShareCents,
    totalCollectedCents: payments.reduce((sum, payment) => sum + (payment.amountCents ?? 0), 0) - refundCents,
    paymentBreakdown: buildPaymentBreakdown(payments),
    salesCount: sales.length,
  };
}

function buildWorkerRows(sales: SaleRecord[]) {
  const byWorker = new Map<string, {
    workerId: string;
    workerName: string;
    serviceCount: number;
    netServiceCents: number;
    commissionCents: number;
    tipsCents: number;
    totalWorkerPayCents: number;
    businessShareCents: number;
  }>();

  for (const item of sales.flatMap((sale) => sale.items ?? [])) {
    const row = byWorker.get(item.workerId) ?? {
      workerId: item.workerId,
      workerName: item.worker?.displayName ?? "Worker",
      serviceCount: 0,
      netServiceCents: 0,
      commissionCents: 0,
      tipsCents: 0,
      totalWorkerPayCents: 0,
      businessShareCents: 0,
    };
    row.serviceCount += 1;
    row.netServiceCents += item.finalServiceCents ?? Math.max(0, (item.priceCents ?? 0) - (item.discountCents ?? 0));
    row.commissionCents += item.workerCommissionCents ?? 0;
    row.tipsCents += item.tipCents ?? 0;
    row.totalWorkerPayCents += item.workerTotalCents ?? (item.workerCommissionCents ?? 0) + (item.tipCents ?? 0);
    row.businessShareCents += item.businessCents ?? 0;
    byWorker.set(item.workerId, row);
  }

  return [...byWorker.values()].sort((left, right) => right.netServiceCents - left.netServiceCents);
}

function buildTurnRows(turns: TurnRecord[]) {
  const byWorker = new Map<string, {
    workerId: string;
    workerName: string;
    turnsTaken: number;
    completedTurns: number;
    skippedTurns: number;
    appointmentTurns: number;
    walkInTurns: number;
    averageServiceMinutes: number;
    lastTurnAt: string | null;
    durationTotalMinutes: number;
    durationCount: number;
  }>();

  for (const turn of turns) {
    const row = byWorker.get(turn.workerId) ?? {
      workerId: turn.workerId,
      workerName: turn.worker?.displayName ?? "Worker",
      turnsTaken: 0,
      completedTurns: 0,
      skippedTurns: 0,
      appointmentTurns: 0,
      walkInTurns: 0,
      averageServiceMinutes: 0,
      lastTurnAt: null,
      durationTotalMinutes: 0,
      durationCount: 0,
    };
    if (turn.startedAt) row.turnsTaken += 1;
    if (turn.status === "completed") row.completedTurns += 1;
    if (turn.status === "skipped") row.skippedTurns += 1;
    if (turn.turnType === "appointment") row.appointmentTurns += 1;
    if (turn.turnType === "walk_in" || turn.turnType === "requested_worker") row.walkInTurns += 1;
    const end = turn.endedAt ?? turn.completedAt;
    if (turn.startedAt && end) {
      row.durationTotalMinutes += Math.max(0, Math.round((new Date(end).getTime() - new Date(turn.startedAt).getTime()) / 60000));
      row.durationCount += 1;
    }
    const last = turn.endedAt ?? turn.completedAt ?? turn.skippedAt ?? turn.startedAt ?? turn.createdAt ?? null;
    if (last && (!row.lastTurnAt || new Date(last).getTime() > new Date(row.lastTurnAt).getTime())) {
      row.lastTurnAt = new Date(last).toISOString();
    }
    row.averageServiceMinutes = row.durationCount > 0 ? Math.round(row.durationTotalMinutes / row.durationCount) : 0;
    byWorker.set(turn.workerId, row);
  }

  return [...byWorker.values()]
    .map((row) => ({
      workerId: row.workerId,
      workerName: row.workerName,
      turnsTaken: row.turnsTaken,
      completedTurns: row.completedTurns,
      skippedTurns: row.skippedTurns,
      appointmentTurns: row.appointmentTurns,
      walkInTurns: row.walkInTurns,
      averageServiceMinutes: row.averageServiceMinutes,
      lastTurnAt: row.lastTurnAt,
    }))
    .sort((left, right) => right.turnsTaken - left.turnsTaken);
}

function buildPaymentRows(payments: PaymentRecord[]) {
  return payments.map((payment) => ({
    id: payment.id,
    saleId: payment.saleId ?? payment.sale?.id ?? null,
    method: payment.method,
    amountCents: payment.amountCents ?? 0,
    tipCents: payment.tipCents ?? 0,
    status: payment.status,
    provider: payment.provider ?? null,
    providerPaymentId: payment.providerPaymentId ?? null,
    cardBrand: payment.cardBrand ?? null,
    cardLast4: payment.cardLast4 ?? null,
    authCode: payment.authCode ?? null,
    createdAt: toIsoOrNull(payment.createdAt),
  }));
}

function buildRefundRows(refunds: RefundRecord[]) {
  return refunds.map((refund) => ({
    id: refund.id,
    saleId: refund.saleId,
    paymentId: refund.paymentId ?? null,
    amountCents: refund.amountCents ?? 0,
    reason: refund.reason ?? null,
    paymentMethod: refund.payment?.method ?? null,
    createdAt: toIsoOrNull(refund.createdAt),
  }));
}

function buildPaymentBreakdown(payments: PaymentRecord[]) {
  const totals = Object.fromEntries(paymentMethods.map((method) => [method, 0])) as Record<(typeof paymentMethods)[number], number>;
  for (const payment of payments) {
    if (payment.status !== "approved") continue;
    totals[payment.method] += payment.amountCents ?? 0;
  }
  return {
    cashCents: totals.cash,
    cardCents: totals.card,
    giftCardCents: totals.gift_card,
    otherCents: totals.other,
  };
}

function flattenRefunds(sales: SaleRecord[]): RefundRecord[] {
  return sales.flatMap((sale) => sale.refunds ?? []);
}

function optionalPaymentMethod(value: string | undefined): PaymentRecord["method"] | undefined {
  if (!value) return undefined;
  return paymentMethods.includes(value as PaymentRecord["method"]) ? (value as PaymentRecord["method"]) : undefined;
}

function sumItems(items: SaleItemRecord[], field: keyof SaleItemRecord): number {
  return items.reduce((sum, item) => sum + (typeof item[field] === "number" ? item[field] : 0), 0);
}

function sumApprovedPayments(payments: PaymentRecord[]): number {
  return payments.reduce((sum, payment) => sum + (payment.status === "approved" ? payment.amountCents ?? 0 : 0), 0);
}

function startOfToday(): Date {
  const date = new Date();
  date.setHours(0, 0, 0, 0);
  return date;
}

function endOfDay(start: Date): Date {
  const end = new Date(start);
  end.setDate(end.getDate() + 1);
  return end;
}

function serializeRange(range: ReportRange) {
  return { start: range.start.toISOString(), end: range.end.toISOString() };
}

function toIsoOrNull(value: Date | string | null | undefined): string | null {
  return value ? new Date(value).toISOString() : null;
}
