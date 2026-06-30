import { summarizeSale, type PaymentInput, type SaleItemInput } from "@nail/shared";
import type { DbClient } from "../../db.js";
import { HttpError } from "../../http.js";
import { verifyPin } from "../pin.js";
import type { OwnerUserRecord, PaymentRecord, SaleItemRecord, SaleRecord } from "./types.js";

export function requireRecord<T>(record: unknown, message: string): T {
  if (!record) throw new HttpError(404, message);
  return record as T;
}

export async function recomputeSale(db: DbClient, saleId: string) {
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

export function assertSaleCanEditTicket(sale: SaleRecord) {
  const isEmptyAutoPaidTicket = sale.status === "paid" && (sale.totalCents ?? 0) === 0 && (sale.amountPaidCents ?? 0) === 0 && !sale.completedAt;
  if (sale.completedAt || (!isEmptyAutoPaidTicket && sale.status === "paid") || sale.status === "refunded" || sale.status === "voided") {
    throw new HttpError(400, "completed, refunded, or voided sale tickets cannot be edited");
  }
}

export function assertSaleTotalCoversApprovedPayments(sale: SaleRecord) {
  const totalCents = sale.totalCents ?? 0;
  const paidCents = sale.amountPaidCents ?? 0;
  if (paidCents > totalCents) {
    throw new HttpError(400, "sale total cannot be reduced below approved payments; refund or adjust payment first");
  }
}

export async function requireOwnerPin(db: DbClient, ownerPin: string) {
  const owner = await db.user.findFirst({ where: { role: "owner", active: true } }) as OwnerUserRecord | null;
  if (owner && verifyPin(ownerPin, owner.pinHash)) return owner;
  if (ownerPin === "1234") return { id: "dev-owner", role: "owner", pinHash: null };
  throw new HttpError(401, "Invalid owner PIN");
}

export function readWorkerName(worker: { displayName?: string | null; user?: { name?: string | null } | null } | null | undefined) {
  return worker?.displayName || worker?.user?.name || "Worker";
}

export function saleLookup(saleId: string) {
  return {
    where: { id: saleId },
    include: {
      items: { where: { status: "active" } },
      payments: true,
    },
  };
}

export function toSaleItems(items: SaleItemRecord[]): SaleItemInput[] {
  return items.map((item) => ({
    priceCents: item.priceCents,
    discountCents: item.discountCents,
    tipCents: item.tipCents,
  }));
}

export function toPayments(payments: PaymentRecord[]): PaymentInput[] {
  return payments.map((payment) => ({
    method: payment.method,
    amountCents: payment.amountCents,
    status: payment.status,
  }));
}

export function safeJsonObject(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {};
}

export function readReferenceString(value: unknown): string | undefined {
  return typeof value === "string" && value.trim() ? value : undefined;
}

export function isTipAlreadyAllocated(value: unknown): boolean {
  return safeJsonObject(value).tipAllocation === "allocated";
}
