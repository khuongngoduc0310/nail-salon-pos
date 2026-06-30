import type { FastifyInstance } from "fastify";
import { calculateSaleItem } from "@nail/shared";
import type { DbClient } from "../../db.js";
import { asObject, getParams, handleRouteError, HttpError, optionalInteger, optionalString, requiredInteger, requiredString } from "../../http.js";
import { assertSaleCanEditTicket, assertSaleTotalCoversApprovedPayments, recomputeSale, requireRecord } from "./checkout-helpers.js";
import type { SaleItemRecord, SaleRecord, ServiceRecord, WorkerRecord } from "./types.js";

export function registerCheckoutItemRoutes(app: FastifyInstance, db: DbClient) {
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
}
