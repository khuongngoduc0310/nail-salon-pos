import type { FastifyInstance } from "fastify";
import type { DbClient } from "../db.js";
import { getQuery, handleRouteError, optionalString } from "../http.js";
import { applyItemAdjustments } from "./reports/report-adjustments.js";
import { buildTicketSalesReport, cents, getCommissionCents, getCommissionRateSnapshot, getFinalServiceCents, isReportableSaleItem } from "./reports/sales-report.js";

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
          status: { in: ["paid", "refunded"] },
        },
        include: {
          items: { include: { worker: { include: { user: true } } } },
          payments: true,
          customer: true,
          refunds: true,
          adjustments: true,
        },
        orderBy: { completedAt: "desc" },
      });

      return buildTicketSalesReport(sales, workerId);
    } catch (error) {
      return handleRouteError(error, reply);
    }
  });

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

      const sales = await (db as any).sale.findMany({
        where: {
          completedAt: buildDateRange(start, end),
          status: { in: ["paid", "refunded"] },
        },
        include: {
          items: { include: { worker: { include: { user: true } } } },
          adjustments: true,
        },
      });

      const earnings = workers.map((w: any) => {
        const paidItems = sales.flatMap((sale: any) => (sale.items || [])
          .filter(isReportableSaleItem)
          .map((item: any) => applyItemAdjustments(item, sale.adjustments || []))
          .filter((item: any) => item.workerId === w.id));
        const netSales = paidItems.reduce((sum: number, i: any) => sum + getFinalServiceCents(i), 0);
        const commission = paidItems.reduce((sum: number, i: any) => sum + getCommissionCents(i), 0);
        const tips = paidItems.reduce((sum: number, i: any) => sum + cents(i.tipCents), 0);
        const commissionRates = Array.from(new Set<number>(paidItems.map((item: any) => getCommissionRateSnapshot(item, w))))
          .sort((a: number, b: number) => a - b);

        return {
          workerId: w.id,
          name: w.displayName || w.user?.name,
          services: paidItems.length,
          netSalesCents: netSales,
          commissionCents: commission,
          commissionRate: Number(w.commissionRate || 0),
          commissionRates,
          tipsCents: tips,
          totalPayCents: commission + tips,
        };
      });

      return { workers: earnings };
    } catch (error) {
      return handleRouteError(error, reply);
    }
  });

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
    } catch (error) {
      return handleRouteError(error, reply);
    }
  });

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
          providerOrderId: payment.providerOrderId ?? null,
          providerPaymentId: payment.providerPaymentId ?? null,
          authCode: payment.authCode ?? null,
          cardBrand: payment.cardBrand ?? null,
          cardLast4: payment.cardLast4 ?? null,
          amountCents: cents(payment.amountCents),
          tipCents: cents(payment.tipCents),
          status: payment.status,
          createdAt: payment.createdAt,
        })),
      };
    } catch (error) {
      return handleRouteError(error, reply);
    }
  });

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
        })),
      };
    } catch (error) {
      return handleRouteError(error, reply);
    }
  });

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
    } catch (error) {
      return handleRouteError(error, reply);
    }
  });
}

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
