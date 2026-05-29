import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import type { PaymentTerminalAdapter, TerminalPaymentStatus } from "@nail/payment-terminal";
import {
  calculateSaleItem,
  summarizeSale,
  type PaymentInput,
  type PaymentMethod,
  type PaymentStatus,
  type SaleItemInput,
} from "@nail/shared";
import type { DbClient } from "../db.js";
import { broadcast } from "../ws/events.js";
import {
  asObject,
  getParams,
  handleRouteError,
  optionalInteger,
  optionalString,
  requiredInteger,
  requiredString,
} from "../http.js";

type ServiceRecord = {
  id: string;
  name: string;
  priceCents: number;
  category?: { name?: string | null } | null;
};

type WorkerRecord = {
  id: string;
  commissionRate: number | string | { toString(): string };
};

type SaleRecord = {
  id: string;
  checkinId?: string | null;
  totalCents: number;
  items?: SaleItemRecord[];
  payments?: PaymentRecord[];
};

type SaleItemRecord = {
  id: string;
  workerId?: string;
  serviceNameSnapshot?: string;
  categoryNameSnapshot?: string | null;
  priceCents: number;
  discountCents: number;
  tipCents: number;
  commissionRateSnapshot?: number | string | { toString(): string };
};

type PaymentRecord = {
  method: PaymentMethod;
  amountCents: number;
  status: PaymentStatus;
};

export async function registerCheckoutRoutes(app: FastifyInstance, db: DbClient, terminal: PaymentTerminalAdapter) {
  app.post("/api/sales", async (request, reply) => {
    try {
      const body = asObject(request.body);

      // Auto-attach current open session
      let sessionId: string | undefined;
      try {
        const openSession = await (db as any).session.findFirst({
          where: { status: "open" },
          orderBy: { openedAt: "desc" },
        });
        sessionId = openSession?.id;
      } catch {
        // session table might not exist yet — that's ok
      }

      const sale = await db.sale.create({
        data: {
          customerId: optionalString(body.customerId, "customerId"),
          appointmentId: optionalString(body.appointmentId, "appointmentId"),
          checkinId: optionalString(body.checkinId, "checkinId"),
          sessionId,
          status: "open",
          subtotalCents: 0,
          discountTotalCents: 0,
          taxTotalCents: 0,
          tipTotalCents: 0,
          totalCents: 0,
          amountPaidCents: 0,
          createdByUserId: optionalString(body.createdByUserId, "createdByUserId"),
        },
      });

      return reply.code(201).send(sale);
    } catch (error) {
      return handleRouteError(error, reply);
    }
  });

  app.post("/api/sales/:id/items", async (request, reply) => {
    try {
      const body = asObject(request.body);
      const params = getParams(request);
      const saleId = requiredString(params.id, "id");
      const serviceId = requiredString(body.serviceId, "serviceId");
      const workerId = requiredString(body.workerId, "workerId");

      const result = await db.$transaction(async (tx) => {
        const service = requireRecord<ServiceRecord>(
          await tx.service.findUnique({ where: { id: serviceId }, include: { category: true } }),
          "service not found"
        );
        const worker = requireRecord<WorkerRecord>(await tx.worker.findUnique({ where: { id: workerId } }), "worker not found");
        const item = calculateSaleItem({
          serviceId,
          workerId,
          serviceNameSnapshot: service.name,
          categoryNameSnapshot: service.category?.name ?? null,
          priceCents: optionalInteger(body.priceCents, "priceCents") ?? service.priceCents,
          discountCents: optionalInteger(body.discountCents, "discountCents") ?? 0,
          tipCents: optionalInteger(body.tipCents, "tipCents") ?? 0,
          commissionRate: Number(worker.commissionRate),
        });

        const saleItem = await tx.saleItem.create({
          data: {
            saleId,
            serviceId: item.serviceId,
            workerId: item.workerId,
            serviceNameSnapshot: item.serviceNameSnapshot,
            categoryNameSnapshot: item.categoryNameSnapshot,
            priceCents: item.priceCents,
            discountCents: item.discountCents,
            finalServiceCents: item.finalServiceCents,
            commissionRateSnapshot: item.commissionRateSnapshot,
            workerCommissionCents: item.workerCommissionCents,
            tipCents: item.tipCents,
            workerTotalCents: item.workerTotalCents,
            businessCents: item.businessCents,
          },
        });
        const sale = await recomputeSale(tx, saleId);

        return { saleItem, sale };
      });

      return reply.code(201).send(result);
    } catch (error) {
      return handleRouteError(error, reply);
    }
  });

  app.delete("/api/sales/:id/items/:itemId", async (request, reply) => {
    try {
      const params = getParams(request);
      const saleId = requiredString(params.id, "id");
      const itemId = requiredString(params.itemId, "itemId");

      const result = await db.$transaction(async (tx) => {
        const item = requireRecord<SaleItemRecord>(
          await tx.saleItem.update({
            where: { id: itemId },
            data: { status: "cancelled" },
          }),
          "sale item not found"
        );
        const sale = await recomputeSale(tx, saleId);

        return { saleItem: item, sale };
      });

      return result;
    } catch (error) {
      return handleRouteError(error, reply);
    }
  });

  app.patch("/api/sales/:id/items/:itemId", async (request, reply) => {
    try {
      const body = asObject(request.body);
      const params = getParams(request);
      const saleId = requiredString(params.id, "id");
      const itemId = requiredString(params.itemId, "itemId");

      const result = await db.$transaction(async (tx) => {
        const existing = requireRecord<SaleItemRecord>(await tx.saleItem.findUnique({ where: { id: itemId } }), "sale item not found");
        const priceCents = optionalInteger(body.priceCents, "priceCents") ?? existing.priceCents;
        const discountCents = optionalInteger(body.discountCents, "discountCents") ?? existing.discountCents;
        const tipCents = optionalInteger(body.tipCents, "tipCents") ?? existing.tipCents;
        const recalculated = calculateSaleItem({
          workerId: optionalString(body.workerId, "workerId") ?? existing.workerId ?? "",
          serviceNameSnapshot: existing.serviceNameSnapshot ?? "Service",
          categoryNameSnapshot: existing.categoryNameSnapshot,
          priceCents,
          discountCents,
          tipCents,
          commissionRate: Number(existing.commissionRateSnapshot ?? 0),
        });
        const saleItem = await tx.saleItem.update({
          where: { id: itemId },
          data: {
            workerId: optionalString(body.workerId, "workerId") ?? existing.workerId,
            priceCents,
            discountCents: recalculated.discountCents,
            tipCents,
            finalServiceCents: recalculated.finalServiceCents,
            workerCommissionCents: recalculated.workerCommissionCents,
            workerTotalCents: recalculated.workerTotalCents,
            businessCents: recalculated.businessCents,
          },
        });
        const sale = await recomputeSale(tx, saleId);

        return { saleItem, sale };
      });

      return result;
    } catch (error) {
      return handleRouteError(error, reply);
    }
  });

  app.post("/api/sales/:id/discounts", async (request, reply) => {
    try {
      const body = asObject(request.body);
      const params = getParams(request);
      const discount = await db.discount.create({
        data: {
          saleId: requiredString(params.id, "id"),
          saleItemId: optionalString(body.saleItemId, "saleItemId"),
          type: requiredString(body.type, "type"),
          amountCents: optionalInteger(body.amountCents, "amountCents"),
          percent: body.percent,
          reason: optionalString(body.reason, "reason"),
          approvedByUserId: optionalString(body.approvedByUserId, "approvedByUserId"),
        },
      });

      return reply.code(201).send(discount);
    } catch (error) {
      return handleRouteError(error, reply);
    }
  });

  app.post("/api/sales/:id/payments/cash", async (request, reply) => {
    return recordApprovedPayment(request, reply, db, "cash");
  });

  app.post("/api/sales/:id/payments/gift-card", async (request, reply) => {
    return recordApprovedPayment(request, reply, db, "gift_card");
  });

  app.post("/api/sales/:id/payments/card/start", async (request, reply) => {
    try {
      const body = asObject(request.body);
      const params = getParams(request);
      const saleId = requiredString(params.id, "id");
      const amountCents = requiredInteger(body.amountCents, "amountCents");
      const tipCents = optionalInteger(body.tipCents, "tipCents") ?? 0;
      const idempotencyKey = requiredString(body.idempotencyKey, "idempotencyKey");
      const terminalResult = await terminal.startSale({ amountCents, tipCents, idempotencyKey });
      const paymentStatus = mapTerminalStatus(terminalResult.status);

      const result = await db.$transaction(async (tx) => {
        const payment = await tx.payment.create({
          data: {
            saleId,
            method: "card",
            provider: "mock",
            providerPaymentId: terminalResult.providerPaymentId,
            idempotencyKey,
            amountCents,
            tipCents,
            status: paymentStatus,
            cardBrand: terminalResult.cardBrand,
            cardLast4: terminalResult.cardLast4,
            authCode: terminalResult.authCode,
            rawProviderReference: {
              status: terminalResult.status,
              message: terminalResult.message,
            },
          },
        });
        const sale = await recomputeSale(tx, saleId);

        return { payment, sale, terminalStatus: terminalResult.status };
      });

      return reply.code(201).send(result);
    } catch (error) {
      return handleRouteError(error, reply);
    }
  });

  app.post("/api/sales/:id/complete", async (request, reply) => {
    try {
      const params = getParams(request);
      const saleId = requiredString(params.id, "id");
      const sale = requireRecord<SaleRecord>(await db.sale.findUnique(saleLookup(saleId)), "sale not found");
      const summary = summarizeSale(toSaleItems(sale.items ?? []), toPayments(sale.payments ?? []));

      if (!summary.canComplete) {
        return reply.code(400).send({ error: "sale is underpaid", ...summary });
      }

      const result = await db.$transaction(async (tx) => {
        const completedSale = await tx.sale.update({
          where: { id: saleId },
          data: {
            status: "paid",
            amountPaidCents: summary.amountPaidCents,
            completedAt: new Date(),
          },
        });
        const checkin = sale.checkinId
          ? await tx.checkin.update({ where: { id: sale.checkinId }, data: { status: "paid" } })
          : null;

        // Stamp turnCount on associated Turn from service turn counts
        const saleItems = await (tx as any).saleItem.findMany({
          where: { saleId, status: "active", serviceId: { not: null } },
          include: { service: true },
        });
        const totalTurnCount = (saleItems as any[]).reduce(
          (sum: number, si: any) => sum + (si.service?.turnCount ?? 1),
          0,
        );
        if (sale.checkinId && totalTurnCount > 0) {
          await (tx as any).turn.updateMany({
            where: { checkinId: sale.checkinId, status: "completed" },
            data: { turnCount: totalTurnCount },
          });
        }

        return { sale: completedSale, checkin, changeDueCents: summary.changeDueCents };
      });

      broadcast("checkout:completed", { result });
      return result;
    } catch (error) {
      return handleRouteError(error, reply);
    }
  });
}

async function recordApprovedPayment(
  request: FastifyRequest,
  reply: FastifyReply,
  db: DbClient,
  method: PaymentMethod
) {
  try {
    const body = asObject(request.body);
    const params = asObject(request.params, "params");
    const saleId = requiredString(params.id, "id");
    const amountCents = requiredInteger(body.amountCents, "amountCents");
    const tipCents = optionalInteger(body.tipCents, "tipCents") ?? 0;
    const result = await db.$transaction(async (tx) => {
      const payment = await tx.payment.create({
        data: {
          saleId,
          method,
          amountCents,
          tipCents,
          status: "approved",
        },
      });
      const sale = await recomputeSale(tx, saleId);

      return { payment, sale };
    });

    return reply.code(201).send(result);
  } catch (error) {
    return handleRouteError(error, reply);
  }
}

async function recomputeSale(db: DbClient, saleId: string) {
  const sale = requireRecord<SaleRecord>(await db.sale.findUnique(saleLookup(saleId)), "sale not found");
  const summary = summarizeSale(toSaleItems(sale.items ?? []), toPayments(sale.payments ?? []));

  return db.sale.update({
    where: { id: saleId },
    data: {
      status: summary.status,
      subtotalCents: summary.subtotalCents,
      discountTotalCents: summary.discountTotalCents,
      tipTotalCents: summary.tipTotalCents,
      totalCents: summary.totalCents,
      amountPaidCents: summary.amountPaidCents,
    },
  });
}

function saleLookup(saleId: string) {
  return {
    where: { id: saleId },
    include: {
      items: { where: { status: "active" } },
      payments: true,
    },
  };
}

function toSaleItems(items: SaleItemRecord[]): SaleItemInput[] {
  return items.map((item) => ({
    priceCents: item.priceCents,
    discountCents: item.discountCents,
    tipCents: item.tipCents,
  }));
}

function toPayments(payments: PaymentRecord[]): PaymentInput[] {
  return payments.map((payment) => ({
    method: payment.method,
    amountCents: payment.amountCents,
    status: payment.status,
  }));
}

function mapTerminalStatus(status: TerminalPaymentStatus): PaymentStatus {
  return status === "approved" ? "approved" : status;
}

function requireRecord<T>(record: unknown | null, message: string): T {
  if (!record) {
    throw new Error(message);
  }

  return record as T;
}
