import type { FastifyInstance } from "fastify";
import {
  countTurnsTaken,
  rankSuggestedWorkers,
  type TurnStatus,
  type WorkerRankingInput,
  type WorkerStatus,
} from "@nail/shared";
import type { DbClient } from "../db.js";
import { asObject, getParams, handleRouteError, optionalString, requiredString } from "../http.js";

type WorkSessionRecord = {
  id: string;
  businessDate: Date | string;
  status: "open" | "closed";
};

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
  startedAt: Date | string | null;
  endedAt?: Date | string | null;
  completedAt?: Date | string | null;
  customer?: CustomerRecord | null;
  checkin?: { customer?: CustomerRecord | null; notes?: string | null } | null;
  checkinId?: string | null;
  appointmentId?: string | null;
  workerId?: string | null;
};

type SaleItemRecord = {
  finalServiceCents?: number;
  tipCents?: number;
};

type CustomerRecord = {
  id: string;
  name?: string | null;
  phone?: string | null;
};

export async function registerTurnRoutes(app: FastifyInstance, db: DbClient) {
  app.get("/api/turns/dashboard", async (_request, reply) => {
    try {
      const session = await loadCurrentOpenSession(db);
      const workers = await loadDashboardWorkers(db, session?.id ?? null);
      const suggestions = rankSuggestedWorkers(workers.map(toRankingInput));
      const rankByWorker = new Map(suggestions.map((worker) => [worker.workerId, worker.suggestionRank]));

      return {
        scope: "session" as const,
        session: session
          ? {
              id: session.id,
              businessDate: new Date(session.businessDate).toISOString(),
              status: session.status,
            }
          : null,
        workers: workers.map((worker) => ({
          workerId: worker.id,
          name: worker.displayName,
          status: worker.currentStatus,
          turnsTakenSession: countTurnsTaken(worker.turns ?? []),
          lastTurnEndedAt: getLastTurnEndedAt(worker.turns ?? []),
          activeTurn: getActiveTurn(worker.turns ?? []),
          salesSessionCents: getSalesSessionCents(worker.saleItems ?? []),
          tipsSessionCents: getTipsSessionCents(worker.saleItems ?? []),
          // Compatibility aliases. Remove after client migration.
          turnsTakenToday: countTurnsTaken(worker.turns ?? []),
          salesTodayCents: getSalesSessionCents(worker.saleItems ?? []),
          tipsTodayCents: getTipsSessionCents(worker.saleItems ?? []),
          suggestionRank: rankByWorker.get(worker.id) ?? null,
        })),
      };
    } catch (error) {
      return handleRouteError(error, reply);
    }
  });

  app.post("/api/turns/suggest", async (_request, reply) => {
    try {
      const session = await loadCurrentOpenSession(db);
      const workers = await loadDashboardWorkers(db, session?.id ?? null);
      return { workers: rankSuggestedWorkers(workers.map(toRankingInput)) };
    } catch (error) {
      return handleRouteError(error, reply);
    }
  });

  app.post("/api/turns/assign", async (request, reply) => {
    try {
      const body = asObject(request.body);
      const result = await db.$transaction(async (tx) => {
        const checkinId = requiredString(body.checkinId, "checkinId");
        const checkins = (await tx.checkin.findMany({
          where: { id: checkinId },
          take: 1,
        })) as Array<{ sessionId?: string | null }>;
        const sessionId = checkins[0]?.sessionId ?? undefined;
        const turn = await tx.turn.create({
          data: {
            checkinId,
            sessionId,
            workerId: requiredString(body.workerId, "workerId"),
            turnType: optionalString(body.turnType, "turnType") ?? "manual",
            suggestedWorkerId: optionalString(body.suggestedWorkerId, "suggestedWorkerId"),
            ownerOverrideReason: optionalString(body.ownerOverrideReason, "ownerOverrideReason"),
            assignedByUserId: optionalString(body.assignedByUserId, "assignedByUserId"),
            status: "assigned",
          },
        });
        const checkin = await tx.checkin.update({
          where: { id: checkinId },
          data: { status: "assigned" },
        });

        return { turn, checkin };
      });

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
      const checkinId = optionalString(body.checkinId, "checkinId");

      const result = await db.$transaction(async (tx) => {
        const turn = await tx.turn.update({
          where: { id: turnId },
          data: { status: "in_service", startedAt: now },
        });
        const checkin = checkinId
          ? await tx.checkin.update({ where: { id: checkinId }, data: { status: "in_service" } })
          : null;

        return { turn, checkin };
      });

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
      const checkinId = optionalString(body.checkinId, "checkinId");

      const result = await db.$transaction(async (tx) => {
        const turn = await tx.turn.update({
          where: { id: turnId },
          data: { status: "completed", endedAt: now, completedAt: now },
        });
        const checkin = checkinId
          ? await tx.checkin.update({ where: { id: checkinId }, data: { status: "ready_for_checkout" } })
          : null;

        return { turn, checkin };
      });

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

      const result = await db.$transaction(async (tx) => {
        const turn = await tx.turn.update({
          where: { id: turnId },
          data: {
            status: "skipped",
            skippedAt: now,
            skippedReason: optionalString(body.skippedReason, "skippedReason"),
          },
        });
        return { turn };
      });

      return result;
    } catch (error) {
      return handleRouteError(error, reply);
    }
  });
}

async function loadCurrentOpenSession(db: DbClient): Promise<WorkSessionRecord | null> {
  const sessions = (await db.workSession.findMany({
    where: { status: "open" },
    orderBy: [{ openedAt: "desc" }],
    take: 1,
  })) as WorkSessionRecord[];
  return sessions[0] ?? null;
}

async function loadDashboardWorkers(db: DbClient, sessionId: string | null): Promise<WorkerRecord[]> {
  if (!sessionId) {
    const workers = await db.worker.findMany({
      where: { active: true },
      orderBy: [{ sortOrder: "asc" }, { displayName: "asc" }],
    });
    return (workers as WorkerRecord[]).map((worker) => ({
      ...worker,
      turns: [],
      saleItems: [],
    }));
  }

  const workers = await db.worker.findMany({
    where: { active: true },
    include: {
      turns: {
        where: {
          OR: [{ checkin: { sessionId } }, { sessionId }],
        },
        include: { customer: true, checkin: { include: { customer: true } } },
      },
      saleItems: {
        where: {
          status: "active",
          sale: {
            OR: [{ checkin: { sessionId } }, { sessionId }],
          },
        },
      },
    },
    orderBy: [{ sortOrder: "asc" }, { displayName: "asc" }],
  });

  return workers as WorkerRecord[];
}

function toRankingInput(worker: WorkerRecord): WorkerRankingInput {
  return {
    workerId: worker.id,
    name: worker.displayName,
    status: worker.currentStatus,
    turnsTakenToday: countTurnsTaken(worker.turns ?? []),
    lastTurnEndedAt: getLastTurnEndedAt(worker.turns ?? []),
    salesTodayCents: getSalesSessionCents(worker.saleItems ?? []),
    activeTurn: getActiveTurn(worker.turns ?? []),
  };
}

function getActiveTurn(turns: TurnRecord[]): TurnRecord | null {
  const active = turns.find((turn) => turn.status === "in_service" || turn.status === "assigned");
  if (!active) {
    return null;
  }

  const customer = active.customer ?? active.checkin?.customer ?? null;

  return {
    id: active.id,
    status: active.status,
    startedAt: active.startedAt,
    endedAt: active.endedAt,
    completedAt: active.completedAt,
    checkinId: active.checkinId,
    appointmentId: active.appointmentId,
    workerId: active.workerId,
    customer,
    checkin: active.checkin
      ? {
          notes: active.checkin.notes,
          customer,
        }
      : null,
  };
}

function getLastTurnEndedAt(turns: TurnRecord[]): Date | string | null {
  const completedTurns = turns
    .filter((turn) => turn.endedAt || turn.completedAt)
    .sort((left, right) => toTime(right.endedAt ?? right.completedAt) - toTime(left.endedAt ?? left.completedAt));

  return completedTurns[0]?.endedAt ?? completedTurns[0]?.completedAt ?? null;
}

function getSalesSessionCents(items: SaleItemRecord[]): number {
  return items.reduce((sum, item) => sum + (item.finalServiceCents ?? 0), 0);
}

function getTipsSessionCents(items: SaleItemRecord[]): number {
  return items.reduce((sum, item) => sum + (item.tipCents ?? 0), 0);
}

function getActionTime(body: Record<string, unknown>): Date {
  const requested = optionalString(body.actionAt, "actionAt");
  return requested ? new Date(requested) : new Date();
}

function toTime(value: Date | string | null | undefined): number {
  return value ? new Date(value).getTime() : 0;
}
