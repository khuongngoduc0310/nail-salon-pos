export type TurnStatus = "assigned" | "in_service" | "completed" | "skipped" | "cancelled";
export type WorkerStatus = "available" | "in_service" | "on_break" | "off_today" | "appointment_only";

export type TurnForCounting = {
  status: TurnStatus;
  startedAt: Date | string | null;
  turnCount?: number;
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
  checkedIn?: boolean;
};

export type SuggestedWorker = WorkerRankingInput & {
  suggestionRank: number;
};

export type TurnLifecycleActionResult = {
  turn: unknown;
  worker?: unknown;
  checkin?: unknown;
};

// ─── Tunable constants ──────────────────────────────────────────────

/** Default turnCount for a normal service (counts as a rotation slot). */
export const DEFAULT_TURN_COUNT = 1;

/** Turn count for free/minor services (worker keeps position in rotation). */
export const ZERO_TURN_COUNT = 0;

// ─── Turn counting helpers ──────────────────────────────────────────

/**
 * A turn counts once service has started. Skipped turns count only when they
 * had already started; assigned-only and cancelled turns do not consume a turn.
 */
export function turnCountsAsTaken(turn: TurnForCounting): boolean {
  if (!turn.startedAt) return false;
  return turn.status === "in_service" || turn.status === "completed" || turn.status === "skipped";
}

/**
 * Counts the raw number of started turns (each turn = 1, ignoring turnCount).
 */
export function countTurnsTaken(turns: TurnForCounting[]): number {
  return turns.filter(turnCountsAsTaken).length;
}

/**
 * Sums the turnCount values across all started turns.
 * Kept for backwards compatibility — may be used by reports etc.
 */
export function sumTurnCounts(turns: TurnForCounting[]): number {
  return turns
    .filter(turnCountsAsTaken)
    .reduce((sum, t) => sum + (t.turnCount ?? DEFAULT_TURN_COUNT), 0);
}

/**
 * Counts only "effective" turns — active turns where turnCount > 0.
 * A turn with turnCount = 0 (free/minor service) does NOT increment the count.
 * Includes only turns that have started.
 * This is the number shown on the dashboard as "turnsTakenToday".
 */
export function countEffectiveTurns(turns: TurnForCounting[]): number {
  return turns
    .filter(turnCountsAsTaken)
    .filter((t) => (t.turnCount ?? DEFAULT_TURN_COUNT) > 0)
    .length;
}

/**
 * Determines the turnCount for a turn based on service price and salon threshold.
 *
 * @param priceCents - The price of the service in cents
 * @param thresholdCents - The salon's turn count threshold (services below this price get turnCount = 0)
 * @param serviceTurnCount - Optional explicit override from the Service model (owner-set)
 * @returns 0 if price is below threshold and no explicit override, otherwise serviceTurnCount ?? 1
 */
export function calculateTurnCount(
  priceCents: number,
  thresholdCents: number,
  serviceTurnCount?: number | null,
): number {
  // If the service has an explicit turnCount override set by the owner, use it
  if (serviceTurnCount != null) {
    return serviceTurnCount;
  }

  // Default behaviour: services priced below the threshold are "free" turns (0)
  // Services at or above the threshold count as 1 turn
  return priceCents < thresholdCents ? ZERO_TURN_COUNT : DEFAULT_TURN_COUNT;
}

// ─── Worker ranking (round-robin) ───────────────────────────────────

/**
 * Ranks available, clocked-in workers in round-robin order.
 *
 * Round-robin logic: available workers first, then fewest turns, then the
 * worker whose last turn ended longest ago, then lower sales, then name.
 *
 * Secondary sort: by name (alphabetical) for stable ordering.
 */
export function rankSuggestedWorkers(workers: WorkerRankingInput[]): SuggestedWorker[] {
  return [...workers]
    .filter(
      (worker) =>
        worker.checkedIn !== false &&
        worker.status !== "off_today" &&
        worker.status !== "on_break" &&
        worker.status !== "in_service",
    )
    .sort((left, right) => {
      const leftStatusRank = statusRank(left.status);
      const rightStatusRank = statusRank(right.status);
      if (leftStatusRank !== rightStatusRank) {
        return leftStatusRank - rightStatusRank;
      }

      if (left.turnsTakenToday !== right.turnsTakenToday) {
        return left.turnsTakenToday - right.turnsTakenToday;
      }

      const leftTime = timestampOrNever(left.lastTurnEndedAt);
      const rightTime = timestampOrNever(right.lastTurnEndedAt);
      if (leftTime !== rightTime) {
        return leftTime - rightTime;
      }

      if (left.salesTodayCents !== right.salesTodayCents) {
        return left.salesTodayCents - right.salesTodayCents;
      }

      return left.name.localeCompare(right.name);
    })
    .map((worker, index) => ({
      ...worker,
      suggestionRank: index + 1,
    }));
}

// ─── Internal helpers ────────────────────────────────────────────────

/**
 * Converts a Date/string/null to a numeric timestamp.
 * null (never had a turn today) returns -1 → highest priority → sorts first in round-robin.
 */
function timestampOrNever(value: Date | string | null): number {
  if (!value) {
    return -1; // never had a turn → highest priority (sorts before any real timestamp)
  }
  return new Date(value).getTime();
}

function statusRank(status: WorkerStatus): number {
  return status === "available" ? 0 : 1;
}
