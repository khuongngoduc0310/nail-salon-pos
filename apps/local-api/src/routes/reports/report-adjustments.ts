export function applyItemAdjustments(item: any, adjustments: any[]) {
  const related = adjustments
    .filter((adjustment) => adjustment.saleItemId === item.id)
    .sort((a, b) => new Date(a.createdAt ?? 0).getTime() - new Date(b.createdAt ?? 0).getTime());
  return related.reduce((current, adjustment) => {
    const nextValue = safeObject(adjustment.newValueJson);
    if (adjustment.type === "worker_correction") {
      return {
        ...current,
        workerId: readString(nextValue.workerId) ?? current.workerId,
        workerName: readString(nextValue.workerName) ?? current.workerName,
        commissionRateSnapshot: typeof nextValue.commissionRateSnapshot === "number" ? nextValue.commissionRateSnapshot : current.commissionRateSnapshot,
      };
    }
    if (adjustment.type === "service_label_correction") {
      return {
        ...current,
        serviceNameSnapshot: readString(nextValue.serviceName) ?? current.serviceNameSnapshot,
      };
    }
    return current;
  }, item);
}

export function toAdjustmentReport(adjustment: any) {
  return {
    id: adjustment.id,
    saleItemId: adjustment.saleItemId ?? null,
    type: adjustment.type,
    previousValue: safeObject(adjustment.previousValueJson),
    newValue: safeObject(adjustment.newValueJson),
    reason: adjustment.reason,
    createdAt: adjustment.createdAt,
  };
}

function safeObject(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {};
}

function readString(value: unknown) {
  return typeof value === "string" && value.trim() ? value : undefined;
}

