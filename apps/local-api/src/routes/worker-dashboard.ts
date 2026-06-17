import type { FastifyInstance } from "fastify";
import type { DbClient } from "../db.js";
import { sumTurnCounts } from "@nail/shared";
import { verifyWorkerToken } from "./auth.js";
import { getParams, getQuery, handleRouteError, optionalString, requiredString } from "../http.js";

export async function registerWorkerDashboardRoutes(app: FastifyInstance, db: DbClient) {
  app.get("/api/workers/:id/tickets", async (request, reply) => {
    try {
      const params = getParams(request);
      const query = getQuery(request);
      const workerId = requiredString(params.id, "id");

      const worker = await requireWorkerAccess(db, workerId, request.headers.authorization, reply);
      if (!worker) return;

      const start = optionalString(query.start, "start");
      const end = optionalString(query.end, "end");
      const sales = await (db as any).sale.findMany({
        where: {
          completedAt: buildDateRange(start, end),
          items: { some: { workerId } },
          status: { in: ["paid", "refunded"] },
        },
        include: {
          items: true,
          customer: true,
        },
        orderBy: { completedAt: "desc" },
      });

      const tickets = sales
        .map((sale: any) => buildWorkerTicket(sale, workerId, worker.displayName || worker.user?.name || "Worker"))
        .filter(Boolean);

      const summary = tickets.reduce((totals: Record<string, number>, ticket: any) => {
        totals.ticketCount += 1;
        totals.serviceCount += ticket.services.length;
        totals.serviceTotalCents += ticket.totals.serviceCents;
        totals.tipTotalCents += ticket.totals.tipsCents;
        totals.commissionTotalCents += ticket.totals.commissionCents;
        totals.payTotalCents += ticket.totals.payCents;
        return totals;
      }, {
        ticketCount: 0,
        serviceCount: 0,
        serviceTotalCents: 0,
        tipTotalCents: 0,
        commissionTotalCents: 0,
        payTotalCents: 0,
      });

      return { summary, tickets };
    } catch (error) {
      return handleRouteError(error, reply);
    }
  });

  app.get("/api/workers/:id/dashboard", async (request, reply) => {
    try {
      const params = getParams(request);
      const workerId = requiredString(params.id, "id");

      const worker = await requireWorkerAccess(db, workerId, request.headers.authorization, reply);
      if (!worker) return;

      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const tomorrow = new Date(today);
      tomorrow.setDate(tomorrow.getDate() + 1);

      // Today's turns
      const turnsToday = await (db as any).turn.findMany({
        where: {
          workerId,
          createdAt: { gte: today, lt: tomorrow },
        },
        include: { customer: true },
        orderBy: { createdAt: "desc" },
      });

      const turnsTakenToday = sumTurnCounts(
        turnsToday.filter(
          (t: any) => t.status === "completed" || t.status === "in_service"
        )
      );

      // Active turn
      const activeTurn = turnsToday.find((t: any) => t.status === "in_service") ?? null;

      // Today's sale items
      const saleItems = await (db as any).saleItem.findMany({
        where: {
          workerId,
          createdAt: { gte: today, lt: tomorrow },
          status: "active",
        },
      });

      const salesTodayCents = saleItems.reduce(
        (sum: number, i: any) => sum + (i.finalServiceCents || 0),
        0
      );
      const tipsTodayCents = saleItems.reduce(
        (sum: number, i: any) => sum + (i.tipCents || 0),
        0
      );
      const commissionTodayCents = saleItems.reduce(
        (sum: number, i: any) => sum + (i.workerCommissionCents || 0),
        0
      );
      const totalPayTodayCents = commissionTodayCents + tipsTodayCents;

      // Today's appointments
      const appointmentsToday = await (db as any).appointment.findMany({
        where: {
          workerId,
          startTime: { gte: today, lt: tomorrow },
        },
        include: { customer: true, services: true },
        orderBy: { startTime: "asc" },
      });

      return {
        workerId: worker.id,
        name: worker.displayName || worker.user?.name,
        status: worker.currentStatus,
        commissionRate: Number(worker.commissionRate),
        turnsTakenToday,
        activeTurn: activeTurn
          ? {
              id: activeTurn.id,
              customerName: activeTurn.customer?.name ?? null,
              startedAt: activeTurn.startedAt,
              estimatedMinutes: null,
            }
          : null,
        serviceSalesTodayCents: salesTodayCents,
        tipsTodayCents,
        commissionTodayCents,
        totalPayTodayCents,
        appointmentsToday: appointmentsToday.map((a: any) => ({
          id: a.id,
          time: a.startTime,
          customerName: a.customer?.name ?? "Customer",
          services: (a.services || []).map((s: any) => s.service?.name ?? "Service"),
          status: a.status,
        })),
      };
    } catch (error) {
      return handleRouteError(error, reply);
    }
  });
}

async function requireWorkerAccess(db: DbClient, workerId: string, authHeader: string | undefined, reply: any) {
  const userId = await verifyWorkerToken(db, authHeader);
  if (!userId) {
    reply.code(401).send({ error: "Not authenticated" });
    return null;
  }

  const worker = await (db as any).worker.findUnique({
    where: { id: workerId },
    include: { user: true },
  });

  if (!worker) {
    reply.code(404).send({ error: "Worker not found" });
    return null;
  }

  if (worker.userId !== userId && worker.user?.role !== "owner") {
    reply.code(403).send({ error: "Forbidden" });
    return null;
  }

  return worker;
}

function buildDateRange(start?: string, end?: string) {
  if (!start && !end) {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);
    return { gte: today, lt: tomorrow };
  }

  const range: any = {};
  if (start) range.gte = new Date(start);
  if (end) range.lt = new Date(end);
  return range;
}

function buildWorkerTicket(sale: any, workerId: string, workerName: string) {
  const services = (sale.items || [])
    .filter((item: any) => item.workerId === workerId && item.status !== "voided" && item.status !== "refunded")
    .map((item: any) => {
      const priceCents = cents(item.priceCents);
      const discountCents = cents(item.discountCents);
      const serviceCents = getFinalServiceCents(item);
      const commissionCents = cents(item.workerCommissionCents);
      const tipsCents = cents(item.tipCents);
      return {
        id: item.id,
        serviceName: item.serviceNameSnapshot || "Service",
        workerId,
        workerName,
        priceCents,
        discountCents,
        serviceCents,
        commissionCents,
        tipsCents,
        payCents: commissionCents + tipsCents,
      };
    });

  if (services.length === 0) return null;

  const serviceCents = services.reduce((sum: number, line: any) => sum + line.serviceCents, 0);
  const tipsCents = services.reduce((sum: number, line: any) => sum + line.tipsCents, 0);
  const commissionCents = services.reduce((sum: number, line: any) => sum + line.commissionCents, 0);

  return {
    id: sale.id,
    completedAt: sale.completedAt,
    customerName: sale.customer?.name ?? "Walk-in",
    services,
    totals: {
      serviceCents,
      tipsCents,
      commissionCents,
      payCents: commissionCents + tipsCents,
    },
  };
}

function cents(value: unknown) {
  return typeof value === "number" && Number.isFinite(value) ? value : 0;
}

function getFinalServiceCents(item: any) {
  const stored = cents(item.finalServiceCents);
  if (stored > 0) return stored;
  return Math.max(cents(item.priceCents) - cents(item.discountCents), 0);
}
