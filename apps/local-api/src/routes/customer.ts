import type { FastifyInstance } from "fastify";
import type { DbClient } from "../db.js";
import { issueCustomerToken, requireCustomerSession } from "../auth.js";
import { normalizePhone } from "../phone.js";
import {
  asObject,
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

type CustomerRecord = {
  id: string;
  name: string;
  phone: string;
  email?: string | null;
};

export async function registerCustomerRoutes(app: FastifyInstance, db: DbClient) {
  app.post("/api/customer/auth/start", async (request, reply) => {
    try {
      const body = asObject(request.body);
      const phone = normalizePhone(requiredString(body.phone, "phone"));
      const name = optionalString(body.name, "name") ?? "Guest";
      const email = optionalString(body.email, "email");

      const existing = (await db.customer.findMany({ where: { phone }, take: 1 })) as CustomerRecord[];
      const customer = existing[0]
        ? ((await db.customer.update({
            where: { id: existing[0].id },
            data: {
              name: existing[0].name || name,
              email: email ?? existing[0].email ?? null,
            },
          })) as CustomerRecord)
        : ((await db.customer.create({ data: { phone, name, email } })) as CustomerRecord);

      const issued = issueCustomerToken(customer.id);
      return {
        customer: { id: customer.id, name: customer.name, phone: customer.phone, email: customer.email ?? null },
        token: issued.token,
        expiresAt: issued.expiresAt,
      };
    } catch (error) {
      return handleRouteError(error, reply);
    }
  });

  app.get("/api/customer/me", async (request, reply) => {
    try {
      const session = requireCustomerSession(request);
      const customer = (await db.customer.findUnique({ where: { id: session.customerId } })) as CustomerRecord | null;
      if (!customer) throw new HttpError(401, "customer not found");
      return customer;
    } catch (error) {
      return handleRouteError(error, reply);
    }
  });

  app.get("/api/customer/me/appointments", async (request, reply) => {
    try {
      const session = requireCustomerSession(request);
      const query = getQuery(request);
      const start = optionalDate(query.start, "start");
      const end = optionalDate(query.end, "end");
      const status = optionalStatus(query.status, appointmentStatuses, "status");

      return await db.appointment.findMany({
        where: compact({
          customerId: session.customerId,
          status,
          startTime: start || end ? compact({ gte: start, lt: end }) : undefined,
        }),
        include: { worker: true, services: true },
        orderBy: { startTime: "asc" },
      });
    } catch (error) {
      return handleRouteError(error, reply);
    }
  });

  app.post("/api/customer/me/appointments", async (request, reply) => {
    try {
      const session = requireCustomerSession(request);
      const body = asObject(request.body);
      const startTime = optionalDate(body.startTime, "startTime");
      const endTime = optionalDate(body.endTime, "endTime");
      if (!startTime || !endTime) throw new HttpError(400, "startTime and endTime are required");
      if (endTime <= startTime) throw new HttpError(400, "endTime must be after startTime");

      const appointment = await db.appointment.create({
        data: {
          customerId: session.customerId,
          workerId: optionalString(body.workerId, "workerId"),
          startTime,
          endTime,
          status: optionalStatus(body.status, appointmentStatuses, "status") ?? "scheduled",
          notes: optionalString(body.notes, "notes"),
        },
      });

      return reply.code(201).send(appointment);
    } catch (error) {
      return handleRouteError(error, reply);
    }
  });

  app.get("/api/customer/me/checkins", async (request, reply) => {
    try {
      const session = requireCustomerSession(request);
      const query = getQuery(request);
      const status = optionalStatus(query.status, checkinStatuses, "status");

      return await db.checkin.findMany({
        where: compact({ customerId: session.customerId, status }),
        include: { appointment: true, requestedWorker: true },
        orderBy: { checkedInAt: "desc" },
      });
    } catch (error) {
      return handleRouteError(error, reply);
    }
  });

  app.post("/api/customer/me/checkins", async (request, reply) => {
    try {
      const session = requireCustomerSession(request);
      const body = asObject(request.body);
      const appointmentId = optionalString(body.appointmentId, "appointmentId");
      const requestedWorkerId = optionalString(body.requestedWorkerId, "requestedWorkerId");

      let sessionId: string | undefined;
      if (!appointmentId) {
        const sessions = (await db.workSession.findMany({
          where: { status: "open" },
          orderBy: [{ openedAt: "desc" }],
          take: 1,
        })) as Array<{ id: string }>;
        if (!sessions[0]) throw new HttpError(409, "no open work session");
        sessionId = sessions[0].id;
      }

      const checkin = await db.checkin.create({
        data: {
          customerId: session.customerId,
          sessionId,
          appointmentId,
          requestedWorkerId,
          notes: optionalString(body.notes, "notes"),
          status: "waiting",
        },
      });
      return reply.code(201).send(checkin);
    } catch (error) {
      return handleRouteError(error, reply);
    }
  });
}

function optionalStatus(value: unknown, allowed: Set<string>, fieldName: string): string | undefined {
  const status = optionalString(value, fieldName);
  if (!status) return undefined;
  if (!allowed.has(status)) throw new HttpError(400, `${fieldName} is not valid`);
  return status;
}

function compact(input: Record<string, unknown>) {
  return Object.fromEntries(Object.entries(input).filter(([, value]) => value !== undefined));
}
