import type { FastifyInstance } from "fastify";
import { allocateTipToSaleItems, calculateSaleItem, type TipAllocationMode } from "@nail/shared";
import type { DbClient } from "../../db.js";
import { asObject, getParams, handleRouteError, HttpError, requiredString } from "../../http.js";
import { isTipAlreadyAllocated, recomputeSale, requireRecord, safeJsonObject, saleLookup } from "./checkout-helpers.js";
import type { PaymentRecord, SaleItemRecord, SaleRecord } from "./types.js";

export function registerCheckoutTipAllocationRoutes(app: FastifyInstance, db: DbClient) {
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


}
