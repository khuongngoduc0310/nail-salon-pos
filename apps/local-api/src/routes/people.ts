import type { FastifyInstance, FastifyRequest } from "fastify";
import { createHmac, randomBytes, scryptSync, timingSafeEqual } from "node:crypto";
import type { DbClient } from "../db.js";
<<<<<<< HEAD
import { broadcast } from "../ws/events.js";
import { verifyWorkerToken } from "./auth.js";
import { hashPin, parseOptionalWorkerPin, parseRequiredWorkerPin } from "./pin.js";
=======
import { countTurnsTaken, type TurnStatus } from "@nail/shared";
import { normalizePhone } from "../phone.js";
>>>>>>> bdf0b2066dfcb2e3e613cb86c08bdfaba329da34
import {
  asObject,
  HttpError,
  optionalDate,
  getParams,
  getQuery,
  handleRouteError,
  HttpError,
  optionalBoolean,
  optionalInteger,
  optionalNumber,
  optionalString,
  requiredNumber,
  requiredString,
} from "../http.js";

const workerStatuses = new Set(["available", "in_service", "on_break", "off_today", "appointment_only"]);
const appointmentStatuses = new Set(["scheduled", "confirmed", "checked_in", "in_service", "completed", "cancelled", "no_show"]);
const WORKER_TOKEN_TTL_SECONDS = 60 * 60 * 12;
const WORKER_TOKEN_SECRET = process.env.WORKER_SESSION_SECRET ?? "dev-worker-session-secret";

type WorkerDashboardRecord = {
  id: string;
  displayName: string;
  currentStatus: string;
  active?: boolean;
  turns?: WorkerTurnRecord[];
  saleItems?: WorkerSaleItemRecord[];
};

type WorkerTurnRecord = {
  id: string;
  status: TurnStatus;
  turnType?: string;
  checkinId?: string | null;
  appointmentId?: string | null;
  workerId?: string | null;
  skippedReason?: string | null;
  createdAt?: Date | string | null;
  startedAt: Date | string | null;
  endedAt?: Date | string | null;
  completedAt?: Date | string | null;
  customer?: { id: string; name?: string | null; phone?: string | null } | null;
  checkin?: { notes?: string | null; customer?: { id: string; name?: string | null; phone?: string | null } | null } | null;
  sale?: {
    id: string;
    items?: WorkerTurnSaleItemRecord[];
  } | null;
};

type WorkerSaleItemRecord = {
  id?: string;
  serviceNameSnapshot?: string;
  saleId?: string;
  finalServiceCents?: number;
  workerCommissionCents?: number;
  tipCents?: number;
  workerTotalCents?: number;
  createdAt?: Date | string;
};

type WorkerTurnSaleItemRecord = {
  workerId?: string;
  serviceNameSnapshot?: string;
  status?: string;
  priceCents?: number;
  discountCents?: number;
  finalServiceCents?: number;
  tipCents?: number;
  workerCommissionCents?: number;
};

type WorkerSessionPayload = {
  workerId: string;
  exp: number;
};

export async function registerPeopleRoutes(app: FastifyInstance, db: DbClient) {
  app.get("/api/workers", async (_request, reply) => {
    try {
      return await db.worker.findMany({
        include: { user: true },
        orderBy: [{ sortOrder: "asc" }, { displayName: "asc" }],
      });
    } catch (error) {
      return handleRouteError(error, reply);
    }
  });

  app.post("/api/workers", async (request, reply) => {
    try {
      const body = asObject(request.body);
<<<<<<< HEAD
      const pin = parseRequiredWorkerPin(body.pin);
=======
      const password = requiredString(body.password, "password");
      if (password.length < 4) {
        return reply.code(400).send({ error: "password must be at least 4 characters" });
      }
>>>>>>> bdf0b2066dfcb2e3e613cb86c08bdfaba329da34
      const worker = await db.$transaction(async (tx) => {
        const user = await tx.user.create({
          data: {
            name: requiredString(body.name, "name"),
            email: optionalString(body.email, "email"),
            phone: optionalString(body.phone, "phone"),
            role: "worker",
<<<<<<< HEAD
            pinHash: hashPin(pin),
=======
            passwordHash: hashSecret(password),
>>>>>>> bdf0b2066dfcb2e3e613cb86c08bdfaba329da34
          },
        });
        const userId = getRecordId(user);

        return tx.worker.create({
          data: {
            userId,
            displayName: optionalString(body.displayName, "displayName") ?? requiredString(body.name, "name"),
            commissionRate: requiredNumber(body.commissionRate, "commissionRate"),
            currentStatus: optionalString(body.currentStatus, "currentStatus") ?? "available",
            active: optionalBoolean(body.active, "active") ?? true,
            sortOrder: optionalInteger(body.sortOrder, "sortOrder") ?? 0,
          },
        });
      });

      return reply.code(201).send(worker);
    } catch (error) {
      return handleRouteError(error, reply);
    }
  });

  app.post("/api/workers/login", async (request, reply) => {
    try {
      const body = asObject(request.body);
      const workerId = requiredString(body.workerId, "workerId");
      const password = requiredString(body.password, "password");
      const worker = (await db.worker.findUnique({
        where: { id: workerId },
        include: {
          user: true,
          turns: {
            orderBy: [{ createdAt: "desc" }],
            include: { checkin: { include: { customer: true } }, customer: true },
            take: 50,
          },
        },
      })) as
        | { id: string; displayName: string; user?: { passwordHash?: string | null }; turns?: unknown[] }
        | null;
      if (!worker?.user?.passwordHash || !verifySecret(password, worker.user.passwordHash)) {
        return reply.code(401).send({ error: "invalid worker credentials" });
      }
      const issued = issueWorkerToken(worker.id);

      return {
        workerId: worker.id,
        displayName: worker.displayName,
        token: issued.token,
        expiresAt: issued.expiresAt,
      };
    } catch (error) {
      return handleRouteError(error, reply);
    }
  });

  app.get("/api/worker/me/dashboard", async (request, reply) => {
    try {
      const session = requireWorkerSession(request);
      const query = getQuery(request);
      const start = optionalDate(query.start, "start") ?? startOfToday();
      const end = optionalDate(query.end, "end") ?? endOfToday(start);
      const worker = (await db.worker.findUnique({
        where: { id: session.workerId },
        include: {
          turns: {
            where: { createdAt: { gte: start, lt: end } },
            orderBy: [{ createdAt: "desc" }],
            include: {
              checkin: { include: { customer: true } },
              customer: true,
              sale: { include: { items: { where: { status: "active" } } } },
            },
            take: 20,
          },
          saleItems: {
            where: { createdAt: { gte: start, lt: end }, status: "active" },
            orderBy: [{ createdAt: "desc" }],
            take: 50,
          },
        },
      })) as WorkerDashboardRecord | null;
      if (!worker || worker.active === false) {
        return reply.code(401).send({ error: "worker session expired" });
      }

      return buildWorkerDashboard(worker, start, end);
    } catch (error) {
      return handleRouteError(error, reply);
    }
  });

  app.get("/api/worker/me/appointments", async (request, reply) => {
    try {
      const session = requireWorkerSession(request);
      const query = getQuery(request);
      const start = optionalDate(query.start, "start");
      const end = optionalDate(query.end, "end");
      const status = optionalStatus(query.status, appointmentStatuses, "status");

      return await db.appointment.findMany({
        where: compact({
          workerId: session.workerId,
          status,
          startTime: start || end ? compact({ gte: start, lt: end }) : undefined,
        }),
        include: { customer: true, worker: true, services: true },
        orderBy: { startTime: "asc" },
      });
    } catch (error) {
      return handleRouteError(error, reply);
    }
  });

  app.post("/api/worker/me/appointments", async (request, reply) => {
    try {
      const session = requireWorkerSession(request);
      const body = asObject(request.body);
      const startTime = requiredDate(body.startTime, "startTime");
      const endTime = requiredDate(body.endTime, "endTime");
      if (endTime <= startTime) {
        return reply.code(400).send({ error: "endTime must be after startTime" });
      }

      const appointment = await db.appointment.create({
        data: {
          workerId: session.workerId,
          customerId: optionalString(body.customerId, "customerId"),
          startTime,
          endTime,
          status: optionalStatus(body.status, appointmentStatuses, "status") ?? "scheduled",
          notes: optionalString(body.notes, "notes"),
          createdByUserId: optionalString(body.createdByUserId, "createdByUserId"),
        },
      });

      return reply.code(201).send(appointment);
    } catch (error) {
      return handleRouteError(error, reply);
    }
  });

  app.delete("/api/worker/me/appointments/:id", async (request, reply) => {
    try {
      const session = requireWorkerSession(request);
      const params = getParams(request);
      const appointmentId = requiredString(params.id, "id");
      const matches = (await db.appointment.findMany({
        where: { id: appointmentId, workerId: session.workerId },
        take: 1,
      })) as Array<{ id: string }>;
      if (matches.length === 0) {
        return reply.code(404).send({ error: "appointment not found" });
      }

      return await db.appointment.update({
        where: { id: appointmentId },
        data: { status: "cancelled" },
      });
    } catch (error) {
      return handleRouteError(error, reply);
    }
  });

  app.get("/api/worker/me/earnings", async (request, reply) => {
    try {
      const session = requireWorkerSession(request);
      const query = getQuery(request);
      const start = optionalDate(query.start, "start") ?? startOfToday();
      const end = optionalDate(query.end, "end") ?? endOfToday(start);

      const worker = (await db.worker.findUnique({
        where: { id: session.workerId },
        include: {
          saleItems: {
            where: { createdAt: { gte: start, lt: end }, status: "active" },
            orderBy: [{ createdAt: "desc" }],
            take: 100,
          },
        },
      })) as WorkerDashboardRecord | null;
      if (!worker || worker.active === false) {
        return reply.code(401).send({ error: "worker session expired" });
      }

      const items = worker.saleItems ?? [];
      const salesTotalCents = items.reduce((sum, item) => sum + (item.finalServiceCents ?? 0), 0);
      const tipsTotalCents = items.reduce((sum, item) => sum + (item.tipCents ?? 0), 0);
      const commissionTotalCents = items.reduce((sum, item) => sum + (item.workerCommissionCents ?? 0), 0);
      const estimatedPayTotalCents = items.reduce(
        (sum, item) => sum + (item.workerTotalCents ?? (item.workerCommissionCents ?? 0) + (item.tipCents ?? 0)),
        0
      );

      const byDay = new Map<string, { date: string; serviceCents: number; tipsCents: number; commissionCents: number; estimatedPayCents: number }>();
      for (const item of items) {
        const key = item.createdAt ? new Date(item.createdAt).toISOString().slice(0, 10) : "unknown";
        const existing = byDay.get(key) ?? { date: key, serviceCents: 0, tipsCents: 0, commissionCents: 0, estimatedPayCents: 0 };
        existing.serviceCents += item.finalServiceCents ?? 0;
        existing.tipsCents += item.tipCents ?? 0;
        existing.commissionCents += item.workerCommissionCents ?? 0;
        existing.estimatedPayCents += item.workerTotalCents ?? (item.workerCommissionCents ?? 0) + (item.tipCents ?? 0);
        byDay.set(key, existing);
      }

      return {
        range: { start: start.toISOString(), end: end.toISOString() },
        totals: {
          serviceCents: salesTotalCents,
          tipsCents: tipsTotalCents,
          commissionCents: commissionTotalCents,
          estimatedPayCents: estimatedPayTotalCents,
        },
        byDay: [...byDay.values()].sort((a, b) => b.date.localeCompare(a.date)),
        recentItems: items.map((item) => ({
          id: item.id,
          saleId: item.saleId,
          serviceName: item.serviceNameSnapshot,
          serviceCents: item.finalServiceCents ?? 0,
          tipsCents: item.tipCents ?? 0,
          commissionCents: item.workerCommissionCents ?? 0,
          estimatedPayCents: item.workerTotalCents ?? (item.workerCommissionCents ?? 0) + (item.tipCents ?? 0),
          createdAt: item.createdAt ?? null,
        })),
      };
    } catch (error) {
      return handleRouteError(error, reply);
    }
  });

  app.get("/api/workers/:id/dashboard", async (request, reply) => {
    try {
      const params = getParams(request);
      const query = getQuery(request);
      const workerId = requiredString(params.id, "id");
      const start = optionalDate(query.start, "start") ?? startOfToday();
      const end = optionalDate(query.end, "end") ?? endOfToday(start);
      const worker = (await db.worker.findUnique({
        where: { id: workerId },
        include: {
          turns: {
            where: { createdAt: { gte: start, lt: end } },
            orderBy: [{ createdAt: "desc" }],
            include: {
              checkin: { include: { customer: true } },
              customer: true,
              sale: { include: { items: { where: { status: "active" } } } },
            },
            take: 20,
          },
          saleItems: {
            where: { createdAt: { gte: start, lt: end }, status: "active" },
          },
        },
      })) as WorkerDashboardRecord | null;
      if (!worker || worker.active === false) {
        return reply.code(401).send({ error: "worker session expired" });
      }

      return buildWorkerDashboard(worker, start, end);
    } catch (error) {
      return handleRouteError(error, reply);
    }
  });

  app.patch("/api/workers/:id", async (request, reply) => {
    try {
      const body = asObject(request.body);
      const params = getParams(request);
      const workerId = requiredString(params.id, "id");
      const pin = parseOptionalWorkerPin(body.pin);
      const workerData = compact({
        displayName: optionalString(body.displayName, "displayName"),
        commissionRate: optionalNumber(body.commissionRate, "commissionRate"),
        active: optionalBoolean(body.active, "active"),
        sortOrder: optionalInteger(body.sortOrder, "sortOrder"),
      });

      return await db.$transaction(async (tx) => {
        const worker =
          Object.keys(workerData).length > 0
            ? await tx.worker.update({
                where: { id: workerId },
                data: workerData,
              })
            : await tx.worker.findUnique({ where: { id: workerId } });

        if (!worker) {
          throw new HttpError(404, "Worker not found");
        }

        if (pin) {
          await tx.user.update({
            where: { id: getWorkerUserId(worker) },
            data: { pinHash: hashPin(pin) },
          });
        }

        return worker;
      });
    } catch (error) {
      return handleRouteError(error, reply);
    }
  });

  app.patch("/api/workers/:id/status", async (request, reply) => {
    try {
      const body = asObject(request.body);
      const params = getParams(request);
      const status = requiredString(body.status, "status");
      if (!workerStatuses.has(status)) {
        return reply.code(400).send({ error: "status is not a valid worker status" });
      }

      const workerId = requiredString(params.id, "id");

      // Auth: require a valid worker/owner token
      const userId = await verifyWorkerToken(db, request.headers.authorization);
      if (!userId) {
        return reply.code(401).send({ error: "Not authenticated" });
      }

      // Verify the token user owns this worker record
      const worker = await (db as any).worker.findUnique({
        where: { id: workerId },
        include: { user: true },
      });

      if (!worker) {
        return reply.code(404).send({ error: "Worker not found" });
      }

      if (worker.userId !== userId && worker.user?.role !== "owner") {
        return reply.code(403).send({ error: "Forbidden" });
      }

      const updated = await db.worker.update({
        where: { id: workerId },
        data: { currentStatus: status },
      });
      broadcast("worker:status_changed", { workerId, status });
      return updated;
    } catch (error) {
      return handleRouteError(error, reply);
    }
  });

  app.get("/api/customers", async (request, reply) => {
    try {
      const query = getQuery(request);
      const search = optionalString(query.search, "search");

      return await db.customer.findMany({
        where: search
          ? {
              OR: [
                { name: { contains: search, mode: "insensitive" } },
                { phone: { contains: search } },
                { email: { contains: search, mode: "insensitive" } },
              ],
            }
          : undefined,
        orderBy: { createdAt: "desc" },
      });
    } catch (error) {
      return handleRouteError(error, reply);
    }
  });

  app.post("/api/customers", async (request, reply) => {
    try {
      const body = asObject(request.body);
      const customer = await db.customer.create({
        data: {
          name: requiredString(body.name, "name"),
          phone: normalizePhone(requiredString(body.phone, "phone")),
          email: optionalString(body.email, "email"),
        },
      });

      return reply.code(201).send(customer);
    } catch (error) {
      return handleRouteError(error, reply);
    }
  });
}

function getRecordId(record: unknown): string {
  if (!record || typeof record !== "object" || !("id" in record) || typeof record.id !== "string") {
    throw new Error("created record did not include an id");
  }

  return record.id;
}

function compact(input: Record<string, unknown>) {
  return Object.fromEntries(Object.entries(input).filter(([, value]) => value !== undefined));
}

<<<<<<< HEAD
function getWorkerUserId(worker: unknown): string {
  if (!worker || typeof worker !== "object" || !("userId" in worker) || typeof worker.userId !== "string") {
    throw new Error("worker record did not include a user id");
  }

  return worker.userId;
=======
function hashSecret(secret: string): string {
  const salt = randomBytes(16).toString("hex");
  const key = scryptSync(secret, salt, 64).toString("hex");
  return `${salt}:${key}`;
}

function verifySecret(secret: string, encoded: string): boolean {
  const [salt, expectedKey] = encoded.split(":");
  if (!salt || !expectedKey) return false;
  const actualKey = scryptSync(secret, salt, 64).toString("hex");
  return timingSafeEqual(Buffer.from(expectedKey, "hex"), Buffer.from(actualKey, "hex"));
}

function issueWorkerToken(workerId: string): { token: string; expiresAt: string } {
  const exp = Math.floor(Date.now() / 1000) + WORKER_TOKEN_TTL_SECONDS;
  const payload: WorkerSessionPayload = { workerId, exp };
  const encodedPayload = encodeBase64Url(JSON.stringify(payload));
  const signature = signTokenSegment(encodedPayload);
  return {
    token: `${encodedPayload}.${signature}`,
    expiresAt: new Date(exp * 1000).toISOString(),
  };
}

function requireWorkerSession(request: FastifyRequest): WorkerSessionPayload {
  const auth = request.headers.authorization;
  if (!auth || !auth.startsWith("Bearer ")) {
    throw new HttpError(401, "missing worker token");
  }
  const token = auth.slice("Bearer ".length).trim();
  const [encodedPayload, providedSignature] = token.split(".");
  if (!encodedPayload || !providedSignature) {
    throw new HttpError(401, "invalid worker token");
  }
  const expectedSignature = signTokenSegment(encodedPayload);
  const expectedBuffer = Buffer.from(expectedSignature, "utf8");
  const providedBuffer = Buffer.from(providedSignature, "utf8");
  if (expectedBuffer.length !== providedBuffer.length || !timingSafeEqual(expectedBuffer, providedBuffer)) {
    throw new HttpError(401, "invalid worker token");
  }

  let payload: WorkerSessionPayload;
  try {
    payload = JSON.parse(decodeBase64Url(encodedPayload)) as WorkerSessionPayload;
  } catch {
    throw new HttpError(401, "invalid worker token");
  }
  if (!payload.workerId || !payload.exp || payload.exp <= Math.floor(Date.now() / 1000)) {
    throw new HttpError(401, "worker token expired");
  }
  return payload;
}

function signTokenSegment(encodedPayload: string): string {
  const hmac = createHmac("sha256", WORKER_TOKEN_SECRET);
  hmac.update(encodedPayload);
  return encodeBase64Url(hmac.digest());
}

function encodeBase64Url(value: string | Buffer): string {
  const base64 = Buffer.isBuffer(value) ? value.toString("base64") : Buffer.from(value, "utf8").toString("base64");
  return base64.replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

function decodeBase64Url(value: string): string {
  const normalized = value.replace(/-/g, "+").replace(/_/g, "/");
  const padded = normalized + "===".slice((normalized.length + 3) % 4);
  return Buffer.from(padded, "base64").toString("utf8");
}

function requiredDate(value: unknown, fieldName: string): Date {
  const date = optionalDate(value, fieldName);
  if (!date) {
    throw new HttpError(400, `${fieldName} is required`);
  }

  return date;
}

function optionalStatus(value: unknown, allowed: Set<string>, fieldName: string): string | undefined {
  const status = optionalString(value, fieldName);
  if (!status) return undefined;
  if (!allowed.has(status)) {
    throw new HttpError(400, `${fieldName} is not valid`);
  }
  return status;
}

function buildWorkerDashboard(worker: WorkerDashboardRecord, start: Date, end: Date) {
  const turns = worker.turns ?? [];
  const items = worker.saleItems ?? [];
  const activeTurn = turns.find((turn) => turn.status === "in_service" || turn.status === "assigned") ?? null;
  const salesRangeCents = items.reduce((sum, item) => sum + (item.finalServiceCents ?? 0), 0);
  const tipsRangeCents = items.reduce((sum, item) => sum + (item.tipCents ?? 0), 0);
  const commissionRangeCents = items.reduce((sum, item) => sum + (item.workerCommissionCents ?? 0), 0);
  const estimatedPayTodayCents = items.reduce(
    (sum, item) => sum + (item.workerTotalCents ?? (item.workerCommissionCents ?? 0) + (item.tipCents ?? 0)),
    0
  );

  const recentTurns = turns.map((turn) => {
    const saleItems = (turn.sale?.items ?? []).filter((item) => item.workerId === worker.id);
    const serviceTotalCents = saleItems.reduce(
      (sum, item) => sum + (item.finalServiceCents ?? Math.max(0, (item.priceCents ?? 0) - (item.discountCents ?? 0))),
      0
    );
    const tipTotalCents = saleItems.reduce((sum, item) => sum + (item.tipCents ?? 0), 0);
    const commissionCents = saleItems.reduce((sum, item) => sum + (item.workerCommissionCents ?? 0), 0);
    const serviceNames = saleItems
      .map((item) => item.serviceNameSnapshot)
      .filter((name): name is string => typeof name === "string" && name.length > 0);

    return {
      ...turn,
      serviceNames,
      serviceTotalCents,
      tipTotalCents,
      commissionCents,
      turnTotalCents: serviceTotalCents + tipTotalCents,
    };
  });

  return {
    range: {
      start: start.toISOString(),
      end: end.toISOString(),
    },
    worker: {
      id: worker.id,
      displayName: worker.displayName,
      status: worker.currentStatus,
    },
    activeTurn,
    turnsTodayCount: countTurnsTaken(turns),
    salesTodayCents: salesRangeCents,
    tipsTodayCents: tipsRangeCents,
    salesRangeCents,
    tipsRangeCents,
    commissionRangeCents,
    estimatedPayTodayCents,
    recentTurns,
  };
}

function startOfToday(): Date {
  const date = new Date();
  date.setHours(0, 0, 0, 0);
  return date;
}

function endOfToday(start: Date): Date {
  const end = new Date(start);
  end.setDate(end.getDate() + 1);
  return end;
>>>>>>> bdf0b2066dfcb2e3e613cb86c08bdfaba329da34
}
