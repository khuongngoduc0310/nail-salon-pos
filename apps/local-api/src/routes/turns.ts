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
  customer?: unknown;
  checkinId?: string | null;
  appointmentId?: string | null;
};

type SaleItemRecord = {
  finalServiceCents?: number;
  tipCents?: number;
};

export async function registerTurnRoutes(app: FastifyInstance, db: DbClient) {
  app.get("/api/turns/dashboard", async (_request, reply) => {
    try {
      const workers = await loadDashboardWorkers(db);
      const suggestions = rankSuggestedWorkers(workers.map(toRankingInput));
      const rankByWorker = new Map(suggestions.map((worker) => [worker.workerId, worker.suggestionRank]));

      return {
        workers: workers.map((worker) => ({
          workerId: worker.id,
          name: worker.displayName,
          status: worker.currentStatus,
          turnsTakenToday: countTurnsTaken(worker.turns ?? []),
          lastTurnEndedAt: getLastTurnEndedAt(worker.turns ?? []),
          activeTurn: getActiveTurn(worker.turns ?? []),
          salesTodayCents: getSalesTodayCents(worker.saleItems ?? []),
          tipsTodayCents: getTipsTodayCents(worker.saleItems ?? []),
          suggestionRank: rankByWorker.get(worker.id) ?? null,
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
        const turn = await tx.turn.create({
          data: {
            checkinId: requiredString(body.checkinId, "checkinId"),
            workerId: requiredString(body.workerId, "workerId"),
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

      return result;
    } catch (error) {
      return handleRouteError(error, reply);
    }
  });
}

async function loadDashboardWorkers(db: DbClient): Promise<WorkerRecord[]> {
  const start = startOfToday();
  const end = endOfToday(start);
  const workers = await db.worker.findMany({
    where: { active: true },
    include: {
      turns: {
        where: { createdAt: { gte: start, lt: end } },
        include: { customer: true },
      },
      saleItems: {
        where: { createdAt: { gte: start, lt: end }, status: "active" },
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
