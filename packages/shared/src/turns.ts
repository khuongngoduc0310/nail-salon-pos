export type TurnStatus = "assigned" | "in_service" | "completed" | "skipped" | "cancelled";
export type WorkerStatus = "available" | "in_service" | "on_break" | "off_today" | "appointment_only";

export type TurnForCounting = {
  status: TurnStatus;
  startedAt: Date | string | null;
};

export type TurnDashboardWorker = {
  workerId: string;
  name: string;
  status: WorkerStatus;
  turnsTakenToday: number;
  lastTurnEndedAt: Date | string | null;
  activeTurn: unknown | null;
  salesTodayCents: number;
  tipsTodayCents: number;
  suggestionRank: number | null;
};

export type WorkerRankingInput = {
  workerId: string;
  name: string;
  status: WorkerStatus;
  turnsTakenToday: number;
  lastTurnEndedAt: Date | string | null;
  salesTodayCents: number;
  activeTurn?: unknown | null;
};

export type SuggestedWorker = WorkerRankingInput & {
  suggestionRank: number;
};

export type TurnLifecycleActionResult = {
  turn: unknown;
  worker?: unknown;
  checkin?: unknown;
};

export function turnCountsAsTaken(turn: TurnForCounting): boolean {
  return turn.startedAt !== null;
}

export function countTurnsTaken(turns: TurnForCounting[]): number {
  return turns.filter(turnCountsAsTaken).length;
}

export function rankSuggestedWorkers(workers: WorkerRankingInput[]): SuggestedWorker[] {
  return [...workers]
    .filter((worker) => worker.status !== "off_today" && worker.status !== "on_break" && worker.status !== "in_service")
    .sort((left, right) => {
      const statusDifference = statusRank(left.status) - statusRank(right.status);
      if (statusDifference !== 0) {
        return statusDifference;
      }

      const turnDifference = left.turnsTakenToday - right.turnsTakenToday;
      if (turnDifference !== 0) {
        return turnDifference;
      }

      const lastTurnDifference = timestampOrOldest(left.lastTurnEndedAt) - timestampOrOldest(right.lastTurnEndedAt);
      if (lastTurnDifference !== 0) {
        return lastTurnDifference;
      }

      const salesDifference = left.salesTodayCents - right.salesTodayCents;
      if (salesDifference !== 0) {
        return salesDifference;
      }

      return left.name.localeCompare(right.name);
    })
    .map((worker, index) => ({
      ...worker,
      suggestionRank: index + 1,
    }));
}

function statusRank(status: WorkerStatus): number {
  return status === "available" ? 0 : 1;
}

function timestampOrOldest(value: Date | string | null): number {
  if (!value) {
    return Number.NEGATIVE_INFINITY;
  }

  return new Date(value).getTime();
}
