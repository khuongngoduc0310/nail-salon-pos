import type { FastifyInstance } from "fastify";
import type { DbClient } from "../db.js";
import { broadcast } from "../ws/events.js";
import {
  asObject,
  getParams,
  getQuery,
  handleRouteError,
  HttpError,
  optionalDate,
  optionalString,
  requiredString,
} from "../http.js";

const appointmentStatuses = new Set([
  "scheduled",
  "confirmed",
  "checked_in",
  "in_service",
  "completed",
  "cancelled",
  "no_show",
]);
const checkinStatuses = new Set([
  "waiting",
  "assigned",
  "in_service",
  "ready_for_checkout",
  "paid",
  "cancelled",
  "no_show",
]);

export async function registerSchedulingRoutes(app: FastifyInstance, db: DbClient) {
  app.post("/api/appointments", async (request, reply) => {
    try {
      const body = asObject(request.body);
      const startTime = requiredDate(body.startTime, "startTime");
      const endTime = requiredDate(body.endTime, "endTime");
      if (endTime <= startTime) {
        return reply.code(400).send({ error: "endTime must be after startTime" });
      }

      const appointment = await db.appointment.create({
        data: {
          customerId: optionalString(body.customerId, "customerId"),
          workerId: optionalString(body.workerId, "workerId"),
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

  app.get("/api/appointments", async (request, reply) => {
    try {
      const query = getQuery(request);
      const start = optionalDate(query.start, "start");
      const end = optionalDate(query.end, "end");

      return await db.appointment.findMany({
        where: compact({
          workerId: optionalString(query.workerId, "workerId"),
          customerId: optionalString(query.customerId, "customerId"),
          status: optionalStatus(query.status, appointmentStatuses, "status"),
          startTime: start || end ? compact({ gte: start, lt: end }) : undefined,
        }),
        include: { customer: true, worker: true, services: true },
        orderBy: { startTime: "asc" },
      });
    } catch (error) {
      return handleRouteError(error, reply);
    }
  });

  app.patch("/api/appointments/:id", async (request, reply) => {
    try {
      const body = asObject(request.body);
      const params = getParams(request);
      const startTime = optionalDate(body.startTime, "startTime");
      const endTime = optionalDate(body.endTime, "endTime");
      if (startTime && endTime && endTime <= startTime) {
        return reply.code(400).send({ error: "endTime must be after startTime" });
      }

      return await db.appointment.update({
        where: { id: requiredString(params.id, "id") },
        data: compact({
          customerId: optionalString(body.customerId, "customerId"),
          workerId: optionalString(body.workerId, "workerId"),
          startTime,
          endTime,
          status: optionalStatus(body.status, appointmentStatuses, "status"),
          notes: optionalString(body.notes, "notes"),
        }),
      });
    } catch (error) {
      return handleRouteError(error, reply);
    }
  });

  app.delete("/api/appointments/:id", async (request, reply) => {
    try {
      const params = getParams(request);
      return await db.appointment.update({
        where: { id: requiredString(params.id, "id") },
        data: { status: "cancelled" },
      });
    } catch (error) {
      return handleRouteError(error, reply);
    }
  });

  app.post("/api/checkins", async (request, reply) => {
    try {
      const body = asObject(request.body);
      const checkin = await db.$transaction(async (tx) => {
        const customerId = await resolveCustomerId(tx, body);

        return tx.checkin.create({
          data: {
            customerId,
            appointmentId: optionalString(body.appointmentId, "appointmentId"),
            requestedWorkerId: optionalString(body.requestedWorkerId, "requestedWorkerId"),
            notes: optionalString(body.notes, "notes"),
            status: optionalStatus(body.status, checkinStatuses, "status") ?? "waiting",
          },
        });
      });

      broadcast("checkin:created", { checkin });
      return reply.code(201).send(checkin);
    } catch (error) {
      return handleRouteError(error, reply);
    }
  });

  app.get("/api/checkins", async (request, reply) => {
    try {
      const query = getQuery(request);
      const status = optionalStatus(query.status, checkinStatuses, "status");
      const date = optionalString(query.date, "date");

      return await db.checkin.findMany({
        where: compact({
          status,
          checkedInAt: date
            ? {
                gte: new Date(`${date}T00:00:00.000`),
                lt: new Date(`${date}T23:59:59.999`),
              }
            : undefined,
        }),
        include: { customer: true, appointment: true, requestedWorker: true },
        orderBy: { checkedInAt: "asc" },
      });
    } catch (error) {
      return handleRouteError(error, reply);
    }
  });

  app.patch("/api/checkins/:id/status", async (request, reply) => {
    try {
      const body = asObject(request.body);
      const params = getParams(request);
      const status = requiredString(body.status, "status");
      if (!checkinStatuses.has(status)) {
        return reply.code(400).send({ error: "status is not a valid check-in status" });
      }

      return await db.checkin.update({
        where: { id: requiredString(params.id, "id") },
        data: { status },
      });
    } catch (error) {
      return handleRouteError(error, reply);
    }
  });
}

async function resolveCustomerId(db: DbClient, body: Record<string, unknown>): Promise<string | undefined> {
  const customerId = optionalString(body.customerId, "customerId");
  if (customerId) {
    return customerId;
  }

  const customerBody = body.customer;
  if (!customerBody) {
    return undefined;
  }

  const customer = asObject(customerBody, "customer");
  const created = await db.customer.create({
    data: {
      name: requiredString(customer.name, "customer.name"),
      phone: optionalString(customer.phone, "customer.phone"),
      email: optionalString(customer.email, "customer.email"),
    },
  });

  return getRecordId(created);
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
  if (!status) {
    return undefined;
  }

  if (!allowed.has(status)) {
    throw new HttpError(400, `${fieldName} is not valid`);
  }

  return status;
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
