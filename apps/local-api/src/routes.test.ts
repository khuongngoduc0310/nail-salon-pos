import { describe, expect, it } from "vitest";
import { scryptSync } from "node:crypto";
import { MockTerminalAdapter } from "@nail/payment-terminal";
import { buildServer } from "./server.js";
import type { DbClient } from "./db.js";

type Call = {
  model: string;
  method: string;
  args?: unknown;
};

function createFakeDb() {
  const calls: Call[] = [];
  let id = 1;
  const nextId = () => `id-${id++}`;

  const makeModel = (model: string, rows: unknown[] = []) => ({
    findMany: async (args?: unknown) => {
      calls.push({ model, method: "findMany", args });
      return rows;
    },
    findUnique: async (args: unknown) => {
      calls.push({ model, method: "findUnique", args });
      return rows[0] ?? { id: "found" };
    },
    create: async (args: unknown) => {
      calls.push({ model, method: "create", args });
      return { id: nextId(), args };
    },
    update: async (args: unknown) => {
      calls.push({ model, method: "update", args });
      return { id: "updated", args };
    },
  });

  const db: DbClient = {
    serviceCategory: makeModel("serviceCategory"),
    service: makeModel("service"),
    user: { create: makeModel("user").create },
    worker: makeModel("worker"),
    customer: makeModel("customer"),
    appointment: makeModel("appointment"),
    checkin: makeModel("checkin"),
    workSession: makeModel("workSession"),
    workerSessionCheckin: makeModel("workerSessionCheckin"),
    turn: makeModel("turn"),
    sale: makeModel("sale"),
    saleItem: makeModel("saleItem"),
    payment: { create: makeModel("payment").create },
    discount: { create: makeModel("discount").create },
    $transaction: async <T>(callback: (tx: DbClient) => Promise<T>): Promise<T> => callback(db),
  } satisfies DbClient;

  return { db, calls };
}

function createFakeDbWithWorkers(workers: unknown[], sessions: unknown[] = []) {
  const calls: Call[] = [];
  let id = 1;
  const nextId = () => `id-${id++}`;

  const makeModel = (model: string, rows: unknown[] = []) => ({
    findMany: async (args?: unknown) => {
      calls.push({ model, method: "findMany", args });
      return rows;
    },
    findUnique: async (args: unknown) => {
      calls.push({ model, method: "findUnique", args });
      return rows[0] ?? { id: "found" };
    },
    create: async (args: unknown) => {
      calls.push({ model, method: "create", args });
      return { id: nextId(), args };
    },
    update: async (args: unknown) => {
      calls.push({ model, method: "update", args });
      return { id: "updated", args };
    },
  });

  const db: DbClient = {
    serviceCategory: makeModel("serviceCategory"),
    service: makeModel("service"),
    user: { create: makeModel("user").create },
    worker: makeModel("worker", workers),
    customer: makeModel("customer"),
    appointment: makeModel("appointment"),
    checkin: makeModel("checkin"),
    workSession: makeModel("workSession", sessions),
    workerSessionCheckin: makeModel("workerSessionCheckin"),
    turn: makeModel("turn"),
    sale: makeModel("sale"),
    saleItem: makeModel("saleItem"),
    payment: { create: makeModel("payment").create },
    discount: { create: makeModel("discount").create },
    $transaction: async <T>(callback: (tx: DbClient) => Promise<T>): Promise<T> => callback(db),
  };

  return { db, calls };
}

function createCheckoutFakeDb(input?: {
  sessions?: Array<Record<string, unknown>>;
  checkins?: Array<Record<string, unknown>>;
}) {
  const calls: Call[] = [];
  let id = 1;
  const sessions = [...(input?.sessions ?? [])];
  const checkins = [...(input?.checkins ?? [])];
  const state = {
    sale: {
      id: "sale-1",
      checkinId: "checkin-1" as string | null | undefined,
      sessionId: undefined as string | undefined,
      customerId: "customer-1",
      status: "open",
      totalCents: 0,
      amountPaidCents: 0,
      items: [] as Array<{
        id: string;
        workerId?: string;
        priceCents: number;
        discountCents: number;
        tipCents: number;
        status: string;
      }>,
      payments: [] as Array<{
        method: "cash" | "card" | "gift_card";
        amountCents: number;
        tipCents?: number;
        status: "approved" | "declined" | "cancelled" | "failed";
      }>,
    },
  };
  const nextId = (prefix: string) => `${prefix}-${id++}`;
  const updateSaleFromData = (data: Record<string, unknown>) => {
    Object.assign(state.sale, data);
    return { ...state.sale };
  };

  const db: DbClient = {
    serviceCategory: emptyModel("serviceCategory", calls),
    service: {
      ...emptyModel("service", calls),
      findUnique: async (args: unknown) => {
        calls.push({ model: "service", method: "findUnique", args });
        return {
          id: "service-1",
          name: "Classic Pedicure",
          priceCents: 12000,
          category: { name: "Pedicure" },
        };
      },
    },
    user: { create: emptyModel("user", calls).create },
    worker: {
      ...emptyModel("worker", calls),
      findUnique: async (args: unknown) => {
        calls.push({ model: "worker", method: "findUnique", args });
        return { id: "worker-1", commissionRate: 0.6 };
      },
    },
    customer: emptyModel("customer", calls),
    appointment: emptyModel("appointment", calls),
    checkin: {
      ...emptyModel("checkin", calls),
      findMany: async (args?: unknown) => {
        calls.push({ model: "checkin", method: "findMany", args });
        const where = ((args as { where?: Record<string, unknown> } | undefined)?.where ?? {}) as Record<string, unknown>;
        return checkins.filter((checkin) => (typeof where.id === "string" ? checkin.id === where.id : true));
      },
    },
    workSession: {
      ...emptyModel("workSession", calls),
      findMany: async (args?: unknown) => {
        calls.push({ model: "workSession", method: "findMany", args });
        const where = ((args as { where?: Record<string, unknown> } | undefined)?.where ?? {}) as Record<string, unknown>;
        return sessions.filter((session) => (typeof where.status === "string" ? session.status === where.status : true));
      },
    },
    workerSessionCheckin: emptyModel("workerSessionCheckin", calls),
    turn: emptyModel("turn", calls),
    sale: {
      findMany: async (args?: unknown) => {
        calls.push({ model: "sale", method: "findMany", args });
        return [{ ...state.sale }];
      },
      findUnique: async (args: unknown) => {
        calls.push({ model: "sale", method: "findUnique", args });
        return { ...state.sale };
      },
      create: async (args: unknown) => {
        calls.push({ model: "sale", method: "create", args });
        return { ...state.sale, args };
      },
      update: async (args: unknown) => {
        calls.push({ model: "sale", method: "update", args });
        const data = (args as { data: Record<string, unknown> }).data;
        return updateSaleFromData(data);
      },
    },
    saleItem: {
      findUnique: async (args: unknown) => {
        calls.push({ model: "saleItem", method: "findUnique", args });
        return state.sale.items[0] ?? null;
      },
      create: async (args: unknown) => {
        calls.push({ model: "saleItem", method: "create", args });
        const data = (args as { data: { priceCents: number; discountCents: number; tipCents: number } }).data;
        const item = { id: nextId("item"), status: "active", ...data };
        state.sale.items.push(item);
        return item;
      },
      update: async (args: unknown) => {
        calls.push({ model: "saleItem", method: "update", args });
        const where = (args as { where?: { id?: string } }).where;
        const data = (args as { data?: { tipCents?: number } }).data;
        if (where?.id && typeof data?.tipCents === "number") {
          const index = state.sale.items.findIndex((item) => item.id === where.id);
          if (index >= 0) state.sale.items[index] = { ...state.sale.items[index], tipCents: data.tipCents };
        }
        return { id: where?.id ?? "item-1", args };
      },
    },
    payment: {
      create: async (args: unknown) => {
        calls.push({ model: "payment", method: "create", args });
        const data = (args as {
          data: {
            method: "cash" | "card" | "gift_card";
            amountCents: number;
            tipCents?: number;
            status: "approved" | "declined" | "cancelled" | "failed";
          };
        }).data;
        const payment = { id: nextId("payment"), ...data };
        state.sale.payments.push(data);
        return payment;
      },
    },
    discount: { create: emptyModel("discount", calls).create },
    $transaction: async <T>(callback: (tx: DbClient) => Promise<T>): Promise<T> => callback(db),
  };

  return { db, calls, state };
}

function emptyModel(model: string, calls: Call[]) {
  return {
    findMany: async (args?: unknown) => {
      calls.push({ model, method: "findMany", args });
      return [];
    },
    findUnique: async (args: unknown) => {
      calls.push({ model, method: "findUnique", args });
      return null;
    },
    create: async (args: unknown) => {
      calls.push({ model, method: "create", args });
      return { id: `${model}-created`, args };
    },
    update: async (args: unknown) => {
      calls.push({ model, method: "update", args });
      return { id: `${model}-updated`, args };
    },
  };
}

function createSessionStateDb(input?: {
  sessions?: Array<Record<string, unknown>>;
  checkins?: Array<Record<string, unknown>>;
  workerSessionCheckins?: Array<Record<string, unknown>>;
  sales?: Array<Record<string, unknown>>;
  turns?: Array<Record<string, unknown>>;
}) {
  const calls: Call[] = [];
  let id = 1;
  const nextId = () => `id-${id++}`;
  const sessions = [...(input?.sessions ?? [])];
  const checkins = [...(input?.checkins ?? [])];
  const workerSessionCheckins = [...(input?.workerSessionCheckins ?? [])];
  const sales = [...(input?.sales ?? [])];
  const turns = [...(input?.turns ?? [])];

  const matchesWhere = (row: Record<string, unknown>, where: Record<string, unknown>): boolean => {
    if (typeof where.id === "string" && row.id !== where.id) return false;
    if (typeof where.sessionId === "string" && row.sessionId !== where.sessionId) return false;
    if (typeof where.workerId === "string" && row.workerId !== where.workerId) return false;
    if (typeof where.requestedWorkerId === "string" && row.requestedWorkerId !== where.requestedWorkerId) return false;
    if (typeof where.status === "string" && row.status !== where.status) return false;
    if (where.businessDate instanceof Date) {
      if (!(row.businessDate instanceof Date || typeof row.businessDate === "string")) return false;
      if (new Date(row.businessDate).getTime() !== where.businessDate.getTime()) return false;
    }
    const statusFilter = where.status as { in?: string[] } | undefined;
    if (statusFilter?.in && !statusFilter.in.includes(String(row.status))) return false;
    if (where.checkin && typeof where.checkin === "object") {
      const checkinFilter = where.checkin as { sessionId?: string };
      if (typeof checkinFilter.sessionId === "string") {
        const saleCheckin = checkins.find((checkin) => checkin.id === row.checkinId);
        if (!saleCheckin || saleCheckin.sessionId !== checkinFilter.sessionId) return false;
      }
    }
    const orClauses = Array.isArray(where.OR) ? (where.OR as Array<Record<string, unknown>>) : null;
    if (orClauses && orClauses.length > 0) {
      return orClauses.some((clause) => matchesWhere(row, clause));
    }
    return true;
  };

  const byWhere = (rows: Array<Record<string, unknown>>, where: Record<string, unknown> | undefined) => {
    if (!where) return rows;
    return rows.filter((row) => matchesWhere(row, where));
  };

  const db: DbClient = {
    serviceCategory: emptyModel("serviceCategory", calls),
    service: emptyModel("service", calls),
    user: { create: emptyModel("user", calls).create },
    worker: emptyModel("worker", calls),
    customer: {
      ...emptyModel("customer", calls),
      create: async (args: unknown) => {
        calls.push({ model: "customer", method: "create", args });
        return { id: nextId(), ...((args as { data?: Record<string, unknown> }).data ?? {}) };
      },
    },
    appointment: emptyModel("appointment", calls),
    checkin: {
      findMany: async (args?: unknown) => {
        calls.push({ model: "checkin", method: "findMany", args });
        const where = (args as { where?: Record<string, unknown> } | undefined)?.where;
        return byWhere(checkins, where).map((row) => ({ ...row }));
      },
      create: async (args: unknown) => {
        calls.push({ model: "checkin", method: "create", args });
        const data = ((args as { data?: Record<string, unknown> }).data ?? {}) as Record<string, unknown>;
        const created = { id: nextId(), status: "waiting", ...data };
        checkins.push(created);
        return created;
      },
      update: async (args: unknown) => {
        calls.push({ model: "checkin", method: "update", args });
        const where = ((args as { where?: Record<string, unknown> }).where ?? {}) as Record<string, unknown>;
        const data = ((args as { data?: Record<string, unknown> }).data ?? {}) as Record<string, unknown>;
        const index = checkins.findIndex((row) => row.id === where.id);
        if (index >= 0) checkins[index] = { ...checkins[index], ...data };
        return index >= 0 ? { ...checkins[index] } : { id: where.id ?? "missing", ...data };
      },
    },
    workSession: {
      findMany: async (args?: unknown) => {
        calls.push({ model: "workSession", method: "findMany", args });
        const parsed = (args as {
          where?: Record<string, unknown>;
          include?: Record<string, unknown>;
          take?: number;
          orderBy?: Array<Record<string, "asc" | "desc">>;
        } | undefined) ?? {};
        let rows = byWhere(sessions, parsed.where);
        if (Array.isArray(parsed.orderBy)) {
          rows = [...rows].sort((left, right) => {
            for (const order of parsed.orderBy ?? []) {
              const [field, direction] = Object.entries(order)[0] ?? [];
              if (!field || !direction) continue;
              const leftValue = left[field];
              const rightValue = right[field];
              if (leftValue === rightValue) continue;
              const leftTime = leftValue ? new Date(String(leftValue)).getTime() : Number.NEGATIVE_INFINITY;
              const rightTime = rightValue ? new Date(String(rightValue)).getTime() : Number.NEGATIVE_INFINITY;
              if (leftTime === rightTime) continue;
              return direction === "desc" ? rightTime - leftTime : leftTime - rightTime;
            }
            return 0;
          });
        }
        if (typeof parsed.take === "number") rows = rows.slice(0, parsed.take);
        if (parsed.include?.checkins) {
          return rows.map((row) => ({
            ...row,
            checkins: checkins
              .filter((checkin) => checkin.sessionId === row.id)
              .map((checkin) => ({ requestedWorkerId: checkin.requestedWorkerId ?? null })),
          }));
        }
        if (parsed.include?.workerCheckins) {
          return rows.map((row) => ({
            ...row,
            workerCheckins: workerSessionCheckins
              .filter((checkin) => checkin.sessionId === row.id)
              .sort((left, right) => {
                const leftTime = left.checkedInAt ? new Date(String(left.checkedInAt)).getTime() : 0;
                const rightTime = right.checkedInAt ? new Date(String(right.checkedInAt)).getTime() : 0;
                return leftTime - rightTime;
              })
              .map((checkin) => ({
                workerId: String(checkin.workerId),
                checkedInAt: checkin.checkedInAt ? String(checkin.checkedInAt) : undefined,
              })),
          }));
        }
        return rows.map((row) => ({ ...row }));
      },
      findUnique: async (args: unknown) => {
        calls.push({ model: "workSession", method: "findUnique", args });
        const where = ((args as { where?: Record<string, unknown> }).where ?? {}) as Record<string, unknown>;
        const found = sessions.find((row) => row.id === where.id);
        return found ? { ...found } : null;
      },
      create: async (args: unknown) => {
        calls.push({ model: "workSession", method: "create", args });
        const data = ((args as { data?: Record<string, unknown> }).data ?? {}) as Record<string, unknown>;
        const created = { id: nextId(), openedAt: new Date().toISOString(), status: "open", ...data };
        sessions.push(created);
        return created;
      },
      update: async (args: unknown) => {
        calls.push({ model: "workSession", method: "update", args });
        const where = ((args as { where?: Record<string, unknown> }).where ?? {}) as Record<string, unknown>;
        const data = ((args as { data?: Record<string, unknown> }).data ?? {}) as Record<string, unknown>;
        const index = sessions.findIndex((row) => row.id === where.id);
        if (index >= 0) sessions[index] = { ...sessions[index], ...data };
        return index >= 0 ? { ...sessions[index] } : { id: where.id ?? "missing", ...data };
      },
    },
    workerSessionCheckin: {
      findMany: async (args?: unknown) => {
        calls.push({ model: "workerSessionCheckin", method: "findMany", args });
        const where = (args as { where?: Record<string, unknown> } | undefined)?.where;
        return byWhere(workerSessionCheckins, where).map((row) => ({ ...row }));
      },
      create: async (args: unknown) => {
        calls.push({ model: "workerSessionCheckin", method: "create", args });
        const data = ((args as { data?: Record<string, unknown> }).data ?? {}) as Record<string, unknown>;
        const created = { id: nextId(), checkedInAt: new Date().toISOString(), ...data };
        workerSessionCheckins.push(created);
        return created;
      },
    },
    turn: {
      findMany: async (args?: unknown) => {
        calls.push({ model: "turn", method: "findMany", args });
        const where = ((args as { where?: Record<string, unknown> } | undefined)?.where ?? {}) as Record<string, unknown>;
        return byWhere(turns, where).map((turn) => ({ ...turn }));
      },
      create: emptyModel("turn", calls).create,
      update: emptyModel("turn", calls).update,
    },
    sale: {
      findMany: async (args?: unknown) => {
        calls.push({ model: "sale", method: "findMany", args });
        const where = ((args as { where?: Record<string, unknown> } | undefined)?.where ?? {}) as Record<string, unknown>;
        return byWhere(sales, where).map((sale) => ({ ...sale }));
      },
      findUnique: emptyModel("sale", calls).findUnique,
      create: emptyModel("sale", calls).create,
      update: emptyModel("sale", calls).update,
    },
    saleItem: emptyModel("saleItem", calls),
    payment: { create: emptyModel("payment", calls).create },
    discount: { create: emptyModel("discount", calls).create },
    $transaction: async <T>(callback: (tx: DbClient) => Promise<T>): Promise<T> => callback(db),
  } satisfies DbClient;

  return { db, calls, sessions, checkins, workerSessionCheckins, sales, turns };
}

describe("local API CRUD routes", () => {
  it("returns health without the database", async () => {
    const { db } = createFakeDb();
    const app = await buildServer({ db, logger: false });

    const response = await app.inject({ method: "GET", url: "/api/health" });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({ ok: true, service: "local-api" });
  });

  it("creates a service category", async () => {
    const { db, calls } = createFakeDb();
    const app = await buildServer({ db, logger: false });

    const response = await app.inject({
      method: "POST",
      url: "/api/service-categories",
      payload: { name: "Manicure", sortOrder: 1 },
    });

    expect(response.statusCode).toBe(201);
    expect(calls).toContainEqual({
      model: "serviceCategory",
      method: "create",
      args: { data: { name: "Manicure", sortOrder: 1, active: true } },
    });
  });

  it("soft-deletes services by deactivating them", async () => {
    const { db, calls } = createFakeDb();
    const app = await buildServer({ db, logger: false });

    const response = await app.inject({ method: "DELETE", url: "/api/services/service-1" });

    expect(response.statusCode).toBe(200);
    expect(calls).toContainEqual({
      model: "service",
      method: "update",
      args: { where: { id: "service-1" }, data: { active: false } },
    });
  });

  it("creates a worker with a user record inside a transaction", async () => {
    const { db, calls } = createFakeDb();
    const app = await buildServer({ db, logger: false });

    const response = await app.inject({
      method: "POST",
      url: "/api/workers",
      payload: { name: "Amy", email: "amy@example.com", commissionRate: 0.6, password: "1234" },
    });

    expect(response.statusCode).toBe(201);
    expect(calls[0]).toMatchObject({ model: "user", method: "create" });
    expect(calls[1]).toMatchObject({ model: "worker", method: "create" });
    const userCreate = calls[0]?.args as { data?: { passwordHash?: string; pinHash?: string } };
    expect(typeof userCreate.data?.passwordHash).toBe("string");
    expect(userCreate.data?.passwordHash).toContain(":");
    expect(userCreate.data?.pinHash).toBeUndefined();
  });

  it("authenticates a worker with password and returns private turns", async () => {
    const salt = "testsalt1234567890";
    const key = scryptSync("1234", salt, 64).toString("hex");
    const workerRecord = {
      id: "worker-1",
      displayName: "Amy",
      user: {
        passwordHash: `${salt}:${key}`,
      },
      turns: [{ id: "turn-1", status: "completed" }],
    };
    const { db } = createFakeDbWithWorkers([workerRecord]);
    const app = await buildServer({ db, logger: false });

    const ok = await app.inject({
      method: "POST",
      url: "/api/workers/login",
      payload: { workerId: "worker-1", password: "1234" },
    });
    expect(ok.statusCode).toBe(200);
    expect(ok.json()).toMatchObject({ workerId: "worker-1", displayName: "Amy" });
    expect(typeof (ok.json() as { token?: unknown }).token).toBe("string");
    expect(typeof (ok.json() as { expiresAt?: unknown }).expiresAt).toBe("string");

    const bad = await app.inject({
      method: "POST",
      url: "/api/workers/login",
      payload: { workerId: "worker-1", password: "wrong" },
    });
    expect(bad.statusCode).toBe(401);
  });

  it("rejects worker protected endpoints without a token", async () => {
    const { db } = createFakeDbWithWorkers([]);
    const app = await buildServer({ db, logger: false });
    const response = await app.inject({ method: "GET", url: "/api/worker/me/dashboard" });
    expect(response.statusCode).toBe(401);
  });

  it("opens a session and rejects opening a second one with OPEN_SESSION_EXISTS", async () => {
    const { db } = createSessionStateDb();
    const app = await buildServer({ db, logger: false });

    const first = await app.inject({ method: "POST", url: "/api/sessions/open", payload: {} });
    expect(first.statusCode).toBe(201);
    expect(first.json()).toMatchObject({ session: { status: "open" }, checkedInWorkerIds: [], openMode: "new" });

    const second = await app.inject({ method: "POST", url: "/api/sessions/open", payload: {} });
    expect(second.statusCode).toBe(409);
    expect(second.json()).toMatchObject({ errorCode: "OPEN_SESSION_EXISTS" });
  });

  it("requires continue/new decision when same-day closed session exists", async () => {
    const businessDate = new Date();
    businessDate.setHours(0, 0, 0, 0);
    const { db } = createSessionStateDb({
      sessions: [
        {
          id: "session-closed-1",
          status: "closed",
          businessDate: businessDate.toISOString(),
          openedAt: new Date(businessDate.getTime() + 9 * 60 * 60 * 1000).toISOString(),
          closedAt: new Date(businessDate.getTime() + 12 * 60 * 60 * 1000).toISOString(),
        },
      ],
      workerSessionCheckins: [{ id: "wsc-1", sessionId: "session-closed-1", workerId: "worker-1" }],
    });
    const app = await buildServer({ db, logger: false });

    const response = await app.inject({ method: "POST", url: "/api/sessions/open", payload: {} });
    expect(response.statusCode).toBe(409);
    expect(response.json()).toMatchObject({
      errorCode: "CONTINUE_DECISION_REQUIRED",
      candidateSession: { id: "session-closed-1", checkedInWorkerCount: 1 },
    });
  });

  it("continues the same-day closed session when mode=continue and source matches", async () => {
    const businessDate = new Date();
    businessDate.setHours(0, 0, 0, 0);
    const { db } = createSessionStateDb({
      sessions: [
        {
          id: "session-closed-1",
          status: "closed",
          businessDate: businessDate.toISOString(),
          openedAt: new Date(businessDate.getTime() + 9 * 60 * 60 * 1000).toISOString(),
          closedAt: new Date(businessDate.getTime() + 12 * 60 * 60 * 1000).toISOString(),
          closedByUserId: "owner-1",
        },
      ],
      workerSessionCheckins: [{ id: "wsc-1", sessionId: "session-closed-1", workerId: "worker-1" }],
    });
    const app = await buildServer({ db, logger: false });

    const response = await app.inject({
      method: "POST",
      url: "/api/sessions/open",
      payload: { mode: "continue", sourceSessionId: "session-closed-1" },
    });
    expect(response.statusCode).toBe(200);
    expect(response.json()).toMatchObject({
      session: { id: "session-closed-1", status: "open", closedAt: null },
      checkedInWorkerIds: ["worker-1"],
      openMode: "continue",
      reopenedFromClosed: true,
    });
  });

  it("starts a new same-day session when mode=new", async () => {
    const businessDate = new Date();
    businessDate.setHours(0, 0, 0, 0);
    const { db } = createSessionStateDb({
      sessions: [
        {
          id: "session-closed-1",
          status: "closed",
          businessDate: businessDate.toISOString(),
          openedAt: new Date(businessDate.getTime() + 9 * 60 * 60 * 1000).toISOString(),
          closedAt: new Date(businessDate.getTime() + 12 * 60 * 60 * 1000).toISOString(),
        },
      ],
    });
    const app = await buildServer({ db, logger: false });

    const response = await app.inject({
      method: "POST",
      url: "/api/sessions/open",
      payload: { mode: "new" },
    });
    expect(response.statusCode).toBe(201);
    expect(response.json()).toMatchObject({
      session: { status: "open" },
      checkedInWorkerIds: [],
      openMode: "new",
      reopenedFromClosed: false,
    });
    expect((response.json() as { session: { id: string } }).session.id).not.toBe("session-closed-1");
  });

  it("returns CANDIDATE_STALE when continue source does not match latest same-day closed session", async () => {
    const businessDate = new Date();
    businessDate.setHours(0, 0, 0, 0);
    const { db } = createSessionStateDb({
      sessions: [
        {
          id: "session-closed-2",
          status: "closed",
          businessDate: businessDate.toISOString(),
          openedAt: new Date(businessDate.getTime() + 13 * 60 * 60 * 1000).toISOString(),
          closedAt: new Date(businessDate.getTime() + 15 * 60 * 60 * 1000).toISOString(),
        },
      ],
    });
    const app = await buildServer({ db, logger: false });

    const response = await app.inject({
      method: "POST",
      url: "/api/sessions/open",
      payload: { mode: "continue", sourceSessionId: "session-closed-1" },
    });
    expect(response.statusCode).toBe(409);
    expect(response.json()).toMatchObject({
      errorCode: "CANDIDATE_STALE",
      candidateSession: { id: "session-closed-2" },
    });
  });

  it("requires open session for customer check-in and allows multiple requested-worker customer check-ins", async () => {
    const { db } = createSessionStateDb();
    const app = await buildServer({ db, logger: false });

    const noSession = await app.inject({
      method: "POST",
      url: "/api/checkins",
      payload: { requestedWorkerId: "worker-1", customer: { name: "Mary" } },
    });
    expect(noSession.statusCode).toBe(409);

    await app.inject({ method: "POST", url: "/api/sessions/open", payload: {} });

    const firstCheckin = await app.inject({
      method: "POST",
      url: "/api/checkins",
      payload: { requestedWorkerId: "worker-1", customer: { name: "Mary" } },
    });
    expect(firstCheckin.statusCode).toBe(201);

    const second = await app.inject({
      method: "POST",
      url: "/api/checkins",
      payload: { requestedWorkerId: "worker-1", customer: { name: "Jane" } },
    });
    expect(second.statusCode).toBe(201);
  });

  it("renews worker shift-check-in eligibility after starting a new same-day session", async () => {
    const businessDate = new Date();
    businessDate.setHours(0, 0, 0, 0);
    const { db } = createSessionStateDb({
      sessions: [
        {
          id: "session-closed-1",
          status: "closed",
          businessDate: businessDate.toISOString(),
          openedAt: new Date(businessDate.getTime() + 9 * 60 * 60 * 1000).toISOString(),
          closedAt: new Date(businessDate.getTime() + 12 * 60 * 60 * 1000).toISOString(),
        },
      ],
      workerSessionCheckins: [{ id: "old-wsc-1", sessionId: "session-closed-1", workerId: "worker-1" }],
    });
    const app = await buildServer({ db, logger: false });

    const openNew = await app.inject({
      method: "POST",
      url: "/api/sessions/open",
      payload: { mode: "new" },
    });
    expect(openNew.statusCode).toBe(201);

    const checkin = await app.inject({
      method: "POST",
      url: "/api/sessions/" + (openNew.json() as { session: { id: string } }).session.id + "/workers/checkin",
      payload: { workerId: "worker-1" },
    });
    expect(checkin.statusCode).toBe(201);
  });

  it("keeps worker shift-check-in exclusion when continuing the same closed session", async () => {
    const businessDate = new Date();
    businessDate.setHours(0, 0, 0, 0);
    const { db } = createSessionStateDb({
      sessions: [
        {
          id: "session-closed-1",
          status: "closed",
          businessDate: businessDate.toISOString(),
          openedAt: new Date(businessDate.getTime() + 9 * 60 * 60 * 1000).toISOString(),
          closedAt: new Date(businessDate.getTime() + 12 * 60 * 60 * 1000).toISOString(),
        },
      ],
      workerSessionCheckins: [{ id: "old-wsc-1", sessionId: "session-closed-1", workerId: "worker-1" }],
    });
    const app = await buildServer({ db, logger: false });

    const openContinue = await app.inject({
      method: "POST",
      url: "/api/sessions/open",
      payload: { mode: "continue", sourceSessionId: "session-closed-1" },
    });
    expect(openContinue.statusCode).toBe(200);

    const duplicate = await app.inject({
      method: "POST",
      url: "/api/sessions/session-closed-1/workers/checkin",
      payload: { workerId: "worker-1" },
    });
    expect(duplicate.statusCode).toBe(409);
    expect(duplicate.body).toContain("already checked in");
  });

  it("returns current session checked-in workers", async () => {
    const { db } = createSessionStateDb({
      sessions: [{ id: "session-1", status: "open", businessDate: "2026-05-14T00:00:00.000Z", openedAt: "2026-05-14T09:00:00.000Z" }],
      workerSessionCheckins: [
        { id: "wsc-1", sessionId: "session-1", workerId: "worker-1", checkedInAt: "2026-05-14T09:10:00.000Z" },
        { id: "wsc-2", sessionId: "session-1", workerId: "worker-2", checkedInAt: "2026-05-14T09:05:00.000Z" },
        { id: "wsc-3", sessionId: "session-1", workerId: "worker-1", checkedInAt: "2026-05-14T09:15:00.000Z" },
      ],
    });
    const app = await buildServer({ db, logger: false });

    const response = await app.inject({ method: "GET", url: "/api/sessions/current" });
    expect(response.statusCode).toBe(200);
    expect(response.json()).toMatchObject({
      session: { id: "session-1", status: "open" },
      checkedInWorkerIds: ["worker-2", "worker-1"],
      checkedInWorkers: [
        { workerId: "worker-2", checkedInAt: "2026-05-14T09:05:00.000Z" },
        { workerId: "worker-1", checkedInAt: "2026-05-14T09:10:00.000Z" },
      ],
    });
  });

  it("blocks closing a session with unresolved check-ins and sales", async () => {
    const { db } = createSessionStateDb({
      sessions: [{ id: "session-1", status: "open", businessDate: "2026-05-14T00:00:00.000Z", openedAt: "2026-05-14T09:00:00.000Z" }],
      checkins: [{ id: "checkin-1", sessionId: "session-1", requestedWorkerId: "worker-1", status: "waiting" }],
      sales: [{ id: "sale-1", checkinId: "checkin-1", status: "open" }],
    });
    const app = await buildServer({ db, logger: false });

    const response = await app.inject({ method: "POST", url: "/api/sessions/session-1/close", payload: {} });
    expect(response.statusCode).toBe(409);
    expect(response.json()).toMatchObject({
      blockers: { unresolvedCheckinsCount: 1, unresolvedSalesCount: 1 },
    });
  });

  it("closes a clean session and returns a report", async () => {
    const { db } = createSessionStateDb({
      sessions: [{ id: "session-1", status: "open", businessDate: "2026-05-14T00:00:00.000Z", openedAt: "2026-05-14T09:00:00.000Z" }],
      checkins: [{ id: "checkin-1", sessionId: "session-1", requestedWorkerId: "worker-1", status: "paid" }],
      turns: [{ id: "turn-1", checkinId: "checkin-1", status: "completed" }],
      sales: [
        {
          id: "sale-1",
          checkinId: "checkin-1",
          status: "paid",
          items: [{ finalServiceCents: 6500, tipCents: 1000, workerCommissionCents: 3900 }],
          payments: [{ amountCents: 7500 }],
        },
      ],
    });
    const app = await buildServer({ db, logger: false });

    const close = await app.inject({ method: "POST", url: "/api/sessions/session-1/close", payload: {} });
    expect(close.statusCode).toBe(200);
    expect(close.json()).toMatchObject({ session: { id: "session-1", status: "closed" } });

    const report = await app.inject({ method: "GET", url: "/api/sessions/session-1/report" });
    expect(report.statusCode).toBe(200);
    expect(report.json()).toMatchObject({
      summary: {
        checkinsCount: 1,
        resolvedCheckinsCount: 1,
        turnsCount: 1,
        completedTurnsCount: 1,
        salesCount: 1,
        paidSalesCount: 1,
        serviceCents: 6500,
        tipCents: 1000,
        commissionCents: 3900,
        collectedCents: 7500,
      },
    });
  });

  it("includes no-checkin sales linked by sale.sessionId in close blockers and report", async () => {
    const { db } = createSessionStateDb({
      sessions: [{ id: "session-1", status: "open", businessDate: "2026-05-14T00:00:00.000Z", openedAt: "2026-05-14T09:00:00.000Z" }],
      sales: [
        {
          id: "sale-1",
          sessionId: "session-1",
          status: "open",
          items: [{ finalServiceCents: 5000, tipCents: 700, workerCommissionCents: 3000 }],
          payments: [{ amountCents: 5700 }],
        },
      ],
      turns: [{ id: "turn-1", sessionId: "session-1", status: "completed" }],
    });
    const app = await buildServer({ db, logger: false });

    const blockedClose = await app.inject({ method: "POST", url: "/api/sessions/session-1/close", payload: {} });
    expect(blockedClose.statusCode).toBe(409);
    expect(blockedClose.json()).toMatchObject({
      blockers: { unresolvedSalesCount: 1 },
    });

    db.sale.findMany = async (args?: unknown) => {
      const where = ((args as { where?: Record<string, unknown> } | undefined)?.where ?? {}) as Record<string, unknown>;
      const statusFilter = where.status as { in?: string[] } | undefined;
      const isBlockedQuery = Boolean(statusFilter?.in);
      if (isBlockedQuery) {
        return [];
      }
      return [
        {
          id: "sale-1",
          sessionId: "session-1",
          status: "paid",
          items: [{ finalServiceCents: 5000, tipCents: 700, workerCommissionCents: 3000 }],
          payments: [{ amountCents: 5700 }],
        },
      ];
    };

    const close = await app.inject({ method: "POST", url: "/api/sessions/session-1/close", payload: {} });
    expect(close.statusCode).toBe(200);

    const report = await app.inject({ method: "GET", url: "/api/sessions/session-1/report" });
    expect(report.statusCode).toBe(200);
    expect(report.json()).toMatchObject({
      summary: {
        turnsCount: 1,
        salesCount: 1,
        serviceCents: 5000,
        tipCents: 700,
        commissionCents: 3000,
      },
    });
  });

  it("returns worker-scoped appointments with token auth", async () => {
    const salt = "testsalt1234567890";
    const key = scryptSync("1234", salt, 64).toString("hex");
    const workerRecord = {
      id: "worker-1",
      displayName: "Amy",
      active: true,
      currentStatus: "available",
      user: { passwordHash: `${salt}:${key}` },
      turns: [],
      saleItems: [],
    };
    const { db, calls } = createFakeDbWithWorkers([workerRecord]);
    const app = await buildServer({ db, logger: false });
    const login = await app.inject({
      method: "POST",
      url: "/api/workers/login",
      payload: { workerId: "worker-1", password: "1234" },
    });
    const token = (login.json() as { token: string }).token;
    const response = await app.inject({
      method: "GET",
      url: "/api/worker/me/appointments",
      headers: { authorization: `Bearer ${token}` },
    });

    expect(response.statusCode).toBe(200);
    expect(calls).toContainEqual({
      model: "appointment",
      method: "findMany",
      args: expect.objectContaining({
        where: expect.objectContaining({ workerId: "worker-1" }),
      }),
    });
  });

  it("returns worker earnings totals for authenticated worker", async () => {
    const salt = "testsalt1234567890";
    const key = scryptSync("1234", salt, 64).toString("hex");
    const workerRecord = {
      id: "worker-1",
      displayName: "Amy",
      active: true,
      currentStatus: "available",
      user: { passwordHash: `${salt}:${key}` },
      turns: [],
      saleItems: [
        { id: "si-1", finalServiceCents: 7000, workerCommissionCents: 4200, tipCents: 1000, workerTotalCents: 5200, createdAt: "2026-05-14T10:00:00.000Z" },
        { id: "si-2", finalServiceCents: 5000, workerCommissionCents: 3000, tipCents: 900, workerTotalCents: 3900, createdAt: "2026-05-14T11:00:00.000Z" },
      ],
    };
    const { db } = createFakeDbWithWorkers([workerRecord]);
    const app = await buildServer({ db, logger: false });
    const login = await app.inject({
      method: "POST",
      url: "/api/workers/login",
      payload: { workerId: "worker-1", password: "1234" },
    });
    const token = (login.json() as { token: string }).token;
    const response = await app.inject({
      method: "GET",
      url: "/api/worker/me/earnings",
      headers: { authorization: `Bearer ${token}` },
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toMatchObject({
      totals: {
        serviceCents: 12000,
        tipsCents: 1900,
        commissionCents: 7200,
        estimatedPayCents: 9100,
      },
    });
  });

  it("returns a private worker dashboard summary", async () => {
    const workerRecord = {
      id: "worker-1",
      displayName: "Amy",
      currentStatus: "in_service",
      active: true,
      turns: [
        {
          id: "turn-1",
          status: "in_service",
          startedAt: "2026-05-13T15:00:00.000Z",
          checkin: { notes: "Gel", customer: { id: "c-1", name: "Luna" } },
        },
        {
          id: "turn-2",
          status: "completed",
          startedAt: "2026-05-13T13:00:00.000Z",
          endedAt: "2026-05-13T14:00:00.000Z",
        },
      ],
      saleItems: [
        { finalServiceCents: 7000, tipCents: 1000, workerCommissionCents: 4200, workerTotalCents: 5200 },
        { finalServiceCents: 5000, tipCents: 800, workerCommissionCents: 3000, workerTotalCents: 4100 },
      ],
    };
    const { db } = createFakeDbWithWorkers([workerRecord]);
    const app = await buildServer({ db, logger: false });

    const response = await app.inject({
      method: "GET",
      url: "/api/workers/worker-1/dashboard",
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toMatchObject({
      range: { start: expect.any(String), end: expect.any(String) },
      worker: { id: "worker-1", displayName: "Amy", status: "in_service" },
      activeTurn: { id: "turn-1", status: "in_service" },
      turnsTodayCount: 2,
      salesTodayCents: 12000,
      tipsTodayCents: 1800,
      salesRangeCents: 12000,
      tipsRangeCents: 1800,
      commissionRangeCents: 7200,
      estimatedPayTodayCents: 9300,
      recentTurns: [{ id: "turn-1" }, { id: "turn-2" }],
    });
  });

  it("returns range-scoped dashboard data with per-turn commission", async () => {
    const salt = "testsalt1234567890";
    const key = scryptSync("1234", salt, 64).toString("hex");
    const workerRecord = {
      id: "worker-1",
      displayName: "Amy",
      currentStatus: "available",
      active: true,
      user: { passwordHash: `${salt}:${key}` },
      turns: [
        {
          id: "turn-1",
          status: "completed",
          startedAt: "2026-05-14T10:00:00.000Z",
          endedAt: "2026-05-14T11:00:00.000Z",
          sale: {
            id: "sale-1",
            items: [
              { workerId: "worker-1", serviceNameSnapshot: "Deluxe Pedicure", finalServiceCents: 6500, tipCents: 1200, workerCommissionCents: 3900 },
              { workerId: "worker-2", serviceNameSnapshot: "Basic Manicure", finalServiceCents: 3000, tipCents: 600, workerCommissionCents: 1800 },
            ],
          },
        },
      ],
      saleItems: [{ finalServiceCents: 6500, tipCents: 1200, workerCommissionCents: 3900, workerTotalCents: 5100 }],
    };
    const { db, calls } = createFakeDbWithWorkers([workerRecord]);
    const app = await buildServer({ db, logger: false });
    const login = await app.inject({
      method: "POST",
      url: "/api/workers/login",
      payload: { workerId: "worker-1", password: "1234" },
    });
    const token = (login.json() as { token: string }).token;

    const response = await app.inject({
      method: "GET",
      url: "/api/worker/me/dashboard?start=2026-05-14T00:00:00.000Z&end=2026-05-15T00:00:00.000Z",
      headers: { authorization: `Bearer ${token}` },
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toMatchObject({
      range: {
        start: "2026-05-14T00:00:00.000Z",
        end: "2026-05-15T00:00:00.000Z",
      },
      salesRangeCents: 6500,
      tipsRangeCents: 1200,
      commissionRangeCents: 3900,
      recentTurns: [
        {
          id: "turn-1",
          serviceTotalCents: 6500,
          tipTotalCents: 1200,
          commissionCents: 3900,
          turnTotalCents: 7700,
        },
      ],
    });

    expect(calls).toContainEqual({
      model: "worker",
      method: "findUnique",
      args: expect.objectContaining({
        include: expect.objectContaining({
          turns: expect.objectContaining({
            where: { createdAt: { gte: new Date("2026-05-14T00:00:00.000Z"), lt: new Date("2026-05-15T00:00:00.000Z") } },
          }),
          saleItems: expect.objectContaining({
            where: { createdAt: { gte: new Date("2026-05-14T00:00:00.000Z"), lt: new Date("2026-05-15T00:00:00.000Z") }, status: "active" },
          }),
        }),
      }),
    });
  });

  it("creates a check-in with an embedded new customer", async () => {
    const { db, calls } = createSessionStateDb();
    const app = await buildServer({ db, logger: false });
    await app.inject({ method: "POST", url: "/api/sessions/open", payload: {} });

    const response = await app.inject({
      method: "POST",
      url: "/api/checkins",
      payload: {
        customer: { name: "Mary", phone: "5551234567" },
        notes: "Walk-in pedicure",
      },
    });

    expect(response.statusCode).toBe(201);
    expect(calls).toContainEqual(expect.objectContaining({ model: "customer", method: "create" }));
    expect(calls).toContainEqual(expect.objectContaining({ model: "checkin", method: "create" }));
  });

  it("rejects invalid appointment time ranges", async () => {
    const { db } = createFakeDb();
    const app = await buildServer({ db, logger: false });

    const response = await app.inject({
      method: "POST",
      url: "/api/appointments",
      payload: {
        startTime: "2026-05-12T10:00:00.000Z",
        endTime: "2026-05-12T09:00:00.000Z",
      },
    });

    expect(response.statusCode).toBe(400);
    expect(response.json()).toEqual({ error: "endTime must be after startTime" });
  });

  it("assigns a worker by creating a turn and updating the check-in", async () => {
    const { db, calls } = createFakeDb();
    const app = await buildServer({ db, logger: false });

    const response = await app.inject({
      method: "POST",
      url: "/api/turns/assign",
      payload: {
        checkinId: "checkin-1",
        workerId: "worker-1",
        turnType: "walk_in",
        suggestedWorkerId: "worker-2",
      },
    });

    expect(response.statusCode).toBe(201);
    expect(calls).toContainEqual({
      model: "turn",
      method: "create",
      args: {
        data: {
          checkinId: "checkin-1",
          sessionId: undefined,
          workerId: "worker-1",
          turnType: "walk_in",
          suggestedWorkerId: "worker-2",
          ownerOverrideReason: undefined,
          assignedByUserId: undefined,
          status: "assigned",
        },
      },
    });
    expect(calls).toContainEqual({
      model: "checkin",
      method: "update",
      args: { where: { id: "checkin-1" }, data: { status: "assigned" } },
    });
  });

  it("starts service by updating the turn and check-in only", async () => {
    const { db, calls } = createFakeDb();
    const app = await buildServer({ db, logger: false });

    const response = await app.inject({
      method: "POST",
      url: "/api/turns/turn-1/start",
      payload: {
        workerId: "worker-1",
        checkinId: "checkin-1",
        actionAt: "2026-05-12T15:00:00.000Z",
      },
    });

    expect(response.statusCode).toBe(200);
    expect(calls).toContainEqual({
      model: "turn",
      method: "update",
      args: {
        where: { id: "turn-1" },
        data: { status: "in_service", startedAt: new Date("2026-05-12T15:00:00.000Z") },
      },
    });
    expect(calls).toContainEqual({
      model: "checkin",
      method: "update",
      args: { where: { id: "checkin-1" }, data: { status: "in_service" } },
    });
    expect(calls.some((call) => call.model === "worker" && call.method === "update")).toBe(false);
  });

  it("completes service and moves the check-in to ready for checkout without mutating worker status", async () => {
    const { db, calls } = createFakeDb();
    const app = await buildServer({ db, logger: false });

    const response = await app.inject({
      method: "POST",
      url: "/api/turns/turn-1/complete",
      payload: {
        workerId: "worker-1",
        checkinId: "checkin-1",
        actionAt: "2026-05-12T16:00:00.000Z",
      },
    });

    expect(response.statusCode).toBe(200);
    expect(calls).toContainEqual({
      model: "turn",
      method: "update",
      args: {
        where: { id: "turn-1" },
        data: {
          status: "completed",
          endedAt: new Date("2026-05-12T16:00:00.000Z"),
          completedAt: new Date("2026-05-12T16:00:00.000Z"),
        },
      },
    });
    expect(calls).toContainEqual({
      model: "checkin",
      method: "update",
      args: { where: { id: "checkin-1" }, data: { status: "ready_for_checkout" } },
    });
    expect(calls.some((call) => call.model === "worker" && call.method === "update")).toBe(false);
  });

  it("skips a turn without creating a started timestamp", async () => {
    const { db, calls } = createFakeDb();
    const app = await buildServer({ db, logger: false });

    const response = await app.inject({
      method: "POST",
      url: "/api/turns/turn-1/skip",
      payload: {
        workerId: "worker-1",
        skippedReason: "Customer requested another tech",
        actionAt: "2026-05-12T16:15:00.000Z",
      },
    });

    expect(response.statusCode).toBe(200);
    expect(calls).toContainEqual({
      model: "turn",
      method: "update",
      args: {
        where: { id: "turn-1" },
        data: {
          status: "skipped",
          skippedAt: new Date("2026-05-12T16:15:00.000Z"),
          skippedReason: "Customer requested another tech",
        },
      },
    });
  });

  it("returns a turn dashboard with suggestion ranks", async () => {
    const { db } = createFakeDbWithWorkers(
      [
        {
          id: "worker-1",
          displayName: "Amy",
          currentStatus: "available",
          turns: [{ id: "turn-1", status: "completed", startedAt: "2026-05-12T14:00:00.000Z", endedAt: "2026-05-12T15:00:00.000Z" }],
          saleItems: [{ finalServiceCents: 5000, tipCents: 1000 }],
        },
        {
          id: "worker-2",
          displayName: "Bella",
          currentStatus: "available",
          turns: [],
          saleItems: [],
        },
        {
          id: "worker-3",
          displayName: "Cindy",
          currentStatus: "in_service",
          turns: [
            {
              id: "turn-3",
              workerId: "worker-3",
              checkinId: "checkin-3",
              status: "in_service",
              startedAt: "2026-05-12T15:30:00.000Z",
              checkin: { notes: "Gel manicure", customer: { id: "customer-3", name: "Grace" } },
            },
          ],
          saleItems: [],
        },
      ],
      [{ id: "session-1", businessDate: "2026-05-14T00:00:00.000Z", status: "open", openedAt: "2026-05-14T08:00:00.000Z" }]
    );
    const app = await buildServer({ db, logger: false });

    const response = await app.inject({ method: "GET", url: "/api/turns/dashboard" });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toMatchObject({
      scope: "session",
      session: { id: "session-1", status: "open" },
      workers: [
        {
          workerId: "worker-1",
          turnsTakenSession: 1,
          turnsTakenToday: 1,
          salesSessionCents: 5000,
          tipsSessionCents: 1000,
          salesTodayCents: 5000,
          tipsTodayCents: 1000,
          suggestionRank: 2,
        },
        {
          workerId: "worker-2",
          turnsTakenSession: 0,
          turnsTakenToday: 0,
          suggestionRank: 1,
        },
        {
          workerId: "worker-3",
          turnsTakenSession: 1,
          turnsTakenToday: 1,
          activeTurn: {
            id: "turn-3",
            checkinId: "checkin-3",
            workerId: "worker-3",
            customer: { id: "customer-3", name: "Grace" },
          },
          suggestionRank: null,
        },
      ],
    });
  });

  it("returns zeroed session metrics when no session is open", async () => {
    const { db } = createFakeDbWithWorkers([
      {
        id: "worker-1",
        displayName: "Amy",
        currentStatus: "in_service",
        turns: [{ id: "turn-1", status: "completed", startedAt: "2026-05-12T14:00:00.000Z", endedAt: "2026-05-12T15:00:00.000Z" }],
        saleItems: [{ finalServiceCents: 5000, tipCents: 1000 }],
      },
    ]);
    const app = await buildServer({ db, logger: false });

    const response = await app.inject({ method: "GET", url: "/api/turns/dashboard" });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toMatchObject({
      scope: "session",
      session: null,
      workers: [
        {
          workerId: "worker-1",
          status: "in_service",
          turnsTakenSession: 0,
          salesSessionCents: 0,
          tipsSessionCents: 0,
        },
      ],
    });
  });

  it("creates a sale from a ready check-in", async () => {
    const { db, calls } = createCheckoutFakeDb();
    const app = await buildServer({ db, logger: false });

    const response = await app.inject({
      method: "POST",
      url: "/api/sales",
      payload: { checkinId: "checkin-1", customerId: "customer-1" },
    });

    expect(response.statusCode).toBe(201);
    expect(calls).toContainEqual({
      model: "sale",
      method: "create",
      args: {
        data: {
          sessionId: undefined,
          customerId: "customer-1",
          appointmentId: undefined,
          checkinId: "checkin-1",
          status: "open",
          subtotalCents: 0,
          discountTotalCents: 0,
          taxTotalCents: 0,
          tipTotalCents: 0,
          totalCents: 0,
          amountPaidCents: 0,
          createdByUserId: undefined,
        },
      },
    });
  });

  it("stamps current open session on empty sale creation", async () => {
    const { db, calls } = createCheckoutFakeDb({
      sessions: [{ id: "session-1", status: "open", openedAt: "2026-05-14T08:00:00.000Z" }],
    });
    const app = await buildServer({ db, logger: false });

    const response = await app.inject({
      method: "POST",
      url: "/api/sales",
      payload: {},
    });

    expect(response.statusCode).toBe(201);
    expect(calls).toContainEqual({
      model: "sale",
      method: "create",
      args: expect.objectContaining({
        data: expect.objectContaining({ sessionId: "session-1", checkinId: undefined }),
      }),
    });
  });

  it("returns sale detail for checkout state", async () => {
    const { db } = createCheckoutFakeDb();
    const app = await buildServer({ db, logger: false });

    const response = await app.inject({ method: "GET", url: "/api/sales/sale-1" });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toMatchObject({ id: "sale-1", checkinId: "checkin-1", status: "open" });
  });

  it("adds a service item with service and worker snapshots", async () => {
    const { db, calls } = createCheckoutFakeDb();
    const app = await buildServer({ db, logger: false });

    const response = await app.inject({
      method: "POST",
      url: "/api/sales/sale-1/items",
      payload: { serviceId: "service-1", workerId: "worker-1", discountCents: 2000, tipCents: 1000 },
    });

    expect(response.statusCode).toBe(201);
    expect(calls).toContainEqual({
      model: "saleItem",
      method: "create",
      args: {
        data: {
          saleId: "sale-1",
          serviceId: "service-1",
          workerId: "worker-1",
          serviceNameSnapshot: "Classic Pedicure",
          categoryNameSnapshot: "Pedicure",
          priceCents: 12000,
          discountCents: 2000,
          finalServiceCents: 10000,
          commissionRateSnapshot: 0.6,
          workerCommissionCents: 6000,
          tipCents: 1000,
          workerTotalCents: 7000,
          businessCents: 4000,
        },
      },
    });
  });

  it("records cash payment and updates paid amount", async () => {
    const { db, state } = createCheckoutFakeDb();
    state.sale.items.push({ id: "item-1", priceCents: 12000, discountCents: 0, tipCents: 0, status: "active" });
    const app = await buildServer({ db, logger: false });

    const response = await app.inject({
      method: "POST",
      url: "/api/sales/sale-1/payments/cash",
      payload: { amountCents: 4000 },
    });

    expect(response.statusCode).toBe(201);
    expect(state.sale.amountPaidCents).toBe(4000);
  });

  it("supports split payment and completes a fully paid sale", async () => {
    const { db, state } = createCheckoutFakeDb();
    state.sale.items.push({ id: "item-1", priceCents: 12000, discountCents: 0, tipCents: 0, status: "active" });
    const app = await buildServer({ db, logger: false, terminal: new MockTerminalAdapter("approved") });

    await app.inject({ method: "POST", url: "/api/sales/sale-1/payments/gift-card", payload: { amountCents: 2000 } });
    await app.inject({ method: "POST", url: "/api/sales/sale-1/payments/cash", payload: { amountCents: 4000 } });
    await app.inject({
      method: "POST",
      url: "/api/sales/sale-1/payments/card/start",
      payload: { amountCents: 6000, tipCents: 0, idempotencyKey: "split-card" },
    });
    const complete = await app.inject({ method: "POST", url: "/api/sales/sale-1/complete" });

    expect(complete.statusCode).toBe(200);
    expect(state.sale.status).toBe("paid");
    expect(state.sale.amountPaidCents).toBe(13080);
  });

  it("keeps sale unpaid when mock card declines", async () => {
    const { db, state } = createCheckoutFakeDb();
    state.sale.items.push({ id: "item-1", priceCents: 12000, discountCents: 0, tipCents: 0, status: "active" });
    const app = await buildServer({ db, logger: false, terminal: new MockTerminalAdapter("declined") });

    const response = await app.inject({
      method: "POST",
      url: "/api/sales/sale-1/payments/card/start",
      payload: { amountCents: 12000, tipCents: 0, idempotencyKey: "decline-card" },
    });

    expect(response.statusCode).toBe(201);
    expect(state.sale.status).toBe("open");
    expect(state.sale.amountPaidCents).toBe(0);
  });

  it("rejects underpaid sale completion", async () => {
    const { db, state } = createCheckoutFakeDb();
    state.sale.items.push({ id: "item-1", priceCents: 12000, discountCents: 0, tipCents: 0, status: "active" });
    state.sale.payments.push({ method: "cash", amountCents: 4000, status: "approved" });
    const app = await buildServer({ db, logger: false });

    const response = await app.inject({ method: "POST", url: "/api/sales/sale-1/complete" });

    expect(response.statusCode).toBe(400);
    expect(response.json()).toMatchObject({ error: "sale is underpaid", balanceDueCents: 8000 });
  });

  it("increments one completed turn per worker involved in the sale", async () => {
    const { db, calls, state } = createCheckoutFakeDb();
    state.sale.items.push(
      { id: "item-1", workerId: "worker-1", priceCents: 7000, discountCents: 0, tipCents: 0, status: "active" },
      { id: "item-2", workerId: "worker-2", priceCents: 5000, discountCents: 0, tipCents: 0, status: "active" }
    );
    const app = await buildServer({ db, logger: false });

    await app.inject({
      method: "POST",
      url: "/api/sales/sale-1/payments/cash",
      payload: { amountCents: 12000 },
    });
    const complete = await app.inject({ method: "POST", url: "/api/sales/sale-1/complete" });

    expect(complete.statusCode).toBe(200);
    const turnCreates = calls.filter((call) => call.model === "turn" && call.method === "create");
    expect(turnCreates).toHaveLength(2);
    expect(turnCreates.map((call) => (call.args as { data: { workerId: string } }).data.workerId).sort()).toEqual([
      "worker-1",
      "worker-2",
    ]);
  });

  it("carries sale session id to completed turns for no-checkin flow", async () => {
    const { db, calls, state } = createCheckoutFakeDb();
    state.sale.checkinId = null;
    state.sale.sessionId = "session-1";
    state.sale.items.push(
      { id: "item-1", workerId: "worker-1", priceCents: 7000, discountCents: 0, tipCents: 0, status: "active" },
      { id: "item-2", workerId: "worker-2", priceCents: 5000, discountCents: 0, tipCents: 0, status: "active" }
    );
    const app = await buildServer({ db, logger: false });

    await app.inject({
      method: "POST",
      url: "/api/sales/sale-1/payments/cash",
      payload: { amountCents: 12000 },
    });
    const complete = await app.inject({ method: "POST", url: "/api/sales/sale-1/complete" });

    expect(complete.statusCode).toBe(200);
    const turnCreates = calls.filter((call) => call.model === "turn" && call.method === "create");
    expect(turnCreates).toHaveLength(2);
    expect(
      turnCreates.every((call) => (call.args as { data: { sessionId?: string } }).data.sessionId === "session-1")
    ).toBe(true);
  });

  it("rejects tip distribution when there is no approved Clover tip", async () => {
    const { db, state } = createCheckoutFakeDb();
    state.sale.items.push({ id: "item-1", priceCents: 12000, discountCents: 0, tipCents: 0, status: "active" });
    const app = await buildServer({ db, logger: false });

    const response = await app.inject({
      method: "POST",
      url: "/api/sales/sale-1/tip-distribution",
      payload: { items: [{ itemId: "item-1", tipCents: 1080 }] },
    });

    expect(response.statusCode).toBe(400);
    expect(response.body).toContain("cannot set tip distribution without approved Clover tip");
  });

  it("accepts tip distribution only when submitted total matches Clover tip", async () => {
    const { db, state } = createCheckoutFakeDb();
    state.sale.items.push(
      { id: "item-1", priceCents: 7000, discountCents: 0, tipCents: 0, status: "active" },
      { id: "item-2", priceCents: 5000, discountCents: 0, tipCents: 0, status: "active" }
    );
    const app = await buildServer({ db, logger: false, terminal: new MockTerminalAdapter("approved") });

    await app.inject({
      method: "POST",
      url: "/api/sales/sale-1/payments/card/start",
      payload: { amountCents: 12000, idempotencyKey: "tip-dist-card" },
    });

    const bad = await app.inject({
      method: "POST",
      url: "/api/sales/sale-1/tip-distribution",
      payload: { items: [{ itemId: "item-1", tipCents: 400 }, { itemId: "item-2", tipCents: 500 }] },
    });
    expect(bad.statusCode).toBe(400);
    expect(bad.body).toContain("tip distribution must equal approved Clover tip total");

    const ok = await app.inject({
      method: "POST",
      url: "/api/sales/sale-1/tip-distribution",
      payload: { items: [{ itemId: "item-1", tipCents: 1260 }, { itemId: "item-2", tipCents: 900 }] },
    });
    expect(ok.statusCode).toBe(200);
    expect(state.sale.totalCents).toBe(14160);
    expect(state.sale.amountPaidCents).toBe(14160);
  });
});
