import type { FastifyInstance } from "fastify";
import type { DbClient } from "../../db.js";
import { asObject, getParams, handleRouteError, HttpError, optionalString, requiredString } from "../../http.js";
import { readWorkerName, requireOwnerPin, requireRecord } from "./checkout-helpers.js";
import type { SaleItemRecord, SaleRecord, WorkerRecord } from "./types.js";

export function registerCheckoutAdjustmentRoutes(app: FastifyInstance, db: DbClient) {
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


}
