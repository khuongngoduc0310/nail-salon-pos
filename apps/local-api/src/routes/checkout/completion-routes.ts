import type { FastifyInstance } from "fastify";
import { summarizeSale } from "@nail/shared";
import type { DbClient } from "../../db.js";
import { getParams, handleRouteError, HttpError, requiredString } from "../../http.js";
import { broadcast } from "../../ws/events.js";
import { isTipAlreadyAllocated, requireRecord, saleLookup, toPayments, toSaleItems } from "./checkout-helpers.js";
import type { SaleRecord } from "./types.js";

export function registerCheckoutCompletionRoutes(app: FastifyInstance, db: DbClient) {
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
