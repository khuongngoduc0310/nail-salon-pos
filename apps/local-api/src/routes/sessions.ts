import type { FastifyInstance } from "fastify";
import type { DbClient } from "../db.js";
import {
  asObject,
  getParams,
  handleRouteError,
  optionalInteger,
  requiredInteger,
  requiredString,
} from "../http.js";

export async function registerSessionRoutes(app: FastifyInstance, db: DbClient) {
  // Get current open session
  app.get("/api/sessions/current", async (_request, reply) => {
    try {
      const session = await (db as any).session.findFirst({
        where: { status: "open" },
        orderBy: { openedAt: "desc" },
      });
      return session ?? null;
    } catch (error) {
      return handleRouteError(error, reply);
    }
  });

  // Open a new session
  app.post("/api/sessions/open", async (request, reply) => {
    try {
      const body = asObject(request.body);

      // Close any existing open session first
      await (db as any).session.updateMany({
        where: { status: "open" },
        data: { status: "closed", closedAt: new Date() },
      });

      const session = await (db as any).session.create({
        data: {
          openingCashCents: optionalInteger(body.openingCashCents, "openingCashCents") ?? 0,
          openedByUserId: body.openedByUserId ?? null,
          status: "open",
        },
      });

      return reply.code(201).send(session);
    } catch (error) {
      return handleRouteError(error, reply);
    }
  });

  // Close the current session
  app.post("/api/sessions/:id/close", async (request, reply) => {
    try {
      const body = asObject(request.body);
      const params = getParams(request);
      const closingCashCents = requiredInteger(body.closingCashCents, "closingCashCents");

      const session = await (db as any).session.update({
        where: { id: params.id },
        data: {
          status: "closed",
          closedAt: new Date(),
          closingCashCents,
          closedByUserId: body.closedByUserId ?? null,
        },
      });

      // Gather session summary
      const sales = await (db as any).sale.findMany({
        where: { sessionId: session.id, status: "paid" },
        include: { payments: true },
      });

      const totalSalesCents = sales.reduce((sum: number, s: any) => sum + (s.totalCents || 0), 0);
      const cashCents = sales.flatMap((s: any) => s.payments || [])
        .filter((p: any) => p.method === "cash" && p.status === "approved")
        .reduce((sum: number, p: any) => sum + (p.amountCents || 0), 0);
      const cardCents = sales.flatMap((s: any) => s.payments || [])
        .filter((p: any) => p.method === "card" && p.status === "approved")
        .reduce((sum: number, p: any) => sum + (p.amountCents || 0), 0);
      const giftCardCents = sales.flatMap((s: any) => s.payments || [])
        .filter((p: any) => p.method === "gift_card" && p.status === "approved")
        .reduce((sum: number, p: any) => sum + (p.amountCents || 0), 0);

      return {
        session,
        summary: {
          totalSalesCents,
          cashCents,
          cardCents,
          giftCardCents,
          saleCount: sales.length,
        },
      };
    } catch (error) {
      return handleRouteError(error, reply);
    }
  });

  // Worker check-in for current session
  app.post("/api/sessions/current/worker-checkin", async (request, reply) => {
    try {
      const body = asObject(request.body);
      const workerId = requiredString(body.workerId, "workerId");

      const session = await (db as any).session.findFirst({
        where: { status: "open" },
        orderBy: { openedAt: "desc" },
      });
      if (!session) {
        return reply.code(400).send({ error: "No open session" });
      }

      // Upsert: if already exists for this session, return it; otherwise create
      const ws = await (db as any).workerSession.upsert({
        where: {
          workerId_sessionId: { workerId, sessionId: session.id },
        },
        update: {},
        create: { workerId, sessionId: session.id },
      });

      return reply.code(201).send(ws);
    } catch (error) {
      return handleRouteError(error, reply);
    }
  });

  // Get checked-in workers for current session
  app.get("/api/sessions/current/workers", async (_request, reply) => {
    try {
      const session = await (db as any).session.findFirst({
        where: { status: "open" },
        orderBy: { openedAt: "desc" },
      });
      if (!session) {
        return [];
      }

      const workerSessions = await (db as any).workerSession.findMany({
        where: { sessionId: session.id },
        include: { worker: { include: { user: true } } },
        orderBy: { checkedInAt: "asc" },
      });

      return workerSessions.map((ws: any) => ({
        id: ws.id,
        workerId: ws.workerId,
        name: ws.worker?.displayName || ws.worker?.user?.name || "Worker",
        checkedInAt: ws.checkedInAt,
      }));
    } catch (error) {
      return handleRouteError(error, reply);
    }
  });

  // List past sessions
  app.get("/api/sessions", async (_request, reply) => {
    try {
      const sessions = await (db as any).session.findMany({
        orderBy: { openedAt: "desc" },
        take: 30,
      });
      return sessions;
    } catch (error) {
      return handleRouteError(error, reply);
    }
  });
}