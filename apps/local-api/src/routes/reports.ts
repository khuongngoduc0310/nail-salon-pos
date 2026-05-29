import type { FastifyInstance } from "fastify";
import type { DbClient } from "../db.js";
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
          items: { include: { worker: true } },
          payments: true,
          customer: true,
        },
        orderBy: { completedAt: "desc" },
      });

      const summary = computeSalesSummary(sales);
      return { summary, sales };
    } catch (error) {
      return handleRouteError(error, reply);
    }
  });

  // Worker earnings report
  app.get("/api/reports/workers", async (request, reply) => {
    try {
      const query = getQuery(request);
      const { start, end } = parseReportFilters(query);

      const workers = await (db as any).worker.findMany({
        where: { active: true },
        include: {
          user: true,
        },
      });

      const earnings = [];
      for (const w of workers) {
        const items = await (db as any).saleItem.findMany({
          where: {
            workerId: w.id,
            createdAt: buildDateRange(start, end),
            status: "active",
          },
        });

        const netSales = items.reduce((sum: number, i: any) => sum + (i.finalServiceCents || 0), 0);
        const commission = items.reduce((sum: number, i: any) => sum + (i.workerCommissionCents || 0), 0);
        const tips = items.reduce((sum: number, i: any) => sum + (i.tipCents || 0), 0);

        earnings.push({
          workerId: w.id,
          name: w.displayName || w.user?.name,
          services: items.length,
          netSalesCents: netSales,
          commissionCents: commission,
          commissionRate: Number(w.commissionRate || 0),
          tipsCents: tips,
          totalPayCents: commission + tips,
        });
      }

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
      const { start, end } = parseReportFilters(query);

      const payments = await (db as any).payment.findMany({
        where: {
          createdAt: buildDateRange(start, end),
        },
      });

      const byMethod: Record<string, number> = {};
      for (const p of payments) {
        if (p.status === "approved") {
          byMethod[p.method] = (byMethod[p.method] || 0) + (p.amountCents || 0);
        }
      }

      return {
        cashTotalCents: byMethod.cash || 0,
        cardTotalCents: byMethod.card || 0,
        giftCardTotalCents: byMethod.gift_card || 0,
        otherTotalCents: byMethod.other || 0,
        byProvider: {},
      };
    } catch (error) {
      return handleRouteError(error, reply);
    }
  });

  // Refund report
  app.get("/api/reports/refunds", async (request, reply) => {
    try {
      const query = getQuery(request);
      const { start, end } = parseReportFilters(query);

      const refunds = await (db as any).refund.findMany({
        where: { createdAt: buildDateRange(start, end) },
        include: { sale: true, payment: true },
        orderBy: { createdAt: "desc" },
      });

      return { refunds };
    } catch (error) {
      return handleRouteError(error, reply);
    }
  });

  // Discount report
  app.get("/api/reports/discounts", async (request, reply) => {
    try {
      const query = getQuery(request);
      const { start, end } = parseReportFilters(query);

      const discounts = await (db as any).discount.findMany({
        where: { createdAt: buildDateRange(start, end) },
        include: { sale: true },
        orderBy: { createdAt: "desc" },
      });

      return { discounts };
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
          ...buildDateRange(start, end),
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
      const { start, end } = parseReportFilters(query);

      const sales = await (db as any).sale.findMany({
        where: {
          completedAt: buildDateRange(start, end),
          status: { in: ["paid", "refunded"] },
        },
        include: { items: true, payments: true, refunds: true, discounts: true },
      });

      const summary = computeSalesSummary(sales);
      const workerCommission = sales.reduce((sum: number, s: any) =>
        sum + (s.items || []).reduce((is: number, i: any) => is + (i.workerCommissionCents || 0), 0), 0);

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