import { describe, expect, it } from "vitest";
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
    findFirst: async (args?: unknown) => {
      calls.push({ model, method: "findFirst", args });
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
    updateMany: async (args: unknown) => {
      calls.push({ model, method: "updateMany", args });
      return { count: rows.length };
    },
    upsert: async (args: unknown) => {
      calls.push({ model, method: "upsert", args });
      return rows[0] ?? { id: nextId(), args };
    },
  });

  const db = {
    serviceCategory: makeModel("serviceCategory"),
    service: makeModel("service"),
    user: makeModel("user"),
    worker: makeModel("worker"),
    customer: makeModel("customer"),
    appointment: makeModel("appointment"),
    checkin: makeModel("checkin"),
    turn: makeModel("turn"),
    sale: makeModel("sale"),
    saleItem: makeModel("saleItem"),
    payment: makeModel("payment"),
    discount: makeModel("discount"),
    refund: makeModel("refund"),
    session: makeModel("session"),
    workerSession: makeModel("workerSession"),
    $transaction: async <T>(callback: (tx: DbClient) => Promise<T>): Promise<T> => callback(db),
  } as unknown as DbClient;

  return { db, calls };
}

function createFakeDbWithWorkers(workers: unknown[]) {
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
    findFirst: async (args?: unknown) => {
      calls.push({ model, method: "findFirst", args });
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
    updateMany: async (args: unknown) => {
      calls.push({ model, method: "updateMany", args });
      return { count: rows.length };
    },
    upsert: async (args: unknown) => {
      calls.push({ model, method: "upsert", args });
      return rows[0] ?? { id: nextId(), args };
    },
  });

  const db = {
    serviceCategory: makeModel("serviceCategory"),
    service: makeModel("service"),
    user: makeModel("user"),
    worker: makeModel("worker", workers),
    customer: makeModel("customer"),
    appointment: makeModel("appointment"),
    checkin: makeModel("checkin"),
    turn: makeModel("turn"),
    sale: makeModel("sale"),
    saleItem: makeModel("saleItem"),
    payment: makeModel("payment"),
    discount: makeModel("discount"),
    refund: makeModel("refund"),
    session: makeModel("session"),
    workerSession: makeModel("workerSession"),
    $transaction: async <T>(callback: (tx: DbClient) => Promise<T>): Promise<T> => callback(db),
  } as unknown as DbClient;

  return { db, calls };
}

function createCheckoutFakeDb() {
  const calls: Call[] = [];
  let id = 1;
  const state = {
    sale: {
      id: "sale-1",
      checkinId: "checkin-1",
      status: "open",
      totalCents: 0,
      amountPaidCents: 0,
      items: [] as Array<{ id: string; priceCents: number; discountCents: number; tipCents: number; status: string }>,
      payments: [] as Array<{ method: "cash" | "card" | "gift_card"; amountCents: number; status: "approved" | "declined" | "cancelled" | "failed" }>,
    },
  };
  const nextId = (prefix: string) => `${prefix}-${id++}`;
  const updateSaleFromData = (data: Record<string, unknown>) => {
    Object.assign(state.sale, data);
    return { ...state.sale };
  };

  const db = {
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
    user: emptyModel("user", calls),
    worker: {
      ...emptyModel("worker", calls),
      findUnique: async (args: unknown) => {
        calls.push({ model: "worker", method: "findUnique", args });
        return { id: "worker-1", commissionRate: 0.6 };
      },
    },
    customer: emptyModel("customer", calls),
    appointment: emptyModel("appointment", calls),
    checkin: emptyModel("checkin", calls),
    turn: emptyModel("turn", calls),
    sale: {
      findUnique: async (args: unknown) => {
        calls.push({ model: "sale", method: "findUnique", args });
        const includeItems = (args as { include?: { items?: { where?: { status?: string } } } }).include?.items;
        const items = includeItems?.where?.status
          ? state.sale.items.filter((item) => item.status === includeItems.where?.status)
          : state.sale.items;
        return { ...state.sale, items };
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
      findMany: async (args?: unknown) => {
        calls.push({ model: "saleItem", method: "findMany", args });
        return state.sale.items;
      },
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
        const id = (args as { where?: { id?: string }; data?: { status?: string } }).where?.id;
        const item = state.sale.items.find((saleItem) => saleItem.id === id) ?? state.sale.items[0];
        if (item && (args as { data?: { status?: string } }).data?.status) {
          item.status = (args as { data: { status: string } }).data.status;
        }
        return item ?? { id: "item-1", args };
      },
    },
    payment: {
      findMany: async (args?: unknown) => {
        calls.push({ model: "payment", method: "findMany", args });
        return [];
      },
      create: async (args: unknown) => {
        calls.push({ model: "payment", method: "create", args });
        const data = (args as {
          data: { method: "cash" | "card" | "gift_card"; amountCents: number; status: "approved" | "declined" | "cancelled" | "failed" };
        }).data;
        const payment = { id: nextId("payment"), ...data };
        state.sale.payments.push(data);
        return payment;
      },
    },
    discount: emptyModel("discount", calls),
    refund: emptyModel("refund", calls),
    session: emptyModel("session", calls),
    workerSession: {
      ...emptyModel("workerSession", calls),
      findFirst: async (args?: unknown) => {
        calls.push({ model: "workerSession", method: "findFirst", args });
        return { id: "worker-session-1" };
      },
    },
    $transaction: async <T>(callback: (tx: DbClient) => Promise<T>): Promise<T> => callback(db),
  } as unknown as DbClient;

  return { db, calls, state };
}

function createWorkerSessionFakeDb(options?: {
  checkedOutAt?: string | Date | null;
  activeTurns?: unknown[];
}) {
  const calls: Call[] = [];
  const session = { id: "session-1", status: "open", openedAt: new Date("2026-05-12T09:00:00.000Z") };
  const workerSession = {
    id: "worker-session-1",
    workerId: "worker-1",
    sessionId: session.id,
    checkedInAt: new Date("2026-05-12T09:15:00.000Z"),
    checkedOutAt: options?.checkedOutAt ?? null,
    worker: { displayName: "Amy", user: { name: "Amy" } },
  };
  const db = {
    serviceCategory: emptyModel("serviceCategory", calls),
    service: emptyModel("service", calls),
    user: emptyModel("user", calls),
    worker: emptyModel("worker", calls),
    customer: emptyModel("customer", calls),
    appointment: emptyModel("appointment", calls),
    checkin: emptyModel("checkin", calls),
    turn: {
      ...emptyModel("turn", calls),
      findMany: async (args?: unknown) => {
        calls.push({ model: "turn", method: "findMany", args });
        return options?.activeTurns ?? [];
      },
    },
    sale: emptyModel("sale", calls),
    saleItem: emptyModel("saleItem", calls),
    payment: emptyModel("payment", calls),
    discount: emptyModel("discount", calls),
    refund: emptyModel("refund", calls),
    session: {
      ...emptyModel("session", calls),
      findFirst: async (args?: unknown) => {
        calls.push({ model: "session", method: "findFirst", args });
        return session;
      },
    },
    workerSession: {
      ...emptyModel("workerSession", calls),
      upsert: async (args: unknown) => {
        calls.push({ model: "workerSession", method: "upsert", args });
        workerSession.checkedOutAt = null;
        return workerSession;
      },
      findFirst: async (args?: unknown) => {
        calls.push({ model: "workerSession", method: "findFirst", args });
        return workerSession;
      },
      update: async (args: unknown) => {
        calls.push({ model: "workerSession", method: "update", args });
        workerSession.checkedOutAt = new Date("2026-05-12T17:00:00.000Z");
        return workerSession;
      },
      findMany: async (args?: unknown) => {
        calls.push({ model: "workerSession", method: "findMany", args });
        return [workerSession];
      },
    },
    $transaction: async <T>(callback: (tx: DbClient) => Promise<T>): Promise<T> => callback(db as unknown as DbClient),
  } as unknown as DbClient;

  return { db, calls, workerSession };
}

function createReportFakeDb() {
  const calls: Call[] = [];
  const rangeStart = new Date("2026-05-31T00:00:00.000Z");
  const rangeEnd = new Date("2026-06-01T00:00:00.000Z");
  const paidSale = {
    id: "sale-paid",
    status: "paid",
    subtotalCents: 20000,
    discountTotalCents: 0,
    taxTotalCents: 0,
    tipTotalCents: 1500,
    totalCents: 21500,
    amountPaidCents: 21500,
    completedAt: new Date("2026-05-31T15:00:00.000Z"),
    items: [
      {
        id: "item-paid",
        workerId: "worker-1",
        worker: { id: "worker-1", displayName: "Amy", user: { name: "Amy" } },
        serviceNameSnapshot: "Deluxe Pedicure",
        priceCents: 12000,
        discountCents: 0,
        finalServiceCents: 12000,
        workerCommissionCents: 7200,
        tipCents: 1000,
        status: "active",
      },
      {
        id: "item-paid-worker-2",
        workerId: "worker-2",
        worker: { id: "worker-2", displayName: "Bella", user: { name: "Bella" } },
        serviceNameSnapshot: "Gel Manicure",
        priceCents: 8000,
        discountCents: 0,
        finalServiceCents: 8000,
        workerCommissionCents: 4000,
        tipCents: 500,
        status: "active",
      },
    ],
    payments: [{ method: "card", amountCents: 21500, status: "approved" }],
    refunds: [],
    discounts: [],
    customer: { name: "Mary" },
  };
  const draftSale = {
    id: "sale-draft",
    status: "open",
    subtotalCents: 9000,
    discountTotalCents: 0,
    tipTotalCents: 0,
    totalCents: 9000,
    amountPaidCents: 0,
    completedAt: null,
    items: [
      {
        id: "item-draft",
        workerId: "worker-1",
        serviceNameSnapshot: "Draft Service",
        finalServiceCents: 9000,
        workerCommissionCents: 5400,
        tipCents: 0,
        status: "active",
      },
    ],
    payments: [],
    refunds: [],
    discounts: [],
  };
  const sales = [paidSale, draftSale];
  const workers = [
    { id: "worker-1", displayName: "Amy", commissionRate: 0.6, active: true, user: { name: "Amy" } },
    { id: "worker-2", displayName: "Bella", commissionRate: 0.5, active: true, user: { name: "Bella" } },
  ];
  const turns = [
    {
      id: "turn-1",
      workerId: "worker-1",
      worker: workers[0],
      customer: { name: "Mary" },
      sale: paidSale,
      status: "completed",
      startedAt: new Date("2026-05-31T14:00:00.000Z"),
      endedAt: new Date("2026-05-31T15:00:00.000Z"),
      createdAt: new Date("2026-05-31T13:50:00.000Z"),
    },
  ];

  const inRange = (date: Date | string | null | undefined, range: { gte?: Date; lt?: Date } | undefined) => {
    if (!range || !date) return true;
    const time = new Date(date).getTime();
    return (!range.gte || time >= range.gte.getTime()) && (!range.lt || time < range.lt.getTime());
  };

  const db = {
    serviceCategory: emptyModel("serviceCategory", calls),
    service: emptyModel("service", calls),
    user: emptyModel("user", calls),
    worker: {
      ...emptyModel("worker", calls),
      findMany: async (args?: unknown) => {
        calls.push({ model: "worker", method: "findMany", args });
        const where = (args as { where?: { id?: string; active?: boolean } } | undefined)?.where;
        return workers.filter((worker) =>
          (!where?.id || worker.id === where.id) &&
          (where?.active === undefined || worker.active === where.active)
        );
      },
    },
    customer: emptyModel("customer", calls),
    appointment: emptyModel("appointment", calls),
    checkin: emptyModel("checkin", calls),
    turn: {
      ...emptyModel("turn", calls),
      findMany: async (args?: unknown) => {
        calls.push({ model: "turn", method: "findMany", args });
        const where = (args as { where?: { createdAt?: { gte?: Date; lt?: Date }; workerId?: string } } | undefined)?.where;
        return turns.filter((turn) => (!where?.workerId || turn.workerId === where.workerId) && inRange(turn.createdAt, where?.createdAt));
      },
    },
    sale: {
      ...emptyModel("sale", calls),
      findMany: async (args?: unknown) => {
        calls.push({ model: "sale", method: "findMany", args });
        const where = (args as {
          where?: {
            completedAt?: { gte?: Date; lt?: Date };
            status?: { in?: string[] };
            items?: { some?: { workerId?: string; status?: string } };
          };
        } | undefined)?.where;
        return sales.filter((sale) =>
          (!where?.status?.in || where.status.in.includes(sale.status)) &&
          (!where?.items?.some?.workerId || sale.items.some((item) =>
            item.workerId === where.items?.some?.workerId &&
            (!where.items?.some?.status || item.status === where.items.some.status)
          )) &&
          inRange(sale.completedAt, where?.completedAt)
        );
      },
    },
    saleItem: {
      ...emptyModel("saleItem", calls),
      findMany: async (args?: unknown) => {
        calls.push({ model: "saleItem", method: "findMany", args });
        const where = (args as {
          where?: {
            workerId?: string;
            status?: string;
            sale?: { completedAt?: { gte?: Date; lt?: Date }; status?: { in?: string[] } };
          };
        } | undefined)?.where;
        return sales.flatMap((sale) =>
          sale.items
            .filter((item) =>
              (!where?.workerId || item.workerId === where.workerId) &&
              (!where?.status || item.status === where.status) &&
              (!where?.sale?.status?.in || where.sale.status.in.includes(sale.status)) &&
              inRange(sale.completedAt, where?.sale?.completedAt)
            )
            .map((item) => ({ ...item, sale }))
        );
      },
    },
    payment: emptyModel("payment", calls),
    discount: emptyModel("discount", calls),
    refund: emptyModel("refund", calls),
    session: emptyModel("session", calls),
    workerSession: emptyModel("workerSession", calls),
    $transaction: async <T>(callback: (tx: DbClient) => Promise<T>): Promise<T> => callback(db as unknown as DbClient),
  } as unknown as DbClient;

  return { db, calls, rangeStart, rangeEnd };
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
    findFirst: async (args?: unknown) => {
      calls.push({ model, method: "findFirst", args });
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
    updateMany: async (args: unknown) => {
      calls.push({ model, method: "updateMany", args });
      return { count: 0 };
    },
    upsert: async (args: unknown) => {
      calls.push({ model, method: "upsert", args });
      return { id: `${model}-upserted`, args };
    },
  };
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
      payload: { name: "Amy", email: "amy@example.com", commissionRate: 0.6 },
    });

    expect(response.statusCode).toBe(201);
    expect(calls[0]).toMatchObject({ model: "user", method: "create" });
    expect(calls[1]).toMatchObject({ model: "worker", method: "create" });
  });

  it("clocks a worker in for the current session", async () => {
    const { db, calls } = createWorkerSessionFakeDb();
    const app = await buildServer({ db, logger: false });

    const response = await app.inject({
      method: "POST",
      url: "/api/sessions/current/worker-checkin",
      payload: { workerId: "worker-1" },
    });

    expect(response.statusCode).toBe(201);
    expect(response.json()).toMatchObject({
      id: "worker-session-1",
      workerId: "worker-1",
      name: "Amy",
      checkedOutAt: null,
    });
    expect(calls).toContainEqual({
      model: "workerSession",
      method: "upsert",
      args: expect.objectContaining({
        update: { checkedOutAt: null },
        create: { workerId: "worker-1", sessionId: "session-1" },
      }),
    });
  });

  it("reopens a clocked-out worker session when the worker clocks back in", async () => {
    const { db } = createWorkerSessionFakeDb({ checkedOutAt: "2026-05-12T16:00:00.000Z" });
    const app = await buildServer({ db, logger: false });

    const response = await app.inject({
      method: "POST",
      url: "/api/sessions/current/worker-checkin",
      payload: { workerId: "worker-1" },
    });

    expect(response.statusCode).toBe(201);
    expect(response.json()).toMatchObject({ workerId: "worker-1", checkedOutAt: null });
  });

  it("clocks a worker out for the current session", async () => {
    const { db } = createWorkerSessionFakeDb();
    const app = await buildServer({ db, logger: false });

    const response = await app.inject({
      method: "POST",
      url: "/api/sessions/current/worker-clockout",
      payload: { workerId: "worker-1" },
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toMatchObject({ workerId: "worker-1" });
    expect(response.json().checkedOutAt).toBeTruthy();
  });

  it("rejects clock-out when the worker has active work", async () => {
    const { db } = createWorkerSessionFakeDb({ activeTurns: [{ id: "turn-1", status: "assigned" }] });
    const app = await buildServer({ db, logger: false });

    const response = await app.inject({
      method: "POST",
      url: "/api/sessions/current/worker-clockout",
      payload: { workerId: "worker-1" },
    });

    expect(response.statusCode).toBe(400);
    expect(response.json()).toEqual({ error: "Cannot clock out worker with active assigned or in-service work" });
  });

  it("creates a check-in with an embedded new customer", async () => {
    const { db, calls } = createFakeDb();
    const app = await buildServer({ db, logger: false });

    const response = await app.inject({
      method: "POST",
      url: "/api/checkins",
      payload: {
        customer: { name: "Mary", phone: "5551234567" },
        notes: "Walk-in pedicure",
      },
    });

    expect(response.statusCode).toBe(201);
    expect(calls[0]).toMatchObject({ model: "customer", method: "create" });
    expect(calls[1]).toMatchObject({ model: "checkin", method: "create" });
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
          workerId: "worker-1",
          sessionId: "found",
          turnCount: 1,
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

  it("starts service by updating the turn, worker, and check-in", async () => {
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
      model: "worker",
      method: "update",
      args: { where: { id: "worker-1" }, data: { currentStatus: "in_service" } },
    });
    expect(calls).toContainEqual({
      model: "checkin",
      method: "update",
      args: { where: { id: "checkin-1" }, data: { status: "in_service" } },
    });
  });

  it("completes service and moves the check-in to ready for checkout", async () => {
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
      model: "worker",
      method: "update",
      args: { where: { id: "worker-1" }, data: { currentStatus: "available" } },
    });
    expect(calls).toContainEqual({
      model: "checkin",
      method: "update",
      args: { where: { id: "checkin-1" }, data: { status: "ready_for_checkout" } },
    });
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
    const { db } = createFakeDbWithWorkers([
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
        turns: [{ id: "turn-3", status: "in_service", startedAt: "2026-05-12T15:30:00.000Z" }],
        saleItems: [],
      },
    ]);
    const app = await buildServer({ db, logger: false });

    const response = await app.inject({ method: "GET", url: "/api/turns/dashboard" });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toMatchObject({
      workers: [
        {
          workerId: "worker-1",
          turnsTakenToday: 1,
          salesTodayCents: 5000,
          tipsTodayCents: 1000,
          suggestionRank: 2,
        },
        {
          workerId: "worker-2",
          turnsTakenToday: 0,
          suggestionRank: 1,
        },
        {
          workerId: "worker-3",
          turnsTakenToday: 1,
          suggestionRank: null,
        },
      ],
    });
  });

  it("marks clocked-out workers as not checked in on the current session dashboard", async () => {
    const { db } = createFakeDbWithWorkers([
      {
        id: "worker-1",
        displayName: "Amy",
        currentStatus: "available",
        workerSessions: [{ checkedOutAt: null }],
        turns: [],
        saleItems: [],
      },
      {
        id: "worker-2",
        displayName: "Bella",
        currentStatus: "available",
        workerSessions: [{ checkedOutAt: new Date("2026-05-12T17:00:00.000Z") }],
        turns: [],
        saleItems: [],
      },
    ]);
    const app = await buildServer({ db, logger: false });

    const response = await app.inject({ method: "GET", url: "/api/turns/dashboard?currentSessionOnly=true" });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toMatchObject({
      workers: [
        { workerId: "worker-1", checkedIn: true, suggestionRank: 1 },
        { workerId: "worker-2", checkedIn: false, suggestionRank: null },
      ],
    });
  });

  it("returns paid sales for a selected calendar day range", async () => {
    const { db } = createReportFakeDb();
    const app = await buildServer({ db, logger: false });

    const response = await app.inject({
      method: "GET",
      url: "/api/reports/sales?start=2026-05-31T00:00:00&end=2026-06-01T00:00:00",
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toMatchObject({
      summary: {
        grossServiceSalesCents: 20000,
        cardTotalCents: 21500,
        totalCollectedCents: 21500,
      },
      sales: [{ id: "sale-paid" }],
    });
  });

  it("filters sales ticket lines and totals by worker", async () => {
    const { db } = createReportFakeDb();
    const app = await buildServer({ db, logger: false });

    const response = await app.inject({
      method: "GET",
      url: "/api/reports/sales?start=2026-05-31T00:00:00&end=2026-06-01T00:00:00&workerId=worker-1",
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toMatchObject({
      summary: {
        grossServiceSalesCents: 12000,
        netServiceSalesCents: 12000,
        tipTotalCents: 1000,
        workerCommissionPayoutCents: 7200,
        totalPayCents: 8200,
        totalCollectedCents: 13000,
      },
      sales: [{
        id: "sale-paid",
        services: [{ id: "item-paid", workerId: "worker-1" }],
        totals: {
          serviceCents: 12000,
          commissionCents: 7200,
          tipsCents: 1000,
          payCents: 8200,
          collectedCents: 13000,
        },
      }],
    });
    expect(response.json().sales[0].services).toHaveLength(1);
  });

  it("returns turn detail with date filters", async () => {
    const { db, calls } = createReportFakeDb();
    const app = await buildServer({ db, logger: false });

    const response = await app.inject({
      method: "GET",
      url: "/api/reports/turns/detail?start=2026-05-31T00:00:00&end=2026-06-01T00:00:00",
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toMatchObject({
      turns: [{ id: "turn-1", workerName: "Amy", itemTotalCents: 12000 }],
    });
    expect(calls).toContainEqual({
      model: "turn",
      method: "findMany",
      args: expect.objectContaining({
        where: expect.objectContaining({
          createdAt: {
            gte: new Date("2026-05-31T00:00:00"),
            lt: new Date("2026-06-01T00:00:00"),
          },
        }),
      }),
    });
  });

  it("worker earnings include paid completed sale items only", async () => {
    const { db } = createReportFakeDb();
    const app = await buildServer({ db, logger: false });

    const response = await app.inject({
      method: "GET",
      url: "/api/reports/workers?start=2026-05-31T00:00:00&end=2026-06-01T00:00:00",
    });

    expect(response.statusCode).toBe(200);
    expect(response.json().workers).toEqual(expect.arrayContaining([expect.objectContaining({
        workerId: "worker-1",
        services: 1,
        netSalesCents: 12000,
        commissionCents: 7200,
        tipsCents: 1000,
        totalPayCents: 8200,
      })]));
  });

  it("worker earnings can be filtered to one worker", async () => {
    const { db } = createReportFakeDb();
    const app = await buildServer({ db, logger: false });

    const response = await app.inject({
      method: "GET",
      url: "/api/reports/workers?start=2026-05-31T00:00:00&end=2026-06-01T00:00:00&workerId=worker-2",
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toMatchObject({
      workers: [{
        workerId: "worker-2",
        services: 1,
        netSalesCents: 8000,
        commissionCents: 4000,
        tipsCents: 500,
        totalPayCents: 4500,
      }],
    });
    expect(response.json().workers).toHaveLength(1);
  });

  it("end-of-day report is based on completed paid sales", async () => {
    const { db } = createReportFakeDb();
    const app = await buildServer({ db, logger: false });

    const response = await app.inject({
      method: "GET",
      url: "/api/reports/end-of-day?start=2026-05-31T00:00:00&end=2026-06-01T00:00:00",
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toMatchObject({
      grossServiceSalesCents: 20000,
      cardTotalCents: 21500,
      totalCollectedCents: 21500,
      workerCommissionPayoutCents: 11200,
      businessShareCents: 8800,
    });
  });

  it("end-of-day report can be filtered to one worker's ticket lines", async () => {
    const { db } = createReportFakeDb();
    const app = await buildServer({ db, logger: false });

    const response = await app.inject({
      method: "GET",
      url: "/api/reports/end-of-day?start=2026-05-31T00:00:00&end=2026-06-01T00:00:00&workerId=worker-1",
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toMatchObject({
      grossServiceSalesCents: 12000,
      netServiceSalesCents: 12000,
      tipTotalCents: 1000,
      totalPayCents: 8200,
      totalCollectedCents: 13000,
      workerCommissionPayoutCents: 7200,
      businessShareCents: 4800,
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

  it("voids a removed sale item and recomputes the sale", async () => {
    const { db, calls, state } = createCheckoutFakeDb();
    state.sale.items.push({ id: "item-1", priceCents: 12000, discountCents: 0, tipCents: 0, status: "active" });
    const app = await buildServer({ db, logger: false });

    const response = await app.inject({
      method: "DELETE",
      url: "/api/sales/sale-1/items/item-1",
    });

    expect(response.statusCode).toBe(200);
    expect(calls).toContainEqual({
      model: "saleItem",
      method: "update",
      args: { where: { id: "item-1" }, data: { status: "voided" } },
    });
    expect(state.sale.totalCents).toBe(0);
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
    expect(state.sale.amountPaidCents).toBe(12000);
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
});
