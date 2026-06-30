import { calculateFinalServiceCents, readCents } from "@nail/shared";
import { applyItemAdjustments, toAdjustmentReport } from "./report-adjustments.js";

export function buildTicketSalesReport(sales: any[], workerId?: string) {
  const tickets = sales
    .map((sale) => buildTicketReport(sale, workerId))
    .filter(Boolean);

  const summary = tickets.reduce((totals: Record<string, number>, ticket: any) => {
    totals.grossServiceSalesCents += ticket.totals.grossServiceCents;
    totals.discountTotalCents += ticket.totals.discountCents;
    totals.refundTotalCents += ticket.totals.refundCents;
    totals.netServiceSalesCents += ticket.totals.serviceCents;
    totals.tipTotalCents += ticket.totals.tipsCents;
    totals.workerCommissionPayoutCents += ticket.totals.commissionCents;
    totals.workerTipsPayoutCents += ticket.totals.tipsCents;
    totals.totalPayCents += ticket.totals.payCents;
    totals.cashTotalCents += ticket.totals.cashCents;
    totals.cardTotalCents += ticket.totals.cardCents;
    totals.giftCardTotalCents += ticket.totals.giftCardCents;
    totals.totalCollectedCents += ticket.totals.collectedCents;
    return totals;
  }, {
    grossServiceSalesCents: 0,
    discountTotalCents: 0,
    refundTotalCents: 0,
    netServiceSalesCents: 0,
    tipTotalCents: 0,
    workerCommissionPayoutCents: 0,
    workerTipsPayoutCents: 0,
    totalPayCents: 0,
    cashTotalCents: 0,
    cardTotalCents: 0,
    giftCardTotalCents: 0,
    totalCollectedCents: 0,
  });

  return {
    summary,
    sales: tickets,
  };
}

function buildTicketReport(sale: any, workerId?: string) {
  const adjustments = sale.adjustments || [];
  const activeItems = (sale.items || []).filter(isReportableSaleItem).map((item: any) => applyItemAdjustments(item, adjustments));
  const reportItems = workerId
    ? activeItems.filter((item: any) => item.workerId === workerId)
    : activeItems;

  if (reportItems.length === 0) return null;

  const approvedPayments = (sale.payments || []).filter((payment: any) => payment.status === "approved");
  const serviceLines = reportItems.map((item: any) => {
    const priceCents = cents(item.priceCents);
    const discountCents = cents(item.discountCents);
    const finalServiceCents = getFinalServiceCents(item);
    const commissionCents = getCommissionCents(item);
    const tipsCents = cents(item.tipCents);

    return {
      id: item.id,
      serviceName: item.serviceNameSnapshot,
      workerId: item.workerId,
      workerName: item.workerName ?? (item.worker?.displayName || item.worker?.user?.name || "Worker"),
      priceCents,
      discountCents,
      finalServiceCents,
      commissionCents,
      tipsCents,
      payCents: commissionCents + tipsCents,
    };
  });

  const grossServiceCents = serviceLines.reduce((sum: number, line: any) => sum + line.priceCents, 0);
  const discountCents = serviceLines.reduce((sum: number, line: any) => sum + line.discountCents, 0);
  const serviceCents = serviceLines.reduce((sum: number, line: any) => sum + line.finalServiceCents, 0);
  const commissionCents = serviceLines.reduce((sum: number, line: any) => sum + line.commissionCents, 0);
  const tipsCents = serviceLines.reduce((sum: number, line: any) => sum + line.tipsCents, 0);
  const payCents = commissionCents + tipsCents;
  const refundCents = workerId ? 0 : (sale.refunds || []).reduce((sum: number, refund: any) => sum + (refund.amountCents || 0), 0);
  const paymentTotals = approvedPayments.reduce((totals: Record<string, number>, payment: any) => {
    if (payment.method === "cash") totals.cashCents += payment.amountCents || 0;
    else if (payment.method === "card") totals.cardCents += payment.amountCents || 0;
    else if (payment.method === "gift_card") totals.giftCardCents += payment.amountCents || 0;
    totals.collectedCents += payment.amountCents || 0;
    return totals;
  }, { cashCents: 0, cardCents: 0, giftCardCents: 0, collectedCents: 0 });

  const collectedCents = workerId ? serviceCents + tipsCents : paymentTotals.collectedCents;

  return {
    id: sale.id,
    completedAt: sale.completedAt,
    customerName: sale.customer?.name ?? "Walk-in",
    paymentMethods: Array.from(new Set(approvedPayments.map((payment: any) => payment.method))),
    services: serviceLines,
    adjustments: adjustments.map(toAdjustmentReport),
    totals: {
      grossServiceCents,
      discountCents,
      refundCents,
      serviceCents,
      commissionCents,
      tipsCents,
      payCents,
      cashCents: workerId ? 0 : paymentTotals.cashCents,
      cardCents: workerId ? 0 : paymentTotals.cardCents,
      giftCardCents: workerId ? 0 : paymentTotals.giftCardCents,
      collectedCents,
    },
  };
}

export function isReportableSaleItem(item: any) {
  return item.status !== "voided" && item.status !== "refunded";
}

export const cents = readCents;

export function getFinalServiceCents(item: any) {
  const stored = cents(item.finalServiceCents);
  if (stored > 0) return stored;

  return calculateFinalServiceCents(item.priceCents, item.discountCents);
}

export function getCommissionCents(item: any) {
  const stored = cents(item.workerCommissionCents);
  if (stored > 0) return stored;

  const rate = Number(item.commissionRateSnapshot ?? 0);
  return Number.isFinite(rate) ? Math.round(getFinalServiceCents(item) * rate) : 0;
}

export function getCommissionRateSnapshot(item: any, worker: any) {
  const rate = Number(item.commissionRateSnapshot ?? worker.commissionRate ?? 0);
  return Number.isFinite(rate) ? rate : 0;
}

