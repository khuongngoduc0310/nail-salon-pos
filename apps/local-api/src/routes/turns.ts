import type { FastifyInstance } from "fastify";
import {
  countEffectiveTurns,
  calculateTurnCount,
  rankSuggestedWorkers,
  type TurnStatus,
  type WorkerRankingInput,
  type WorkerStatus,
} from "@nail/shared";
import type { DbClient } from "../db.js";
import { HttpError, asObject, getParams, getQuery, handleRouteError, optionalString, requiredString } from "../http.js";
import { broadcast } from "../ws/events.js";

type WorkerRecord = {
  id: string;
  displayName: string;
  currentStatus: WorkerStatus;
  turns?: TurnRecord[];
  saleItems?: SaleItemRecord[];
};

type TurnRecord = {
  id: string;
  status: TurnStatus;
  turnCount?: number;
  startedAt: Date | string | null;
  endedAt?: Date | string | null;
  completedAt?: Date | string | null;
  customer?: unknown;
  checkinId?: string | null;
  appointmentId?: string | null;
  saleId?: string | null;
};

type SaleItemRecord = {
  finalServiceCents?: number;
  tipCents?: number;
};

export async function registerTurnRoutes(app: FastifyInstance, db: DbClient) {
  app.get("/api/turns/dashboard", async (request, reply) => {
    try {
      const query = getQuery(request);
      const currentSessionOnly = optionalString(query.currentSessionOnly, "currentSessionOnly") === "true";
      const currentSession = currentSessionOnly ? await getCurrentSession(db) : null;

      if (currentSessionOnly && !currentSession) {
        return { workers: [] };
      }

      const workers = await loadDashboardWorkers(db, currentSession?.id);
      const suggestionCandidates = currentSessionOnly
        ? workers.filter((worker) => worker.checkedIn)
        : workers;
      const suggestions = rankSuggestedWorkers(suggestionCandidates.map(toRankingInput));
      const rankByWorker = new Map(suggestions.map((worker) => [worker.workerId, worker.suggestionRank]));

      return {
        workers: workers.map((worker) => ({
          workerId: worker.id,
          name: worker.displayName,
          status: worker.currentStatus,
          turnsTakenToday: countEffectiveTurns(worker.turns ?? []),
          lastTurnEndedAt: getLastTurnEndedAt(worker.turns ?? []),
          activeTurn: getActiveTurn(worker.turns ?? []),
          salesTodayCents: getSalesTodayCents(worker.saleItems ?? []),
          tipsTodayCents: getTipsTodayCents(worker.saleItems ?? []),
          suggestionRank: rankByWorker.get(worker.id) ?? null,
          checkedIn: worker.checkedIn,
          turns: (worker.turns ?? []).map((t: any) => ({
            turnId: t.id,
            status: t.status,
            turnCount: t.turnCount ?? 1,
            customerName: t.customer?.name || "—",
            services: getTurnServices(t),
          })),
        })),
      };
    } catch (error) {
      return handleRouteError(error, reply);
    }
  });

  app.post("/api/turns/suggest", async (_request, reply) => {
    try {
      const workers = await loadDashboardWorkers(db);
      return { workers: rankSuggestedWorkers(workers.map(toRankingInput)) };
    } catch (error) {
      return handleRouteError(error, reply);
    }
  });

  app.post("/api/turns/assign", async (request, reply) => {
    try {
      const body = asObject(request.body);
      const result = await db.$transaction(async (tx) => {
        const workerId = requiredString(body.workerId, "workerId");
        const session = await getCurrentSession(tx);
        if (!session) {
          throw new HttpError(400, "No open session");
        }

        const worker: any = await tx.worker.findUnique({ where: { id: workerId } });
        if (!worker || worker.currentStatus === "in_service" || worker.currentStatus === "on_break") {
          throw new Error("Worker is not available for assignment");
        }

        const workerSession = await (tx as any).workerSession.findFirst({
          where: { workerId, sessionId: session.id, checkedOutAt: null },
        });
        if (!workerSession) {
          throw new Error("Worker must be clocked in before assignment");
        }

        // Determine turnCount based on service price vs salon threshold
        const turnCount = await resolveTurnCount(db, body);

        const turn = await tx.turn.create({
          data: {
            checkinId: requiredString(body.checkinId, "checkinId"),
            workerId,
            sessionId: session.id,
            turnCount,
            turnType: optionalString(body.turnType, "turnType") ?? "manual",
            suggestedWorkerId: optionalString(body.suggestedWorkerId, "suggestedWorkerId"),
            ownerOverrideReason: optionalString(body.ownerOverrideReason, "ownerOverrideReason"),
            assignedByUserId: optionalString(body.assignedByUserId, "assignedByUserId"),
            status: "assigned",
          },
        });
        const checkin = await tx.checkin.update({
          where: { id: requiredString(body.checkinId, "checkinId") },
          data: { status: "assigned" },
        });

        return { turn, checkin };
      });

      broadcast("turn:assigned", { result });
      return reply.code(201).send(result);
    } catch (error) {
      return handleRouteError(error, reply);
    }
  });

  app.post("/api/turns/:id/start", async (request, reply) => {
    try {
      const params = getParams(request);
      const body = asObject(request.body ?? {});
      const now = getActionTime(body);
      const turnId = requiredString(params.id, "id");
      const workerId = requiredString(body.workerId, "workerId");
      const checkinId = optionalString(body.checkinId, "checkinId");

      const result = await db.$transaction(async (tx) => {
        const turn = await tx.turn.update({
          where: { id: turnId },
          data: { status: "in_service", startedAt: now },
        });
        const worker = await tx.worker.update({
          where: { id: workerId },
          data: { currentStatus: "in_service" },
        });
        const checkin = checkinId
          ? await tx.checkin.update({ where: { id: checkinId }, data: { status: "in_service" } })
          : null;

        return { turn, worker, checkin };
      });

      broadcast("turn:started", { result });
      return result;
    } catch (error) {
      return handleRouteError(error, reply);
    }
  });

  app.post("/api/turns/:id/complete", async (request, reply) => {
    try {
      const params = getParams(request);
      const body = asObject(request.body ?? {});
      const now = getActionTime(body);
      const turnId = requiredString(params.id, "id");
      const workerId = requiredString(body.workerId, "workerId");
      const checkinId = optionalString(body.checkinId, "checkinId");

      const result = await db.$transaction(async (tx) => {
        const turn = await tx.turn.update({
          where: { id: turnId },
          data: { status: "completed", endedAt: now, completedAt: now },
        });
        const worker = await tx.worker.update({
          where: { id: workerId },
          data: { currentStatus: "available" },
        });
        const checkin = checkinId
          ? await tx.checkin.update({ where: { id: checkinId }, data: { status: "ready_for_checkout" } })
          : null;

        return { turn, worker, checkin };
      });

      broadcast("turn:completed", { result });
      return result;
    } catch (error) {
      return handleRouteError(error, reply);
    }
  });

  app.post("/api/turns/:id/skip", async (request, reply) => {
    try {
      const params = getParams(request);
      const body = asObject(request.body ?? {});
      const now = getActionTime(body);
      const turnId = requiredString(params.id, "id");
      const workerId = optionalString(body.workerId, "workerId");

      const result = await db.$transaction(async (tx) => {
        const turn = await tx.turn.update({
          where: { id: turnId },
          data: {
            status: "skipped",
            skippedAt: now,
            skippedReason: optionalString(body.skippedReason, "skippedReason"),
          },
        });
        const worker = workerId
          ? await tx.worker.update({ where: { id: workerId }, data: { currentStatus: "available" } })
          : null;

        return { turn, worker };
      });

      broadcast("turn:skipped", { result });
      return result;
    } catch (error) {
      return handleRouteError(error, reply);
    }
  });

  app.patch("/api/turns/:id", async (request, reply) => {
    try {
      const params = getParams(request);
      const body = asObject(request.body);
      const turnId = requiredString(params.id, "id");
      const turnCount = body.turnCount != null ? Number(body.turnCount) : undefined;
      const turn = await (db as any).turn.update({
        where: { id: turnId },
        data: turnCount != null ? { turnCount } : {},
      });
      broadcast("turn:count_updated", { turnId, turnCount });
      return turn;
    } catch (error) {
      return handleRouteError(error, reply);
    }
  });
}

/**
 * Resolves the turnCount for a new turn assignment.
 *
 * Reads the salon's threshold from settings and the service's turnCount override,
 * then uses calculateTurnCount from shared logic.
 *
 * If no serviceId is provided, defaults to 1 (normal turn).
 */
async function resolveTurnCount(db: DbClient, body: Record<string, unknown>): Promise<number> {
  try {
    const settings: any = await (db as any).salonSettings.findUnique({
      where: { id: "default" },
    });
    const threshold = settings?.turnCountThresholdCents ?? 3000;

    const serviceId = optionalString(body.serviceId, "serviceId");
    if (serviceId) {
      const service: any = await (db as any).service.findUnique({
        where: { id: serviceId },
        select: { priceCents: true, turnCount: true },
      });
      if (service) {
        return calculateTurnCount(service.priceCents, threshold, service.turnCount);
      }
    }

    // No service provided — default to a normal turn (1)
    return 1;
  } catch {
    // If settings lookup fails, default to normal turn
    return 1;
  }
}

async function loadDashboardWorkers(db: DbClient, sessionId?: string): Promise<(WorkerRecord & { checkedIn: boolean })[]> {
  const start = startOfToday();
  const end = endOfToday(start);
  const workers = await (db as any).worker.findMany({
    where: {
      active: true,
    },
    include: {
      turns: {
        where: sessionId ? { sessionId } : { createdAt: { gte: start, lt: end } },
        include: {
          customer: true,
          checkin: { include: { customer: true } },
          sale: { include: { items: { where: { status: "active" }, include: { service: true } } } },
        },
        orderBy: { createdAt: "asc" },
      },
      saleItems: {
        where: sessionId
          ? { sale: { sessionId }, status: "active" }
          : { createdAt: { gte: start, lt: end }, status: "active" },
      },
      workerSessions: sessionId
        ? { where: { sessionId } }
        : true,
    },
    orderBy: [{ sortOrder: "asc" }, { displayName: "asc" }],
  });

  return workers.map((w: any) => ({
    ...w,
    checkedIn: sessionId
      ? (w.workerSessions ?? []).some((session: any) => !session.checkedOutAt)
      : false,
  })) as (WorkerRecord & { checkedIn: boolean })[];
}

async function getCurrentSession(db: DbClient): Promise<{ id: string } | null> {
  try {
    const session = await (db as any).session.findFirst({
      where: { status: "open" },
      orderBy: { openedAt: "desc" },
    });
    return session && typeof session.id === "string" ? { id: session.id } : null;
  } catch {
    return null;
  }
}

function getTurnServices(turn: any): { serviceName: string; categoryName: string; turnCount: number; priceCents: number }[] {
  const items = turn.sale?.items || [];
  if (items.length === 0) {
    return [{ serviceName: "—", categoryName: "—", turnCount: turn.turnCount ?? 1, priceCents: 0 }];
  }
  return items.map((si: any) => ({
    serviceName: si.service?.name || si.serviceNameSnapshot || "—",
    categoryName: si.service?.category?.name || si.categoryNameSnapshot || "—",
    turnCount: si.service?.turnCount ?? turn.turnCount ?? 1,
    priceCents: si.priceCents,
  }));
}

function toRankingInput(worker: WorkerRecord): WorkerRankingInput {
  return {
    workerId: worker.id,
    name: worker.displayName,
    status: worker.currentStatus,
    turnsTakenToday: countEffectiveTurns(worker.turns ?? []),
    lastTurnEndedAt: getLastTurnEndedAt(worker.turns ?? []),
    salesTodayCents: getSalesTodayCents(worker.saleItems ?? []),
    activeTurn: getActiveTurn(worker.turns ?? []),
  };
}

function getActiveTurn(turns: TurnRecord[]): TurnRecord | null {
  return turns.find((turn) => turn.status === "in_service") ?? null;
}

function getLastTurnEndedAt(turns: TurnRecord[]): Date | string | null {
  const completedTurns = turns
    .filter((turn) => turn.endedAt || turn.completedAt)
    .sort((left, right) => toTime(right.endedAt ?? right.completedAt) - toTime(left.endedAt ?? left.completedAt));

  return completedTurns[0]?.endedAt ?? completedTurns[0]?.completedAt ?? null;
}

function getSalesTodayCents(items: SaleItemRecord[]): number {
  return items.reduce((sum, item) => sum + (item.finalServiceCents ?? 0), 0);
}

function getTipsTodayCents(items: SaleItemRecord[]): number {
  return items.reduce((sum, item) => sum + (item.tipCents ?? 0), 0);
}

function getActionTime(body: Record<string, unknown>): Date {
  const requested = optionalString(body.actionAt, "actionAt");
  return requested ? new Date(requested) : new Date();
}

function startOfToday(): Date {
  const date = new Date();
  date.setHours(0, 0, 0, 0);
  return date;
}

function endOfToday(start: Date): Date {
  const end = new Date(start);
  end.setDate(end.getDate() + 1);
  return end;
}

function toTime(value: Date | string | null | undefined): number {
  return value ? new Date(value).getTime() : 0;
}
