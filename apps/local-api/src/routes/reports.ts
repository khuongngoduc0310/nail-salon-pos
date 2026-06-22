import type { FastifyInstance } from "fastify";
import type { DbClient } from "../db.js";
<<<<<<< HEAD
import { getQuery, handleRouteError, optionalString } from "../http.js";

export async function registerReportRoutes(app: FastifyInstance, db: DbClient) {
  // Sales report
  app.get("/api/reports/sales", async (request, reply) => {
    try {
      const query = getQuery(request);
      const { start, end, workerId, paymentMethod } = parseReportFilters(query);

      const sales = await (db as any).sale.findMany({
        where: {
          completedAt: buildDateRange(start, end),
          ...(paymentMethod ? { payments: { some: { method: paymentMethod } } } : {}),
          ...(workerId ? { items: { some: { workerId } } } : {}),
          status: { in: ["paid", "refunded"] },
        },
        include: {
          items: { include: { worker: { include: { user: true } } } },
          payments: true,
          customer: true,
          refunds: true,
        },
        orderBy: { completedAt: "desc" },
      });

      return buildTicketSalesReport(sales, workerId);
=======
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
>>>>>>> bdf0b2066dfcb2e3e613cb86c08bdfaba329da34
    } catch (error) {
      return handleRouteError(error, reply);
    }
  });

<<<<<<< HEAD
  // Worker earnings report
  app.get("/api/reports/workers", async (request, reply) => {
    try {
      const query = getQuery(request);
      const { start, end, workerId } = parseReportFilters(query);

      const workers = await (db as any).worker.findMany({
        where: { active: true, ...(workerId ? { id: workerId } : {}) },
        include: {
          user: true,
        },
      });

      const earnings = [];
      for (const w of workers) {
        const items = await (db as any).saleItem.findMany({
          where: {
            workerId: w.id,
            sale: {
              completedAt: buildDateRange(start, end),
              status: { in: ["paid", "refunded"] },
            },
          },
        });

        const paidItems = items.filter(isReportableSaleItem);
        const netSales = paidItems.reduce((sum: number, i: any) => sum + getFinalServiceCents(i), 0);
        const commission = paidItems.reduce((sum: number, i: any) => sum + getCommissionCents(i), 0);
        const tips = paidItems.reduce((sum: number, i: any) => sum + cents(i.tipCents), 0);
        const commissionRates = Array.from(new Set<number>(paidItems.map((item: any) => getCommissionRateSnapshot(item, w))))
          .sort((a: number, b: number) => a - b);

        earnings.push({
          workerId: w.id,
          name: w.displayName || w.user?.name,
          services: paidItems.length,
          netSalesCents: netSales,
          commissionCents: commission,
          commissionRate: Number(w.commissionRate || 0),
          commissionRates,
          tipsCents: tips,
          totalPayCents: commission + tips,
        });
      }

      return { workers: earnings };
=======
  app.get("/api/reports/workers", async (request, reply) => {
    try {
      requireOwnerSession(request);
      const range = parseReportRange(request);
      const sales = await loadPaidSales(db, range);
      return { range: serializeRange(range), workers: buildWorkerRows(sales) };
>>>>>>> bdf0b2066dfcb2e3e613cb86c08bdfaba329da34
    } catch (error) {
      return handleRouteError(error, reply);
    }
  });

<<<<<<< HEAD
  // Turn report
  app.get("/api/reports/turns", async (request, reply) => {
    try {
      const query = getQuery(request);
      const { start, end } = parseReportFilters(query);

      const workers = await (db as any).worker.findMany({
        where: { active: true },
        include: { user: true },
      });

      const turnData = [];
      for (const w of workers) {
        const turns = await (db as any).turn.findMany({
          where: {
            workerId: w.id,
            createdAt: buildDateRange(start, end),
          },
        });

        const completed = turns.filter((t: any) => t.status === "completed");
        const completions = completed.map((t: any) => {
          if (t.startedAt && t.endedAt) {
            return (new Date(t.endedAt).getTime() - new Date(t.startedAt).getTime()) / 60000;
          }
          return null;
        }).filter(Boolean) as number[];

        const avgDuration = completions.length > 0
          ? `${Math.round(completions.reduce((a: number, b: number) => a + b, 0) / completions.length)} min`
          : "-";

        turnData.push({
          workerId: w.id,
          name: w.displayName || w.user?.name,
          taken: turns.filter((t: any) => t.status === "completed" || t.status === "in_service").length,
          completed: completed.length,
          skipped: turns.filter((t: any) => t.status === "skipped").length,
          avgDuration,
        });
      }

      return { workers: turnData };
=======
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
>>>>>>> bdf0b2066dfcb2e3e613cb86c08bdfaba329da34
    } catch (error) {
      return handleRouteError(error, reply);
    }
  });

<<<<<<< HEAD
  // Payment report
  app.get("/api/reports/payments", async (request, reply) => {
    try {
      const query = getQuery(request);
      const { start, end, workerId, paymentMethod } = parseReportFilters(query);

      const payments = await (db as any).payment.findMany({
        where: {
          createdAt: buildDateRange(start, end),
          ...(paymentMethod ? { method: paymentMethod } : {}),
          ...(workerId ? { sale: { items: { some: { workerId } } } } : {}),
        },
        include: { sale: { include: { customer: true } } },
        orderBy: { createdAt: "desc" },
      });

      const totals = {
        cashTotalCents: 0,
        cardTotalCents: 0,
        giftCardTotalCents: 0,
        otherTotalCents: 0,
        totalApprovedCents: 0,
      };
      const byProvider: Record<string, Record<string, number>> = {};
      for (const p of payments) {
        const amountCents = cents(p.amountCents);
        if (p.status !== "approved") continue;

        if (p.method === "cash") totals.cashTotalCents += amountCents;
        else if (p.method === "card") totals.cardTotalCents += amountCents;
        else if (p.method === "gift_card") totals.giftCardTotalCents += amountCents;
        else totals.otherTotalCents += amountCents;
        totals.totalApprovedCents += amountCents;

        if (p.provider) {
          byProvider[p.provider] = byProvider[p.provider] ?? {};
          byProvider[p.provider][p.status] = (byProvider[p.provider][p.status] ?? 0) + amountCents;
        }
      }

      return {
        summary: {
          ...totals,
          byProvider,
        },
        payments: payments.map((payment: any) => ({
          id: payment.id,
          saleId: payment.saleId,
          customerName: payment.sale?.customer?.name ?? "Walk-in",
          method: payment.method,
          provider: payment.provider ?? null,
          providerPaymentId: payment.providerPaymentId ?? null,
          amountCents: cents(payment.amountCents),
          tipCents: cents(payment.tipCents),
          status: payment.status,
          createdAt: payment.createdAt,
        })),
      };
=======
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
>>>>>>> bdf0b2066dfcb2e3e613cb86c08bdfaba329da34
    } catch (error) {
      return handleRouteError(error, reply);
    }
  });

<<<<<<< HEAD
  // Refund report
  app.get("/api/reports/refunds", async (request, reply) => {
    try {
      const query = getQuery(request);
      const { start, end, workerId } = parseReportFilters(query);

      const refunds = await (db as any).refund.findMany({
        where: {
          createdAt: buildDateRange(start, end),
          ...(workerId ? { sale: { items: { some: { workerId } } } } : {}),
        },
        include: { sale: { include: { customer: true } }, payment: true },
        orderBy: { createdAt: "desc" },
      });

      return {
        summary: {
          refundTotalCents: refunds.reduce((sum: number, refund: any) => sum + cents(refund.amountCents), 0),
          refundCount: refunds.length,
        },
        refunds: refunds.map((refund: any) => ({
          id: refund.id,
          saleId: refund.saleId,
          paymentId: refund.paymentId ?? null,
          customerName: refund.sale?.customer?.name ?? "Walk-in",
          amountCents: cents(refund.amountCents),
          reason: refund.reason ?? null,
          approvedByUserId: refund.approvedByUserId ?? null,
          paymentMethod: refund.payment?.method ?? null,
          createdAt: refund.createdAt,
        })),
      };
    } catch (error) {
      return handleRouteError(error, reply);
    }
  });

  // Discount report
  app.get("/api/reports/discounts", async (request, reply) => {
    try {
      const query = getQuery(request);
      const { start, end, workerId } = parseReportFilters(query);

      const discounts = await (db as any).discount.findMany({
        where: {
          createdAt: buildDateRange(start, end),
          ...(workerId ? { sale: { items: { some: { workerId } } } } : {}),
        },
        include: { sale: { include: { customer: true } }, saleItem: true },
        orderBy: { createdAt: "desc" },
      });

      return {
        summary: {
          discountTotalCents: discounts.reduce((sum: number, discount: any) => sum + cents(discount.amountCents), 0),
          discountCount: discounts.length,
        },
        discounts: discounts.map((discount: any) => ({
          id: discount.id,
          saleId: discount.saleId,
          saleItemId: discount.saleItemId ?? null,
          customerName: discount.sale?.customer?.name ?? "Walk-in",
          serviceName: discount.saleItem?.serviceNameSnapshot ?? null,
          type: discount.type,
          amountCents: cents(discount.amountCents),
          percent: discount.percent ?? null,
          reason: discount.reason ?? null,
          approvedByUserId: discount.approvedByUserId ?? null,
          createdAt: discount.createdAt,
=======
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
>>>>>>> bdf0b2066dfcb2e3e613cb86c08bdfaba329da34
        })),
      };
    } catch (error) {
      return handleRouteError(error, reply);
    }
  });

<<<<<<< HEAD
  // Turn detail report — individual turns with full info
  app.get("/api/reports/turns/detail", async (request, reply) => {
    try {
      const query = getQuery(request);
      const { start, end, workerId } = parseReportFilters(query);

      const turns = await (db as any).turn.findMany({
        where: {
          createdAt: buildDateRange(start, end),
          ...(workerId ? { workerId } : {}),
        },
        include: {
          worker: { include: { user: true } },
          customer: true,
          checkin: true,
          sale: { include: { items: true } },
        },
        orderBy: { createdAt: "desc" },
      });

      const detail = turns.map((t: any) => {
        const saleItems = t.sale?.items ?? [];
        const services = saleItems
          .filter((si: any) => si.workerId === t.workerId)
          .map((si: any) => si.serviceNameSnapshot)
          .join(", ");

        const itemTotal = saleItems
          .filter((si: any) => si.workerId === t.workerId)
          .reduce((sum: number, si: any) => sum + (si.finalServiceCents || 0), 0);

        const tips = saleItems
          .filter((si: any) => si.workerId === t.workerId)
          .reduce((sum: number, si: any) => sum + (si.tipCents || 0), 0);

        const commission = saleItems
          .filter((si: any) => si.workerId === t.workerId)
          .reduce((sum: number, si: any) => sum + (si.workerCommissionCents || 0), 0);

        const duration = t.startedAt && t.endedAt
          ? Math.round((new Date(t.endedAt).getTime() - new Date(t.startedAt).getTime()) / 60000)
          : null;

        return {
          id: t.id,
          workerName: t.worker?.displayName || t.worker?.user?.name,
          customerName: t.customer?.name ?? "Walk-in",
          status: t.status,
          services,
          itemTotalCents: itemTotal,
          commissionCents: commission,
          tipsCents: tips,
          totalPayCents: commission + tips,
          durationMinutes: duration,
          startedAt: t.startedAt,
          endedAt: t.endedAt,
          createdAt: t.createdAt,
        };
      });

      return { turns: detail };
    } catch (error) {
      return handleRouteError(error, reply);
    }
  });

  // End-of-day summary
  app.get("/api/reports/end-of-day", async (request, reply) => {
    try {
      const query = getQuery(request);
      const { start, end, workerId } = parseReportFilters(query);

      const sales = await (db as any).sale.findMany({
        where: {
          completedAt: buildDateRange(start, end),
          ...(workerId ? { items: { some: { workerId } } } : {}),
          status: { in: ["paid", "refunded"] },
        },
        include: { items: true, payments: true, refunds: true, discounts: true },
      });

      const { summary } = buildTicketSalesReport(sales, workerId);
      const workerCommission = summary.workerCommissionPayoutCents;

      return {
        ...summary,
        workerCommissionPayoutCents: workerCommission,
        businessShareCents: summary.netServiceSalesCents - workerCommission,
      };
=======
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
>>>>>>> bdf0b2066dfcb2e3e613cb86c08bdfaba329da34
    } catch (error) {
      return handleRouteError(error, reply);
    }
  });
}

<<<<<<< HEAD
function parseReportFilters(query: Record<string, unknown>) {
  const start = optionalString(query.start, "start");
  const end = optionalString(query.end, "end");
  const workerId = optionalString(query.workerId, "workerId");
  const paymentMethod = optionalString(query.paymentMethod, "paymentMethod");

  return { start, end, workerId, paymentMethod };
}

function buildDateRange(start?: string, end?: string) {
  if (!start && !end) {
    // Default to today
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);
    return { gte: today, lt: tomorrow };
  }

  const range: any = {};
  if (start) {
    range.gte = new Date(start);
  }
  if (end) {
    range.lt = new Date(end);
  }
  return range;
}

function buildTicketSalesReport(sales: any[], workerId?: string) {
  const tickets = sales
    .map((sale) => buildTicketReport(sale, workerId))
    .filter(Boolean);

  const summary = tickets.reduce((totals: Record<string, number>, ticket: any) => {
    totals.grossServiceSalesCents += ticket.totals.grossServiceCents;
    totals.discountTotalCents += ticket.totals.discountCents;
    totals.refundTotalCents += ticket.totals.refundCents;
    totals.netServiceSalesCents += ticket.totals.serviceCents;
    totals.tipTotalCents += ticket.totals.tipsCents;
    totals.workerCommissionPayoutCents += ticket.totals.commissionCents;
    totals.workerTipsPayoutCents += ticket.totals.tipsCents;
    totals.totalPayCents += ticket.totals.payCents;
    totals.cashTotalCents += ticket.totals.cashCents;
    totals.cardTotalCents += ticket.totals.cardCents;
    totals.giftCardTotalCents += ticket.totals.giftCardCents;
    totals.totalCollectedCents += ticket.totals.collectedCents;
    return totals;
  }, {
    grossServiceSalesCents: 0,
    discountTotalCents: 0,
    refundTotalCents: 0,
    netServiceSalesCents: 0,
    tipTotalCents: 0,
    workerCommissionPayoutCents: 0,
    workerTipsPayoutCents: 0,
    totalPayCents: 0,
    cashTotalCents: 0,
    cardTotalCents: 0,
    giftCardTotalCents: 0,
    totalCollectedCents: 0,
  });

  return {
    summary,
    sales: tickets,
  };
}

function buildTicketReport(sale: any, workerId?: string) {
  const activeItems = (sale.items || []).filter(isReportableSaleItem);
  const reportItems = workerId
    ? activeItems.filter((item: any) => item.workerId === workerId)
    : activeItems;

  if (reportItems.length === 0) return null;

  const approvedPayments = (sale.payments || []).filter((payment: any) => payment.status === "approved");
  const serviceLines = reportItems.map((item: any) => {
    const priceCents = cents(item.priceCents);
    const discountCents = cents(item.discountCents);
    const finalServiceCents = getFinalServiceCents(item);
    const commissionCents = getCommissionCents(item);
    const tipsCents = cents(item.tipCents);

    return {
      id: item.id,
      serviceName: item.serviceNameSnapshot,
      workerId: item.workerId,
      workerName: item.worker?.displayName || item.worker?.user?.name || "Worker",
      priceCents,
      discountCents,
      finalServiceCents,
      commissionCents,
      tipsCents,
      payCents: commissionCents + tipsCents,
    };
  });

  const grossServiceCents = serviceLines.reduce((sum: number, line: any) => sum + line.priceCents, 0);
  const discountCents = serviceLines.reduce((sum: number, line: any) => sum + line.discountCents, 0);
  const serviceCents = serviceLines.reduce((sum: number, line: any) => sum + line.finalServiceCents, 0);
  const commissionCents = serviceLines.reduce((sum: number, line: any) => sum + line.commissionCents, 0);
  const tipsCents = serviceLines.reduce((sum: number, line: any) => sum + line.tipsCents, 0);
  const payCents = commissionCents + tipsCents;
  const refundCents = workerId ? 0 : (sale.refunds || []).reduce((sum: number, refund: any) => sum + (refund.amountCents || 0), 0);
  const paymentTotals = approvedPayments.reduce((totals: Record<string, number>, payment: any) => {
    if (payment.method === "cash") totals.cashCents += payment.amountCents || 0;
    else if (payment.method === "card") totals.cardCents += payment.amountCents || 0;
    else if (payment.method === "gift_card") totals.giftCardCents += payment.amountCents || 0;
    totals.collectedCents += payment.amountCents || 0;
    return totals;
  }, { cashCents: 0, cardCents: 0, giftCardCents: 0, collectedCents: 0 });

  const collectedCents = workerId ? serviceCents + tipsCents : paymentTotals.collectedCents;

  return {
    id: sale.id,
    completedAt: sale.completedAt,
    customerName: sale.customer?.name ?? "Walk-in",
    paymentMethods: Array.from(new Set(approvedPayments.map((payment: any) => payment.method))),
    services: serviceLines,
    totals: {
      grossServiceCents,
      discountCents,
      refundCents,
      serviceCents,
      commissionCents,
      tipsCents,
      payCents,
      cashCents: workerId ? 0 : paymentTotals.cashCents,
      cardCents: workerId ? 0 : paymentTotals.cardCents,
      giftCardCents: workerId ? 0 : paymentTotals.giftCardCents,
      collectedCents,
    },
  };
}

function isReportableSaleItem(item: any) {
  return item.status !== "voided" && item.status !== "refunded";
}

function cents(value: unknown) {
  return typeof value === "number" && Number.isFinite(value) ? value : 0;
}

function getFinalServiceCents(item: any) {
  const stored = cents(item.finalServiceCents);
  if (stored > 0) return stored;

  return Math.max(cents(item.priceCents) - cents(item.discountCents), 0);
}

function getCommissionCents(item: any) {
  const stored = cents(item.workerCommissionCents);
  if (stored > 0) return stored;

  const rate = Number(item.commissionRateSnapshot ?? 0);
  return Number.isFinite(rate) ? Math.round(getFinalServiceCents(item) * rate) : 0;
}

function getCommissionRateSnapshot(item: any, worker: any) {
  const rate = Number(item.commissionRateSnapshot ?? worker.commissionRate ?? 0);
  return Number.isFinite(rate) ? rate : 0;
}

function computeSalesSummary(sales: any[]) {
  let grossCents = 0;
  let discountCents = 0;
  let refundCents = 0;
  let tipCents = 0;
  let cashCents = 0;
  let cardCents = 0;
  let giftCardCents = 0;

  for (const sale of sales) {
    grossCents += sale.subtotalCents || 0;
    discountCents += sale.discountTotalCents || 0;
    tipCents += sale.tipTotalCents || 0;
    const refunds = (sale.refunds || []).reduce((s: number, r: any) => s + (r.amountCents || 0), 0);
    refundCents += refunds;

    for (const p of (sale.payments || [])) {
      if (p.status !== "approved") continue;
      if (p.method === "cash") cashCents += p.amountCents || 0;
      else if (p.method === "card") cardCents += p.amountCents || 0;
      else if (p.method === "gift_card") giftCardCents += p.amountCents || 0;
    }
  }

  return {
    grossServiceSalesCents: grossCents,
    discountTotalCents: discountCents,
    refundTotalCents: refundCents,
    netServiceSalesCents: grossCents - discountCents - refundCents,
    tipTotalCents: tipCents,
    cashTotalCents: cashCents,
    cardTotalCents: cardCents,
    giftCardTotalCents: giftCardCents,
    totalCollectedCents: cashCents + cardCents + giftCardCents,
  };
}
=======
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
>>>>>>> bdf0b2066dfcb2e3e613cb86c08bdfaba329da34
