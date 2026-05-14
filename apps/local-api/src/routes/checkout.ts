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
import {
  asObject,
  getParams,
  handleRouteError,
  HttpError,
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
  customerId?: string | null;
  status?: string;
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
  tipCents?: number;
  status: PaymentStatus;
};

export async function registerCheckoutRoutes(app: FastifyInstance, db: DbClient, terminal: PaymentTerminalAdapter) {
  app.get("/api/sales/:id", async (request, reply) => {
    try {
      const params = getParams(request);
      const sale = requireRecord<SaleRecord>(await db.sale.findUnique(saleLookup(requiredString(params.id, "id"))), "sale not found");

      return sale;
    } catch (error) {
      return handleRouteError(error, reply);
    }
  });

  app.post("/api/sales", async (request, reply) => {
    try {
      const body = asObject(request.body);
      const sale = await db.sale.create({
        data: {
          customerId: optionalString(body.customerId, "customerId"),
          appointmentId: optionalString(body.appointmentId, "appointmentId"),
          checkinId: optionalString(body.checkinId, "checkinId"),
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
      const serviceId = optionalString(body.serviceId, "serviceId");
      const customName = optionalString(body.customName, "customName");
      const workerId = requiredString(body.workerId, "workerId");

      if (!serviceId && !customName) {
        return reply.code(400).send({ error: "serviceId or customName is required" });
      }

      const result = await db.$transaction(async (tx) => {
        const service = serviceId
          ? requireRecord<ServiceRecord>(
              await tx.service.findUnique({ where: { id: serviceId }, include: { category: true } }),
              "service not found"
            )
          : null;
        const worker = requireRecord<WorkerRecord>(await tx.worker.findUnique({ where: { id: workerId } }), "worker not found");
        const item = calculateSaleItem({
          serviceId: serviceId ?? undefined,
          workerId,
          serviceNameSnapshot: customName ?? service!.name,
          categoryNameSnapshot: service?.category?.name ?? null,
          priceCents: optionalInteger(body.priceCents, "priceCents") ?? service?.priceCents ?? 0,
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
        await tx.saleItem.update({ where: { id: itemId }, data: { status: "voided" } });
        const sale = await recomputeSale(tx, saleId);
        return { sale };
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
      // amountCents = balance due before tip. Customer enters tip on Clover Mini.
      const amountCents = requiredInteger(body.amountCents, "amountCents");
      const idempotencyKey = requiredString(body.idempotencyKey, "idempotencyKey");
      const terminalResult = await terminal.startSale({ amountCents, idempotencyKey });
      const paymentStatus = mapTerminalStatus(terminalResult.status);
      // Tip entered by customer on the terminal.
      const tipCents = terminalResult.tipCents ?? 0;
      // Total charged = base + tip; store as amountCents so sale completion math works.
      const totalChargedCents = paymentStatus === "approved" ? amountCents + tipCents : amountCents;

      const result = await db.$transaction(async (tx) => {
        const payment = await tx.payment.create({
          data: {
            saleId,
            method: "card",
            provider: "mock",
            providerPaymentId: terminalResult.providerPaymentId,
            idempotencyKey,
            amountCents: totalChargedCents,
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

        // tipCents returned so the POS can open the tip-distribution review UI.
        return { payment, sale, terminalStatus: terminalResult.status, tipCents };
      });

      return reply.code(201).send(result);
    } catch (error) {
      return handleRouteError(error, reply);
    }
  });

  // Batch-set tip per sale item after the customer enters a tip on the Clover Mini.
  // Body: { items: [{ itemId: string, tipCents: number }] }
  // The POS auto-calculates the split by service value %; the owner can adjust before confirming.
  // Rebalancing is enforced client-side; this endpoint trusts the submitted amounts.
  app.post("/api/sales/:id/tip-distribution", async (request, reply) => {
    try {
      const body = asObject(request.body);
      const params = getParams(request);
      const saleId = requiredString(params.id, "id");
      const rawItems = body.items;

      if (!Array.isArray(rawItems) || rawItems.length === 0) {
        return reply.code(400).send({ error: "items must be a non-empty array" });
      }

      const result = await db.$transaction(async (tx) => {
        const sale = requireRecord<SaleRecord>(await tx.sale.findUnique(saleLookup(saleId)), "sale not found");
        const cardTipApprovedCents = (sale.payments ?? []).reduce((sum, payment) => {
          if (payment.method !== "card" || payment.status !== "approved") return sum;
          return sum + Math.max(0, payment.tipCents ?? 0);
        }, 0);
        if (cardTipApprovedCents <= 0) {
          throw new HttpError(400, "cannot set tip distribution without approved Clover tip");
        }

        let submittedTipCents = 0;
        for (const raw of rawItems) {
          const item = asObject(raw);
          const itemId = requiredString(item.itemId, "itemId");
          const tipCents = requiredInteger(item.tipCents, "tipCents");
          submittedTipCents += tipCents;

          const existing = requireRecord<SaleItemRecord>(
            await tx.saleItem.findUnique({ where: { id: itemId } }),
            `sale item ${itemId} not found`
          );
          const recalculated = calculateSaleItem({
            workerId: existing.workerId ?? "",
            serviceNameSnapshot: existing.serviceNameSnapshot ?? "Service",
            categoryNameSnapshot: existing.categoryNameSnapshot,
            priceCents: existing.priceCents,
            discountCents: existing.discountCents,
            tipCents,
            commissionRate: Number(existing.commissionRateSnapshot ?? 0),
          });
          await tx.saleItem.update({
            where: { id: itemId },
            data: {
              tipCents,
              workerTotalCents: recalculated.workerTotalCents,
              businessCents: recalculated.businessCents,
            },
          });
        }

        console.log(`[DEBUG tip-distribution] saleId: ${saleId}, cardTipApprovedCents: ${cardTipApprovedCents}, submittedTipCents: ${submittedTipCents}`);
        if (submittedTipCents !== cardTipApprovedCents) {
          throw new HttpError(400, "tip distribution must equal approved Clover tip total");
        }

        const recomputed = await recomputeSale(tx, saleId);
        return { sale: recomputed };
      });

      return result;
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
        const completedAt = new Date();
        const completedSale = await tx.sale.update({
          where: { id: saleId },
          data: {
            status: "paid",
            amountPaidCents: summary.amountPaidCents,
            completedAt,
          },
        });
        const workerIds = [...new Set((sale.items ?? []).map((item) => item.workerId).filter(Boolean))] as string[];
        for (const workerId of workerIds) {
          await tx.turn.create({
            data: {
              workerId,
              customerId: sale.customerId ?? undefined,
              checkinId: sale.checkinId ?? undefined,
              saleId,
              turnType: "manual",
              status: "completed",
              startedAt: completedAt,
              endedAt: completedAt,
              completedAt,
            },
          });
        }
        const checkin = sale.checkinId
          ? await tx.checkin.update({ where: { id: sale.checkinId }, data: { status: "paid" } })
          : null;

        return { sale: completedSale, checkin, changeDueCents: summary.changeDueCents };
      });

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
      customer: true,
      checkin: { include: { customer: true } },
      appointment: { include: { customer: true, worker: true } },
      items: { where: { status: "active" }, include: { worker: true, service: true } },
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
