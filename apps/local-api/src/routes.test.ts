import { describe, expect, it } from "vitest";
import { scryptSync } from "node:crypto";
import { MockTerminalAdapter } from "@nail/payment-terminal";
import { MockReceiptPrinterAdapter } from "@nail/receipt-printer";
import { buildServer } from "./server.js";
import { hashSecret, issueOwnerToken } from "./auth.js";
import type { DbClient } from "./db.js";
import { hashPin } from "./routes/pin.js";

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
      return { id: "updated", userId: "user-1", args };
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
<<<<<<< HEAD
    user: makeModel("user"),
=======
    user: { findMany: makeModel("user").findMany, create: makeModel("user").create },
>>>>>>> bdf0b2066dfcb2e3e613cb86c08bdfaba329da34
    worker: makeModel("worker"),
    customer: makeModel("customer"),
    appointment: makeModel("appointment"),
    checkin: makeModel("checkin"),
    workSession: makeModel("workSession"),
    workerSessionCheckin: makeModel("workerSessionCheckin"),
    turn: makeModel("turn"),
    sale: makeModel("sale"),
    saleItem: makeModel("saleItem"),
<<<<<<< HEAD
    payment: makeModel("payment"),
    discount: makeModel("discount"),
    refund: makeModel("refund"),
    session: makeModel("session"),
    workerSession: makeModel("workerSession"),
=======
    payment: {
      findMany: makeModel("payment").findMany,
      findUnique: makeModel("payment").findUnique,
      create: makeModel("payment").create,
      update: makeModel("payment").update,
    },
    receipt: {
      findMany: makeModel("receipt").findMany,
      create: makeModel("receipt").create,
      update: makeModel("receipt").update,
    },
    discount: { findMany: makeModel("discount").findMany, create: makeModel("discount").create },
    refund: { findMany: makeModel("refund").findMany, create: makeModel("refund").create },
>>>>>>> bdf0b2066dfcb2e3e613cb86c08bdfaba329da34
    $transaction: async <T>(callback: (tx: DbClient) => Promise<T>): Promise<T> => callback(db),
  } as unknown as DbClient;

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
<<<<<<< HEAD
    user: makeModel("user"),
=======
    user: { findMany: makeModel("user").findMany, create: makeModel("user").create },
>>>>>>> bdf0b2066dfcb2e3e613cb86c08bdfaba329da34
    worker: makeModel("worker", workers),
    customer: makeModel("customer"),
    appointment: makeModel("appointment"),
    checkin: makeModel("checkin"),
    workSession: makeModel("workSession", sessions),
    workerSessionCheckin: makeModel("workerSessionCheckin"),
    turn: makeModel("turn"),
    sale: makeModel("sale"),
    saleItem: makeModel("saleItem"),
<<<<<<< HEAD
    payment: makeModel("payment"),
    discount: makeModel("discount"),
    refund: makeModel("refund"),
    session: makeModel("session"),
    workerSession: makeModel("workerSession"),
=======
    payment: {
      findMany: makeModel("payment").findMany,
      findUnique: makeModel("payment").findUnique,
      create: makeModel("payment").create,
      update: makeModel("payment").update,
    },
    receipt: {
      findMany: makeModel("receipt").findMany,
      create: makeModel("receipt").create,
      update: makeModel("receipt").update,
    },
    discount: { findMany: makeModel("discount").findMany, create: makeModel("discount").create },
    refund: { findMany: makeModel("refund").findMany, create: makeModel("refund").create },
>>>>>>> bdf0b2066dfcb2e3e613cb86c08bdfaba329da34
    $transaction: async <T>(callback: (tx: DbClient) => Promise<T>): Promise<T> => callback(db),
  } as unknown as DbClient;

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
<<<<<<< HEAD
      items: [] as Array<{ id: string; priceCents: number; discountCents: number; tipCents: number; status: string }>,
      payments: [] as Array<{ id?: string; saleId?: string; method: "cash" | "card" | "gift_card"; amountCents: number; status: "pending" | "approved" | "declined" | "cancelled" | "failed"; providerPaymentId?: string; idempotencyKey?: string; rawProviderReference?: unknown; createdAt?: Date }>,
=======
      items: [] as Array<{
        id: string;
        workerId?: string;
        priceCents: number;
        discountCents: number;
        tipCents: number;
        status: string;
      }>,
      payments: [] as Array<{
        id?: string;
        method: "cash" | "card" | "gift_card";
        amountCents: number;
        tipCents?: number;
        status: "approved" | "declined" | "cancelled" | "failed";
        providerPaymentId?: string;
      }>,
      refunds: [] as Array<{
        id: string;
        saleId: string;
        paymentId?: string;
        amountCents: number;
        reason?: string;
        providerRefundId?: string;
      }>,
      receipts: [] as Array<Record<string, unknown>>,
>>>>>>> bdf0b2066dfcb2e3e613cb86c08bdfaba329da34
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
<<<<<<< HEAD
    user: emptyModel("user", calls),
=======
    user: { findMany: emptyModel("user", calls).findMany, create: emptyModel("user", calls).create },
>>>>>>> bdf0b2066dfcb2e3e613cb86c08bdfaba329da34
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
<<<<<<< HEAD
        const id = (args as { where?: { id?: string }; data?: { status?: string } }).where?.id;
        const item = state.sale.items.find((saleItem) => saleItem.id === id) ?? state.sale.items[0];
        if (item && (args as { data?: { status?: string } }).data?.status) {
          item.status = (args as { data: { status: string } }).data.status;
        }
        return item ?? { id: "item-1", args };
=======
        const where = (args as { where?: { id?: string } }).where;
        const data = (args as { data?: { tipCents?: number } }).data;
        if (where?.id && typeof data?.tipCents === "number") {
          const index = state.sale.items.findIndex((item) => item.id === where.id);
          if (index >= 0) state.sale.items[index] = { ...state.sale.items[index], tipCents: data.tipCents };
        }
        return { id: where?.id ?? "item-1", args };
>>>>>>> bdf0b2066dfcb2e3e613cb86c08bdfaba329da34
      },
    },
    payment: {
      findMany: async (args?: unknown) => {
        calls.push({ model: "payment", method: "findMany", args });
<<<<<<< HEAD
        return [];
      },
      findUnique: async (args: unknown) => {
        calls.push({ model: "payment", method: "findUnique", args });
        const id = (args as { where?: { id?: string } }).where?.id;
        return state.sale.payments.find((payment) => (payment as { id?: string }).id === id) ?? null;
=======
        const where = ((args as { where?: Record<string, unknown> } | undefined)?.where ?? {}) as Record<string, unknown>;
        return state.sale.payments
          .filter((payment) => (typeof where.status === "string" ? payment.status === where.status : true))
          .map((payment) => ({ id: nextId("payment"), saleId: state.sale.id, ...payment }));
>>>>>>> bdf0b2066dfcb2e3e613cb86c08bdfaba329da34
      },
      create: async (args: unknown) => {
        calls.push({ model: "payment", method: "create", args });
        const data = (args as {
<<<<<<< HEAD
          data: { method: "cash" | "card" | "gift_card"; amountCents: number; status: "pending" | "approved" | "declined" | "cancelled" | "failed" };
        }).data;
        const payment = { id: nextId("payment"), ...data };
        state.sale.payments.push(payment);
        return payment;
      },
      update: async (args: unknown) => {
        calls.push({ model: "payment", method: "update", args });
        const id = (args as { where?: { id?: string }; data: Record<string, unknown> }).where?.id;
        const payment = state.sale.payments.find((candidate) => (candidate as { id?: string }).id === id) ?? state.sale.payments[0];
        Object.assign(payment, (args as { data: Record<string, unknown> }).data);
=======
          data: {
            method: "cash" | "card" | "gift_card";
            amountCents: number;
            tipCents?: number;
            status: "approved" | "declined" | "cancelled" | "failed";
          };
        }).data;
        const payment = { id: nextId("payment"), ...data };
        state.sale.payments.push(payment);
>>>>>>> bdf0b2066dfcb2e3e613cb86c08bdfaba329da34
        return payment;
      },
      findUnique: async (args: unknown) => {
        calls.push({ model: "payment", method: "findUnique", args });
        const where = ((args as { where?: Record<string, unknown> }).where ?? {}) as Record<string, unknown>;
        return state.sale.payments.find((payment) => payment.id === where.id) ?? null;
      },
      update: async (args: unknown) => {
        calls.push({ model: "payment", method: "update", args });
        const where = ((args as { where?: Record<string, unknown> }).where ?? {}) as Record<string, unknown>;
        const data = ((args as { data?: Record<string, unknown> }).data ?? {}) as Record<string, unknown>;
        const index = state.sale.payments.findIndex((payment) => payment.id === where.id);
        if (index >= 0) state.sale.payments[index] = { ...state.sale.payments[index], ...data };
        return index >= 0 ? state.sale.payments[index] : { id: where.id, ...data };
      },
    },
    receipt: {
      findMany: async (args?: unknown) => {
        calls.push({ model: "receipt", method: "findMany", args });
        const where = ((args as { where?: Record<string, unknown> } | undefined)?.where ?? {}) as Record<string, unknown>;
        return state.sale.receipts.filter((receipt) => {
          if (typeof where.id === "string" && receipt.id !== where.id) return false;
          if (typeof where.saleId === "string" && receipt.saleId !== where.saleId) return false;
          return true;
        });
      },
      create: async (args: unknown) => {
        calls.push({ model: "receipt", method: "create", args });
        const data = ((args as { data?: Record<string, unknown> }).data ?? {}) as Record<string, unknown>;
        const receipt = { id: nextId("receipt"), createdAt: new Date().toISOString(), ...data };
        state.sale.receipts.unshift(receipt);
        return receipt;
      },
      update: async (args: unknown) => {
        calls.push({ model: "receipt", method: "update", args });
        const where = ((args as { where?: Record<string, unknown> }).where ?? {}) as Record<string, unknown>;
        const data = ((args as { data?: Record<string, unknown> }).data ?? {}) as Record<string, unknown>;
        const index = state.sale.receipts.findIndex((receipt) => receipt.id === where.id);
        if (index >= 0) state.sale.receipts[index] = { ...state.sale.receipts[index], ...data };
        return index >= 0 ? state.sale.receipts[index] : { id: where.id, ...data };
      },
    },
    discount: { findMany: emptyModel("discount", calls).findMany, create: emptyModel("discount", calls).create },
    refund: {
      findMany: async (args?: unknown) => {
        calls.push({ model: "refund", method: "findMany", args });
        return state.sale.refunds.map((refund) => ({ ...refund }));
      },
      create: async (args: unknown) => {
        calls.push({ model: "refund", method: "create", args });
        const data = ((args as { data?: Record<string, unknown> }).data ?? {}) as Record<string, unknown>;
        const refund = {
          id: nextId("refund"),
          saleId: String(data.saleId),
          paymentId: typeof data.paymentId === "string" ? data.paymentId : undefined,
          amountCents: Number(data.amountCents),
          reason: typeof data.reason === "string" ? data.reason : undefined,
          providerRefundId: typeof data.providerRefundId === "string" ? data.providerRefundId : undefined,
        };
        state.sale.refunds.push(refund);
        return refund;
      },
    },
<<<<<<< HEAD
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
=======
>>>>>>> bdf0b2066dfcb2e3e613cb86c08bdfaba329da34
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
        commissionRateSnapshot: 0.6,
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
        commissionRateSnapshot: 0.5,
        tipCents: 500,
        status: "active",
      },
    ],
    payments: [{
      id: "payment-card",
      saleId: "sale-paid",
      method: "card",
      provider: "clover",
      providerPaymentId: "clover-payment-1",
      amountCents: 21500,
      tipCents: 1500,
      status: "approved",
      createdAt: new Date("2026-05-31T15:00:00.000Z"),
    }],
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
  const payments = paidSale.payments;
  const refunds = [{
    id: "refund-1",
    saleId: "sale-paid",
    paymentId: "payment-card",
    amountCents: 2000,
    reason: "Owner approved correction",
    approvedByUserId: "owner-1",
    createdAt: new Date("2026-05-31T16:00:00.000Z"),
    sale: paidSale,
    payment: payments[0],
  }];
  const discounts = [{
    id: "discount-1",
    saleId: "sale-paid",
    saleItemId: "item-paid",
    type: "amount",
    amountCents: 1000,
    percent: null,
    reason: "Loyalty",
    approvedByUserId: "owner-1",
    createdAt: new Date("2026-05-31T14:30:00.000Z"),
    sale: paidSale,
    saleItem: paidSale.items[0],
  }];
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
            payments?: { some?: { method?: string } };
          };
        } | undefined)?.where;
        return sales.filter((sale) =>
          (!where?.status?.in || where.status.in.includes(sale.status)) &&
          (!where?.payments?.some?.method || sale.payments.some((payment) => payment.method === where.payments?.some?.method)) &&
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
    payment: {
      ...emptyModel("payment", calls),
      findMany: async (args?: unknown) => {
        calls.push({ model: "payment", method: "findMany", args });
        const where = (args as {
          where?: {
            createdAt?: { gte?: Date; lt?: Date };
            method?: string;
            sale?: { items?: { some?: { workerId?: string } } };
          };
        } | undefined)?.where;
        return payments.filter((payment) =>
          (!where?.method || payment.method === where.method) &&
          (!where?.sale?.items?.some?.workerId || paidSale.items.some((item) => item.workerId === where.sale?.items?.some?.workerId)) &&
          inRange(payment.createdAt, where?.createdAt)
        ).map((payment) => ({ ...payment, sale: paidSale }));
      },
    },
    discount: {
      ...emptyModel("discount", calls),
      findMany: async (args?: unknown) => {
        calls.push({ model: "discount", method: "findMany", args });
        const where = (args as { where?: { createdAt?: { gte?: Date; lt?: Date } } } | undefined)?.where;
        return discounts.filter((discount) => inRange(discount.createdAt, where?.createdAt));
      },
    },
    refund: {
      ...emptyModel("refund", calls),
      findMany: async (args?: unknown) => {
        calls.push({ model: "refund", method: "findMany", args });
        const where = (args as { where?: { createdAt?: { gte?: Date; lt?: Date } } } | undefined)?.where;
        return refunds.filter((refund) => inRange(refund.createdAt, where?.createdAt));
      },
    },
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
    user: { findMany: emptyModel("user", calls).findMany, create: emptyModel("user", calls).create },
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
    payment: {
      findMany: emptyModel("payment", calls).findMany,
      findUnique: emptyModel("payment", calls).findUnique,
      create: emptyModel("payment", calls).create,
      update: emptyModel("payment", calls).update,
    },
    receipt: {
      findMany: emptyModel("receipt", calls).findMany,
      create: emptyModel("receipt", calls).create,
      update: emptyModel("receipt", calls).update,
    },
    discount: { findMany: emptyModel("discount", calls).findMany, create: emptyModel("discount", calls).create },
    refund: { findMany: emptyModel("refund", calls).findMany, create: emptyModel("refund", calls).create },
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
<<<<<<< HEAD
      payload: { name: "Amy", email: "amy@example.com", commissionRate: 0.6, pin: "2468" },
=======
      payload: { name: "Amy", email: "amy@example.com", commissionRate: 0.6, password: "1234" },
>>>>>>> bdf0b2066dfcb2e3e613cb86c08bdfaba329da34
    });

    expect(response.statusCode).toBe(201);
    expect(calls[0]).toMatchObject({
      model: "user",
      method: "create",
      args: { data: expect.objectContaining({ pinHash: expect.stringMatching(/^scrypt:/) }) },
    });
    const pinHash = (calls[0].args as { data: { pinHash: string } }).data.pinHash;
    expect(pinHash).not.toBe("2468");
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

  it("authenticates an owner with password", async () => {
    const { db } = createFakeDb();
    db.user.findMany = async () => [
      { id: "owner-1", name: "Owner", role: "owner", active: true, passwordHash: hashSecret("1234") },
    ];
    const app = await buildServer({ db, logger: false });

    const response = await app.inject({
      method: "POST",
      url: "/api/owner/login",
      payload: { emailOrPhone: "owner@example.com", password: "1234" },
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toMatchObject({ user: { id: "owner-1", role: "owner" } });
    expect(typeof (response.json() as { token?: unknown }).token).toBe("string");
  });

  it("rejects owner reports without an owner token", async () => {
    const { db } = createFakeDb();
    const app = await buildServer({ db, logger: false });

    const missing = await app.inject({ method: "GET", url: "/api/reports/summary" });
    const invalid = await app.inject({
      method: "GET",
      url: "/api/reports/summary",
      headers: { authorization: "Bearer not-an-owner-token" },
    });

    expect(missing.statusCode).toBe(401);
    expect(invalid.statusCode).toBe(401);
  });

  it("returns owner summary totals for paid sales", async () => {
    const completedAt = new Date("2026-05-14T15:00:00.000Z");
    const { db } = createSessionStateDb({
      sales: [
        {
          id: "sale-1",
          status: "paid",
          completedAt,
          items: [
            {
              id: "item-1",
              workerId: "worker-1",
              priceCents: 5000,
              discountCents: 500,
              finalServiceCents: 4500,
              workerCommissionCents: 2700,
              tipCents: 1000,
              workerTotalCents: 3700,
              businessCents: 1800,
              status: "active",
            },
          ],
          payments: [{ id: "payment-1", method: "cash", amountCents: 5500, status: "approved" }],
          refunds: [],
        },
      ],
    });
    const app = await buildServer({ db, logger: false });
    const token = issueOwnerToken("owner-1").token;

    const response = await app.inject({
      method: "GET",
      url: "/api/reports/summary?start=2026-05-14T00:00:00.000Z&end=2026-05-15T00:00:00.000Z",
      headers: { authorization: `Bearer ${token}` },
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toMatchObject({
      summary: {
        grossServiceCents: 5000,
        discountCents: 500,
        netServiceCents: 4500,
        tipsCents: 1000,
        workerCommissionCents: 2700,
        totalCollectedCents: 5500,
        paymentBreakdown: { cashCents: 5500, cardCents: 0, giftCardCents: 0, otherCents: 0 },
      },
    });
  });

  it("excludes declined payments from owner payment reports", async () => {
    const { db, state } = createCheckoutFakeDb();
    state.sale.payments.push(
      { method: "cash", amountCents: 4000, status: "approved" },
      { method: "card", amountCents: 6000, status: "declined" }
    );
    const app = await buildServer({ db, logger: false });
    const token = issueOwnerToken("owner-1").token;

    const response = await app.inject({
      method: "GET",
      url: "/api/reports/payments?start=2026-05-14T00:00:00.000Z&end=2026-05-15T00:00:00.000Z",
      headers: { authorization: `Bearer ${token}` },
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toMatchObject({
      totals: { cashCents: 4000, cardCents: 0, giftCardCents: 0, otherCents: 0 },
    });
    expect(response.json().payments).toHaveLength(1);
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
      payload: { requestedWorkerId: "worker-1", customer: { name: "Mary", phone: "5551234567" } },
    });
    expect(noSession.statusCode).toBe(409);

    await app.inject({ method: "POST", url: "/api/sessions/open", payload: {} });

    const firstCheckin = await app.inject({
      method: "POST",
      url: "/api/checkins",
      payload: { requestedWorkerId: "worker-1", customer: { name: "Mary", phone: "5551234567" } },
    });
    expect(firstCheckin.statusCode).toBe(201);

    const second = await app.inject({
      method: "POST",
      url: "/api/checkins",
      payload: { requestedWorkerId: "worker-1", customer: { name: "Jane", phone: "5559876543" } },
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

  it("rejects creating a worker without a PIN", async () => {
    const { db } = createFakeDb();
    const app = await buildServer({ db, logger: false });

    const response = await app.inject({
      method: "POST",
      url: "/api/workers",
      payload: { name: "Amy", email: "amy@example.com", commissionRate: 0.6 },
    });

    expect(response.statusCode).toBe(400);
    expect(response.json()).toMatchObject({ error: "pin is required" });
  });

  it("updates a worker PIN on the linked user record", async () => {
    const { db, calls } = createFakeDb();
    const app = await buildServer({ db, logger: false });

    const response = await app.inject({
      method: "PATCH",
      url: "/api/workers/worker-1",
      payload: { displayName: "Amy", commissionRate: 0.55, pin: "1357" },
    });

    expect(response.statusCode).toBe(200);
    expect(calls).toContainEqual({
      model: "worker",
      method: "update",
      args: {
        where: { id: "worker-1" },
        data: { displayName: "Amy", commissionRate: 0.55 },
      },
    });
    expect(calls).toContainEqual({
      model: "user",
      method: "update",
      args: { where: { id: "user-1" }, data: { pinHash: expect.stringMatching(/^scrypt:/) } },
    });
    const userUpdate = calls.find((call) => call.model === "user" && call.method === "update");
    const pinHash = (userUpdate?.args as { data: { pinHash: string } }).data.pinHash;
    expect(pinHash).not.toBe("1357");
  });

  it("updates only the linked user when changing just a worker PIN", async () => {
    const { db, calls } = createFakeDbWithWorkers([{ id: "worker-1", userId: "user-1" }]);
    const app = await buildServer({ db, logger: false });

    const response = await app.inject({
      method: "PATCH",
      url: "/api/workers/worker-1",
      payload: { pin: "8642" },
    });

    expect(response.statusCode).toBe(200);
    expect(calls).toContainEqual({
      model: "worker",
      method: "findUnique",
      args: { where: { id: "worker-1" } },
    });
    expect(calls).toContainEqual({
      model: "user",
      method: "update",
      args: { where: { id: "user-1" }, data: { pinHash: expect.stringMatching(/^scrypt:/) } },
    });
  });

  it("rejects worker PINs that are not 4 to 6 digits before DB writes", async () => {
    for (const pin of ["12ab", "123", "1234567", 1234]) {
      const { db, calls } = createFakeDb();
      const app = await buildServer({ db, logger: false });

      const response = await app.inject({
        method: "PATCH",
        url: "/api/workers/worker-1",
        payload: { pin },
      });

      expect(response.statusCode).toBe(400);
      expect(calls).toEqual([]);
    }
  });

  it("returns 404 when changing a PIN for a missing worker", async () => {
    const { db, calls } = createFakeDbWithWorkers([]);
    (db as unknown as { worker: { findUnique(args: unknown): Promise<unknown | null> } }).worker.findUnique = async (args: unknown) => {
      calls.push({ model: "worker", method: "findUnique", args });
      return null;
    };
    const app = await buildServer({ db, logger: false });

    const response = await app.inject({
      method: "PATCH",
      url: "/api/workers/missing-worker",
      payload: { pin: "2468" },
    });

    expect(response.statusCode).toBe(404);
    expect(response.json()).toMatchObject({ error: "Worker not found" });
  });

  it("does not update the user PIN during profile-only worker edits", async () => {
    const { db, calls } = createFakeDb();
    const app = await buildServer({ db, logger: false });

    const response = await app.inject({
      method: "PATCH",
      url: "/api/workers/worker-1",
      payload: { displayName: "Amy", commissionRate: 0.55 },
    });

    expect(response.statusCode).toBe(200);
    expect(calls.some((call) => call.model === "user" && call.method === "update")).toBe(false);
  });

  it("logs in a worker with a hashed PIN", async () => {
    const { db } = createFakeDbWithWorkers([{
      id: "worker-1",
      displayName: "Amy",
      currentStatus: "available",
      commissionRate: 0.6,
      user: {
        id: "user-1",
        name: "Amy",
        role: "worker",
        email: "amy@example.com",
        phone: null,
        active: true,
        pinHash: hashPin("2468"),
        passwordHash: null,
      },
    }]);
    const app = await buildServer({ db, logger: false });

    const response = await app.inject({
      method: "POST",
      url: "/api/auth/worker-login",
      payload: { workerId: "worker-1", pin: "2468" },
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toMatchObject({
      user: { id: "user-1", role: "worker" },
      worker: { id: "worker-1", displayName: "Amy" },
    });
  });

  it("rejects a wrong worker PIN", async () => {
    const { db } = createFakeDbWithWorkers([{
      id: "worker-1",
      displayName: "Amy",
      currentStatus: "available",
      commissionRate: 0.6,
      user: {
        id: "user-1",
        name: "Amy",
        role: "worker",
        email: "amy@example.com",
        phone: null,
        active: true,
        pinHash: hashPin("2468"),
        passwordHash: null,
      },
    }]);
    const app = await buildServer({ db, logger: false });

    const response = await app.inject({
      method: "POST",
      url: "/api/auth/worker-login",
      payload: { workerId: "worker-1", pin: "1357" },
    });

    expect(response.statusCode).toBe(401);
    expect(response.json()).toMatchObject({ error: "Invalid PIN" });
  });

  it("rejects worker login for a missing or inactive worker", async () => {
    const { db, calls } = createFakeDbWithWorkers([]);
    (db as unknown as { worker: { findUnique(args: unknown): Promise<unknown | null> } }).worker.findUnique = async (args: unknown) => {
      calls.push({ model: "worker", method: "findUnique", args });
      return null;
    };
    const app = await buildServer({ db, logger: false });

    const response = await app.inject({
      method: "POST",
      url: "/api/auth/worker-login",
      payload: { workerId: "worker-1", pin: "2468" },
    });

    expect(response.statusCode).toBe(401);
    expect(response.json()).toMatchObject({ error: "Worker not found or inactive" });
  });

  it("keeps legacy raw and dev-placeholder worker PIN login paths working", async () => {
    const legacy = createFakeDbWithWorkers([{
      id: "worker-1",
      displayName: "Amy",
      currentStatus: "available",
      commissionRate: 0.6,
      user: {
        id: "user-1",
        name: "Amy",
        role: "worker",
        email: "amy@example.com",
        phone: null,
        active: true,
        pinHash: "2468",
        passwordHash: null,
      },
    }]);
    const dev = createFakeDbWithWorkers([{
      id: "worker-2",
      displayName: "Bella",
      currentStatus: "available",
      commissionRate: 0.6,
      user: {
        id: "user-2",
        name: "Bella",
        role: "worker",
        email: "bella@example.com",
        phone: null,
        active: true,
        pinHash: "dev-pin-placeholder",
        passwordHash: null,
      },
    }]);

    const legacyApp = await buildServer({ db: legacy.db, logger: false });
    const devApp = await buildServer({ db: dev.db, logger: false });

    const legacyResponse = await legacyApp.inject({
      method: "POST",
      url: "/api/auth/worker-login",
      payload: { workerId: "worker-1", pin: "2468" },
    });
    const devResponse = await devApp.inject({
      method: "POST",
      url: "/api/auth/worker-login",
      payload: { workerId: "worker-2", pin: "1234" },
    });

    expect(legacyResponse.statusCode).toBe(200);
    expect(devResponse.statusCode).toBe(200);
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
<<<<<<< HEAD
        currentStatus: "available",
        workerSessions: [{ checkedOutAt: null }],
        turns: [{ id: "turn-1", status: "completed", startedAt: "2026-05-12T14:00:00.000Z", endedAt: "2026-05-12T15:00:00.000Z" }],
        saleItems: [{ finalServiceCents: 5000, tipCents: 1000 }],
      },
      {
        id: "worker-2",
        displayName: "Bella",
        currentStatus: "available",
        workerSessions: [{ checkedOutAt: null }],
        turns: [],
        saleItems: [],
      },
      {
        id: "worker-3",
        displayName: "Cindy",
        currentStatus: "in_service",
        workerSessions: [{ checkedOutAt: null }],
        turns: [{ id: "turn-3", status: "in_service", startedAt: "2026-05-12T15:30:00.000Z" }],
        saleItems: [],
      },
=======
        currentStatus: "in_service",
        turns: [{ id: "turn-1", status: "completed", startedAt: "2026-05-12T14:00:00.000Z", endedAt: "2026-05-12T15:00:00.000Z" }],
        saleItems: [{ finalServiceCents: 5000, tipCents: 1000 }],
      },
>>>>>>> bdf0b2066dfcb2e3e613cb86c08bdfaba329da34
    ]);
    const app = await buildServer({ db, logger: false });

    const response = await app.inject({ method: "GET", url: "/api/turns/dashboard?currentSessionOnly=true" });

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

  it("excludes workers who are not clocked in from turn suggestions", async () => {
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
      {
        id: "worker-3",
        displayName: "Cindy",
        currentStatus: "available",
        workerSessions: [],
        turns: [],
        saleItems: [],
      },
    ]);
    const app = await buildServer({ db, logger: false });

    const response = await app.inject({ method: "POST", url: "/api/turns/suggest" });

    expect(response.statusCode).toBe(200);
    expect(response.json().workers.map((worker: { workerId: string }) => worker.workerId)).toEqual(["worker-1"]);
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

  it("filters the sales report by approved payment method", async () => {
    const { db } = createReportFakeDb();
    const app = await buildServer({ db, logger: false });

    const matching = await app.inject({
      method: "GET",
      url: "/api/reports/sales?start=2026-05-31T00:00:00&end=2026-06-01T00:00:00&paymentMethod=card",
    });
    const missing = await app.inject({
      method: "GET",
      url: "/api/reports/sales?start=2026-05-31T00:00:00&end=2026-06-01T00:00:00&paymentMethod=cash",
    });

    expect(matching.statusCode).toBe(200);
    expect(matching.json().sales).toEqual([expect.objectContaining({ id: "sale-paid" })]);
    expect(missing.statusCode).toBe(200);
    expect(missing.json().sales).toEqual([]);
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
        commissionRates: [0.6],
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
        commissionRates: [0.5],
        tipsCents: 500,
        totalPayCents: 4500,
      }],
    });
    expect(response.json().workers).toHaveLength(1);
  });

  it("returns payment report rows and approved totals", async () => {
    const { db } = createReportFakeDb();
    const app = await buildServer({ db, logger: false });

    const response = await app.inject({
      method: "GET",
      url: "/api/reports/payments?start=2026-05-31T00:00:00&end=2026-06-01T00:00:00&paymentMethod=card",
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toMatchObject({
      summary: {
        cardTotalCents: 21500,
        totalApprovedCents: 21500,
        byProvider: { clover: { approved: 21500 } },
      },
      payments: [{
        id: "payment-card",
        customerName: "Mary",
        method: "card",
        provider: "clover",
        amountCents: 21500,
        status: "approved",
      }],
    });
  });

  it("returns refund report rows and totals", async () => {
    const { db } = createReportFakeDb();
    const app = await buildServer({ db, logger: false });

    const response = await app.inject({
      method: "GET",
      url: "/api/reports/refunds?start=2026-05-31T00:00:00&end=2026-06-01T00:00:00",
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toMatchObject({
      summary: { refundTotalCents: 2000, refundCount: 1 },
      refunds: [{
        id: "refund-1",
        customerName: "Mary",
        amountCents: 2000,
        reason: "Owner approved correction",
        paymentMethod: "card",
      }],
    });
  });

  it("returns discount report rows and totals", async () => {
    const { db } = createReportFakeDb();
    const app = await buildServer({ db, logger: false });

    const response = await app.inject({
      method: "GET",
      url: "/api/reports/discounts?start=2026-05-31T00:00:00&end=2026-06-01T00:00:00",
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toMatchObject({
      summary: { discountTotalCents: 1000, discountCount: 1 },
      discounts: [{
        id: "discount-1",
        customerName: "Mary",
        serviceName: "Deluxe Pedicure",
        amountCents: 1000,
        reason: "Loyalty",
      }],
    });
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

<<<<<<< HEAD
  it("recovers pending card payment by Clover externalPaymentId", async () => {
    const { db, state } = createCheckoutFakeDb();
    state.sale.items.push({ id: "item-1", priceCents: 12000, discountCents: 0, tipCents: 0, status: "active" });
    state.sale.payments.push({
      id: "payment-1",
      saleId: "sale-1",
      method: "card",
      amountCents: 12000,
      status: "pending",
      idempotencyKey: "recover-card",
      rawProviderReference: { externalPaymentId: "recover-card", saleId: "sale-1" },
      createdAt: new Date("2026-05-31T15:00:00.000Z"),
    });
    const app = await buildServer({
      db,
      logger: false,
      terminal: {
        verifyConnection: async () => ({ connected: true, provider: "mock" }),
        startSale: async () => ({ status: "failed" }),
        cancelCurrentAction: async () => undefined,
        refund: async () => ({ status: "approved" }),
        reconcile: async () => ({
          provider: "mock",
          cardTotalCents: 12000,
          payments: [{
            status: "approved",
            provider: "mock",
            providerPaymentId: "mock-provider-payment",
            externalPaymentId: "recover-card",
            providerOrderId: "mock-order-sale-1",
            saleId: "sale-1",
            baseAmountCents: 12000,
            tipCents: 0,
            totalChargedCents: 12000,
          }],
        }),
      },
    });

    const response = await app.inject({ method: "POST", url: "/api/payments/payment-1/reconcile" });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toMatchObject({ terminalStatus: "approved" });
    expect(state.sale.payments[0]).toMatchObject({
      status: "approved",
      providerPaymentId: "mock-provider-payment",
      amountCents: 12000,
    });
=======
  it("records a refund against a paid sale and marks fully refunded sales", async () => {
    const { db, state } = createCheckoutFakeDb();
    state.sale.status = "paid";
    state.sale.totalCents = 12000;
    state.sale.amountPaidCents = 12000;
    state.sale.payments.push({ id: "payment-1", method: "cash", amountCents: 12000, status: "approved" });
    const app = await buildServer({ db, logger: false });

    const response = await app.inject({
      method: "POST",
      url: "/api/sales/sale-1/refunds",
      payload: { paymentId: "payment-1", amountCents: 12000, reason: "Customer refund" },
    });

    expect(response.statusCode).toBe(201);
    expect(state.sale.refunds).toHaveLength(1);
    expect(state.sale.refunds[0]).toMatchObject({ amountCents: 12000, reason: "Customer refund" });
    expect(state.sale.status).toBe("refunded");
>>>>>>> bdf0b2066dfcb2e3e613cb86c08bdfaba329da34
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

  it("prints and stores a receipt for a paid sale", async () => {
    const { db, state } = createCheckoutFakeDb();
    const printer = new MockReceiptPrinterAdapter();
    state.sale.status = "paid";
    state.sale.totalCents = 5500;
    state.sale.amountPaidCents = 5500;
    state.sale.items.push({ id: "item-1", workerId: "worker-1", priceCents: 5000, discountCents: 0, tipCents: 500, status: "active" });
    state.sale.payments.push({ id: "payment-1", method: "cash", amountCents: 5500, tipCents: 0, status: "approved" });
    const app = await buildServer({ db, logger: false, printer });

    const response = await app.inject({ method: "POST", url: "/api/sales/sale-1/receipts/print" });

    expect(response.statusCode).toBe(201);
    expect(printer.printedReceipts).toHaveLength(1);
    expect(printer.printedReceipts[0]).toMatchObject({
      salonName: "Nail Salon",
      receiptNumber: expect.stringMatching(/^R-/),
      totalCents: 5500,
      paymentSummary: "cash $55.00",
    });
    expect(state.sale.receipts).toHaveLength(1);
    expect(state.sale.receipts[0]).toMatchObject({ saleId: "sale-1", printStatus: "printed" });
  });

  it("rejects receipt printing for an unpaid sale", async () => {
    const { db } = createCheckoutFakeDb();
    const app = await buildServer({ db, logger: false });

    const response = await app.inject({ method: "POST", url: "/api/sales/sale-1/receipts/print" });

    expect(response.statusCode).toBe(409);
    expect(response.json()).toEqual({ error: "receipt can only be printed for a paid sale" });
  });

  it("reprints an existing receipt snapshot", async () => {
    const { db, state } = createCheckoutFakeDb();
    const printer = new MockReceiptPrinterAdapter();
    state.sale.receipts.push({
      id: "receipt-1",
      saleId: "sale-1",
      printStatus: "printed",
      receiptDataJson: {
        salonName: "Nail Salon",
        receiptNumber: "R-TEST",
        issuedAt: "2026-05-14T15:00:00.000Z",
        customerName: "Mary",
        items: [{ serviceName: "Classic Pedicure", workerName: "Amy", amountCents: 5000, tipCents: 1000 }],
        subtotalCents: 5000,
        discountCents: 0,
        tipCents: 1000,
        totalCents: 6000,
        paymentSummary: "cash $60.00",
        payments: [{ method: "cash", amountCents: 6000, tipCents: 0, reference: null }],
      },
    });
    const app = await buildServer({ db, logger: false, printer });

    const response = await app.inject({ method: "POST", url: "/api/sales/sale-1/receipts/receipt-1/reprint" });

    expect(response.statusCode).toBe(200);
    expect(printer.printedReceipts).toHaveLength(1);
    expect(printer.printedReceipts[0]).toMatchObject({ receiptNumber: "R-TEST", totalCents: 6000 });
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
