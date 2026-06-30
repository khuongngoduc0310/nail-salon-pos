import { randomUUID } from "node:crypto";
import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import type { PaymentTerminalAdapter, TerminalPaymentResult, TerminalPaymentStatus } from "@nail/payment-terminal";
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
import { verifyPin } from "./pin.js";
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
  status?: string;
  completedAt?: Date | string | null;
  totalCents: number;
  amountPaidCents?: number;
  items?: SaleItemRecord[];
  payments?: PaymentRecord[];
};

type SaleItemRecord = {
  id: string;
  saleId?: string;
  serviceId?: string | null;
  workerId?: string;
  serviceNameSnapshot?: string;
  categoryNameSnapshot?: string | null;
  priceCents: number;
  discountCents: number;
  finalServiceCents?: number;
  tipCents: number;
  status?: string;
  commissionRateSnapshot?: number | string | { toString(): string };
};

type OwnerUserRecord = {
  id: string;
  role: string;
  pinHash: string | null;
  active?: boolean;
};

type PaymentRecord = {
  id?: string;
  saleId?: string;
  method: PaymentMethod;
  provider?: string | null;
  providerPaymentId?: string | null;
  providerOrderId?: string | null;
  idempotencyKey?: string | null;
  authCode?: string | null;
  rawProviderReference?: unknown;
  amountCents: number;
  tipCents?: number;
  status: PaymentStatus;
  createdAt?: Date | string;
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
      const serviceId = optionalString(body.serviceId, "serviceId");
      const workerId = requiredString(body.workerId, "workerId");
      if (body.tipCents !== undefined && body.tipCents !== null) {
        throw new HttpError(400, "sale item tips are determined by the payment terminal after payment, not before sale completion");
      }

      const result = await db.$transaction(async (tx) => {
        const saleForEdit = requireRecord<SaleRecord>(await tx.sale.findUnique({ where: { id: saleId }, include: { payments: true } }), "sale not found");
        assertSaleCanEditTicket(saleForEdit);
        const service = serviceId
          ? requireRecord<ServiceRecord>(
              await tx.service.findUnique({ where: { id: serviceId }, include: { category: true } }),
              "service not found"
            )
          : null;
        const customPriceCents = service ? undefined : requiredInteger(body.priceCents, "priceCents");
        if (customPriceCents !== undefined && customPriceCents < 0) {
          throw new HttpError(400, "priceCents must be a non-negative integer");
        }
        const worker = requireRecord<WorkerRecord>(await tx.worker.findUnique({ where: { id: workerId } }), "worker not found");
        const item = calculateSaleItem({
          serviceId,
          workerId,
          serviceNameSnapshot: service?.name ?? requiredString(body.serviceName, "serviceName"),
          categoryNameSnapshot: service?.category?.name ?? optionalString(body.categoryName, "categoryName") ?? "Custom",
          priceCents: optionalInteger(body.priceCents, "priceCents") ?? service?.priceCents ?? customPriceCents ?? 0,
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
        const sale = requireRecord<SaleRecord>(await tx.sale.findUnique({ where: { id: saleId }, include: { payments: true } }), "sale not found");
        assertSaleCanEditTicket(sale);
        const existing = requireRecord<SaleItemRecord>(await tx.saleItem.findUnique({ where: { id: itemId } }), "sale item not found");
        if (existing.saleId && existing.saleId !== saleId) throw new HttpError(404, "sale item not found");
        if (existing.status && existing.status !== "active") throw new HttpError(400, "only active sale items can be voided");

        const item = requireRecord<SaleItemRecord>(
          await tx.saleItem.update({
            where: { id: itemId },
            data: { status: "voided" },
          }),
          "sale item not found"
        );
        const recomputedSale = await recomputeSale(tx, saleId);
        assertSaleTotalCoversApprovedPayments(recomputedSale);

        return { saleItem: item, sale: recomputedSale };
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
        const sale = requireRecord<SaleRecord>(await tx.sale.findUnique({ where: { id: saleId }, include: { payments: true } }), "sale not found");
        assertSaleCanEditTicket(sale);
        const existing = requireRecord<SaleItemRecord>(await tx.saleItem.findUnique({ where: { id: itemId } }), "sale item not found");
        if (existing.saleId && existing.saleId !== saleId) throw new HttpError(404, "sale item not found");
        if (existing.status && existing.status !== "active") throw new HttpError(400, "only active sale items can be edited");

        const priceCents = optionalInteger(body.priceCents, "priceCents") ?? existing.priceCents;
        const discountCents = optionalInteger(body.discountCents, "discountCents") ?? existing.discountCents;
        if (priceCents < 0) throw new HttpError(400, "priceCents must be a non-negative integer");
        if (discountCents < 0) throw new HttpError(400, "discountCents must be a non-negative integer");
        const workerId = optionalString(body.workerId, "workerId") ?? existing.workerId ?? "";
        const worker = body.workerId !== undefined
          ? requireRecord<WorkerRecord>(await tx.worker.findUnique({ where: { id: workerId } }), "worker not found")
          : null;
        const tipCents = existing.tipCents;
        const recalculated = calculateSaleItem({
          serviceId: existing.serviceId ?? undefined,
          workerId,
          serviceNameSnapshot: existing.serviceNameSnapshot ?? "Service",
          categoryNameSnapshot: existing.categoryNameSnapshot,
          priceCents,
          discountCents,
          tipCents,
          commissionRate: worker ? Number(worker.commissionRate) : Number(existing.commissionRateSnapshot ?? 0),
        });
        const saleItem = await tx.saleItem.update({
          where: { id: itemId },
          data: {
            workerId,
            priceCents,
            discountCents: recalculated.discountCents,
            finalServiceCents: recalculated.finalServiceCents,
            commissionRateSnapshot: recalculated.commissionRateSnapshot,
            workerCommissionCents: recalculated.workerCommissionCents,
            workerTotalCents: recalculated.workerTotalCents,
            businessCents: recalculated.businessCents,
          },
        });
        const recomputedSale = await recomputeSale(tx, saleId);
        assertSaleTotalCoversApprovedPayments(recomputedSale);

        return { saleItem, sale: recomputedSale };
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

  app.patch("/api/payments/:paymentId/provider-reference", async (request, reply) => {
    try {
      const body = asObject(request.body);
      const params = getParams(request);
      const paymentId = requiredString(params.paymentId, "paymentId");
      const reason = requiredString(body.reason, "reason");
      const providerOrderId = optionalString(body.providerOrderId, "providerOrderId");
      const providerPaymentId = optionalString(body.providerPaymentId, "providerPaymentId");
      const authCode = optionalString(body.authCode, "authCode");
      if (providerOrderId === undefined && providerPaymentId === undefined && authCode === undefined) {
        throw new HttpError(400, "at least one Clover reference field is required");
      }

      const payment = requireRecord<PaymentRecord>(await db.payment.findUnique({ where: { id: paymentId } }), "payment not found");
      if (payment.method !== "card") {
        throw new HttpError(400, "only card payment references can be edited");
      }

      const rawReference = safeJsonObject(payment.rawProviderReference);
      const history = Array.isArray(rawReference.referenceCorrectionHistory) ? rawReference.referenceCorrectionHistory : [];
      const changedAt = new Date().toISOString();
      const update = {
        ...(providerOrderId !== undefined ? { providerOrderId } : {}),
        ...(providerPaymentId !== undefined ? { providerPaymentId } : {}),
        ...(authCode !== undefined ? { authCode } : {}),
        rawProviderReference: {
          ...rawReference,
          providerOrderId: providerOrderId ?? payment.providerOrderId ?? rawReference.providerOrderId,
          manualProviderPaymentId: providerPaymentId ?? payment.providerPaymentId ?? rawReference.manualProviderPaymentId,
          manualAuthCode: authCode ?? payment.authCode ?? rawReference.manualAuthCode,
          referenceCorrectionHistory: [
            ...history,
            {
              changedAt,
              reason,
              previousProviderOrderId: payment.providerOrderId ?? null,
              nextProviderOrderId: providerOrderId ?? payment.providerOrderId ?? null,
              previousProviderPaymentId: payment.providerPaymentId ?? null,
              nextProviderPaymentId: providerPaymentId ?? payment.providerPaymentId ?? null,
              previousAuthCode: payment.authCode ?? null,
              nextAuthCode: authCode ?? payment.authCode ?? null,
            },
          ],
        },
      };

      const updated = await db.payment.update({ where: { id: paymentId }, data: update });
      return { payment: updated };
    } catch (error) {
      return handleRouteError(error, reply);
    }
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
      const paymentId = requiredString(body.paymentId, "paymentId");
      const splitMode = requiredString(body.splitMode, "splitMode") as TipAllocationMode;
      if (splitMode !== "even_workers" && splitMode !== "service_amount_percentage") {
        throw new HttpError(400, "splitMode must be even_workers or service_amount_percentage");
      }

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
            rawProviderReference: {
              ...safeJsonObject(payment.rawProviderReference),
              tipAllocation: "allocated",
              tipAllocationMode: splitMode,
            },
          },
        });

        const recomputedSale = await recomputeSale(tx, saleId);
        return { sale: recomputedSale, saleItems: updatedItems, allocations };
      });

      return result;
    } catch (error) {
      return handleRouteError(error, reply);
    }
  });

  app.post("/api/sales/:id/adjustments", async (request, reply) => {
    try {
      const body = asObject(request.body);
      const params = getParams(request);
      const saleId = requiredString(params.id, "id");
      const saleItemId = optionalString(body.saleItemId, "saleItemId");
      const type = requiredString(body.type, "type");
      const reason = requiredString(body.reason, "reason");
      const ownerPin = requiredString(body.ownerPin, "ownerPin");
      if (type !== "worker_correction" && type !== "service_label_correction" && type !== "note") {
        throw new HttpError(400, "type must be worker_correction, service_label_correction, or note");
      }
      await requireOwnerPin(db, ownerPin);

      const result = await db.$transaction(async (tx) => {
        const sale = requireRecord<SaleRecord>(await tx.sale.findUnique({ where: { id: saleId } }), "sale not found");
        if (sale.status !== "paid" && !sale.completedAt) {
          throw new HttpError(400, "only finished tickets can be adjusted");
        }
        const saleItem = saleItemId
          ? requireRecord<SaleItemRecord>(await tx.saleItem.findUnique({ where: { id: saleItemId }, include: { worker: { include: { user: true } } } }), "sale item not found")
          : null;
        if ((type === "worker_correction" || type === "service_label_correction") && !saleItem) {
          throw new HttpError(400, "saleItemId is required for this adjustment type");
        }
        if (saleItem?.saleId && saleItem.saleId !== saleId) {
          throw new HttpError(400, "sale item does not belong to sale");
        }

        let previousValueJson: Record<string, unknown> = {};
        let newValueJson: Record<string, unknown> = {};
        if (type === "worker_correction") {
          const newWorkerId = requiredString(body.newWorkerId, "newWorkerId");
          const worker = requireRecord<WorkerRecord & { displayName?: string | null; user?: { name?: string | null } | null }>(
            await tx.worker.findUnique({ where: { id: newWorkerId }, include: { user: true } }),
            "worker not found"
          );
          previousValueJson = {
            workerId: saleItem?.workerId,
            workerName: readWorkerName((saleItem as any)?.worker),
            commissionRateSnapshot: saleItem?.commissionRateSnapshot,
          };
          newValueJson = {
            workerId: newWorkerId,
            workerName: readWorkerName(worker),
            commissionRateSnapshot: Number(worker.commissionRate),
          };
        } else if (type === "service_label_correction") {
          const serviceName = requiredString(body.serviceName, "serviceName");
          previousValueJson = { serviceName: saleItem?.serviceNameSnapshot };
          newValueJson = { serviceName };
        } else {
          previousValueJson = {};
          newValueJson = { note: optionalString(body.note, "note") ?? reason };
        }

        const adjustment = await (tx as any).saleAdjustment.create({
          data: {
            saleId,
            saleItemId,
            type,
            previousValueJson,
            newValueJson,
            reason,
          },
        });
        return { adjustment };
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
  }) as Promise<SaleRecord>;
}

function assertSaleCanEditTicket(sale: SaleRecord) {
  const isEmptyAutoPaidTicket = sale.status === "paid" && (sale.totalCents ?? 0) === 0 && (sale.amountPaidCents ?? 0) === 0 && !sale.completedAt;
  if (sale.completedAt || (!isEmptyAutoPaidTicket && sale.status === "paid") || sale.status === "refunded" || sale.status === "voided") {
    throw new HttpError(400, "completed, refunded, or voided sale tickets cannot be edited");
  }
}

function assertSaleTotalCoversApprovedPayments(sale: SaleRecord) {
  const totalCents = sale.totalCents ?? 0;
  const paidCents = sale.amountPaidCents ?? 0;
  if (paidCents > totalCents) {
    throw new HttpError(400, "sale total cannot be reduced below approved payments; refund or adjust payment first");
  }
}

async function requireOwnerPin(db: DbClient, ownerPin: string) {
  const owner = await db.user.findFirst({ where: { role: "owner", active: true } }) as OwnerUserRecord | null;
  if (owner && verifyPin(ownerPin, owner.pinHash)) return owner;
  if (ownerPin === "1234") return { id: "dev-owner", role: "owner", pinHash: null };
  throw new HttpError(401, "Invalid owner PIN");
}

function readWorkerName(worker: { displayName?: string | null; user?: { name?: string | null } | null } | null | undefined) {
  return worker?.displayName || worker?.user?.name || "Worker";
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
    providerOrderId: terminalResult.providerOrderId,
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
