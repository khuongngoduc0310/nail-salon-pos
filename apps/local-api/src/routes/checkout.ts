import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import type { PaymentTerminalAdapter, TerminalPaymentStatus } from "@nail/payment-terminal";
import type { ReceiptDocument, ReceiptPrinterAdapter } from "@nail/receipt-printer";
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
  sessionId?: string | null;
  customerId?: string | null;
  receiptNumber?: string | null;
  status?: string;
  totalCents: number;
  completedAt?: Date | string | null;
  createdAt?: Date | string | null;
  customer?: { name?: string | null; phone?: string | null } | null;
  checkin?: { sessionId?: string | null; customer?: { name?: string | null; phone?: string | null } | null } | null;
  items?: SaleItemRecord[];
  payments?: PaymentRecord[];
  refunds?: RefundRecord[];
};

type SaleItemRecord = {
  id: string;
  workerId?: string;
  serviceNameSnapshot?: string;
  categoryNameSnapshot?: string | null;
  priceCents: number;
  discountCents: number;
  tipCents: number;
  finalServiceCents?: number;
  commissionRateSnapshot?: number | string | { toString(): string };
  worker?: { displayName?: string | null } | null;
};

type PaymentRecord = {
  id?: string;
  method: PaymentMethod;
  amountCents: number;
  tipCents?: number;
  status: PaymentStatus;
  providerPaymentId?: string | null;
  authCode?: string | null;
  cardBrand?: string | null;
  cardLast4?: string | null;
};

type RefundRecord = {
  id?: string;
  saleId?: string;
  paymentId?: string | null;
  amountCents: number;
};

type ReceiptRecord = {
  id: string;
  saleId: string;
  printStatus: string;
  smsStatus?: string | null;
  emailStatus?: string | null;
  receiptDataJson: unknown;
  printedAt?: Date | string | null;
  createdAt?: Date | string | null;
};

export async function registerCheckoutRoutes(
  app: FastifyInstance,
  db: DbClient,
  terminal: PaymentTerminalAdapter,
  printer: ReceiptPrinterAdapter
) {
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
      const checkinId = optionalString(body.checkinId, "checkinId");
      const sale = await db.$transaction(async (tx) => {
        const sessionId = await resolveSaleSessionId(tx, checkinId);
        return tx.sale.create({
          data: {
            sessionId,
            customerId: optionalString(body.customerId, "customerId"),
            appointmentId: optionalString(body.appointmentId, "appointmentId"),
            checkinId,
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

  app.post("/api/sales/:id/refunds", async (request, reply) => {
    try {
      const body = asObject(request.body);
      const params = getParams(request);
      const saleId = requiredString(params.id, "id");
      const paymentId = optionalString(body.paymentId, "paymentId");
      const amountCents = requiredInteger(body.amountCents, "amountCents");
      const reason = optionalString(body.reason, "reason");
      const approvedByUserId = optionalString(body.approvedByUserId, "approvedByUserId");

      const sale = requireRecord<SaleRecord>(await db.sale.findUnique(saleLookup(saleId)), "sale not found");
      if (sale.status !== "paid" && sale.status !== "refunded") {
        return reply.code(409).send({ error: "only paid sales can be refunded" });
      }

      const approvedPayments = (sale.payments ?? []).filter((payment) => payment.status === "approved" || payment.status === "refunded");
      const refundableCents = approvedPayments.reduce((sum, payment) => sum + payment.amountCents, 0);
      const alreadyRefundedCents = (sale.refunds ?? []).reduce((sum, refund) => sum + refund.amountCents, 0);
      if (amountCents <= 0 || alreadyRefundedCents + amountCents > refundableCents) {
        return reply.code(400).send({
          error: "refund amount exceeds refundable total",
          refundableCents: Math.max(0, refundableCents - alreadyRefundedCents),
        });
      }

      const payment = paymentId
        ? approvedPayments.find((candidate) => candidate.id === paymentId)
        : approvedPayments.find((candidate) => candidate.method === "card" && candidate.providerPaymentId) ?? approvedPayments[0];
      if (!payment) {
        return reply.code(400).send({ error: "no approved payment is available to refund" });
      }

      const terminalRefund =
        payment.method === "card" && payment.providerPaymentId
          ? await terminal.refund({ providerPaymentId: payment.providerPaymentId, amountCents, reason })
          : null;
      if (terminalRefund && terminalRefund.status !== "approved") {
        return reply.code(409).send({ error: "terminal refund was not approved", terminalRefund });
      }

      const result = await db.$transaction(async (tx) => {
        const refund = await tx.refund.create({
          data: {
            saleId,
            paymentId: payment.id,
            amountCents,
            reason,
            approvedByUserId,
            providerRefundId: terminalRefund?.providerRefundId,
          },
        });
        const totalRefundedCents = alreadyRefundedCents + amountCents;
        const saleStatus = totalRefundedCents >= refundableCents ? "refunded" : sale.status;
        const updatedSale = await tx.sale.update({
          where: { id: saleId },
          data: { status: saleStatus },
        });

        return { refund, sale: updatedSale, terminalRefund };
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
        const turnSessionId = sale.checkin?.sessionId ?? sale.sessionId ?? undefined;
        for (const workerId of workerIds) {
          await tx.turn.create({
            data: {
              workerId,
              sessionId: turnSessionId,
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

  app.get("/api/sales/:id/receipts", async (request, reply) => {
    try {
      const params = getParams(request);
      const saleId = requiredString(params.id, "id");
      return await db.receipt.findMany({
        where: { saleId },
        orderBy: [{ createdAt: "desc" }],
      });
    } catch (error) {
      return handleRouteError(error, reply);
    }
  });

  app.post("/api/sales/:id/receipts/print", async (request, reply) => {
    try {
      const params = getParams(request);
      const saleId = requiredString(params.id, "id");
      const sale = requireRecord<SaleRecord>(await db.sale.findUnique(saleLookup(saleId)), "sale not found");
      if (sale.status !== "paid") {
        return reply.code(409).send({ error: "receipt can only be printed for a paid sale" });
      }

      const receiptNumber = sale.receiptNumber ?? buildReceiptNumber(sale);
      const receiptDocument = buildReceiptDocument(sale, receiptNumber);
      const printResult = await printer.printReceipt(receiptDocument);
      const receipt = await db.$transaction(async (tx) => {
        if (!sale.receiptNumber) {
          await tx.sale.update({ where: { id: saleId }, data: { receiptNumber } });
        }
        return tx.receipt.create({
          data: {
            saleId,
            printStatus: printResult.success ? "printed" : "failed",
            smsStatus: "not_sent",
            emailStatus: "not_sent",
            receiptDataJson: serializeReceiptDocument(receiptDocument),
            printedAt: printResult.success ? new Date() : null,
          },
        });
      });

      return reply.code(201).send({ receipt, printResult });
    } catch (error) {
      return handleRouteError(error, reply);
    }
  });

  app.post("/api/sales/:id/receipts/:receiptId/reprint", async (request, reply) => {
    try {
      const params = getParams(request);
      const saleId = requiredString(params.id, "id");
      const receiptId = requiredString(params.receiptId, "receiptId");
      const receipts = (await db.receipt.findMany({
        where: { id: receiptId, saleId },
        take: 1,
      })) as ReceiptRecord[];
      const existing = receipts[0];
      if (!existing) {
        return reply.code(404).send({ error: "receipt not found" });
      }

      const receiptDocument = hydrateReceiptDocument(existing.receiptDataJson);
      const printResult = await printer.printReceipt(receiptDocument);
      const receipt = await db.receipt.update({
        where: { id: receiptId },
        data: {
          printStatus: printResult.success ? "printed" : "failed",
          printedAt: printResult.success ? new Date() : existing.printedAt ?? null,
        },
      });

      return { receipt, printResult };
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
      refunds: true,
    },
  };
}

function buildReceiptDocument(sale: SaleRecord, receiptNumber: string): ReceiptDocument {
  const approvedPayments = (sale.payments ?? []).filter((payment) => payment.status === "approved");
  return {
    salonName: "Nail Salon",
    salonAddress: "Store address",
    salonPhone: "Store phone",
    receiptNumber,
    issuedAt: sale.completedAt ? new Date(sale.completedAt) : new Date(),
    customerName: sale.customer?.name ?? sale.checkin?.customer?.name ?? sale.customer?.phone ?? sale.checkin?.customer?.phone ?? null,
    items: (sale.items ?? []).map((item) => ({
      serviceName: item.serviceNameSnapshot ?? "Service",
      workerName: item.worker?.displayName ?? "Worker",
      amountCents: item.finalServiceCents ?? Math.max(0, item.priceCents - item.discountCents),
      tipCents: item.tipCents,
    })),
    subtotalCents: (sale.items ?? []).reduce((sum, item) => sum + item.priceCents, 0),
    discountCents: (sale.items ?? []).reduce((sum, item) => sum + item.discountCents, 0),
    tipCents: (sale.items ?? []).reduce((sum, item) => sum + item.tipCents, 0),
    totalCents: sale.totalCents,
    paymentSummary: buildPaymentSummary(approvedPayments),
    payments: approvedPayments.map((payment) => ({
      method: payment.method,
      amountCents: payment.amountCents,
      tipCents: payment.tipCents ?? 0,
      reference: payment.authCode ?? payment.providerPaymentId ?? payment.cardLast4 ?? null,
    })),
  };
}

function buildPaymentSummary(payments: PaymentRecord[]): string {
  if (payments.length === 0) return "No approved payments";
  return payments
    .map((payment) => `${payment.method.replace("_", " ")} ${formatCents(payment.amountCents)}`)
    .join(", ");
}

function buildReceiptNumber(sale: SaleRecord): string {
  const issuedAt = sale.completedAt ?? sale.createdAt ?? new Date();
  const stamp = new Date(issuedAt).toISOString().slice(0, 10).replace(/-/g, "");
  return `R-${stamp}-${sale.id.slice(0, 8)}`;
}

function serializeReceiptDocument(receipt: ReceiptDocument) {
  return {
    ...receipt,
    issuedAt: receipt.issuedAt.toISOString(),
  };
}

function hydrateReceiptDocument(value: unknown): ReceiptDocument {
  const data = asObject(value, "receiptDataJson");
  return {
    salonName: requiredString(data.salonName, "salonName"),
    salonAddress: optionalString(data.salonAddress, "salonAddress"),
    salonPhone: optionalString(data.salonPhone, "salonPhone"),
    receiptNumber: requiredString(data.receiptNumber, "receiptNumber"),
    issuedAt: new Date(requiredString(data.issuedAt, "issuedAt")),
    customerName: optionalString(data.customerName, "customerName") ?? null,
    items: Array.isArray(data.items)
      ? data.items.map((item) => {
          const raw = asObject(item, "receipt item");
          return {
            serviceName: requiredString(raw.serviceName, "serviceName"),
            workerName: requiredString(raw.workerName, "workerName"),
            amountCents: requiredInteger(raw.amountCents, "amountCents"),
            tipCents: requiredInteger(raw.tipCents, "tipCents"),
          };
        })
      : [],
    subtotalCents: requiredInteger(data.subtotalCents, "subtotalCents"),
    discountCents: requiredInteger(data.discountCents, "discountCents"),
    tipCents: requiredInteger(data.tipCents, "tipCents"),
    totalCents: requiredInteger(data.totalCents, "totalCents"),
    paymentSummary: requiredString(data.paymentSummary, "paymentSummary"),
    payments: Array.isArray(data.payments)
      ? data.payments.map((payment) => {
          const raw = asObject(payment, "receipt payment");
          return {
            method: requiredString(raw.method, "method"),
            amountCents: requiredInteger(raw.amountCents, "amountCents"),
            tipCents: requiredInteger(raw.tipCents, "tipCents"),
            reference: optionalString(raw.reference, "reference") ?? null,
          };
        })
      : [],
  };
}

function formatCents(cents: number): string {
  return `$${(cents / 100).toFixed(2)}`;
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

async function resolveSaleSessionId(db: DbClient, checkinId: string | undefined): Promise<string | undefined> {
  if (checkinId) {
    const checkins = (await db.checkin.findMany({
      where: { id: checkinId },
      take: 1,
    })) as Array<{ sessionId?: string | null }>;
    return checkins[0]?.sessionId ?? undefined;
  }

  const sessions = (await db.workSession.findMany({
    where: { status: "open" },
    orderBy: [{ openedAt: "desc" }],
    take: 1,
  })) as Array<{ id: string }>;
  return sessions[0]?.id;
}
