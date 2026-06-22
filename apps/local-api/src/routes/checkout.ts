import { randomUUID } from "node:crypto";
import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
<<<<<<< HEAD
import type { PaymentTerminalAdapter, TerminalPaymentResult, TerminalPaymentStatus } from "@nail/payment-terminal";
=======
import type { PaymentTerminalAdapter, TerminalPaymentStatus } from "@nail/payment-terminal";
import type { ReceiptDocument, ReceiptPrinterAdapter } from "@nail/receipt-printer";
>>>>>>> bdf0b2066dfcb2e3e613cb86c08bdfaba329da34
import {
  allocateTipToSaleItems,
  calculateSaleItem,
  summarizeSale,
  type PaymentInput,
  type PaymentMethod,
  type PaymentStatus,
  type SaleItemInput,
  type TipAllocationMode,
} from "@nail/shared";
import type { DbClient } from "../db.js";
import { broadcast } from "../ws/events.js";
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
  finalServiceCents?: number;
  tipCents: number;
  finalServiceCents?: number;
  commissionRateSnapshot?: number | string | { toString(): string };
  worker?: { displayName?: string | null } | null;
};

type PaymentRecord = {
  id?: string;
<<<<<<< HEAD
  saleId?: string;
=======
>>>>>>> bdf0b2066dfcb2e3e613cb86c08bdfaba329da34
  method: PaymentMethod;
  provider?: string | null;
  providerPaymentId?: string | null;
  idempotencyKey?: string | null;
  rawProviderReference?: unknown;
  amountCents: number;
  tipCents?: number;
  status: PaymentStatus;
<<<<<<< HEAD
  createdAt?: Date | string;
=======
  providerPaymentId?: string | null;
  authCode?: string | null;
  cardBrand?: string | null;
  cardLast4?: string | null;
>>>>>>> bdf0b2066dfcb2e3e613cb86c08bdfaba329da34
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
<<<<<<< HEAD

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
=======
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
>>>>>>> bdf0b2066dfcb2e3e613cb86c08bdfaba329da34
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
<<<<<<< HEAD
=======
      const customName = optionalString(body.customName, "customName");
>>>>>>> bdf0b2066dfcb2e3e613cb86c08bdfaba329da34
      const workerId = requiredString(body.workerId, "workerId");
      if (body.tipCents !== undefined && body.tipCents !== null) {
        throw new HttpError(400, "sale item tips are determined by the payment terminal after payment, not before sale completion");
      }

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
<<<<<<< HEAD
        const customPriceCents = service ? undefined : requiredInteger(body.priceCents, "priceCents");
        if (customPriceCents !== undefined && customPriceCents < 0) {
          throw new HttpError(400, "priceCents must be a non-negative integer");
        }
=======
>>>>>>> bdf0b2066dfcb2e3e613cb86c08bdfaba329da34
        const worker = requireRecord<WorkerRecord>(await tx.worker.findUnique({ where: { id: workerId } }), "worker not found");
        const item = calculateSaleItem({
          serviceId: serviceId ?? undefined,
          workerId,
<<<<<<< HEAD
          serviceNameSnapshot: service?.name ?? requiredString(body.serviceName, "serviceName"),
          categoryNameSnapshot: service?.category?.name ?? optionalString(body.categoryName, "categoryName") ?? "Custom",
          priceCents: optionalInteger(body.priceCents, "priceCents") ?? service?.priceCents ?? customPriceCents ?? 0,
=======
          serviceNameSnapshot: customName ?? service!.name,
          categoryNameSnapshot: service?.category?.name ?? null,
          priceCents: optionalInteger(body.priceCents, "priceCents") ?? service?.priceCents ?? 0,
>>>>>>> bdf0b2066dfcb2e3e613cb86c08bdfaba329da34
          discountCents: optionalInteger(body.discountCents, "discountCents") ?? 0,
          tipCents: 0,
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
<<<<<<< HEAD
        const item = requireRecord<SaleItemRecord>(
          await tx.saleItem.update({
            where: { id: itemId },
            data: { status: "voided" },
          }),
          "sale item not found"
        );
        const sale = await recomputeSale(tx, saleId);

        return { saleItem: item, sale };
=======
        await tx.saleItem.update({ where: { id: itemId }, data: { status: "voided" } });
        const sale = await recomputeSale(tx, saleId);
        return { sale };
>>>>>>> bdf0b2066dfcb2e3e613cb86c08bdfaba329da34
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
      if (body.tipCents !== undefined && body.tipCents !== null) {
        throw new HttpError(400, "sale item tips are determined by the payment terminal after payment, not before sale completion");
      }

      const result = await db.$transaction(async (tx) => {
        const existing = requireRecord<SaleItemRecord>(await tx.saleItem.findUnique({ where: { id: itemId } }), "sale item not found");
        const priceCents = optionalInteger(body.priceCents, "priceCents") ?? existing.priceCents;
        const discountCents = optionalInteger(body.discountCents, "discountCents") ?? existing.discountCents;
        const tipCents = existing.tipCents;
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

  app.post("/api/sales/:id/payments/card", async (request, reply) => {
    return startCardPayment(request, reply, db, terminal);
  });

  app.post("/api/sales/:id/payments/card/start", async (request, reply) => {
    return startCardPayment(request, reply, db, terminal);
  });

  app.post("/api/payments/:paymentId/reconcile", async (request, reply) => {
    try {
      const params = getParams(request);
      const paymentId = requiredString(params.paymentId, "paymentId");
      const payment = requireRecord<PaymentRecord>(await db.payment.findUnique({ where: { id: paymentId } }), "payment not found");
      if (payment.method !== "card") {
        throw new HttpError(400, "only card payments can be reconciled with the payment terminal");
      }
      if (payment.status === "approved" || payment.status === "refunded") {
        return { payment, terminalStatus: payment.status };
      }

      const createdAt = payment.createdAt ? new Date(payment.createdAt) : new Date(0);
      const reconcileResult = await terminal.reconcile({ start: createdAt, end: new Date(), externalPaymentId: payment.idempotencyKey ?? undefined });
      const terminalPayment = reconcileResult.payments.find((candidate) => matchesTerminalPayment(payment, candidate));
      if (!terminalPayment || terminalPayment.status !== "approved") {
        return { payment, terminalStatus: terminalPayment?.status ?? "not_found" };
      }

      const returnedTipCents = terminalPayment.tipCents ?? 0;
      const chargedAmountCents = terminalPayment.totalChargedCents ?? payment.amountCents + returnedTipCents;
      const result = await db.$transaction(async (tx) => {
        const updatedPayment = await tx.payment.update({
          where: { id: paymentId },
          data: paymentUpdateFromTerminalResult(terminalPayment, payment.amountCents),
        });
        const sale = payment.saleId ? await recomputeSale(tx, payment.saleId) : null;
        return { payment: updatedPayment, sale, terminalStatus: terminalPayment.status, chargedAmountCents };
      });

      return result;
    } catch (error) {
      return handleRouteError(error, reply);
    }
  });

  app.post("/api/sales/:id/tips/allocate", async (request, reply) => {
    try {
      const body = asObject(request.body);
      const params = getParams(request);
      const saleId = requiredString(params.id, "id");
<<<<<<< HEAD
      const paymentId = requiredString(body.paymentId, "paymentId");
      const splitMode = requiredString(body.splitMode, "splitMode") as TipAllocationMode;
      if (splitMode !== "even_workers" && splitMode !== "service_amount_percentage") {
        throw new HttpError(400, "splitMode must be even_workers or service_amount_percentage");
      }
=======
      // amountCents = balance due before tip. Customer enters tip on Clover Mini.
      const amountCents = requiredInteger(body.amountCents, "amountCents");
      const idempotencyKey = requiredString(body.idempotencyKey, "idempotencyKey");
      const terminalResult = await terminal.startSale({ amountCents, idempotencyKey });
      const paymentStatus = mapTerminalStatus(terminalResult.status);
      // Tip entered by customer on the terminal.
      const tipCents = terminalResult.tipCents ?? 0;
      // Total charged = base + tip; store as amountCents so sale completion math works.
      const totalChargedCents = paymentStatus === "approved" ? amountCents + tipCents : amountCents;
>>>>>>> bdf0b2066dfcb2e3e613cb86c08bdfaba329da34

      const result = await db.$transaction(async (tx) => {
        const payment = requireRecord<PaymentRecord>(await tx.payment.findUnique({ where: { id: paymentId } }), "payment not found");
        if (payment.saleId && payment.saleId !== saleId) {
          throw new HttpError(400, "payment does not belong to sale");
        }
        if (payment.method !== "card" || payment.status !== "approved") {
          throw new HttpError(400, "only approved card tips can be allocated");
        }
        if ((payment.tipCents ?? 0) <= 0) {
          throw new HttpError(400, "payment has no terminal tip to allocate");
        }
        if (isTipAlreadyAllocated(payment.rawProviderReference)) {
          throw new HttpError(400, "payment tip has already been allocated");
        }

        const sale = requireRecord<SaleRecord>(await tx.sale.findUnique(saleLookup(saleId)), "sale not found");
        const saleItems = (sale.items ?? []).filter((item) => item.workerId);
        if (saleItems.length === 0) {
          throw new HttpError(400, "sale has no active service items for tip allocation");
        }

        const allocations = allocateTipToSaleItems(
          saleItems.map((item) => ({
            id: item.id,
            workerId: item.workerId ?? "",
            finalServiceCents: item.finalServiceCents ?? Math.max(0, item.priceCents - item.discountCents),
            tipCents: item.tipCents,
          })),
          payment.tipCents ?? 0,
          splitMode
        );

        const updatedItems = [];
        for (const allocation of allocations) {
          const existing = requireRecord<SaleItemRecord>(
            saleItems.find((item) => item.id === allocation.itemId) ?? null,
            "sale item not found"
          );
          const recalculated = calculateSaleItem({
            workerId: existing.workerId ?? "",
            serviceNameSnapshot: existing.serviceNameSnapshot ?? "Service",
            categoryNameSnapshot: existing.categoryNameSnapshot,
            priceCents: existing.priceCents,
            discountCents: existing.discountCents,
            tipCents: allocation.tipCents,
            commissionRate: Number(existing.commissionRateSnapshot ?? 0),
          });
          updatedItems.push(await tx.saleItem.update({
            where: { id: allocation.itemId },
            data: {
              tipCents: allocation.tipCents,
              workerTotalCents: recalculated.workerTotalCents,
              businessCents: recalculated.businessCents,
            },
          }));
        }

        await tx.payment.update({
          where: { id: paymentId },
          data: {
<<<<<<< HEAD
=======
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
>>>>>>> bdf0b2066dfcb2e3e613cb86c08bdfaba329da34
            rawProviderReference: {
              ...safeJsonObject(payment.rawProviderReference),
              tipAllocation: "allocated",
              tipAllocationMode: splitMode,
            },
          },
        });

<<<<<<< HEAD
        const recomputedSale = await recomputeSale(tx, saleId);
        return { sale: recomputedSale, saleItems: updatedItems, allocations };
=======
        // tipCents returned so the POS can open the tip-distribution review UI.
        return { payment, sale, terminalStatus: terminalResult.status, tipCents };
>>>>>>> bdf0b2066dfcb2e3e613cb86c08bdfaba329da34
      });

      return result;
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
      const unallocatedTipPayment = (sale.payments ?? []).find(
        (payment) => payment.method === "card" && payment.status === "approved" && (payment.tipCents ?? 0) > 0 && !isTipAlreadyAllocated(payment.rawProviderReference)
      );
      if (unallocatedTipPayment) {
        return reply.code(400).send({ error: "card tip must be allocated before sale completion" });
      }
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

async function startCardPayment(
  request: FastifyRequest,
  reply: FastifyReply,
  db: DbClient,
  terminal: PaymentTerminalAdapter
) {
  try {
    const body = asObject(request.body);
    const params = getParams(request);
    const saleId = requiredString(params.id, "id");
    const amountCents = requiredInteger(body.amountCents, "amountCents");
    const idempotencyKey = optionalString(body.idempotencyKey, "idempotencyKey") ?? randomUUID();
    if (amountCents <= 0) {
      throw new HttpError(400, "amountCents must be a positive integer");
    }

    const pendingPayment = await db.payment.create({
      data: {
        saleId,
        method: "card",
        provider: "terminal",
        idempotencyKey,
        amountCents,
        tipCents: 0,
        status: "pending",
        rawProviderReference: {
          status: "pending",
          tipAllocation: "not_applicable",
          externalPaymentId: idempotencyKey,
          saleId,
        },
      },
    }) as { id: string };

    try {
      const terminalResult = await terminal.startSale({ amountCents, tipCents: 0, idempotencyKey, saleId });
      const result = await db.$transaction(async (tx) => {
        const payment = await tx.payment.update({
          where: { id: pendingPayment.id },
          data: paymentUpdateFromTerminalResult(terminalResult, amountCents),
        });
        const sale = await recomputeSale(tx, saleId);

        return { payment, sale, terminalStatus: terminalResult.status };
      });

      return reply.code(201).send(result);
    } catch (terminalError) {
      const message = terminalError instanceof Error ? terminalError.message : "Payment terminal request failed";

      try {
        const reconcileResult = await terminal.reconcile({ start: new Date(Date.now() - 10 * 60 * 1000), end: new Date(), externalPaymentId: idempotencyKey });
        const recoveredPayment = reconcileResult.payments.find((candidate) =>
          candidate.status === "approved" && matchesTerminalPayment({ method: "card", status: "pending", idempotencyKey, amountCents, providerPaymentId: null, rawProviderReference: { saleId } }, candidate)
        );
        if (recoveredPayment) {
          const recoveredResult = await db.$transaction(async (tx) => {
            const payment = await tx.payment.update({
              where: { id: pendingPayment.id },
              data: paymentUpdateFromTerminalResult(recoveredPayment, amountCents),
            });
            const sale = await recomputeSale(tx, saleId);
            return { payment, sale, terminalStatus: recoveredPayment.status, recovered: true };
          });
          return reply.code(201).send(recoveredResult);
        }
      } catch {
        // Keep the original terminal error below; recovery is best-effort.
      }

      const result = await db.$transaction(async (tx) => {
        const payment = await tx.payment.update({
          where: { id: pendingPayment.id },
          data: {
            status: "failed",
            rawProviderReference: {
              status: "failed",
              message,
              baseAmountCents: amountCents,
              tipCents: 0,
              totalChargedCents: 0,
              externalPaymentId: idempotencyKey,
              saleId,
              tipAllocation: "not_applicable",
            },
          },
        });
        const sale = await recomputeSale(tx, saleId);
        return { payment, sale, terminalStatus: "failed" };
      });

      return reply.code(201).send(result);
    }
  } catch (error) {
    return handleRouteError(error, reply);
  }
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

function matchesTerminalPayment(payment: PaymentRecord, candidate: TerminalPaymentResult): boolean {
  const paymentReference = safeJsonObject(payment.rawProviderReference);
  const candidateReference = safeJsonObject(candidate.rawProviderReference);
  const candidateProviderReference = safeJsonObject(candidateReference.providerReference);
  const candidatePaymentReference = safeJsonObject(candidateReference.payment);
  const candidateOrderReference = safeJsonObject(candidateReference.order ?? candidatePaymentReference.order);
  const expectedExternalPaymentId = readReferenceString(paymentReference.externalPaymentId) ?? payment.idempotencyKey ?? undefined;
  const expectedProviderOrderId = readReferenceString(paymentReference.providerOrderId);
  const expectedSaleId = readReferenceString(paymentReference.saleId) ?? payment.saleId;
  const candidateExternalPaymentId = candidate.externalPaymentId
    ?? readReferenceString(candidateReference.externalPaymentId)
    ?? readReferenceString(candidateProviderReference.externalPaymentId)
    ?? readReferenceString(candidatePaymentReference.externalPaymentId);
  const candidateProviderOrderId = candidate.providerOrderId
    ?? readReferenceString(candidateReference.providerOrderId)
    ?? readReferenceString(candidateProviderReference.providerOrderId)
    ?? readReferenceString(candidateProviderReference.orderId)
    ?? readReferenceString(candidateOrderReference.id);
  const candidateSaleId = candidate.saleId
    ?? readReferenceString(candidateReference.saleId)
    ?? readReferenceString(candidateProviderReference.saleId)
    ?? readReferenceString(candidatePaymentReference.saleId);

  return Boolean(
    (payment.providerPaymentId && candidate.providerPaymentId === payment.providerPaymentId) ||
    (expectedExternalPaymentId && candidateExternalPaymentId === expectedExternalPaymentId) ||
    (expectedProviderOrderId && candidateProviderOrderId === expectedProviderOrderId) ||
    (expectedSaleId && candidateSaleId === expectedSaleId && terminalAmountCanMatch(payment, candidate))
  );
}

function terminalAmountCanMatch(payment: PaymentRecord, candidate: TerminalPaymentResult): boolean {
  return candidate.baseAmountCents === payment.amountCents || candidate.totalChargedCents === payment.amountCents;
}

function paymentUpdateFromTerminalResult(terminalResult: {
  status: TerminalPaymentStatus;
  provider?: "mock" | "clover";
  providerPaymentId?: string;
  providerOrderId?: string;
  externalPaymentId?: string;
  saleId?: string;
  authCode?: string;
  cardBrand?: string;
  cardLast4?: string;
  baseAmountCents?: number;
  tipCents?: number;
  totalChargedCents?: number;
  message?: string;
  rawProviderReference?: Record<string, unknown>;
}, requestedAmountCents: number) {
  const paymentStatus = mapTerminalStatus(terminalResult.status);
  const returnedTipCents = paymentStatus === "approved" ? terminalResult.tipCents ?? 0 : 0;
  const chargedAmountCents = paymentStatus === "approved"
    ? terminalResult.totalChargedCents ?? requestedAmountCents + returnedTipCents
    : requestedAmountCents;

  return {
    provider: terminalResult.provider ?? "mock",
    providerPaymentId: terminalResult.providerPaymentId,
    amountCents: chargedAmountCents,
    tipCents: returnedTipCents,
    status: paymentStatus,
    cardBrand: terminalResult.cardBrand,
    cardLast4: terminalResult.cardLast4,
    authCode: terminalResult.authCode,
    rawProviderReference: {
      status: terminalResult.status,
      message: terminalResult.message,
      baseAmountCents: terminalResult.baseAmountCents ?? requestedAmountCents,
      tipCents: returnedTipCents,
      totalChargedCents: chargedAmountCents,
      externalPaymentId: terminalResult.externalPaymentId,
      providerOrderId: terminalResult.providerOrderId,
      saleId: terminalResult.saleId,
      providerReference: terminalResult.rawProviderReference,
      tipAllocation: returnedTipCents > 0 ? "pending" : "not_applicable",
    },
  };
}

function safeJsonObject(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {};
}

function readReferenceString(value: unknown): string | undefined {
  return typeof value === "string" && value.trim() ? value : undefined;
}

function isTipAlreadyAllocated(value: unknown): boolean {
  return safeJsonObject(value).tipAllocation === "allocated";
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
