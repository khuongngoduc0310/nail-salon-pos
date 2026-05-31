import type { FastifyInstance } from "fastify";
import type { DbClient } from "../db.js";
import { sumTurnCounts } from "@nail/shared";
import { verifyWorkerToken } from "./auth.js";
import { getParams, handleRouteError, requiredString } from "../http.js";

export async function registerWorkerDashboardRoutes(app: FastifyInstance, db: DbClient) {
  app.get("/api/workers/:id/dashboard", async (request, reply) => {
    try {
      const params = getParams(request);
      const workerId = requiredString(params.id, "id");

      // Auth: require a valid worker/owner token
      const userId = await verifyWorkerToken(db, request.headers.authorization);
      if (!userId) {
        return reply.code(401).send({ error: "Not authenticated" });
      }

      const worker = await (db as any).worker.findUnique({
        where: { id: workerId },
        include: { user: true },
      });

      if (!worker) {
        return reply.code(404).send({ error: "Worker not found" });
      }

      // Ensure the token user matches the requested worker
      if (worker.userId !== userId && worker.user?.role !== "owner") {
        return reply.code(403).send({ error: "Forbidden" });
      }

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