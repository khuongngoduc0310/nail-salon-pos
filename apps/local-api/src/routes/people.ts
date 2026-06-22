import type { FastifyInstance } from "fastify";
import type { DbClient } from "../db.js";
import { broadcast } from "../ws/events.js";
import { verifyWorkerToken } from "./auth.js";
import { hashPin, parseOptionalWorkerPin, parseRequiredWorkerPin } from "./pin.js";
import {
  asObject,
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
      const pin = parseRequiredWorkerPin(body.pin);
      const worker = await db.$transaction(async (tx) => {
        const user = await tx.user.create({
          data: {
            name: requiredString(body.name, "name"),
            email: optionalString(body.email, "email"),
            phone: optionalString(body.phone, "phone"),
            role: "worker",
            pinHash: hashPin(pin),
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
          phone: optionalString(body.phone, "phone"),
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

function getWorkerUserId(worker: unknown): string {
  if (!worker || typeof worker !== "object" || !("userId" in worker) || typeof worker.userId !== "string") {
    throw new Error("worker record did not include a user id");
  }

  return worker.userId;
}
