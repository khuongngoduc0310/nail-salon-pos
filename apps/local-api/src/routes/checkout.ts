import type { FastifyInstance } from "fastify";
import type { PaymentTerminalAdapter } from "@nail/payment-terminal";
import type { DbClient } from "../db.js";
import { asObject, getParams, handleRouteError, optionalInteger, optionalString, requiredString } from "../http.js";
import { registerCheckoutAdjustmentRoutes } from "./checkout/adjustment-routes.js";
import { registerCheckoutCompletionRoutes } from "./checkout/completion-routes.js";
import { registerCheckoutItemRoutes } from "./checkout/item-routes.js";
import { registerCheckoutPaymentRoutes } from "./checkout/payment-routes.js";
import { registerCheckoutTipAllocationRoutes } from "./checkout/tip-allocation-routes.js";

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

  registerCheckoutItemRoutes(app, db);

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

  registerCheckoutPaymentRoutes(app, db, terminal);

  registerCheckoutTipAllocationRoutes(app, db);

  registerCheckoutAdjustmentRoutes(app, db);
  registerCheckoutCompletionRoutes(app, db);

}

