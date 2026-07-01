import { randomUUID } from "node:crypto";
import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import type { PaymentTerminalAdapter, TerminalPaymentResult, TerminalPaymentStatus } from "@nail/payment-terminal";
import type { PaymentMethod, PaymentStatus } from "@nail/shared";
import type { DbClient } from "../../db.js";
import { asObject, getParams, handleRouteError, HttpError, optionalInteger, optionalString, requiredInteger, requiredString } from "../../http.js";
import { recomputeSale, requireOwnerPin, requireRecord, safeJsonObject, readReferenceString } from "./checkout-helpers.js";
import type { PaymentRecord, SaleRecord } from "./types.js";

export function registerCheckoutPaymentRoutes(app: FastifyInstance, db: DbClient, terminal: PaymentTerminalAdapter) {
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

  app.post("/api/sales/:id/payments/recover-clover", async (request, reply) => {
    return recoverCloverPayment(request, reply, db);
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

async function recoverCloverPayment(
  request: FastifyRequest,
  reply: FastifyReply,
  db: DbClient
) {
  try {
    const body = asObject(request.body);
    const params = getParams(request);
    const saleId = requiredString(params.id, "id");
    const amountCents = requiredInteger(body.amountCents, "amountCents");
    const tipCents = optionalInteger(body.tipCents, "tipCents") ?? 0;
    const providerOrderId = optionalString(body.providerOrderId, "providerOrderId");
    const providerPaymentId = optionalString(body.providerPaymentId, "providerPaymentId");
    const authCode = optionalString(body.authCode, "authCode");
    const cardBrand = optionalString(body.cardBrand, "cardBrand");
    const cardLast4 = optionalString(body.cardLast4, "cardLast4");
    const reason = requiredString(body.reason, "reason");
    const ownerPin = requiredString(body.ownerPin, "ownerPin");

    if (amountCents <= 0) throw new HttpError(400, "amountCents must be a positive integer");
    if (tipCents < 0) throw new HttpError(400, "tipCents cannot be negative");
    if (tipCents > amountCents) throw new HttpError(400, "tipCents cannot exceed amountCents");
    if (providerOrderId === undefined && providerPaymentId === undefined && authCode === undefined) {
      throw new HttpError(400, "at least one Clover reference field is required");
    }
    if (cardLast4 !== undefined && !/^\d{4}$/.test(cardLast4)) {
      throw new HttpError(400, "cardLast4 must be exactly 4 digits");
    }

    await requireOwnerPin(db, ownerPin);

    const result = await db.$transaction(async (tx) => {
      const sale = requireRecord<SaleRecord>(await tx.sale.findUnique({ where: { id: saleId } }), "sale not found");
      if (sale.completedAt || sale.status === "refunded" || sale.status === "voided") {
        throw new HttpError(400, "completed, refunded, or voided sale tickets cannot receive recovered payments");
      }

      const duplicate = await findDuplicateCloverPayment(tx, { providerOrderId, providerPaymentId, authCode }, saleId);
      if (duplicate) {
        throw new HttpError(400, "this Clover payment reference is already attached to another ticket");
      }

      const recoveredAt = new Date().toISOString();
      const payment = await tx.payment.create({
        data: {
          saleId,
          method: "card",
          provider: "clover",
          amountCents,
          tipCents,
          status: "approved",
          providerOrderId,
          providerPaymentId,
          authCode,
          cardBrand,
          cardLast4,
          rawProviderReference: {
            status: "approved",
            recovered: true,
            recoverySource: "manual_clover_recovery",
            recoveryReason: reason,
            recoveredAt,
            providerOrderId,
            providerPaymentId,
            authCode,
            cardBrand,
            cardLast4,
            totalChargedCents: amountCents,
            tipCents,
            tipAllocation: tipCents > 0 ? "pending" : "not_applicable",
          },
        },
      });

      await tx.saleAdjustment.create({
        data: {
          saleId,
          type: "note",
          previousValueJson: {},
          newValueJson: {
            note: "Manual Clover payment recovery",
            amountCents,
            tipCents,
            providerOrderId,
            providerPaymentId,
            authCode,
            recoveredAt,
          },
          reason,
        },
      });

      const updatedSale = await recomputeSale(tx, saleId);
      return { payment, sale: updatedSale, requiresTipAllocation: tipCents > 0 };
    });

    return reply.code(201).send(result);
  } catch (error) {
    return handleRouteError(error, reply);
  }
}

async function findDuplicateCloverPayment(
  db: DbClient,
  refs: { providerOrderId?: string; providerPaymentId?: string; authCode?: string },
  saleId: string
): Promise<PaymentRecord | null> {
  const or = [
    refs.providerOrderId ? { providerOrderId: refs.providerOrderId } : null,
    refs.providerPaymentId ? { providerPaymentId: refs.providerPaymentId } : null,
    refs.authCode ? { authCode: refs.authCode } : null,
  ].filter(Boolean);
  if (or.length === 0) return null;
  const matches = await db.payment.findMany({
    where: {
      method: "card",
      provider: "clover",
      OR: or,
    },
  }) as PaymentRecord[];
  return matches.find((payment) => payment.saleId !== saleId || payment.status === "approved") ?? null;
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
