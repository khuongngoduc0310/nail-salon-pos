export type WorkerFormMode = "create" | "edit";

export type WorkerCreatePayload = {
  name: string;
  displayName?: string;
  email?: string;
  phone?: string;
  commissionRate: number;
  pin: string;
};

export type WorkerUpdatePayload = {
  displayName?: string;
  commissionRate: number;
  pin?: string;
};

export type WorkerSavePayload =
  | { ok: true; kind: "create"; data: WorkerCreatePayload }
  | { ok: true; kind: "update"; data: WorkerUpdatePayload }
  | { ok: false; error: string };

export function buildWorkerSavePayload(input: {
  mode: WorkerFormMode;
  name: string;
  displayName: string;
  email: string;
  phone: string;
  commissionText: string;
  pin: string;
}): WorkerSavePayload {
  const name = input.name.trim();
  const displayName = input.displayName.trim() || undefined;
  const email = input.email.trim() || undefined;
  const phone = input.phone.trim() || undefined;
  const pin = input.pin.trim();

  if (input.mode === "create" && !name) {
    return { ok: false, error: "Name is required." };
  }

  const commissionRate = parseFloat(input.commissionText) / 100;
  if (Number.isNaN(commissionRate) || commissionRate < 0 || commissionRate > 1) {
    return { ok: false, error: "Commission rate must be between 0 and 100." };
  }

  if (input.mode === "create" && !pin) {
    return { ok: false, error: "Worker PIN is required." };
  }

  if (pin && !/^\d{4,6}$/.test(pin)) {
    return { ok: false, error: "Worker PIN must be 4 to 6 digits." };
  }

  if (input.mode === "create") {
    return {
      ok: true,
      kind: "create",
      data: { name, displayName, email, phone, commissionRate, pin },
    };
  }

  return {
    ok: true,
    kind: "update",
    data: {
      displayName,
      commissionRate,
      pin: pin || undefined,
    },
  };
}
