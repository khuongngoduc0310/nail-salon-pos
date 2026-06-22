import type { FastifyInstance } from "fastify";
import type { DbClient } from "../db.js";
<<<<<<< HEAD
import {
  asObject,
  getParams,
  handleRouteError,
  optionalInteger,
  requiredInteger,
  requiredString,
} from "../http.js";

function serializeWorkerSession(ws: any) {
  return {
    id: ws.id,
    workerId: ws.workerId,
    name: ws.worker?.displayName || ws.worker?.user?.name || "Worker",
    checkedInAt: ws.checkedInAt,
    checkedOutAt: ws.checkedOutAt ?? null,
  };
}

export async function registerSessionRoutes(app: FastifyInstance, db: DbClient) {
  // Get current open session
  app.get("/api/sessions/current", async (_request, reply) => {
    try {
      const session = await (db as any).session.findFirst({
        where: { status: "open" },
        orderBy: { openedAt: "desc" },
      });
      return session ?? null;
=======
import { asObject, getParams, handleRouteError, optionalString, requiredString } from "../http.js";

type WorkSessionRecord = {
  id: string;
  businessDate: Date | string;
  status: string;
  openedAt: Date | string;
  closedAt?: Date | string | null;
  workerCheckins?: Array<{ workerId: string; checkedInAt?: Date | string }>;
};

type CheckinRecord = {
  id: string;
  status: string;
};

type TurnRecord = {
  id: string;
  status: string;
};

type SaleItemRecord = {
  finalServiceCents?: number;
  tipCents?: number;
  workerCommissionCents?: number;
};

type PaymentRecord = {
  amountCents?: number;
};

type SaleRecord = {
  id: string;
  status: string;
  items?: SaleItemRecord[];
  payments?: PaymentRecord[];
};

const unresolvedCheckinStatuses = new Set(["waiting", "assigned", "in_service", "ready_for_checkout"]);
const unresolvedSaleStatuses = new Set(["draft", "open", "partially_paid"]);

export async function registerSessionRoutes(app: FastifyInstance, db: DbClient) {
  app.get("/api/sessions/current", async (_request, reply) => {
    try {
      const sessions = (await db.workSession.findMany({
        where: { status: "open" },
        include: { workerCheckins: { select: { workerId: true, checkedInAt: true }, orderBy: [{ checkedInAt: "asc" }] } },
        orderBy: [{ openedAt: "desc" }],
        take: 1,
      })) as WorkSessionRecord[];

      const session = sessions[0] ?? null;
      const checkedInWorkers = session ? serializeCheckedInWorkers(session.workerCheckins ?? []) : [];
      return {
        session: session ? serializeSession(session) : null,
        checkedInWorkerIds: checkedInWorkers.map((worker) => worker.workerId),
        checkedInWorkers,
      };
>>>>>>> bdf0b2066dfcb2e3e613cb86c08bdfaba329da34
    } catch (error) {
      return handleRouteError(error, reply);
    }
  });

<<<<<<< HEAD
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
=======
  app.post("/api/sessions/open", async (_request, reply) => {
    try {
      const body = asObject(_request.body ?? {});
      const mode = optionalString(body.mode, "mode");
      const sourceSessionId = optionalString(body.sourceSessionId, "sourceSessionId");
      if (mode && mode !== "continue" && mode !== "new") {
        return reply.code(400).send({ error: "mode must be continue or new", errorCode: "INVALID_OPEN_MODE" });
      }

      const existing = (await db.workSession.findMany({
        where: { status: "open" },
        include: { workerCheckins: { select: { workerId: true, checkedInAt: true }, orderBy: [{ checkedInAt: "asc" }] } },
        orderBy: [{ openedAt: "desc" }],
        take: 1,
      })) as WorkSessionRecord[];
      if (existing.length > 0) {
        const active = existing[0];
        const checkedInWorkers = serializeCheckedInWorkers(active.workerCheckins ?? []);
        return reply.code(409).send({
          error: "a work session is already open",
          errorCode: "OPEN_SESSION_EXISTS",
          session: serializeSession(active),
          checkedInWorkerIds: checkedInWorkers.map((worker) => worker.workerId),
          checkedInWorkers,
        });
      }

      const businessDate = startOfBusinessDay(new Date());
      const closedToday = (await db.workSession.findMany({
        where: { status: "closed", businessDate },
        include: { workerCheckins: { select: { workerId: true, checkedInAt: true }, orderBy: [{ checkedInAt: "asc" }] } },
        orderBy: [{ closedAt: "desc" }, { openedAt: "desc" }],
        take: 1,
      })) as WorkSessionRecord[];
      const candidate = closedToday[0] ?? null;

      if (candidate && !mode) {
        return reply.code(409).send({
          error: "closed session exists for this business date",
          errorCode: "CONTINUE_DECISION_REQUIRED",
          candidateSession: serializeSessionCandidate(candidate),
        });
      }

      if (mode === "continue") {
        if (!sourceSessionId) {
          return reply.code(400).send({ error: "sourceSessionId is required for continue mode", errorCode: "SOURCE_SESSION_REQUIRED" });
        }
        if (!candidate || candidate.id !== sourceSessionId) {
          return reply.code(409).send({
            error: "continue candidate is stale",
            errorCode: "CANDIDATE_STALE",
            candidateSession: candidate ? serializeSessionCandidate(candidate) : null,
          });
        }

        const reopened = (await db.workSession.update({
          where: { id: candidate.id },
          data: {
            status: "open",
            closedAt: null,
            closedByUserId: null,
          },
        })) as WorkSessionRecord;
        const checkedInWorkers = serializeCheckedInWorkers(candidate.workerCheckins ?? []);

        return {
          session: serializeSession(reopened),
          checkedInWorkerIds: checkedInWorkers.map((worker) => worker.workerId),
          checkedInWorkers,
          openMode: "continue",
          reopenedFromClosed: true,
        };
      }

      const created = (await db.workSession.create({
        data: {
          businessDate,
          status: "open",
        },
      })) as WorkSessionRecord;

      return reply.code(201).send({
        session: serializeSession(created),
        checkedInWorkerIds: [],
        checkedInWorkers: [],
        openMode: "new",
        reopenedFromClosed: false,
      });
>>>>>>> bdf0b2066dfcb2e3e613cb86c08bdfaba329da34
    } catch (error) {
      return handleRouteError(error, reply);
    }
  });

<<<<<<< HEAD
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
=======
  app.post("/api/sessions/:id/close", async (request, reply) => {
    try {
      const params = getParams(request);
      const sessionId = requiredString(params.id, "id");
      const session = (await db.workSession.findUnique({ where: { id: sessionId } })) as WorkSessionRecord | null;
      if (!session) {
        return reply.code(404).send({ error: "session not found" });
      }
      if (session.status !== "open") {
        return reply.code(400).send({ error: "session is not open" });
      }

      const unresolvedCheckins = (await db.checkin.findMany({
        where: {
          sessionId,
          status: { in: [...unresolvedCheckinStatuses] },
        },
      })) as CheckinRecord[];
      const unresolvedSales = (await db.sale.findMany({
        where: {
          status: { in: [...unresolvedSaleStatuses] },
          OR: [{ checkin: { sessionId } }, { sessionId }],
        },
      })) as SaleRecord[];

      if (unresolvedCheckins.length > 0 || unresolvedSales.length > 0) {
        return reply.code(409).send({
          error: "cannot close session with unresolved work",
          blockers: {
            unresolvedCheckinsCount: unresolvedCheckins.length,
            unresolvedSalesCount: unresolvedSales.length,
          },
        });
      }

      const closed = (await db.workSession.update({
        where: { id: sessionId },
        data: { status: "closed", closedAt: new Date() },
      })) as WorkSessionRecord;

      return {
        session: serializeSession(closed),
        blockers: {
          unresolvedCheckinsCount: 0,
          unresolvedSalesCount: 0,
>>>>>>> bdf0b2066dfcb2e3e613cb86c08bdfaba329da34
        },
      };
    } catch (error) {
      return handleRouteError(error, reply);
    }
  });

<<<<<<< HEAD
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

      // Upsert: if already exists for this session, reopen it by clearing checkedOutAt.
      const ws = await (db as any).workerSession.upsert({
        where: {
          workerId_sessionId: { workerId, sessionId: session.id },
        },
        update: { checkedOutAt: null },
        create: { workerId, sessionId: session.id },
        include: { worker: { include: { user: true } } },
      });

      return reply.code(201).send(serializeWorkerSession(ws));
    } catch (error) {
      return handleRouteError(error, reply);
    }
  });

  // Worker clock-out from current session
  app.post("/api/sessions/current/worker-clockout", async (request, reply) => {
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

      const ws = await (db as any).workerSession.findFirst({
        where: { workerId, sessionId: session.id },
      });
      if (!ws) {
        return reply.code(404).send({ error: "Worker not checked in for this session" });
      }
      if (ws.checkedOutAt) {
        return reply.code(400).send({ error: "Worker already clocked out" });
      }

      const activeTurn = await (db as any).turn.findMany({
        where: {
          workerId,
          sessionId: session.id,
          status: { in: ["assigned", "in_service"] },
        },
        take: 1,
      });
      if (activeTurn.length > 0) {
        return reply.code(400).send({ error: "Cannot clock out worker with active assigned or in-service work" });
      }

      const updated = await (db as any).workerSession.update({
        where: { id: ws.id },
        data: { checkedOutAt: new Date() },
        include: { worker: { include: { user: true } } },
      });

      return reply.code(200).send(serializeWorkerSession(updated));
=======
  app.post("/api/sessions/:id/workers/checkin", async (request, reply) => {
    try {
      const params = getParams(request);
      const body = asObject(request.body ?? {});
      const sessionId = requiredString(params.id, "id");
      const workerId = requiredString(body.workerId, "workerId");
      const notes = optionalString(body.notes, "notes");

      const session = (await db.workSession.findUnique({ where: { id: sessionId } })) as WorkSessionRecord | null;
      if (!session) {
        return reply.code(404).send({ error: "session not found" });
      }
      if (session.status !== "open") {
        return reply.code(409).send({ error: "session is not open" });
      }

      const duplicate = (await db.workerSessionCheckin.findMany({
        where: { sessionId, workerId },
        take: 1,
      })) as Array<{ id: string }>;
      if (duplicate.length > 0) {
        return reply.code(409).send({ error: "worker already checked in for this session" });
      }

      const created = await db.workerSessionCheckin.create({
        data: {
          sessionId,
          workerId,
          notes,
        },
      });

      return reply.code(201).send(created);
>>>>>>> bdf0b2066dfcb2e3e613cb86c08bdfaba329da34
    } catch (error) {
      return handleRouteError(error, reply);
    }
  });

<<<<<<< HEAD
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

      return workerSessions.map(serializeWorkerSession);
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
=======
  app.get("/api/sessions/:id/report", async (request, reply) => {
    try {
      const params = getParams(request);
      const sessionId = requiredString(params.id, "id");
      const session = (await db.workSession.findUnique({ where: { id: sessionId } })) as WorkSessionRecord | null;
      if (!session) {
        return reply.code(404).send({ error: "session not found" });
      }

      const checkins = (await db.checkin.findMany({ where: { sessionId } })) as CheckinRecord[];
      const turns = (await db.turn.findMany({
        where: { OR: [{ checkin: { sessionId } }, { sessionId }] },
      })) as TurnRecord[];
      const sales = (await db.sale.findMany({
        where: { OR: [{ checkin: { sessionId } }, { sessionId }] },
        include: {
          items: { where: { status: "active" } },
          payments: { where: { status: "approved" } },
        },
      })) as SaleRecord[];

      const serviceCents = sales.reduce(
        (sum, sale) => sum + (sale.items ?? []).reduce((itemSum, item) => itemSum + (item.finalServiceCents ?? 0), 0),
        0
      );
      const tipCents = sales.reduce(
        (sum, sale) => sum + (sale.items ?? []).reduce((itemSum, item) => itemSum + (item.tipCents ?? 0), 0),
        0
      );
      const commissionCents = sales.reduce(
        (sum, sale) =>
          sum + (sale.items ?? []).reduce((itemSum, item) => itemSum + (item.workerCommissionCents ?? 0), 0),
        0
      );
      const collectedCents = sales.reduce(
        (sum, sale) => sum + (sale.payments ?? []).reduce((paymentSum, payment) => paymentSum + (payment.amountCents ?? 0), 0),
        0
      );

      return {
        session: serializeSession(session),
        summary: {
          checkinsCount: checkins.length,
          resolvedCheckinsCount: checkins.filter((checkin) => !unresolvedCheckinStatuses.has(checkin.status)).length,
          turnsCount: turns.length,
          completedTurnsCount: turns.filter((turn) => turn.status === "completed").length,
          salesCount: sales.length,
          paidSalesCount: sales.filter((sale) => sale.status === "paid").length,
          serviceCents,
          tipCents,
          commissionCents,
          collectedCents,
        },
      };
>>>>>>> bdf0b2066dfcb2e3e613cb86c08bdfaba329da34
    } catch (error) {
      return handleRouteError(error, reply);
    }
  });
}
<<<<<<< HEAD
=======

function startOfBusinessDay(date: Date): Date {
  const next = new Date(date);
  next.setHours(0, 0, 0, 0);
  return next;
}

function serializeSession(session: WorkSessionRecord) {
  return {
    id: session.id,
    businessDate: new Date(session.businessDate).toISOString(),
    status: session.status,
    openedAt: new Date(session.openedAt).toISOString(),
    closedAt: session.closedAt ? new Date(session.closedAt).toISOString() : null,
  };
}

function checkedInWorkerIds(checkins: Array<{ workerId: string; checkedInAt?: Date | string }>): string[] {
  return serializeCheckedInWorkers(checkins).map((checkin) => checkin.workerId);
}

function serializeCheckedInWorkers(checkins: Array<{ workerId: string; checkedInAt?: Date | string }>) {
  const seen = new Set<string>();
  const workers: Array<{ workerId: string; checkedInAt: string | null }> = [];
  for (const checkin of checkins) {
    const workerId = checkin.workerId;
    if (!workerId || seen.has(workerId)) continue;
    seen.add(workerId);
    workers.push({
      workerId,
      checkedInAt: checkin.checkedInAt ? new Date(checkin.checkedInAt).toISOString() : null,
    });
  }
  return workers;
}

function serializeSessionCandidate(session: WorkSessionRecord) {
  return {
    ...serializeSession(session),
    checkedInWorkerCount: checkedInWorkerIds(session.workerCheckins ?? []).length,
  };
}
>>>>>>> bdf0b2066dfcb2e3e613cb86c08bdfaba329da34
