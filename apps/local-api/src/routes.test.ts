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
    turn: makeModel("turn"),
    sale: makeModel("sale"),
    saleItem: makeModel("saleItem"),
    payment: { create: makeModel("payment").create },
    discount: { create: makeModel("discount").create },
    $transaction: async <T>(callback: (tx: DbClient) => Promise<T>): Promise<T> => callback(db),
  } satisfies DbClient;

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
    turn: makeModel("turn"),
    sale: makeModel("sale"),
    saleItem: makeModel("saleItem"),
    payment: { create: makeModel("payment").create },
    discount: { create: makeModel("discount").create },
    $transaction: async <T>(callback: (tx: DbClient) => Promise<T>): Promise<T> => callback(db),
  };

  return { db, calls };
}

function createCheckoutFakeDb() {
  const calls: Call[] = [];
  let id = 1;
  const state = {
    sale: {
      id: "sale-1",
      checkinId: "checkin-1",
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
    checkin: emptyModel("checkin", calls),
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
