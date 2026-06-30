import type { CheckoutDraft } from "./checkoutTypes.js";

const CHECKOUT_DRAFT_STORAGE_KEY = "nail.ownerPos.checkoutDraft.v1";
const CHECKOUT_DRAFT_MAX_AGE_MS = 24 * 60 * 60 * 1000;

export function readCheckoutDraft(): CheckoutDraft | null {
  try {
    const raw = window.localStorage.getItem(CHECKOUT_DRAFT_STORAGE_KEY);
    if (!raw) return null;
    const draft = JSON.parse(raw) as CheckoutDraft;
    if (!draft.savedAt || Date.now() - draft.savedAt > CHECKOUT_DRAFT_MAX_AGE_MS) {
      window.localStorage.removeItem(CHECKOUT_DRAFT_STORAGE_KEY);
      return null;
    }
    if (draft.mode !== "active" && draft.mode !== "done") return null;
    return {
      saleId: draft.saleId ?? null,
      items: Array.isArray(draft.items) ? draft.items : [],
      payments: Array.isArray(draft.payments) ? draft.payments : [],
      selectedWorkerId: draft.selectedWorkerId ?? null,
      amountCents: Number.isInteger(draft.amountCents) ? draft.amountCents : 0,
      changeCents: Number.isInteger(draft.changeCents) ? draft.changeCents : 0,
      hasStarted: Boolean(draft.hasStarted),
      activeCategory: draft.activeCategory || "All",
      activeMethod: draft.activeMethod || "cash",
      pendingTipAllocation: draft.pendingTipAllocation ?? null,
      mode: draft.mode,
      savedAt: draft.savedAt,
    };
  } catch {
    return null;
  }
}

export function writeCheckoutDraft(draft: CheckoutDraft) {
  window.localStorage.setItem(CHECKOUT_DRAFT_STORAGE_KEY, JSON.stringify({ ...draft, savedAt: Date.now() }));
}

export function clearCheckoutDraft() {
  window.localStorage.removeItem(CHECKOUT_DRAFT_STORAGE_KEY);
}

