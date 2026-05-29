import type { FastifyInstance } from "fastify";
import type { DbClient } from "../db.js";
import {
  asObject,
  getParams,
  getQuery,
  handleRouteError,
  HttpError,
  optionalBoolean,
  optionalInteger,
  optionalString,
  requiredInteger,
  requiredString,
} from "../http.js";

export async function registerCatalogRoutes(app: FastifyInstance, db: DbClient) {
  app.get("/api/service-categories", async (_request, reply) => {
    try {
      return await db.serviceCategory.findMany({
        where: { active: true },
        include: {
          services: {
            where: { active: true },
            orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
          },
        },
        orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
      });
    } catch (error) {
      return handleRouteError(error, reply);
    }
  });

  app.post("/api/service-categories", async (request, reply) => {
    try {
      const body = asObject(request.body);
      const category = await db.serviceCategory.create({
        data: {
          name: requiredString(body.name, "name"),
          sortOrder: optionalInteger(body.sortOrder, "sortOrder") ?? 0,
          active: optionalBoolean(body.active, "active") ?? true,
        },
      });

      return reply.code(201).send(category);
    } catch (error) {
      return handleRouteError(error, reply);
    }
  });

  app.patch("/api/service-categories/:id", async (request, reply) => {
    try {
      const body = asObject(request.body);
      const params = getParams(request);
      const data = compact({
        name: optionalString(body.name, "name"),
        sortOrder: optionalInteger(body.sortOrder, "sortOrder"),
        active: optionalBoolean(body.active, "active"),
      });

      return await db.serviceCategory.update({
        where: { id: requiredString(params.id, "id") },
        data,
      });
    } catch (error) {
      return handleRouteError(error, reply);
    }
  });

  app.get("/api/services", async (request, reply) => {
    try {
      const query = getQuery(request);
      const active = parseBooleanQuery(query.active, "active");
      const categoryId = optionalString(query.categoryId, "categoryId");

      return await db.service.findMany({
        where: compact({ active, categoryId }),
        include: { category: true },
        orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
      });
    } catch (error) {
      return handleRouteError(error, reply);
    }
  });

  app.post("/api/services", async (request, reply) => {
    try {
      const body = asObject(request.body);
      const priceCents = requiredInteger(body.priceCents, "priceCents");
      let turnCount = optionalInteger(body.turnCount, "turnCount");

      if (turnCount == null) {
        // Auto-compute default: 1 if price >= threshold, else 0
        const settings = await (db as any).salonSettings.findUnique({ where: { id: "default" } });
        const threshold = settings?.turnCountThresholdCents ?? 3000;
        turnCount = priceCents >= threshold ? 1 : 0;
      }

      const service = await db.service.create({
        data: {
          categoryId: requiredString(body.categoryId, "categoryId"),
          name: requiredString(body.name, "name"),
          description: optionalString(body.description, "description"),
          priceCents,
          turnCount,
          durationMinutes: optionalInteger(body.durationMinutes, "durationMinutes") ?? 30,
          active: optionalBoolean(body.active, "active") ?? true,
          sortOrder: optionalInteger(body.sortOrder, "sortOrder") ?? 0,
        },
      });

      return reply.code(201).send(service);
    } catch (error) {
      return handleRouteError(error, reply);
    }
  });

  app.patch("/api/services/:id", async (request, reply) => {
    try {
      const body = asObject(request.body);
      const params = getParams(request);
      const data = compact({
        categoryId: optionalString(body.categoryId, "categoryId"),
        name: optionalString(body.name, "name"),
        description: optionalString(body.description, "description"),
        priceCents: optionalInteger(body.priceCents, "priceCents"),
        turnCount: optionalInteger(body.turnCount, "turnCount"),
        durationMinutes: optionalInteger(body.durationMinutes, "durationMinutes"),
        active: optionalBoolean(body.active, "active"),
        sortOrder: optionalInteger(body.sortOrder, "sortOrder"),
      });

      return await db.service.update({
        where: { id: requiredString(params.id, "id") },
        data,
      });
    } catch (error) {
      return handleRouteError(error, reply);
    }
  });

  app.delete("/api/services/:id", async (request, reply) => {
    try {
      const params = getParams(request);
      return await db.service.update({
        where: { id: requiredString(params.id, "id") },
        data: { active: false },
      });
    } catch (error) {
      return handleRouteError(error, reply);
    }
  });
}

function parseBooleanQuery(value: unknown, fieldName: string): boolean | undefined {
  if (value === undefined || value === null || value === "") {
    return undefined;
  }

  if (value === "true") {
    return true;
  }

  if (value === "false") {
    return false;
  }

  throw new HttpError(400, `${fieldName} must be true or false`);
}

function compact(input: Record<string, unknown>) {
  return Object.fromEntries(Object.entries(input).filter(([, value]) => value !== undefined));
}
